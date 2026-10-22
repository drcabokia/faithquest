# FaithQuest365

**Read. Discover. Grow in Faith.**

A Bible reading companion built with Next.js, with a browser-local demo and private authenticated accounts. Follow a complete 365-day reading journey, read verified Scripture, answer thoughtful questions, and keep reflections. XP celebrates participation and consistency, never spiritual maturity.

## Run locally

Requirements: Node.js **22.12 or newer**, npm, and a modern browser. No credentials or paid services are required.

```powershell
cd C:\faithquest365
npm install
npm run dev
```

Open **http://127.0.0.1:3000**. Default configuration opens the labelled demo; this workspace's ignored local configuration enables Google account testing. The dev server binds to the local computer. Stop it with Ctrl+C. Use `npm ci` for an exact install from the committed lockfile.

## What works

- Original FaithQuest365 branding, landing page, demo entry, responsive sidebar/mobile menu, and light/dark/system themes.
- Dashboard with real mission progress, XP, level, date-based reading streak, earned badges, and a seven-day XP chart.
- Canonical and Balanced Daily plans: **365 days, 66 books, 1,189 chapters** each, with every chapter assigned once. Canonical has 3–4 chapters per day; Balanced mixes whole-chapter streams across the year, with varying daily readings. Balanced is available for explicit development testing; independent editorial review is pending. This release uses the Protestant canon.
- Full World English Bible Classic reader, bundled locally by chapter; book/chapter navigation, saved reading position, explicit chapter completion, honest loading/error states, and a retry control.
- Reading missions award **50 XP** after every assigned chapter is completed. Book completion awards **150 XP**. Stable reward keys prevent duplicate claims.
- Sixty passage-checked quiz questions for canonical days 1–30, four choices, Scripture references, explanations, saved attempts, and **10 XP** per correct answer. A submitted answer cannot be retried for more XP.
- Adjustable Scripture text size and line spacing under Profile & Settings, linked from Bible Reader, with keyboard controls, reset and preferences remembered in this browser. See [reading comfort checks](docs/READING_COMFORT.md).
- Private saved verses and guided memory practice with first-letter hints and temporary typed recall checks in **Study Tools**, with reference search, book/order filters, pagination, removal and export/restore. Save any available verse using the Bible Reader’s verse selector; practice keeps XP/streaks unchanged.
- Private notes on saved verses, with explicit saving/deletion, protected in-memory drafts, concurrent-edit checks and export/restore. Notes stay separate from Scripture, earn no XP and are never shared with fellowship groups.
- Reflection journal with prompts, saved entries, history/editing, and **20 XP** per daily reflection. Editing an entry never re-awards its reward.
- Private [prayer requests](docs/PRAYER_TRACKING.md), with a compact list, Ongoing/Answered/Archived status, dated follow-ups, search, protected drafts, concurrent-edit checks and export/restore. Prayer activity earns no XP.
- Reading rhythm and catch-up guidance on Dashboard/My Reading Plan, with an explicit yesterday-only grace claim at most once per rolling 30 days. Grace dates preserve displayed continuity without reading, XP, badge or challenge credit. See [policy and testing](docs/READING_CONSISTENCY.md).
- Eight achievements, seven participation levels, and an interactive map of all 66 books.
- Display name, start date, fixed journey timezone after the first activity, appearance, JSON backup export and previewed restore.
- Account exports fetch the latest saved journey through an authenticated endpoint. Unavailable exports show an error; they never silently download an older browser snapshot. Temporary identity-service outages are retryable, and **Check saved progress** recovers the latest server state after a failed or uncertain save.
- Profile offers confirmed **Sign out of all devices**. Account reads, exports, writes and protected pages require an active Supabase session, including when a revoked session still has an unexpired access token.
- Account deletion offers export guidance, typed confirmation and a recent Google sign-in requirement. A guarded Supabase Edge Function revokes sessions before deleting the caller and cascading personal data; real-account deletion acceptance is still pending.
- Persistent per-account request limits protect commands, exports, deletion attempts and connection checks. Profile offers **Check account connection**; errors keep sign-in intact during outages and provide a private support reference. Export/deletion/check buttons show cooldowns.
- Versioned/Zod-validated browser persistence, clear save failures, and cross-tab updates. Web Locks coordinate concurrent writes in supporting browsers.
- Supabase migrations, transactional reward commands, Google/SSR sessions and private account persistence. Hosted database and core two-account browser checks pass; extended session/recovery and production operations remain gated. GitHub CI configuration is included.

## Try the main flow

1. Open the dashboard and continue to the first mission, Genesis 1–3.
2. Read each chapter and choose **Mark chapter as read**. After all three, receive 50 XP.
3. Open Daily Quiz and answer a day 1 question; review the explanation.
4. Write a reflection of at least 20 characters and save it.
5. Refresh. Your progress, answers, and entry remain in this browser.
6. Open Achievements or Reading Plan to see the recorded progress.

## Demo boundaries

This is a functional demo, **not an authenticated production service**. All personal data is localStorage in the current browser profile and origin. Different ports, `localhost` versus `127.0.0.1`, devices, or browsers have separate data. Clearing site data removes it. Entries are not encrypted or backed up automatically. Export a private copy in Profile & Settings; restore missing activity with the previewed merge control. See [backup and restore](docs/BACKUP_AND_RESTORE.md).

Demo rewards are protected against duplicate UI claims, but browser data and quiz answer keys can be inspected/modified. The account implementation verifies activities and mints XP in PostgreSQL; core hosted acceptance passed, with extended session/recovery and production operations still gated. Imported demo activity is explicitly confirmed, validated and recalculated by the account server; its XP ledger is never trusted.

