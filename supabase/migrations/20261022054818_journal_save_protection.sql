-- Journal revisions protect text and category edits, including concurrent creates.
-- Older unguarded RPCs remain installed for migration history but cannot be called
-- by API clients. No private entry is rewritten; existing rows receive a token.
begin;
alter table public.reflections add column revision uuid not null default gen_random_uuid();
create function private.revise_journal_entry() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.content is distinct from old.content or new.category is distinct from old.category then
  new.revision:=gen_random_uuid();
 else
  new.revision:=old.revision;
 end if;
 return new;
end $$;
revoke all on function private.revise_journal_entry() from public,anon,authenticated;
create trigger revise_journal_entry before update on public.reflections
for each row execute function private.revise_journal_entry();
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
 'reflections',coalesce((select jsonb_object_agg(reflection_date,jsonb_build_object('text',content,'category',category,'revision',revision,'updatedAt',to_char(updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))) from public.reflections where user_id=actor),'{}'::jsonb),
 'earnedAchievements',coalesce((select jsonb_agg(achievement_id order by achievement_id) from public.user_achievements where user_id=actor),'[]'::jsonb),
 'resume',case when p.resume_book is not null then jsonb_build_object('book',p.resume_book,'chapter',p.resume_chapter) end
 )) into result from public.profiles p where p.id=actor;
 return result;
end $$;
revoke all on function private.get_journey() from public,anon,authenticated;

create function public.save_journal_entry(p_date date,p_content text,p_category text,p_expected_revision text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.actor(); calendar_day date; current_entry public.reflections;
begin
 -- private.actor serializes account writes with the existing profile row lock,
 -- including two creates for a date that does not have a reflection row yet.
 perform private.enforce_request_limit('write');
 select (now() at time zone timezone)::date into calendar_day from public.profiles where id=actor;
 if p_date is null or not isfinite(p_date) or p_content is null or char_length(trim(p_content)) not between 20 and 10000
 or p_category is null or p_category not in ('reflection','prayer','gratitude','application')
 or (p_expected_revision is not null and char_length(p_expected_revision)>64) then
  raise exception 'Invalid journal entry' using errcode='22023';
 end if;
 select * into current_entry from public.reflections where user_id=actor and reflection_date=p_date;
 if p_date>calendar_day or (p_date<>calendar_day and current_entry.user_id is null) then
  raise exception 'New entries are for today' using errcode='22023';
 end if;
 -- A lost response can be acknowledged without changing the revision, timestamp,
 -- reward or achievements. Stale content never overwrites a different version.
 if current_entry.user_id is not null and current_entry.content=trim(p_content) and current_entry.category=p_category then
  return public.get_journey();
 end if;
 if current_entry.revision::text is distinct from p_expected_revision then
  return jsonb_build_object('error','journal_conflict');
 end if;
 insert into public.reflections(user_id,reflection_date,content,category)
 values(actor,p_date,trim(p_content),p_category)
 on conflict(user_id,reflection_date) do update set content=excluded.content,category=excluded.category;
 insert into public.xp_transactions(user_id,activity_key,activity_type,amount,activity_date)
 values(actor,'reflection:'||p_date,'reflection',20,calendar_day) on conflict do nothing;
 perform private.unlock_achievements(actor);
 return public.get_journey();
end $$;
revoke all on function public.save_journal_entry(date,text,text,text) from public,anon,authenticated;
grant execute on function public.save_journal_entry(date,text,text,text) to authenticated;
revoke all on function public.save_reflection(date,text) from public,anon,authenticated;
revoke all on function public.save_categorized_reflection(date,text,text) from public,anon,authenticated;
commit;
