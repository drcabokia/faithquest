# Bible content and editorial scope

## Provenance

The bundled Scripture is the **World English Bible Classic, 2020 stable text**, downloaded on 16 October 2026 from the publisher’s [VPL archive](https://ebible.org/Scriptures/eng-web_vpl.zip). The publisher dedicates the text to the [public domain](https://ebible.org/eng-web/copyright.htm). The translation name is a trademark; do not change the words and still label the changed text WEB.

`public/bible/provenance.json` records the archive SHA-256, source, license URL, retrieval date, and import scope. The app includes the 66-book Protestant canon from the larger ecumenical source archive. Verse words, punctuation, and Unicode are preserved; source book codes are normalized to consistent app identifiers. Footnotes/headings are not part of this VPL reader. Other canons and languages need their own reviewed plans and content.

Five source verse-number placeholders have no text: Luke 17:36; Acts 8:37, 15:34, 24:7; Romans 16:25. The reader skips empty placeholders and explains that verse numbering follows the edition. It never supplies invented replacement text. This also means a requested reference should be read in its surrounding chapter rather than assuming every verse number has text in every translation.

## Reproduce an import

Download the archive from the publisher, retain it outside tracked source (for example `.cache/web.zip`), then run:

```powershell
python scripts/import_web.py .cache/web.zip
```

Python is a development/import tool, not an application dependency. The importer checks every book’s chapter count, chapter presence, unique verse numbers, and the 1,189-chapter total. It writes JSON and book metadata; run `npm run format` and `npm test` afterward. Review resulting Scripture/provenance changes before committing. Routine builds never download Scripture.

## Schedule

The canonical generator partitions an ordered 1,189-chapter list using `floor(day * 1189 / 365)` boundaries. It creates 365 complete, non-overlapping daily chapter assignments. Chapter lengths vary; this is a chapter-balanced schedule, not an equal-time schedule. The reference SQL uses the same boundaries. Chronological Journey now has a complete preview-only contextual draft; editorial review and activation remain pending.

The [next-phase recommendation](FEATURE_ROADMAP.md#recommended-next-phase-reading-plan-choice) prioritizes Balanced Daily Journey, followed by Chronological Journey. Balanced is now implemented for explicit development testing; independent human editorial review remains a production release gate. Chronological has a complete preview-only draft and cannot be selected. Chronological ordering must identify uncertain placements.

### Balanced Daily Journey v1

This schedule is an original proportional ordering authored during development on 18 October 2026, using the existing 66-book metadata and unchanged bundled WEB chapters. No third-party schedule was imported. Example-provider links in the roadmap describe reading approaches only.

Three disjoint streams preserve canonical book/chapter order internally: Old Testament excluding Psalms/Proverbs (748 chapters), New Testament (260), and Psalms followed by Proverbs (181). For zero-based day `i`, the first stream uses slice boundaries `floor(i * 748 / 365)` and `floor((i + 1) * 748 / 365)`. The other streams use the same formula with their own lengths and `ceil` boundaries. Each day's ordered assignment is OT, then NT, then wisdom. This yields 365 nonempty days and each of the 1,189 chapters exactly once. The daily mix varies, including days without an NT or wisdom chapter. Reading times are not equalized, and longer chapters remain intact.

`canonical-v1` and `balanced-v1` are immutable schedule identities in snapshots and backups. SQL seeds the balanced schedule from the same metadata/formula; embedded PostgreSQL tests compare every day, chapter and position with the runtime catalogue. These coverage and parity checks do not constitute independent editorial approval. Balanced is labelled as a development schedule in the UI and requires an explicit acknowledgement before selection. The development database's `published` flag permits reference reads and opt-in testing; it does not record editorial sign-off or a public website release. Production launch still requires human schedule review.

## Quiz review

There are **60 passage-checked questions covering canonical days 1–30**. The original six questions retain their IDs, options and answers. Twenty-two additional questions for days 4–14 were authored with coding-assistant help and checked against the bundled WEB passages on 16 October 2026. Thirty-two more questions, two per day for days 15–30, were authored and source-checked on 18 October 2026. These are factual source checks, not independent human editorial or theological sign-off. Questions and explanations are educational paraphrases, separate from Scripture text; the bundled Scripture was not generated or changed.

The days 4–14 references are Genesis 11:9; 12:4; 14:18; 16:15; 17:5; 19:26; 21:3; 22:13; 23:19; 25:34; 28:12; 29:18; 30:24; 32:28; 33:4; 35:19; 37:28; 39:1; 40:21; 41:30; 43:34; 45:4. Each was checked for one unambiguous correct choice, distinct alternatives, factual explanatory wording and a reference within that day's assigned chapters. The exact supporting verse evidence is recorded in `tests/fixtures/quiz-review-days-4-14.json`. Tests pin that evidence to the bundled text and verify public/demo/database catalogue parity, reference placement and immutable reward behavior. These checks catch drift; they do not replace editorial judgment. Independent human review remains a release gate for the new content.

Quiz day placement now follows the source chapter in the selected schedule. Existing question IDs, answers and explanations stay unchanged, so retries or different previews cannot award the same question twice. The original `quiz_questions.plan_id/day` remains canonical authoring provenance; command availability and restore validation require the question's source chapter in the active plan. Runtime day menus and context links derive their locations from the selected assignments. Frontend/database mapping parity is tested for both schedules. The plan-choice work preserved quiz wording; the subsequent days 15–30 expansion adds the questions described below.

## Chronological Journey: editorial draft

`chronological-draft-v1` is a **preview identity only**, excluded from active-plan IDs, commands, saved journey state and personal restore. It has 365 nonempty days, 66 books and all 1,189 chapters exactly once. It is an original contextual ordering authored with coding-assistant help on 18 October 2026; no third-party daily schedule was imported. The existing WEB text is unchanged.

The ordered chapter list comes from explicit book/range segments in `src/data/chronological-draft.ts`. It is partitioned using `floor(i * 1189 / 365)` boundaries into three or four whole chapters per day, with variable reading times. `src/services/chronological-preview.ts` validates reference coverage and attaches each segment's context and note IDs to the resulting days. Tests verify every chapter, its within-book order, intended contextual boundaries, valid source verse references and key source evidence. These checks establish completeness and reproducibility, not historical or theological approval.

The approach groups books around broad narrative settings. Job follows Genesis 11 provisionally; Chronicles revisits Samuel/Kings in blocks; Psalms follows the David material while preserving its multi-period anthology; wisdom collections follow Solomon; prophets are grouped near narrative anchors; Haggai/Zechariah interrupt Ezra before its rebuilding-completion chapters; each Gospel remains intact; letters interrupt Acts at proposed context points. Consequently, readings sometimes return to earlier events. This draft is **not a strict event-by-event harmony or an order of composition**. It must be reviewed and may need substantial rearrangement before an active chronological plan can be published.

Fifteen placement notes explain the choices and uncertainty, with links to the exact bundled Scripture chapters and selected primary publisher guides. For example, [BibleProject's Job guide](https://bibleproject.com/guides/book-of-job/) explains the unspecified setting; [its Psalms guide](https://bibleproject.com/guides/book-of-psalms/) describes the collection's different periods; [its Joel guide](https://bibleproject.com/guides/book-of-joel/) presents one proposed post-exile setting; and [its Galatians guide](https://bibleproject.com/guides/book-of-galatians/) connects the letter with Acts context. These sources support particular contextual observations. They do not supply, endorse or independently review FaithQuest's entire ordering. All note wording is editorial paraphrase, separate from Scripture.

The catalogue offers all 53 preview weeks and a **Download draft schedule** button. The JSON review artifact contains public chapter references, segment definitions, method, review status and source notes, without Scripture text or personal journey data. It has its own `kind`, no journey state version, and cannot be restored as a personal backup. Opening a source in the reader may update the reading position; previewing, paging and downloading do not mark chapters, earn XP or select a plan.

Activation requires independent review of the full ordering and uncertainties, a finalized versioned manifest, explicit publication approval, runtime/database assignment parity and the existing selection/reward/restore checks. This milestone adds no database migration or new active plan. Canonical and Balanced identities and prior release gates remain unchanged.

### Quiz expansion: canonical days 15–30

The 32 new questions cover Genesis 46–50, Exodus and Leviticus 2–7, with individual references recorded in `tests/fixtures/quiz-review-days-15-30.json`. Each record pins the complete supporting WEB verse plus a supporting phrase. Authoring checked one correct choice, distinct distractors, a factual explanation and a reference within the canonical day's actual assignment. Questions are qualified by their cited passage where needed; for example, Genesis 46:27's household count is asked according to that specific verse. The questions describe the passage rather than prescribe modern ritual practice.

Tests verify the complete public/demo/database catalogue, source evidence, four distinct options and mapping to both active plans. Canonical provenance remains days 1–30; Balanced uses the same stable question IDs on the days containing their source chapters. For example, Leviticus 6:13 is canonical day 30 and Balanced day 47; Leviticus 7:15 is Balanced day 48. A first submitted answer remains immutable across retries or restore, and the server derives at most one 10 XP reward per question. Older backups and the original 28 questions keep their identities and behavior.

The SQL `reviewed` flag means passage-checked and available for development, consistent with the earlier quiz batches. Independent human review of the 54 assistant-authored additions across days 4–30 is still a production release gate. The user's report of completing the Chronological preview workflow does not approve quiz wording or the chronological ordering.

### Guided memory practice aids

Guided practice loads each saved verse from the existing bundled WEB Classic chapter file and displays its full words unchanged. First-letter hints replace later letters/numerals in each word with underscores while retaining punctuation and spacing. Hints are explicitly labelled as practice aids and are not presented as Scripture quotations. No paraphrase, missing-word generation or AI interpretation is introduced.

Optional typed comparison normalizes Unicode, capitalization, punctuation and spacing, then checks the same words in the same order. It preserves word boundaries and rejects omitted, reordered or repeated words. It reports a wording match or difference rather than a score, interpretation judgment or memorization credential. The original source is revealed for comparison, and typed text/results are never saved or sent. Existing Scripture provenance and quiz/schedule editorial gates still apply.

### Personal verse annotations

Saved-verse notes are user-authored personal text, labelled **Your private note** and rendered separately from the original WEB blockquote. They never replace Scripture, enter memory-practice answer text or appear in fellowship summaries. Note editing does not modify any bundled chapter, source reference or reading assignment. Text is rendered as ordinary escaped text, preserving line breaks; no HTML or AI interpretation is generated. Export/restore carries only the caller's saved note content, with imported timestamps discarded and destination conflicts preserved.
