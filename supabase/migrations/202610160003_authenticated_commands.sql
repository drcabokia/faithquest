-- Authenticated commands own all writes and derive rewards/calendar dates in PostgreSQL.
begin;
alter table public.profiles add column resume_book text, add column resume_chapter smallint;
alter table public.profiles add constraint resume_reference foreign key(resume_book,resume_chapter) references public.bible_chapters(book_id,chapter) match full;
alter table public.quiz_attempts add column correct_option smallint check(correct_option between 0 and 3), add column explanation text;
revoke insert,update,delete on public.profiles,public.reflections from authenticated;

create function private.guard_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.timezone) then raise exception 'Invalid timezone' using errcode='22023'; end if;
 if new.start_date > (now() at time zone new.timezone)::date then raise exception 'Future start date' using errcode='22023'; end if;
 if new.reading_plan_id is null or not exists(select 1 from public.reading_plans where id=new.reading_plan_id and published and slug='canonical') then raise exception 'Unavailable plan' using errcode='22023'; end if;
 if tg_op='UPDATE' and (old.timezone<>new.timezone or old.reading_plan_id<>new.reading_plan_id) and (
 exists(select 1 from public.user_chapter_progress where user_id=old.id) or exists(select 1 from public.xp_transactions where user_id=old.id) or exists(select 1 from public.quiz_attempts where user_id=old.id)) then
 raise exception 'Journey timezone and plan are fixed after activity' using errcode='22023'; end if;
 return new;
end $$;
create trigger guard_profile before insert or update on public.profiles for each row execute function private.guard_profile();

create function private.actor() returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid();
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 perform 1 from public.profiles where id=actor for update;
 if not found then raise exception 'Profile required' using errcode='22023'; end if;
 return actor;
end $$;

create function private.unlock_achievements(actor uuid) returns void language plpgsql security definer set search_path='' as $$
declare days_count integer; longest integer;
begin
 select count(*) into days_count from public.user_reading_progress where user_id=actor;
 select coalesce(max(length),0) into longest from (
 select count(*) as length from (
 select completion_date, completion_date - (row_number() over(order by completion_date))::integer as sequence
 from (select distinct completion_date from public.user_reading_progress where user_id=actor) dates
 ) numbered group by sequence) runs;
 insert into public.user_achievements(user_id,achievement_id)
 select actor,id from (values
 ('first',days_count>=1),('week',longest>=7),('month',days_count>=30),
 ('reflect',exists(select 1 from public.reflections where user_id=actor)),
 ('quiz',exists(select 1 from public.quiz_attempts where user_id=actor and is_correct)),
 ('book',exists(select 1 from public.xp_transactions where user_id=actor and activity_type='book')),
 ('hundred',days_count>=100),('year',days_count=365)
 ) milestones(id,earned) where earned on conflict do nothing;
end $$;

create function public.get_journey() returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid := private.actor(); result jsonb;
begin
 select jsonb_strip_nulls(jsonb_build_object(
 'version',1,
 'profile',jsonb_build_object('name',p.display_name,'startDate',p.start_date,'timeZone',p.timezone,'theme',p.theme),
 'chapters',coalesce((select jsonb_object_agg(book_id||'.'||chapter,completion_date) from public.user_chapter_progress where user_id=actor),'{}'::jsonb),
 'days',coalesce((select jsonb_object_agg(day,completion_date) from public.user_reading_progress where user_id=actor and plan_id=p.reading_plan_id),'{}'::jsonb),
 'rewards',coalesce((select jsonb_object_agg(activity_key,jsonb_build_object('amount',amount,'date',activity_date)) from public.xp_transactions where user_id=actor),'{}'::jsonb),
 'attempts',coalesce((select jsonb_object_agg(question_id,jsonb_build_object('answer',selected_option,'correct',is_correct,'date',(attempted_at at time zone p.timezone)::date,'correctOption',correct_option,'explanation',explanation)) from public.quiz_attempts where user_id=actor),'{}'::jsonb),
 'reflections',coalesce((select jsonb_object_agg(reflection_date,jsonb_build_object('text',content,'updatedAt',to_char(updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))) from public.reflections where user_id=actor),'{}'::jsonb),
 'earnedAchievements',coalesce((select jsonb_agg(achievement_id order by achievement_id) from public.user_achievements where user_id=actor),'[]'::jsonb),
 'resume',case when p.resume_book is not null then jsonb_build_object('book',p.resume_book,'chapter',p.resume_chapter) end
 )) into result from public.profiles p where p.id=actor;
 return result;
end $$;

create function public.ensure_journey(p_name text,p_timezone text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); plan uuid;
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if char_length(trim(p_name)) not between 1 and 50 or p_name is null then raise exception 'Invalid name' using errcode='22023'; end if;
 if p_timezone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then raise exception 'Invalid timezone' using errcode='22023'; end if;
 select id into plan from public.reading_plans where slug='canonical' and published;
 if plan is null then raise exception 'Plan required' using errcode='22023'; end if;
 insert into public.profiles(id,display_name,timezone,reading_plan_id,start_date)
 values(actor,trim(p_name),p_timezone,plan,(now() at time zone p_timezone)::date) on conflict(id) do nothing;
 return public.get_journey();
end $$;

