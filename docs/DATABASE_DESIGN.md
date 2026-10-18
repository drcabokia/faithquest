# Database design

## Tables

- `profiles`: user UUID references Supabase auth; display name, timezone, translation, plan, start date.
- `bible_books`, `bible_chapters`: stable identifiers, canonical order, chapter/verse metadata.
- `reading_plans`, `reading_plan_days`: publication status, positive schedule version, 365-day schedule and chapter references.
- `user_reading_progress`, `user_chapter_progress`: unique user/plan/day and user/book/chapter completions with timestamps and calendar date.
- `xp_transactions`: append-only reward ledger with unique user/activity key and bounded activity reward values.
- `achievements`, `user_achievements`: definitions and unique earned user/achievement pairs.
- `quiz_questions`, `quiz_attempts`: reviewed four-option questions and one attempt per user/question. Keep answer keys unavailable to production clients until submission.
- `reflections`: user/date unique private entries with updated timestamps.
- `groups`, `group_memberships`: future opt-in participation with membership isolation.

## Security

Enable RLS on every exposed table. Public read access is only for reviewed/published reference data. Personal reads require owner identity via `auth.uid()`; writes use restricted authenticated commands rather than direct client table writes. Reflections remain private, including to fellow group members. Group membership must not permit users to join arbitrary private groups or promote themselves.

Reading, quiz results, rewards, and achievement writes use trusted atomic database functions in migration 003. Revoke client ledger writes. A unique reward key is a final concurrency guard, not a substitute for verifying activity. Reviewed answer keys are seeded in the private schema by migration 004; feedback is exposed only for a user's submitted attempt. Embedded PostgreSQL tests execute the schema and commands; hosted migration/auth/privacy acceptance remains a separate release gate.

## Persistence migration

No demo data is uploaded automatically. Production uses a distinct authenticated repository and never stores journals on a Vercel filesystem. Explicit backup import validates data, discloses privacy implications, and recomputes rewards on the server (see [restore policy](BACKUP_AND_RESTORE.md)). Plan/start-date preferences must not erase previously earned progress. Fix the journey timezone after first activity to avoid gaming streak dates.

## Account removal

The development account-deletion Edge Function uses Auth Admin hard deletion after verifying the caller, recent OAuth authentication and current session, then revoking sessions. No public privileged delete RPC or client table-write grant was added. Existing `auth.users → profiles` and profile-to-personal-data foreign keys cascade deletion. Membership rows and owned groups also cascade; fellowship rollout must explicitly review ownership/closure behavior first. The shared rollback-only verification deletes only its randomly generated Auth fixtures, checks personal rows/sessions/groups are removed, the other account retains its 80 XP before its own fixture cleanup, and shared catalogue data is unchanged. This constraint-level evidence is separate from real Auth Admin deletion acceptance.

## Persistent request budgets

`private.request_budgets` stores only user UUID, one of six fixed categories, window start and admitted count, keyed by `(user_id,bucket)` and cascading from Auth deletion. It has RLS with no client policies/grants. Atomic upserts cap counters without extending a denied request's window. Public journey functions preserve their signatures as metered wrappers; the prior implementations are private. All clients are denied direct helper/counter access. Existing profile locking precedes read/write quota locking. A separate safe admission RPC supports export/delete/health without requiring an initialized profile. Current limits, fixed-window behavior and accepted operational limitations are documented in the integration runbook.

## Saved verses

`public.user_saved_verses` stores only `user_id`, canonical `book_id/chapter/verse` and server `saved_at`. The caller-leading composite primary key deduplicates saves and indexes the profile FK; a second `(book_id,chapter)` index covers the chapter FK. Profile deletion cascades the collection. Owner-only authenticated SELECT is combined with a restrictive active-session policy; anonymous SELECT and direct client INSERT/UPDATE/DELETE are revoked.

`public.set_saved_verse` independently validates an available verse and explicit boolean intent, derives the live caller, locks the profile before quota rows, enforces a 1,000-reference collection cap and returns a private snapshot. No reward/reading tables change. Existing chapter verse counts are checked against generated source metadata; the five empty verse numbers are excluded. Private helpers remain non-executable by client roles. The restore RPC also validates references and the union size before applying a whole-batch merge, retaining existing saves. See [study tools](STUDY_TOOLS.md).

## Private journal categories

Migration `20261017144249_private_journal_categories.sql` adds `reflections.category`, NOT NULL with default `reflection` and a four-value CHECK (`reflection`, `prayer`, `gratitude`, `application`). Existing owner/session RLS, grants and Auth/profile deletion cascades apply. `save_categorized_reflection(date,text,text)` derives its actor from the live session, takes the profile lock and write/read budgets, validates content/category/calendar rules and shares the unique reward key. The original two-argument command keeps existing categories. Restore accepts optional validated categories per entry; all rows are validated before mutation, existing destination entries win, and missing legacy categories default to Reflection. Browser-only filtering needs no new index. No draft table is created.

## Reading challenge enrollment and rewards

