-- Optional grace dates preserve displayed continuity, never reading credit.
begin;
create table public.user_grace_days (
 user_id uuid not null references public.profiles(id) on delete cascade,
 grace_date date not null check(isfinite(grace_date)),
 created_at timestamptz not null default now(),
 primary key(user_id,grace_date)
);
alter table public.user_grace_days enable row level security;
revoke all on table public.user_grace_days from public,anon,authenticated;
grant select on table public.user_grace_days to authenticated;
create policy grace_owner on public.user_grace_days for select to authenticated using((select auth.uid())=user_id);
create policy active_session on public.user_grace_days as restrictive for select to authenticated using((select public.account_session_active()));
create or replace function private.guard_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.timezone) then raise exception 'Invalid timezone' using errcode='22023'; end if;
 if new.start_date > (now() at time zone new.timezone)::date then raise exception 'Future start date' using errcode='22023'; end if;
 if new.reading_plan_id is null or not exists(select 1 from public.reading_plans where id=new.reading_plan_id and published and slug in ('canonical','balanced') and schedule_version=1) then raise exception 'Unavailable plan' using errcode='22023'; end if;
 if tg_op='UPDATE' and (old.timezone<>new.timezone or old.reading_plan_id<>new.reading_plan_id) and (
 exists(select 1 from public.user_reading_progress where user_id=old.id) or exists(select 1 from public.reflections where user_id=old.id) or exists(select 1 from public.user_reading_challenges where user_id=old.id) or exists(select 1 from public.user_chapter_progress where user_id=old.id) or exists(select 1 from public.xp_transactions where user_id=old.id) or exists(select 1 from public.quiz_attempts where user_id=old.id) or exists(select 1 from public.user_grace_days where user_id=old.id)) then
 raise exception 'Journey timezone and plan are fixed after activity' using errcode='22023'; end if;
 return new;
