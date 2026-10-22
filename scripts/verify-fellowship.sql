-- Always execute inside BEGIN/ROLLBACK. All identities/data below are synthetic.
do $verification$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); sa uuid:=gen_random_uuid(); sb uuid:=gen_random_uuid(); sc uuid:=gen_random_uuid(); nonce uuid:=gen_random_uuid();
 g1 uuid; g2 uuid; code1 text; code2 text; code3 text; snapshot jsonb; repeated jsonb; personal jsonb; entry record; invalid jsonb; denied boolean; statement text; extra_user uuid; plan uuid; n integer;
begin
 insert into auth.users(id) values(a),(b),(c);
 insert into auth.sessions(id,user_id) values(sa,a),(sb,b),(sc,c);
 select id into plan from public.reading_plans where slug='canonical';
 perform set_config('role','authenticated',true);
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id',sa,'role','authenticated')::text,true);
 perform public.ensure_journey('Alpha fixture','UTC');
 for entry in select book_id,chapter from public.reading_plan_day_chapters where plan_id=plan and day<=4 order by day,position loop perform public.complete_chapter(entry.book_id,entry.chapter); end loop;
 perform public.save_journal_entry(current_date,'FIXTURE PRIVATE JOURNAL MUST NEVER APPEAR IN GROUP DATA.',coalesce((select category from public.reflections where user_id=auth.uid() and reflection_date=current_date),'reflection'),(select revision::text from public.reflections where user_id=auth.uid() and reflection_date=current_date));
 perform public.set_saved_verse('JHN',3,16,true);
 personal:=public.get_journey()-'fellowshipMemberships';
 foreach invalid in array array[
  jsonb_build_object('type','create','requestId',nonce,'name','Fixture group','consent',false),
  jsonb_build_object('type','create','requestId',nonce,'name','Fixture group','consent',true,'owner_id',b),
  jsonb_build_object('type','join','code',repeat('f',32),'consent',false)
 ] loop
  denied:=false; begin perform public.manage_fellowship(invalid); exception when sqlstate '22023' then denied:=true; end;
  if not denied then raise exception 'Forged group command accepted'; end if;
 end loop;
 snapshot:=public.manage_fellowship(jsonb_build_object('type','create','requestId',nonce,'name','Fixture group','consent',true));
 g1:=(snapshot#>>'{groups,0,id}')::uuid; code1:=snapshot#>>'{groups,0,inviteCode}';
 if g1 is null or char_length(code1)<>32 or snapshot#>>'{groups,0,owner}' is distinct from 'true' or snapshot#>>'{groups,0,members,0,participationPercent}' is distinct from '1' then raise exception 'Owner summary or server participation failed'; end if;
 if public.manage_fellowship(jsonb_build_object('type','create','requestId',nonce,'name','Duplicate request must not create another group','consent',true)) is distinct from snapshot then raise exception 'Create retry duplicated a group'; end if;
 if public.get_journey()-'fellowshipMemberships' is distinct from personal then raise exception 'Group commands changed personal activity or XP'; end if;
 if public.get_journey()#>>'{fellowshipMemberships,0,role}' is distinct from 'owner' then raise exception 'Own membership missing from export snapshot'; end if;
 if snapshot::text like '%PRIVATE JOURNAL%' or snapshot::text like '%savedVerses%' or snapshot::text like '%rewards%' or snapshot::text like '%chapters%' then raise exception 'Group summary leaked private activity'; end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'session_id',sb,'role','authenticated')::text,true);
 perform public.ensure_journey('Bravo fixture','UTC');
 personal:=public.get_journey()-'fellowshipMemberships';
 if public.get_fellowship()<>'{"groups":[]}'::jsonb or exists(select 1 from public.groups where id=g1) then raise exception 'Unjoined group was discoverable'; end if;
 if public.manage_fellowship(jsonb_build_object('type','join','code',repeat('f',32),'consent',true))<>'{"error":"invite"}'::jsonb then raise exception 'Invalid invitation not rejected'; end if;
 perform set_config('role','none',true);
 if (select requests from private.request_budgets where user_id=b and bucket='write')<>2 then raise exception 'Invalid invitation did not retain its admission charge'; end if;
 perform set_config('role','authenticated',true);
 snapshot:=public.manage_fellowship(jsonb_build_object('type','join','code',upper(code1),'consent',true));
 if jsonb_array_length(snapshot#>'{groups,0,members}')<>2 or snapshot#>'{groups,0}'?'inviteCode' or snapshot#>'{groups,0}'?'creationRequestId' or snapshot::text like '%memberId%' then raise exception 'Member summary leaked owner-only fields'; end if;
 if public.manage_fellowship(jsonb_build_object('type','join','code',code1,'consent',true)) is distinct from snapshot then raise exception 'Repeated join duplicated membership'; end if;
 if exists(select 1 from public.profiles where id=a) or exists(select 1 from public.reflections where user_id=a) then raise exception 'Group membership expanded personal table RLS'; end if;
 foreach invalid in array array[
  jsonb_build_object('type','rename','groupId',g1,'name','Unauthorized rename'),
  jsonb_build_object('type','rotate','groupId',g1),
  jsonb_build_object('type','remove','groupId',g1,'memberId',a),
  jsonb_build_object('type','close','groupId',g1,'confirmation','CLOSE GROUP')
 ] loop
  if public.manage_fellowship(invalid)<>'{"error":"access"}'::jsonb then raise exception 'Member exercised owner permissions'; end if;
 end loop;
 foreach statement in array array[
  'select * from private.group_invites','select * from private.group_creation_requests','select private.get_fellowship()',
  'update public.groups set owner_id=auth.uid()', 'delete from public.group_memberships',
  'insert into public.group_memberships(group_id,user_id,role,sharing_consent_at) values('''||g1||''',auth.uid(),''leader'',now())'
 ] loop
  denied:=false; begin execute statement; exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Private/direct group mutation access allowed'; end if;
 end loop;
 perform set_config('request.jwt.claim.sub',c::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',c,'session_id',sc,'role','authenticated')::text,true);
 perform public.ensure_journey('Charlie fixture','UTC');
 if public.get_fellowship()<>'{"groups":[]}'::jsonb then raise exception 'Uninvited third reader saw a group'; end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id',sa,'role','authenticated')::text,true);
 snapshot:=public.manage_fellowship(jsonb_build_object('type','rename','groupId',g1,'name','Renamed fixture'));
 if snapshot#>>'{groups,0,name}' is distinct from 'Renamed fixture' or snapshot#>>'{groups,0,members,1,memberId}' is distinct from b::text then raise exception 'Owner rename/roster controls failed'; end if;
 snapshot:=public.manage_fellowship(jsonb_build_object('type','rotate','groupId',g1)); code2:=snapshot#>>'{groups,0,inviteCode}';
 if code1=code2 then raise exception 'Invitation did not rotate'; end if;
 perform set_config('request.jwt.claim.sub',c::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',c,'session_id',sc,'role','authenticated')::text,true);
 if public.manage_fellowship(jsonb_build_object('type','join','code',code1,'consent',true))<>'{"error":"invite"}'::jsonb then raise exception 'Rotated code remained valid'; end if;
 perform public.manage_fellowship(jsonb_build_object('type','join','code',code2,'consent',true));
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id',sa,'role','authenticated')::text,true);
 snapshot:=public.manage_fellowship(jsonb_build_object('type','remove','groupId',g1,'memberId',b)); code3:=snapshot#>>'{groups,0,inviteCode}';
 if code3=code2 or jsonb_array_length(snapshot#>'{groups,0,members}')<>2 then raise exception 'Removal did not rotate invitation or remove member'; end if;
 repeated:=public.manage_fellowship(jsonb_build_object('type','remove','groupId',g1,'memberId',b));
 if repeated is distinct from snapshot then raise exception 'Repeated removal rotated again'; end if;
 if public.manage_fellowship(jsonb_build_object('type','leave','groupId',g1))<>'{"error":"owner"}'::jsonb then raise exception 'Owner left an ownerless group'; end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'session_id',sb,'role','authenticated')::text,true);
 if public.get_fellowship()<>'{"groups":[]}'::jsonb or public.get_journey()-'fellowshipMemberships' is distinct from personal then raise exception 'Removed member retained access or lost personal data'; end if;
 if public.manage_fellowship(jsonb_build_object('type','join','code',code2,'consent',true))<>'{"error":"invite"}'::jsonb then raise exception 'Removed member reused old invitation'; end if;
 perform set_config('request.jwt.claim.sub',c::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',c,'session_id',sc,'role','authenticated')::text,true);
 if public.manage_fellowship(jsonb_build_object('type','leave','groupId',g1))<>'{"groups":[]}'::jsonb then raise exception 'Member could not leave'; end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id',sa,'role','authenticated')::text,true);
 denied:=false; begin perform public.manage_fellowship(jsonb_build_object('type','close','groupId',g1,'confirmation','wrong')); exception when sqlstate '22023' then denied:=true; end;
 if not denied then raise exception 'Close confirmation bypassed'; end if;
 perform public.manage_fellowship(jsonb_build_object('type','close','groupId',g1,'confirmation','CLOSE GROUP'));
 if public.manage_fellowship(jsonb_build_object('type','create','requestId',nonce,'name','Retry after close','consent',true))<>'{"groups":[]}'::jsonb then raise exception 'Closed group resurrected from a create retry'; end if;
 -- Ownership, membership and roster bounds, with generated filler users only.
 snapshot:=public.manage_fellowship(jsonb_build_object('type','create','requestId',gen_random_uuid(),'name','Capacity fixture','consent',true)); g1:=(snapshot#>>'{groups,0,id}')::uuid;code1:=snapshot#>>'{groups,0,inviteCode}';
 snapshot:=public.manage_fellowship(jsonb_build_object('type','create','requestId',gen_random_uuid(),'name','Second fixture','consent',true));
 if public.manage_fellowship(jsonb_build_object('type','create','requestId',gen_random_uuid(),'name','Third fixture','consent',true))<>'{"error":"limit"}'::jsonb then raise exception 'Owned group limit bypassed'; end if;
 perform set_config('role','none',true);
 for n in 1..19 loop
  extra_user:=gen_random_uuid();insert into auth.users(id) values(extra_user);
  insert into public.profiles(id,display_name,timezone,reading_plan_id,start_date) values(extra_user,'Capacity fixture '||n,'UTC',plan,current_date);
  insert into public.group_memberships(group_id,user_id,sharing_consent_at) values(g1,extra_user,now());
 end loop;
 perform set_config('role','authenticated',true);
 perform set_config('request.jwt.claim.sub',c::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',c,'session_id',sc,'role','authenticated')::text,true);
 if public.manage_fellowship(jsonb_build_object('type','join','code',code1,'consent',true))<>'{"error":"limit"}'::jsonb then raise exception 'Group member capacity bypassed'; end if;
 perform set_config('role','none',true);
 -- Fill only generated C's own memberships to exercise the account cap.
 for n in 1..5 loop
  insert into public.groups(owner_id,name) values(extra_user,'Membership fixture '||n) returning id into g2;
  insert into private.group_invites(group_id,code) values(g2,replace(gen_random_uuid()::text,'-',''));
  insert into public.group_memberships(group_id,user_id,sharing_consent_at) values(g2,c,now());
 end loop;
 perform set_config('role','authenticated',true);
 if public.manage_fellowship(jsonb_build_object('type','create','requestId',gen_random_uuid(),'name','Sixth membership','consent',true))<>'{"error":"limit"}'::jsonb then raise exception 'Account membership limit bypassed'; end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id',sa,'role','authenticated')::text,true);
 -- Creation replay metadata is bounded for this generated account.
 perform set_config('role','none',true);
 insert into private.group_creation_requests(user_id,request_id)
 select a,gen_random_uuid() from generate_series(1,1000-(select count(*)::integer from private.group_creation_requests where user_id=a));
 perform set_config('role','authenticated',true);
 if public.manage_fellowship(jsonb_build_object('type','create','requestId',gen_random_uuid(),'name','Bounded create history','consent',true))<>'{"error":"requests"}'::jsonb then raise exception 'Creation request history limit bypassed';end if;
 snapshot:=public.get_fellowship();
 perform set_config('role','none',true);
 update private.request_budgets set requests=60 where user_id=a and bucket='write';
 perform set_config('role','authenticated',true);
 denied:=false;begin perform public.manage_fellowship(jsonb_build_object('type','rotate','groupId',g1));exception when sqlstate 'PT429' then denied:=true;end;
 if not denied or public.get_fellowship() is distinct from snapshot then raise exception 'Group quota bypass or partial mutation'; end if;
 perform set_config('role','none',true);
 delete from auth.sessions where id=sa;
 perform set_config('role','authenticated',true);
 denied:=false;begin perform public.get_fellowship();exception when insufficient_privilege then denied:=true;end;
 if not denied or exists(select 1 from public.groups where owner_id=a) then raise exception 'Revoked session retained group access'; end if;
 denied:=false;begin perform public.manage_fellowship(jsonb_build_object('type','leave','groupId',g1));exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Revoked group mutation accepted';end if;
 perform set_config('role','anon',true);
 denied:=false;begin perform public.get_fellowship();exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Anonymous group access accepted';end if;
 perform set_config('role','none',true);
 delete from auth.users where id=a;
 if exists(select 1 from public.groups where owner_id=a) or exists(select 1 from public.group_memberships where group_id=g1) or exists(select 1 from private.group_invites where group_id=g1) or exists(select 1 from private.group_creation_requests where user_id=a) then raise exception 'Owner account cascade did not close groups/private metadata'; end if;
end $verification$;
