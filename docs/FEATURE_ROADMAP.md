# Feature roadmap

| Stage                                 | Deliverables                                                                                                                        | Status                                                                                                                |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Foundation                            | Planning, strict typed Next.js app, light/dark theme, navigation                                                                    | Complete                                                                                                              |
| Demo                                  | Full canonical 365-day plan and WEB reader; progress, XP, streaks, 60 quiz questions, journal, achievements, map, settings          | Complete                                                                                                              |
| Database preparation                  | Schema/RLS, canonical/Balanced reference seeds, command contract, auth plan                                                         | All seventeen hosted migrations confirmed; embedded and hosted isolation/reward checks pass                           |
| Validation                            | Lint, types, business/content/database/auth tests, demo and isolated account browser scenarios, production build                    | Automated suites expanded for account reliability and exports                                                         |
| Deployment                            | GitHub workflow and Vercel guide                                                                                                    | GitHub published; CI passed; Vercel not deployed                                                                      |
| Production integration                | Google OAuth, Supabase command adapter, transactional RPCs, RLS tests, privacy/export/deletion/backup operations                    | Development Google and core browser acceptance pass; extended session/recovery and production operations remain gated |
| Account reliability and data controls | Retryable account-service outages, explicit saved-progress recovery, fresh authenticated JSON exports, isolated browser regressions | Implemented, including previewed backup merge; real disposable-account deletion acceptance remains pending            |
| Session security                      | Live Auth session checks across database/API/pages; confirmed all-device sign-out                                                   | Implemented; user confirmed real Google two-browser sign-out and saved-data recovery passed                           |
| Account deletion                      | Export guidance, typed confirmation, recent OAuth authentication, session revocation and caller-only Auth removal                   | Implemented and deployed to development; real disposable-account acceptance pending                                   |
| Reliability and monitoring            | Persistent account request limits, private incident references, bounded readiness probes and connection checks                      | Implemented and deployed in development; see the validation report                                                    |
| Backup and restore                    | Personal exports, previewed merge in demo/account modes, server-derived rewards, rollback-only restore drills and recovery runbook  | Implemented in development; automatic off-site backups and whole-project rehearsal pending                            |
| Reviewed quiz expansion               | 60 passage-checked questions across canonical days 1–30, source evidence and catalogue parity                                       | Implemented; independent human editorial review pending                                                               |
| Reading plan choice                   | Balanced Daily Journey, then Chronological Journey; plan previews and progress-safe selection                                       | Balanced implemented; Chronological has a complete preview-only draft; editorial review and activation pending        |
| Editorial expansion                   | Other canons, further quizzes beyond day 30, languages                                                                              | Future                                                                                                                |
| Fellowship                            | Invite-only groups, explicit name/participation consent, private invitations, owner controls and safe membership exports            | Implemented in development; real two-account browser acceptance pending                                               |
| Study tools                           | Private saved verses, guided exact-WEB memory practice, private annotations, protected drafts and export/restore                    | Memory-practice testing reported complete; private-note acceptance pending                                            |
| Private journal tools                 | Categories, private text/date search, bounded history, in-memory drafts and explicit discard                                        | Implemented in development; user browser acceptance pending                                                           |
| Reading challenges                    | Private seven-date periods, mission-date progress, one-time 100 XP bonus, history and backup recovery                               | Implemented in development; real seven-day browser acceptance pending                                                 |
| Private prayer tracking               | Separate requests, user-controlled status, dated notes, protected drafts, version checks and export/restore                         | Implemented in demo/development accounts; browser acceptance pending                                                  |
| Further study tools                   | Explicit grace policy                                                                                                               | Future                                                                                                                |
| Optional integrations                 | AI with citations/interpretation labels, PWA, push                                                                                  | Future; absent/disabled                                                                                               |

AI must never invent verses or blur Scripture and interpretation. It must disclose uncertainty and differing Christian interpretations. Group design must encourage consistency without comparing spiritual maturity. Grace days will need an explicit, tested calendar policy before a claim control is introduced; the demo does not pretend that a grace balance exists.

