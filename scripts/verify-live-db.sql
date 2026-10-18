-- Run inside a transaction that is ALWAYS rolled back (see verify-live-db.mjs).
-- Uses synthetic auth rows and simulated claims; this does not test OAuth sessions.
do $verification$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  session_a uuid := gen_random_uuid();
  session_b uuid := gen_random_uuid();
  group_id uuid := gen_random_uuid();
  snapshot jsonb;
  repeated jsonb;
  reflection_day date;
  table_name text;
  statement text;
  denied boolean;
  visible boolean;
  total integer;
begin
  if (select count(*) from public.bible_books) <> 66
    or (select count(*) from public.bible_chapters) <> 1189
    or (select count(*) from public.reading_plan_days d join public.reading_plans p on p.id=d.plan_id where p.slug='canonical' and p.published) <> 365
    or (select count(*) from public.quiz_questions where reviewed) <> 60 then
    raise exception 'Reference catalogue is incomplete';
  end if;

  insert into auth.users(id) values(a),(b);
  insert into auth.sessions(id,user_id) values(session_a,a),(session_b,b);
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claim.sub',a::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated','session_id',session_a)::text,true);
  snapshot := public.ensure_journey('Isolation fixture A','Asia/Kuala_Lumpur');
  reflection_day := (snapshot #>> '{profile,startDate}')::date;
  perform public.complete_chapter('GEN',1);
  snapshot := public.complete_chapter('GEN',2);
  if snapshot->'rewards' is distinct from '{}'::jsonb then
    raise exception 'Incomplete day received a reward';
  end if;
  snapshot := public.complete_chapter('GEN',3);
  if (snapshot #>> '{rewards,reading:1,amount}')::integer is distinct from 50 then
    raise exception 'Reading reward mismatch';
  end if;
  repeated := public.complete_chapter('GEN',3);
  if repeated is distinct from snapshot then
    raise exception 'Repeated chapter changed the journey';
  end if;
  perform public.save_reflection(reflection_day,'A synthetic private reflection used only for isolation testing.');
  perform public.submit_quiz('gen-light',0);
  perform public.submit_quiz('gen-rest',0);
  perform public.submit_quiz('gen-rest',2);
  perform public.submit_quiz('gen-light',0);
  snapshot := public.save_reflection(reflection_day,'Edited synthetic reflection used only for isolation testing.');
  if snapshot #>> '{attempts,gen-rest,correct}' is distinct from 'false'
    or snapshot #>> '{attempts,gen-rest,answer}' is distinct from '0'
    or snapshot->'rewards' ? 'quiz:gen-rest'
    or snapshot #>> '{attempts,gen-light,correctOption}' is distinct from '0'
    or snapshot #>> array['reflections',reflection_day::text,'text'] is distinct from 'Edited synthetic reflection used only for isolation testing.' then
    raise exception 'Quiz immutability or reflection persistence failed';
  end if;
  select sum(amount)::integer into total from public.xp_transactions;
  if total is distinct from 80 then
    raise exception 'Duplicate or missing activity rewards';
  end if;
  if not (snapshot->'earnedAchievements' @> '["first","quiz","reflect"]'::jsonb) then
    raise exception 'Server achievements are missing';
  end if;
  repeated := public.get_journey();
  if repeated is distinct from snapshot then
    raise exception 'Saved state did not survive an independent read';
  end if;

  -- The command layer and the direct Data API must both reject forged writes.
  foreach statement in array array[
    'select * from private.quiz_answers',
    format('select private.unlock_achievements(%L::uuid)',a),
    'update public.profiles set timezone=''UTC''',
    'delete from public.reflections',
    'update public.quiz_attempts set is_correct=true',
    format('insert into public.xp_transactions(user_id,activity_key,activity_type,amount,activity_date) values(%L,''forged'',''book'',150,current_date)',a),
    format('insert into public.user_achievements(user_id,achievement_id) values(%L,''year'')',a)
  ] loop
    denied := false;
    begin
      execute statement;
    exception when insufficient_privilege then
      denied := true;
    end;
    if not denied then raise exception 'Protected operation was permitted: %',statement; end if;
  end loop;
  denied := false;
  begin
    perform public.update_journey_preferences('Isolation fixture A',reflection_day,'UTC','light');
  exception when invalid_parameter_value then
    denied := true;
  end;
  if not denied then raise exception 'Timezone changed after activity'; end if;

  perform set_config('request.jwt.claim.sub',b::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated','session_id',session_b)::text,true);
  perform public.ensure_journey('Isolation fixture B','UTC');
  perform set_config('role','none',true);
  insert into public.groups(id,owner_id,name) values(group_id,a,'Synthetic isolation group');
  insert into public.group_memberships(group_id,user_id,role) values(group_id,b,'member');
  perform set_config('role','authenticated',true);
  if not exists(select 1 from public.groups g where g.id=group_id) then
    raise exception 'Group member cannot read their group';
  end if;
  snapshot := public.get_journey();
  if snapshot->'reflections' is distinct from '{}'::jsonb
    or snapshot->'rewards' is distinct from '{}'::jsonb
    or snapshot->'chapters' is distinct from '{}'::jsonb
    or snapshot->'days' is distinct from '{}'::jsonb
    or snapshot->'attempts' is distinct from '{}'::jsonb
    or snapshot->'earnedAchievements' is distinct from '[]'::jsonb then
    raise exception 'Another user journey was visible';
  end if;
  if exists(select 1 from public.profiles where id=a) then
    raise exception 'Another user profile was visible';
  end if;
  foreach table_name in array array['user_saved_verses','reflections','xp_transactions','user_chapter_progress','user_reading_progress','quiz_attempts','user_achievements'] loop
    execute format('select exists(select 1 from public.%I where user_id=$1)',table_name) into visible using a;
    if visible then raise exception 'Personal-table isolation failed: %',table_name; end if;
  end loop;

  -- A valid signed identity must also own a current Auth session.
  foreach statement in array array['', 'not-a-uuid', session_a::text] loop
    perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'session_id',statement)::text,true);
    if public.account_session_active() then raise exception 'Invalid or foreign session accepted'; end if;
    if exists(select 1 from public.profiles) then raise exception 'Invalid session read a profile'; end if;
  end loop;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'session_id',session_b)::text,true);
  perform set_config('role','none',true);
  update auth.sessions set not_after=now()-interval '1 second' where id=session_b;
  perform set_config('role','authenticated',true);
  if public.account_session_active() then raise exception 'Expired session accepted'; end if;
  perform set_config('role','none',true);
  update auth.sessions set not_after=null where id=session_b;
  perform set_config('role','authenticated',true);
  if not public.account_session_active() then raise exception 'Active session rejected'; end if;
  perform set_config('role','none',true);
  delete from auth.sessions where id=session_b;
  perform set_config('role','authenticated',true);
  if public.account_session_active() then raise exception 'Revoked session accepted'; end if;
  foreach table_name in array array['profiles','user_saved_verses','reflections','xp_transactions','user_chapter_progress','user_reading_progress','quiz_attempts','user_achievements','groups','group_memberships'] loop
    execute format('select exists(select 1 from public.%I)',table_name) into visible;
    if visible then raise exception 'Revoked session read personal table: %',table_name; end if;
  end loop;
  foreach statement in array array['select public.get_journey()', 'select public.ensure_journey(''Revoked'',''UTC'')', 'select public.complete_chapter(''GEN'',1)'] loop
    denied := false;
    begin execute statement;
    exception when insufficient_privilege then denied := true;
    end;
    if not denied then raise exception 'Revoked session command accepted'; end if;
  end loop;

  perform set_config('request.jwt.claim.sub','',true);
  perform set_config('request.jwt.claims','{}',true);
  denied := false;
  begin
    perform public.get_journey();
  exception when insufficient_privilege then
    denied := true;
  end;
  if not denied then raise exception 'Missing identity was accepted'; end if;
  perform set_config('role','anon',true);
  foreach statement in array array['select * from public.reflections','select public.get_journey()','select public.ensure_journey(''Intruder'',''UTC'')'] loop
    denied := false;
    begin
      execute statement;
    exception when insufficient_privilege then
      denied := true;
    end;
    if not denied then raise exception 'Anonymous operation was permitted'; end if;
  end loop;
  perform set_config('role','none',true);
  -- Exercise existing Auth-to-profile deletion cascades only on these fixtures.
  delete from auth.users where id=b;
  if exists(select 1 from public.profiles where id=b)
    or exists(select 1 from public.group_memberships where user_id=b)
    or not exists(select 1 from public.profiles where id=a)
    or (select sum(amount) from public.xp_transactions where user_id=a) <> 80 then
    raise exception 'Deletion cascade removed another account or retained deleted membership';
  end if;
  delete from auth.users where id=a;
  if exists(select 1 from auth.sessions where user_id in (a,b))
    or exists(select 1 from public.profiles where id in (a,b))
    or exists(select 1 from public.groups where id=group_id) then
    raise exception 'Auth/profile/group deletion cascade incomplete';
  end if;
  foreach table_name in array array['user_saved_verses','reflections','xp_transactions','user_chapter_progress','user_reading_progress','quiz_attempts','user_achievements','group_memberships'] loop
    execute format('select exists(select 1 from public.%I where user_id in ($1,$2))',table_name) into visible using a,b;
    if visible then raise exception 'Deleted account retained personal rows: %',table_name; end if;
  end loop;
  if (select count(*) from public.bible_books) <> 66
    or (select count(*) from public.quiz_questions where reviewed) <> 60 then
    raise exception 'Deleting an account changed shared reference data';
  end if;
end
$verification$;
