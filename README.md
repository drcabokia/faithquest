# FaithQuest365

**Read. Discover. Grow in Faith.**

A functional, browser-local Bible reading companion built with Next.js. Follow a complete 365-day canonical journey, read verified Scripture, answer thoughtful questions, and keep reflections. XP celebrates participation and consistency, never spiritual maturity.

## Run locally

Requirements: Node.js **22.12 or newer**, npm, and a modern browser. No credentials or paid services are required.

```powershell
cd C:\faithquest365
npm install
npm run dev
```

Open **http://localhost:3000**. Choose **Begin your journey** to enter the labelled demo. The dev server binds to the local computer. Stop it with Ctrl+C. Use `npm ci` for an exact install from the committed lockfile.

## What works

- Original FaithQuest365 branding, landing page, demo entry, responsive sidebar/mobile menu, and light/dark/system themes.
- Dashboard with real mission progress, XP, level, date-based reading streak, earned badges, and a seven-day XP chart.
- Complete canonical plan: **365 days, 66 books, 1,189 chapters**, every chapter assigned once, 3–4 chapters per day. This release uses the Protestant canon.
- Full World English Bible Classic reader, bundled locally by chapter; book/chapter navigation, saved reading position, explicit chapter completion, honest loading/error states, and a retry control.
- Reading missions award **50 XP** after every assigned chapter is completed. Book completion awards **150 XP**. Stable reward keys prevent duplicate claims.
- Six manually reviewed quiz questions for days 1–3, four choices, Scripture references, explanations, saved attempts, and **10 XP** per correct answer. A submitted answer cannot be retried for more XP.
- Reflection journal with prompts, saved entries, history/editing, and **20 XP** per daily reflection. Editing an entry never re-awards its reward.
- Eight achievements, seven participation levels, and an interactive map of all 66 books.
- Display name, start date, fixed journey timezone after the first activity, appearance, and JSON backup export.
- Versioned/Zod-validated browser persistence, clear save failures, and cross-tab updates. Web Locks coordinate concurrent writes in supporting browsers.
- Supabase schema and complete canonical reference-data migrations, production command contract, auth/security plan, and GitHub CI configuration.

## Try the main flow

1. Open the dashboard and continue to the first mission, Genesis 1–3.
2. Read each chapter and choose **Mark chapter as read**. After all three, receive 50 XP.
3. Open Daily Quiz and answer a day 1 question; review the explanation.
4. Write a reflection of at least 20 characters and save it.
5. Refresh. Your progress, answers, and entry remain in this browser.
6. Open Achievements or Reading Plan to see the recorded progress.

## Demo boundaries

This is a functional demo, **not an authenticated production service**. All personal data is localStorage in the current browser profile and origin. Different ports, `localhost` versus `127.0.0.1`, devices, or browsers have separate data. Clearing site data removes it. Entries are not encrypted or backed up automatically. Export a private copy in Profile & Settings; import/restore is not implemented.

Demo rewards are protected against duplicate UI claims, but browser data and quiz answer keys can be inspected/modified. Production must verify activities and mint XP on the server. Never treat demo records as authoritative account data.

Canonical is the complete plan. Chronological and balanced plans, Google sign-in, Supabase persistence, groups, memory verses, challenges, grace days, highlights, prayer categories, multilingual text, PWA, push, and AI are future work. Community explains the future scope and has no simulated live groups. AI is absent/disabled and has no paid dependency.

Streaks use distinct dates of **completed daily missions** in the saved IANA timezone. Reading multiple missions on one date counts as one streak day; yesterday’s streak remains until today passes. Reading a partial mission does not count yet. Missing days never removes XP. New reflections are for today; older saved entries can be edited. Chapter completion is self-reported, not proof of comprehension.

## Stack and structure

Next.js App Router, React, strict TypeScript, Tailwind CSS 4, accessible shadcn/ui Button with Radix Slot/CVA, Lucide, Recharts, Zod, Vitest, and Playwright. The lockfile pins all installed versions. No external fonts or images are fetched at runtime.

```text
src/app/              Route shells, landing page, global theme styles
src/components/       Layout, dashboard, reader, journal, quiz, achievements, settings
src/data/             Bible metadata and reviewed demo quiz questions
src/lib/              Dates, validated state, browser persistence, utilities
src/services/         Reading-plan/gamification logic, content provider, future production contract
public/bible/         1,189 verified WEB chapter JSON files and provenance record
supabase/migrations/  Schema/RLS preparation and canonical reference seeds
scripts/              Reproducible public-domain Scripture importer
tests/                Business-rule/content tests and browser acceptance tests
docs/                 Plan, architecture, database, content, deployment, validation
```

## Validation

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

`npm run check` runs lint, types, unit/content tests, and the production build. Browser tests run against a temporary production server and stop it automatically. On Windows they use installed Microsoft Edge. On Linux/macOS run `npx playwright install chromium` first. If port 3000 is occupied, stop that server before browser testing. `npm run format:check` checks formatting; `npm run format` updates it.

See [validation results](docs/VALIDATION.md) for executed checks and remaining limits. Production runtime dependencies currently pass `npm audit --omit=dev`; full development dependency auditing reports an upstream lint-tooling advisory documented there.

## Scripture and deployment

The [World English Bible Classic](https://ebible.org/eng-web/) is [public domain](https://ebible.org/eng-web/copyright.htm). Verse text was imported directly from eBible.org, with source URL, retrieval date, and archive SHA-256 in `public/bible/provenance.json`. See [content notes](docs/CONTENT.md). No copyrighted translation is bundled.

The initial target is **USD 0/month** for personal, non-commercial use, subject to provider terms and free-tier limits. See [GitHub → Vercel deployment](docs/DEPLOYMENT.md). No hosting account has been created or deployed by this implementation.

## Project documentation

- [Project plan](docs/PROJECT_PLAN.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Feature roadmap](docs/FEATURE_ROADMAP.md)
- [Database design](docs/DATABASE_DESIGN.md)
- [Production authentication and security](docs/AUTH_AND_SECURITY.md)
- [Development milestones](docs/IMPLEMENTATION_STATUS.md)