## Recommended next phase: reading plan choice

On 18 October 2026, the user requested consideration of chronological and balanced daily journeys. The recommended order is **Balanced Daily Journey first**, followed by **Chronological Journey**, using a shared plan catalogue. Balanced and the shared catalogue are now implemented for explicit development testing. Chronological now has a complete preview-only contextual draft. Independent editorial review is still pending.

| Journey                 | Reading experience                                                                                                      | Priority                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Canonical Journey       | Existing Genesis-to-Revelation, 365-day whole-Bible schedule                                                            | Retain as the current option                             |
| Balanced Daily Journey  | Spread Old Testament, New Testament, and Psalms/Proverbs readings through the year for variety                          | First new plan                                           |
| Chronological Journey   | Arrange passages around an editorially reviewed sequence of events, with notes on uncertain placements                  | Second new plan                                          |
| Gospel Foundations      | A shorter introduction through the Gospels for readers who want a smaller commitment; explicitly not a whole-Bible plan | Later option                                             |
| Five-day weekly journey | Five assigned reading days plus two unassigned catch-up/rest days each week                                             | Later option after an explicit calendar/challenge policy |

Biblica's [Bible in a Year](https://www.biblica.com/online-bible/) demonstrates the Old Testament, New Testament, and Psalms/Proverbs pattern. Bible Gateway offers a [chronological plan](https://www.biblegateway.com/reading-plans/chronological/today?version=WEB). These are examples of reading experiences, not imported schedules or evidence of permission to reuse an entire schedule. FaithQuest should retain its bundled WEB text and record the source, reuse basis, editorial decisions and review status of any adopted ordering.

### Balanced schedule scope

For the first version, prefer whole chapters so the existing reader's chapter completion remains meaningful. Cover all 1,189 chapters exactly once over 365 nonempty days; treat Psalms/Proverbs as separate streams excluded from the remaining Old Testament stream. Preserve chapter order within each stream. Preview actual assignments before activation.

A whole-chapter schedule with no repeats cannot promise New Testament reading on every one of 365 days: the New Testament contains 260 chapters. The first version should describe variety across the year and show each day's actual mix. If all three categories every day is required, scope verse-range assignments and completion separately before publishing that promise. Chapter counts alone also do not establish equal reading time.

### Delivery sequence and existing progress

1. Introduce stable plan IDs and schedule versions, a comparison view, and complete schedule previews. Clearly label editorial drafts and keep them unavailable for activation.
2. Make the dashboard, reader links, mission completion, quizzes, challenges and fellowship participation calculations use the selected schedule. Match quizzes to assigned passages; do not reuse canonical day numbers as passage matches.
3. Carry plan identity through account snapshots, demo storage and personal backups. Treat legacy records as canonical. Preserve existing chapter history, mission dates, XP, journals and saved verses; reject incompatible restores before writing anything.
4. Support explicit plan selection before a new journey has activity. Keep existing journeys on their current plan while developing a separately tested switching policy. Previewing another plan must not change progress. Any later switch must explain how history and rewards carry forward and must not produce duplicate XP.
5. Publish Balanced Daily Journey only after complete coverage checks and editorial review. Build and review the chronological sequence next; document interpretive placements rather than implying one undisputed historical order.

Implemented foundation: versioned schedule lookup is used by the dashboard, active plan, reader and quizzes. Snapshots and backups carry optional top-level `readingPlan`, with legacy records interpreted as `canonical-v1`. Canonical reward keys remain `reading:<day>`; Balanced uses `reading:balanced-v1:<day>`. The server serializes selection with activity via the caller profile lock. Any chapter, mission, XP, quiz, reflection or challenge enrollment fixes the plan; saved verses and reading position alone do not. Existing users are not switched. Challenge dates and fellowship percentages use active-plan completions. Mid-journey switching remains future work.

### Acceptance criteria

