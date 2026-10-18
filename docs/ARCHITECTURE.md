# Architecture

## Runtime

Next.js App Router renders route shells and the landing page. Interactive client components subscribe to a shared journey provider. The app uses React, strict TypeScript, Tailwind, shadcn/ui conventions, Lucide, Recharts, and Zod. No custom server, background worker, Docker, AI API, or runtime filesystem persistence is needed.

## Boundaries

`src/data` holds Bible metadata and editorial quiz content. `src/services` holds pure reading-plan/gamification functions and a `BibleContentProvider`. `src/lib` holds dates, validation, and persistence adapters. `src/components` contains the application shell, UI primitives, and feature screens. `src/app` owns route composition and metadata. Business rules do not depend on React or browser APIs.

Demo state is versioned and validated before use. All demo writes go through a synchronous snapshot repository contract; save errors remain visible. Account mode implements a separate async command contract (`ProductionJourneyRepository`) through an authenticated API and Supabase RPCs, so clients never submit authoritative XP snapshots. Local demo content is private to a browser profile, not encrypted or synchronized, and must not be confused with production privacy guarantees. Multiple tabs should receive storage updates.

## Routes

| Route                 | Purpose                                                                         |
| --------------------- | ------------------------------------------------------------------------------- |
| `/`                   | Brand, mission, demo entry                                                      |
| `/login`              | Mode-aware demo entry or gated Google sign-in                                   |
| `/dashboard`          | Today's mission, XP, streak, activity, journey summary                          |
| `/reading-plan`       | Active 365-day schedule and complete plan previews                              |
| `/bible`              | Book/chapter navigation, verified WEB text, chapter completion                  |
| `/study`              | Private saved verses, exact-WEB memory practice, reference filters and recovery |
| `/quiz`               | Curated questions, explanations, one answer per question                        |
| `/journal`            | Reflections with edit/history in the selected storage mode                      |
| `/achievements`       | Earned/locked milestones and book adventure map                                 |
| `/community`          | Future fellowship design, no fake membership or ranking                         |
| `/profile`            | Display name, start date, timezone, theme, summary                              |
| `/auth/signout-all`   | Confirmed same-origin POST to revoke the caller’s sessions on all devices       |
| `/api/health`         | Minimal public Auth/catalogue readiness, no identity or account data            |
| `/api/account/health` | Verified caller connection check with its own budget                            |
| `/api/account/delete` | Same-origin confirmed POST invoking caller-scoped account deletion              |
| `/api/account/export` | Verified caller's latest journey snapshot as a private JSON attachment          |

## Production boundary

The root layout selects separate dynamically imported demo/account providers from a server environment setting. Account mode uses request-scoped Supabase SSR clients, Google OAuth handlers, a Next.js session-refresh proxy and a verified journey API. The API submits strict commands to PostgreSQL functions, which derive identity from `auth.uid()`, lock per-user state and write activity/rewards/achievements atomically. RLS isolates personal reads and private quiz solutions remain outside the public schema.

The account adapter never falls back to localStorage, automatically imports demo journals or accepts client-minted XP. An explicit backup merge uploads only normalized activity after preview and confirmation. Public quiz prompts are separated from demo solutions; account feedback comes from a submitted attempt. Account progress is fetched without shared caching and refreshed on focus. Production accounts are disabled until hosted migrations, OAuth, session renewal and cross-device/privacy acceptance pass. See [integration details](SUPABASE_INTEGRATION.md).

Account recovery exposes an explicit saved-progress read after a failed/uncertain request. Identity-service outages remain retryable instead of being treated as sign-out. Account exports verify identity independently and read the current database snapshot; the profile UI downloads only a successfully validated response. The account browser regression suite runs the real app with a local synthetic Supabase protocol fixture and separate app/source/build files, so it does not touch the user's running development server or real accounts.

## Reading and rewards

