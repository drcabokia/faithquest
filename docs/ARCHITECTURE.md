# Architecture

## Runtime

Next.js App Router renders route shells and the landing page. Interactive client components subscribe to a shared journey provider. The app uses React, strict TypeScript, Tailwind, shadcn/ui conventions, Lucide, Recharts, and Zod. No custom server, background worker, Docker, AI API, or runtime filesystem persistence is needed.

## Boundaries

`src/data` holds Bible metadata and editorial quiz content. `src/services` holds pure reading-plan/gamification functions and a `BibleContentProvider`. `src/lib` holds dates, validation, and persistence adapters. `src/components` contains the application shell, UI primitives, and feature screens. `src/app` owns route composition and metadata. Business rules do not depend on React or browser APIs.

Demo state is versioned and validated before use. All demo writes go through a synchronous snapshot repository contract; save errors remain visible. Account mode implements a separate async command contract (`ProductionJourneyRepository`) through an authenticated API and Supabase RPCs, so clients never submit authoritative XP snapshots. Local demo content is private to a browser profile, not encrypted or synchronized, and must not be confused with production privacy guarantees. Multiple tabs should receive storage updates.

## Routes

| Route           | Purpose                                                        |
| --------------- | -------------------------------------------------------------- |
| `/`             | Brand, mission, demo entry                                     |
| `/login`        | Mode-aware demo entry or gated Google sign-in                  |
| `/dashboard`    | Today's mission, XP, streak, activity, journey summary         |
| `/reading-plan` | Searchable/paged 365-day canonical schedule                    |
| `/bible`        | Book/chapter navigation, verified WEB text, chapter completion |
| `/quiz`         | Curated questions, explanations, one answer per question       |
| `/journal`      | Reflections with edit/history in the selected storage mode     |
| `/achievements` | Earned/locked milestones and book adventure map                |
| `/community`    | Future fellowship design, no fake membership or ranking        |
| `/profile`      | Display name, start date, timezone, theme, summary             |

## Production boundary

The root layout selects separate dynamically imported demo/account providers from a server environment setting. Account mode uses request-scoped Supabase SSR clients, Google OAuth handlers, a Next.js session-refresh proxy and a verified journey API. The API submits strict commands to PostgreSQL functions, which derive identity from `auth.uid()`, lock per-user state and write activity/rewards/achievements atomically. RLS isolates personal reads and private quiz solutions remain outside the public schema.

The account adapter never falls back to localStorage, imports demo journals or accepts client-minted XP. Public quiz prompts are separated from demo solutions; account feedback comes from a submitted attempt. Account progress is fetched without shared caching and refreshed on focus. Production accounts are disabled until hosted migrations, OAuth, session renewal and cross-device/privacy acceptance pass. See [integration details](SUPABASE_INTEGRATION.md).

## Reading and rewards

Canonical plan generation distributes all 1,189 Protestant-canon chapters exactly once over 365 days (3–4 chapters per day). The canon is disclosed; other canons require separate editorially reviewed plans. Streaks count distinct completion dates in the configured IANA timezone; yesterday can continue a streak. Missing days never subtract XP. Award events have stable keys for reading days, correct quiz answers, first daily reflection, and completed books. Future memory/challenge rewards have specified values but no claim control until implemented.

## Cost

Mostly static routes and local demo interactions minimize server work. Bundle public-domain content locally when practical; never require a paid content provider for the demo. Vercel Hobby and Supabase Free are subject to terms and limits; consult deployment documentation before production use.
