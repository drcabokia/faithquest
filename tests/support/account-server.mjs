// Local-only Supabase protocol fixture. Never uses real accounts or credentials.
import { createServer } from "node:http";
import { createHmac, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  symlinkSync,
} from "node:fs";
import { join, resolve } from "node:path";

// Next.js generates TypeScript/config files in its app directory. Give the test
// its own source copy so it cannot alter the running user's files or build.
const workspace = process.cwd();
mkdirSync(join(workspace, ".cache"), { recursive: true });
const fixtureApp = mkdtempSync(join(workspace, ".cache", "account-e2e-app-"));
cpSync(join(workspace, "src"), join(fixtureApp, "src"), { recursive: true });
cpSync(join(workspace, "public"), join(fixtureApp, "public"), {
  recursive: true,
});
mkdirSync(join(fixtureApp, "supabase", "functions"), { recursive: true });
cpSync(
  join(workspace, "supabase", "functions", "_shared"),
  join(fixtureApp, "supabase", "functions", "_shared"),
  { recursive: true },
);
for (const name of [
  "package.json",
  "tsconfig.json",
  "next.config.ts",
  "postcss.config.mjs",
  "next-env.d.ts",
])
  if (existsSync(join(workspace, name)))
    cpSync(join(workspace, name), join(fixtureApp, name));
symlinkSync(
  join(workspace, "node_modules"),
  join(fixtureApp, "node_modules"),
  "junction",
);

