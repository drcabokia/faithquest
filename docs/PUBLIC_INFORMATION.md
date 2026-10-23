# Public information website and Google branding

The public information site is separate from the protected application. It contains only a homepage describing FaithQuest365, Privacy Policy, Terms of Service and brand assets. It has no sign-in handler, account API, application bundle, database configuration, tracking script or environment variables. The application at `https://faithquest365-testing.vercel.app` retains Vercel Authentication for All Deployments.

## Public identity and links

The owner supplied **Titanium Overcomer** as the operator and **drchristinelee@gmail.com** as the public contact. `src/content/site.json` holds those details and the two deliberate origins. `src/content/legal.json` is the single source for both the app's legal routes and the static public documents.

Use these values in Google Auth Platform → Branding → App domain. All three were verified anonymously after deployment:

| Google field                      | Value                                           |
| --------------------------------- | ----------------------------------------------- |
| Application home page             | `https://faithquest365-info.vercel.app/`        |
| Application privacy policy link   | `https://faithquest365-info.vercel.app/privacy` |
| Application terms of service link | `https://faithquest365-info.vercel.app/terms`   |

The name is **FaithQuest365**. Google still controls brand/domain verification and publishing; creating these pages does not guarantee approval. A `.vercel.app` hostname does not remove Google's ownership checks. Keep the existing Google-to-Supabase OAuth callback and protected app origin; this information website performs no OAuth itself.

The policies describe the current implementation and test release, including basic Google identity data, private content and optional fellowship participation, providers, international processing, browser/session storage, drafts, exports, deletion and support. They do not promise end-to-end encryption, immediate removal from all provider backups/logs, or guaranteed recovery. The operator must keep the text accurate as the service changes and assess any jurisdiction-specific legal requirements before a wider launch.

## Logo files

The identity extends the repository's existing open-Bible, path and star SVG design. It uses deep green `#184f3c`, cream `#fffaf0` and gold `#ddbc69`. No image-generation service or paid design service is involved.

- `public/brand/faithquest365-mark.svg`: editable square mark, also used by the app header and favicon.
- `public/brand/faithquest365-wordmark.svg`: editable mark and FaithQuest365 wordmark.
- `public/brand/faithquest365-logo-120.png`: Google's recommended 120 × 120 square upload, below 1 MB.
- `public/brand/faithquest365-logo-512.png`: larger square PNG for reuse.

Run `npm run build:brand` after editing the mark to regenerate the PNGs and wordmark. This uses the installed Sharp dependency. Commit the selected exports with the source SVG.

## Build and deploy

Run `npm run build:public-site`. The build reads only the shared public JSON and named brand assets; it never loads `.env` or imports the application. It validates operator/contact details and exact HTTPS origins, rejects unexpected stale artifact files, and writes eleven files to ignored `.cache/public-information-site`. CI also runs this build. Its generated `vercel.json` uses clean URLs, blocks scripts/network connections with CSP, and supplies security headers. Unknown paths have no application fallback.

The dedicated static Vercel project is `faithful-seeds/faithquest365-info`. Its framework is Other, with no install/build command or account environment. Standard Vercel protection leaves its stable Production domain publicly accessible and protects generated deployment/preview URLs. This setting applies only to the information project. No protection exception or setting change is needed on the authenticated testing project.

Inspect the exact artifact with the pinned Vercel CLI's `deploy --dry --json`, selecting this project explicitly. Deploy only `.cache/public-information-site`, never the repository root or authenticated source. Do not copy privileged keys, account exports, recovery files or protection bypass links into it.

## Validation

Local static browser checks passed at 1440 px and 320 px for all three pages, including logo loading, no horizontal overflow, keyboard navigation to Privacy Policy, working contents anchors, zero script requests and 404 responses for account/private paths. The Vercel dry-run manifest contains exactly eleven files, about 56 KB, with no environment or application files. Six additional checks on the production account-mode app verified anonymous legal/login rendering, mobile layout, client navigation and no journey requests on those routes. The original development server was not restarted; an attempted read-only localhost probe found it unavailable, so these app checks used a separate temporary production server on port 3196, which was stopped afterward.

The information site is published as deployment `dpl_6SWJntH5AoqNRr3t7EbJhHHRnjGT`, READY at `https://faithquest365-info.vercel.app`, from source `ce9b5a1a2deba70399e58badd1bc3f1ca4e9a5b8`. Anonymous HTTPS checks of the homepage, `/privacy`, `/terms` and both PNGs returned 200. Operator/contact text and script-free HTML were verified, along with the deployed CSP. The public project has zero environment variables. Its account, export, OAuth, dashboard and `.env.local` paths returned 404. The authenticated app's health URL still redirected anonymous visitors to Vercel authentication.

The Google-upload PNG is 120 × 120, 3,637 bytes. The larger PNG is 512 × 512, 20,400 bytes. Both are below Google's 1 MB limit.

The same source passed [GitHub CI](https://github.com/drcabokia/faithquest/actions/runs/39806256343): 255 automated tests, 107 browser tests, lint/application/Edge types, production build and the static information-site build. It is also deployed to the protected application as `dpl_NfTzwXsMttzv7baZvZafTDtg2rhq`, READY at `https://faithquest365-testing.vercel.app`, on Node.js 22.x. Authorized health, privacy, terms and login requests returned 200; operator/contact details, the Google form, policy links and the new logo path were verified. Export returned 401 without an application session. Anonymous privacy/terms/health requests on both its stable and generated domains redirected to Vercel authentication. No new Google sign-in or real-account data mutation was performed during this release; earlier owner sign-in evidence remains separate.

Both projects record the same source SHA and have no automatic Git connection. No database schema, Supabase/Google Auth configuration, session, paid plan or private-test protection setting was changed. `main` remains unchanged; source and publication records are on the feature branch/draft PR.

## Search Console ownership verification

The owner supplied a Google Search Console HTML verification tag for the URL-prefix property `https://faithquest365-info.vercel.app/` after Google's branding review requested ownership proof. Its public value is stored as `googleSiteVerification` in `src/content/site.json`. The static build validates the value and inserts the exact meta tag once near the start of the homepage's `<head>`. It is not a sign-in credential, analytics script or change to the protected app's authentication.

Keep the tag in future public deployments: Google periodically rechecks it. After the published tag is confirmed accessible without authentication, the owner must click **Verify** in Search Console. Only after Google confirms ownership should the owner start the **24-hour wait** requested by the branding review, then retry **Verify Branding**. Publishing the tag alone is not a claim of successful Search Console or OAuth brand verification. See [Google's HTML-tag instructions](https://support.google.com/webmasters/answer/9008080?hl=en).
