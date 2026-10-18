import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  AuthApiError,
  AuthInvalidJwtError,
  AuthRetryableFetchError,
  AuthUnknownError,
} from "@supabase/supabase-js";
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  session: vi.fn(),
  admission: vi.fn(),
  invoke: vi.fn(),
  signIn: vi.fn(),
  exchange: vi.fn(),
  signOut: vi.fn(),
  claims: vi.fn(),
  cookies: [] as {
    name: string;
    value: string;
    options?: Record<string, unknown>;
  }[],
}));
vi.mock("server-only", () => ({}));
vi.mock("../../src/lib/supabase/server", () => ({
  serverSupabase: async () => ({
    auth: {
      getUser: mocks.getUser,
      signInWithOAuth: mocks.signIn,
      exchangeCodeForSession: mocks.exchange,
      signOut: mocks.signOut,
    },
    functions: { invoke: mocks.invoke },
    rpc: (name: string, ...args: unknown[]) =>
      name === "account_session_active"
        ? mocks.session()
        : name === "consume_account_request"
          ? mocks.admission(...args)
          : mocks.rpc(name, ...args),
  }),
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: unknown,
    _key: unknown,
    options: { cookies: { setAll: (items: typeof mocks.cookies) => void } },
  ) => ({
    rpc: () => mocks.session(),
    auth: {
      getClaims: async () => {
        if (mocks.cookies.length) options.cookies.setAll(mocks.cookies);
        return mocks.claims();
      },
    },
  }),
}));
import { GET, POST } from "../../src/app/api/journey/route";
import { POST as google } from "../../src/app/auth/google/route";
import { GET as callback } from "../../src/app/auth/callback/route";
import { POST as deleteAccountRoute } from "../../src/app/api/account/delete/route";
import { POST as signoutAll } from "../../src/app/auth/signout-all/route";
import { POST as signout } from "../../src/app/auth/signout/route";
import { proxy } from "../../src/proxy";
import { GET as accountHealth } from "../../src/app/api/account/health/route";
import { GET as exportAccount } from "../../src/app/api/account/export/route";
import { POST as restoreAccountRoute } from "../../src/app/api/account/restore/route";
import {
  GET as getFellowship,
  POST as manageFellowship,
} from "../../src/app/api/fellowship/route";
const snapshot = {
  version: 1,
  profile: {
    name: "Private Reader",
    startDate: "2026-10-16",
    timeZone: "UTC",
    theme: "light",
  },
  chapters: {},
  days: {},
  rewards: {},
  attempts: {},
  reflections: {},
  earnedAchievements: [],
};
function request(body: unknown, origin = "https://faithquest.test") {
  return new NextRequest("https://faithquest.test/api/journey", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("FAITHQUEST_STORAGE_MODE", "supabase");
  vi.stubEnv("FAITHQUEST_ACCOUNTS_ENABLED", "true");
  vi.stubEnv("FAITHQUEST_APP_ORIGIN", "https://faithquest.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  mocks.getUser.mockResolvedValue({
    data: { user: { id: "user-a", user_metadata: { full_name: "Reader A" } } },
    error: null,
  });
  mocks.rpc.mockResolvedValue({ data: snapshot, error: null });
  mocks.session.mockResolvedValue({ data: true, error: null });
  mocks.admission.mockResolvedValue({
    data: { allowed: true, retryAfterSeconds: 0 },
    error: null,
  });
  mocks.invoke.mockResolvedValue({ data: { deleted: true }, error: null });
  mocks.claims.mockResolvedValue({
    data: { claims: { sub: "user-a" } },
    error: null,
  });
  mocks.cookies = [];
});
afterEach(() => vi.unstubAllEnvs());
describe("authenticated request boundary", () => {
  it("protects the prayer page with the same live-session boundary", async () => {
    mocks.session.mockResolvedValueOnce({ data: false, error: null });
    const denied = await proxy(
      new NextRequest("https://faithquest.test/prayers"),
    );
    expect(denied.headers.get("location")).toBe(
      "https://faithquest.test/login",
    );
    expect(denied.headers.get("cache-control")).toContain("no-store");
  });

  it("validates private prayer commands and returns only allowlisted conflict messages", async () => {
    const id = crypto.randomUUID(),
      revision = crypto.randomUUID();
    const command = {
      type: "prayer",
      id,
      change: {
        action: "save",
        value: {
          title: "Synthetic",
          text: "A private request",
          status: "ongoing",
        },
      },
      expectedRevision: revision,
    };
    const response = await POST(request(command));
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("mutate_prayer", {
      p_id: id,
      p_action: "save",
      p_value: command.change.value,
      p_expected_revision: revision,
    });
    for (const error of [
      "prayer_conflict",
      "prayer_missing",
      "prayer_limit",
      "follow_up_limit",
    ]) {
      mocks.rpc.mockResolvedValueOnce({
        data: { error, privateText: "must never leak" },
        error: null,
      });
      const denied = await POST(request(command));
      expect(denied.status).toBe(409);
      expect(JSON.stringify(await denied.json())).not.toContain(
        "must never leak",
      );
      expect(denied.headers.get("cache-control")).toContain("no-store");
    }
    mocks.rpc.mockClear();
    const forged = await POST(request({ ...command, user_id: "victim" }));
    expect(forged.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("accepts only available plan IDs and returns a safe conflict when another device has activity", async () => {
    for (const plan of ["chronological-v1", "chronological-draft-v1"]) {
      const invalid = await POST(request({ type: "selectPlan", plan }));
      expect(invalid.status).toBe(400);
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValueOnce({
      data: { ...snapshot, readingPlan: "balanced-v1" },
      error: null,
    });
    const selected = await POST(
      request({ type: "selectPlan", plan: "balanced-v1" }),
    );
    expect(selected.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("select_reading_plan", {
      p_plan: "balanced-v1",
    });
    mocks.rpc.mockResolvedValueOnce({
      data: { error: "plan_locked" },
      error: null,
    });
    const locked = await POST(
      request({ type: "selectPlan", plan: "balanced-v1" }),
    );
    expect(locked.status).toBe(400);
    expect((await locked.json()).error).toMatch(
      /fixed after your first activity/,
    );
    expect(locked.headers.get("cache-control")).toContain("no-store");
  });
  it("validates group consent, exact Origin and bounded bodies before accepting a caller-only command", async () => {
    const command = {
      type: "create",
      requestId: "10000000-0000-4000-8000-000000000001",
      name: "Private fixture group",
      consent: true,
    };
    mocks.rpc.mockResolvedValue({ data: { groups: [] }, error: null });
    expect(
      (await manageFellowship(request(command, "https://other.test"))).status,
    ).toBe(403);
    expect(
      (await manageFellowship(request({ ...command, consent: false }))).status,
    ).toBe(400);
    expect(
      (await manageFellowship(request({ ...command, owner_id: "other" })))
        .status,
    ).toBe(400);
    const large = new NextRequest("https://faithquest.test/api/fellowship", {
      method: "POST",
      headers: { origin: "https://faithquest.test" },
      body: JSON.stringify({ ...command, name: "x".repeat(5000) }),
    });
    expect((await manageFellowship(large)).status).toBe(413);
    expect(mocks.rpc).not.toHaveBeenCalled();
    const response = await manageFellowship(request(command));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("manage_fellowship", {
      p_command: command,
    });
  });
  it("returns only validated group summaries and allowlisted domain errors", async () => {
    mocks.rpc.mockResolvedValue({ data: { groups: [] }, error: null });
    expect(
      await (
        await getFellowship(
          new NextRequest("https://faithquest.test/api/fellowship"),
        )
      ).json(),
    ).toEqual({ groups: [] });
    mocks.rpc.mockResolvedValue({ data: { error: "invite" }, error: null });
    const denied = await manageFellowship(
      request({ type: "join", code: "a".repeat(32), consent: true }),
    );
    expect(denied.status).toBe(400);
    expect(await denied.text()).toContain("invitation is unavailable");
    mocks.rpc.mockResolvedValue({
      data: { error: "PRIVATE RAW JOURNAL" },
      error: null,
    });
    const unknown = await manageFellowship(
      request({ type: "join", code: "a".repeat(32), consent: true }),
    );
    expect(unknown.status).toBe(503);
    expect(await unknown.text()).not.toContain("PRIVATE RAW JOURNAL");
    mocks.rpc.mockResolvedValue({
      data: { groups: [], reflections: "PRIVATE RAW JOURNAL" },
      error: null,
    });
    expect(
      (
        await getFellowship(
          new NextRequest("https://faithquest.test/api/fellowship"),
        )
      ).status,
    ).toBe(503);
  });
  it("denies revoked or unavailable identities without a group RPC and preserves group rate limits", async () => {
    mocks.session.mockResolvedValue({ data: false, error: null });
    expect(
      (
        await getFellowship(
          new NextRequest("https://faithquest.test/api/fellowship"),
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await manageFellowship(
          request({
            type: "leave",
            groupId: "10000000-0000-4000-8000-000000000001",
          }),
        )
      ).status,
    ).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.session.mockResolvedValue({ data: true, error: null });
    mocks.rpc.mockResolvedValue({
      data: null,
      error: {
        code: "PT429",
        details: JSON.stringify({ allowed: false, retryAfterSeconds: 30 }),
      },
    });
    const response = await getFellowship(
      new NextRequest("https://faithquest.test/api/fellowship"),
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("30");
    expect(response.headers.get("location")).toBeNull();
  });

  it("joins a challenge through a caller-only RPC and denies a forged start date or revoked page", async () => {
    expect((await POST(request({ type: "joinChallenge" }))).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith(
      "join_reading_challenge",
      undefined,
    );
    mocks.rpc.mockClear();
    expect(
      (
        await POST(
          request({
            type: "joinChallenge",
            startDate: "2026-01-01",
            user_id: "other",
          }),
        )
      ).status,
    ).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.session.mockResolvedValue({ data: false, error: null });
    expect(
      (await proxy(new NextRequest("https://faithquest.test/challenges")))
        .status,
    ).toBe(307);
    expect((await POST(request({ type: "joinChallenge" }))).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("validates journal categories and preserves the legacy command contract", async () => {
    const entry = {
      type: "reflect",
      date: "2026-10-17",
      text: "A synthetic private reflection about gratitude.",
    };
    expect((await POST(request({ ...entry, category: "prayer" }))).status).toBe(
      200,
    );
    expect(mocks.rpc).toHaveBeenLastCalledWith("save_categorized_reflection", {
      p_date: entry.date,
      p_content: entry.text,
      p_category: "prayer",
    });
    mocks.rpc.mockClear();
    expect((await POST(request({ ...entry, category: "public" }))).status).toBe(
      400,
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect((await POST(request(entry))).status).toBe(200);
    expect(mocks.rpc).toHaveBeenLastCalledWith("save_reflection", {
      p_date: entry.date,
      p_content: entry.text,
    });
  });

  it("saves a validated verse through a caller-only RPC without accepting verse text or rewards", async () => {
    const command = {
      type: "saveVerse",
      book: "JHN",
      chapter: 3,
      verse: 16,
      saved: true,
    };
    const response = await POST(request(command));
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("set_saved_verse", {
      p_book: "JHN",
      p_chapter: 3,
      p_verse: 16,
      p_saved: true,
    });
    mocks.rpc.mockClear();
    expect(
      (
        await POST(
          request({ ...command, text: "Made-up Scripture", user_id: "other" }),
        )
      ).status,
    ).toBe(400);
    expect(
      (await POST(request({ ...command, book: "ACT", chapter: 8, verse: 37 })))
        .status,
    ).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("validates private note intent and delegates optimistic edits without accepting a caller ID", async () => {
    const command = {
      type: "verseNote",
      book: "JHN",
      chapter: 3,
      verse: 16,
      text: " A private note ",
      expectedText: null,
    };
    expect((await POST(request(command))).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("set_verse_note", {
      p_book: "JHN",
      p_chapter: 3,
      p_verse: 16,
      p_text: "A private note",
      p_expected_text: null,
    });
    mocks.rpc.mockClear();
    for (const invalid of [
      { ...command, user_id: "other" },
      { ...command, expectedText: undefined },
      { ...command, text: " " },
      { ...command, text: "x".repeat(2001) },
      { ...command, verse: 99 },
    ])
      expect((await POST(request(invalid))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("returns safe note conflict/removal errors without disclosing saved content", async () => {
    for (const error of [
      "note_conflict",
      "verse_not_saved",
      "verse_has_note",
    ]) {
      mocks.rpc.mockResolvedValueOnce({
        data: { error, content: "Private database text" },
        error: null,
      });
      const response = await POST(
        request({
          type: "verseNote",
          book: "JHN",
          chapter: 3,
          verse: 16,
          text: "Draft",
          expectedText: null,
        }),
      );
      expect(response.status).toBe(409);
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(await response.text()).not.toContain("Private database text");
    }
  });
  it("protects the Study Tools page when a session is missing or revoked", async () => {
    mocks.session.mockResolvedValue({ data: false, error: null });
    const response = await proxy(
      new NextRequest("https://faithquest.test/study"),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });
  const backup = {
    version: 1,
    timeZone: "UTC",
    chapters: { "GEN.1": "2026-10-10" },
    attempts: {},
    reflections: {},
  };
  it("requires an active identity, exact Origin and valid bounded restore payload", async () => {
    expect(
      (await restoreAccountRoute(request(backup, "https://other.test"))).status,
    ).toBe(403);
    expect(
      (await restoreAccountRoute(request({ ...backup, userId: "user-b" })))
        .status,
    ).toBe(400);
    expect(
      (
        await restoreAccountRoute(
          request({ ...backup, rewards: { fake: 150 } }),
        )
      ).status,
    ).toBe(400);
    const oversized = new NextRequest(
      "https://faithquest.test/api/account/restore",
      {
        method: "POST",
        headers: {
          origin: "https://faithquest.test",
          "content-length": "5242881",
        },
        body: "{}",
      },
    );
    expect((await restoreAccountRoute(oversized)).status).toBe(413);
    mocks.session.mockResolvedValue({ data: false, error: null });
    expect((await restoreAccountRoute(request(backup))).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("restores through the caller-only RPC with private response headers", async () => {
    const response = await restoreAccountRoute(request(backup));
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("restore_journey", {
      p_backup: backup,
    });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({ state: snapshot });
  });
  it("bounds streamed restore bytes even when Content-Length is absent", async () => {
    const response = await restoreAccountRoute(
      request({ ...backup, padding: "x".repeat(5 * 1024 * 1024) }),
    );
    expect(response.status).toBe(413);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("returns sanitized restore validation, quota and uncertain-outcome failures", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "22023", message: "Private journal details" },
    });
    const invalid = await restoreAccountRoute(request(backup));
    expect(invalid.status).toBe(400);
    expect(await invalid.text()).not.toContain("Private journal");
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: {
        code: "PT429",
        details: JSON.stringify({ allowed: false, retryAfterSeconds: 900 }),
      },
    });
    const limited = await restoreAccountRoute(request(backup));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("900");
    mocks.rpc.mockRejectedValueOnce(new Error("Private connection details"));
    const unknown = await restoreAccountRoute(request(backup));
    expect(unknown.status).toBe(503);
    expect(await unknown.text()).toContain("Check saved progress");
  });
  it("keeps production accounts closed by default", async () => {
    vi.stubEnv("FAITHQUEST_ACCOUNTS_ENABLED", "false");
    expect(
      (await GET(new NextRequest("https://faithquest.test/api/journey")))
        .status,
    ).toBe(503);
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
  it("rejects cross-origin writes before any account lookup", async () => {
    expect(
      (
        await POST(
          request(
            { type: "complete", book: "GEN", chapter: 1 },
            "https://attacker.test",
          ),
        )
      ).status,
    ).toBe(403);
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
  it("requires server-confirmed identity, including for reads", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: new AuthApiError("Revoked session", 401, "session_not_found"),
    });
    expect(
      (await GET(new NextRequest("https://faithquest.test/api/journey")))
        .status,
    ).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not accept forged XP or a victim ID", async () => {
    expect(
      (
        await POST(
          request({
            type: "complete",
            book: "GEN",
            chapter: 1,
            xp: 999,
            userId: "victim",
          }),
        )
      ).status,
    ).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([
    new AuthRetryableFetchError("Private connection detail", 503),
    new AuthApiError("Private upstream detail", 500, "unexpected_failure"),
    new AuthApiError(
      "Private rate limit detail",
      429,
      "over_request_rate_limit",
    ),
    new AuthUnknownError("Private unknown detail", new Error("network")),
  ])(
    "preserves the session on an unavailable identity service: %s",
    async (error) => {
      mocks.getUser.mockResolvedValue({ data: { user: null }, error });
      const response = await GET(
        new NextRequest("https://faithquest.test/api/journey"),
      );
      expect(response.status).toBe(503);
      expect(response.headers.get("retry-after")).toBe("5");
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(await response.json()).toEqual({
        error: "Your account service is temporarily unavailable. Please retry.",
      });
      expect(mocks.rpc).not.toHaveBeenCalled();
    },
  );
  it("submits only the validated activity to the caller-session RPC", async () => {
    const response = await POST(
      request({ type: "complete", book: "GEN", chapter: 1 }),
    );
    expect(response.status).toBe(200);
    expect(mocks.getUser).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith("complete_chapter", {
      p_book: "GEN",
      p_chapter: 1,
    });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
  });
  it("rejects oversized bodies without relying on Content-Length", async () => {
    expect(
      (
        await POST(
          request({
            type: "reflect",
            date: "2026-10-16",
            text: "x".repeat(22000),
          }),
        )
      ).status,
    ).toBe(413);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("sanitizes database errors and never falls back to a demo snapshot", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "secret database detail" },
    });
    const response = await GET(
      new NextRequest("https://faithquest.test/api/journey"),
    );
    expect(response.status).toBe(500);
    const payload = await response.json();
    expect(payload).not.toHaveProperty("state");
    expect(JSON.stringify(payload)).not.toContain("secret");
  });
});
describe("Google OAuth and session refresh", () => {
  it("uses a fixed callback and ignores caller-supplied redirect targets", async () => {
    mocks.signIn.mockResolvedValue({
      data: { url: "https://accounts.google.com/test" },
      error: null,
    });
    const response = await google(
      new NextRequest(
        "https://faithquest.test/auth/google?next=https://attacker.test",
        { method: "POST", headers: { origin: "https://faithquest.test" } },
      ),
    );
    expect(response.status).toBe(303);
    expect(mocks.signIn).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "https://faithquest.test/auth/callback",
        scopes: "openid email profile",
      },
    });
  });
  it("exchanges the authorization code then verifies the user before entering the app", async () => {
    mocks.exchange.mockResolvedValue({ error: null });
    const response = await callback(
      new NextRequest(
        "https://faithquest.test/auth/callback?code=valid-code&next=https://attacker.test",
      ),
    );
    expect(mocks.exchange).toHaveBeenCalledWith("valid-code");
    expect(mocks.getUser).toHaveBeenCalledOnce();
    expect(response.headers.get("location")).toBe(
      "https://faithquest.test/dashboard",
    );
  });
  it("does not enter the app after a rejected or missing code", async () => {
    mocks.exchange.mockResolvedValue({ error: new Error("bad code") });
    const response = await callback(
      new NextRequest("https://faithquest.test/auth/callback?code=bad"),
    );
    expect(response.headers.get("location")).toBe(
      "https://faithquest.test/login?error=signin",
    );
  });
  it("retains refreshed cookies when redirecting an unauthenticated page", async () => {
    mocks.claims.mockResolvedValue({
      data: null,
      error: new AuthInvalidJwtError("expired"),
    });
    mocks.cookies = [
      {
        name: "sb-refresh",
        value: "rotated-token",
        options: { httpOnly: true, path: "/" },
      },
    ];
    const response = await proxy(
      new NextRequest("https://faithquest.test/dashboard"),
    );
    expect(response.headers.get("location")).toBe(
      "https://faithquest.test/login",
    );
    expect(response.cookies.get("sb-refresh")?.value).toBe("rotated-token");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("keeps valid sessions on the protected route and passes refreshed cookies onward", async () => {
    mocks.cookies = [
      { name: "sb-refresh", value: "new-token", options: { path: "/" } },
    ];
    const response = await proxy(
      new NextRequest("https://faithquest.test/dashboard"),
    );
    expect(response.headers.get("location")).toBeNull();
    expect(response.cookies.get("sb-refresh")?.value).toBe("new-token");
  });
  it("checks sign-out origin and ends only the current device session", async () => {
    mocks.signOut.mockResolvedValue({ error: null });
    expect(
      (
        await signout(
          new NextRequest("https://faithquest.test/auth/signout", {
            method: "POST",
            headers: { origin: "https://attacker.test" },
          }),
        )
      ).status,
    ).toBe(403);
    const response = await signout(
      new NextRequest("https://faithquest.test/auth/signout", {
        method: "POST",
        headers: { origin: "https://faithquest.test" },
      }),
    );
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(response.headers.get("location")).toBe(
      "https://faithquest.test/login",
    );
  });
  it("fails closed without a login redirect or discarded cookies during an auth outage", async () => {
    mocks.claims.mockResolvedValue({
      data: null,
      error: new AuthRetryableFetchError("Network unavailable", 503),
    });
    mocks.cookies = [
      { name: "sb-refresh", value: "retained-token", options: { path: "/" } },
    ];
    const response = await proxy(
      new NextRequest("https://faithquest.test/dashboard"),
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("location")).toBeNull();
    expect(response.cookies.get("sb-refresh")?.value).toBe("retained-token");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.text()).not.toContain("Private Reader");
  });
  it("keeps a thrown proxy connection failure retryable", async () => {
    mocks.claims.mockRejectedValue(new TypeError("fetch failed"));
    const response = await proxy(
      new NextRequest("https://faithquest.test/journal"),
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("location")).toBeNull();
  });
});

describe("private account exports", () => {
  it("requires enabled accounts and a verified identity before reading an export", async () => {
    vi.stubEnv("FAITHQUEST_ACCOUNTS_ENABLED", "false");
    expect((await exportAccount()).status).toBe(503);
    expect(mocks.getUser).not.toHaveBeenCalled();
    vi.stubEnv("FAITHQUEST_ACCOUNTS_ENABLED", "true");
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const denied = await exportAccount();
    expect(denied.status).toBe(401);
    expect(denied.headers.get("content-disposition")).toBeNull();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("exports the latest caller-session snapshot without credentials or shared caching", async () => {
    const fresh = {
      ...snapshot,
      reflections: {
        "2026-10-16": {
          text: "A synthetic updated reflection from a different browser.",
          updatedAt: "2026-10-16T12:00:00.000Z",
        },
      },
    };
    mocks.rpc.mockResolvedValue({
      data: { ...fresh, access_token: "never-export-this" },
      error: null,
    });
    const response = await exportAccount();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(fresh);
    expect(mocks.getUser).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith("get_journey", undefined);
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="faithquest365-account-export.json"',
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });
  it("never labels an upstream failure as a successful download", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "private database details" },
    });
    const response = await exportAccount();
    expect(response.status).toBe(503);
    expect(response.headers.get("content-disposition")).toBeNull();
    expect(await response.json()).toEqual({
      error: "Your account export could not be prepared. Please retry.",
    });
  });
  it("returns a retryable export failure when identity verification is unavailable", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: new AuthRetryableFetchError("private network details", 503),
    });
    expect((await exportAccount()).status).toBe(503);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("active session enforcement", () => {
  it("denies unexpired but revoked sessions on reads, writes, exports and pages", async () => {
    mocks.session.mockResolvedValue({ data: false, error: null });
    expect(
      (await GET(new NextRequest("https://faithquest.test/api/journey")))
        .status,
    ).toBe(401);
    expect(
      (await POST(request({ type: "complete", book: "GEN", chapter: 1 })))
        .status,
    ).toBe(401);
    const exported = await exportAccount();
    expect(exported.status).toBe(401);
    expect(exported.headers.get("content-disposition")).toBeNull();
    expect(mocks.rpc).not.toHaveBeenCalled();
    const page = await proxy(
      new NextRequest("https://faithquest.test/profile"),
    );
    expect(page.headers.get("location")).toBe("https://faithquest.test/login");
  });
  it.each([
    { data: null, error: { message: "private session lookup error" } },
    { data: { unexpected: true }, error: null },
  ])(
    "treats unavailable or malformed session checks as retryable",
    async (result) => {
      mocks.session.mockResolvedValue(result);
      expect(
        (await GET(new NextRequest("https://faithquest.test/api/journey")))
          .status,
      ).toBe(503);
      expect((await exportAccount()).status).toBe(503);
      const page = await proxy(
        new NextRequest("https://faithquest.test/profile"),
      );
      expect(page.status).toBe(503);
      expect(page.headers.get("location")).toBeNull();
      expect(mocks.rpc).not.toHaveBeenCalled();
    },
  );
  it("handles a thrown session transport error without returning private data", async () => {
    mocks.session.mockRejectedValue(new TypeError("private transport detail"));
    const response = await exportAccount();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private transport detail");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

function globalRequest(
  body = "confirmation=sign-out-all",
  origin = "https://faithquest.test",
) {
  return new NextRequest("https://faithquest.test/auth/signout-all", {
    method: "POST",
    headers: { origin, "content-type": "application/x-www-form-urlencoded" },
    body,
  });
}
describe("sign out of all devices", () => {
  it("checks origin and explicit confirmation before authentication or sign-out", async () => {
    expect(
      (await signoutAll(globalRequest(undefined, "https://attacker.test")))
        .status,
    ).toBe(403);
    for (const body of [
      "",
      "confirmation=wrong",
      "confirmation=sign-out-all&userId=victim",
      "confirmation=sign-out-all&confirmation=sign-out-all",
    ])
      expect((await signoutAll(globalRequest(body))).status).toBe(400);
    expect((await signoutAll(globalRequest("x".repeat(1025)))).status).toBe(
      413,
    );
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
  it("requires a current session and leaves an unavailable service retryable", async () => {
    mocks.session.mockResolvedValue({ data: false, error: null });
    expect((await signoutAll(globalRequest())).status).toBe(401);
    mocks.session.mockResolvedValue({
      data: null,
      error: new Error("unavailable"),
    });
    expect((await signoutAll(globalRequest())).status).toBe(503);
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
  it("revokes only the caller's sessions with global scope and redirects without caching", async () => {
    mocks.signOut.mockResolvedValue({ error: null });
    const response = await signoutAll(globalRequest());
    expect(mocks.signOut).toHaveBeenCalledExactlyOnceWith({ scope: "global" });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://faithquest.test/login?signedOut=all",
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("never reports successful sign-out if Auth fails", async () => {
    mocks.signOut.mockResolvedValue({
      error: new Error("private Auth detail"),
    });
    const response = await signoutAll(globalRequest());
    expect(response.status).toBe(503);
    expect(response.headers.get("location")).toBeNull();
    expect(await response.text()).not.toContain("private Auth detail");
  });
});

function deleteRequest(
  body: unknown = { confirmation: "DELETE MY ACCOUNT" },
  origin = "https://faithquest.test",
) {
  return new NextRequest("https://faithquest.test/api/account/delete", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
describe("account deletion API boundary", () => {
  it("rejects wrong origins, oversized input and forged user IDs before authentication", async () => {
    expect(
      (await deleteAccountRoute(deleteRequest(undefined, "https://evil.test")))
        .status,
    ).toBe(403);
    for (const body of [
      {},
      { confirmation: "wrong" },
      { confirmation: "DELETE MY ACCOUNT", userId: "victim" },
    ])
      expect((await deleteAccountRoute(deleteRequest(body))).status).toBe(400);
    expect(
      (
        await deleteAccountRoute(
          deleteRequest({ confirmation: "a".repeat(1100) }),
        )
      ).status,
    ).toBe(413);
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it("requires enabled accounts and a current verified session", async () => {
    vi.stubEnv("FAITHQUEST_ACCOUNTS_ENABLED", "false");
    expect((await deleteAccountRoute(deleteRequest())).status).toBe(503);
    vi.stubEnv("FAITHQUEST_ACCOUNTS_ENABLED", "true");
    mocks.session.mockResolvedValue({ data: false, error: null });
    expect((await deleteAccountRoute(deleteRequest())).status).toBe(401);
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it("invokes the caller-scoped function and clears the local session only after success", async () => {
    mocks.signOut.mockResolvedValue({ error: null });
    const response = await deleteAccountRoute(deleteRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true });
    expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith("delete-account", {
      body: { confirmation: "DELETE MY ACCOUNT" },
    });
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("retains the session and reports reauthentication when the function requires it", async () => {
    mocks.invoke.mockResolvedValue({
      data: null,
      error: {
        context: Response.json({ error: "private detail" }, { status: 403 }),
      },
    });
    const response = await deleteAccountRoute(deleteRequest());
    expect(response.status).toBe(403);
    expect(await response.text()).toContain("within 10 minutes");
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
  it("sanitizes uncertain failures and never clears cookies or claims deletion", async () => {
    mocks.invoke.mockResolvedValue({
      data: null,
      error: {
        context: Response.json(
          { error: "private backend detail" },
          { status: 500 },
        ),
      },
    });
    const response = await deleteAccountRoute(deleteRequest());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private backend detail");
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
  it("rejects malformed function success and preserves a committed result if cleanup fails", async () => {
    mocks.invoke.mockResolvedValueOnce({
      data: { deleted: false },
      error: null,
    });
    expect((await deleteAccountRoute(deleteRequest())).status).toBe(503);
    mocks.signOut.mockRejectedValueOnce(new TypeError("cleanup outage"));
    expect((await deleteAccountRoute(deleteRequest())).status).toBe(200);
  });
});

describe("request budgets and account connection", () => {
  it("keeps database-limited saves retryable without a successful state response", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: {
        code: "PT429",
        details: JSON.stringify({ allowed: false, retryAfterSeconds: 42 }),
        message: "private details",
      },
    });
    const response = await POST(
      request({ type: "complete", book: "GEN", chapter: 1 }),
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("42");
    expect(response.headers.get("x-request-id")).toMatch(/^[a-f0-9-]{36}$/);
    expect(await response.json()).toEqual({
      error:
        "Please wait 42 seconds before trying again. Your saved progress is unchanged.",
    });
  });
  it("does not read a snapshot or download after export admission is denied", async () => {
    mocks.admission.mockResolvedValue({
      data: { allowed: false, retryAfterSeconds: 280 },
      error: null,
    });
    const response = await exportAccount();
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("280");
    expect(response.headers.get("content-disposition")).toBeNull();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("fails closed when admission is missing or malformed", async () => {
    mocks.admission.mockResolvedValue({ data: null, error: null });
    expect((await exportAccount()).status).toBe(503);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("relays deletion cooldown without sign-out or a false deletion result", async () => {
    mocks.invoke.mockResolvedValue({
      data: null,
      error: {
        context: Response.json(
          {},
          { status: 429, headers: { "Retry-After": "300" } },
        ),
      },
    });
    const response = await deleteAccountRoute(deleteRequest());
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("300");
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(await response.text()).not.toContain('"deleted":true');
  });
  it("verifies account connectivity without fetching a journey or returning identity", async () => {
    const response = await accountHealth();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(mocks.getUser).toHaveBeenCalledOnce();
    expect(mocks.admission).toHaveBeenCalledWith({ p_bucket: "health" });
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.session.mockResolvedValue({ data: false, error: null });
    expect((await accountHealth()).status).toBe(401);
  });
  it("does not spend a health allowance or expose a ready status during identity outages", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: new AuthRetryableFetchError("private auth detail", 503),
    });
    const response = await accountHealth();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private auth detail");
    expect(mocks.admission).not.toHaveBeenCalled();
  });
});
