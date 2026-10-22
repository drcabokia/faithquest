# Public information website and Google branding

The public information site is separate from the protected application. It contains only a homepage describing FaithQuest365, Privacy Policy, Terms of Service and brand assets. It has no sign-in handler, account API, application bundle, database configuration, tracking script or environment variables. The application at `https://faithquest365-testing.vercel.app` retains Vercel Authentication for All Deployments.

## Public identity and links

The owner supplied **Titanium Overcomer** as the operator and **drchristinelee@gmail.com** as the public contact. `src/content/site.json` holds those details and the two deliberate origins. `src/content/legal.json` is the single source for both the app's legal routes and the static public documents.

Use these values in Google Auth Platform → Branding → App domain after the public deployment is verified:

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

Local static browser checks passed at 1440 px and 320 px for all three pages, including logo loading, no horizontal overflow, keyboard navigation to Privacy Policy, working contents anchors, zero script requests and 404 responses for account/private paths. The Vercel dry-run manifest contains exactly eleven files, about 56 KB, with no environment or application files. Hosted verification and protected-app link rollout are recorded after publication.
