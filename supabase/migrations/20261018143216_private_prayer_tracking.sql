-- Private prayer requests; no journal coupling, fellowship disclosure or XP.
begin;
create function private.normalize_prayer(p_value jsonb,p_today date) returns jsonb
language plpgsql immutable set search_path='' as $$
declare n record; notes jsonb:='{}'::jsonb; d date; title text; content text;
begin
 if jsonb_typeof(p_value) is distinct from 'object' then raise exception 'Invalid prayer' using errcode='22023'; end if;
 if (select count(*) from jsonb_object_keys(p_value))<>4
 or jsonb_typeof(p_value->'title') is distinct from 'string'
 or jsonb_typeof(p_value->'text') is distinct from 'string'
 or jsonb_typeof(p_value->'status') is distinct from 'string'
 or p_value->>'status' not in ('ongoing','answered','archived')
 or jsonb_typeof(p_value->'followUps') is distinct from 'object' then raise exception 'Invalid prayer' using errcode='22023'; end if;
 title:=private.trim_verse_note(p_value->>'title'); content:=private.trim_verse_note(p_value->>'text');
 if char_length(title) not between 1 and 120 or char_length(content) not between 1 and 2000
 or (select count(*) from jsonb_object_keys(p_value->'followUps'))>50 then raise exception 'Invalid prayer limits' using errcode='22023'; end if;
 for n in select key,value from jsonb_each(p_value->'followUps') loop
  if n.key !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  or jsonb_typeof(n.value) is distinct from 'object' then raise exception 'Invalid follow-up' using errcode='22023'; end if;
  if (select count(*) from jsonb_object_keys(n.value))<>2
  or jsonb_typeof(n.value->'text') is distinct from 'string'
  or char_length(private.trim_verse_note(n.value->>'text')) not between 1 and 1000
  or jsonb_typeof(n.value->'date') is distinct from 'string'
  or (n.value->>'date') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid follow-up' using errcode='22023'; end if;
  begin d:=(n.value->>'date')::date; exception when invalid_datetime_format or datetime_field_overflow then raise exception 'Invalid follow-up date' using errcode='22023'; end;
  if to_char(d,'YYYY-MM-DD')<>n.value->>'date' or d>p_today then raise exception 'Future follow-up' using errcode='22023'; end if;
  notes:=notes||jsonb_build_object(n.key,jsonb_build_object('text',private.trim_verse_note(n.value->>'text'),'date',n.value->>'date'));
 end loop;
 return jsonb_build_object('title',title,'text',content,'status',p_value->>'status','followUps',notes);
