# GitHub to Vercel deployment

## Current state

The demo builds as a standard Next.js application without credentials, a custom server, Docker, or paid services. The Git remote is `https://github.com/drcabokia/faithquest.git`. Milestone commits exist locally; the initial push received HTTP 403 because the active account `drchristinelsk` lacks write access. No Vercel/Supabase account was created and nothing has been deployed.

## 1. Publish the Git history

Grant the current GitHub account write access to the repository, or authenticate Git with an account that has permission. Do not use recovery codes as development credentials or commit them. Then run:

```powershell
git push -u origin main
```

The `.gitignore` excludes local environment files, recovery-code files, the original local brief, browser artifacts, and download caches. Review staged files before every push. The supplied repository was empty when inspected; never force-push over later remote changes. If someone adds remote commits, fetch and reconcile them first.

## 2. Import into Vercel

1. Sign in to your Vercel account and choose **Add New → Project**.
2. Connect the GitHub account and authorize access to `drcabokia/faithquest`.
3. Import that repository, select **Next.js**, and keep the repository root as the root directory.
4. Select Node.js 22.x or a newer supported version compatible with package.json. Use `npm ci` as the install command and `npm run build` as the build command; use the default Next.js output settings.
5. Leave environment variables empty for the demo. Deploy.
6. Open the returned HTTPS address and run the acceptance flow in README. A new deployment URL/origin has separate demo browser data.
7. Pushes to `main` trigger production deployments; pull requests receive previews according to your project settings. The included GitHub workflow runs lint, types, tests, build, and browser checks once pushed.

No custom Vercel configuration is required. Stop any preview sharing if you do not want others to access the demo. Visitors each get their own browser-local data; there is no shared user database.

## 3. Stay within free-tier limits

Vercel Hobby is for personal, non-commercial use under its [terms](https://vercel.com/legal/terms). Its [plan documentation](https://vercel.com/docs/plans) says Hobby projects can be paused when included usage is exceeded. Monitor the current [limits](https://vercel.com/docs/limits) and dashboard rather than treating free hosting as unlimited. Reassess eligibility before church-wide, organizational, sponsored, or commercial operation.

Supabase is optional for this demo. A later production integration can start on [Supabase Free](https://supabase.com/pricing). It has database/storage/egress/auth limits, and free projects can be paused after low activity across a seven-day period; see the [pausing policy](https://supabase.com/docs/guides/platform/free-project-pausing). Account for pauses, quotas, backups, recovery, and availability before relying on it for ongoing user journals. Recheck both providers’ current terms and quotas at launch.

The USD 0/month target is conditional on personal/non-commercial eligibility and staying within quotas. Do not enable paid add-ons or AI APIs by default.

## 4. Future Supabase integration

Read AUTH_AND_SECURITY.md before activating production mode. Creating a project and configuring Google OAuth require your accounts and credentials. Apply and test migrations in a development project first. Environment variables belong in local `.env.local` and Vercel project settings, never in Git. The example keys are documentation only; adding them does not enable live authentication.

Only Supabase URL and publishable key may be exposed through `NEXT_PUBLIC_*`. Privileged server credentials must remain server-only. Set exact localhost, preview (only where needed), and production redirect allowlists. Authenticated production writes must go to Supabase; never fall back silently to demo storage or temporary Vercel files.

## Recovery

Keep Git history and private journal backups. Use Vercel’s deployment history to roll back application code if needed. Database migrations require their own tested backup/rollback plan; do not assume rolling back the application reverses a migration.
