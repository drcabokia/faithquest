-- Run inside BEGIN/ROLLBACK; generated synthetic accounts only.
do $verification$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); sa uuid:=gen_random_uuid(); sb uuid:=gen_random_uuid();
 draft uuid:=gen_random_uuid(); draft_question text:='draft-'||gen_random_uuid()::text; today date:=(now() at time zone 'UTC')::date; plan uuid; snapshot jsonb; repeated jsonb; backup jsonb; invalid jsonb; denied boolean; fixture_row record;
begin
 insert into auth.users(id) values(a),(b);
 insert into auth.sessions(id,user_id) values(sa,a),(sb,b);
 select id into plan from public.reading_plans where slug='balanced' and schedule_version=1 and published;
 if plan is null or (select count(*) from public.reading_plan_days where plan_id=plan)<>365
 or (select count(*) from public.reading_plan_day_chapters where plan_id=plan)<>1189
 or exists(select 1 from public.reading_plan_days d where d.plan_id=plan and not exists(select 1 from public.reading_plan_day_chapters m where m.plan_id=plan and m.day=d.day)) then raise exception 'Incomplete balanced schedule'; end if;
 insert into public.reading_plans(id,slug,name,description,canon,published) values(draft,'fixture-'||draft,'Unpublished fixture','Synthetic source publication boundary','protestant',false);
 insert into public.reading_plan_days(plan_id,day) values(draft,1);
 insert into public.quiz_questions(id,plan_id,day,question,options,scripture_reference,reviewed) values(draft_question,draft,1,'Unpublished fixture question','["A","B","C","D"]'::jsonb,'Genesis 1:5',true);
 insert into private.quiz_answers(question_id,correct_option,explanation) values(draft_question,0,'Synthetic unpublished answer');
 perform set_config('role','authenticated',true);
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id',sa,'role','authenticated')::text,true);
 snapshot:=public.ensure_journey('Reading plan fixture A','UTC');
 if snapshot->>'readingPlan'<>'canonical-v1' then raise exception 'Legacy default changed'; end if;
 perform public.set_saved_verse('JHN',3,16,true);
 snapshot:=public.select_reading_plan('balanced-v1');
 if snapshot->>'readingPlan'<>'balanced-v1' or not(snapshot->'savedVerses'?'JHN.3.16') or snapshot->'rewards'<>'{}'::jsonb then raise exception 'Selection lost data or awarded XP'; end if;
 if public.select_reading_plan('balanced-v1') is distinct from snapshot then raise exception 'Selection retry changed state'; end if;
 perform public.select_reading_plan('canonical-v1');
 snapshot:=public.select_reading_plan('balanced-v1');
 denied:=false;
 begin perform public.select_reading_plan('chronological-v1'); exception when sqlstate '22023' then denied:=true; end;
 if not denied then raise exception 'Draft plan selected'; end if;
 snapshot:=public.complete_chapter('GEN',1);
 snapshot:=public.complete_chapter('GEN',2);
 snapshot:=public.complete_chapter('GEN',3);
 if snapshot->'days'<>'{}'::jsonb then raise exception 'Canonical mission incorrectly completed in balanced plan'; end if;
 if public.select_reading_plan('canonical-v1')->>'error' is distinct from 'plan_locked' then raise exception 'Changed plan after activity'; end if;
 for fixture_row in select book_id,chapter from public.reading_plan_day_chapters where plan_id=plan and day=1 order by position loop
  snapshot:=public.complete_chapter(fixture_row.book_id,fixture_row.chapter);
 end loop;
 if snapshot#>>'{rewards,reading:balanced-v1:1,amount}' is distinct from '50' or snapshot->'rewards'?'reading:1' then raise exception 'Wrong reading reward namespace'; end if;
 if public.complete_chapter(fixture_row.book_id,fixture_row.chapter) is distinct from snapshot then raise exception 'Duplicate reading XP'; end if;
 denied:=false;
 begin perform public.submit_quiz(draft_question,0); exception when sqlstate '22023' then denied:=true; end;
 if not denied then raise exception 'Unpublished question source accepted'; end if;
 denied:=false;
 begin perform public.restore_journey(jsonb_build_object('version',1,'readingPlan','balanced-v1','timeZone','UTC','chapters','{}'::jsonb,'reflections','{}'::jsonb,'attempts',jsonb_build_object(draft_question,jsonb_build_object('answer',0,'date',today)))); exception when sqlstate '22023' then denied:=true; end;
 if not denied or public.get_journey() is distinct from snapshot then raise exception 'Unpublished question import applied'; end if;
 snapshot:=public.submit_quiz('gen-light',0);
 if snapshot#>>'{rewards,quiz:gen-light,amount}' is distinct from '10' or public.submit_quiz('gen-light',1) is distinct from snapshot then raise exception 'Shared quiz identity changed or duplicated'; end if;
 backup:=jsonb_build_object('version',1,'timeZone','UTC','readingPlan','balanced-v1','chapters',jsonb_build_object('GEN.50',today),'attempts',jsonb_build_object('gen-light',jsonb_build_object('answer',0,'date',today)),'reflections','{}'::jsonb);
 foreach invalid in array array[backup-'readingPlan',backup||'{"readingPlan":"canonical-v1"}'::jsonb,backup||'{"readingPlan":"balanced-v2"}'::jsonb,backup||'{"readingPlan":null}'::jsonb] loop
  denied:=false;
  begin perform public.restore_journey(invalid); exception when sqlstate '22023' then denied:=true; end;
  if not denied or public.get_journey() is distinct from snapshot then raise exception 'Mismatched backup partially applied'; end if;
 end loop;
 snapshot:=public.restore_journey(backup);
 if not(snapshot->'chapters'?'GEN.50') or public.restore_journey(backup) is distinct from snapshot then raise exception 'Balanced restore lost data or duplicated XP'; end if;
 perform public.join_reading_challenge();
 perform set_config('role','none',true);
 update private.request_budgets set requests=1 where user_id=a;
 delete from public.user_reading_challenges where user_id=a;
 insert into public.user_reading_challenges(user_id,start_date) values(a,today-6);
 perform set_config('role','authenticated',true);
 backup:=jsonb_build_object('version',1,'timeZone','UTC','readingPlan','balanced-v1','chapters',
 (select jsonb_object_agg(book_id||'.'||chapter,today-7+day) from public.reading_plan_day_chapters where plan_id=plan and day<=7),'attempts','{}'::jsonb,'reflections','{}'::jsonb,'challengeStarts',jsonb_build_array(today-6));
 -- Existing early chapter/mission dates win; seven distinct dates are not yet present.
 snapshot:=public.restore_journey(backup);
 if snapshot->'rewards'?('challenge:'||(today-6)) then raise exception 'Challenge ignored preserved mission dates'; end if;
 perform set_config('role','none',true);
 update public.user_reading_progress set completion_date=today-7+day where user_id=a and plan_id=plan and day<=2;
 perform set_config('role','authenticated',true);
 snapshot:=public.restore_journey(backup);
 if snapshot#>>array['rewards','challenge:'||(today-6),'amount'] is distinct from '100' then raise exception 'Balanced seven-date challenge did not reconcile'; end if;
 snapshot:=public.manage_fellowship(jsonb_build_object('type','create','requestId',gen_random_uuid(),'name','Plan fixture','consent',true));
 if snapshot#>>'{groups,0,members,0,participationPercent}' is distinct from '2' then raise exception 'Fellowship did not use selected-plan completion'; end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'session_id',sb,'role','authenticated')::text,true);
 snapshot:=public.ensure_journey('Reading plan fixture B','UTC');
 if snapshot->>'readingPlan'<>'canonical-v1' or snapshot->'chapters'<>'{}'::jsonb then raise exception 'Plan or progress leaked across accounts'; end if;
 backup:=jsonb_build_object('version',1,'timeZone','UTC','chapters',jsonb_build_object('GEN.1',today,'GEN.2',today,'GEN.3',today),'attempts','{}'::jsonb,'reflections','{}'::jsonb);
 snapshot:=public.restore_journey(backup);
 if snapshot#>>'{rewards,reading:1,amount}' is distinct from '50' then raise exception 'Legacy canonical reward changed'; end if;
 perform set_config('role','none',true);
 delete from auth.sessions where id=sa;
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id',sa,'role','authenticated')::text,true);
 perform set_config('role','authenticated',true);
 denied:=false;
 begin perform public.select_reading_plan('balanced-v1'); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Revoked session selected plan'; end if;
 perform set_config('role','anon',true);
 denied:=false;
 begin perform public.select_reading_plan('balanced-v1'); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Anonymous plan mutation allowed'; end if;
 perform set_config('role','none',true);
 raise notice 'Reading-plan coverage, selection, restore, reward, quiz, challenge, fellowship and session checks passed';
end $verification$;
