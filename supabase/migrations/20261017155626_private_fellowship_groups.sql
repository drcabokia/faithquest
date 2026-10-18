begin;
alter table public.group_memberships add column sharing_consent_at timestamptz;
create table private.group_invites (
 group_id uuid primary key references public.groups(id) on delete cascade,
 code text not null unique check(code ~ '^[0-9a-f]{32}$')
);
create table private.group_creation_requests (
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 group_id uuid references public.groups(id) on delete set null,
 primary key(user_id,request_id)
);
create index group_creation_target on private.group_creation_requests(group_id);
alter table private.group_invites enable row level security;
alter table private.group_creation_requests enable row level security;
revoke all on private.group_invites,private.group_creation_requests from public,anon,authenticated;
revoke insert,update,delete on public.groups,public.group_memberships from public,anon,authenticated;

create function private.get_fellowship() returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.actor(); result jsonb;
begin
 select jsonb_build_object('groups',coalesce(jsonb_agg(payload order by lower(group_name),group_id),'[]'::jsonb)) into result from (
 select g.id as group_id,g.name as group_name,jsonb_strip_nulls(jsonb_build_object(
  'id',g.id,'name',g.name,'owner',g.owner_id=actor,
  'inviteCode',case when g.owner_id=actor then (select code from private.group_invites where group_id=g.id) end,
  'creationRequestId',case when g.owner_id=actor then (select request_id from private.group_creation_requests where user_id=actor and group_id=g.id limit 1) end,
  'members',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
   'name',p.display_name,'isYou',p.id=actor,
   'memberId',case when g.owner_id=actor then p.id end,
   'participationPercent',(select round(count(*)*100.0/365)::integer from public.user_reading_progress r where r.user_id=p.id and r.plan_id=p.reading_plan_id)
  )) order by lower(p.display_name),p.id) from public.group_memberships m join public.profiles p on p.id=m.user_id where m.group_id=g.id and m.sharing_consent_at is not null),'[]'::jsonb)
 )) as payload from public.groups g
 where exists(select 1 from public.group_memberships own where own.group_id=g.id and own.user_id=actor and own.sharing_consent_at is not null)
 ) visible;
 return result;
end $$;
revoke all on function private.get_fellowship() from public,anon,authenticated;

create function public.get_fellowship() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.actor(); perform private.enforce_request_limit('read');
 return private.get_fellowship();
end $$;
revoke all on function public.get_fellowship() from public,anon,authenticated;
grant execute on function public.get_fellowship() to authenticated;