Canonical plan generation distributes all 1,189 Protestant-canon chapters exactly once over 365 days (3–4 chapters per day). The canon is disclosed; other canons require separate editorially reviewed plans. Streaks count distinct completion dates in the configured IANA timezone; yesterday can continue a streak. Missing days never subtract XP. Award events have stable keys for reading days, correct quiz answers, first daily reflection, and completed books. Reserved memory/challenge reward constants do not enable claims. The current hide/reveal memory practice is unscored and grants no XP.

## Cost

Mostly static routes and local demo interactions minimize server work. Bundle public-domain content locally when practical; never require a paid content provider for the demo. Vercel Hobby and Supabase Free are subject to terms and limits; consult deployment documentation before production use.

## Session revocation

`account_session_active()` correlates the signed JWT `session_id` with `auth.sessions`, checks its owner and optional `not_after`, and returns only a boolean. Migration `20261016142344_active_account_sessions.sql` adds restrictive SELECT policies to all nine personal/group tables and checks the session in `private.actor()` before transactional commands. Existing ownership/member policies still apply. Public catalogue access is unchanged.

Account API/export routes independently verify the user and active session; protected pages check claims and session activity. Lookup outages fail closed with a private retryable 503, while a confirmed missing/revoked session returns 401 or redirects a page to login. Profile’s global sign-out requires a separate confirmation POST and exact Origin; the SSR client calls Supabase Auth with `scope: "global"`. This requires no privileged runtime key. Already displayed data in another browser disappears on its next protected navigation or account refresh; sign-out cannot erase files the user previously downloaded.

## Account deletion boundary

`src/components/delete-account.tsx` exposes explicit review and typed confirmation in account mode. `POST /api/account/delete` validates Origin and a streamed 1 KiB JSON body, rejects user IDs/extra fields and independently verifies the current account/session. It invokes `delete-account` with the caller's JWT through the normal SSR SDK, without privileged Next.js environment variables.

The Supabase Edge Function in `supabase/functions/delete-account` uses pinned supabase-js 2.118.0 and a Deno lockfile. Platform JWT verification stays enabled. Its handler rejects browser origins, verifies the caller with `getUser` and `getClaims`, checks the active session, and requires an OAuth AMR timestamp from the last ten minutes. It globally revokes the caller's sessions before invoking Auth Admin `deleteUser(caller.id, false)`. Its administrative credential is injected only inside Supabase's Edge runtime. Existing cascade constraints remove the profile, activity, rewards, reflections, memberships and owned groups. No schema migration was needed.

A failed/uncertain operation never returns successful deletion. If revocation succeeds but removal fails, the account may remain signed out and the error directs the user to sign in/check before retrying. A lost successful response has the same uncertainty; the UI never invents an outcome. After confirmed removal, the server attempts local cookie cleanup and the browser navigates to login with a deletion notice. A cleanup outage does not change a committed deletion result. The Google identity/provider account and previously downloaded exports are outside this deletion boundary.

## Request budgets and operational signals

The sixth migration keeps the reviewed transactional implementations in `private` and exposes metered public wrappers with the same signatures. The wrappers take the existing profile lock before quota rows. Initialization creates/locks a profile before metering its result. Nested snapshots also use the read budget, and the consistent lock order avoids reversing profile/quota acquisition across concurrent reads/writes. Commands and their quota charges commit/roll back together. The seventh migration calculates retry time after waiting and clamps it to the configured window.

`private.request_budgets` has a `(user_id,bucket)` primary key, Auth-user cascade, RLS enabled with no client policies and no client grants. Atomic INSERT/ON CONFLICT admission uses the signed user/session and fixed server-side limits, without caller-selected IDs, clocks or limits. Public `consume_account_request` permits only export/delete/health buckets; private helpers and unmetered implementations remain inaccessible. There are at most five rows per user. No Redis or other service is needed.

