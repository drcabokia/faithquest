-- Always execute inside BEGIN/ROLLBACK. Generated synthetic accounts only.
do $verification$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); sa uuid:=gen_random_uuid(); sb uuid:=gen_random_uuid();
 today date:=(now() at time zone 'UTC')::date; plan uuid; snapshot jsonb; repeated jsonb; backup jsonb; invalid jsonb; denied boolean; fixture_row record; statement text;
begin
 insert into auth.users(id) values(a),(b);
 insert into auth.sessions(id,user_id) values(sa,a),(sb,b);
 select id into plan from public.reading_plans where slug='canonical';
 perform set_config('role','authenticated',true);
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id',sa,'role','authenticated')::text,true);
 perform public.ensure_journey('Challenge fixture A','UTC');
 snapshot:=public.join_reading_challenge();
 if snapshot->'challengeStarts'<>jsonb_build_array(today) or snapshot->'rewards'<>'{}'::jsonb then raise exception 'Joining changed XP or used a different date'; end if;
 if public.join_reading_challenge() is distinct from snapshot then raise exception 'Repeated join changed enrollment'; end if;
 denied:=false;
 begin perform public.update_journey_preferences('Challenge fixture A',today,'Asia/Kuala_Lumpur','light'); exception when sqlstate '22023' then denied:=true; end;
 if not denied then raise exception 'Enrollment did not fix the calendar timezone'; end if;
 -- Move only this generated fixture enrollment to its seventh date.
 perform set_config('role','none',true);
 delete from public.user_reading_challenges where user_id=a;
 insert into public.user_reading_challenges(user_id,start_date) values(a,today-6);
 perform set_config('role','authenticated',true);
 backup:=jsonb_build_object('version',1,'timeZone','UTC','chapters',
   (select jsonb_object_agg(book_id||'.'||chapter,today-7+day) from public.reading_plan_day_chapters where plan_id=plan and day<=6),
   'attempts','{}'::jsonb,'reflections','{}'::jsonb,'challengeStarts',jsonb_build_array(today-6));
 snapshot:=public.restore_journey(backup);
 if snapshot->'rewards'?('challenge:'||(today-6)) then raise exception 'Incomplete challenge earned XP'; end if;
 for fixture_row in select book_id,chapter from public.reading_plan_day_chapters where plan_id=plan and day=7 order by position loop
  snapshot:=public.complete_chapter(fixture_row.book_id,fixture_row.chapter);
 end loop;
 if snapshot#>>array['rewards','challenge:'||(today-6),'amount'] is distinct from '100'
 or snapshot#>>array['rewards','challenge:'||(today-6),'date'] is distinct from today::text
 or (select sum(amount) from public.xp_transactions where user_id=a)<>450 then raise exception 'Seventh distinct date did not earn exactly one bonus'; end if;
 repeated:=public.complete_chapter(fixture_row.book_id,fixture_row.chapter);
 if repeated is distinct from snapshot or public.join_reading_challenge() is distinct from snapshot then raise exception 'Repeated completion/join changed state'; end if;
 snapshot:=public.restore_journey(backup);
 if public.restore_journey(backup-'challengeStarts') is distinct from snapshot then raise exception 'Legacy restore lost challenge history'; end if;
 perform set_config('role','none',true);
 update private.request_budgets set requests=1 where user_id=a and bucket='restore';
 perform set_config('role','authenticated',true);
 foreach invalid in array array[
  backup||jsonb_build_object('challengeStarts',jsonb_build_array(today+1)),
  backup||jsonb_build_object('challengeStarts',jsonb_build_array(today-6,today-6)),
  backup||jsonb_build_object('challengeStarts',jsonb_build_array(today-5)),
  backup||'{"challengeStarts":null}'::jsonb,
  backup||'{"challengeStarts":[{"start":"2026-01-01","complete":true,"xp":100}]}'::jsonb,
  backup||jsonb_build_object('challengeStarts',(select jsonb_agg(today-7000+i*7) from generate_series(0,1000) i))
 ] loop
  denied:=false;
  begin perform public.restore_journey(invalid||jsonb_build_object('chapters',jsonb_build_object('GEN.50',today-1))); exception when sqlstate '22023' then denied:=true; end;
  if not denied or public.get_journey() is distinct from snapshot then raise exception 'Invalid challenge import changed activity'; end if;
 end loop;
 foreach statement in array array[
  'insert into public.user_reading_challenges(user_id,start_date) values(auth.uid(),current_date)',
  'update public.user_reading_challenges set start_date=current_date',
  'delete from public.user_reading_challenges',
  'select private.award_reading_challenges()'
 ] loop
  denied:=false;
  begin execute statement; exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Direct challenge/helper access was allowed'; end if;
 end loop;
 perform set_config('role','none',true);
 update private.request_budgets set requests=60 where user_id=a and bucket='write';
 perform set_config('role','authenticated',true);
 denied:=false;
 begin perform public.join_reading_challenge(); exception when sqlstate 'PT429' then denied:=true; end;
 if not denied or public.get_journey() is distinct from snapshot then raise exception 'Challenge write quota bypass or partial write'; end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'session_id',sb,'role','authenticated')::text,true);
 snapshot:=public.ensure_journey('Challenge fixture B','UTC');
 if snapshot->'challengeStarts'<>'[]'::jsonb or exists(select 1 from public.user_reading_challenges where user_id=a) then raise exception 'Challenge history leaked across accounts'; end if;
 -- Restore the same seven missions on one date: no seven-date bonus.
 backup:=jsonb_build_object('version',1,'timeZone','UTC','chapters',
   (select jsonb_object_agg(book_id||'.'||chapter,today) from public.reading_plan_day_chapters where plan_id=plan and day<=7),
   'attempts','{}'::jsonb,'reflections','{}'::jsonb,'challengeStarts',jsonb_build_array(today-6));
 snapshot:=public.restore_journey(backup);
 if snapshot->'rewards'?('challenge:'||(today-6)) then raise exception 'Same-date missions earned a seven-date bonus'; end if;
 -- Complete history proves that new challenges need enough remaining missions.
 backup:=jsonb_set(backup,array['chapters'],(select jsonb_object_agg(book_id||'.'||chapter,today) from public.reading_plan_day_chapters where plan_id=plan));
 perform public.restore_journey(backup);
 perform set_config('role','none',true);
 delete from public.user_reading_challenges where user_id=b;
 perform set_config('role','authenticated',true);
 denied:=false;
 begin perform public.join_reading_challenge(); exception when sqlstate '22023' then denied:=true; end;
 if not denied then raise exception 'Impossible new challenge accepted'; end if;
 perform set_config('role','none',true);
 delete from auth.sessions where id=sa;
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id',sa,'role','authenticated')::text,true);
 perform set_config('role','authenticated',true);
 if exists(select 1 from public.user_reading_challenges where user_id=a) then raise exception 'Revoked session read challenge history'; end if;
 denied:=false;
 begin perform public.join_reading_challenge(); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Revoked session joined a challenge'; end if;
 perform set_config('role','anon',true);
 denied:=false;
 begin perform public.join_reading_challenge(); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Anonymous challenge RPC allowed'; end if;
 perform set_config('role','none',true);
 delete from auth.users where id=a;
 if exists(select 1 from public.user_reading_challenges where user_id=a) then raise exception 'Challenge deletion did not cascade'; end if;
end $verification$;
