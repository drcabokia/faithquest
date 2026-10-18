-- Synthetic fixtures only; execute within BEGIN/ROLLBACK.
do $verification$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); sa uuid:=gen_random_uuid(); sb uuid:=gen_random_uuid();
 plan uuid; target date:=(now() at time zone 'UTC')::date-1; snapshot jsonb; before_claim jsonb; backup jsonb; invalid jsonb; denied boolean;
begin
 insert into auth.users(id) values(a),(b); insert into auth.sessions(id,user_id) values(sa,a),(sb,b);
 perform set_config('role','authenticated',true); perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id',sa,'role','authenticated')::text,true);
 snapshot:=public.ensure_journey('Grace fixture A','UTC');
 if public.claim_grace_day(target)->>'error' is distinct from 'grace_no_prior_reading'
 or public.claim_grace_day(target+1)->>'error' is distinct from 'grace_invalid_day'
 or public.claim_grace_day(target-1)->>'error' is distinct from 'grace_invalid_day' then raise exception 'Grace eligibility bypassed';end if;
 perform set_config('role','none',true);
 select reading_plan_id into plan from public.profiles where id=a;
 insert into public.user_reading_progress(user_id,plan_id,day,completion_date) values(a,plan,1,target-1);
 perform set_config('role','authenticated',true);before_claim:=public.get_journey();snapshot:=public.claim_grace_day(target);
 if snapshot-'graceDates' is distinct from before_claim-'graceDates' or snapshot->'graceDates' is distinct from jsonb_build_array(target) then raise exception 'Grace changed reading, rewards or challenges';end if;
 if public.claim_grace_day(target) is distinct from snapshot then raise exception 'Grace retry duplicated credit';end if;
 denied:=false;begin insert into public.user_grace_days(user_id,grace_date) values(a,target-30);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Direct grace writes allowed';end if;
 perform set_config('role','none',true);update public.user_grace_days set grace_date=target-29 where user_id=a;perform set_config('role','authenticated',true);
 if public.claim_grace_day(target)->>'error' is distinct from 'grace_cooldown' then raise exception '29-day cooldown bypassed';end if;
 perform set_config('role','none',true);update public.user_grace_days set grace_date=target-30 where user_id=a;perform set_config('role','authenticated',true);
 snapshot:=public.claim_grace_day(target);
 if snapshot->'graceDates' is distinct from jsonb_build_array(target-30,target) then raise exception '30-day boundary rejected';end if;
 if public.claim_grace_day(target-30) is distinct from snapshot then raise exception 'Historical committed claim retry changed state';end if;
 backup:=jsonb_build_object('version',1,'timeZone','UTC','chapters',jsonb_build_object('GEN.4',target-61,'GEN.5',target-61,'GEN.6',target-61),'attempts','{}'::jsonb,'reflections','{}'::jsonb,'graceDates',jsonb_build_array(target-60));
 snapshot:=public.restore_journey(backup);
 if snapshot->'graceDates' is distinct from jsonb_build_array(target-60,target-30,target) or snapshot#>>'{days,2}' is distinct from (target-61)::text or exists(select 1 from public.xp_transactions where user_id=a and activity_key like 'grace:%') then raise exception 'Grace restore fabricated activity';end if;
 if public.restore_journey(backup) is distinct from snapshot then raise exception 'Grace restore replay changed state';end if;
 foreach invalid in array array[
  jsonb_build_array(target-15),jsonb_build_array(target+1),jsonb_build_array(target-90,target-91),jsonb_build_array(target-60,target-60),jsonb_build_array('not-a-date'),'{}'::jsonb,jsonb_build_array(target-120)
 ] loop
  denied:=false;begin perform public.restore_journey(jsonb_set(backup,'{graceDates}',invalid)||jsonb_build_object('chapters',jsonb_build_object('GEN.7',target-1)));exception when sqlstate '22023' then denied:=true;end;
  if not denied or public.get_journey() is distinct from snapshot then raise exception 'Invalid grace restore partially committed';end if;
 end loop;
 snapshot:=public.restore_journey(backup-'graceDates');
 if snapshot->'graceDates' is distinct from jsonb_build_array(target-60,target-30,target) then raise exception 'Legacy restore erased grace dates';end if;
 perform set_config('role','none',true);update public.user_reading_progress set completion_date=target where user_id=a and day=1;delete from public.user_grace_days where user_id=a and grace_date=target;perform set_config('role','authenticated',true);
 if public.claim_grace_day(target)->>'error' is distinct from 'grace_reading_exists' then raise exception 'Grace covered an actual reading date';end if;
 perform set_config('role','none',true);
 update public.user_reading_progress set completion_date=target-1 where user_id=a and day=1;
 delete from public.user_grace_days where user_id=a;
 insert into public.user_grace_days(user_id,grace_date) select a,target-n*30 from generate_series(1,1000) n;
 update private.request_budgets set requests=1 where user_id=a and bucket='restore';
 perform set_config('role','authenticated',true);
 snapshot:=public.get_journey();
 if public.claim_grace_day(target)->>'error' is distinct from 'grace_limit' then raise exception 'Grace claim cap bypassed';end if;
 denied:=false;begin perform public.restore_journey(jsonb_set(backup,'{graceDates}',jsonb_build_array(target)));exception when sqlstate '22023' then denied:=true;end;
 if not denied or public.get_journey() is distinct from snapshot then raise exception 'Grace restore union cap bypassed';end if;
 perform set_config('request.jwt.claim.sub',b::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'session_id',sb,'role','authenticated')::text,true);
 snapshot:=public.ensure_journey('Grace fixture B','UTC');
 if snapshot->'graceDates'<>'[]'::jsonb or exists(select 1 from public.user_grace_days where user_id=a) then raise exception 'Grace history leaked';end if;
 if public.claim_grace_day(target)->>'error' is distinct from 'grace_no_prior_reading' then raise exception 'Another account reading was used';end if;
 perform set_config('role','none',true);update private.request_budgets set requests=60 where user_id=b and bucket='write';perform set_config('role','authenticated',true);
 denied:=false;begin perform public.claim_grace_day(target);exception when sqlstate 'PT429' then denied:=true;end;if not denied then raise exception 'Grace quota bypassed';end if;
 perform set_config('role','none',true);delete from auth.sessions where id=sa;perform set_config('request.jwt.claim.sub',a::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id',sa,'role','authenticated')::text,true);perform set_config('role','authenticated',true);
 denied:=false;begin perform public.claim_grace_day(target);exception when sqlstate '42501' then denied:=true;end;
 if not denied or exists(select 1 from public.user_grace_days where user_id=a) then raise exception 'Revoked grace access allowed';end if;
 perform set_config('role','anon',true);denied:=false;begin perform public.claim_grace_day(target);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Anonymous grace command exposed';end if;
 perform set_config('role','none',true);delete from auth.users where id=a;if exists(select 1 from public.user_grace_days where user_id=a) then raise exception 'Grace cascade failed';end if;
end $verification$;
