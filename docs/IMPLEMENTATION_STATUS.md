# Implementation status

As of **16 October 2026**:

| Phase                     | Outcome                                                                                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Planning and setup        | Complete; documented architecture, strict Next.js/React application, checks and CI                                                                  |
| Functional demo           | Complete; 365-day canonical plan, full WEB reader, reading position, XP, streaks, quizzes, reflections, achievements, settings/export               |
| Senior readability        | Complete; larger supporting text, completion/XP labels, badge descriptions, responsive wrapping and improved contrast                               |
| Database commands         | Implemented; four migrations, canonical seeds, transactional rewards, reviewed quizzes/private solutions, server-earned achievements                |
| Authenticated integration | Implemented behind disabled account flags; SSR clients, Google handlers, session proxy, authenticated API and separate account persistence          |
| Local validation          | Lint/types passed; 52 automated tests including embedded PostgreSQL isolation and mocked HTTP/auth boundaries; five demo browser scenarios passed   |
| Hosted acceptance         | Pending; development migrations, real Google login, token renewal, cross-device progress and journal isolation must pass before production accounts |

## Current project connection

The selected development project is `https://uiozbdsimvsvxjpalsro.supabase.co`. Its publishable key is configured only in ignored `.env.local`. A public readiness check successfully reached the project, but reported **Google sign-in disabled** and could not read the expected reference-book catalogue. This does not establish which migrations, if any, exist remotely.

The Supabase integration is not yet connected to this workspace, and no development database connection is configured. Consequently, no hosted migration execution or live user/session verification is claimed. Application storage remains `demo` and account access remains disabled.

## What the account implementation enforces

PostgreSQL derives the user from the session, validates full assigned-chapter completion, and owns XP and achievement changes. Per-user locks and unique activity keys protect rewards from duplicate requests. Reflections and other personal tables retain owner-only reads; direct client writes and private quiz answers are restricted. The journey API verifies the user, validates bounded commands and Origin, and returns private/no-store responses.

The account provider does not persist journals/progress in localStorage, import demo records, or fall back to the demo after an account error. Quiz feedback becomes available after submission. Embedded PostgreSQL tests execute the actual migrations with two synthetic identities; SDK/session boundary tests use mocks and are not evidence of hosted OAuth or renewal.

## Remaining sequence

1. Connect the Supabase integration or enter a verified development `DATABASE_URL` locally. Apply migrations and run the rollback-only live isolation/reward checks.
2. Enable Google in the project's Authentication provider settings and verify its owned OAuth client and exact callback allowlist.
3. Enable development account testing, then verify real Google login/logout, expiration/renewal, independent users, cross-device persistence, duplicate rewards and journal privacy.
4. Review deletion/backup/rate limits and production settings before enabling public production accounts.

Follow [the integration runbook](SUPABASE_INTEGRATION.md) for exact commands and acceptance criteria. No paid AI service or Vercel deployment has been enabled. Recovery codes remain unread and excluded from Git; environment files and credentials are not committed.

## Published milestones

The original planning, setup, functional demo, database preparation, documentation and readability changes are published to `main` at https://github.com/drcabokia/faithquest. The initial GitHub access issue is resolved. The readability milestone passed [Linux CI](https://github.com/drcabokia/faithquest/actions/runs/38898921659), including the production build and five Chromium scenarios. The database-command milestone (`714c727`) and gated account integration (`211a483`) are also published. The account integration passed [Linux CI](https://github.com/drcabokia/faithquest/actions/runs/38902766523), including all 52 tests, the production build and five Chromium scenarios. Hosted acceptance remains pending as described above.
