# Database design

## Tables

- `profiles`: user UUID references Supabase auth; display name, timezone, translation, plan, start date.
- `bible_books`, `bible_chapters`: stable identifiers, canonical order, chapter/verse metadata.
- `reading_plans`, `reading_plan_days`: publication status, 365-day schedule and chapter references.
- `user_reading_progress`, `user_chapter_progress`: unique user/plan/day and user/book/chapter completions with timestamps and calendar date.
- `xp_transactions`: append-only reward ledger with unique user/activity key and bounded activity reward values.
- `achievements`, `user_achievements`: definitions and unique earned user/achievement pairs.
- `quiz_questions`, `quiz_attempts`: reviewed four-option questions and one attempt per user/question. Keep answer keys unavailable to production clients until submission.
- `reflections`: user/date unique private entries with updated timestamps.
- `groups`, `group_memberships`: future opt-in participation with membership isolation.

## Security

Enable RLS on every exposed table. Public read access is only for reviewed/published reference data. Personal reads/writes require `auth.uid() = user_id`. Reflections remain private, including to fellow group members. Group membership must not permit users to join arbitrary private groups or promote themselves.

Reading, quiz results, rewards, and achievement writes need trusted atomic database functions or server transactions. Revoke client ledger writes. A unique reward key is a final concurrency guard, not a substitute for verifying activity. Production quiz answer keys need a private schema or protected server access. See migrations for the concrete preparation schema; live auth/RPC integration and database execution tests are a separate release gate.

## Persistence migration

No demo data is uploaded automatically. Production uses a distinct authenticated repository and never stores journals on a Vercel filesystem. A later explicit import must validate data, disclose privacy implications, and recompute rewards on the server. Plan/start-date preferences must not erase previously earned progress. Fix the journey timezone after first activity to avoid gaming streak dates.
