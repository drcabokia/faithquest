# Private journal tools

Categories, search and drafts were implemented on 17 October 2026; server-enforced save protection was added on 22 October 2026. Public deployment and the existing release acceptance gates remain separate.

## Try it in your browser

No developer tools or second test account are needed for these checks. Use sample text rather than sensitive information.

1. Open **Reflection Journal**. Choose **Prayer** under **Entry category**, write at least 20 characters and select **Save reflection**. Refresh: the text and category should return. A first entry earns 20 XP; editing its text or category should add no further XP for that date.
2. Search for a word from the entry under **Search reflections**, using different capital letters. It should match. Choose another category under **Filter by category**: the entry should disappear from the history. This does not change the open editor. Clear the search and choose **All categories** to see every saved entry. Dates are searchable too; histories longer than ten entries have page controls.
3. Edit the text without saving. Choose another saved date, then return through **Today’s page** or **Unsaved drafts**. The draft and its category should remain. Visit **Study Tools** using the app navigation, then **Return to journal** in the draft reminder. The draft should still be there.
4. With a draft present, try refreshing. When the browser warns about leaving, choose **Stay**, **Cancel**, or the equivalent. Your draft should remain. Select **Discard draft**, then **Keep writing**: nothing should be lost. Repeat and choose **Discard changes**: the editor should return to the saved text/category, or an empty Reflection entry if none was saved.
5. To check failed-save recovery, disconnect Wi-Fi/network after the journal loads, edit sample text and choose **Save reflection**. Expect an error, with the text/category retained. Reconnect and choose **Check saved progress** before retrying: the save may have reached the server. There is no automatic mutation replay.
6. With two tabs or browsers signed into the **same account**, open the same journal date and write a different sample draft in each. Save in the first. In the second, a refresh may immediately show the changed-entry warning; if it still offers **Save reflection**, try saving and confirm that the server rejects the stale edit. The second draft must remain. Open **Review the saved entry** to see the saved text/category; **Replace saved reflection** is enabled only after that review. Choose it to save your draft, or **Discard draft → Discard changes** to use the latest saved entry. A further change in the first tab requires another review before replacement. Neither action adds a second daily reward.
7. Save the sample entry and export from **Profile & Settings**. Keep the file private. Saved reflection categories are included; unsaved drafts are excluded. The existing restore preview/confirmation flow retains destination entries, including their categories. Older version 1 files without categories remain supported and missing imported entries default to Reflection.

## Draft lifetime and privacy

Drafts live only in the current tab's React memory. They survive date changes and internal navigation among journey pages. They are not autosaved, uploaded, exported, or placed in localStorage/sessionStorage. Account entries reach Supabase only after an explicit save or confirmed backup merge; demo entries reach browser storage after an explicit save. Searching and filtering operate on the already loaded saved entries, without sending search words to an API or putting them in the URL.

Save before closing, confirming a reload, signing out, leaving the journey area, switching accounts or restarting the browser. Drafts are not crash recovery. Browser reload/close warnings depend on browser support and user interaction; mobile termination can bypass them. Signing out/leaving the journey layout clears its draft memory. Drafts do not sync between tabs or devices.

Changing date or navigating while a save is in flight preserves newer edits. A successful response clears only the exact draft that was submitted. If later typing created a newer draft, its text/category survive and its base advances only to the revision returned for that successful save. Reverting to the previous saved text/category during a pending save also remains a draft. Failed/uncertain responses retain the draft. Focus refreshes update untouched saved entries without replacing drafts. Discarding requires an explicit confirmation, and removes only the selected date's draft.

## Persistence and safety

`20261022054818_journal_save_protection.sql` adds destination-generated UUID revisions to existing private reflections, without changing their saved text, category or timestamps. A strict `reflect` command includes its selected category and a required nullable `expectedRevision`. The authenticated `save_journal_entry` RPC checks the live session and obtains the existing profile row lock before comparing the saved revision. This serializes first creates as well as edits across tabs/devices. Text or category changes mint a fresh revision, even when content changes back within the same timestamp. New entries remain limited to today; existing historical entries remain editable.

A stale different intent returns an allowlisted conflict without writing entry/reward data. Its write admission still counts. The account provider attempts one read after a definitive conflict, preserves the draft and error, and never replays the mutation. If that read fails, **Check saved progress** retries the read. Exact text/category matches are successful no-ops even with a stale/absent revision, so a committed save with a lost reply can be acknowledged without replacing metadata or awarding XP again. A replacement carries the revision actually reviewed, and the database checks it again.

The old unguarded `save_reflection` and `save_categorized_reflection` functions are no longer executable by PUBLIC, anon or authenticated. Previously loaded clients must refresh; there is no unguarded compatibility fallback. Owner/session RLS, direct-write denial, the existing 20,000-byte command limit, read/write budgets and deletion cascades remain in force. Demo uses the same comparison inside its existing cross-tab Web Lock, reading current storage under that lock. Legacy demo entries use their saved timestamp until their first edit mints a UUID. Snapshots and personal exports retain version 1; the optional revision field is destination metadata, never an imported edit token.

Restore repeats category validation in PostgreSQL before writing anything. Destination records win for both text and category; preview conflicts include category-only differences. Legacy entries acquire Reflection only when newly restored. No new service, public sharing, analytics, privileged application key or AI-generated content is involved.

See [validation evidence](VALIDATION.md) and [the backup policy](BACKUP_AND_RESTORE.md). The synthetic SQL drills are `scripts/verify-journal.sql` and `scripts/verify-journal-conflicts.sql` and must always run inside a transaction that is rolled back. It never targets real journal entries.

## Acceptance checks for save protection

Use sample text of at least 20 characters. No second account or developer tools are required.

1. Refresh FaithQuest, sign in, and open **Reflection Journal** in two tabs. Write different sample drafts for the same date. Save one and follow step 6 above in the other. Your draft must never disappear on conflict. After replacement, revisit the first tab: it should show the newly saved entry.
2. Repeat while changing only **Entry category** in one tab. The other tab must still detect a conflict. Review the saved category before replacing; an edit must not add XP.
3. Create another conflict, review the saved entry, then save a further change from the other tab before replacing. The latest version must win until you review and explicitly replace it again.
4. Check **Discard draft → Keep writing**, then **Discard draft → Discard changes**. The first preserves your draft; the second shows the latest saved entry, not the older version you started from.
5. Disconnect after loading the journal, edit sample text/category and try saving. Reconnect and use **Check saved progress**. Your draft must remain available; retry only after checking. If the save already committed, saving identical text/category again must clear the draft without awarding more XP.
6. Export your account under **Profile & Settings**. Keep the file private. Preview a restore if desired: existing destination entries win, and unsaved drafts are excluded. Do not send private files here.

Automated evidence is in [validation](VALIDATION.md#journal-save-protection-validation). Real-user acceptance of these new checks remains pending.