- Validate every chapter reference, 365 nonempty days, full whole-Bible coverage and the intended repetition policy for each published schedule; verify frontend/database assignment parity.
- Confirm a new account's selection survives reload, sign-out/sign-in and export/restore. Reject unknown or unpublished plans on the server.
- Restore legacy canonical backups without changing existing completions or XP. Reject mismatched plans atomically with a clear message.
- Complete a new-plan mission and retry it without duplicate rewards; verify matching quiz passages, challenge dates, reader navigation and fellowship percentage.
- Test both demo and account modes, two-account isolation and mobile plan previews. Record human editorial review separately from automated checks.

### Browser validation without developer tools

1. Open **My Reading Plan**, then **Compare reading journeys**. Preview Balanced and Canonical and move between preview weeks. The active plan name, completed-day count and XP must stay unchanged.
2. On an account that already has activity, confirm the message that the plan is fixed and that no **Use …** button is offered. Keep that account's existing plan and history.
3. Only on a journey with no activity, preview Balanced, read its development/editorial notice, tick the acknowledgement and choose **Use Balanced Daily Journey**. Reload and sign out/sign in; the active plan should remain Balanced. You can switch back before activity, but completing a chapter or joining a challenge fixes the plan.
4. Balanced day 1 must show **Genesis 1–2 · Matthew 1 · Psalms 1**. Complete all four chapters. Genesis 1–2 alone must not finish the mission. After Genesis 2, **Next chapter** should open Matthew 1. Full completion earns 50 XP once; reload/revisit must not add XP.
5. Open quiz day 3 in Balanced: the ark question belongs there, following Genesis 6. Read-in-context links must open the referenced chapter. Previously answered questions retain their answers and XP.
6. Export account data under Profile & Settings. For Balanced it contains `readingPlan: "balanced-v1"`. Preview a matching backup and confirm its merge only if it belongs to you. A canonical/legacy backup on a Balanced account must show a plan mismatch and apply nothing. Do not send private exports here.
7. Try previews on a narrow phone window. Cards, assignments and preview paging should fit without horizontal scrolling. Chronological should show **Editorial draft**, offer all preview weeks and a public review download, and offer no activation.

Real-browser acceptance for the new journey remains pending until these results are reported. Preview checks are safe on an existing account; selecting a new plan requires a journey without activity. No account reset is needed for preview testing.

### Chronological draft review and browser checks

The next development task prepares the complete Chronological Journey draft for review. It has every chapter once over 365 days, contextual section labels, fifteen source-linked placement notes and a downloadable public schedule. It remains excluded from all active-plan and restore allowlists. No existing account is switched and no database migration is added.

1. Open **My Reading Plan → Compare reading journeys → Preview Chronological Journey**. Confirm the **Editorial draft** notice, the explanation about revisiting earlier events, and the absence of a selection checkbox or **Use Chronological Journey** button.
2. Week 1 should include **Day 4: Genesis 10–11 · Job 1–2**. Expand **Placement notes for this week**. Job's note must explain that its placement is uncertain, with a Job 1:1 source link and a supporting guide.
3. Use **Preview week** to jump to Week 53. It contains only Day 365, **Revelation 19–22**. The next-week button is disabled and its note explains the limits of placing visions on a historical timeline.
4. Choose **Download draft schedule**. Open the JSON as a review document: it contains 365 day records, segment definitions, public source references and `status: "preview-only"`. It contains no profile, private reflection, XP ledger or group information. This file is not a personal backup. Trying it in Restore a backup must reject it before any upload or merge.
5. Return to the active mission list and Dashboard. The active plan, recorded completions and XP should be unchanged. Check the catalogue in a narrow phone window for wrapping. Switching previews should return to Week 1.