The shared pure operational helper supplies bounded admission decoding and privacy-safe sampled reporting in Next.js and the Edge runtime. The application responder adds a generated `X-Request-ID` reference and logs only 429/500/503 generic events. A sampled thirty-second incident group reuses its first reference so displayed references remain findable. API errors retain private/no-store headers. The browser honors bounded `Retry-After` values without signing out on 429/503, uses local countdowns for exports/deletion/checks and does not replay mutations. A network timeout is an uncertain result, resolved through explicit saved-progress recovery.

`/api/health` checks public Auth settings and a HEAD request for the 66-book catalogue; each fetch has a four-second timeout. Concurrent checks share an in-flight promise; healthy/unhealthy booleans cache for fifteen/five seconds per process. No user state or cookies enter these probes. `/api/account/health` independently verifies identity and session, consumes its own allowance and returns only `{status:"ok"}`. Neither health endpoint fetches a journey. The public probe is readiness, not a backup check, alert system or proof of session renewal.

## Explicit backup recovery

`lib/backup.ts` validates version 1 files locally, strips untrusted authority fields and produces the strict restore command. Public prompt IDs validate selections without importing demo solution keys into account code. `RestoreBackup` previews missing counts and requires ownership/account confirmation before upload. No backup content is rendered as HTML, logged or cached in account localStorage. `api/account/restore` independently verifies the caller, enforces Origin and streamed body bounds, and invokes the caller-only RPC. Temporary failures keep an uncertain outcome and never trigger an automatic replay.

The eighth migration adds the restore budget and an atomic merge under the existing profile lock. PostgreSQL repeats validation independently of Next.js, rejects unknown/invalid/future data, inserts missing activity with conflict-ignore semantics, rechecks quiz solutions privately, and derives reading/book/quiz/reflection rewards and achievements. Existing preferences, position, entries and rewards win. Demo recovery uses equivalent reconstruction and the existing browser write lock; demo and account repositories remain separate. See [restore policy and service recovery boundaries](BACKUP_AND_RESTORE.md).

## Study tools and saved verses

`/study` is a protected account page (or a labelled local-demo page) with a caller-private saved-reference collection. Reader controls accept an available verse number and explicit save/remove intent. Memory cards load exact public WEB text on demand, twelve cards per page, with reference search, book filters and recent/canonical ordering. Hide/reveal is component-local practice state: no grading, practice history, XP or achievement claim is stored.

`lib/verses.ts` validates references against generated chapter limits and the five empty source placeholders. The ninth migration verifies the existing chapter counts, adds empty-number metadata, and creates `user_saved_verses` with owner/session SELECT policies and no direct client writes. `set_saved_verse` uses the existing profile lock and write/read quotas; its boolean intent makes lost-response retries idempotent. Snapshot exports include an optional saved-reference/timestamp map. Backup commands normalize it to references only; restore merges under the same lock, retains existing timestamps, creates new destination timestamps and checks the merged 1,000-reference cap before any activity is written. Older snapshots/backup commands still work. Details and browser steps are in [STUDY_TOOLS.md](STUDY_TOOLS.md).

## Journal categories, search and drafts

The journey layout owns an in-memory draft provider, which survives internal navigation and clears when that layout unmounts. Journal editors derive untouched values from the latest snapshot, keep per-date draft baselines and warn when refreshed saved content differs. Successful saves clear only the submitted draft identity; newer typing survives. Discard is confirmed, and native beforeunload warnings are installed while drafts exist. Search/category filtering and ten-entry pagination are browser-only. Drafts and search terms never enter account storage, URLs, exports or logs. This is tab-lifetime protection, not durable autosave or server-enforced conflict locking.

The tenth migration adds constrained reflection categories, exposes the uniquely named metered caller-only save command and extends snapshots/restoration without changing version 1. Old save commands preserve categories; legacy restores default missing categories only for newly inserted records. Destination entries win, and category-only differences count as preview conflicts. See [journal testing and limits](JOURNAL_TOOLS.md).

## Seven-day reading challenges