end $$;
create or replace function private.get_journey() returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid := private.actor(); result jsonb;
begin
 select jsonb_strip_nulls(jsonb_build_object(
 'version',1,
 'readingPlan',(select slug||'-v'||schedule_version from public.reading_plans where id=p.reading_plan_id),
 'fellowshipMemberships',coalesce((select jsonb_agg(jsonb_build_object('groupId',g.id,'name',g.name,'role',case when g.owner_id=actor then 'owner' else 'member' end,'joinedAt',to_char(m.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) order by g.id) from public.group_memberships m join public.groups g on g.id=m.group_id where m.user_id=actor),'[]'::jsonb),
 'graceDates',coalesce((select jsonb_agg(grace_date order by grace_date) from public.user_grace_days where user_id=actor),'[]'::jsonb),
 'challengeStarts',coalesce((select jsonb_agg(start_date order by start_date) from public.user_reading_challenges where user_id=actor),'[]'::jsonb),
 'savedVerses',coalesce((select jsonb_object_agg(book_id||'.'||chapter||'.'||verse,to_char(saved_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) from public.user_saved_verses where user_id=actor),'{}'::jsonb),
 'prayers',coalesce((select jsonb_object_agg(id,jsonb_build_object('title',title,'text',content,'status',status,'followUps',follow_ups,'revision',revision,'createdAt',to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'updatedAt',to_char(updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))) from public.user_prayers where user_id=actor),'{}'::jsonb),
 'verseNotes',coalesce((select jsonb_object_agg(book_id||'.'||chapter||'.'||verse,jsonb_build_object('text',note,'updatedAt',to_char(note_updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))) from public.user_saved_verses where user_id=actor and note is not null),'{}'::jsonb),
 'profile',jsonb_build_object('name',p.display_name,'startDate',p.start_date,'timeZone',p.timezone,'theme',p.theme),
 'chapters',coalesce((select jsonb_object_agg(book_id||'.'||chapter,completion_date) from public.user_chapter_progress where user_id=actor),'{}'::jsonb),
 'days',coalesce((select jsonb_object_agg(day,completion_date) from public.user_reading_progress where user_id=actor and plan_id=p.reading_plan_id),'{}'::jsonb),
 'rewards',coalesce((select jsonb_object_agg(activity_key,jsonb_build_object('amount',amount,'date',activity_date)) from public.xp_transactions where user_id=actor),'{}'::jsonb),
 'attempts',coalesce((select jsonb_object_agg(question_id,jsonb_build_object('answer',selected_option,'correct',is_correct,'date',(attempted_at at time zone p.timezone)::date,'correctOption',correct_option,'explanation',explanation)) from public.quiz_attempts where user_id=actor),'{}'::jsonb),
 'reflections',coalesce((select jsonb_object_agg(reflection_date,jsonb_build_object('text',content,'category',category,'updatedAt',to_char(updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))) from public.reflections where user_id=actor),'{}'::jsonb),
 'earnedAchievements',coalesce((select jsonb_agg(achievement_id order by achievement_id) from public.user_achievements where user_id=actor),'[]'::jsonb),
 'resume',case when p.resume_book is not null then jsonb_build_object('book',p.resume_book,'chapter',p.resume_chapter) end
 )) into result from public.profiles p where p.id=actor;
 return result;
end $$;

create function public.claim_grace_day(p_date date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.actor(); today date; plan uuid;
begin
 perform private.enforce_request_limit('write');
 select (now() at time zone timezone)::date,reading_plan_id into today,plan from public.profiles where id=actor;
 -- A committed claim remains an idempotent no-op even after midnight.
 if exists(select 1 from public.user_grace_days where user_id=actor and grace_date=p_date) then return public.get_journey(); end if;
 if p_date is null or not isfinite(p_date) or p_date<>today-1 then return jsonb_build_object('error','grace_invalid_day'); end if;
 if exists(select 1 from public.user_reading_progress where user_id=actor and plan_id=plan and completion_date=p_date) then return jsonb_build_object('error','grace_reading_exists'); end if;
 if not exists(select 1 from public.user_reading_progress where user_id=actor and plan_id=plan and completion_date=p_date-1) then return jsonb_build_object('error','grace_no_prior_reading'); end if;
 if (select count(*) from public.user_grace_days where user_id=actor)>=1000 then return jsonb_build_object('error','grace_limit'); end if;
 if exists(select 1 from public.user_grace_days where user_id=actor and abs(grace_date-p_date)<30) then return jsonb_build_object('error','grace_cooldown'); end if;
 insert into public.user_grace_days(user_id,grace_date) values(actor,p_date) on conflict do nothing;
 return public.get_journey();
end $$;
revoke all on function public.claim_grace_day(date) from public,anon,authenticated;
grant execute on function public.claim_grace_day(date) to authenticated;
revoke all on function private.get_journey() from public,anon,authenticated;
create or replace function public.restore_journey(p_backup jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid := private.actor(); plan uuid; zone text; today date;
 entry record; day_date date; normalized_prayers jsonb:='{}'::jsonb; normalized jsonb;
begin
 perform private.enforce_request_limit('write');
 perform private.enforce_request_limit('restore');
 select reading_plan_id,timezone,(now() at time zone timezone)::date into plan,zone,today from public.profiles where id=actor;
 if p_backup is null or octet_length(p_backup::text)>5242880 or jsonb_typeof(p_backup)<>'object' then
  raise exception 'Invalid backup' using errcode='22023';
 end if;
 if (select count(*) from jsonb_object_keys(p_backup))<>(5 + (case when p_backup?'readingPlan' then 1 else 0 end) + (case when p_backup?'savedVerses' then 1 else 0 end) + (case when p_backup?'challengeStarts' then 1 else 0 end) + (case when p_backup?'verseNotes' then 1 else 0 end) + (case when p_backup?'prayers' then 1 else 0 end) + (case when p_backup?'graceDates' then 1 else 0 end))
 or coalesce(p_backup->'readingPlan','"canonical-v1"'::jsonb) is distinct from (select to_jsonb(slug||'-v'||schedule_version) from public.reading_plans where id=plan)
 or p_backup->'version' is distinct from '1'::jsonb
 or p_backup->'timeZone' is distinct from to_jsonb(zone)
 or jsonb_typeof(p_backup->'chapters') is distinct from 'object'
 or jsonb_typeof(p_backup->'attempts') is distinct from 'object'
 or jsonb_typeof(p_backup->'reflections') is distinct from 'object' then
  raise exception 'Invalid backup or timezone mismatch' using errcode='22023';
 end if;
 if (select count(*) from jsonb_object_keys(p_backup->'chapters'))>1189
 or (select count(*) from jsonb_object_keys(p_backup->'attempts'))>1000
 or (select count(*) from jsonb_object_keys(p_backup->'reflections'))>3660 then
  raise exception 'Backup is too large' using errcode='22023';
 end if;

 if p_backup?'prayers' then
  if jsonb_typeof(p_backup->'prayers') is distinct from 'object' then raise exception 'Invalid prayers' using errcode='22023'; end if;
  if (select count(*) from jsonb_object_keys(p_backup->'prayers'))>200 then raise exception 'Prayer limit' using errcode='22023'; end if;
  for entry in select key,value from jsonb_each(p_backup->'prayers') loop
   if entry.key !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then raise exception 'Invalid prayer ID' using errcode='22023'; end if;
   normalized:=private.normalize_prayer(entry.value,today);
   normalized_prayers:=normalized_prayers||jsonb_build_object(entry.key,normalized);
  end loop;
  if (select count(*) from (select id::text from public.user_prayers where user_id=actor union select jsonb_object_keys(normalized_prayers)) merged)>200 then raise exception 'Prayer limit' using errcode='22023'; end if;
 end if;
 -- Optional in version 1 so older exports remain restorable.
 if p_backup?'savedVerses' then
  if jsonb_typeof(p_backup->'savedVerses') is distinct from 'array' then raise exception 'Invalid saved verses' using errcode='22023'; end if;
  if jsonb_array_length(p_backup->'savedVerses')>1000 then raise exception 'Saved verse limit reached' using errcode='22023'; end if;
  for entry in select value from jsonb_array_elements(p_backup->'savedVerses') loop
   if jsonb_typeof(entry.value) is distinct from 'string' or (entry.value#>>'{}') !~ '^[A-Z0-9]{3}\.[1-9][0-9]{0,2}\.[1-9][0-9]{0,2}$' then raise exception 'Invalid saved verse' using errcode='22023'; end if;
   if not private.valid_verse(split_part(entry.value#>>'{}','.',1),split_part(entry.value#>>'{}','.',2)::integer,split_part(entry.value#>>'{}','.',3)::integer) then raise exception 'Unavailable saved verse' using errcode='22023'; end if;
  end loop;
  if (select count(*) from (
   select book_id||'.'||chapter||'.'||verse as key from public.user_saved_verses where user_id=actor
   union select value#>>'{}' from jsonb_array_elements(p_backup->'savedVerses')
  ) merged)>1000 then raise exception 'Saved verse limit reached' using errcode='22023'; end if;
 end if;

 -- Notes must belong to references explicitly carried by this backup.
 if p_backup?'verseNotes' then
  if jsonb_typeof(p_backup->'verseNotes') is distinct from 'object' then raise exception 'Invalid verse notes' using errcode='22023'; end if;
  if (select count(*) from jsonb_object_keys(p_backup->'verseNotes'))>1000 then raise exception 'Verse note limit reached' using errcode='22023'; end if;
  for entry in select key,value from jsonb_each(p_backup->'verseNotes') loop
   if jsonb_typeof(entry.value) is distinct from 'string'
    or char_length(private.trim_verse_note(entry.value#>>'{}')) not between 1 and 2000
    or not (coalesce(p_backup->'savedVerses','[]'::jsonb) @> jsonb_build_array(entry.key)) then
     raise exception 'Invalid verse note or missing saved reference' using errcode='22023';
   end if;
  end loop;
 end if;

 -- Validate imported enrollment dates and their union before any activity writes.
 if p_backup?'challengeStarts' then
  if jsonb_typeof(p_backup->'challengeStarts') is distinct from 'array' then raise exception 'Invalid challenges' using errcode='22023'; end if;
  if jsonb_array_length(p_backup->'challengeStarts')>1000 then raise exception 'Challenge limit reached' using errcode='22023'; end if;
  for entry in select value from jsonb_array_elements(p_backup->'challengeStarts') loop
   if jsonb_typeof(entry.value) is distinct from 'string' or (entry.value#>>'{}') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid challenge date' using errcode='22023'; end if;
   if (entry.value#>>'{}')::date>today then raise exception 'Future challenge' using errcode='22023'; end if;
  end loop;
  if exists(select 1 from (select d-lag(d) over(order by d) as gap from (select value::date as d from jsonb_array_elements_text(p_backup->'challengeStarts')) dates) gaps where gap<7) then raise exception 'Overlapping backup challenges' using errcode='22023'; end if;
  if (select count(*) from (select start_date from public.user_reading_challenges where user_id=actor union select value::date from jsonb_array_elements_text(p_backup->'challengeStarts')) merged)>1000 then raise exception 'Challenge limit reached' using errcode='22023'; end if;
  if exists(select 1 from (select d-lag(d) over(order by d) as gap from (select start_date as d from public.user_reading_challenges where user_id=actor union select value::date from jsonb_array_elements_text(p_backup->'challengeStarts')) dates) gaps where gap<7) then raise exception 'Overlapping saved challenges' using errcode='22023'; end if;
 end if;

 -- Validate every row before applying any of them. Dates are checked again in
 -- PostgreSQL so a direct RPC cannot bypass the browser or Next.js validator.
 for entry in select key,value from jsonb_each(p_backup->'chapters') loop
  if jsonb_typeof(entry.value) is distinct from 'string'
  or (entry.value#>>'{}') !~ '^\d{4}-\d{2}-\d{2}$'
  or not exists(select 1 from public.reading_plan_day_chapters where plan_id=plan and book_id||'.'||chapter=entry.key) then
   raise exception 'Invalid backup chapter' using errcode='22023';
  end if;
  day_date:=(entry.value#>>'{}')::date;
  if day_date>today then raise exception 'Future activity' using errcode='22023'; end if;
 end loop;
 for entry in select key,value from jsonb_each(p_backup->'attempts') loop
  if jsonb_typeof(entry.value) is distinct from 'object' then raise exception 'Invalid backup attempt' using errcode='22023'; end if;
  if (select count(*) from jsonb_object_keys(entry.value))<>2
  or jsonb_typeof(entry.value->'answer') is distinct from 'number'
  or (entry.value->>'answer') !~ '^[0-3]$'
  or jsonb_typeof(entry.value->'date') is distinct from 'string'
  or (entry.value->>'date') !~ '^\d{4}-\d{2}-\d{2}$'
  or not exists(select 1 from public.quiz_questions q join private.quiz_answers a on a.question_id=q.id where q.id=entry.key and (exists(select 1 from public.reading_plans source_plan where source_plan.id=q.plan_id and source_plan.published) and exists(select 1 from public.reading_plan_day_chapters m join public.bible_books b on b.id=m.book_id where m.plan_id=plan and q.scripture_reference like b.name||' '||m.chapter||':%')) and q.reviewed) then
   raise exception 'Invalid backup attempt' using errcode='22023';
  end if;
  day_date:=(entry.value->>'date')::date;
  if day_date>today then raise exception 'Future activity' using errcode='22023'; end if;
 end loop;
 for entry in select key,value from jsonb_each(p_backup->'reflections') loop
  if jsonb_typeof(entry.value) is distinct from 'object' then raise exception 'Invalid backup reflection' using errcode='22023'; end if;
  if entry.key !~ '^\d{4}-\d{2}-\d{2}$'
  or (select count(*) from jsonb_object_keys(entry.value))<>(case when entry.value?'category' then 2 else 1 end)
  or (entry.value?'category' and (jsonb_typeof(entry.value->'category') is distinct from 'string' or entry.value->>'category' not in ('reflection','prayer','gratitude','application')))
  or jsonb_typeof(entry.value->'text') is distinct from 'string'
  or char_length(trim(entry.value->>'text')) not between 20 and 10000 then
   raise exception 'Invalid backup reflection' using errcode='22023';
  end if;
  day_date:=entry.key::date;
  if day_date>today then raise exception 'Future activity' using errcode='22023'; end if;
 end loop;

 -- Validate grace history and merged spacing before any activity writes.
 if p_backup?'graceDates' then
  if jsonb_typeof(p_backup->'graceDates') is distinct from 'array' then raise exception 'Invalid grace dates' using errcode='22023'; end if;
  if jsonb_array_length(p_backup->'graceDates')>1000 then raise exception 'Grace limit' using errcode='22023'; end if;
  for entry in select value from jsonb_array_elements(p_backup->'graceDates') loop
   if jsonb_typeof(entry.value) is distinct from 'string' or (entry.value#>>'{}') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid grace date' using errcode='22023'; end if;
   day_date:=(entry.value#>>'{}')::date;
   if day_date>=today or to_char(day_date,'YYYY-MM-DD')<>entry.value#>>'{}' then raise exception 'Grace must precede today' using errcode='22023'; end if;
  end loop;
  if exists(select 1 from (select d-lag(d) over(order by ord) as gap from (select value::date as d,ord from jsonb_array_elements_text(p_backup->'graceDates') with ordinality dates(value,ord)) ordered) gaps where gap<30) then raise exception 'Invalid backup grace spacing' using errcode='22023'; end if;
  if (select count(*) from (select grace_date from public.user_grace_days where user_id=actor union select value::date from jsonb_array_elements_text(p_backup->'graceDates')) merged)>1000 then raise exception 'Grace limit' using errcode='22023'; end if;
  if exists(select 1 from (select d-lag(d) over(order by d) as gap from (select grace_date as d from public.user_grace_days where user_id=actor union select value::date from jsonb_array_elements_text(p_backup->'graceDates')) merged) gaps where gap<30) then raise exception 'Merged grace dates too close' using errcode='22023'; end if;
  -- Derive mission dates from destination-first chapter records, retaining
  -- already completed mission dates. Imported snapshot day assertions are absent.
  if exists(
   with merged_chapters as (
    select book_id,chapter,completion_date from public.user_chapter_progress where user_id=actor
    union all
    select split_part(e.key,'.',1),split_part(e.key,'.',2)::smallint,(e.value#>>'{}')::date from jsonb_each(p_backup->'chapters') e
    where not exists(select 1 from public.user_chapter_progress c where c.user_id=actor and c.book_id||'.'||c.chapter=e.key)
   ), computed as (
    select m.day,max(c.completion_date) as d from public.reading_plan_day_chapters m
    left join merged_chapters c on c.book_id=m.book_id and c.chapter=m.chapter
    where m.plan_id=plan group by m.day having count(*)=count(c.chapter)
   ), mission_dates as (
    select completion_date as d from public.user_reading_progress where user_id=actor and plan_id=plan
    union select c.d from computed c where not exists(select 1 from public.user_reading_progress saved where saved.user_id=actor and saved.plan_id=plan and saved.day=c.day)
   )
   select 1 from jsonb_array_elements_text(p_backup->'graceDates') g(d) where not exists(select 1 from mission_dates m where m.d=g.d::date-1)
  ) then raise exception 'Grace requires preceding completed mission' using errcode='22023'; end if;
 end if;
 insert into public.user_grace_days(user_id,grace_date) select actor,value::date from jsonb_array_elements_text(coalesce(p_backup->'graceDates','[]'::jsonb)) on conflict do nothing;
 insert into public.user_prayers(user_id,id,title,content,status,follow_ups)
 select actor,key::uuid,value->>'title',value->>'text',value->>'status',value->'followUps' from jsonb_each(normalized_prayers) on conflict do nothing;
 insert into public.user_chapter_progress(user_id,book_id,chapter,completion_date)
 select actor,split_part(key,'.',1),split_part(key,'.',2)::smallint,(value#>>'{}')::date from jsonb_each(p_backup->'chapters') on conflict do nothing;
 insert into public.quiz_attempts(user_id,question_id,selected_option,is_correct,correct_option,explanation,attempted_at)
 select actor,q.id,(e.value->>'answer')::smallint,(e.value->>'answer')::integer=a.correct_option,a.correct_option,a.explanation,
 ((e.value->>'date')::date+time '12:00') at time zone zone
 from jsonb_each(p_backup->'attempts') e join public.quiz_questions q on q.id=e.key join private.quiz_answers a on a.question_id=q.id on conflict do nothing;
 insert into public.reflections(user_id,reflection_date,content,category)
 select actor,key::date,trim(value->>'text'),coalesce(value->>'category','reflection') from jsonb_each(p_backup->'reflections') on conflict do nothing;
 -- Reconstruct only earned rewards, from the merged authoritative records.
 insert into public.user_reading_progress(user_id,plan_id,day,completion_date)
 select actor,plan,a.day,max(c.completion_date) from public.reading_plan_day_chapters a
 left join public.user_chapter_progress c on c.user_id=actor and c.book_id=a.book_id and c.chapter=a.chapter
 where a.plan_id=plan group by a.day having count(*)=count(c.chapter) on conflict do nothing;
 insert into public.xp_transactions(user_id,activity_key,activity_type,amount,activity_date)
 select actor,(select case when slug='canonical' then 'reading:' else 'reading:'||slug||'-v'||schedule_version||':' end from public.reading_plans where id=plan)||day,'reading',50,completion_date from public.user_reading_progress where user_id=actor and plan_id=plan on conflict do nothing;
 insert into public.xp_transactions(user_id,activity_key,activity_type,amount,activity_date)
 select actor,'book:'||b.id,'book',150,max(c.completion_date) from public.bible_books b
 join public.user_chapter_progress c on c.user_id=actor and c.book_id=b.id group by b.id,b.chapter_count having count(*)=b.chapter_count on conflict do nothing;
 insert into public.xp_transactions(user_id,activity_key,activity_type,amount,activity_date)
 select actor,'quiz:'||question_id,'quiz',10,(attempted_at at time zone zone)::date from public.quiz_attempts where user_id=actor and is_correct on conflict do nothing;
 insert into public.xp_transactions(user_id,activity_key,activity_type,amount,activity_date)
 select actor,'reflection:'||reflection_date,'reflection',20,reflection_date from public.reflections where user_id=actor on conflict do nothing;
 insert into public.user_saved_verses(user_id,book_id,chapter,verse)
 select actor,split_part(value#>>'{}','.',1),split_part(value#>>'{}','.',2)::smallint,split_part(value#>>'{}','.',3)::smallint
 from jsonb_array_elements(coalesce(p_backup->'savedVerses','[]'::jsonb)) on conflict do nothing;
 update public.user_saved_verses v set note=private.trim_verse_note(n.value),note_updated_at=now()
 from jsonb_each_text(coalesce(p_backup->'verseNotes','{}'::jsonb)) n
 where v.user_id=actor and v.book_id||'.'||v.chapter||'.'||v.verse=n.key and v.note is null;
 insert into public.user_reading_challenges(user_id,start_date) select actor,value::date from jsonb_array_elements_text(coalesce(p_backup->'challengeStarts','[]'::jsonb)) on conflict do nothing;
 perform private.award_reading_challenges();
 perform private.unlock_achievements(actor);
 return public.get_journey();
end $$;
commit;
