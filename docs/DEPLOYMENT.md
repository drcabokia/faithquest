# Vercel external testing and deployment

## Readiness review — 22 October 2026

Vercel is suitable for a small, access-controlled external test release after configuration and the owner checks below. This is a staging recommendation, not approval for a public production launch. No deployment, Git push, provider configuration change or paid service was performed during this review.

Verified evidence:

- The latest UI candidate is local commit `43016e3`, following dashboard/settings commit `5daf07f`. Neither is on remote `main` yet. Remote `main` remains `73b530658b3bead1dbe94255994d9b9d4413a712`; its latest [GitHub validation passed](https://github.com/drcabokia/faithquest/actions/runs/39734179784).
- The candidate passed 255 automated tests, lint, application/Edge type checks, production builds in both modes, and 21 unique targeted browser checks (12 isolated account and nine production-demo scenarios). These checks do not establish deployed Google OAuth or complete user acceptance; see [validation evidence](VALIDATION.md).
- A fresh `npm audit --omit=dev --audit-level=high` reports zero runtime dependency vulnerabilities. This does not cover development dependencies or establish application security.
- Read-only Supabase checks report the existing development project as `ACTIVE_HEALTHY`, PostgreSQL 17.11, with all nineteen migrations applied through `20261022054818_journal_save_protection`.
- Security advisors retain the previously reviewed 18 authenticated command-definer warnings, four private RLS/no-policy information findings and the existing leaked-password-protection warning. These are not a clean security sign-off; the intentional command/private-table design and controls are documented in [security guidance](AUTH_AND_SECURITY.md).
- This workspace has no `.vercel/project.json` link. The owner's Vercel settings, plan, access protection and hosted callback behavior have not been inspected.

The earlier demo-only deployment instructions are superseded by this guide. The authenticated integration is implemented and enabled locally; deployment variables must select the intended mode explicitly.

## Recommended test setup

Use a dedicated Vercel testing project with one stable HTTPS hostname and a small group of invited testers. A purchased domain is unnecessary: Vercel [assigns a `.vercel.app` domain](https://vercel.com/docs/domains/working-with-domains). Its Production environment/domain can serve this staging project; that Vercel label does not mean FaithQuest is approved for public production use.

Initially use disposable accounts and sample reflections/prayers. The existing Supabase development project contains saved account data; pointing Vercel at it shares the same backend, not an isolated copy. Use a separate Supabase staging project if tester activity must be isolated from existing accounts. Provisioning a backend is a separate task; never reset or copy existing private data for convenience.

Configure [Deployment Protection](https://vercel.com/docs/deployment-protection) for **All Deployments**, including the stable project domain. Standard Protection excludes production domains, so protecting previews or privately sharing an ordinary URL does not restrict that domain. Arrange approved tester access and check the Google callback from the protected hostname before sharing.

[Vercel Authentication](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication) is available on all plans, but Hobby currently permits only one granted external user per account. [Shareable links](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/sharable-links) are another access method; Hobby currently allows one per account. Anyone holding a link can use it, so it is not a named-user allowlist. Keep access links private and revocable. Do not enable paid protection or change plans without the owner's instruction.

FaithQuest's Google sign-in and private-row controls remain necessary behind Vercel protection. Vercel protection does not restrict direct access to the separately hosted Supabase API or create a Supabase signup allowlist.

## Publish the candidate and configure Vercel

1. Publish the reviewed feature branch and open a pull request to run GitHub validation. The workflow runs on pull requests and pushes to `main`; a feature-branch push alone does not trigger it. Use the exact validated commit for deployment. Publishing/merging remains separate from this readiness review; never force-push or assume the older `main` includes the latest UI.
2. Align the runtime before deployment: GitHub CI currently uses Node.js **22**, while `package.json` and the lockfile allow `>=22.12.0`. Vercel can resolve that broad range to **24.x**, overriding a dashboard choice of 22.x. Pin both root engine declarations to the tested 22.x line, or deliberately validate and align CI with 24.x. This review leaves package configuration unchanged. Confirm the actual version in the deployment build log; see [Vercel's engine precedence](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).
3. Import `drcabokia/faithquest` into the dedicated Vercel test project. Select **Next.js**, repository root, the validated Node.js version, `npm ci` for installation, `npm run build`, and default Next.js output settings. No Docker, custom server or custom Vercel configuration is required. Select the intended validated branch/commit and review automatic deployment settings.
4. Obtain the actual stable project hostname and configure access protection before enabling account testing. An initial browser-only demo can establish the hostname while accounts remain disabled. Hostname examples below are placeholders, not an existing deployment or reserved name.
5. Set these variables in the environment used by the stable test deployment, then redeploy. Local `.env.local` is not uploaded. Scope account-enabled values to the intended environment; unrelated previews should remain demo/disabled unless separately configured and checked.

| Variable                               | Authenticated test value                                     |
| -------------------------------------- | ------------------------------------------------------------ |
| `FAITHQUEST_STORAGE_MODE`              | `supabase`                                                   |
| `FAITHQUEST_ACCOUNTS_ENABLED`          | `true`                                                       |
| `FAITHQUEST_APP_ORIGIN`                | `https://<chosen-test-host>.vercel.app`                      |
| `NEXT_PUBLIC_SUPABASE_URL`             | URL of the deliberately selected development/staging project |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | That project's publishable key                               |

Only the Supabase URL/publishable key belong in `NEXT_PUBLIC_*`. Never upload a service-role key, secret key, database password or Google client secret to the frontend. The Next.js runtime needs no privileged database credential; the account-deletion Edge Function uses its existing Supabase-hosted credentials. Migration-only variables such as `DATABASE_URL` are unnecessary for Vercel runtime deployment.

### Use one exact origin

The app's `appOrigin()` accepts one canonical origin. Google sign-in and account mutation routes compare the request Origin with `FAITHQUEST_APP_ORIGIN`. Using another deployment URL can produce HTTP 403, and OAuth returns to the configured host. Do not solve this by trusting arbitrary forwarded hosts or allowing every Vercel preview.

Use the same stable hostname for browser access, environment configuration, OAuth return and testing. Public Next.js environment variables are included in the build, so environment changes require a new deployment. If the hostname changes, update its configuration and exact callback allowlist together and repeat the checks.

## Supabase and Google configuration

In the selected project's Supabase Authentication URL Configuration:

1. Set **Site URL** to the stable HTTPS test origin when the project is deliberately used for hosted testing.
2. Add exactly `https://<chosen-test-host>.vercel.app/auth/callback` to **Redirect URLs**. Retain the existing localhost callback when local development still uses the project.
3. Keep redirect paths exact for the fixed test hostname; broad `*.vercel.app` allowlists are unnecessary. Supabase [requires `redirectTo` to match the allowlist](https://supabase.com/docs/guides/auth/redirect-urls).

Google's OAuth redirect URI remains the selected Supabase project's callback, **not** the Vercel application callback. When reusing the current development project it remains:

```text
https://uiozbdsimvsvxjpalsro.supabase.co/auth/v1/callback
```

A separate Supabase project has a different callback and needs deliberate provider configuration. Keep the Google client secret in Supabase. Confirm the OAuth app's audience/test-user settings permit the invited accounts; another Google account may not be allowed just because the owner's account works. Public Google branding/domain verification remains a later release task.

## Owner checks before inviting testers

Use the stable deployed hostname, fresh browser sessions, sample content and disposable accounts. Confirm access is blocked without the intended Vercel permission/link, and approved access survives the Google round trip.

1. **Sign-in and persistence:** sign in, save a completed chapter and sample reflection, reload, sign out and sign in again. Confirm saved data returns. Check account mode rather than browser-only demo mode.
2. **Two-account privacy:** use separate browser profiles/devices for two accounts. Confirm each sees only its own journal, prayers, notes, saved verses and export. Test private group membership separately with explicit consent.
3. **Recovery and conflicts:** exercise offline/online retry, Check saved progress, two-tab journal/note conflicts and export/restore with a private test backup. Follow [integration](SUPABASE_INTEGRATION.md), [journal](JOURNAL_TOOLS.md), [study](STUDY_TOOLS.md) and [backup](BACKUP_AND_RESTORE.md) guides. Never replay uncertain writes automatically.
4. **Real sessions and deletion:** finish token-expiry renewal and all-device sign-out/revoked-session checks on the hosted origin. Verify deletion only with a disposable account after exporting its sample data. Record results without cookies, tokens, personal text or exported files in public reports.
5. **UI and service health:** check dashboard rhythm, reading settings, compact prayer/saved-verse flows and practice on a phone. Check `/api/health` and Profile's account connection control, and review sanitized hosting errors/usage. A healthy response alone does not establish OAuth/session acceptance.

Complete the owner sign-in/privacy smoke checks before adding more testers. The closed test can then finish the remaining hosted renewal, revoked-token and committed-save/lost-response cases; deployment and mocked browser checks do not close those gates. Until recovery operations are established, keep the pilot to sample data and make explicit private personal exports.

## Public-release gates still open

- Remaining real session, revoked-token, committed-save/lost-response and disposable-account deletion acceptance, with recorded outcomes.
- Automatic encrypted off-site backups and a whole-project recovery rehearsal. Journey JSON exports do not recover Auth identities, provider settings or the entire service.
- Operational abuse protection, monitoring/alert delivery, log-retention decisions, usage limits and a support process.
- Independent editorial review for additional quizzes and Balanced. Chronological remains preview-only.
- Public privacy information, Google branding and eventual domain/public-site arrangements. No privacy/terms page is currently implemented in the app.

Pending real-user feature acceptance remains separate from this review. See [implementation status](IMPLEMENTATION_STATUS.md), [security](AUTH_AND_SECURITY.md) and [content provenance](CONTENT.md).

## Browser-only demo option

For external layout/reading feedback without real accounts, explicitly set `FAITHQUEST_STORAGE_MODE=demo` and `FAITHQUEST_ACCOUNTS_ENABLED=false`. Supabase credentials are unnecessary. Each browser/origin has independent local data; Google accounts, cross-device persistence and private fellowship groups cannot be evaluated. A new origin does not inherit localhost demo data. Review access protection before sharing either mode.

## Cost and recovery

[Vercel Hobby](https://vercel.com/docs/plans/hobby) is limited to personal, non-commercial use and included quotas. Confirm eligibility and actual account limits; do not assume organizational/church-wide operation qualifies or enable paid add-ons by default. [Supabase Free](https://supabase.com/pricing) also has usage, availability and backup limits; verify the selected project's actual plan and [pausing policy](https://supabase.com/docs/guides/platform/free-project-pausing).

Keep Git history and private test exports. Vercel application rollback does not reverse database migrations. This testing release needs no new migration; future database changes need their own reviewed backup/recovery plan.
