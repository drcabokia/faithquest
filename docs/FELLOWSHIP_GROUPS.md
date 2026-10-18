# Private fellowship groups

Implemented for development account mode on 17–18 October 2026. Open **Community** to create or join a group. A public domain or website is not required for local testing. Demo mode explains the feature and does not create groups, fake members or sharing requests.

## Sharing policy

Each person must explicitly agree before creating or joining a group. Members share their current display name and rounded completion percentage of their own active reading plan with the group's members. Review your display name under Profile & Settings before joining. This is recorded participation, not a rating of faith or understanding. Members are listed alphabetically, with no XP, streak, badge or spiritual rankings.

Journal/prayer text and categories, saved verses, quiz selections, XP, exact reading dates and individual chapter history stay private. Joining does not expand personal-table RLS or award XP. Structural group IDs and owner-only member IDs support management; members receive no other people's member IDs through the summary API.

Groups are invite-only, with up to twenty people. An account can belong to five groups and own two. The owner can rename, rotate the invitation code, remove members or close the group. Members can leave. Ownership transfer and public discovery are not included in this milestone; owners close a group instead of leaving an ownerless group.

Invitation codes are 32 hexadecimal characters, generated from a random UUID. Owners can reveal/copy their current code and share it privately. The app does not send invitations. Anyone signed in who has a current code can join after consent. Codes are not put in URLs, application logs, exports or browser storage. Members cannot fetch the current code; they may still know a code they were given. Rotating a code invalidates the old one without removing current members. Removing a member also rotates it, preventing rejoining with that old code; it is not a permanent ban if someone gives them a new code.

Leaving, removal or closure stops future group access. It cannot erase information already viewed or copied by members. Use **Check saved groups**, or return focus to the tab, to refresh; updates are not realtime notifications.

## Test with your existing two accounts

No F12/developer tools or new test account are needed. Use separate browser profiles or a normal/private browser window so each Google account has its own session. Use sample group names and keep invitation codes/private exports out of chat and screenshots.

1. With account A, open **Community**. Enter a group name under **Create a private group**. The button should stay disabled until you check the sharing consent. Create the group. Expect your name, your recorded plan percentage and owner controls, with no XP increase. Refresh and confirm the group returns.
2. Select **Show invitation code** and copy it. With account B, open Community, paste it under **Join by invitation**, check the separate consent and select **Join group**. Both browsers should show both display names/percentages after **Check saved groups**. Account B should have **Leave group**, without rename, current-code, rotation, removal or closure controls. Private journal and saved-verse pages should still show only the signed-in person's data.
3. Rename the group in A. Refresh groups in B and expect the new name. In A, choose **Rotate invitation code**, then cancel: the code should stay the same. Repeat and confirm rotation: it should change, while B remains a member.
4. In B, choose **Leave group**, then cancel: membership should remain. Confirm leaving, then try the earlier code: expect an unavailable-invitation message and no membership. Use A's current code to join again, with consent.
5. In A, select **Remove [B's display name]**. Cancel once to check that membership stays. Repeat and confirm. The code should change automatically. In B, choose **Check saved groups**: the group should disappear. B's own reading/journal data should remain. A can share the new code privately if B should rejoin.
6. Export account data from Profile & Settings. The file includes your own group IDs/names, roles and joined timestamps. It excludes invitation codes and other members' names/participation. Restoring a personal backup never creates a group or grants membership; current invitations and explicit consent control access.
7. In A, choose **Close group**. Confirmation stays disabled until you type **CLOSE GROUP** exactly. Cancel first if checking cancellation, then confirm closure when you intend to remove the test group. Its memberships and invitation disappear; other members keep their personal reading data. Old codes should stop working. Closing does not delete anyone's account.

## Failure recovery

If an action fails or times out, use **Check saved groups** before retrying. A request may already have committed. Mutations are never replayed automatically, and account mode keeps no browser-storage fallback.

For an interrupted create, the form retains its name/consent and request ID in this tab, with the fields temporarily disabled. A retry reuses that ID, so it cannot create a duplicate group. **Check saved groups** clears the form when the matching saved group is confirmed. A closed group's original create request cannot recreate it. Reopening/navigating away loses this tab's pending form, so inspect saved groups before intentionally creating another.

An optional offline check can use a new group you intend to create: disconnect networking after Community loads, submit, reconnect and choose **Check saved groups**. If the group is absent, **Retry same group creation** submits the retained request. Expect one group and no XP. Shared request limits produce a wait message and retain form inputs. Invalid full-format invitations also consume the shared write allowance; repeated guessing does not get free successful RPC transactions.

## Persistence and security

Migration `20261017155626_private_fellowship_groups.sql` adds explicit sharing-consent timestamps, private invitation/replay metadata, caller-only read/manage RPCs and optional own-membership metadata in version 1 snapshots/exports. Existing memberships are not automatically marked as consented. The development project had no groups/memberships before this migration.

All group commands validate the active Auth session and lock the caller's profile. Mutations then lock the target group before capacity checks, invitation rechecks and changes. Owner authorization uses stored `owner_id`, not a supplied role, profile name or user metadata. Shared read/write budgets apply. Safe domain denials commit admission charges, while quota failures roll back any changes. Creation replay metadata is capped at 1,000 requests per account; closed request records retain no group name/code and are removed on account deletion.

Public group/membership tables retain session/owner/member read policies and no direct client mutation grants. Private tables have RLS with no client policies/grants. Definer routines use empty search paths, explicit authenticated-only execution and private caller helpers. Only consented memberships appear in summaries, and the response schema rejects personal activity and owner-only fields in non-owner responses. The Next.js runtime has no administrative key.

Deleting a member account removes its memberships. Deleting an owner account closes owned groups and removes their invitations/memberships; other people's journeys remain. The deletion review now explains this. No real account was deleted during this milestone's checks.

Personal backups retain own membership metadata for reference, but the restore command deliberately excludes it. Group recovery belongs to whole-project backup procedures, including group, membership and private metadata tables. See [BACKUP_AND_RESTORE.md](BACKUP_AND_RESTORE.md).

The shared `scripts/verify-fellowship.sql` drill uses generated synthetic accounts and must always run inside BEGIN/ROLLBACK. [VALIDATION.md](VALIDATION.md) records automated evidence. Real two-account browser acceptance and the prior production release gates remain pending until explicitly confirmed.
