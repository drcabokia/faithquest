import postgres from "postgres";
import { randomUUID } from "node:crypto";
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
function assert(value, message) {
  if (!value) throw new Error(message);
}
try {
  await sql.begin(async (tx) => {
    const a = randomUUID(),
      b = randomUUID();
    await tx`insert into auth.users(id) values(${a}),(${b})`;
    async function user(id, action) {
      await tx.unsafe("set local role authenticated");
      await tx`select set_config('request.jwt.claim.sub',${id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: id, role: "authenticated" })},true)`;
      try {
        return await action();
      } finally {
        await tx.unsafe("reset role");
      }
    }
    await user(
      a,
      () =>
        tx`select public.ensure_journey('Isolation fixture A','Asia/Kuala_Lumpur')`,
    );
    await user(
      b,
      () => tx`select public.ensure_journey('Isolation fixture B','UTC')`,
    );
    await user(a, async () => {
      for (const chapter of [1, 2, 3])
        await tx`select public.complete_chapter('GEN',${chapter})`;
      const [{ state }] = await tx`select public.get_journey() as state`;
      assert(
        state.rewards["reading:1"]?.amount === 50,
        "Reading reward mismatch",
      );
      await tx`select public.complete_chapter('GEN',3)`;
      await tx`select public.save_reflection(${state.profile.startDate},'A synthetic private reflection used only for isolation testing.')`;
      await tx`select public.submit_quiz('gen-light',0)`;
      await tx`select public.save_reflection(${state.profile.startDate},'Edited synthetic reflection used only for isolation testing.')`;
      const [{ total }] =
        await tx`select sum(amount)::int as total from public.xp_transactions`;
      assert(total === 80, "Duplicate or missing activity rewards");
    });
    await user(b, async () => {
      const [{ state }] = await tx`select public.get_journey() as state`;
      assert(
        Object.keys(state.reflections).length === 0 &&
          Object.keys(state.rewards).length === 0,
        "Another user's state was visible",
      );
      const profiles = await tx`select id from public.profiles where id=${a}`;
      assert(profiles.length === 0, "Another user's profile was visible");
      for (const table of [
        "reflections",
        "xp_transactions",
        "user_chapter_progress",
        "user_reading_progress",
        "quiz_attempts",
        "user_achievements",
      ]) {
        const rows = await tx.unsafe(
          `select * from public.${table} where user_id=$1`,
          [a],
        );
        assert(rows.length === 0, "Personal-table isolation failed");
      }
      for (const statement of [
        "select * from private.quiz_answers",
        "update public.profiles set timezone='UTC'",
        "delete from public.reflections",
      ]) {
        await tx.unsafe("savepoint denied_operation");
        let denied = false;
        try {
          await tx.unsafe(statement);
        } catch {
          denied = true;
          await tx.unsafe("rollback to savepoint denied_operation");
        }
        await tx.unsafe("release savepoint denied_operation");
        assert(denied, "A protected direct operation was permitted");
      }
    });
    throw new VerifiedRollback();
  });
} catch (error) {
  if (error instanceof VerifiedRollback)
    console.log(
      "Live database isolation/reward checks passed. Both synthetic users and all fixture data were rolled back. Google OAuth/session renewal still require separate browser acceptance.",
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