end $$;
revoke all on function private.normalize_prayer(jsonb,date) from public,anon,authenticated;
create table public.user_prayers (
 user_id uuid not null references public.profiles(id) on delete cascade,
 id uuid not null,
 title text not null,
 content text not null,
 status text not null,
 follow_ups jsonb not null default '{}'::jsonb,
 revision uuid not null default gen_random_uuid(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(user_id,id),
 constraint prayer_content_valid check (jsonb_build_object('title',title,'text',content,'status',status,'followUps',follow_ups)=private.normalize_prayer(jsonb_build_object('title',title,'text',content,'status',status,'followUps',follow_ups),null))
);
alter table public.user_prayers enable row level security;
revoke all on table public.user_prayers from public,anon,authenticated;
grant select on table public.user_prayers to authenticated;
create policy prayer_owner on public.user_prayers for select to authenticated using((select auth.uid())=user_id);
create policy active_session on public.user_prayers as restrictive for select to authenticated using((select public.account_session_active()));
create or replace function private.get_journey() returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid := private.actor(); result jsonb;
begin
 select jsonb_strip_nulls(jsonb_build_object(
 'version',1,
 'readingPlan',(select slug||'-v'||schedule_version from public.reading_plans where id=p.reading_plan_id),
 'fellowshipMemberships',coalesce((select jsonb_agg(jsonb_build_object('groupId',g.id,'name',g.name,'role',case when g.owner_id=actor then 'owner' else 'member' end,'joinedAt',to_char(m.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) order by g.id) from public.group_memberships m join public.groups g on g.id=m.group_id where m.user_id=actor),'[]'::jsonb),
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

create function public.mutate_prayer(p_id uuid,p_action text,p_value jsonb,p_expected_revision uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.actor(); current_prayer public.user_prayers; desired jsonb; follow_id text; today date;
begin
 perform private.enforce_request_limit('write');
 select (now() at time zone timezone)::date into today from public.profiles where id=actor;
 if p_id is null or p_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
 or p_action is null or p_action not in ('save','followUp','delete')
 or jsonb_typeof(p_value) is distinct from 'object' then raise exception 'Invalid prayer command' using errcode='22023'; end if;
 if p_action='save' then
  if (select count(*) from jsonb_object_keys(p_value))<>3 then raise exception 'Invalid prayer fields' using errcode='22023'; end if;
  desired:=private.normalize_prayer(p_value||jsonb_build_object('followUps','{}'::jsonb),today);
 elsif p_action='followUp' then
  if (select count(*) from jsonb_object_keys(p_value))<>3 or jsonb_typeof(p_value->'id') is distinct from 'string' then raise exception 'Invalid follow-up fields' using errcode='22023'; end if;
  follow_id:=p_value->>'id';
  desired:=private.normalize_prayer(jsonb_build_object('title','Validation','text','Validation','status','ongoing','followUps',jsonb_build_object(follow_id,p_value-'id')),today)->'followUps'->follow_id;
 else
  if p_value<>'{}'::jsonb then raise exception 'Invalid delete fields' using errcode='22023'; end if;
 end if;
 select * into current_prayer from public.user_prayers where user_id=actor and id=p_id;
 if current_prayer.id is null and p_action='delete' then return public.get_journey(); end if;
 -- A committed intent retried after an uncertain response is a no-op.
 if current_prayer.id is not null then
  if p_action='save' and current_prayer.title=desired->>'title' and current_prayer.content=desired->>'text' and current_prayer.status=desired->>'status' then return public.get_journey(); end if;
  if p_action='followUp' and current_prayer.follow_ups->follow_id=desired then return public.get_journey(); end if;
 end if;
 if current_prayer.id is null and (p_action<>'save' or p_expected_revision is not null) then return jsonb_build_object('error','prayer_missing'); end if;
 if current_prayer.revision is distinct from p_expected_revision then return jsonb_build_object('error','prayer_conflict'); end if;
 if p_action='delete' then
  delete from public.user_prayers where user_id=actor and id=p_id;
 elsif p_action='save' then
  if current_prayer.id is null and (select count(*) from public.user_prayers where user_id=actor)>=200 then return jsonb_build_object('error','prayer_limit'); end if;
  insert into public.user_prayers(user_id,id,title,content,status) values(actor,p_id,desired->>'title',desired->>'text',desired->>'status')
  on conflict(user_id,id) do update set title=excluded.title,content=excluded.content,status=excluded.status,revision=gen_random_uuid(),updated_at=now();
 else
  if current_prayer.follow_ups?follow_id then return jsonb_build_object('error','prayer_conflict'); end if;
  if (select count(*) from jsonb_object_keys(current_prayer.follow_ups))>=50 then return jsonb_build_object('error','follow_up_limit'); end if;
  update public.user_prayers set follow_ups=follow_ups||jsonb_build_object(follow_id,desired),revision=gen_random_uuid(),updated_at=now() where user_id=actor and id=p_id;
 end if;
 return public.get_journey();
end $$;
revoke all on function public.mutate_prayer(uuid,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.mutate_prayer(uuid,text,jsonb,uuid) to authenticated;
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
 if (select count(*) from jsonb_object_keys(p_backup))<>(5 + (case when p_backup?'readingPlan' then 1 else 0 end) + (case when p_backup?'savedVerses' then 1 else 0 end) + (case when p_backup?'challengeStarts' then 1 else 0 end) + (case when p_backup?'verseNotes' then 1 else 0 end) + (case when p_backup?'prayers' then 1 else 0 end))
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
