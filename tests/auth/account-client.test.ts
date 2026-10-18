import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AccountRequestError,
  checkAccountConnection,
  deleteAccount,
  fetchAccountExport,
  requestJourney,
  requestFellowship,
  restoreAccount,
} from "../../src/lib/account-client";
import { initialState } from "../../src/lib/state";

const fetchMock = vi.fn(),
  replace = vi.fn(),
  storageWrite = vi.fn();
const snapshot = initialState(new Date("2026-10-16T04:00:00Z"));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("window", { location: { replace } });
  vi.stubGlobal("localStorage", { setItem: storageWrite });
});
afterEach(() => vi.unstubAllGlobals());

describe("account requests and recovery", () => {
  it("keeps group invitation codes out of URLs/storage and never replays uncertain creates", async () => {
    const command = {
      type: "create" as const,
      requestId: "10000000-0000-4000-8000-000000000001",
      name: "Fixture",
      consent: true as const,
    };
    fetchMock.mockRejectedValueOnce(new Error("Lost response"));
    await expect(requestFellowship(command)).rejects.toThrow(
      "Check saved groups",
    );
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(storageWrite).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(Response.json({ groups: [] }));
    expect(await requestFellowship()).toEqual({ groups: [] });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/fellowship");
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      cache: "no-store",
      credentials: "same-origin",
    });
  });

  it("does not replay a restore after a lost response or cache its private payload", async () => {
    const backup = {
      version: 1 as const,
      timeZone: "UTC",
      chapters: {},
      attempts: {},
      reflections: {},
    };
    fetchMock.mockRejectedValueOnce(new Error("Lost response"));
    await expect(restoreAccount(backup)).rejects.toThrow(
      "Check saved progress",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(storageWrite).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(Response.json({ state: snapshot }));
    expect(await restoreAccount(backup)).toEqual(snapshot);
    expect(fetchMock.mock.calls[1]).toEqual([
      "/api/account/restore",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        body: JSON.stringify(backup),
      }),
    ]);
  });
  it("does not send an outage back to login or write a local fallback", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { error: "Account service is temporarily unavailable." },
        { status: 503 },
      ),
    );
    await expect(requestJourney()).rejects.toThrow("temporarily unavailable");
    expect(replace).not.toHaveBeenCalled();
    expect(storageWrite).not.toHaveBeenCalled();
  });
  it("requires sign-in again when the server explicitly rejects the session", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ error: "Sign in" }, { status: 401 }),
    );
    await expect(requestJourney()).rejects.toThrow("Please sign in again");
    expect(replace).toHaveBeenCalledWith("/login");
  });
  it("recovers a committed save by reading the server after its response is lost", async () => {
    const saved = {
      ...snapshot,
      reflections: {
        "2026-10-16": {
          text: "Synthetic reflection committed before its response was lost.",
          updatedAt: "2026-10-16T12:00:00.000Z",
        },
      },
      rewards: { "reflection:2026-10-16": { amount: 20, date: "2026-10-16" } },
    };
    fetchMock.mockRejectedValueOnce(new TypeError("Lost response"));
    await expect(
      requestJourney({
        type: "reflect",
        date: "2026-10-16",
        text: saved.reflections["2026-10-16"].text,
      }),
    ).rejects.toThrow("Check your connection");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockResolvedValueOnce(Response.json({ state: saved }));
    expect(await requestJourney()).toEqual(saved);
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
    });
    expect(storageWrite).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
  it("downloads a fresh validated export, never a stale browser snapshot", async () => {
    const fresh = {
      ...snapshot,
      profile: { ...snapshot.profile, name: "Fresh server name" },
    };
    fetchMock.mockResolvedValue(
      Response.json({ ...fresh, refresh_token: "excluded" }),
    );
    expect(await fetchAccountExport()).toEqual(fresh);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/account/export",
      expect.objectContaining({
        cache: "no-store",
        credentials: "same-origin",
        redirect: "error",
      }),
    );
    expect(storageWrite).not.toHaveBeenCalled();
  });
  it("rejects invalid successful responses and failed exports", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ profile: "broken" }));
    await expect(fetchAccountExport()).rejects.toThrow(
      "export could not be read",
    );
    fetchMock.mockResolvedValueOnce(
      Response.json({ error: "Export unavailable." }, { status: 503 }),
    );
    await expect(fetchAccountExport()).rejects.toThrow("Export unavailable");
    expect(storageWrite).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("account deletion client", () => {
  it("sends only explicit confirmation and accepts only a confirmed result", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ deleted: true }));
    await deleteAccount("DELETE MY ACCOUNT");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/account/delete",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ confirmation: "DELETE MY ACCOUNT" }),
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
      }),
    );
    fetchMock.mockResolvedValueOnce(Response.json({ deleted: false }));
    await expect(deleteAccount("DELETE MY ACCOUNT")).rejects.toThrow(
      "could not be confirmed",
    );
    expect(replace).not.toHaveBeenCalled();
    expect(storageWrite).not.toHaveBeenCalled();
  });
  it("keeps a reauthentication or uncertain outcome visible without claiming success", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json(
        { error: "Sign in recently to confirm deletion." },
        { status: 403 },
      ),
    );
    await expect(deleteAccount("DELETE MY ACCOUNT")).rejects.toThrow(
      "Sign in recently",
    );
    fetchMock.mockRejectedValueOnce(new TypeError("lost deletion response"));
    await expect(deleteAccount("DELETE MY ACCOUNT")).rejects.toThrow(
      "Account deletion could not be confirmed",
    );
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("request limits and connection checks", () => {
  it("uses a bounded Retry-After without signing out, retrying or changing local data", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { error: "internal rate details" },
        { status: 429, headers: { "Retry-After": "42" } },
      ),
    );
    try {
      await requestJourney({ type: "complete", book: "GEN", chapter: 1 });
      throw new Error("Expected throttling");
    } catch (error) {
      expect(error).toBeInstanceOf(AccountRequestError);
      expect((error as AccountRequestError).retryAfterSeconds).toBe(42);
      expect((error as Error).message).toContain("wait 42 seconds");
      expect((error as Error).message).not.toContain("internal rate details");
    }
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(replace).not.toHaveBeenCalled();
    expect(storageWrite).not.toHaveBeenCalled();
  });
  it("ignores unreasonable retry headers and exposes only valid support references", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({}, { status: 429, headers: { "Retry-After": "999999" } }),
    );
    await expect(fetchAccountExport()).rejects.toThrow("wait 60 seconds");
    fetchMock.mockResolvedValueOnce(
      Response.json(
        { error: "Please retry." },
        {
          status: 503,
          headers: { "X-Request-ID": "10000000-0000-4000-8000-000000000001" },
        },
      ),
    );
    await expect(fetchAccountExport()).rejects.toThrow("Reference: 10000000");
    fetchMock.mockResolvedValueOnce(
      Response.json(
        { error: "Please retry." },
        { status: 503, headers: { "X-Request-ID": "private-header-value" } },
      ),
    );
    await expect(fetchAccountExport()).rejects.toThrow(/^Please retry\.$/);
  });
  it("checks the authenticated health endpoint and rejects malformed success", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ status: "ok" }));
    await checkAccountConnection();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/account/health",
      expect.objectContaining({
        cache: "no-store",
        credentials: "same-origin",
      }),
    );
    fetchMock.mockResolvedValueOnce(Response.json({ status: "unavailable" }));
    await expect(checkAccountConnection()).rejects.toThrow(
      "could not be checked",
    );
  });
});
