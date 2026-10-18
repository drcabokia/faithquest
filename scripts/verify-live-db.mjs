import postgres from "postgres";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const connection = process.env.DATABASE_URL,
  ref = process.env.SUPABASE_PROJECT_REF;
if (
  !connection ||
  !ref ||
  process.env.FAITHQUEST_DATABASE_IS_DEVELOPMENT !== "true"
)
  throw new Error(
    "Configure a verified development database before running live isolation checks.",
  );
const target = new URL(connection);
if (
  (!target.hostname.includes(ref) &&
    !decodeURIComponent(target.username).includes(ref)) ||
  process.env.NEXT_PUBLIC_SUPABASE_URL !== `https://${ref}.supabase.co`
)
  throw new Error("Database and application project references do not match.");
const sql = postgres(connection, {
  max: 1,
  ssl: "require",
  onnotice: () => {},
});
class VerifiedRollback extends Error {}
try {
  await sql.begin(async (tx) => {
    await tx.unsafe(
      await readFile(new URL("./verify-live-db.sql", import.meta.url), "utf8"),
    );
    await tx.unsafe(
      await readFile(
        new URL("./verify-request-limits.sql", import.meta.url),
        "utf8",
      ),
    );
    await tx.unsafe(
      await readFile(new URL("./verify-restore.sql", import.meta.url), "utf8"),
    );
    await tx.unsafe(
      await readFile(
        new URL("./verify-saved-verses.sql", import.meta.url),
        "utf8",
      ),
    );
    await tx.unsafe(
      await readFile(new URL("./verify-journal.sql", import.meta.url), "utf8"),
    );
    await tx.unsafe(
      await readFile(
        new URL("./verify-challenges.sql", import.meta.url),
        "utf8",
      ),
    );
    await tx.unsafe(
      await readFile(
        new URL("./verify-fellowship.sql", import.meta.url),
        "utf8",
      ),
    );
    await tx.unsafe(
      await readFile(
        new URL("./verify-reading-plans.sql", import.meta.url),
        "utf8",
      ),
    );
    await tx.unsafe(
      await readFile(
        new URL("./verify-quiz-expansion.sql", import.meta.url),
        "utf8",
      ),
    );
    await tx.unsafe(
      await readFile(
        new URL("./verify-verse-notes.sql", import.meta.url),
        "utf8",
      ),
    );
    await tx.unsafe(
      await readFile(new URL("./verify-prayers.sql", import.meta.url), "utf8"),
    );
    await tx.unsafe(
      await readFile(
        new URL("./verify-grace-days.sql", import.meta.url),
        "utf8",
      ),
    );
    throw new VerifiedRollback();
  });
} catch (error) {
  if (error instanceof VerifiedRollback)
    console.log(
      "Live database isolation/reward checks passed. All synthetic users and fixture data were rolled back. Google OAuth/session renewal still require separate browser acceptance.",
    );
  else {
    console.error(
      "Live verification failed; fixture changes were rolled back. Inspect database configuration and policies without printing credentials.",
    );
    process.exitCode = 1;
  }
} finally {
  await sql.end();
}
