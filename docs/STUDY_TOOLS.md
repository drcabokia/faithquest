# Saved verses and memory practice

Implemented in development on 17 October 2026 for both private accounts and the browser-local demo.

## Try the feature

1. Open **Bible Reader**, choose a book/chapter and wait for Scripture to load.
2. Use the new **Verse** selector, then choose **Save verse**. The button changes to **Remove saved verse**, and the saved passage is marked in the reader. Saving a verse does not mark its chapter read.
3. Open **Study Tools** in the navigation or **My saved verses** in the reader. The compact list shows references, Scripture previews and any private-note or unsaved-draft indicators. Open a row to see the full WEB verse and its note editor. Confirm the words match the passage you selected.
4. Select one to five verses using the row checkboxes, then choose **Start practice**. Use **Hide and recall** and **Reveal verse** inside practice. Neither XP nor reading streaks change.
5. Try **Find a reference**, **Book**, and **Order**. Search matches reference names/numbers, not the whole Bible text. Collections display twelve rows per page, with Previous/Next controls when needed. Filters do not change your selected queue: its reference buttons remain visible above the list.
6. Expand a row and choose **Read in context** to open that chapter at the verse. Choose **Remove** to remove only the saved reference. A saved note or draft must be managed first; removal remains disabled while either exists. It does not delete journal entries or reading progress.
7. Refresh or open another browser signed into the same account. Saved references should remain. Demo references remain local to the current browser/origin; supporting browsers coordinate parallel writes using Web Locks.

There is a limit of 1,000 saved verses per journey. At the limit, remove an existing reference before saving another. Repeating an explicit save or removal has the same result and cannot earn rewards.

## Export and recovery

Account exports fetch the latest saved collection; demo exports use the current browser state. Version 1 snapshots now have an optional `savedVerses` object mapping references such as `JHN.3.16` to save timestamps. The optional field keeps older version 1 files compatible.

The restore preview counts missing saved references. On confirmation, imports add missing references and retain existing saves. Imported timestamps are ignored; newly imported references receive the destination's current save time. An explicit restore can re-add a verse previously removed from the collection. Old backups without saved verses leave the current collection intact. The merged collection must fit the 1,000-reference limit or the entire import rolls back. The existing backup timezone rule also applies to imports containing only saved verses. See [backup and restore](BACKUP_AND_RESTORE.md).

After an uncertain save/removal, use **Check saved progress** before retrying. Account operations are never automatically replayed, and there is no browser-local account-data fallback. If Scripture fails to load, the row preview indicates that it is unavailable; expand it for the error and **Try again**, with no invented replacement text.

## Content, privacy and data model

Saved verse details and guided practice fetch the exact verse text from the same bundled WEB Classic chapter files as the reader. No Scripture, paraphrase or AI response is generated for memory practice. Guided practice can compare typed words in order with the source, ignoring capitalization, punctuation and spacing. It does not judge meaning or spiritual maturity, store a practice score, record spoken responses, or award memory XP. Reference metadata includes all 1,189 chapters and excludes the five empty source placeholders documented in [CONTENT.md](CONTENT.md).

`scripts/generate-verse-index.mjs` regenerates `src/data/verse-index.json` from the bundled chapter files. Run it after an intentional Scripture import, review changes, and run the content tests. The SQL migration asserts that existing chapter verse counts match the source and adds the empty-number exclusions; it does not replace Scripture words. Tests compare every verse number and exclusion across source files, application metadata and PostgreSQL.

Migration `20261017084641_private_saved_verses.sql` adds `public.user_saved_verses`, with an Auth/profile deletion cascade, a caller-leading primary key, an indexed chapter foreign key, owner-only SELECT and restrictive live-session RLS. Anonymous access and all direct client mutations are revoked. Public `set_saved_verse` derives the caller from the active signed session, locks the profile before write/read budgets, validates the available reference, enforces the collection cap, and accepts explicit save/remove intent. It never accepts a user ID, Scripture text, reward or timestamp. Private validation/snapshot helpers remain inaccessible to clients.

