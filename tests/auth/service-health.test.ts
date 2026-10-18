import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { serviceHealthChecker } from "../../src/lib/service-health";
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubEnv("FAITHQUEST_STORAGE_MODE", "supabase");
  vi.stubEnv("FAITHQUEST_ACCOUNTS_ENABLED", "true");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://fixture.supabase.co");
  vi.stubEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "sb_publishable_fixture_only",
  );
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
function healthy() {
  fetchMock.mockImplementation(async (url: string) =>
    url.includes("/auth/")
      ? Response.json({
          external: { google: true },
          neverExport: "private upstream data",
        })
      : new Response(null, { headers: { "content-range": "0-0/66" } }),
  );
}
describe("bounded public service readiness", () => {
  it("probes only public auth/catalogue readiness, caches a boolean and coalesces requests", async () => {
    healthy();
    let time = 0;
    const check = serviceHealthChecker(() => time);
    expect(await Promise.all([check(), check(), check()])).toEqual([
      true,
      true,
      true,
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await check()).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, options] = fetchMock.mock.calls[1];
    expect(url).toBe(
      "https://fixture.supabase.co/rest/v1/bible_books?select=id&limit=1",
    );
    expect(options.method).toBe("HEAD");
    expect(options.headers).not.toHaveProperty("Authorization");
    expect(options.headers).not.toHaveProperty("Cookie");
    expect(options.signal).toBeInstanceOf(AbortSignal);
    time = 15001;
    expect(await check()).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
  it("fails closed on outages, briefly caches failures and recovers", async () => {
    fetchMock.mockRejectedValue(new Error("private connection detail"));
    let time = 0;
    const check = serviceHealthChecker(() => time);
    expect(await check()).toBe(false);
    healthy();
    expect(await check()).toBe(false);
    time = 5001;
    expect(await check()).toBe(true);
  });
  it("requires enabled Google and the complete reference catalogue", async () => {
    fetchMock.mockResolvedValue(Response.json({ external: { google: false } }));
    expect(await serviceHealthChecker()()).toBe(false);
    fetchMock.mockImplementation(async (url: string) =>
      url.includes("/auth/")
        ? Response.json({ external: { google: true } })
        : new Response(null, { headers: { "content-range": "*/0" } }),
    );
    expect(await serviceHealthChecker()()).toBe(false);
  });
  it("treats demo as ready without external calls and missing account configuration as unavailable", async () => {
    vi.stubEnv("FAITHQUEST_STORAGE_MODE", "demo");
    expect(await serviceHealthChecker()()).toBe(true);
    vi.stubEnv("FAITHQUEST_STORAGE_MODE", "supabase");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    expect(await serviceHealthChecker()()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
