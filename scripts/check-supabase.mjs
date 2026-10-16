import { existsSync } from "node:fs";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error(
    "Project URL and publishable key are required in .env.local. Do not use a secret/service-role key.",
  );
  process.exit(1);
}
if (key.startsWith("sb_secret_"))
  throw new Error("Use a publishable key, not a secret key.");
try {
  const settings = await fetch(`${url}/auth/v1/settings`, {
    headers: { apikey: key },
    signal: AbortSignal.timeout(10000),
  });
  if (!settings.ok) throw new Error();
  const auth = await settings.json();
  const books = await fetch(`${url}/rest/v1/bible_books?select=id`, {
    headers: { apikey: key },
    signal: AbortSignal.timeout(10000),
  });
  const metadata = books.ok ? await books.json() : null;
  console.log(
    JSON.stringify(
      {
        reachable: true,
        googleEnabled: auth.external?.google === true,
        referenceBooks: Array.isArray(metadata) ? metadata.length : null,
        accountsEnabled: process.env.FAITHQUEST_ACCOUNTS_ENABLED === "true",
      },
      null,
      2,
    ),
  );
} catch {
  console.error(
    "Could not verify the selected Supabase project. Check the URL, public key, connectivity, and migrations.",
  );
  process.exitCode = 1;
}
