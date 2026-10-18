-- Shared questions retain their source publication boundary. No activity changes.
begin;
create or replace function private.submit_quiz(p_question text,p_option integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid := private.actor(); plan uuid; calendar_day date; answer smallint; explanation_text text;
begin
 select reading_plan_id,(now() at time zone timezone)::date into plan,calendar_day from public.profiles where id=actor;
 if p_option is null or p_option not between 0 and 3 then raise exception 'Invalid option' using errcode='22023'; end if;
 select a.correct_option,a.explanation into answer,explanation_text from public.quiz_questions q join private.quiz_answers a on a.question_id=q.id
 where q.id=p_question and q.reviewed and (exists(select 1 from public.reading_plans source_plan where source_plan.id=q.plan_id and source_plan.published) and exists(select 1 from public.reading_plan_day_chapters m join public.bible_books b on b.id=m.book_id where m.plan_id=plan and q.scripture_reference like b.name||' '||m.chapter||':%'));
 if not found then raise exception 'Reviewed question required' using errcode='22023'; end if;
 insert into public.quiz_attempts(user_id,question_id,selected_option,is_correct,correct_option,explanation)
 values(actor,p_question,p_option,p_option=answer,answer,explanation_text) on conflict do nothing;
 insert into public.xp_transactions(user_id,activity_key,activity_type,amount,activity_date)
 select actor,'quiz:'||p_question,'quiz',10,calendar_day from public.quiz_attempts where user_id=actor and question_id=p_question and is_correct on conflict do nothing;
 perform private.unlock_achievements(actor);
 return public.get_journey();
end $$;
create or replace function public.restore_journey(p_backup jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid := private.actor(); plan uuid; zone text; today date;
 entry record; day_date date;
begin
 perform private.enforce_request_limit('write');
 perform private.enforce_request_limit('restore');
 select reading_plan_id,timezone,(now() at time zone timezone)::date into plan,zone,today from public.profiles where id=actor;
 if p_backup is null or octet_length(p_backup::text)>5242880 or jsonb_typeof(p_backup)<>'object' then
  raise exception 'Invalid backup' using errcode='22023';
 end if;
 if (select count(*) from jsonb_object_keys(p_backup))<>(5 + (case when p_backup?'readingPlan' then 1 else 0 end) + (case when p_backup?'savedVerses' then 1 else 0 end) + (case when p_backup?'challengeStarts' then 1 else 0 end))
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
 insert into public.user_reading_challenges(user_id,start_date) select actor,value::date from jsonb_array_elements_text(coalesce(p_backup->'challengeStarts','[]'::jsonb)) on conflict do nothing;
 perform private.award_reading_challenges();
 perform private.unlock_achievements(actor);
 return public.get_journey();
end $$;
revoke all on function private.submit_quiz(text,integer) from public,anon,authenticated;
commit;
