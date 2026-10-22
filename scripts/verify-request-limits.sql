-- Synthetic identities only. ALWAYS run with BEGIN / ROLLBACK in one session.
do $limits$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); result jsonb;
 blocked boolean; statement text; category text; capacity integer;
begin
 insert into auth.users(id) values(a),(b);
 insert into auth.sessions(id,user_id) values(a,a),(b,b);
 perform set_config('role','authenticated',true);
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id',a,'role','authenticated')::text,true);
 perform public.ensure_journey('Rate fixture A','UTC');
 foreach category in array array['export','delete','health'] loop
  capacity:=case category when 'delete' then 3 else 6 end;
  for i in 1..capacity loop
   result:=public.consume_account_request(category);
   if result->>'allowed' is distinct from 'true' then raise exception 'Request budget denied early'; end if;
  end loop;
  result:=public.consume_account_request(category);
  if result->>'allowed' is distinct from 'false' or (result->>'retryAfterSeconds')::integer<1 then
   raise exception 'Exhausted request budget was accepted';
  end if;
 end loop;
 foreach statement in array array['select * from private.request_budgets','select private.admit_request(''write'')','select private.get_journey()','select public.consume_account_request(''write'')'] loop
  blocked:=false;
  begin execute statement;
  exception when insufficient_privilege or invalid_parameter_value then blocked:=true;
  end;
  if not blocked then raise exception 'Quota bypass permitted'; end if;
 end loop;
 -- A later window start (e.g. a lock wait or wall-clock adjustment) must
 -- never produce a retry duration outside the declared export limit.
 perform set_config('role','none',true);
 update private.request_budgets set window_started=clock_timestamp()+interval '1 second' where user_id=a and bucket='export';
 perform set_config('role','authenticated',true);
 result:=public.consume_account_request('export');
 if (result->>'retryAfterSeconds')::integer not between 1 and 300 then raise exception 'Retry duration exceeds its window'; end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'session_id',b,'role','authenticated')::text,true);
 if public.consume_account_request('export')->>'allowed' is distinct from 'true' then raise exception 'Another user inherited a limit'; end if;
 perform set_config('role','none',true);
 update private.request_budgets set window_started=clock_timestamp()-interval '1 hour' where user_id=a;
 perform set_config('role','authenticated',true);
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id',a,'role','authenticated')::text,true);
 if public.consume_account_request('export')->>'allowed' is distinct from 'true' then raise exception 'Expired window did not recover'; end if;
 perform set_config('role','none',true);
 insert into private.request_budgets(user_id,bucket,window_started,requests) values(a,'write',clock_timestamp(),60)
 on conflict(user_id,bucket) do update set window_started=excluded.window_started,requests=excluded.requests;
 perform set_config('role','authenticated',true);
 -- Direct Data API calls must be metered, including initialization and no-op retries.
 foreach statement in array array[
  'select public.ensure_journey(''Rate fixture A'',''UTC'')',
  'select public.complete_chapter(''GEN'',1)',
  'select public.remember_chapter(''GEN'',1)',
  'select public.submit_quiz(''gen-light'',0)',
  'select public.save_journal_entry(current_date,''A synthetic reflection that must not be saved.'',''reflection'',null)',
  'select public.update_journey_preferences(''Changed'',current_date,''UTC'',''light'')'
 ] loop
  blocked:=false;
  begin execute statement;
  exception when sqlstate 'PT429' then blocked:=true;
  end;
  if not blocked then raise exception 'Write quota bypassed'; end if;
 end loop;
 -- Independent read allowance still permits uncertain-save recovery.
 result:=public.get_journey();
 if result->'rewards' is distinct from '{}'::jsonb or result->'reflections' is distinct from '{}'::jsonb
  or result->'chapters' is distinct from '{}'::jsonb or result#>>'{profile,name}' is distinct from 'Rate fixture A' then
  raise exception 'Blocked write changed the journey';
 end if;
 perform set_config('role','none',true);
 update private.request_budgets set requests=180 where user_id=a and bucket='read';
 perform set_config('role','authenticated',true);
 blocked:=false;
 begin perform public.get_journey(); exception when sqlstate 'PT429' then blocked:=true; end;
 if not blocked then raise exception 'Read quota bypassed'; end if;
 perform set_config('role','none',true);
 delete from auth.sessions where id=a;
 perform set_config('role','authenticated',true);
 blocked:=false;
 begin perform public.consume_account_request('health'); exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Revoked session consumed a budget'; end if;
 perform set_config('role','anon',true);
 blocked:=false;
 begin perform public.consume_account_request('health'); exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Anonymous budget access permitted'; end if;
 perform set_config('role','none',true);
 delete from auth.users where id in (a,b);
 if exists(select 1 from private.request_budgets where user_id in (a,b)) then raise exception 'Deleted user retained counters'; end if;
end
$limits$;