Account selections are not written to localStorage or shared with groups. `/study` is a protected page, and commands/export/restore retain their independent identity/session checks and private response headers. Public Scripture assets are still public; provider-managed request logs have their own retention/access policies. This feature adds no third-party analytics, paid service or privileged Next.js credential.

## Manual acceptance record

Use your test account and record its initial XP before saving a verse. Check save, refresh, expanding details, guided practice, filtering, removal and restoring that reference from your own export. XP should remain unchanged throughout. Check that a second account has its own collection. Keep personal exports private; no credentials, tokens or journal content are needed in a test report.

Automated and hosted synthetic checks are documented in [VALIDATION.md](VALIDATION.md). They do not establish user-observed cross-device acceptance. Earlier outstanding OAuth renewal, deletion, editorial and whole-project recovery gates remain separate.

## Guided memory practice

Added on 18 October 2026 in account and demo modes. The 22 October UI revision uses an explicitly selected queue of one to five saved references. Optional guidance is under **How practice works**; the former per-card hide/show action is consolidated into guided practice.

1. Save two or more verses in **Bible Reader**, then open **Study Tools**. Note your current XP.
2. Choose a **Book**, **Find a reference**, and **Order** if desired. Select one to five verses using their row checkboxes, including verses on different pages. The queue follows selection order. Its reference buttons remain visible when filters hide selected rows; choose a reference button to deselect it or **Clear selection** to start over. At five selections, unselected checkboxes are disabled until one is deselected. **Start practice** is disabled only when nothing is selected, so filtering to no matches does not silently replace or empty your chosen queue.
3. Read the verse, then choose **Hide and recall**. The complete text disappears. Try recalling it aloud, on paper, or in **Your recall (optional)**.
4. Choose **Show first-letter hints**. These preserve each word's first character and punctuation; they are labelled as a practice aid. Choose **Reveal verse** at any time to see the exact bundled WEB text.
5. For a typed check, enter a few different words and choose **Compare wording**. It should explain that some words differ and reveal the source. Enter the source words in order, optionally changing capitalization or punctuation, and compare again. It should report that the words match. This checks wording only; it cannot assess understanding or alternate translations. Editing your typing clears the previous comparison message.
6. Choose **Try recall again** to clear typing/hints and hide the source. Choose **Next verse** to move on; no mastery decision or successful comparison is required. Each new verse starts with the source visible and no prior typing or hints.
7. Finish the queue or choose **End practice**. Return to your saved collection. XP, chapters, mission dates, streaks and saved references should be unchanged. Your search, book, order, page, expanded rows, selected verses and unsaved notes remain in place, and keyboard focus returns to **Start practice**. You can practise the same selection again or clear it.
8. Try a narrow phone window. Then reload or navigate away during a practice: selection, queue and typed recall should disappear. Select verses again to start with a blank recall box. A refreshed collection that has lost any queued reference stops that practice and clears its recall box. A removed/re-saved reference must be selected again.

Only component memory holds the queue, hints, typed recall and wording result. None are written to browser storage, sent in a request, placed in a URL, exported, restored, shared with fellowship groups or recorded in the database. Moving to another verse, ending practice, collection removal detected on refresh, page reload or navigation away clears the current typing, including when Next.js retains a hidden route. Public Scripture is loaded on demand from the same bundled files as the reader; load failures offer **Try again** and **End practice**, without substitute text. This phase adds no schema migration or saved practice history. Browser memory practice does not guarantee availability of uncached Scripture while offline.

## Private verse notes

Added on 18 October 2026. Each saved verse can carry one private personal note of up to 2,000 characters. This text is your own reflection, labelled separately from the unchanged WEB Scripture. Notes do not earn XP, mark chapters read, change streaks or appear in fellowship summaries.

