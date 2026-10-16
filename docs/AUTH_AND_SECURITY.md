# Production authentication and security plan

## Honest release boundary

The working application is a browser-local demo. Supabase/Google sign-in is not connected. Migrations and TypeScript contracts prepare the next phase; they do not constitute an audited production authentication service. Adding environment variables alone changes nothing.

## Integrate in order

1. Create a development Supabase project under the user’s account. Configure Google OAuth with an owned Google Cloud client, exact callback URLs, and appropriate consent settings. Gmail users sign in through Google OAuth; the app must never collect Google passwords.
2. Install compatible Supabase client/SSR packages when implementing the live adapter. Use request-scoped server clients, verified server sessions, secure cookie handling, and validated OAuth callback redirects.
3. Apply `202610160001_initial_schema.sql`, then `202610160002_reference_data.sql`, in development. The second migration seeds all books, chapters, 365 reading days, 1,189 assignments, and eight achievement definitions. Production quiz seeds and private answer keys still require a reviewed release process.
4. Implement `ProductionJourneyRepository` with async server commands. Never accept a user-supplied reward amount, correct-answer flag, achievement unlock, completion date, or arbitrary snapshot as authoritative state.
5. Implement transactional activity functions with a fixed search path. Verify `auth.uid()` inside each function; confirm all assigned chapters before completing a day, validate quiz answers against `private.quiz_answers`, validate reflection ownership/content, derive activity dates in the stored timezone, then insert the ledger and unlock milestones in the same transaction. Unique user/activity keys handle retries/concurrency. Add row/advisory locking where needed. Revoke PUBLIC execution and grant only the specific authenticated commands after review.
6. Enforce IANA timezone validity and immutability after activity in a database trigger or trusted preference command; update RLS/grants to prevent bypass through direct profile updates. Never rely only on the demo UI’s timezone lock. Only allow published plans.
7. Add database tests using two independent users and anonymous access. Verify private reflections, progress, attempts, XP, answer keys, group data, writes, deduplication, concurrent submissions, account deletion, and every RPC ownership check.
8. Configure backup/export/delete flows, environment-specific OAuth allowlists, rate limits, sanitized operational errors, and monitoring. Release production mode only after these gates pass.

## Prepared schema controls

RLS is enabled on all public tables; only published plan data/reviewed questions and reference catalogues have public read access. Profiles and reflections use owner-only policies. Progress, attempts, XP, and unlock tables have owner reads and no authenticated client writes. Quiz answers live in a private schema with client access revoked. Groups have owner/member reads but no open join/promote operation. Reflections have no group-sharing policy.

The migration intentionally grants direct owner-only reflection CRUD as a persistence preparation option. Awarding reflection XP must still happen through the later trusted command, which verifies a qualifying persisted entry and handles duplicates. Revisit grants when the final RPC approach is implemented.

## Demo privacy and persistence

Demo content belongs to a browser profile/origin, not a signed-in person. It is not encrypted, synced, or protected from someone with access to that browser. Version/schema validation catches malformed data but is not tamper resistance. Local quiz keys are inspectable. Export is explicit; no automatic upload/import or journal sharing occurs. Storage errors do not claim that a write succeeded. Multi-tab writes use Web Locks where available, with a latest-snapshot fallback for browsers without them; that fallback is not transactional.

A live authenticated repository must never silently save to localStorage when a Supabase operation fails. Never use Vercel temporary files for journals or progress. No service-role key belongs in a browser bundle or a `NEXT_PUBLIC_*` variable. All paid AI integration remains absent until explicitly designed and enabled.
