import "server-only";
import {
  accountsEnabled,
  storageMode,
  supabaseSettings,
} from "./supabase/config";

// Public dependency status only; never caches identity, cookies or journey data.
export function serviceHealthChecker(clock = () => Date.now()) {
  let cached: { until: number; ok: boolean } | null = null;
  let pending: Promise<boolean> | null = null;
  return async () => {
    try {
      if (storageMode() === "demo") return true;
      if (!accountsEnabled()) return false;
      if (cached && clock() < cached.until) return cached.ok;
      if (pending) return pending;
      const { url, key } = supabaseSettings();
      pending = (async () => {
        let ok = false;
        try {
          const responses = await Promise.all([
            fetch(`${url}/auth/v1/settings`, {
              headers: { apikey: key },
              cache: "no-store",
              signal: AbortSignal.timeout(4000),
            }),
            fetch(`${url}/rest/v1/bible_books?select=id&limit=1`, {
              method: "HEAD",
              headers: { apikey: key, Prefer: "count=exact" },
              cache: "no-store",
              signal: AbortSignal.timeout(4000),
            }),
          ]);
          const [auth, catalogue] = responses;
          const settings: unknown = auth.ok ? await auth.json() : null;
          ok =
            auth.ok &&
            catalogue.ok &&
            catalogue.headers.get("content-range")?.split("/")[1] === "66" &&
            !!settings &&
            typeof settings === "object" &&
            "external" in settings &&
            !!settings.external &&
            typeof settings.external === "object" &&
            "google" in settings.external &&
            settings.external.google === true;
        } catch {
          ok = false;
        }
        cached = { ok, until: clock() + (ok ? 15000 : 5000) };
        return ok;
      })();
      try {
        return await pending;
      } finally {
        pending = null;
      }
    } catch {
      return false;
    }
  };
}
export const serviceHealthy = serviceHealthChecker();