Editorial review is separate from these interface checks. Review **all** assignments and notes, especially Job, Chronicles' genealogies and parallel accounts, the multi-period Psalms/wisdom collections, undated prophets, Persian-period chapter shifts, Gospel repetition and letter placements around Acts. A reviewer should decide whether the contextual blocks are suitable or need an event-level harmony. Record amendments and approval explicitly; passing automated coverage or browsing the first week does not establish chronology approval. Activation and a final `chronological-v1` schedule remain future work.

### Quiz expansion through canonical day 30

The next development task adds 32 passage-checked questions, two per canonical day for days 15–30, for a 60-question catalogue. Both active journeys use chapter-based placement. Quiz IDs/answers from the previous catalogue are preserved, new solutions remain private in account mode, and correct/incorrect first attempts retain the same reward and restore rules. Independent human editorial approval remains pending.

The user reported completing the preceding Chronological preview/testing workflow with “Ok, done.” This is recorded as a user completion report for that workflow, not independent chronology approval or proof of each earlier release gate. Chronological remains preview-only.

Browser checks, without developer tools:

1. Open **Daily Quiz**. On Canonical, choose days 15, 16, 20, 29 and 30 from **Reading day** and confirm that each has two questions with references in the day's assigned chapters. Days beyond 30 may have no passage-checked questions yet. The Canonical summary should say 60 questions across 30 reading days.
2. On a question you have not answered, choose an answer and select **Check my answer**. A correct answer earns 10 XP once; an incorrect first answer earns no XP and shows the explanation. Reload: the saved choice and feedback remain, with the answer controls disabled. Use a question you do not mind saving permanently; there is no answer-reset feature.
3. On canonical day 30, the altar-fire question must link to **Leviticus 6:13**. Its context link opens Leviticus 6. On an existing Balanced journey, this question appears on day 47 and the thanksgiving question on day 48. Do not switch an established journey just to run this check.
4. Export account data under Profile & Settings and retain it privately. Newly answered question IDs should appear with your other attempts. A matching-plan backup can be previewed before confirmation; restoration keeps existing answers and derives rewards from the source answer key. Do not send personal exports here.
5. Check the quiz on a narrow phone window: question text, all four options, explanations and source links should wrap without horizontal scrolling. Confirm previous saved answers and XP still appear normally.

Human editorial review is separate: examine every new question, option, explanation and cited WEB verse in the source-evidence record before production release. Passing an interface check does not establish that review.

## Guided memory practice

The next development task adds short one-, three- or five-verse queues from the filtered saved collection, first-letter hints, optional typed wording comparison and explicit reveal/retry/next controls. All practice state stays in component memory. There are no XP rewards, saved practice scores, network submissions or database changes. The full WEB source remains distinct from the labelled hint aid. See [Study Tools: guided practice](STUDY_TOOLS.md#guided-memory-practice) for browser checks without developer tools.

On 18 October 2026, the user reported completion of the preceding quiz browser testing. This records that completion report; independent editorial review of the 54 assistant-authored questions and the reading schedules remains pending. Guided-practice real-browser acceptance is a new task and remains pending until reported.

## Private verse annotations

Implemented in development: one private 2,000-character note per saved verse, explicit save/edit/delete, content-conflict checks, protected in-memory drafts across app navigation, reader/removal safeguards and previewed export/restore. Notes are personal text separate from Scripture and never enter fellowship summaries or XP calculations. Browser steps are in [Study Tools](STUDY_TOOLS.md#private-verse-notes).

On 18 October 2026 the user reported completing guided-memory practice testing. This closes that workflow's user completion report, while independent editorial and other earlier release gates remain separate. Private-note browser acceptance is the new pending workflow.

## Private prayer tracking

Implemented after the CI repair: private requests separate from daily journals, Ongoing/Answered/Archived statuses, dated follow-ups, saved-text/date search, bounded history, protected drafts, conflict review and request-level recovery. The [browser guide](PRAYER_TRACKING.md) covers ordinary use, export/deletion/restore, two-tab conflicts and optional two-account privacy checks. No new reward, public website, group disclosure or notification service is introduced. Independent content/editorial and earlier operational release gates remain open.
