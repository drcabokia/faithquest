-- FaithQuest365 production preparation. Apply only to a reviewed Supabase project.
-- This migration intentionally does not connect the demo or grant activity/XP writes.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;

create table public.bible_books (
 id text primary key check (id ~ '^[1-3]?[A-Z]{2,3}$'),
 name text not null, canonical_order smallint not null unique check (canonical_order between 1 and 66),
 testament text not null check (testament in ('OT','NT')), chapter_count smallint not null check (chapter_count > 0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.bible_chapters (
 book_id text not null references public.bible_books(id), chapter smallint not null check (chapter > 0),
 verse_count smallint not null check (verse_count > 0), primary key (book_id, chapter),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.reading_plans (
 id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null,
 description text not null, canon text not null, duration_days smallint not null default 365 check (duration_days = 365),
 published boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.reading_plan_days (
 plan_id uuid not null references public.reading_plans(id), day smallint not null check (day between 1 and 365),
 primary key(plan_id, day), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.reading_plan_day_chapters (
 plan_id uuid not null, day smallint not null, book_id text not null, chapter smallint not null,
 position smallint not null check (position > 0), primary key(plan_id, day, position),
 unique(plan_id, book_id, chapter),
 foreign key(plan_id, day) references public.reading_plan_days(plan_id, day),
 foreign key(book_id, chapter) references public.bible_chapters(book_id, chapter),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check (char_length(trim(display_name)) between 1 and 50),
 avatar_url text, timezone text not null default 'UTC', preferred_translation text not null default 'WEB',
 reading_plan_id uuid references public.reading_plans(id), start_date date not null default current_date,
 theme text not null default 'system' check(theme in ('light','dark','system')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.user_reading_progress (
 user_id uuid not null references public.profiles(id) on delete cascade, plan_id uuid not null,
 day smallint not null, completion_date date not null, completed_at timestamptz not null default now(),
 primary key(user_id, plan_id, day), foreign key(plan_id, day) references public.reading_plan_days(plan_id, day),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.user_chapter_progress (
 user_id uuid not null references public.profiles(id) on delete cascade, book_id text not null, chapter smallint not null,
 completion_date date not null, completed_at timestamptz not null default now(),
 primary key(user_id, book_id, chapter), foreign key(book_id, chapter) references public.bible_chapters(book_id, chapter),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.xp_transactions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 activity_key text not null check(char_length(activity_key) between 1 and 120),
 activity_type text not null check(activity_type in ('reading','quiz','reflection','memory','challenge','book')),
 amount smallint not null check(amount = case activity_type when 'reading' then 50 when 'quiz' then 10 when 'reflection' then 20 when 'memory' then 30 when 'challenge' then 100 when 'book' then 150 end),
 activity_date date not null, unique(user_id, activity_key),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.achievements (
 id text primary key, name text not null, description text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.user_achievements (
 user_id uuid not null references public.profiles(id) on delete cascade, achievement_id text not null references public.achievements(id),
 earned_at timestamptz not null default now(), primary key(user_id, achievement_id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.quiz_questions (
 id text primary key, plan_id uuid not null, day smallint not null,
 question text not null, options jsonb not null check(jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4),
 scripture_reference text not null, reviewed boolean not null default false,
 foreign key(plan_id, day) references public.reading_plan_days(plan_id, day),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
-- Answer keys/explanations are not in the public API schema.
create table private.quiz_answers (
 question_id text primary key references public.quiz_questions(id),
 correct_option smallint not null check(correct_option between 0 and 3), explanation text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.quiz_attempts (
 user_id uuid not null references public.profiles(id) on delete cascade, question_id text not null references public.quiz_questions(id),
 selected_option smallint not null check(selected_option between 0 and 3), is_correct boolean not null,
 attempted_at timestamptz not null default now(), primary key(user_id, question_id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.reflections (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 reflection_date date not null, content text not null check(char_length(trim(content)) between 20 and 10000),
 unique(user_id, reflection_date),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.groups (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete cascade,
 name text not null check(char_length(trim(name)) between 1 and 80),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.group_memberships (
 group_id uuid not null references public.groups(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 role text not null default 'member' check(role in ('member','leader')),
 primary key(group_id,user_id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create index reading_progress_calendar on public.user_reading_progress(user_id,completion_date);
create index chapter_progress_book on public.user_chapter_progress(user_id,book_id);
create index xp_user_date on public.xp_transactions(user_id,activity_date);
create index reflections_user_date on public.reflections(user_id,reflection_date desc);
create index quiz_questions_day on public.quiz_questions(plan_id,day);
create index quiz_attempts_question on public.quiz_attempts(question_id);
create index membership_user on public.group_memberships(user_id);
create index group_owner on public.groups(owner_id);
create index profiles_plan on public.profiles(reading_plan_id);
create index plan_chapters_reference on public.reading_plan_day_chapters(book_id,chapter);
create index user_achievement_definition on public.user_achievements(achievement_id);

-- Start with no client access; explicitly grant only the documented surface.
do $$ declare t text; begin
 foreach t in array array['bible_books','bible_chapters','reading_plans','reading_plan_days','reading_plan_day_chapters','profiles','user_reading_progress','user_chapter_progress','xp_transactions','achievements','user_achievements','quiz_questions','quiz_attempts','reflections','groups','group_memberships'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on table public.%I from anon, authenticated',t);
  execute format('create trigger touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()',t);
 end loop;
end $$;
alter table private.quiz_answers enable row level security;
revoke all on private.quiz_answers from public, anon, authenticated;
create trigger touch_updated_at before update on private.quiz_answers for each row execute function public.touch_updated_at();

grant select on public.bible_books,public.bible_chapters,public.reading_plans,public.reading_plan_days,public.reading_plan_day_chapters,public.achievements,public.quiz_questions to anon,authenticated;
create policy books_read on public.bible_books for select to anon,authenticated using(true);
create policy chapters_read on public.bible_chapters for select to anon,authenticated using(true);
create policy plans_published on public.reading_plans for select to anon,authenticated using(published);
create policy days_published on public.reading_plan_days for select to anon,authenticated using(exists(select 1 from public.reading_plans p where p.id=plan_id and p.published));
create policy assignments_published on public.reading_plan_day_chapters for select to anon,authenticated using(exists(select 1 from public.reading_plans p where p.id=plan_id and p.published));
create policy achievement_catalogue on public.achievements for select to anon,authenticated using(true);
create policy questions_reviewed on public.quiz_questions for select to anon,authenticated using(reviewed and exists(select 1 from public.reading_plans p where p.id=plan_id and p.published));

grant select,insert,update on public.profiles to authenticated;
create policy profile_read on public.profiles for select to authenticated using((select auth.uid())=id);
create policy profile_create on public.profiles for insert to authenticated with check((select auth.uid())=id);
create policy profile_edit on public.profiles for update to authenticated using((select auth.uid())=id) with check((select auth.uid())=id);

grant select,insert,update,delete on public.reflections to authenticated;
create policy reflection_read on public.reflections for select to authenticated using((select auth.uid())=user_id);
create policy reflection_create on public.reflections for insert to authenticated with check((select auth.uid())=user_id);
create policy reflection_edit on public.reflections for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy reflection_delete on public.reflections for delete to authenticated using((select auth.uid())=user_id);

-- Activity and rewards are readable by their owner, writable only by future trusted RPCs.
do $$ declare t text; begin
 foreach t in array array['user_reading_progress','user_chapter_progress','xp_transactions','user_achievements','quiz_attempts','group_memberships'] loop
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy owner_read on public.%I for select to authenticated using((select auth.uid())=user_id)',t);
 end loop;
end $$;
grant select on public.groups to authenticated;
create policy group_member_read on public.groups for select to authenticated using(owner_id=(select auth.uid()) or exists(select 1 from public.group_memberships m where m.group_id=id and m.user_id=(select auth.uid())));

-- A server must derive timezone dates and verify source activity before awarding XP.
-- No client RPC exists yet. Do not enable production write flows until that release gate passes.
commit;