create function public.complete_chapter(p_book text,p_chapter integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid := private.actor(); plan uuid; calendar_day date;
begin
 select reading_plan_id,(now() at time zone timezone)::date into plan,calendar_day from public.profiles where id=actor;
 if not exists(select 1 from public.reading_plan_day_chapters where plan_id=plan and book_id=p_book and chapter=p_chapter) then raise exception 'Invalid chapter' using errcode='22023'; end if;
 insert into public.user_chapter_progress(user_id,book_id,chapter,completion_date) values(actor,p_book,p_chapter,calendar_day) on conflict do nothing;
 with completed as (
 insert into public.user_reading_progress(user_id,plan_id,day,completion_date)
 select actor,plan,d.day,calendar_day from public.reading_plan_days d
 where d.plan_id=plan and exists(select 1 from public.reading_plan_day_chapters a where a.plan_id=plan and a.day=d.day)
 and not exists(select 1 from public.reading_plan_day_chapters a where a.plan_id=plan and a.day=d.day and not exists(select 1 from public.user_chapter_progress c where c.user_id=actor and c.book_id=a.book_id and c.chapter=a.chapter))
 on conflict do nothing returning day
 ) insert into public.xp_transactions(user_id,activity_key,activity_type,amount,activity_date)
 select actor,'reading:'||day,'reading',50,calendar_day from completed on conflict do nothing;
 insert into public.xp_transactions(user_id,activity_key,activity_type,amount,activity_date)
 select actor,'book:'||b.id,'book',150,calendar_day from public.bible_books b
 where b.id=p_book and (select count(*) from public.user_chapter_progress c where c.user_id=actor and c.book_id=b.id)=b.chapter_count
 on conflict do nothing;
 perform private.unlock_achievements(actor);
 return public.get_journey();
end $$;

create function public.submit_quiz(p_question text,p_option integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid := private.actor(); plan uuid; calendar_day date; answer smallint; explanation_text text;
begin
 select reading_plan_id,(now() at time zone timezone)::date into plan,calendar_day from public.profiles where id=actor;
 if p_option is null or p_option not between 0 and 3 then raise exception 'Invalid option' using errcode='22023'; end if;
 select a.correct_option,a.explanation into answer,explanation_text from public.quiz_questions q join private.quiz_answers a on a.question_id=q.id
 where q.id=p_question and q.reviewed and q.plan_id=plan;
 if not found then raise exception 'Reviewed question required' using errcode='22023'; end if;
 insert into public.quiz_attempts(user_id,question_id,selected_option,is_correct,correct_option,explanation)
 values(actor,p_question,p_option,p_option=answer,answer,explanation_text) on conflict do nothing;
 insert into public.xp_transactions(user_id,activity_key,activity_type,amount,activity_date)
 select actor,'quiz:'||p_question,'quiz',10,calendar_day from public.quiz_attempts where user_id=actor and question_id=p_question and is_correct on conflict do nothing;
 perform private.unlock_achievements(actor);
 return public.get_journey();
end $$;

create function public.save_reflection(p_date date,p_content text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid := private.actor(); calendar_day date;
begin
 select (now() at time zone timezone)::date into calendar_day from public.profiles where id=actor;
 if p_date is null or p_content is null or char_length(trim(p_content)) not between 20 and 10000 then raise exception 'Invalid reflection' using errcode='22023'; end if;
 if p_date>calendar_day or (p_date<>calendar_day and not exists(select 1 from public.reflections where user_id=actor and reflection_date=p_date)) then raise exception 'New entries are for today' using errcode='22023'; end if;
 insert into public.reflections(user_id,reflection_date,content) values(actor,p_date,trim(p_content)) on conflict(user_id,reflection_date) do update set content=excluded.content;
 insert into public.xp_transactions(user_id,activity_key,activity_type,amount,activity_date) values(actor,'reflection:'||p_date,'reflection',20,calendar_day) on conflict do nothing;
 perform private.unlock_achievements(actor);
 return public.get_journey();
end $$;

create function public.update_journey_preferences(p_name text,p_start_date date,p_timezone text,p_theme text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid := private.actor();
begin
 if p_name is null or p_timezone is null or p_start_date is null or p_theme is null then raise exception 'Preferences required' using errcode='22023'; end if;
 update public.profiles set display_name=trim(p_name),start_date=p_start_date,timezone=p_timezone,theme=p_theme where id=actor;
 return public.get_journey();
end $$;

create function public.remember_chapter(p_book text,p_chapter integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid := private.actor();
begin
 if p_book is null or p_chapter is null or not exists(select 1 from public.bible_chapters where book_id=p_book and chapter=p_chapter) then raise exception 'Invalid chapter' using errcode='22023'; end if;
 update public.profiles set resume_book=p_book,resume_chapter=p_chapter where id=actor;
 return public.get_journey();
end $$;

-- No helper can be invoked by a client, even when its UUID argument is guessed.
revoke all on all functions in schema private from public,anon,authenticated;
revoke all on function public.get_journey(),public.ensure_journey(text,text),public.complete_chapter(text,integer),public.submit_quiz(text,integer),public.save_reflection(date,text),public.update_journey_preferences(text,date,text,text),public.remember_chapter(text,integer) from public,anon,authenticated;
grant execute on function public.get_journey(),public.ensure_journey(text,text),public.complete_chapter(text,integer),public.submit_quiz(text,integer),public.save_reflection(date,text),public.update_journey_preferences(text,date,text,text),public.remember_chapter(text,integer) to authenticated;
commit;
