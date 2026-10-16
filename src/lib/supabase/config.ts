export type StorageMode = "demo" | "supabase";
export function storageMode(): StorageMode {
  const mode = process.env.FAITHQUEST_STORAGE_MODE;
  if (!mode || mode === "demo") return "demo";
  if (mode === "supabase") return "supabase";
  throw new Error("FAITHQUEST_STORAGE_MODE must be demo or supabase.");
}
export function accountsEnabled() {
  return (
    storageMode() === "supabase" &&
    process.env.FAITHQUEST_ACCOUNTS_ENABLED === "true"
  );
}
export function supabaseSettings() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase project settings are missing.");
  if (key.startsWith("sb_secret_"))
    throw new Error("Use a Supabase publishable key, not a secret key.");
  if (key.startsWith("eyJ")) {
    try {
      const payload = JSON.parse(
        Buffer.from(key.split(".")[1], "base64url").toString("utf8"),
      );
      if (payload.role !== "anon") throw new Error("Invalid key role");
    } catch {
      throw new Error("Use an anon/publishable key, never a privileged key.");
    }
  }
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" &&
    !(
      parsed.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(parsed.hostname)
    )
  )
    throw new Error("Invalid Supabase URL.");
  return { url, key };
}
export function appOrigin() {
  const url = new URL(
    process.env.FAITHQUEST_APP_ORIGIN ?? "http://127.0.0.1:3000",
  );
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      ))
  )
    throw new Error("Configure a canonical app origin.");
  return url.origin;
}
