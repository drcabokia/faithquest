import { PGlite, type Transaction } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { stateSchema } from "../../src/lib/state";
import { QUESTIONS } from "../../src/data/quizzes";
import { BALANCED_PLAN, PLAN_IDS } from "../../src/services/reading-plan";
import { QUIZ_PROMPTS } from "../../src/data/quiz-prompts";
import { quizDay } from "../../src/services/plan-quizzes";
import verseIndex from "../../src/data/verse-index.json";
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
    await tx.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify(user ? { sub: user, session_id: user, role } : {}),
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
    `create role anon nologin nosuperuser;create role authenticated nologin nosuperuser;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade,not_after timestamptz);create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant execute on function auth.jwt() to anon,authenticated;grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`,
  );
  for (const file of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  await db.query("insert into auth.users(id) values($1),($2)", [A, B]);
  await db.query(
    "insert into auth.sessions(id,user_id) values($1,$1),($2,$2)",
    [A, B],
  );
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
  it("runs all shared privacy, reward, quota, plan, quiz and note drills together", async () => {
    const rollback = new Error("Expanded quiz fixture rollback");
    await expect(
      db.transaction(async (tx) => {
        for (const name of [
          "verify-live-db",
          "verify-request-limits",
          "verify-restore",
          "verify-saved-verses",
          "verify-journal",
          "verify-journal-conflicts",
          "verify-challenges",
          "verify-fellowship",
          "verify-reading-plans",
          "verify-quiz-expansion",
          "verify-verse-notes",
          "verify-prayers",
          "verify-grace-days",
        ]) {
          await tx.exec(readFileSync(`scripts/${name}.sql`, "utf8"));
        }
        throw rollback;
      }),
    ).rejects.toBe(rollback);
  }, 60000);
  it("keeps balanced assignments and passage quiz mapping identical in PostgreSQL and the browser", async () => {
    const { rows } = await db.query<{
      day: number;
      key: string;
      position: number;
    }>(
      "select d.day,d.book_id||'.'||d.chapter as key,d.position from public.reading_plan_day_chapters d join public.reading_plans p on p.id=d.plan_id where p.slug='balanced' order by d.day,d.position",
    );
    expect(rows).toEqual(
      BALANCED_PLAN.flatMap((m) =>
        m.chapters.map((c, i) => ({ day: m.day, key: c.key, position: i + 1 })),
      ),
    );
    for (const id of PLAN_IDS) {
      const { rows } = await db.query<{ id: string; day: number }>(
        "select q.id,m.day from public.quiz_questions q join public.bible_books b on q.scripture_reference like b.name||' %' join public.reading_plan_day_chapters m on m.book_id=b.id and q.scripture_reference like b.name||' '||m.chapter||':%' join public.reading_plans p on p.id=m.plan_id where p.slug||'-v'||p.schedule_version=$1 order by q.id",
        [id],
      );
      expect(rows).toEqual(
        QUIZ_PROMPTS.map((q) => ({ id: q.id, day: quizDay(q, id) })).sort(
          (a, b) => a.id.localeCompare(b.id),
        ),
      );
    }
  });
  it("enforces opt-in plan selection, versioned restores, rewards, quizzes and active sessions", async () => {
    const rollback = new Error("Reading plans fixture rollback");
    await expect(
      db.transaction(async (tx) => {
        await tx.exec(readFileSync("scripts/verify-reading-plans.sql", "utf8"));
        throw rollback;
      }),
    ).rejects.toBe(rollback);
  });

  it("enforces consent, caller-only groups, safe participation, owner controls and invitation recovery", async () => {
    const rollback = new Error("Fellowship fixture rollback");
    await expect(
      db.transaction(async (tx) => {
        await tx.exec(readFileSync("scripts/verify-fellowship.sql", "utf8"));
        throw rollback;
      }),
    ).rejects.toBe(rollback);
  });

  it("enforces private seven-day enrollment, calendar rewards, restore and session boundaries", async () => {
    const rollback = new Error("Challenge fixture rollback");
    await expect(
      db.transaction(async (tx) => {
        await tx.exec(readFileSync("scripts/verify-challenges.sql", "utf8"));
        throw rollback;
      }),
    ).rejects.toBe(rollback);
  });

  it("keeps journal categories private, backward compatible and atomic", async () => {
    const rollback = new Error("Journal fixture rollback");
    await expect(
      db.transaction(async (tx) => {
        await tx.exec(readFileSync("scripts/verify-journal.sql", "utf8"));
        throw rollback;
      }),
    ).rejects.toBe(rollback);
  });

  it("enforces private saved verses, safe restoration, quotas and account deletion", async () => {
    const rollback = new Error("Saved verses fixture rollback");
    await expect(
      db.transaction(async (tx) => {
        await tx.exec(readFileSync("scripts/verify-saved-verses.sql", "utf8"));
        throw rollback;
      }),
    ).rejects.toBe(rollback);
  });
  it("matches hosted verse numbering metadata to the bundled catalogue", async () => {
    const { rows } = await db.query<{
      key: string;
      verse_count: number;
      empty_verses: number[];
    }>(
      "select book_id||'.'||chapter as key,verse_count,empty_verses from public.bible_chapters",
    );
    expect(Object.fromEntries(rows.map((r) => [r.key, r.verse_count]))).toEqual(
      verseIndex.chapters,
    );
    expect(
      rows.flatMap((r) => r.empty_verses.map((v) => `${r.key}.${v}`)).sort(),
    ).toEqual([...verseIndex.empty].sort());
  });
  it("restores synthetic backups atomically, preserves conflicts and rejects abuse", async () => {
    const rollback = new Error("Restore fixture rollback");
    await expect(
      db.transaction(async (tx) => {
        await tx.exec(readFileSync("scripts/verify-restore.sql", "utf8"));
        throw rollback;
      }),
    ).rejects.toBe(rollback);
    expect(
      (await db.query("select count(*)::integer as count from auth.users"))
        .rows,
    ).toEqual([{ count: 2 }]);
  });
  it("keeps every hosted prompt and private solution aligned with the reviewed catalogue", async () => {
    const { rows } = await db.query(
      "select q.id,q.day,q.question,q.options,q.scripture_reference as reference,a.correct_option as correct,a.explanation from public.quiz_questions q join private.quiz_answers a on a.question_id=q.id where q.reviewed order by q.id",
    );
    expect(rows).toEqual(
      [...QUESTIONS].sort((a, b) => a.id.localeCompare(b.id)),
    );
  });
  it("enforces shared per-account quotas at RPC boundaries without losing saved data", async () => {
    const rollback = new Error("Rate fixture rollback");
    await expect(
      db.transaction(async (tx) => {
        await tx.exec(
          readFileSync("scripts/verify-request-limits.sql", "utf8"),
        );
        throw rollback;
      }),
    ).rejects.toBe(rollback);
    expect(
      (
        await db.query<{ count: number }>(
          "select count(*)::integer as count from auth.users",
        )
      ).rows[0].count,
    ).toBe(2);
  });
  it("runs the shared hosted verification and rolls back every fixture", async () => {
    const before = await db.query("select id from auth.users order by id");
    const rollback = new Error("Verified rollback");
    await expect(
      db.transaction(async (tx) => {
        await tx.exec(readFileSync("scripts/verify-live-db.sql", "utf8"));
        throw rollback;
      }),
    ).rejects.toBe(rollback);
    expect(await db.query("select id from auth.users order by id")).toEqual(
      before,
    );
    expect((await db.query("select id from public.groups")).rows).toEqual([]);
  });
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
    expect(prompts.rows).toHaveLength(QUESTIONS.length);
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
    await rpc(
      A,
      "public.save_journal_entry($1,$2,'reflection',(select revision::text from public.reflections where user_id=auth.uid() and reflection_date=$1))",
      [date, "My private reflection about gratitude and growing in faith."],
    );
    const s = stateSchema.parse(
      await rpc(
        A,
        "public.save_journal_entry($1,$2,'reflection',(select revision::text from public.reflections where user_id=auth.uid() and reflection_date=$1))",
        [
          date,
          "An edited private reflection about gratitude and growing in faith.",
        ],
      ),
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
      rpc(
        B,
        "public.save_journal_entry($1,$2,'reflection',(select revision::text from public.reflections where user_id=auth.uid() and reflection_date=$1))",
        [
          "2099-01-01",
          "A future reflection must not earn a reward before its day.",
        ],
      ),
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