Canonical and Balanced Daily have complete schedules, previews and progress-safe selection before activity. Chronological Journey has a complete preview-only editorial draft, source notes and a public review download; it cannot be selected before review. Chronological activation, multilingual text, PWA, push, and AI remain future work. Private journal categories, study tools and seven-day challenges are implemented in demo/account modes. Invite-only fellowship groups are implemented in development account mode; demo Community explains account requirements and shares no activity. Runtime AI features are absent/disabled and have no paid dependency. New quiz wording was developed with coding-assistant help and passage-checked; independent human editorial review remains pending (see [content provenance](docs/CONTENT.md)).

Authenticated integration is enabled for local development in this workspace. Google sign-in, hosted rewards/isolation, saved progress and journals, independent-browser recovery, two-account privacy, offline retry and focus refresh have been verified. All-device sign-out and saved-data recovery also passed by user confirmation. Token-expiry renewal, a direct hosted revoked-token API probe, lost-response recovery and production operations remain release gates. See [Supabase setup and acceptance](docs/SUPABASE_INTEGRATION.md). Default configuration remains demo mode, which needs no credentials.

Streak totals count distinct dates of **completed daily missions** in the saved IANA timezone. Optional grace dates bridge displayed continuity and are listed separately; achievement/challenge credit still uses actual completed missions. Reading multiple missions on one date counts as one streak day; yesterday’s streak remains until today passes. Reading a partial mission does not count yet. Missing days never removes XP. New reflections are for today; older saved entries can be edited. Chapter completion is self-reported, not proof of comprehension.

## Stack and structure

Next.js App Router, React, strict TypeScript, Tailwind CSS 4, accessible shadcn/ui Button with Radix Slot/CVA, Lucide, Recharts, Zod, Vitest, and Playwright. The lockfile pins all installed versions. No external fonts or images are fetched at runtime.

```text
src/app/              Route shells, landing page, global theme styles
src/components/       Layout, dashboard, reader, journal, quiz, achievements, settings
src/data/             Bible metadata and reviewed demo quiz questions
src/lib/              Dates, validated state, browser persistence, utilities
src/services/         Reading-plan/gamification logic, content provider, authenticated Supabase command adapter
public/bible/         1,189 verified WEB chapter JSON files and provenance record
supabase/migrations/  Schema/RLS, reference/quiz seeds and transactional commands
scripts/              Scripture importer, guarded migrations and live isolation checks
tests/                Business/content, PostgreSQL isolation, auth-boundary and browser tests
docs/                 Plan, architecture, database, content, deployment, validation
```

## Validation

```powershell
npm run lint
npm run typecheck
npm run check:edge
npm run health:check
npm test
npm run build
npm run test:e2e
npm run test:e2e:account
```

`npm run check` runs lint, application/Edge Function types, unit/content tests, and the production build. Edge validation uses pinned Deno 2.9.6 via npm and a frozen Deno lockfile. CI also runs the isolated account browser suite. The demo browser suite requires a build with demo storage flags and runs a temporary production server; set `FAITHQUEST_E2E_PORT` to a free port if 3000 is occupied. The account browser suite uses a separate local app/source copy and synthetic Supabase protocol fixture on ports 3191/43191, with no real credentials or personal records. It exercises real app routes and UI but does not establish hosted OAuth or token-renewal correctness. Both suites stop their temporary servers. On Windows they use installed Microsoft Edge; on Linux/macOS run `npx playwright install chromium` first. `npm run format:check` checks formatting; `npm run format` updates it.

See [validation results](docs/VALIDATION.md) for executed checks and remaining limits. Production runtime dependencies currently pass `npm audit --omit=dev`; full development dependency auditing reports an upstream lint-tooling advisory documented there.

## Scripture and deployment

The [World English Bible Classic](https://ebible.org/eng-web/) is [public domain](https://ebible.org/eng-web/copyright.htm). Verse text was imported directly from eBible.org, with source URL, retrieval date, and archive SHA-256 in `public/bible/provenance.json`. See [content notes](docs/CONTENT.md). No copyrighted translation is bundled.

The initial target is **USD 0/month** for personal, non-commercial use, subject to provider terms and free-tier limits. See [GitHub → Vercel deployment](docs/DEPLOYMENT.md). No hosting account has been created or deployed by this implementation.

## Project documentation

- [Project plan](docs/PROJECT_PLAN.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Feature roadmap](docs/FEATURE_ROADMAP.md)
- [Study tools and testing](docs/STUDY_TOOLS.md)
- [Database design](docs/DATABASE_DESIGN.md)
- [Production authentication and security](docs/AUTH_AND_SECURITY.md)
- [Development milestones](docs/IMPLEMENTATION_STATUS.md)

Service readiness is available at `/api/health`; `npm run health:check` checks the running app without signing in. It returns only readiness status and a support reference, never account data. Application error logs contain allowlisted operational fields only. See [operations and verification](docs/SUPABASE_INTEGRATION.md#8-reliability-and-monitoring--16-october-2026) for limits and current evidence.

Private journal categories, local text/date search, tab-lifetime drafts and server-checked conflict protection are available in demo and development account modes. See [journal testing instructions](docs/JOURNAL_TOOLS.md). Save before closing/signing out; drafts are memory-only and are not included in backups.

Private seven-day reading challenges now support explicit enrollment, seven calendar-date progress, a one-time 100 XP bonus, history and backup recovery. See [the calendar policy and testing guide](docs/READING_CHALLENGES.md).

Private fellowship groups now support explicit sharing consent, invite codes, participation summaries and owner/member controls in account mode. See [the two-account testing guide](docs/FELLOWSHIP_GROUPS.md). Personal backups include own membership metadata for reference and never grant group access.