The protected `/challenges` page and dashboard link expose explicit caller-only enrollment, seven calendar-date cards, private progress, bonus confirmation and ten-period history pages. `lib/challenges.ts` validates bounded nonoverlapping start dates and derives statuses from unique mission completion dates; `services/challenges.ts` implements the demo join/reward rules. Enrollment fixes the timezone and requires sufficient unfinished missions. Demo commands use the existing browser write lock; account commands call the uniquely named `join_reading_challenge()` RPC. No render/read operation awards XP.

The eleventh migration adds `user_reading_challenges` (owner/session SELECT only, profile cascade, no direct mutations), updates the profile timezone guard and adds a private reward reconciler. Explicit completion and restore reconcile seven distinct mission dates under the existing profile lock, awarding a unique 100 XP key on the seventh date. Snapshots include optional `challengeStarts`; restore validates the bounded merged period union before any activity writes and reconstructs rewards from trusted merged mission records. Legacy files preserve destination periods. A conflicting backup displays an error and blocks confirmation; destination state is revalidated on the server to handle concurrent changes. See [calendar rules and browser checks](READING_CHALLENGES.md).

## Private fellowship groups

Community now mounts the account-only fellowship client after the journey profile is initialized. Demo mode renders account requirements without network sharing or simulated members. `/api/fellowship` verifies caller/session, exact write Origin, streamed 4 KiB bounds and a strict consent-aware command union. A separate response schema allows only bounded group/name/rounded participation data, with current invitations, replay IDs and member-management IDs limited to owners. Requests are private/no-store; errors use allowlisted domain messages and privacy-safe operational references.

The client serializes reads/actions, refreshes on focus or explicit Check saved groups and never automatically replays writes or stores group data/invitations in web storage. A pending create retains its request ID and payload in tab memory until confirmed, so a lost response can be recovered or retried without duplicate creation. Group actions have role-specific controls and explicit close/leave/remove/rotate confirmation; closing requires typed confirmation.

The twelfth migration reuses groups/memberships, adds sharing-consent timestamps and private invitation/replay tables, and exposes caller-only read/manage routines. Every mutation locks caller profile then target group; invitations are rechecked after the group lock, and capacity/owner checks happen before writes. Safe domain denials return allowlisted error codes so failed invitation attempts commit admission charges. Get/command results share the existing read/write limits. Only consented members appear in alphabetical summaries; private journey tables retain their existing RLS.

Version 1 snapshot exports include optional own-membership metadata without other member summaries/invitations. Restore excludes it from its command, so a personal file cannot grant group access. Owner account deletion closes owned groups via existing cascades; the review UI explains this. See [FELLOWSHIP_GROUPS.md](FELLOWSHIP_GROUPS.md).

## Versioned reading schedules

The application resolves `canonical-v1` (legacy default) or `balanced-v1` from snapshot `readingPlan`. Dashboard missions, active-plan lists, reader mission navigation, quiz menus and context links use this identity. Canonical `PLAN` remains exported for legacy fixtures. `selectPlan` is a separate explicit command, not an implicit preference change. The demo applies the same activity guard under its browser write lock; the account RPC validates a published allowed version and holds the caller profile lock before checking activity and updating the plan. A stale selection returns an allowlisted conflict rather than resetting progress. No mid-journey switch or automatic backup-based selection exists.