const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const fixtureUser = {
  id: "30000000-0000-4000-8000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "fixture@example.test",
  app_metadata: { provider: "google", providers: ["google"] },
  user_metadata: { full_name: "Fixture Reader" },
  identities: [],
  created_at: new Date().toISOString(),
};
function sessionCookie() {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub: fixtureUser.id,
      session_id: "40000000-0000-4000-8000-000000000001",
      aud: "authenticated",
      role: "authenticated",
      exp: now + 3600,
      iat: now,
    }),
  ).toString("base64url");
  const unsigned = `${header}.${payload}`;
  const signature = createHmac("sha256", "local-test-only-not-a-project-secret")
    .update(unsigned)
    .digest("base64url");
  return (
    "base64-" +
    Buffer.from(
      JSON.stringify({
        access_token: `${unsigned}.${signature}`,
        refresh_token: "local-fixture-refresh",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: now + 3600,
        user: fixtureUser,
      }),
    ).toString("base64url")
  );
}
function initialSnapshot() {
  return {
    version: 1,
    profile: {
      name: "Fixture Reader",
      startDate: today(),
      timeZone: "Asia/Kuala_Lumpur",
      theme: "light",
    },
    chapters: {},
    days: {},
    rewards: {},
    attempts: {},
    reflections: {},
    savedVerses: {},
    verseNotes: {},
    prayers: {},
    graceDates: [],
    challengeStarts: [],
    fellowshipMemberships: [],
    earnedAchievements: [],
  };
}
function plusDays(day, count) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + count);
  return d.toISOString().slice(0, 10);
}
function awardFixtureChallenges() {
  const dates = new Set(Object.values(state.days));
  for (const start of state.challengeStarts)
    if (
      Array.from({ length: 7 }, (_, i) => plusDays(start, i)).every(
        (d) => d <= today() && dates.has(d),
      )
    )
      state.rewards[`challenge:${start}`] ??= {
        amount: 100,
        date: plusDays(start, 6),
      };
}
// Only the selected browser-fixture questions are simulated here. Real SQL tests
// execute all catalogue submissions and restores against private solutions.
const fixtureQuizSolutions = {
  "gen-joseph-revealed": {
    correct: 0,
    explanation:
      "Joseph identified himself as their brother, whom they had sold into Egypt.",
  },
  "lev-altar-fire": {
    correct: 2,
    explanation:
      "Fire was to be kept burning on the altar and was not to go out.",
  },
  "lev-thanksgiving-day": {
    correct: 3,
    explanation:
      "The meat was to be eaten on the day of the offering, with none left until morning.",
  },
};
function recordFixtureQuiz(id, answer, date = today()) {
  const q = fixtureQuizSolutions[id];
  if (!q) return;
  state.attempts[id] ??= {
    answer,
    correct: answer === q.correct,
    correctOption: q.correct,
    explanation: q.explanation,
    date,
  };
  if (state.attempts[id].correct)
    state.rewards[`quiz:${id}`] ??= {
      amount: 10,
      date: state.attempts[id].date,
    };
}
let fellowshipState = { groups: [] };
let fellowshipUnavailable = false;
let fellowshipCalls = 0;
const groupCreationRequests = new Map();
function updateMembershipExport() {
  state.fellowshipMemberships = fellowshipState.groups.map((g) => ({
    groupId: g.id,
    name: g.name,
    role: g.owner ? "owner" : "member",
    joinedAt:
      state.fellowshipMemberships.find((m) => m.groupId === g.id)?.joinedAt ??
      new Date().toISOString(),
  }));
}
let state = initialSnapshot();
let limits = {};
let failRpc = 0;
let rpcUnavailable = false;
let authUnavailable = false;
let rpcCalls = 0;
let restoreCalls = 0;
let sessionRevoked = false;
let lastSignoutScope = null;
let accountDeleted = false;
let deletionCalls = 0;
let deletionFailure = false;
let deletionNeedsReauth = false;
const server = createServer(async (request, response) => {
  const send = (status, body) => {
    response.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    response.end(JSON.stringify(body));
  };
  try {
    const path = new URL(request.url, "http://127.0.0.1:43191").pathname;
    let raw = "";
    for await (const chunk of request) {
      raw += chunk;
      if (raw.length > 20000)
        return send(413, { error: "Fixture body too large" });
    }
    const body = raw ? JSON.parse(raw) : {};
    if (path === "/__control" && request.method === "POST") {
      if (body.reset) {
        state = initialSnapshot();
        fellowshipState = { groups: [] };
        fellowshipUnavailable = false;
        fellowshipCalls = 0;
        groupCreationRequests.clear();
        limits = {};
        failRpc = 0;
        rpcUnavailable = false;
        authUnavailable = false;
        rpcCalls = 0;
        restoreCalls = 0;
        sessionRevoked = false;
        lastSignoutScope = null;
        accountDeleted = false;
        deletionCalls = 0;
        deletionFailure = false;
        deletionNeedsReauth = false;
      }
      if (body.limits && typeof body.limits === "object") limits = body.limits;
      if (typeof body.failRpc === "number") failRpc = body.failRpc;
      if (typeof body.rpcUnavailable === "boolean")
        rpcUnavailable = body.rpcUnavailable;
      if (typeof body.authUnavailable === "boolean")
        authUnavailable = body.authUnavailable;
      if (typeof body.sessionRevoked === "boolean")
        sessionRevoked = body.sessionRevoked;
      if (typeof body.deletionFailure === "boolean")
        deletionFailure = body.deletionFailure;
      if (typeof body.deletionNeedsReauth === "boolean")
        deletionNeedsReauth = body.deletionNeedsReauth;
      if (typeof body.fellowshipUnavailable === "boolean")
        fellowshipUnavailable = body.fellowshipUnavailable;
      if (body.fellowshipState) {
        fellowshipState = body.fellowshipState;
        updateMembershipExport();
      }
      if (typeof body.startDate === "string")
        state.profile.startDate = body.startDate;
      if (typeof body.name === "string") state.profile.name = body.name;
      if (Array.isArray(body.challengeStarts))
        state.challengeStarts = body.challengeStarts;
      if (body.days && typeof body.days === "object") state.days = body.days;
      if (body.rewards && typeof body.rewards === "object")
        state.rewards = body.rewards;
      if (Array.isArray(body.graceDates)) state.graceDates = body.graceDates;
      if (body.chapters && typeof body.chapters === "object")
        state.chapters = body.chapters;
      if (body.prayers && typeof body.prayers === "object")
        state.prayers = body.prayers;
      if (body.verseNotes && typeof body.verseNotes === "object")
        state.verseNotes = body.verseNotes;
      if (body.savedVerses && typeof body.savedVerses === "object")
        state.savedVerses = body.savedVerses;
      if (body.reflections && typeof body.reflections === "object")
        state.reflections = body.reflections;
      return send(200, {
        cookie: sessionCookie(),
        state,
        rpcCalls,
        fellowshipCalls,
        fellowshipState,
        restoreCalls,
        lastSignoutScope,
        deletionCalls,
        accountDeleted,
      });
    }
    if (path === "/functions/v1/delete-account") {
      deletionCalls++;
      if (limits.delete) {
        response.setHeader("Retry-After", String(limits.delete));
        return send(429, { error: "Synthetic deletion limit" });
      }
      if (deletionNeedsReauth)
        return send(403, { error: "Recent authentication required" });
      if (deletionFailure)
        return send(503, { error: "Synthetic deletion outage" });
      if (body.confirmation !== "DELETE MY ACCOUNT")
        return send(400, { error: "Confirmation required" });
      accountDeleted = true;
      sessionRevoked = true;
      state = initialSnapshot();
      return send(200, { deleted: true });
    }
    if (path === "/auth/v1/user") {
      if (accountDeleted)
        return send(401, {
          code: "user_not_found",
          msg: "Fixture account removed",
        });
      if (authUnavailable)
        return send(503, {
          code: "unexpected_failure",
          msg: "Fixture identity outage",
        });
      return send(200, fixtureUser);
    }
    if (path === "/auth/v1/logout") {
      lastSignoutScope = new URL(
        request.url,
        "http://127.0.0.1:43191",
      ).searchParams.get("scope");
      sessionRevoked = true;
      response.writeHead(204);
      return response.end();
    }
    if (path === "/rest/v1/rpc/consume_account_request") {
      const seconds = limits[body.p_bucket] ?? 0;
      return send(200, { allowed: seconds === 0, retryAfterSeconds: seconds });
    }
    if (path === "/auth/v1/settings")
      return send(200, { external: { google: true } });
    if (path === "/rest/v1/bible_books") {
      response.setHeader("content-range", "0-0/66");
      return send(200, []);
    }
    if (path === "/rest/v1/rpc/account_session_active")
      return send(200, !sessionRevoked);
    if (path.startsWith("/rest/v1/rpc/")) {
      rpcCalls++;
      const seconds =
        limits[
          path.endsWith("/restore_journey")
            ? "restore"
            : path.endsWith("/get_journey") || path.endsWith("/get_fellowship")
              ? "read"
              : "write"
        ];
      if (seconds)
        return send(429, {
          code: "PT429",
          details: JSON.stringify({
            allowed: false,
            retryAfterSeconds: seconds,
          }),
          message: "Synthetic activity limit",
        });
      if (rpcUnavailable || failRpc > 0) {
        if (failRpc > 0) failRpc--;
        return send(503, {
          code: "fixture_unavailable",
          message: "Fixture unavailable",
        });
      }
      if (
        path.endsWith("/get_fellowship") ||
        path.endsWith("/manage_fellowship")
      ) {
        fellowshipCalls++;
        if (fellowshipUnavailable)
          return send(503, { message: "Synthetic groups unavailable" });
        if (path.endsWith("/get_fellowship")) return send(200, fellowshipState);
        const command = body.p_command;
        if (command.type === "create") {
          if (!groupCreationRequests.has(command.requestId)) {
            const group = {
              id: randomUUID(),
              name: command.name,
              owner: true,
              inviteCode: randomUUID().replaceAll("-", ""),
              creationRequestId: command.requestId,
              members: [
                {
                  name: state.profile.name,
                  isYou: true,
                  participationPercent: 0,
                  memberId: fixtureUser.id,
                },
              ],
            };
            fellowshipState.groups.push(group);
            groupCreationRequests.set(command.requestId, group.id);
          }
        } else if (command.type === "join") {
          if (command.code !== "a".repeat(32))
            return send(200, { error: "invite" });
          if (!fellowshipState.groups.some((g) => !g.owner))
            fellowshipState.groups.push({
              id: "50000000-0000-4000-8000-000000000001",
              name: "Invited fixture group",
              owner: false,
              members: [
                {
                  name: "Fixture friend",
                  isYou: false,
                  participationPercent: 10,
                },
                {
                  name: state.profile.name,
                  isYou: true,
                  participationPercent: 0,
                },
              ],
            });
        } else {
          const group = fellowshipState.groups.find(
            (g) => g.id === command.groupId,
          );
          if (group && command.type !== "leave" && !group.owner)
            return send(200, { error: "access" });
          if (group && command.type === "rename") group.name = command.name;
          if (group && command.type === "rotate")
            group.inviteCode = randomUUID().replaceAll("-", "");
          if (group && command.type === "remove") {
            group.members = group.members.filter(
              (m) => m.memberId !== command.memberId,
            );
            group.inviteCode = randomUUID().replaceAll("-", "");
          }
          if (group && (command.type === "close" || command.type === "leave"))
            fellowshipState.groups = fellowshipState.groups.filter(
              (g) => g.id !== group.id,
            );
        }
        updateMembershipExport();
        return send(200, fellowshipState);
      }
      if (path.endsWith("/save_journal_entry")) {
        const current = state.reflections[body.p_date];
        const same =
          current?.text === body.p_content.trim() &&
          (current.category ?? "reflection") === body.p_category;
        if (
          !same &&
          (current?.revision ?? current?.updatedAt ?? null) !==
            body.p_expected_revision
        )
          return send(200, { error: "journal_conflict" });
        if (!same) {
          state.reflections[body.p_date] = {
            text: body.p_content.trim(),
            category: body.p_category,
            revision: randomUUID(),
            updatedAt: new Date().toISOString(),
          };
          state.rewards[`reflection:${body.p_date}`] ??= {
            amount: 20,
            date: today(),
          };
        }
      }
      // Minimal synthetic protocol responses for browser workflow checks.
      // The shared SQL fixture tests the actual reconstruction/security rules.
      if (path.endsWith("/select_reading_plan")) {
        if (!["canonical-v1", "balanced-v1"].includes(body.p_plan))
          return send(400, {
            code: "22023",
            message: "Unavailable fixture plan",
          });
        if (
          (body.p_plan !== (state.readingPlan ?? "canonical-v1") &&
            [
              state.chapters,
              state.days,
              state.attempts,
              state.rewards,
              state.reflections,
            ].some((v) => Object.keys(v).length)) ||
          (body.p_plan !== (state.readingPlan ?? "canonical-v1") &&
            state.challengeStarts.length)
        )
          return send(200, { error: "plan_locked" });
        state.readingPlan = body.p_plan;
      }
      if (path.endsWith("/restore_journey")) {
        restoreCalls++;
        if (
          (body.p_backup.readingPlan ?? "canonical-v1") !==
          (state.readingPlan ?? "canonical-v1")
        )
          return send(400, { code: "22023", message: "Fixture plan mismatch" });
        const merged = [
          ...new Set([
            ...state.challengeStarts,
            ...(body.p_backup.challengeStarts ?? []),
          ]),
        ].sort();
        if (
          merged.some((date, i) => i > 0 && date < plusDays(merged[i - 1], 7))
        )
          return send(400, { message: "Overlapping fixture challenges" });
        state.challengeStarts = merged;
        const mergedGrace = [
          ...new Set([
            ...state.graceDates,
            ...(body.p_backup.graceDates ?? []),
          ]),
        ].sort();
        if (
          mergedGrace.some(
            (d, i) => i > 0 && d < plusDays(mergedGrace[i - 1], 30),
          )
        )
          return send(400, { code: "22023", message: "Fixture grace overlap" });
        for (const d of body.p_backup.graceDates ?? [])
          if (!Object.values(state.days).includes(plusDays(d, -1)))
            return send(400, {
              code: "22023",
              message: "Missing fixture preceding mission",
            });
        state.graceDates = mergedGrace;
        for (const [day, r] of Object.entries(body.p_backup.reflections)) {
          state.reflections[day] ??= {
            revision: randomUUID(),
            ...r,
            updatedAt: new Date().toISOString(),
          };
          state.rewards[`reflection:${day}`] ??= { amount: 20, date: day };
        }
        for (const [id, attempt] of Object.entries(body.p_backup.attempts))
          recordFixtureQuiz(id, attempt.answer, attempt.date);
        for (const key of body.p_backup.savedVerses ?? [])
          state.savedVerses[key] ??= new Date().toISOString();
      }
      if (path.endsWith("/restore_journey")) {
        for (const [key, text] of Object.entries(
          body.p_backup.verseNotes ?? {},
        ))
          state.verseNotes[key] ??= {
            text,
            updatedAt: new Date().toISOString(),
          };
        for (const [id, p] of Object.entries(body.p_backup.prayers ?? {}))
          state.prayers[id] ??= {
            ...p,
            revision: randomUUID(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        awardFixtureChallenges();
      }
      if (path.endsWith("/claim_grace_day")) {
        const d = body.p_date;
        if (!state.graceDates.includes(d)) {
          if (d !== plusDays(today(), -1))
            return send(200, { error: "grace_invalid_day" });
          if (Object.values(state.days).includes(d))
            return send(200, { error: "grace_reading_exists" });
          if (!Object.values(state.days).includes(plusDays(d, -1)))
            return send(200, { error: "grace_no_prior_reading" });
          if (
            state.graceDates.some(
              (g) => Math.abs(Date.parse(g) - Date.parse(d)) < 30 * 86400000,
            )
          )
            return send(200, { error: "grace_cooldown" });
          state.graceDates.push(d);
          state.graceDates.sort();
        }
      }
      if (path.endsWith("/join_reading_challenge")) {
        if (
          !state.challengeStarts.some(
            (start) => start <= today() && plusDays(start, 6) >= today(),
          )
        )
          state.challengeStarts.push(today());
      }
      if (path.endsWith("/complete_chapter")) {
        state.chapters[`${body.p_book}.${body.p_chapter}`] ??= today();
        if (
          (state.readingPlan === "balanced-v1"
            ? ["GEN.1", "GEN.2", "MAT.1", "PSA.1"]
            : ["GEN.1", "GEN.2", "GEN.3"]
          ).every((key) => state.chapters[key])
        ) {
          state.days[1] ??= today();
          state.rewards[
            state.readingPlan === "balanced-v1"
              ? "reading:balanced-v1:1"
              : "reading:1"
          ] ??= { amount: 50, date: today() };
        }
        awardFixtureChallenges();
      }
      if (path.endsWith("/set_saved_verse")) {
        const key = `${body.p_book}.${body.p_chapter}.${body.p_verse}`;
        if (body.p_saved) state.savedVerses[key] ??= new Date().toISOString();
        else {
          if (state.verseNotes[key])
            return send(200, { error: "verse_has_note" });
          delete state.savedVerses[key];
        }
      }
      if (path.endsWith("/set_verse_note")) {
        const key = `${body.p_book}.${body.p_chapter}.${body.p_verse}`;
        if (!Object.hasOwn(state.savedVerses, key))
          return send(200, { error: "verse_not_saved" });
        const current = state.verseNotes[key]?.text ?? null;
        const desired = body.p_text === null ? null : body.p_text.trim();
        if (current !== desired) {
          if (current !== body.p_expected_text)
            return send(200, { error: "note_conflict" });
          if (desired === null) delete state.verseNotes[key];
          else
            state.verseNotes[key] = {
              text: desired,
              updatedAt: new Date().toISOString(),
            };
        }
      }
      if (path.endsWith("/mutate_prayer")) {
        const id = body.p_id,
          action = body.p_action,
          v = body.p_value,
          current = state.prayers[id];
        const same =
          action === "save" &&
          current &&
          current.title === v.title.trim() &&
          current.text === v.text.trim() &&
          current.status === v.status;
        const repeated =
          action === "followUp" &&
          current?.followUps[v.id]?.text === v.text.trim() &&
          current.followUps[v.id].date === v.date;
        if (!same && !repeated && !(action === "delete" && !current)) {
          if (
            !current &&
            (action !== "save" || body.p_expected_revision !== null)
          )
            return send(200, { error: "prayer_missing" });
          if ((current?.revision ?? null) !== body.p_expected_revision)
            return send(200, { error: "prayer_conflict" });
          if (action === "delete") delete state.prayers[id];
          else if (action === "save") {
            if (!current && Object.keys(state.prayers).length >= 200)
              return send(200, { error: "prayer_limit" });
            state.prayers[id] = {
              title: v.title.trim(),
              text: v.text.trim(),
              status: v.status,
              followUps: current?.followUps ?? {},
              revision: randomUUID(),
              createdAt: current?.createdAt ?? new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
          } else {
            if (current.followUps[v.id])
              return send(200, { error: "prayer_conflict" });
            if (Object.keys(current.followUps).length >= 50)
              return send(200, { error: "follow_up_limit" });
            if (v.date > today())
              return send(400, {
                code: "22023",
                message: "Future fixture note",
              });
            current.followUps[v.id] = { text: v.text.trim(), date: v.date };
            current.revision = randomUUID();
            current.updatedAt = new Date().toISOString();
          }
        }
      }
      if (path.endsWith("/submit_quiz"))
        recordFixtureQuiz(body.p_question, body.p_option);
      return send(200, state);
    }
    return send(404, { error: "Unexpected fixture request" });
  } catch {
    send(500, { error: "Fixture request failed" });
  }
});
server.listen(43191, "127.0.0.1", () => {
  const app = spawn(
    process.execPath,
    [
      resolve(workspace, "node_modules/next/dist/bin/next"),
      "dev",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3191",
    ],
    {
      cwd: fixtureApp,
      stdio: "inherit",
      env: {
        ...process.env,
        FAITHQUEST_STORAGE_MODE: "supabase",
        FAITHQUEST_ACCOUNTS_ENABLED: "true",
        FAITHQUEST_APP_ORIGIN: "http://127.0.0.1:3191",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:43191",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
          "sb_publishable_local_fixture_only",
      },
    },
  );
  app.on("exit", (code) => {
    server.close();
    process.exit(code ?? 1);
  });
  for (const signal of ["SIGTERM", "SIGINT"])
    process.on(signal, () => {
      app.kill(signal);
      server.close(() => process.exit(0));
    });
});
server.on("error", () => {
  console.error("Could not start the isolated account fixture.");
  process.exit(1);
});
