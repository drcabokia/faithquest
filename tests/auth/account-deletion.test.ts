import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthApiError,
  AuthRetryableFetchError,
  type SupabaseClient,
} from "@supabase/supabase-js";
import {
  createDeletionHandler,
  recentlyAuthenticated,
} from "../../supabase/functions/delete-account/handler";

const now = 1800000000;
const getUser = vi.fn(),
  getClaims = vi.fn(),
  rpc = vi.fn(),
  admission = vi.fn(),
  signOut = vi.fn(),
  deleteUser = vi.fn();
const clients = vi.fn(() => ({
  user: {
    auth: { getUser, getClaims },
    rpc: (name: string, ...args: unknown[]) =>
      name === "consume_account_request"
        ? admission(...args)
        : rpc(name, ...args),
  } as unknown as SupabaseClient,
  admin: {
    auth: { admin: { signOut, deleteUser } },
  } as unknown as SupabaseClient,
}));
const handle = createDeletionHandler(clients, () => now * 1000);
function request(
  body = JSON.stringify({ confirmation: "DELETE MY ACCOUNT" }),
  headers: Record<string, string> = {},
) {
  return new Request("https://fixture.test/functions/v1/delete-account", {
    method: "POST",
    headers: {
      authorization: "Bearer fixture-token",
      "content-type": "application/json",
      ...headers,
    },
    body,
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "caller" } }, error: null });
  getClaims.mockResolvedValue({
    data: {
      claims: {
        sub: "caller",
        amr: [{ method: "oauth", timestamp: now - 30 }],
      },
    },
    error: null,
  });
  rpc.mockResolvedValue({ data: true, error: null });
  admission.mockResolvedValue({
    data: { allowed: true, retryAfterSeconds: 0 },
    error: null,
  });
  signOut.mockResolvedValue({ error: null });
  deleteUser.mockResolvedValue({
    data: { user: { id: "caller" } },
    error: null,
  });
});

