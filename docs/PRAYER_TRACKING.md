# Private prayer requests

Implemented in the demo and development account integration on 18 October 2026. Open **Prayer Requests** in the main navigation, or visit `http://127.0.0.1:3000/prayers` while the local server is running. A public domain is not required.

## Browser checks

Use sample text for testing. No developer tools or additional account is required for the first six checks.

1. Choose **New prayer request**, enter a title and request, and select **Save prayer request**. Use **Back to prayer requests**, then create a second request. Refresh: both should remain. Your daily journal and XP should be unchanged.
2. Select a prayer’s row and choose **Edit prayer request**. Change its status to **Answered**, save, then use **Back to prayer requests** to check the status filter. Repeat with **Archived**, then **Ongoing**. These labels are your own choices; the app makes no automatic decision about an answer.
3. Choose **Add follow-up**, enter sample text and today's date or an earlier date, and save. Open the request after refreshing: the dated note should remain. Future dates and empty notes cannot be saved. Use **Back to prayer requests**, then search for a word from the follow-up using different capitalization; the request should match. Clear search and filters to see every request.
4. Edit a request without saving. Visit **Study Tools**, then use **Return to Prayer Requests** and, if needed, select its row to resume the draft. Use the **Unsaved drafts** status filter to find drafts quickly. Your draft should remain. Try refreshing and choose **Stay** or **Cancel** when the browser warns. Choose **Discard prayer draft**, then **Keep writing**: nothing should be lost. Repeat and choose **Discard prayer changes** to return to the saved version. Try this with a follow-up draft too.
5. Save a request with a follow-up. Export a fresh private backup under **Profile & Settings**. Return to the request, select **Delete prayer request**, and choose **Keep prayer** to cancel. Repeat and confirm **Delete prayer permanently**. Restore the backup through its preview and ownership confirmation: the missing request, status and notes should return without XP. Existing requests keep their current details and notes when the same ID is imported. Do not share the export or commit it to Git.
6. On a narrow phone window, try creating, searching and opening requests. Forms and action buttons should fit without horizontal scrolling. The single-column list shows ten requests per page; page controls appear for larger collections. Search, status and page position stay in place when returning from a prayer. Each prayer has one row, including when it has an unsaved draft.
7. Optional conflict check: open the same account in two tabs. Edit the same request in both, save one, and return focus to the other (demo updates through browser storage events). The other draft should remain. If its version is stale, saving is blocked; **Review saved prayer** shows the loaded version. **Keep my draft against this version** explicitly rebases the draft, then **Save** applies it. The server checks the revision again, including if another save occurs after review. Deleting a request with a newer saved revision must fail safely too.
8. Optional recovery check: with a draft open, disconnect the network and try saving. Keep the draft, reconnect, and use **Check saved progress** before trying again: the first save may already have committed. A request deleted elsewhere leaves its draft available; **Save as a new prayer** or **Recover as a new prayer** uses a new identity. A recovered follow-up carries its chosen date in the new title.
9. Optional privacy check with an existing second account: the other account should see only its own requests. Fellowship groups must show no prayer titles, statuses, request text or follow-ups.

## Behavior and limits

Requests are separate from the daily Prayer journal category. Several requests can be kept on the same day, without changing the journal's one-entry-per-date or reward rules. Up to 200 requests are retained per journey, including archived ones; each allows 50 append-only follow-ups. Titles allow 120 Unicode characters, requests 2,000, and notes 1,000 after trimming. A note's date uses the journey timezone and cannot be in the future. Edit a request to change its title, wording or status; deleting it also deletes all its follow-ups and requires explicit confirmation.

Search scans request titles, wording, follow-up wording and note dates in memory, including current-tab drafts. Search words and selected request identities are not put in the URL, uploaded as search queries or shared with groups. Saved requests and their drafts share one row; new and recovered drafts have their own row. The **Unsaved drafts** status option finds all drafts. Pending request status edits are reflected in the list and its status filter, with an explicit unsaved label; this does not save the edit.

Drafts stay in React memory in the current tab's journey layout. They survive internal navigation and filters but are excluded from snapshots, requests, browser storage and exports until explicitly saved. Save before confirming reload, closing the browser, signing out or leaving the journey. Browser warnings depend on browser support and prior interaction; drafts are not crash recovery. Request wording remains editable during a pending save and only that exact submitted draft may be cleared by success. Follow-up fields are locked while a write is pending, retaining a stable note ID for an uncertain retry. Failed requests do not automatically replay.

## Persistence and recovery

Migration `20261018143216_private_prayer_tracking.sql` adds owner/session-protected `user_prayers` with command-only mutations and account deletion cascades. `mutate_prayer` verifies the active caller, locks the profile, meters writes, validates bounded fields and dates, and compares a server-generated revision before changing a row. Identical committed intents are no-ops; stale intents leave current data intact and return allowlisted messages. No user/owner argument, privileged application key, notification service, paid dependency or new XP award was introduced.

Version 1 snapshots optionally include saved `prayers`, retaining compatibility with older files. Export includes saved notes and dates. Restore strips server timestamps/revisions, validates all content and merged request limits before any writes, and inserts only missing request IDs with fresh destination timestamps/revisions. Existing whole requests win, including their status and follow-ups. It does not merge additional notes into an existing request or undo a later saved change. Legacy files retain current requests. Existing 5 MB file, matching-plan/timezone and explicit upload-confirmation requirements still apply.

Automated and hosted rollback fixtures establish implementation behavior; actual Google-account browser acceptance remains a separate user check. See [validation evidence](VALIDATION.md), [backup and restore](BACKUP_AND_RESTORE.md), and [the Supabase runbook](SUPABASE_INTEGRATION.md#private-prayer-tracking).

The user subsequently reported successful testing of this phase. Optional conflict, network-recovery and second-account checks are not individually inferred from that general report.

## List and detail flow — 22 October 2026

The redesigned page uses a single-column list with one full-row action per prayer, a short preview, status, last-saved date and a follow-up count when notes exist. Select a row to read the prayer. Editing, adding a note and confirmed deletion happen in that detail view. **Back to prayer requests** replaces the old close action and restores the list’s search, filter and page. Keyboard focus returns to the originating row, or the results summary if that row was removed or no longer matches.

The separate card grid and duplicate draft buttons have been removed. An unsaved prayer or follow-up resumes from the same row instead of creating a second listing. New request creation is available on the list; the detail view shows one back action. Deletion sits below the follow-ups, away from routine editing. Confirmed discard/deletion, stale-version review, before-reload warnings and uncertain-save recovery remain in place.

For this UI update, check the following without developer tools:

1. With several requests, use search and a status filter. Open a row, read it, and go back: the same results should remain. Repeat from page 2 if you have more than ten requests.
2. Edit a prayer, change its wording, and go back without saving. There should be one row labelled **Unsaved changes**. Choose **Unsaved drafts** and reopen it; your wording should remain. Discard still requires confirmation.
3. Start a new prayer, enter a title, and go back. Its **New draft** row should be available in the same list. Resume and save or explicitly discard it.
4. Open a prayer and add a dated follow-up. Save, then return to the list and check its count. Edit and save a status; confirm the filter shows the saved choice. The list should not remain duplicated below the open prayer.
5. Try selecting rows and going back with the keyboard, plus a narrow phone window in either theme. Focus should be visible, row text should fit, and the list should need no sideways scrolling.

The previous user acceptance report applies to the original prayer feature; acceptance of this redesigned list remains pending until reported. No schema, command, reward or backup-format change is introduced.
