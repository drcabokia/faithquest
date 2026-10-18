-- Compute retry time after lock waits and clamp it to the configured window.
begin;
create or replace function private.admit_request(p_bucket text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); cap integer; seconds integer;
 started timestamptz; admitted integer; moment timestamptz := clock_timestamp();
begin
 if actor is null or not public.account_session_active() then
  raise exception 'Authentication required' using errcode='42501';
 end if;
 case p_bucket
  when 'read' then cap:=180; seconds:=60;
  when 'write' then cap:=60; seconds:=60;
  when 'export' then cap:=6; seconds:=300;
  when 'delete' then cap:=3; seconds:=900;
  when 'health' then cap:=6; seconds:=60;
  else raise exception 'Invalid request category' using errcode='22023';
 end case;
 insert into private.request_budgets as budget(user_id,bucket,window_started,requests)
 values(actor,p_bucket,moment,1)
 on conflict(user_id,bucket) do update set
  window_started=case when budget.window_started+make_interval(secs=>seconds)<=moment then moment else budget.window_started end,
  requests=case when budget.window_started+make_interval(secs=>seconds)<=moment then 1 else budget.requests+1 end
 where budget.window_started+make_interval(secs=>seconds)<=moment or budget.requests<cap
 returning requests into admitted;
 if admitted is not null then return jsonb_build_object('allowed',true,'retryAfterSeconds',0); end if;
 select window_started into started from private.request_budgets where user_id=actor and bucket=p_bucket;
 return jsonb_build_object('allowed',false,'retryAfterSeconds',greatest(1,least(seconds,ceil(extract(epoch from started+make_interval(secs=>seconds)-clock_timestamp()))::integer)));
end $$;
revoke all on function private.admit_request(text) from public,anon,authenticated;
commit;