describe("hosted self-service account deletion", () => {
  it("rejects methods, browser origins and missing credentials before client creation", async () => {
    expect((await handle(new Request("https://fixture.test"))).status).toBe(
      405,
    );
    expect(
      (await handle(request(undefined, { origin: "https://evil.test" })))
        .status,
    ).toBe(403);
    expect(
      (await handle(request(undefined, { authorization: "" }))).status,
    ).toBe(401);
    expect(
      (await handle(request(undefined, { "content-type": "text/plain" })))
        .status,
    ).toBe(400);
    expect(clients).not.toHaveBeenCalled();
  });
  it.each([
    "",
    "invalid-json",
    "null",
    "[]",
    "{}",
    '{"confirmation":"delete my account"}',
    '{"confirmation":"DELETE MY ACCOUNT","userId":"victim"}',
  ])("rejects invalid or forged confirmation: %s", async (body) => {
    expect((await handle(request(body))).status).toBe(400);
    expect(clients).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });
  it("bounds the actual body bytes even without a declared length", async () => {
    expect(
      (await handle(request(JSON.stringify({ confirmation: "é".repeat(600) }))))
        .status,
    ).toBe(413);
    expect(clients).not.toHaveBeenCalled();
  });
  it("requires verified identity and matching verified claims", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    expect((await handle(request())).status).toBe(401);
    getClaims.mockResolvedValueOnce({
      data: { claims: { sub: "victim" } },
      error: null,
    });
    expect((await handle(request())).status).toBe(401);
    getClaims.mockResolvedValueOnce({
      data: null,
      error: new AuthApiError("expired", 401, "session_expired"),
    });
    expect((await handle(request())).status).toBe(401);
    expect(signOut).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });
  it("keeps identity outages retryable and details private", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: new AuthRetryableFetchError("private upstream detail", 503),
    });
    const response = await handle(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private upstream detail");
    expect(deleteUser).not.toHaveBeenCalled();
  });
  it("denies revoked sessions and fails closed on session lookup errors", async () => {
    rpc.mockResolvedValueOnce({ data: false, error: null });
    expect((await handle(request())).status).toBe(401);
    rpc.mockResolvedValueOnce({
      data: null,
      error: new Error("private query detail"),
    });
    expect((await handle(request())).status).toBe(503);
    rpc.mockResolvedValueOnce({ data: "true", error: null });
    expect((await handle(request())).status).toBe(503);
    expect(signOut).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });
  it("requires a recent Google authentication without signing out an older session", async () => {
    getClaims.mockResolvedValue({
      data: {
        claims: {
          sub: "caller",
          iat: now,
          user_metadata: { authenticated_at: now },
          amr: [
            { method: "oauth", timestamp: now - 601 },
            { method: "token_refresh", timestamp: now },
          ],
        },
      },
      error: null,
    });
    const response = await handle(request());
    expect(response.status).toBe(403);
    expect(await response.text()).toContain("within 10 minutes");
    expect(signOut).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });
  it("revokes globally before hard-deleting only the server-verified caller", async () => {
    const response = await handle(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true });
    expect(getUser).toHaveBeenCalledWith("fixture-token");
    expect(getClaims).toHaveBeenCalledWith("fixture-token");
    expect(rpc).toHaveBeenCalledWith("account_session_active");
    expect(signOut).toHaveBeenCalledExactlyOnceWith("fixture-token", "global");
    expect(deleteUser).toHaveBeenCalledExactlyOnceWith("caller", false);
    expect(signOut.mock.invocationCallOrder[0]).toBeLessThan(
      deleteUser.mock.invocationCallOrder[0],
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });
  it("does not delete when global revocation fails", async () => {
    signOut.mockResolvedValue({ error: new Error("private Auth detail") });
    const response = await handle(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private Auth detail");
    expect(deleteUser).not.toHaveBeenCalled();
  });
  it("reports an uncertain outcome after revocation instead of false success", async () => {
    deleteUser.mockResolvedValue({ error: new Error("private DB detail") });
    const response = await handle(request());
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toContain("devices were signed out");
    expect(body.error).not.toContain("private DB detail");
    expect(body).not.toHaveProperty("deleted");
  });
});

describe("recent signed authentication", () => {
  it.each([
    undefined,
    null,
    [],
    ["oauth"],
    [{ method: "oauth", timestamp: now - 601 }],
    [{ method: "oauth", timestamp: now + 31 }],
    [{ method: "token_refresh", timestamp: now }],
    [{ method: "anonymous", timestamp: now }],
    [{ method: "oauth", timestamp: "1800000000" }],
  ])("rejects missing, stale or non-login evidence: %j", (amr) => {
    expect(recentlyAuthenticated(amr, now)).toBe(false);
  });
  it("accepts the ten-minute boundary and a small clock tolerance", () => {
    expect(
      recentlyAuthenticated([{ method: "oauth", timestamp: now - 600 }], now),
    ).toBe(true);
    expect(
      recentlyAuthenticated([{ method: "oauth", timestamp: now + 30 }], now),
    ).toBe(true);
  });
});

it("enforces a deletion budget before any irreversible Auth operation", async () => {
  admission.mockResolvedValue({
    data: { allowed: false, retryAfterSeconds: 900 },
    error: null,
  });
  const response = await handle(request());
  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBe("900");
  expect(response.headers.get("x-request-id")).toMatch(/^[a-f0-9-]{36}$/);
  expect(signOut).not.toHaveBeenCalled();
  expect(deleteUser).not.toHaveBeenCalled();
});
it("fails closed when the deletion budget service is unavailable", async () => {
  admission.mockResolvedValue({
    data: null,
    error: { message: "private quota detail" },
  });
  const response = await handle(request());
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("private quota detail");
  expect(signOut).not.toHaveBeenCalled();
  expect(deleteUser).not.toHaveBeenCalled();
});
