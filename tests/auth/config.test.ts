import { afterEach, describe, it, expect, vi } from "vitest";
import {
  storageMode,
  accountsEnabled,
  supabaseSettings,
  appOrigin,
} from "../../src/lib/supabase/config";
afterEach(() => vi.unstubAllEnvs());
describe("account release configuration", () => {
  it("fails closed on a misspelled persistence mode", () => {
    vi.stubEnv("FAITHQUEST_STORAGE_MODE", "supabse");
    expect(() => storageMode()).toThrow();
  });
  it("does not open accounts by configuring the Supabase mode alone", () => {
    vi.stubEnv("FAITHQUEST_STORAGE_MODE", "supabase");
    vi.stubEnv("FAITHQUEST_ACCOUNTS_ENABLED", "");
    expect(accountsEnabled()).toBe(false);
  });
  it("rejects privileged keys in the public-key setting", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "sb_secret_do_not_expose",
    );
    expect(() => supabaseSettings()).toThrow();
    const privileged =
      "eyJhbGciOiJIUzI1NiJ9." +
      Buffer.from(JSON.stringify({ role: "service_role" })).toString(
        "base64url",
      ) +
      ".signature";
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", privileged);
    expect(() => supabaseSettings()).toThrow();
  });
  it("requires a canonical origin without embedded credentials or an arbitrary redirect path", () => {
    for (const origin of [
      "https://faithquest.test/elsewhere",
      "https://reader:password@faithquest.test",
      "ftp://localhost",
      "http://faithquest.test",
    ]) {
      vi.stubEnv("FAITHQUEST_APP_ORIGIN", origin);
      expect(() => appOrigin()).toThrow();
    }
    vi.stubEnv("FAITHQUEST_APP_ORIGIN", "http://127.0.0.1:3000");
    expect(appOrigin()).toBe("http://127.0.0.1:3000");
    vi.stubEnv("FAITHQUEST_APP_ORIGIN", "https://faithquest.test");
    expect(appOrigin()).toBe("https://faithquest.test");
  });
});
