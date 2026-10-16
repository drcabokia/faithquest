# Architecture

## Runtime

Next.js App Router renders route shells and the landing page. Interactive client components subscribe to a shared journey provider. The app uses React, strict TypeScript, Tailwind, shadcn/ui conventions, Lucide, Recharts, and Zod. No custom server, background worker, Docker, AI API, or runtime filesystem persistence is needed.

## Boundaries

`src/data` holds Bible metadata and editorial quiz content. `src/services` holds pure reading-plan/gamification functions and a `BibleContentProvider`. `src/lib` holds dates, validation, and persistence adapters. `src/components` contains the application shell, UI primitives, and feature screens. `src/app` owns route composition and metadata. Business rules do not depend on React or browser APIs.

Demo state is versioned and validated before use. All demo writes go through a synchronous snapshot repository contract; save errors remain visible. Production has a separate async command contract (`ProductionJourneyRepository`) so clients never submit authoritative XP snapshots. Local demo content is private to a browser profile, not encrypted or synchronized, and must not be confused with production privacy guarantees. Multiple tabs should receive storage updates.

## Routes

| Route           | Purpose                                                        |
| --------------- | -------------------------------------------------------------- |
| `/`             | Brand, mission, demo entry                                     |
| `/login`        | Honest demo entry and future Google-auth explanation           |
| `/dashboard`    | Today's mission, XP, streak, activity, journey summary         |
| `/reading-plan` | Searchable/paged 365-day canonical schedule                    |
| `/bible`        | Book/chapter navigation, verified WEB text, chapter completion |
| `/quiz`         | Curated questions, explanations, one answer per question       |
| `/journal`      | Private demo reflections with edit/history                     |
| `/achievements` | Earned/locked milestones and book adventure map                |
| `/community`    | Future fellowship design, no fake membership or ranking        |
| `/profile`      | Display name, start date, timezone, theme, summary             |

## Production boundary

The demo adapter must never become a fallback for authenticated production writes. Introduce Supabase SSR clients and Google OAuth; verify sessions on the server. Apply migrations and reviewed seeds, then implement atomic activity RPCs. RLS isolates every personal record by `auth.uid()`. Clients must not mint XP or write achievement unlocks. Never expose a service-role key. Do not silently import browser journals into an account.

## Reading and rewards

Canonical plan generation distributes all 1,189 Protestant-canon chapters exactly once over 365 days (3–4 chapters per day). The canon is disclosed; other canons require separate editorially reviewed plans. Streaks count distinct completion dates in the configured IANA timezone; yesterday can continue a streak. Missing days never subtract XP. Award events have stable keys for reading days, correct quiz answers, first daily reflection, and completed books. Future memory/challenge rewards have specified values but no claim control until implemented.

## Cost

Mostly static routes and local demo interactions minimize server work. Bundle public-domain content locally when practical; never require a paid content provider for the demo. Vercel Hobby and Supabase Free are subject to terms and limits; consult deployment documentation before production use.
