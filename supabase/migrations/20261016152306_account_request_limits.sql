-- Fixed-window per-account admission. No client can choose an actor or a limit.
begin;
create table private.request_budgets (
 user_id uuid not null references auth.users(id) on delete cascade,
 bucket text not null check(bucket in ('read','write','export','delete','health')),
 window_started timestamptz not null,
 requests integer not null check(requests between 1 and 180),
 primary key(user_id,bucket)
);
alter table private.request_budgets enable row level security;
revoke all on private.request_budgets from public,anon,authenticated;

create function private.admit_request(p_bucket text) returns jsonb
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
 return jsonb_build_object('allowed',false,'retryAfterSeconds',greatest(1,ceil(extract(epoch from started+make_interval(secs=>seconds)-moment))::integer));
end $$;

create function private.enforce_request_limit(p_bucket text) returns void
language plpgsql security definer set search_path='' as $$
declare admission jsonb := private.admit_request(p_bucket);
begin
 if not (admission->>'allowed')::boolean then
  raise sqlstate 'PT429' using message='Too many account requests',detail=admission::text;
 end if;
end $$;

create function public.consume_account_request(p_bucket text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if p_bucket is null or p_bucket not in ('export','delete','health') then
  raise exception 'Invalid request category' using errcode='22023';
 end if;
 return private.admit_request(p_bucket);
end $$;

-- Keep the reviewed command implementations private and expose metered wrappers.
alter function public.get_journey() set schema private;
alter function public.ensure_journey(text,text) set schema private;
alter function public.complete_chapter(text,integer) set schema private;
alter function public.remember_chapter(text,integer) set schema private;
alter function public.submit_quiz(text,integer) set schema private;
alter function public.save_reflection(date,text) set schema private;
alter function public.update_journey_preferences(text,date,text,text) set schema private;

-- Always acquire the existing profile lock before quota rows. Nested snapshots
-- are reads too, but cannot reverse this lock order or deadlock another command.
create function public.get_journey() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.actor(); perform private.enforce_request_limit('read');
 return private.get_journey();
end $$;
create function public.ensure_journey(p_name text,p_timezone text) returns jsonb language plpgsql security definer set search_path='' as $$
declare snapshot jsonb;
begin
 -- Initialization creates/locks a missing profile before taking any quota lock.
 snapshot:=private.ensure_journey(p_name,p_timezone);
 perform private.enforce_request_limit('write');
 return snapshot;
end $$;
create function public.complete_chapter(p_book text,p_chapter integer) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.actor(); perform private.enforce_request_limit('write');
 return private.complete_chapter(p_book,p_chapter);
end $$;
create function public.remember_chapter(p_book text,p_chapter integer) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.actor(); perform private.enforce_request_limit('write');
 return private.remember_chapter(p_book,p_chapter);
end $$;
create function public.submit_quiz(p_question text,p_option integer) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.actor(); perform private.enforce_request_limit('write');
 return private.submit_quiz(p_question,p_option);
end $$;
create function public.save_reflection(p_date date,p_content text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.actor(); perform private.enforce_request_limit('write');
 return private.save_reflection(p_date,p_content);
end $$;
create function public.update_journey_preferences(p_name text,p_start_date date,p_timezone text,p_theme text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.actor(); perform private.enforce_request_limit('write');
 return private.update_journey_preferences(p_name,p_start_date,p_timezone,p_theme);
end $$;

revoke all on all functions in schema private from public,anon,authenticated;
revoke all on function public.consume_account_request(text),public.get_journey(),public.ensure_journey(text,text),public.complete_chapter(text,integer),public.remember_chapter(text,integer),public.submit_quiz(text,integer),public.save_reflection(date,text),public.update_journey_preferences(text,date,text,text) from public,anon,authenticated;
grant execute on function public.consume_account_request(text),public.get_journey(),public.ensure_journey(text,text),public.complete_chapter(text,integer),public.remember_chapter(text,integer),public.submit_quiz(text,integer),public.save_reflection(date,text),public.update_journey_preferences(text,date,text,text) to authenticated;
commit;
