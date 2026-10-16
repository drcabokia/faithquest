import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
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
    rpc: mocks.rpc,
  }),
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: unknown,
    _key: unknown,
    options: { cookies: { setAll: (items: typeof mocks.cookies) => void } },
  ) => ({
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
import { POST as signout } from "../../src/app/auth/signout/route";
import { proxy } from "../../src/proxy";
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
  mocks.claims.mockResolvedValue({
    data: { claims: { sub: "user-a" } },
    error: null,
  });
  mocks.cookies = [];
});
afterEach(() => vi.unstubAllEnvs());
describe("authenticated request boundary", () => {
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
      error: new Error("revoked"),
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
    mocks.claims.mockResolvedValue({ data: null, error: new Error("expired") });
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
});
