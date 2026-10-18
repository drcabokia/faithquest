# Private journal tools

Implemented in the local demo and development Supabase account integration on 17 October 2026. Public deployment and the existing release acceptance gates remain separate.

## Try it in your browser

No developer tools or second test account are needed for these checks. Use sample text rather than sensitive information.

1. Open **Reflection Journal**. Choose **Prayer** under **Entry category**, write at least 20 characters and select **Save reflection**. Refresh: the text and category should return. A first entry earns 20 XP; editing its text or category should add no further XP for that date.
2. Search for a word from the entry under **Search reflections**, using different capital letters. It should match. Choose another category under **Filter by category**: the entry should disappear from the history. This does not change the open editor. Clear the search and choose **All categories** to see every saved entry. Dates are searchable too; histories longer than ten entries have page controls.
3. Edit the text without saving. Choose another saved date, then return through **Today’s page** or **Unsaved drafts**. The draft and its category should remain. Visit **Study Tools** using the app navigation, then **Return to journal** in the draft reminder. The draft should still be there.
4. With a draft present, try refreshing. When the browser warns about leaving, choose **Stay**, **Cancel**, or the equivalent. Your draft should remain. Select **Discard draft**, then **Keep writing**: nothing should be lost. Repeat and choose **Discard changes**: the editor should return to the saved text/category, or an empty Reflection entry if none was saved.
5. To check failed-save recovery, disconnect Wi-Fi/network after the journal loads, edit sample text and choose **Save reflection**. Expect an error, with the text/category retained. Reconnect and choose **Check saved progress** before retrying: the save may have reached the server. There is no automatic mutation replay.
6. Optional, with two browsers signed into the same account: leave a draft in one, edit/save the same date in the other, then return focus to the first. The draft should remain, with a changed-entry warning. **Review the saved entry** shows the current saved text/category. **Replace saved reflection** explicitly saves the draft, or **Discard draft** returns to the server version. This warns about changes already loaded by the browser; it is not a server-enforced edit lock, and simultaneous saves still use the last committed write.
7. Save the sample entry and export from **Profile & Settings**. Keep the file private. Saved reflection categories are included; unsaved drafts are excluded. The existing restore preview/confirmation flow retains destination entries, including their categories. Older version 1 files without categories remain supported and missing imported entries default to Reflection.

## Draft lifetime and privacy

Drafts live only in the current tab's React memory. They survive date changes and internal navigation among journey pages. They are not autosaved, uploaded, exported, or placed in localStorage/sessionStorage. Account entries reach Supabase only after an explicit save or confirmed backup merge; demo entries reach browser storage after an explicit save. Searching and filtering operate on the already loaded saved entries, without sending search words to an API or putting them in the URL.

Save before closing, confirming a reload, signing out, leaving the journey area, switching accounts or restarting the browser. Drafts are not crash recovery. Browser reload/close warnings depend on browser support and user interaction; mobile termination can bypass them. Signing out/leaving the journey layout clears its draft memory. Drafts do not sync between tabs or devices.

Changing date or navigating while a save is in flight preserves newer edits. A successful response clears only the exact draft that was submitted. Failed/uncertain responses retain the draft. Focus refreshes update untouched saved entries without replacing drafts. Discarding requires an explicit confirmation, and removes only the selected date's draft.

## Persistence and safety

`20261017144249_private_journal_categories.sql` adds the constrained `reflection`, `prayer`, `gratitude` and `application` category values to existing private reflections. Snapshots retain version 1 with an optional category for older clients/files. The original two-argument `save_reflection` command preserves an existing category. The new caller-only `save_categorized_reflection` command uses the live session/profile lock and existing write/read budgets, validates category/content/date, and shares the unique per-date XP guard. Existing owner/session RLS, direct-write denial and deletion cascades apply.

Restore repeats category validation in PostgreSQL before writing anything. Destination records win for both text and category; preview conflicts include category-only differences. Legacy entries acquire Reflection only when newly restored. No new service, public sharing, analytics, privileged application key or AI-generated content is involved.

See [validation evidence](VALIDATION.md) and [the backup policy](BACKUP_AND_RESTORE.md). The synthetic SQL drill is `scripts/verify-journal.sql` and must always run inside a transaction that is rolled back. It never targets real journal entries.
