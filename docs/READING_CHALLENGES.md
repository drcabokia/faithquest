# Seven-day reading challenges

Implemented in demo and development account modes on 17 October 2026. Open **Reading Challenges** in the app navigation, or follow the challenge link on Dashboard.

## Calendar and reward policy

- Joining is explicit. A challenge starts on today's date in the journey timezone and includes that date plus the next six calendar dates. Enrollment fixes the journey timezone, even before any reading is recorded.
- Complete at least one previously unfinished reading mission on each date. A mission counts only after every assigned chapter is complete. Several missions on one date count as one challenge day. Partial reading, quizzes, reflections and saved verses do not count toward this challenge.
- A mission completed today before joining counts. A mission completed on an earlier date cannot be completed again for a new challenge day. If today's scheduled mission was finished earlier, choose another unfinished mission from My Reading Plan.
- Seven distinct completed dates earn **100 bonus XP once per period**, in addition to normal reading/book rewards. The bonus date is the seventh date. Enrollment and viewing the page earn no XP. Challenge progress does not rate comprehension or spiritual maturity.
- A missed date remains visible; it cannot be shifted or backfilled through a normal reading command. You can continue reading during the period, and start a new period after the seventh date ends. There is no mid-period reset, cancellation, grace day or overlapping enrollment. Existing streak/achievement rules stay separate.
- Joining again during the active period, including another tab or a lost-response retry, returns the same enrollment. New challenges require enough remaining missions for all seven dates, counting today's recorded mission if present. History is limited to 1,000 nonoverlapping periods and displayed ten periods per page.

## Check it now

No F12/developer tools, public domain or extra account are required.

1. Sign in and open **Reading Challenges**. Confirm that the displayed timezone and start/end dates are correct. Nothing should be enrolled until you choose **Start seven-day challenge**.
2. Start once. Expect **0 of 7 dates completed**, or **1 of 7** if you already finished a mission today. There should be seven date cards and no enrollment XP increase. The start button should disappear while this period is active.
3. Choose **Choose an unfinished mission**, then complete all its assigned chapters in Bible Reader. Return to Reading Challenges. Today's card should say **Mission completed**, and progress should be **1 of 7**. Reading only part of a mission should not advance the count. Completing a second mission today can earn its normal mission reward but should keep the challenge at **1 of 7**.
4. Refresh, then visit another app page and return. The same dates/progress should remain. Profile & Settings should show the journey timezone disabled. Demo data stays in this browser; account data follows your sign-in.
5. Export from Profile & Settings and keep the file private. Saved challenge start dates are included; a confirmed restore merges them and reconstructs rewards from chapter-backed mission dates. Older exports without challenges preserve the destination's challenge history. Overlapping periods show a preview error and disable confirmation before uploading; cancel and use a compatible backup. Do not edit personal exports merely to force them to merge.
6. Optional failed-join check, using an account without an active period: after the page loads, disconnect networking and try to start. Expect a visible error, not a false enrollment. Reconnect and use **Check saved progress** before retrying, because the first request may have reached the server. Requests are never replayed automatically.

## Check over seven dates

Tomorrow, complete a different unfinished mission and expect **2 of 7 dates completed**. Continue on each date in the displayed timezone. On the seventh date, a full set should show **Challenge complete!** and **100 challenge XP awarded**. Refreshing or revisiting completed chapters must not add the bonus again. Another challenge becomes available the following date.

If a date is missed, its card says **No mission recorded**. The period still ends on its original date; it remains in history with its actual count and no completion bonus. You can start another period after it ends.

The automated suites verify the seventh-date and missed-date rules with synthetic data; they do not establish your real seven-day browser acceptance. Changing your computer clock does not advance Supabase's calendar and should not be used to validate rewards.

## Privacy, backup and failure boundaries

Enrollment, mission dates and rewards are private to the signed-in account, or local to the labelled demo. No group, leaderboard, public profile, reminder service or journal sharing is added. No privileged application key or new dependency is needed.

Version 1 snapshots/exports have optional `challengeStarts`; legacy files remain valid. A restore accepts only bounded, valid start dates no later than today. Imported periods and the merged destination history must not overlap. Identical starts deduplicate; a different overlapping period rejects the entire merge without changing chapters, entries or rewards. Existing activity dates win. Imported historical enrollments are an explicit recovery path: their progress/rewards are reconstructed from the merged chapter-backed missions, not from claimed completion flags, XP or timestamps. Restored activity is self-reported and is not proof of attendance observed by the service.

Failed/uncertain enrollment or restore leaves a retry path without inventing success. Use **Check saved progress** to resolve a potentially committed request. Account mode uses no local fallback. Demo writes retain their existing browser write lock for tab-safe merges.

Migration `20261017153359_seven_day_reading_challenges.sql` adds the owner/session-scoped enrollment table, live-caller metered join command, private reward reconciliation, snapshot/restore support and timezone guard. Reading completion and restore run under the existing profile lock, with unique `challenge:<start-date>` XP keys. Direct client writes and private-helper calls remain denied. Auth/profile deletion cascades remove enrollments.

For the synthetic database drill, run `scripts/verify-challenges.sql` only inside a transaction that is always rolled back. It never targets real enrollments or progress. See [VALIDATION.md](VALIDATION.md) for evidence and [BACKUP_AND_RESTORE.md](BACKUP_AND_RESTORE.md) for broader recovery limits.

Optional [reading-streak grace](READING_CONSISTENCY.md) is separate from these challenge rules. A grace date never counts as one of the seven required actual mission dates or awards the challenge bonus.