`20261017153359_seven_day_reading_challenges.sql` creates `user_reading_challenges(user_id,start_date,joined_at)` with `(user_id,start_date)` PK and a profile FK with deletion cascade. Owner and restrictive live-session SELECT policies apply; authenticated clients have no INSERT/UPDATE/DELETE. No additional FK index is needed because the PK begins with user_id.

`join_reading_challenge()` derives today's date/timezone and caller from the active session, locks the profile and consumes the shared write/read budgets. It reuses any current period, caps history at 1,000 and requires enough unfinished missions; it accepts no supplied user, clock, date or reward. Profile locking serializes joins/restores so their nonoverlapping-period checks cannot race. The timezone/plan guard includes enrollment as calendar activity.

The private zero-argument reconciler counts distinct authoritative mission completion dates in each seven-date window, requires its end date no later than today and inserts one `challenge:<start_date>` 100 XP reward with the seventh date. Completion and restore invoke it inside their transactions. Snapshots export start dates only; restore independently validates all optional start dates and the merged nonoverlapping union before writes, inserts missing periods and reconstructs rewards. Caller-supplied completion/XP/timestamps remain outside the restore contract. See [READING_CHALLENGES.md](READING_CHALLENGES.md).

## Private fellowship commands and invitations

Migration `20261017155626_private_fellowship_groups.sql` adds `group_memberships.sharing_consent_at`, private `group_invites(group_id,code)` and `group_creation_requests(user_id,request_id,group_id)`. Existing records receive no automatic consent. Private tables have RLS with no client policies/grants; PKs cover caller/group FKs and the creation-target FK has an additional index. Group/membership direct mutations remain revoked, with existing session/owner/member reads retained.

`get_fellowship()` and `manage_fellowship(jsonb)` require a live caller/profile and use shared read/write budgets. Commands accept no caller-selected owner, role or participation. Group mutations lock caller profile then target group, recheck invitations after locking and serialize limits: two owned groups, five memberships and twenty members. Consent is required for create/join. Summary percentages derive from authoritative canonical mission counts, rounded to an integer, and members are ordered by display name. No journal, verse, quiz, XP or exact reading-date data enters summaries. Owners alone receive current invitation/replay/member-management IDs.

Private UUID-based invitation codes rotate on demand or removal. Close cascades remove memberships/invitations; creation references become null, retaining a bounded replay tombstone so the original create request cannot resurrect a closed group. Replay records are capped at 1,000 per account and Auth deletion cascades remove them. Public routines/private helpers use empty search paths and explicit execution grants/revocations. Domain denials commit budget charges without activity changes; quota failures are transactional. No group action awards XP.

Snapshots optionally export only the caller's own memberships with group name, role and joined timestamp. This metadata is excluded from restore commands; memberships can only be granted through live consented commands. See [FELLOWSHIP_GROUPS.md](FELLOWSHIP_GROUPS.md).

## Reading-plan choice

Migration `20261018095416_reading_plan_choices.sql` adds `reading_plans.schedule_version` (existing plans default to 1) and a complete Balanced v1 seed without changing any existing profile. Authenticated `select_reading_plan(text)` accepts only the published canonical/balanced v1 allowlist, takes the caller profile lock, meters writes and returns a metered snapshot. Any saved calendar activity fixes the plan; requests to select the already active plan are idempotent. Anonymous and revoked-session mutations remain denied. No direct table-write grant or new table was added. The snapshot includes the slug/version as top-level `readingPlan`; legacy exports default to canonical v1.

Reading rewards use legacy keys for Canonical and plan-qualified keys for Balanced. Restore validates plan identity before activity inserts and derives rewards from the selected schedule. Reviewed quiz IDs/solutions remain shared; eligibility validates the source chapter against the active schedule rather than canonical authoring day metadata. `verify-reading-plans.sql` exercises these rules with generated accounts inside a rolled-back transaction, including challenge reconciliation and fellowship percentage.

The follow-up `20261018100047_reading_plan_quiz_publication.sql` retains a second eligibility condition: shared questions must belong to a published source plan, as well as have a source chapter in the active plan. This prevents source-plan drafts from becoming callable merely because another plan covers the same chapter. Both quiz submission and backup restore enforce the condition; the shared synthetic fixture verifies rejection without partial writes.

## Private saved-verse note columns

Migration `20261018131824_private_verse_notes.sql` extends `user_saved_verses` with nullable `note` (trimmed, 1–2,000 Unicode characters) and paired `note_updated_at`. It reuses the owner-leading primary key, chapter index, RLS/session policies, command-only writes and profile cascade. `set_verse_note` checks the expected saved text while holding the caller profile lock; null text deletes only the note. Same-intent requests preserve timestamps, conflicts preserve current text, and `set_saved_verse` rejects removing a note-bearing row.

Snapshots carry optional `verseNotes` with text/update time per saved reference. Restore accepts only text paired with explicitly included saved references, validates every note before activity writes, merges only absent notes and generates destination timestamps. Existing notes and legacy backups are preserved. The combined embedded/hosted drill now includes `verify-verse-notes.sql`, covering owner/session boundaries, direct-write denial, conflicts, quotas, rollback and cascades.
