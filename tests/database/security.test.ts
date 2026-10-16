import { PGlite, type Transaction } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { stateSchema } from "../../src/lib/state";
let db: PGlite;
const A = "10000000-0000-4000-8000-000000000001",
  B = "10000000-0000-4000-8000-000000000002";
async function asUser<T>(
  user: string | null,
  action: (tx: Transaction) => Promise<T>,
  role = "authenticated",
) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${role}`);
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
      user ?? "",
    ]);
    return action(tx);
  });
}
async function rpc(user: string, expression: string, params: unknown[] = []) {
  return asUser(
    user,
    async (tx) =>
      (
        await tx.query<{ state: unknown }>(
          `select ${expression} as state`,
          params,
        )
      ).rows[0].state,
  );
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon nologin nosuperuser;create role authenticated nologin nosuperuser;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`,
  );
  for (const file of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  await db.query("insert into auth.users(id) values($1),($2)", [A, B]);
  await rpc(A, "public.ensure_journey($1,$2)", [
    "Reader A",
    "Asia/Kuala_Lumpur",
  ]);
  await rpc(B, "public.ensure_journey($1,$2)", ["Reader B", "UTC"]);
}, 60000);
afterAll(async () => {
  await db?.close();
});
describe("authenticated PostgreSQL commands and RLS", () => {
  it("applies all migrations and creates valid server snapshots", async () => {
    const state = stateSchema.parse(await rpc(A, "public.get_journey()"));
    expect(state.profile.name).toBe("Reader A");
    expect(state.days).toEqual({});
  });
  it("keeps profiles isolated and denies anonymous personal records", async () => {
    const rows = await asUser(A, (tx) =>
      tx.query("select id from public.profiles"),
    );
    expect(rows.rows).toEqual([{ id: A }]);
    await expect(
      asUser(
        null,
        (tx) => tx.query("select * from public.reflections"),
        "anon",
      ),
    ).rejects.toThrow();
    await expect(
      asUser(null, (tx) => tx.query("select public.get_journey()")),
    ).rejects.toThrow();
  });
  it("requires all assigned chapters and awards each mission only once", async () => {
    await rpc(A, "public.complete_chapter($1,$2)", ["GEN", 1]);
    await rpc(A, "public.complete_chapter($1,$2)", ["GEN", 2]);
    expect(
      ((await rpc(A, "public.get_journey()")) as { rewards: object }).rewards,
    ).toEqual({});
    const complete = stateSchema.parse(
      await rpc(A, "public.complete_chapter($1,$2)", ["GEN", 3]),
    );
    expect(complete.rewards["reading:1"].amount).toBe(50);
    expect(await rpc(A, "public.complete_chapter($1,$2)", ["GEN", 3])).toEqual(
      complete,
    );
  });
  it("awards a one-chapter book once without awarding an incomplete daily mission", async () => {
    const first = (await rpc(A, "public.complete_chapter($1,$2)", [
      "PHM",
      1,
    ])) as { rewards: Record<string, { amount: number }> };
    expect(first.rewards["book:PHM"].amount).toBe(150);
    expect(await rpc(A, "public.complete_chapter($1,$2)", ["PHM", 1])).toEqual(
      first,
    );
  });
  it("records quiz answers once and cannot turn a wrong attempt into a reward", async () => {
    await rpc(A, "public.submit_quiz($1,$2)", ["gen-light", 1]);
    const s = (await rpc(A, "public.submit_quiz($1,$2)", ["gen-light", 0])) as {
      attempts: Record<string, { correct: boolean }>;
      rewards: Record<string, unknown>;
    };
    expect(s.attempts["gen-light"].correct).toBe(false);
    expect(s.rewards["quiz:gen-light"]).toBeUndefined();
    const correct = (await rpc(A, "public.submit_quiz($1,$2)", [
      "gen-rest",
      2,
    ])) as { rewards: Record<string, { amount: number }> };
    expect(correct.rewards["quiz:gen-rest"].amount).toBe(10);
  });
  it("does not expose answer keys before submission or allow a guessed-user helper call", async () => {
    const prompts = await asUser(B, (tx) =>
      tx.query("select * from public.quiz_questions"),
    );
    expect(prompts.rows).toHaveLength(6);
    expect(prompts.rows[0]).not.toHaveProperty("correct_option");
    await expect(
      asUser(B, (tx) => tx.query("select * from private.quiz_answers")),
    ).rejects.toThrow();
    await expect(
      asUser(B, (tx) =>
        tx.query("select private.unlock_achievements($1)", [A]),
      ),
    ).rejects.toThrow();
  });
  it("stores reflections privately and awards edits only once", async () => {
    const date = (
      (await rpc(A, "public.get_journey()")) as {
        profile: { startDate: string };
      }
    ).profile.startDate;
    await rpc(A, "public.save_reflection($1,$2)", [
      date,
      "My private reflection about gratitude and growing in faith.",
    ]);
    const s = stateSchema.parse(
      await rpc(A, "public.save_reflection($1,$2)", [
        date,
        "An edited private reflection about gratitude and growing in faith.",
      ]),
    );
    expect(s.rewards[`reflection:${date}`].amount).toBe(20);
    const other = await asUser(B, (tx) =>
      tx.query("select * from public.reflections where user_id=$1", [A]),
    );
    expect(other.rows).toEqual([]);
    const fresh = stateSchema.parse(await rpc(B, "public.get_journey()"));
    expect(fresh.reflections).toEqual({});
    expect(fresh.rewards).toEqual({});
  });
  it("prevents clients writing activity, XP, achievements, and profiles directly", async () => {
    for (const query of [
      "update public.profiles set timezone='UTC'",
      "delete from public.reflections",
      "insert into public.xp_transactions(user_id,activity_key,activity_type,amount,activity_date) values ('" +
        A +
        "','fake','book',150,current_date)",
      "insert into public.user_achievements(user_id,achievement_id) values ('" +
        A +
        "','year')",
      "update public.quiz_attempts set is_correct=true",
    ])
      await expect(asUser(A, (tx) => tx.exec(query))).rejects.toThrow();
  });
  it("fixes timezone after activity and rejects invalid chapters/reflections", async () => {
    await expect(
      rpc(A, "public.update_journey_preferences($1,$2,$3,$4)", [
        "Reader A",
        "2026-01-01",
        "UTC",
        "light",
      ]),
    ).rejects.toThrow();
    await expect(
      rpc(B, "public.complete_chapter($1,$2)", ["GEN", 999]),
    ).rejects.toThrow();
    await expect(
      rpc(B, "public.save_reflection($1,$2)", [
        "2099-01-01",
        "A future reflection must not earn a reward before its day.",
      ]),
    ).rejects.toThrow();
  });
  it("returns server-earned achievement IDs only to their owner", async () => {
    const s = (await rpc(A, "public.get_journey()")) as {
      earnedAchievements: string[];
    };
    expect(s.earnedAchievements).toEqual(
      expect.arrayContaining(["first", "book", "quiz", "reflect"]),
    );
    const other = await asUser(B, (tx) =>
      tx.query("select * from public.user_achievements where user_id=$1", [A]),
    );
    expect(other.rows).toEqual([]);
  });
  it("keeps all personal tables scoped to their owner", async () => {
    for (const table of [
      "user_reading_progress",
      "user_chapter_progress",
      "xp_transactions",
      "quiz_attempts",
      "user_achievements",
    ]) {
      const rows = await asUser(B, (tx) =>
        tx.query(`select * from public.${table} where user_id=$1`, [A]),
      );
      expect(rows.rows).toEqual([]);
    }
    await expect(
      asUser(
        null,
        (tx) => tx.query("select public.ensure_journey('Intruder','UTC')"),
        "anon",
      ),
    ).rejects.toThrow();
  });
  it("keeps groups isolated without sharing journal records", async () => {
    await db.query(
      "insert into public.groups(id,owner_id,name) values($1,$2,'Group A'),($3,$4,'Group B')",
      [
        "20000000-0000-4000-8000-000000000001",
        A,
        "20000000-0000-4000-8000-000000000002",
        B,
      ],
    );
    const groups = await asUser(A, (tx) =>
      tx.query("select name from public.groups"),
    );
    expect(groups.rows).toEqual([{ name: "Group A" }]);
    await expect(
      asUser(B, (tx) =>
        tx.query(
          "insert into public.group_memberships(group_id,user_id,role) values($1,$2,'leader')",
          ["20000000-0000-4000-8000-000000000001", B],
        ),
      ),
    ).rejects.toThrow();
  });
});
