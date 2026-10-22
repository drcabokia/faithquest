-- Always execute inside BEGIN/ROLLBACK. Only generated synthetic accounts.
do $verification$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); sa uuid:=gen_random_uuid(); sb uuid:=gen_random_uuid();
 snapshot jsonb; backup jsonb; invalid jsonb; denied boolean; today date:=(now() at time zone 'UTC')::date;
begin
 insert into auth.users(id) values(a),(b);
 insert into auth.sessions(id,user_id) values(sa,a),(sb,b);
 perform set_config('role','authenticated',true);
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id',sa,'role','authenticated')::text,true);
 perform public.ensure_journey('Journal fixture A','UTC');
 snapshot:=public.save_journal_entry(today,'A synthetic private prayer about growing in faith.','prayer',(select revision::text from public.reflections where user_id=auth.uid() and reflection_date=today));
 if snapshot#>>array['reflections',today::text,'category'] is distinct from 'prayer' then raise exception 'Category save failed'; end if;
 snapshot:=public.save_journal_entry(today,'A synthetic private prayer about growing in faith.','gratitude',(select revision::text from public.reflections where user_id=auth.uid() and reflection_date=today));
 snapshot:=public.save_journal_entry(today,'An edited synthetic reflection retains its existing category.',coalesce((select category from public.reflections where user_id=auth.uid() and reflection_date=today),'reflection'),(select revision::text from public.reflections where user_id=auth.uid() and reflection_date=today));
 if snapshot#>>array['reflections',today::text,'category'] is distinct from 'gratitude'
 or (select sum(amount) from public.xp_transactions where user_id=a)<>20 then raise exception 'Legacy edit lost category or duplicated XP'; end if;
 denied:=false;
 begin perform public.save_journal_entry(today,'This synthetic category must be rejected.','public',(select revision::text from public.reflections where user_id=auth.uid() and reflection_date=today)); exception when sqlstate '22023' then denied:=true; end;
 if not denied or public.get_journey() is distinct from snapshot then raise exception 'Invalid category changed state'; end if;
 denied:=false;
 begin perform public.save_journal_entry(today,'This synthetic category must be rejected.',null,(select revision::text from public.reflections where user_id=auth.uid() and reflection_date=today)); exception when sqlstate '22023' then denied:=true; end;
 if not denied then raise exception 'Null category accepted'; end if;
 denied:=false;
 begin perform public.save_journal_entry(today-1,'A new past entry must not bypass calendar rules.','prayer',(select revision::text from public.reflections where user_id=auth.uid() and reflection_date=today-1)); exception when sqlstate '22023' then denied:=true; end;
 if not denied then raise exception 'Backdated new entry accepted'; end if;
 backup:=jsonb_build_object('version',1,'timeZone','UTC','chapters','{}'::jsonb,'attempts','{}'::jsonb,'reflections',jsonb_build_object(
   (today-1)::text,jsonb_build_object('text','A historical synthetic prayer restored from a backup.','category','prayer'),
   today::text,jsonb_build_object('text','A conflicting synthetic entry must retain the current category.','category','application')));
 snapshot:=public.restore_journey(backup);
 if snapshot#>>array['reflections',(today-1)::text,'category'] is distinct from 'prayer'
 or snapshot#>>array['reflections',today::text,'category'] is distinct from 'gratitude' then raise exception 'Category restore/conflict rule failed'; end if;
 snapshot:=public.save_journal_entry(today-1,'An edited historical synthetic prayer keeps its only reward.','application',(select revision::text from public.reflections where user_id=auth.uid() and reflection_date=today-1));
 if (select sum(amount) from public.xp_transactions where user_id=a)<>40 then raise exception 'Historical edit duplicated XP'; end if;
 -- Legacy backup entries have no category; they acquire the default.
 backup:=jsonb_set(backup,array['reflections'],jsonb_build_object((today-2)::text,jsonb_build_object('text','A legacy synthetic reflection without any category.')));
 snapshot:=public.restore_journey(backup);
 if snapshot#>>array['reflections',(today-2)::text,'category'] is distinct from 'reflection' then raise exception 'Legacy category default failed'; end if;
 foreach invalid in array array[
  jsonb_build_object('text','An invalid synthetic imported reflection.','category','public'),
  jsonb_build_object('text','An invalid synthetic imported reflection.','category',null),
  jsonb_build_object('text','An invalid synthetic imported reflection.','category',1),
  jsonb_build_object('text','An invalid synthetic imported reflection.','category','prayer','user_id',b)
 ] loop
  denied:=false;
  begin perform public.restore_journey(jsonb_set(backup,array['reflections'],jsonb_build_object((today-3)::text,invalid))); exception when sqlstate '22023' then denied:=true; end;
  if not denied or public.get_journey() is distinct from snapshot then raise exception 'Invalid import was not atomic'; end if;
 end loop;
 denied:=false;
 begin update public.reflections set category='prayer' where user_id=a; exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Direct category update allowed'; end if;
 -- The new endpoint shares the existing write budget and rolls back blocked edits.
 perform set_config('role','none',true);
 update private.request_budgets set requests=60 where user_id=a and bucket='write';
 perform set_config('role','authenticated',true);
 denied:=false;
 begin perform public.save_journal_entry(today,'A rate-limited synthetic edit must not commit.','prayer',(select revision::text from public.reflections where user_id=auth.uid() and reflection_date=today)); exception when sqlstate 'PT429' then denied:=true; end;
 if not denied or public.get_journey() is distinct from snapshot then raise exception 'Journal quota bypass or partial write'; end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'session_id',sb,'role','authenticated')::text,true);
 snapshot:=public.ensure_journey('Journal fixture B','UTC');
 if snapshot->'reflections'<>'{}'::jsonb or exists(select 1 from public.reflections where user_id=a) then raise exception 'Journal leaked across accounts'; end if;
 -- Revocation must reject the new command, even with an otherwise valid caller.
 perform set_config('role','none',true);
 delete from auth.sessions where id=sa;
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id',sa,'role','authenticated')::text,true);
 perform set_config('role','authenticated',true);
 denied:=false;
 begin perform public.save_journal_entry(today,'Revoked synthetic sessions must not edit this.','prayer',(select revision::text from public.reflections where user_id=auth.uid() and reflection_date=today)); exception when sqlstate '42501' then denied:=true; end;
 if not denied then raise exception 'Revoked session edited journal'; end if;
 perform set_config('role','none',true);
 delete from auth.users where id=a;
 if exists(select 1 from public.reflections where user_id=a) then raise exception 'Journal deletion did not cascade'; end if;
end $verification$;
