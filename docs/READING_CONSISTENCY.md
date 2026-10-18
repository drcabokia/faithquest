# Reading consistency and optional grace days

Implemented in demo and development accounts on 18 October 2026. **Your reading rhythm** appears on Dashboard and My Reading Plan. A public domain is not required.

## Policy

- Catch-up guidance chooses the earliest unfinished mission in the selected Canonical or Balanced plan and resumes at its first unread chapter. Past missions remain available; completing one records today's journey-timezone date. Missions are never backdated by the catch-up link.
- Grace is an optional, explicit claim for yesterday only. Yesterday must have no completed mission and the preceding date must have at least one completed mission. This protects an existing rhythm; it does not create a reading record.
- Grace dates must be at least 30 calendar days apart: a date exactly 30 days after the last grace date can qualify, while 29 days cannot. Days are measured in the fixed journey timezone, including across month, year, leap-day and daylight-saving boundaries.
- A grace date bridges continuity in the displayed streak. The number remains the actual reading-day count in that continuous stretch; the separate caption reports grace dates. Grace adds no XP, mission completion, achievement progress or seven-day challenge credit. Seven actual consecutive reading dates are still required for the week badge.
- Read today to continue the protected rhythm. A second consecutive missed day breaks it, because adjacent grace dates are not allowed. Grace has no accumulating balance, automatic claim, mid-window reset or delete/refund control.
- Claims are idempotent. Concurrent tabs or an explicit retry of a committed date cannot create a second record or reward. An open confirmation captures its date; it cannot silently switch to a different missed day after midnight.
- Up to 1,000 grace dates are retained. The recent calendar labels completed missions and grace explicitly; saved history shows ten dates per page. If restored reading also covers a grace date, actual reading takes precedence in the displayed count, the historical grace remains visible, and its cooldown is retained.

## Browser checks without developer tools

1. Open **Dashboard** and find **Your reading rhythm**. Check **Next unfinished mission**, then select **Continue next unfinished mission**. It should open the earliest unfinished day and its first unread chapter. Read and complete the mission normally: its completion date is today, and the usual reward is awarded only once. Repeat from **My Reading Plan**. If all 365 missions are finished, the section should say so.
2. Review the seven-date calendar and its timezone. Partial chapter reading is not a completed mission. Saved grace dates have a distinct label and dashed border; they do not fill a mission or challenge date.
3. If **Use grace for yesterday** is available, select it and then **Cancel grace**. No date or reward should be added. Repeat and choose **Confirm grace day**: yesterday should appear in saved grace history. XP, completed missions and badges should remain unchanged. Refresh: the date should remain and another claim for it should be unavailable.
4. If the option is unavailable, read its explanation. You can still test catch-up, calendar and phone layout immediately. To qualify naturally, complete a mission on one date, miss the next date and return the following date. A recent grace may also mean the 30-day cooldown has not elapsed. Automated fixtures cover these rules without changing a real account's history or the computer clock.
5. Export a fresh private backup from **Profile & Settings**. Selecting the file for restore should preview missing grace dates alongside activity. On the same up-to-date journey, zero missing grace dates is expected. Cancel if nothing needs recovery. Do not delete or reset real progress to manufacture a missing record; isolated fixtures already verify grace-only recovery and merged-history rejection.
6. Optional with two tabs on the same account: open an eligible grace confirmation in both and confirm. Only one saved date should remain, with no new XP. If a tab becomes stale, return focus or use **Check saved progress**; it should display the saved result or a safe eligibility explanation.
7. Optional network check while eligible: disconnect, confirm, reconnect and use **Check saved progress** before trying again. The first request may have committed. Recovery reads current progress; it never automatically replays a claim. An uncertain response does not justify claiming a different date.
8. At phone width, check calendar wrapping, catch-up links, confirmation buttons and history paging. Try light/dark appearance through existing settings. No horizontal scrolling should be needed.

Use sample data where appropriate, and keep personal JSON exports private. They include other saved journal/prayer content as well as grace dates. Actual account browser acceptance is a separate user check; automated fixtures do not establish that acceptance.

## Backup, privacy and implementation

Version 1 snapshots optionally include sorted `graceDates`, preserving older backup compatibility. Restore merges unique dates while retaining destination history. Every imported date must be before today, have a completed mission on the preceding date in the merged reading history, and obey the 30-day spacing and 1,000-date limit across the entire merged collection. Prior mission dates are derived from destination-first chapter records and existing authoritative mission completions; imported day/XP assertions are not accepted. Historical restore is the explicit exception to the normal yesterday-only claim rule. Any invalid union rejects the entire restore without partial reading writes. Old backups do not erase grace history.

Migration `20261018152042_reading_consistency_grace_days.sql` adds `user_grace_days` with owner/active-session RLS, command-only writes, the existing per-account request limits and account deletion cascades. `claim_grace_day` derives identity and today from the live caller and saved timezone, holds the caller profile lock, checks eligibility and returns a metered snapshot. It accepts a captured date, never an owner ID or reward claim. Grace history does not enter fellowship summaries. No paid service, public website, notification service, dependency or active reading-plan identity was added.

See [validation evidence](VALIDATION.md), [backup policy](BACKUP_AND_RESTORE.md), and [the integration runbook](SUPABASE_INTEGRATION.md#reading-consistency-and-grace-days). A future five-day weekly journey still needs its own calendar and challenge policy; unassigned rest days are not implemented by this phase.
