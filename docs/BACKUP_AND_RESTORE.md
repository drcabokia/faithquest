# Backup and restore

Implemented for local demo journeys and signed-in development accounts on 16–17 October 2026. No automatic backup schedule, paid recovery feature or whole-project restore was enabled.

## Keep a personal backup

1. Open **Profile & Settings** and choose **Export account data** (or **Export demo backup**).
2. Keep the downloaded JSON in a private location. It includes reflection text and is not encrypted by FaithQuest. Account export fetches the latest server snapshot; a failed export does not substitute an older copy.
3. Export again after important progress. Exporting does not delete anything.

## Restore missing activity

1. Sign into the intended account, or open the intended demo browser. Save a fresh export first.
2. Under **Restore a backup**, choose the JSON file. The file is read and validated locally; selecting or cancelling does not upload it.
3. Review the missing chapter, quiz-answer, reflection and saved-verse counts. Conflicting reflection text and categories stay as currently saved. Your display name, start date, timezone, appearance and reading position also stay as currently saved.
4. Check the ownership/account confirmation and choose **Confirm merge**. In account mode this uploads the selected activity and private reflections to the signed-in account. Demo mode saves only in this browser.
5. Refresh and check your progress. Importing the same activity again adds no duplicate rewards. If all entries already exist, confirmation is disabled.

Version 1 JSON exports from either mode are supported. There is no automatic transfer from demo storage into an account. Files are limited to 5 MiB, valid canonical chapter IDs, known reviewed question IDs, 20–10,000 characters per reflection at most 3,660 reflection dates, and up to 1,000 saved verse references in the merged collection. A large export exceeding the import limit must be retained for safekeeping; importing larger files is not supported in this milestone. Invalid/unsupported data rejects the entire restore. Future activity dates are rejected. Files from a newer catalogue may need a newer app release.

The backup timezone must exactly match the destination journey timezone. For an empty account, set the matching timezone in reading preferences before restoring. An active journey's timezone stays fixed; importing a different calendar must not silently move activity between days.

Restoration is a merge, not a destructive replacement. Existing chapter dates, reflections and first quiz answers win, including entries saved on another device after the preview. Preview counts are based on the currently loaded state. To recover an older conflicting reflection, keep the backup and review/edit that entry yourself; automatic overwrite is deliberately absent.

## Rewards and failure recovery

Backup XP, completed-day claims, achievement IDs, correctness flags, explanations and timestamps are not trusted. The application sends only chapter dates, selected answers, reflection dates/text and optional categories, timezone and optional saved verse references. Saved-verse import timestamps are recreated at the destination; older backups without the field keep the existing collection. Saved verses earn no XP. PostgreSQL independently validates the same bounded command and derives the actor from the live signed session. It never accepts a destination user ID.

Missing missions are reconstructed only when every assigned chapter is present; their date is the latest of those chapter dates. Completed books are reconstructed from all their chapters. Quiz selections are checked against private reviewed solutions, with existing attempts immutable. Reading/book/quiz/reflection awards use the existing 50/150/10/20 XP rules and unique activity keys. Existing authoritative awards remain unchanged. Missing achievements are recalculated. Restored historical reflections are an explicit exception to the normal “new entries are for today” command; their date earns at most one reflection award. Chapter completion and imported activity are self-reported, not proof of comprehension.

Account restores are atomic, serialized with the caller's other journey commands, and limited to three successful operations per fifteen-minute window, also using the shared write/read budgets. Rejected or rolled-back operations do not consume a successful-operation charge. The independent read budget remains available for recovery. A quota failure changes no activity.

After a timeout or lost response, use **Check saved progress** before retrying. The operation may already have committed. The client does not automatically replay mutations or keep a local account-data fallback. Your backup stays available if browser storage or the account service is unavailable.

## Whole-project recovery before public launch

Personal JSON backups recover one journey's activity; they do not contain Auth identities, credentials, schema, other users or provider settings. A signed-in account must already exist before personal import. Do not describe these exports as a complete service backup.

Supabase's [database backup guide](https://supabase.com/docs/guides/platform/backups) describes plan-dependent daily backups/PITR and recommends off-site logical exports for Free projects. Database backups do not include Storage object contents. Confirm the actual project plan and available recovery window in the Dashboard; neither paid backups nor a schedule were configured here.

Before launch, the project owner should:

