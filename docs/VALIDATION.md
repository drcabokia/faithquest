# Validation report

Executed locally on **16 October 2026**, Windows, Node.js 22.20.0. Browser checks used installed Microsoft Edge through Playwright, including a 390 × 844 mobile viewport and the Asia/Kuala_Lumpur timezone.

## Executed checks

| Check                  | Result                                                               |
| ---------------------- | -------------------------------------------------------------------- |
| `npm run lint`         | Passed, no errors or warnings                                        |
| `npm run typecheck`    | Passed, strict TypeScript                                            |
| `npm test`             | 20 tests passed                                                      |
| `npm run build`        | Passed; all 10 application routes plus the not-found route generated |
| `npm run test:e2e`     | 5 browser acceptance tests passed                                    |
| `npm audit --omit=dev` | 0 runtime dependency vulnerabilities reported                        |

Business/content tests cover the complete 365-day schedule, all 1,189 bundled chapter files, legitimate full-mission completion, book rewards, correct/wrong quiz answers, reflection edits, duplicate prevention, level thresholds, first/weekly achievements, calendar-day streaks, timezone midnight boundaries, leap days, daylight-saving boundaries, and invalid persisted data. Additional tests verify SQL reference assignments match the runtime schedule and preserve exactly the five empty verse placeholders in the publisher’s source.

Browser tests exercised landing → dashboard → three chapter completions → quiz → saved/edited reflection → refresh → resumed reader → achievements → dashboard. The flow earns exactly 80 XP (50 + 10 + 20) and remains unchanged after editing/refreshing. Other scenarios cover every mobile feature route without horizontal overflow, saved dark mode, Scripture failure/retry, storage failure without a false saved state, and simultaneous writes from two tabs.

Desktop and mobile dark-mode dashboard screenshots were captured and visually inspected. QA images and browser traces remain in ignored local artifact folders. No personal user records were used; browser tests use fresh isolated contexts. Temporary test servers shut down after the run.

## Known verification limits

- Supabase migrations are prepared, with reference-data consistency checks, but have **not been applied to PostgreSQL** or tested against live Supabase roles/RLS. No OAuth, production persistence, RPC, backup, or account-deletion implementation is claimed.
- Vercel deployment has not been performed. GitHub write access is now verified, the initial five commits have been published, and [the first CI run](https://github.com/drcabokia/faithquest/actions/runs/38897044834) passed.
- Browser execution used Edge only. GitHub CI is configured for Chromium on Linux; Firefox/Safari and assistive-technology testing remain future validation.
- Full `npm audit` reports five affected **development-tool packages** in a single `braces` stack-exhaustion advisory chain under Next’s ESLint tooling. The runtime-only audit is clean. The available npm automatic fix would downgrade the Next lint configuration across major versions, so it was not forced. Recheck the advisory/upstream patch before expanding untrusted development-tool inputs. No assertion of a fully clean development dependency audit is made.

Production readiness requires the gates in AUTH_AND_SECURITY.md, not only a successful application build.

## Progress review

Local lint, strict TypeScript, and all 20 unit/content tests passed again on 16 October 2026. The Git working tree was clean before this review. The user's running development server was left intact; the earlier local production-build and five browser-test passes were not represented as fresh runs. Database migrations remain unexecuted against a live PostgreSQL/Supabase instance.

The first GitHub Actions run passed on Ubuntu for application commit `e4d1c377c6b59023a4e2db9f8116124e1bcf7b02`: clean npm install, lint, TypeScript, 20 unit/content tests, production build, Chromium installation, and all five browser acceptance tests. The current local landing page and dashboard also returned HTTP 200 without restarting the user's development server.

GitHub emitted non-blocking runner maintenance annotations: the v4 checkout/setup-node actions target deprecated Node.js 20 and were run under Node.js 24, and `ubuntu-latest` is scheduled to change runner images. Updating those workflow dependencies/pinning the runner should be included in deployment maintenance; the verified run itself succeeded.
