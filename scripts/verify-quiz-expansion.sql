-- Always run inside BEGIN/ROLLBACK. Generated synthetic accounts only.
do $verification$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid();
 sa uuid:=gen_random_uuid(); sb uuid:=gen_random_uuid(); sc uuid:=gen_random_uuid(); actor uuid; sid uuid;
 today date:=(now() at time zone 'UTC')::date; catalogue jsonb; entry jsonb; snapshot jsonb; repeated jsonb; backup jsonb;
 n integer; choice integer; denied boolean;
begin
 if (select count(*) from public.quiz_questions q join public.reading_plans p on p.id=q.plan_id where q.reviewed and p.published)<>60 or (select count(*) from public.quiz_questions q join public.reading_plans p on p.id=q.plan_id where q.reviewed and p.published and q.day between 15 and 30)<>32 then raise exception 'Expanded quiz catalogue incomplete'; end if;
 select jsonb_agg(jsonb_build_object('id',q.id,'answer',s.correct_option) order by q.id) into catalogue from public.quiz_questions q join private.quiz_answers s on s.question_id=q.id join public.reading_plans p on p.id=q.plan_id where q.day between 15 and 30 and q.reviewed and p.published;
 insert into auth.users(id) values(a),(b),(c);
 insert into auth.sessions(id,user_id) values(sa,a),(sb,b),(sc,c);
 foreach actor in array array[a,b] loop
  sid:=case when actor=a then sa else sb end;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'session_id',sid,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  snapshot:=public.ensure_journey('Expanded quiz fixture','UTC');
  if actor=b then snapshot:=public.select_reading_plan('balanced-v1'); end if;
  if snapshot->'attempts'<>'{}'::jsonb then raise exception 'Quiz attempts leaked across accounts'; end if;
  if (select count(*) from public.quiz_questions)<>60 then raise exception 'Public prompts unavailable'; end if;
  denied:=false;
  begin perform 1 from private.quiz_answers; exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Private solutions exposed'; end if;
  n:=0;
  for entry in select value from jsonb_array_elements(catalogue) loop
   n:=n+1;
   if n=17 then
    perform set_config('role','none',true);
    update private.request_budgets set requests=1 where user_id=actor;
    perform set_config('role','authenticated',true);
   end if;
   choice:=(entry->>'answer')::integer;
   if actor=b and n=1 then choice:=(choice+1)%4; end if;
   snapshot:=public.submit_quiz(entry->>'id',choice);
   repeated:=public.submit_quiz(entry->>'id',(entry->>'answer')::integer);
   if repeated is distinct from snapshot then raise exception 'Expanded answer retry replaced an attempt or awarded XP twice'; end if;
   if snapshot#>>array['attempts',entry->>'id','correctOption'] is distinct from (entry->>'answer') then raise exception 'Submitted feedback does not match protected solution'; end if;
   if actor=b and n=1 then
    if snapshot->'rewards'?('quiz:'||(entry->>'id')) then raise exception 'Wrong first answer became a reward'; end if;
   elsif snapshot#>>array['rewards','quiz:'||(entry->>'id'),'amount'] is distinct from '10' then raise exception 'New quiz reward missing'; end if;
  end loop;
  perform set_config('role','none',true);
  if (select sum(amount) from public.xp_transactions where user_id=actor)<>(case when actor=a then 320 else 310 end) then raise exception 'Expanded quiz reward total incorrect'; end if;
 end loop;
 perform set_config('request.jwt.claim.sub',c::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',c,'session_id',sc,'role','authenticated')::text,true);
 perform set_config('role','authenticated',true);
 perform public.ensure_journey('Expanded restore fixture','UTC');
 perform public.select_reading_plan('balanced-v1');
 backup:=jsonb_build_object('version',1,'readingPlan','balanced-v1','timeZone','UTC','chapters','{}'::jsonb,'reflections','{}'::jsonb,'attempts',
 (select jsonb_object_agg(value->>'id',jsonb_build_object('answer',(value->>'answer')::integer,'date',today)) from jsonb_array_elements(catalogue)));
 snapshot:=public.restore_journey(backup);
 if public.restore_journey(backup) is distinct from snapshot or (select count(*) from public.quiz_attempts where user_id=c)<>32 then raise exception 'Expanded backup recovery is not idempotent'; end if;
 denied:=false;
 begin perform public.restore_journey(backup||'{"rewards":{"forged":999999}}'::jsonb); exception when sqlstate '22023' then denied:=true; end;
 if not denied or public.get_journey() is distinct from snapshot then raise exception 'Caller-supplied quiz ledger was accepted'; end if;
 perform set_config('role','none',true);
 if (select sum(amount) from public.xp_transactions where user_id=c)<>320 then raise exception 'Restored quiz rewards not rederived'; end if;
 delete from auth.sessions where id=sc;
 perform set_config('role','authenticated',true);
 denied:=false;
 begin perform public.submit_quiz('lev-altar-fire',0); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Revoked session submitted an expanded quiz'; end if;
 perform set_config('role','anon',true);
 denied:=false;
 begin perform public.submit_quiz('lev-altar-fire',0); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Anonymous expanded submission accepted'; end if;
 perform set_config('role','none',true);
 raise notice 'Expanded quiz catalogue, privacy, both plans, rewards, wrong-answer immutability, restore and session checks passed';
end $verification$;