1. Select a private encrypted destination, retention period, backup frequency and acceptable data-loss/recovery windows. Keep journal and Auth backups out of Git and application logs.
2. Prepare a complete provider-supported database backup, including the application/private data and required Auth identities. Follow the current [Supabase CLI backup/restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) for managed-schema/role handling; discover CLI flags with `--help`. Separately inventory provider configuration, OAuth redirect URLs, deployed functions/secrets and any future Storage files. Do not put secrets in the runbook.
3. Restore into a separate disposable project first. Verify migration history, 66 books/1,189 chapters, Canonical and Balanced v1 each with 365 days/1,189 assignments, and 60 published questions, caller-only sessions, two-account isolation, private answer keys and unique rewards. Run the synthetic verification scripts only inside a transaction that is always rolled back, against a deliberately selected development target. They create minimal synthetic Auth fixtures; they do not establish real OAuth recovery.
4. Test Google sign-in and session renewal with disposable users in that recovered project. Check a private reflection round trip and revoked-session denial, without posting journal content or credentials into a report. Record duration, backup timestamp, data counts and outcome.
5. Only after a successful rehearsal, plan a reviewed cutover/downtime window. Whole-project restoration can overwrite newer data and interrupt service; it is not triggered by the personal restore control.

The whole-project disaster-recovery rehearsal and automatic off-site backups remain production gates. The implemented drill exercises reconstruction, validation, isolation and retry safety with synthetic journeys in embedded and hosted PostgreSQL, always rolling back hosted fixtures.

Journal categories are optional in version 1 backups. Newly restored legacy entries default to Reflection; existing destination text/category always win. Preview conflicts include category-only differences. Unsaved drafts are never exported. See [journal tools and draft lifetime](JOURNAL_TOOLS.md).

## Challenge history recovery

Version 1 exports optionally include `challengeStarts`, at most 1,000 nonoverlapping seven-date starts. Older files without this field keep the current history. Identical start dates deduplicate. A different overlapping period blocks the preview/confirmation and rejects the entire server merge; no activity is partially imported. Choose a compatible backup rather than forcing a conflicting calendar. Valid restored historical enrollments can recover a 100 XP bonus only when the merged chapter-backed missions cover every date in that period; claimed completion, XP and enrollment timestamps are not trusted. This is self-reported activity recovery, not proof of server-observed attendance. See [the calendar policy](READING_CHALLENGES.md).

## Fellowship membership metadata

Account exports optionally include `fellowshipMemberships`: only your own group IDs/names, role and joined time. No invitation codes, other members' names/participation or replay metadata are included. This is reference information, not an access credential. Personal restoration excludes membership metadata and never creates/rejoins a group; use a current invitation and consent in Community. Group closure/removal must not be undone by importing an older personal file.

Whole-project recovery must include groups, consented memberships and the private invitation/creation-request tables alongside Auth/profile data. Rehearse invitation rotation, owner/member authorization and cascades in a separate disposable recovery project. No whole-project recovery or automatic off-site schedule was run by this milestone. See [the fellowship guide](FELLOWSHIP_GROUPS.md).

## Reading plan compatibility

Exports now include top-level `readingPlan` (`canonical-v1` or `balanced-v1`). Version 1 files without that field mean canonical v1. A backup must match the destination plan and timezone, even for an empty destination; import never selects a plan automatically. Unknown versions and cross-plan merges are rejected before any writes. Preview rechecks compatibility against the currently loaded journey, and the server rechecks inside the restore transaction. Existing canonical history and `reading:<day>` reward keys are preserved. Balanced rewards use `reading:balanced-v1:<day>` and are reconstructed from its own assignments.

The Chronological Journey **draft schedule** download is a public editorial review artifact, not a personal export. It contains chapter references and placement notes, no private progress or reflection data, and a separate `kind` rather than a journey state version. Personal restore rejects it before upload in the browser and rejects its shape at the API boundary. Downloading that schedule never selects a plan or creates journey activity.

The quiz catalogue now includes stable IDs through canonical day 30. Legacy backups remain valid; normalization recognizes all 60 published question IDs and sends only the selected option/date for an attempt. Account restore derives correctness and feedback from private answer keys and never trusts imported XP or explanations. Destination attempts win conflicts, including incorrect first answers. The expanded synthetic drill restores all 32 new question IDs into a fresh matching-plan fixture and repeats the merge without duplicate XP.

## Private verse note recovery

Optional version 1 `verseNotes` maps a saved reference to its personal text and last-update timestamp in exports. The restore command normalizes this to reference-to-text pairs, strips all timestamps, and requires each reference in its `savedVerses` array. Blank/oversized notes, non-text values, orphan references or forged fields reject the whole restore. Notes are bounded to 2,000 Unicode characters per saved reference, within the existing 1,000-verse collection limit and 5 MB backup-file bound.

The preview counts missing notes separately from missing saved references, enabling a note-only merge when its verse is already saved. Existing destination note text wins, including when another device saves before confirmation. Missing notes receive the destination's current timestamp. Legacy backups preserve current notes; explicit recovery from an older file can re-add a deleted note. Unsaved note drafts stay outside all exports/restores. See [private-note testing](STUDY_TOOLS.md#private-verse-notes).
