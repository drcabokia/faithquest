# Authenticated Supabase integration

## Implementation and release state

The code includes cookie-based Supabase SSR clients, a Next.js `proxy.ts` session-refresh boundary, Google OAuth start/callback/sign-out handlers, an authenticated journey API, a Supabase command adapter, and a separate account provider. Account progress and journals never fall back to localStorage or automatically import demo records. Quiz prompts contain no solutions; a submitted attempt carries its reviewed feedback. Account achievement IDs come from PostgreSQL.

**Production account access is disabled by default.** The selected project URL is `https://uiozbdsimvsvxjpalsro.supabase.co`. The publishable key is configured locally and the project is reachable. Its public auth settings currently report Google disabled; the expected reference-book catalogue is unavailable. Hosted migrations and real session/cross-device behavior have not yet been verified from this workspace. Connecting Supabase to GitHub alone does not provide a database connection or an application publishable key.

## 1. Supply development access

Connect the Supabase integration to the selected development project, or configure a direct/pooler development connection locally. The ignored `.env.local` already contains the public project URL and closed release flags. Add the publishable key from the project's API Keys settings:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://uiozbdsimvsvxjpalsro.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
FAITHQUEST_STORAGE_MODE=demo
FAITHQUEST_ACCOUNTS_ENABLED=false
FAITHQUEST_APP_ORIGIN=http://127.0.0.1:3000
SUPABASE_PROJECT_REF=uiozbdsimvsvxjpalsro
```

For CLI migrations, additionally set `DATABASE_URL` to the development project's connection string from its Connect dialog, with its password entered locally, and `FAITHQUEST_DATABASE_IS_DEVELOPMENT=true` only after confirming the target is a development project. A direct host or the pooler username must identify the selected project reference. The runtime application does not use a database password or service-role key. Never place a privileged key in `NEXT_PUBLIC_*`, Git, chat, screenshots, or logs.

## 2. Apply and verify database migrations

The first two migrations prepare the schema and complete canonical reference data. Migration 003 removes direct profile/journal writes, validates/fixes journey timezone/plan after activity, and adds authenticated transactional commands. Migration 004 adds the six reviewed questions and private solutions.

```powershell
npm run test:database
npm run db:migrate
npm run test:database:live
npm run supabase:check
```

The migration runner checks project identity and history, holds a migration lock, and applies missing versions atomically. It refuses unknown remote versions or untracked existing profiles rather than resetting tables. Review/reconcile already applied migrations before retrying any conflict. It never runs a database reset.

The live database test creates two synthetic auth/profile fixtures inside a transaction, tests private-table isolation, protected writes, and valid rewards, and rolls back the fixtures. It uses database roles and simulated JWT claims, not Google logins, so it cannot establish OAuth/session correctness. Embedded PGlite tests execute the same migrations in PostgreSQL with a minimal test `auth.users`/`auth.uid()` setup; they are not a substitute for the hosted run.

## 3. Configure development Google sign-in

In Google Auth Platform, use a Web OAuth client with the minimum `openid`, email, and profile scopes. Add the canonical local origin. Its authorized redirect URI is the Supabase project's callback URL, obtained from Supabase Authentication → Providers → Google. Put the Google client secret in Supabase's provider settings, not this application.

In Supabase Authentication URL Configuration, allow the exact application callback `http://127.0.0.1:3000/auth/callback`, and use the same canonical origin in `.env.local`. Add a future production callback separately when that deployment is authorized. Use development/test audiences while validating. The application ignores arbitrary caller-supplied redirect targets.

After hosted migration/isolation checks and Google setup pass, development-only interactive testing can use:

```dotenv
FAITHQUEST_STORAGE_MODE=supabase
FAITHQUEST_ACCOUNTS_ENABLED=true
```

Restart the development server after environment changes. Always use the configured canonical hostname; `localhost` and `127.0.0.1` have different cookies/origins. A malformed storage mode fails closed. Merely adding keys does not activate accounts. Keep production deployment flags false until all acceptance checks below pass.

## 4. Required live acceptance

- Sign in with test Google user A. Read all three chapters of day 1; earn 50 XP once. Repeat/refresh the request; the ledger remains unchanged. Save/edit a reflection; earn 20 XP once. Submit correct/wrong quizzes and verify attempts cannot be replaced for XP.
- In an independent browser profile, sign in as test user B. A's journal, progress, attempts, XP, and achievements must not be visible. Requests containing a forged user ID or XP amount must fail. Group membership must never reveal journals.
- Sign in as user A on another device/browser. The same server progress and journal should load without copying localStorage. Return focus to the first browser and check refreshed state.
- Leave a test session through access-token expiration and verify renewal, refreshed cookies, and private/no-store data responses. Also revoke/end a session and verify subsequent data requests require sign-in.
- Sign out on one device, reload, and verify account routes return to login and private state disappears from the app. A rejected OAuth callback must never enter the app or redirect to an arbitrary origin.
- Temporarily interrupt connectivity. The account UI must show a retryable error and must not claim a local save. A server commit followed by a lost response is resolved through refresh/idempotent retry.

Do not claim these live checks passed based on mocked SDK tests. Google consent and real device/session checks remain a release gate. Account deletion/operational backup and rate-limit design still require a production release review.

## Security model

The server verifies identity on every journey API request. PostgreSQL independently derives the actor from `auth.uid()`; command signatures accept no user ID, XP amount, completion date, or unlocked badge. Per-user row locks and unique reward keys serialize/reject duplicates. Day completion requires all assigned chapters. Private quiz solutions are read only by the trusted function. Personal tables retain RLS for direct reads; helper execution is revoked from client roles. Mutation requests require the configured Origin, bounded JSON bodies, and strict Zod validation. Database error details are not returned to browsers. Auth/data responses are not shared-cacheable.

Current implementation guidance: [Supabase SSR clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs&package-manager=npm), [Google sign-in](https://supabase.com/docs/guides/auth/social-login/auth-google).
