# Authentication and security

## Release boundary

The default running application remains a labelled browser-local demo. Authenticated Supabase integration is implemented behind explicit storage/account flags. A reachable project and publishable key alone do not activate accounts. Hosted migrations, real OAuth, renewal and cross-device privacy remain unverified; production accounts stay disabled until those acceptance gates pass. See [the development runbook](SUPABASE_INTEGRATION.md).

## Verified identity and commands

Separate browser/server Supabase clients use cookie-based SSR. Next.js `proxy.ts` refreshes sessions with `getClaims()` and carries refreshed cookies through redirects. The journey API independently calls `getUser()` before every read/write. OAuth callback code exchange is followed by verified user lookup; redirects use the configured canonical origin rather than caller-supplied targets. Sign-out affects the current device. Mutation endpoints require the exact configured Origin and bounded, strictly validated JSON.

Database commands derive their actor from `auth.uid()`, lock the profile row and execute atomically with a fixed search path. Clients supply an activity, not an authoritative snapshot, user ID, XP amount, completion date or achievement list. Reading rewards require all assigned chapters; book, quiz and reflection rewards have stable unique keys. A wrong first quiz attempt cannot become a correct rewarded retry. Activity dates use PostgreSQL's saved IANA timezone. Timezone/plan changes are prohibited after activity.

The first two migrations create schema/RLS and complete reference data. Migration 003 adds trusted commands and revokes direct profile/reflection writes. Migration 004 seeds six reviewed quiz prompts and private solutions. Personal tables expose owner-only reads. Client roles cannot execute private helpers or read answer keys; submitted attempts expose their own feedback. Group membership does not grant journal access.

## Persistence and errors

Authenticated progress and journals are database-backed. The account provider neither writes personal snapshots to localStorage nor silently falls back to demo storage. It does not automatically upload existing demo journals. Requests and OAuth responses use private/no-store cache controls; account data is fetched per verified session. Database error details are sanitized. After a lost response, refresh or an idempotent retry resolves whether an activity committed.

A Supabase publishable/legacy anon key is suitable for the client. A database password or secret/service-role key must never be placed in `NEXT_PUBLIC_*`, committed, or shared in chat. Google client secrets belong in Supabase provider configuration. The runtime does not need privileged database credentials. CLI migrations/live tests require a separate explicitly confirmed development connection and verify its project reference.

## Validation and remaining gates

Embedded PostgreSQL tests execute all migrations and test two identities, anonymous access, direct-write restrictions, rewards, quiz secrecy, achievements and group/journal isolation. HTTP/session tests mock the SDK to exercise verification, Origin checks, command validation, redirects, refresh-cookie propagation and sign-out. Neither test layer proves hosted Google login, token expiration or device synchronization.

Before production accounts: apply/test migrations on the selected development project; verify Google consent/callback settings; complete real login/logout and session-renewal checks; verify independent-user journal isolation and cross-device persistence; review account deletion, backup, rate limits and operational monitoring. The live database script uses synthetic fixtures inside a rolled-back transaction, without deleting existing users.

## Demo privacy

Demo data belongs to a browser profile/origin, not a signed-in person. It is not encrypted or synchronized and is accessible to someone with access to that browser. State validation is not tamper resistance; demo quiz solutions are inspectable. Multi-tab writes use Web Locks where available, with a latest-snapshot fallback elsewhere. Export is explicit and no automatic import or sharing occurs. Paid AI remains absent.