create function public.manage_fellowship(p_command jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.actor(); action text; target uuid; target_member uuid; request_key uuid; group_owner uuid; group_name text; invite text; expected_keys text[];
begin
 perform private.enforce_request_limit('write');
 if p_command is null or jsonb_typeof(p_command)<>'object' or octet_length(p_command::text)>4096 then raise exception 'Invalid group command' using errcode='22023'; end if;
 action:=p_command->>'type';
 expected_keys:=case action
  when 'create' then array['type','requestId','name','consent'] when 'join' then array['type','code','consent']
  when 'rename' then array['type','groupId','name'] when 'rotate' then array['type','groupId']
  when 'leave' then array['type','groupId'] when 'remove' then array['type','groupId','memberId']
  when 'close' then array['type','groupId','confirmation'] end;
 if expected_keys is null or not(p_command ?& expected_keys) or (select count(*) from jsonb_object_keys(p_command))<>cardinality(expected_keys) then raise exception 'Invalid group command' using errcode='22023'; end if;
 if action in ('create','join') and p_command->'consent' is distinct from 'true'::jsonb then raise exception 'Sharing consent required' using errcode='22023'; end if;
 if action in ('create','rename') then
  if jsonb_typeof(p_command->'name') is distinct from 'string' or char_length(trim(p_command->>'name')) not between 1 and 80 then raise exception 'Invalid group name' using errcode='22023'; end if;
  group_name:=trim(p_command->>'name');
 end if;
 if action='create' then
  if jsonb_typeof(p_command->'requestId') is distinct from 'string' or (p_command->>'requestId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'Invalid request' using errcode='22023'; end if;
  request_key:=(p_command->>'requestId')::uuid;
  -- The caller's existing profile lock serializes duplicate creates and membership limits.
  if exists(select 1 from private.group_creation_requests where user_id=actor and request_id=request_key) then return public.get_fellowship(); end if;
  if (select count(*) from private.group_creation_requests where user_id=actor)>=1000 then return '{"error":"requests"}'::jsonb; end if;
  if (select count(*) from public.groups where owner_id=actor)>=2 or (select count(*) from public.group_memberships where user_id=actor)>=5 then return '{"error":"limit"}'::jsonb; end if;
  insert into public.groups(owner_id,name) values(actor,group_name) returning id into target;
  insert into public.group_memberships(group_id,user_id,role,sharing_consent_at) values(target,actor,'leader',now());
  insert into private.group_invites(group_id,code) values(target,replace(pg_catalog.gen_random_uuid()::text,'-',''));
  insert into private.group_creation_requests(user_id,request_id,group_id) values(actor,request_key,target);
  return public.get_fellowship();
 end if;
 if action='join' then
  if jsonb_typeof(p_command->'code') is distinct from 'string' or lower(trim(p_command->>'code')) !~ '^[0-9a-f]{32}$' then raise exception 'Invalid invitation' using errcode='22023'; end if;
  invite:=lower(trim(p_command->>'code'));
  select group_id into target from private.group_invites where code=invite;
  -- Domain denials return a safe code, committing their admission charge.
  if target is null then return '{"error":"invite"}'::jsonb; end if;
 else
  if jsonb_typeof(p_command->'groupId') is distinct from 'string' or (p_command->>'groupId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'Invalid group' using errcode='22023'; end if;
  target:=(p_command->>'groupId')::uuid;
 end if;
 -- Caller profile -> target group is the lock order for every group mutation.
 select owner_id into group_owner from public.groups where id=target for update;
 if not found then
  if action in ('close','leave') then return public.get_fellowship(); end if;
  return jsonb_build_object('error',case when action='join' then 'invite' else 'access' end);
 end if;
 if action='join' then
  if not exists(select 1 from private.group_invites where group_id=target and code=invite) then return '{"error":"invite"}'::jsonb; end if;
  if exists(select 1 from public.group_memberships where group_id=target and user_id=actor) then
   update public.group_memberships set sharing_consent_at=coalesce(sharing_consent_at,now()) where group_id=target and user_id=actor;
   return public.get_fellowship();
  end if;
  if (select count(*) from public.group_memberships where user_id=actor)>=5 or (select count(*) from public.group_memberships where group_id=target)>=20 then return '{"error":"limit"}'::jsonb; end if;
  insert into public.group_memberships(group_id,user_id,role,sharing_consent_at) values(target,actor,'member',now());
 elsif action='leave' then
  if group_owner=actor then return '{"error":"owner"}'::jsonb; end if;
  delete from public.group_memberships where group_id=target and user_id=actor;
 else
  if group_owner<>actor then return '{"error":"access"}'::jsonb; end if;
  if action='rename' then
   update public.groups set name=group_name where id=target;
  elsif action='rotate' then
   insert into private.group_invites(group_id,code) values(target,replace(pg_catalog.gen_random_uuid()::text,'-','')) on conflict(group_id) do update set code=excluded.code;
  elsif action='remove' then
   if jsonb_typeof(p_command->'memberId') is distinct from 'string' or (p_command->>'memberId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'Invalid member' using errcode='22023'; end if;
   target_member:=(p_command->>'memberId')::uuid;
   if target_member=actor then return '{"error":"owner"}'::jsonb; end if;
   delete from public.group_memberships where group_id=target and user_id=target_member;
   if found then update private.group_invites set code=replace(pg_catalog.gen_random_uuid()::text,'-','') where group_id=target; end if;
  elsif action='close' then
   if p_command->'confirmation' is distinct from '"CLOSE GROUP"'::jsonb then raise exception 'Close confirmation required' using errcode='22023'; end if;
   delete from public.groups where id=target;
  end if;
 end if;
 return public.get_fellowship();
end $$;
revoke all on function public.manage_fellowship(jsonb) from public,anon,authenticated;
grant execute on function public.manage_fellowship(jsonb) to authenticated;
create or replace function private.get_journey() returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid := private.actor(); result jsonb;
begin
 select jsonb_strip_nulls(jsonb_build_object(
 'version',1,
 'fellowshipMemberships',coalesce((select jsonb_agg(jsonb_build_object('groupId',g.id,'name',g.name,'role',case when g.owner_id=actor then 'owner' else 'member' end,'joinedAt',to_char(m.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) order by g.id) from public.group_memberships m join public.groups g on g.id=m.group_id where m.user_id=actor),'[]'::jsonb),
 'challengeStarts',coalesce((select jsonb_agg(start_date order by start_date) from public.user_reading_challenges where user_id=actor),'[]'::jsonb),
 'savedVerses',coalesce((select jsonb_object_agg(book_id||'.'||chapter||'.'||verse,to_char(saved_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) from public.user_saved_verses where user_id=actor),'{}'::jsonb),
 'profile',jsonb_build_object('name',p.display_name,'startDate',p.start_date,'timeZone',p.timezone,'theme',p.theme),
 'chapters',coalesce((select jsonb_object_agg(book_id||'.'||chapter,completion_date) from public.user_chapter_progress where user_id=actor),'{}'::jsonb),
 'days',coalesce((select jsonb_object_agg(day,completion_date) from public.user_reading_progress where user_id=actor and plan_id=p.reading_plan_id),'{}'::jsonb),
 'rewards',coalesce((select jsonb_object_agg(activity_key,jsonb_build_object('amount',amount,'date',activity_date)) from public.xp_transactions where user_id=actor),'{}'::jsonb),
 'attempts',coalesce((select jsonb_object_agg(question_id,jsonb_build_object('answer',selected_option,'correct',is_correct,'date',(attempted_at at time zone p.timezone)::date,'correctOption',correct_option,'explanation',explanation)) from public.quiz_attempts where user_id=actor),'{}'::jsonb),
 'reflections',coalesce((select jsonb_object_agg(reflection_date,jsonb_build_object('text',content,'category',category,'updatedAt',to_char(updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))) from public.reflections where user_id=actor),'{}'::jsonb),
 'earnedAchievements',coalesce((select jsonb_agg(achievement_id order by achievement_id) from public.user_achievements where user_id=actor),'[]'::jsonb),
 'resume',case when p.resume_book is not null then jsonb_build_object('book',p.resume_book,'chapter',p.resume_chapter) end
 )) into result from public.profiles p where p.id=actor;
 return result;
end $$;

revoke all on function private.get_journey() from public,anon,authenticated;

commit;
