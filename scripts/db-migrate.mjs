import postgres from "postgres";
import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const reference = process.env.SUPABASE_PROJECT_REF,
  connection = process.env.DATABASE_URL;
if (
  !reference ||
  !connection ||
  process.env.FAITHQUEST_DATABASE_IS_DEVELOPMENT !== "true"
)
  throw new Error(
    "Configure a verified development DATABASE_URL, SUPABASE_PROJECT_REF, and FAITHQUEST_DATABASE_IS_DEVELOPMENT=true in .env.local.",
  );
const url = new URL(connection);
if (
  !url.hostname.includes(reference) &&
  !decodeURIComponent(url.username).includes(reference)
)
  throw new Error(
    "Database connection does not match the selected Supabase project reference.",
  );
if (process.env.NEXT_PUBLIC_SUPABASE_URL !== `https://${reference}.supabase.co`)
  throw new Error("Application URL and migration project do not match.");
const sql = postgres(connection, {
  max: 1,
  ssl: "require",
  onnotice: () => {},
});
try {
  const files = (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(8365365)`;
    const history =
      await tx`select to_regclass('supabase_migrations.schema_migrations') as table_name`;
    const applied = history[0].table_name
      ? await tx`select version from supabase_migrations.schema_migrations`
      : [];
    const known = new Set(applied.map((m) => m.version));
    if (known.size === 0) {
      const present =
        await tx`select to_regclass('public.profiles') as table_name`;
      if (present[0].table_name)
        throw new Error(
          "Existing untracked tables found. Inspect the project migration history before continuing.",
        );
    }
    await tx`create schema if not exists supabase_migrations`;
    await tx`create table if not exists supabase_migrations.schema_migrations(version text primary key, statements text[], name text)`;
    const local = new Set(files.map((f) => f.split("_")[0]));
    if ([...known].some((v) => !local.has(v)))
      throw new Error(
        "Remote migration history includes versions absent from this checkout. Reconcile history before applying changes.",
      );
    for (const file of files) {
      const version = file.split("_")[0];
      if (known.has(version)) continue;
      let body = await readFile(`supabase/migrations/${file}`, "utf8");
      body = body.replace(/^begin;\s*$/gim, "").replace(/^commit;\s*$/gim, "");
      await tx.unsafe(body);
      await tx`insert into supabase_migrations.schema_migrations(version,statements,name) values(${version},${[body]},${file.slice(version.length + 1, -4)})`;
      console.log(`Applied ${file}`);
    }
  });
  console.log(
    "Development migrations applied atomically. No resets or table drops were performed.",
  );
} catch {
  console.error(
    "Migration failed; the transaction was rolled back. Inspect development database connectivity and migration history without printing credentials.",
  );
  process.exitCode = 1;
} finally {
  await sql.end();
}