Backup normalization preserves plan identity and rejects mismatches in the browser and PostgreSQL before activity writes. Legacy absence means canonical v1. Restore rederives mission rewards against the selected assignments, using legacy canonical keys and plan-qualified Balanced keys. Question identity stays global; source chapters determine schedule placement. See the [schedule provenance](CONTENT.md#balanced-daily-journey-v1) and [manual checks](FEATURE_ROADMAP.md#browser-validation-without-developer-tools).

## Editorial preview boundary

Chronological preview data lives outside active `PLAN_IDS`. The draft service expands explicit source segments, verifies 1,189 unique valid references, generates 365 whole-chapter readings and attaches context/note IDs. The catalogue's `PreviewPlanId` permits `chronological-draft-v1` for display, while `PlanId`, journey command/state schemas and restore continue to accept only Canonical/Balanced v1. The draft branch renders no selection form. Both chronological IDs are rejected in application validation; the unchanged database allowlist also excludes them.

Week selection and notes are component state only. The download helper accepts no personal journey state and emits a public review object with a distinct `kind`; personal restore rejects it. Source links open normal reader context and can update the caller's reading position only when explicitly followed. No new route, server API, dependency, migration or active reading identity is added. Editorial limitations and sources are documented in [CONTENT.md](CONTENT.md#chronological-journey-editorial-draft).

## Private verse annotations

Optional snapshot `verseNotes` contains saved personal text/update time per saved reference. `verseNote` commands carry the reference, nullable desired text and expected saved text; production uses the authenticated `set_verse_note` RPC and demo performs the same optimistic comparison inside its browser write lock. Neither command awards XP. Removing a note-bearing reference is rejected. The reader and collection guide users to delete notes explicitly first.

`VerseNoteDraftProvider` sits in the journey layout beside journal drafts. Drafts retain their original saved-text base across navigation/filtering; editors review a newly loaded version before rebasing, and SQL rechecks that base before writing. Request success clears only the captured draft object, protecting later typing. Removed references leave an accessible draft/re-save path. Drafts never enter saved snapshots, exports, URLs or web storage. Normalized backup merges include note text only, with destination conflict precedence and trusted new timestamps. Scripture rendering and fellowship summaries are unchanged.

## Private prayer tracking

The protected `/prayers` page uses the existing demo/account command queue and optional version 1 `prayers` snapshot. Request UUIDs are caller-scoped; version UUIDs are minted by the destination. A strict `prayer` command carries a request identity, save/follow-up/delete intent and expected revision. Account writes use `mutate_prayer`, and demo uses the same optimistic intent rules under its existing Web Lock. No journal or reward command is invoked.

`PrayerDraftProvider` belongs to the journey layout. Drafts retain their version base, stable follow-up identity and text only in memory. Conflict review explicitly rebases; SQL checks again before commit. Success clears only the captured object, so later request edits remain. Deleted saved requests do not silently reappear: recovery uses an explicit new UUID. Filters/search operate on the saved snapshot without URL or request-query persistence. Exports carry saved requests; restore normalizes content and preserves existing whole destination requests.

## Reading rhythm and catch-up

`nextUnfinishedMission` selects the earliest unfinished mission in the active schedule and its first unread chapter. Dashboard and My Reading Plan share the same consistency component. Completion still uses ordinary chapter commands and today's actual date. `readingRhythm` bridges actual mission dates with optional grace dates for display, counting real reading days and grace dates separately. Existing achievement and seven-day challenge services continue to use actual mission dates only.

The strict `grace` command carries a captured ISO date. Demo claims merge under the existing Web Lock; account claims use the live actor/profile lock and database-derived yesterday. Identical committed dates are no-ops. The UI resets transient confirmation on route hiding, disables stale confirmations and recovers uncertain writes through the existing saved-progress read. Optional version 1 `graceDates` is merged under explicit spacing, preceding-reading and destination-history rules, with no restored reward assertions.

## Reader presentation preferences

`components/bible/reading-preferences.ts` exposes a shared `useSyncExternalStore` snapshot with a stable server default. Browser storage is read after subscription rather than during server rendering. The separate `faithquest365.reader-preferences.v1` record accepts only version 1 and the two allowlisted enum choices, bounded to 1,024 characters. A storage event rereads the current value, so delayed events cannot reinstate an earlier value. Invalid records remain untouched until an explicit change/reset; blocked writes publish usable in-memory preferences and visible failure feedback. The store lasts for the page visit, retaining choices when routes are hidden or remounted.

`ReadingComfort` provides labelled native selects and reset; `ChapterText` maps their values to CSS data attributes. Inline verse paragraphs inherit the selected line height. No source text, journey snapshot, export, command, account identifier or database schema contains these preferences. The device-wide behavior is stated beside the controls and in [the browser guide](READING_COMFORT.md).
