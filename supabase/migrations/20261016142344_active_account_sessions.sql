-- Reject revoked sessions even while their signed access JWT is unexpired.
begin;
create function public.account_session_active() returns boolean
language plpgsql stable security definer set search_path='' as $$
declare actor uuid := auth.uid(); session uuid;
begin
 if actor is null then return false; end if;
 begin
  session := nullif(auth.jwt()->>'session_id','')::uuid;
 exception when invalid_text_representation then return false;
 end;
 if session is null then return false; end if;
 return exists(select 1 from auth.sessions s where s.id=session and s.user_id=actor
   and (s.not_after is null or s.not_after > now()));
end $$;
revoke all on function public.account_session_active() from public,anon;
grant execute on function public.account_session_active() to authenticated;

create or replace function private.actor() returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid();
begin
 if actor is null or not public.account_session_active() then
  raise exception 'Authentication required' using errcode='42501';
 end if;
 perform 1 from public.profiles where id=actor for update;
 if not found then raise exception 'Profile required' using errcode='22023'; end if;
 return actor;
end $$;

-- Restrictive policies combine with existing owner/member SELECT policies.
do $$
declare personal_table text;
begin
 foreach personal_table in array array['profiles','reflections','user_chapter_progress',
  'user_reading_progress','xp_transactions','user_achievements','quiz_attempts',
  'group_memberships','groups'] loop
  execute format('create policy active_session on public.%I as restrictive for select to authenticated using ((select public.account_session_active()))',personal_table);
 end loop;
end $$;
commit;
