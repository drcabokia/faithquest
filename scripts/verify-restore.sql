-- Synthetic fixtures only. The caller MUST wrap this script in BEGIN/ROLLBACK.
do $verification$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); sa uuid:=gen_random_uuid(); sb uuid:=gen_random_uuid();
 backup jsonb; snapshot jsonb; repeated jsonb; invalid jsonb; question record;
 today date:= (now() at time zone 'UTC')::date; yesterday date:=today-1; total integer; denied boolean;
begin
 insert into auth.users(id) values(a),(b);
 insert into auth.sessions(id,user_id) values(sa,a),(sb,b);
 perform set_config('role','authenticated',true);
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id',sa,'role','authenticated')::text,true);
 perform public.ensure_journey('Restore fixture A','UTC');
 perform public.save_journal_entry(today,'Existing reflection must survive a conflicting backup.',coalesce((select category from public.reflections where user_id=auth.uid() and reflection_date=today),'reflection'),(select revision::text from public.reflections where user_id=auth.uid() and reflection_date=today));
 perform public.submit_quiz('gen-rest',0);
 backup:=jsonb_build_object('version',1,'timeZone','UTC',
 'chapters',jsonb_build_object('GEN.1',yesterday,'GEN.2',yesterday,'GEN.3',yesterday),
 'attempts',jsonb_build_object('gen-light',jsonb_build_object('answer',0,'date',yesterday),'gen-rest',jsonb_build_object('answer',2,'date',yesterday)),
 'reflections',jsonb_build_object(today::text,jsonb_build_object('text','An imported conflicting reflection must not replace saved text.'),yesterday::text,jsonb_build_object('text','A recovered synthetic reflection from the previous day.')));
 snapshot:=public.restore_journey(backup);
 if snapshot#>>array['reflections',today::text,'text'] is distinct from 'Existing reflection must survive a conflicting backup.'
 or snapshot#>>'{attempts,gen-rest,answer}' is distinct from '0'
 or snapshot#>>'{attempts,gen-rest,correct}' is distinct from 'false'
 or snapshot#>>'{attempts,gen-light,correctOption}' is distinct from '0'
 or snapshot#>>'{days,1}' is distinct from yesterday::text
 or snapshot#>>'{profile,name}' is distinct from 'Restore fixture A' then raise exception 'Restore merge changed existing records'; end if;
 select sum(amount) into total from public.xp_transactions;
 if total<>100 then raise exception 'Restore rewards must be derived exactly once'; end if;
 repeated:=public.restore_journey(backup);
 if repeated is distinct from snapshot then raise exception 'Repeated restore changed saved state'; end if;
 -- Every invalid direct RPC must fail atomically, including valid rows mixed
 -- with invalid rows and attempts to smuggle trusted fields or another actor.
 foreach invalid in array array[
  backup||jsonb_build_object('userId',b),
  backup||'{"version":2}'::jsonb,
  backup||'{"timeZone":"Asia/Kuala_Lumpur"}'::jsonb,
  backup||'{"chapters":null}'::jsonb,
  backup||jsonb_build_object('chapters',jsonb_build_object('GEN.4',today,'GEN.999',today)),
  backup||jsonb_build_object('chapters',jsonb_build_object('GEN.4','2099-01-01')),
  backup||jsonb_build_object('chapters',jsonb_build_object('GEN.4','2026-02-30')),
  backup||'{"attempts":{"gen-light":{"answer":0,"date":"2026-01-01","correct":true}}}'::jsonb,
  backup||'{"attempts":{"unknown":{"answer":0,"date":"2026-01-01"}}}'::jsonb,
  backup||'{"reflections":{"2026-01-01":{"text":"short"}}}'::jsonb,
  backup||'{"reflections":{"2099-01-01":{"text":"A future reflection is not valid activity."}}}'::jsonb
 ] loop
  denied:=false;
  begin perform public.restore_journey(invalid); exception when sqlstate '22023' or sqlstate '22008' or sqlstate '22007' then denied:=true; end;
  if not denied then raise exception 'Invalid direct restore was accepted'; end if;
  if public.get_journey() is distinct from snapshot then raise exception 'Failed restore partially changed data'; end if;
 end loop;
 -- Third successful restore fills the independent budget; read recovery stays available.
 perform public.restore_journey(backup);
 denied:=false;
 begin perform public.restore_journey(backup); exception when sqlstate 'PT429' then denied:=true; end;
 if not denied or public.get_journey() is distinct from snapshot then raise exception 'Restore quota or recovery failed'; end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'session_id',sb,'role','authenticated')::text,true);
 snapshot:=public.ensure_journey('Restore fixture B','UTC');
 if snapshot->'chapters'<>'{}'::jsonb or snapshot->'reflections'<>'{}'::jsonb then raise exception 'Cross-account restore leak'; end if;
 -- A full chapter-only backup reconstructs all days/books and achievements.
 perform set_config('role','none',true);
 select jsonb_build_object('version',1,'timeZone','UTC','chapters',jsonb_object_agg(book_id||'.'||chapter,yesterday),'attempts','{}'::jsonb,'reflections','{}'::jsonb) into backup from public.bible_chapters;
 perform set_config('role','authenticated',true);
 snapshot:=public.restore_journey(backup);
 select sum(amount) into total from public.xp_transactions;
 if total<>28150 or (select count(*) from public.user_reading_progress)<>365 or not (snapshot->'earnedAchievements' ? 'year') then raise exception 'Full-year reconstruction failed'; end if;
 -- Each new reviewed question is answerable once; retrying cannot flip it.
 for question in select id from public.quiz_questions where day between 4 and 14 order by day,id loop
  perform set_config('role','none',true);
  select correct_option into total from private.quiz_answers where question_id=question.id;
  perform set_config('role','authenticated',true);
  perform public.submit_quiz(question.id,total);
  repeated:=public.submit_quiz(question.id,(total+1)%4);
  if repeated#>>array['attempts',question.id,'correct'] is distinct from 'true' then raise exception 'Expanded quiz immutability failed'; end if;
 end loop;
 select sum(amount) into total from public.xp_transactions;
 if total<>28370 then raise exception 'Expanded quiz rewards are not unique'; end if;
 -- Revoked and anonymous identities cannot import, even with an unexpired JWT.
 perform set_config('role','none',true);
 delete from auth.sessions where id=sb;
 perform set_config('role','authenticated',true);
 denied:=false;
 begin perform public.restore_journey(backup); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Revoked restore accepted'; end if;
 perform set_config('role','anon',true);
 denied:=false;
 begin perform public.restore_journey(backup); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Anonymous restore accepted'; end if;
 perform set_config('role','none',true);
end $verification$;