### Browser checks without developer tools

1. In **Bible Reader**, save John 3:16 (or another verse), then open **My saved verses**. Expand its row, choose **Add private note**, type a short thought and choose **Save private note**. Collapse the row: **Private note** should remain visible. Reload and expand it again: your note and the original Scripture should both remain. Note your initial XP; it should stay unchanged.
2. Choose **Edit private note** and make an unsaved change. Collapse the row: **Unsaved note draft** should remain visible. Choose **Continue note: John 3:16** to reopen it and focus your writing. Navigate to Dashboard. The unsaved-verse-note banner should offer **Return to Study Tools**. Return, expand the row if needed and confirm the draft remains. Filter the verse out, then use **Continue note** to find it again. Start and end practice: the same draft and expanded row should remain. Unsaved drafts stay in memory in this tab; they are not uploaded, exported or stored in the browser.
3. Try reloading with a draft. Your browser should warn before leaving; cancel to keep writing. Use **Discard note draft → Keep writing** to cancel a discard, or **Discard note changes** to discard it. Saving clears only the exact draft that was submitted; later typing is retained if a response arrives while you are still writing.
4. With two tabs on the same account, start editing the same saved note. Save a different note in the first tab, then return to the second. If necessary use **Check saved progress** after a conflict. The second draft should remain, with **Review saved note** and saving disabled. After reviewing, **Keep my draft against this version** explicitly accepts that version as the base; **Save private note** then replaces it. Another intervening edit is checked again by the server. There is no automatic overwrite.
5. Export your account under **Profile & Settings** before trying deletion. Back in Study Tools, choose **Delete private note → Keep note**; nothing should be removed. Then choose **Delete private note → Delete note permanently**. Only the note is deleted. A saved verse with a note or a local draft cannot be removed from the reader/collection; save or discard the draft and explicitly delete its saved note first.
6. Choose your own exported backup in Profile. After deleting only a note, the preview should show **1 missing verse notes** even when there are zero missing saved verses. Confirm the merge. The note should return. Existing destination notes always win conflicts; restore does not replace newer text. An explicit restore can recover a note you previously deleted.
7. If a save is uncertain, use **Check saved progress** before retrying. Your draft remains. A committed save with a lost response is recovered by reading, without automatic replay. If an unsaved verse is removed elsewhere, its draft remains in the draft list with **Save verse again**; saving the verse does not automatically save its draft.
8. Check on a narrow phone window and with a second account. Each account should see only its own notes. Do not send personal notes, exports, credentials or tokens in the test report.

### Storage and recovery

Saved notes extend the existing owner/session-protected saved verse row. Account notes are stored only through authenticated transactional commands; demo notes are stored with other demo data in that browser. Drafts for both modes live in the journey-layout memory provider. Full page reloads, sign-out and closing the tab clear them; browser reload/close warnings offer a chance to save or discard first. They are not a durable backup. Separate tabs have separate drafts.

Version 1 snapshots optionally contain `verseNotes`, mapping saved references to `{ text, updatedAt }`. Every note must refer to a saved verse. Backup normalization sends only reference-to-text values and the matching saved references, discarding imported timestamps. The server validates the whole merge before writing, adds only missing notes, uses its own timestamp and preserves existing notes. Older files without `verseNotes` leave destination notes intact. Backup plan/timezone/size rules still apply.

The note save/delete command includes the expected saved text. A stale base returns a safe conflict without discarding the current note or draft. Same-content retries do not redate notes; deleting an already missing note is harmless while the verse remains saved. Profile locking serializes note edits, verse removal and restores. Revoked/anonymous callers and direct table writes remain denied; account deletion cascades through the existing profile/saved-verse relationship. No new sharing, analytics, public website or AI interpretation is added.

The user reported completing guided-memory testing before this phase. That records the memory-practice acceptance report only; private-note acceptance remains pending until these new checks are reported.
