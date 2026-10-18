-- Generated synthetic users only. Execute inside BEGIN/ROLLBACK.
do $verification$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); sa uuid:=gen_random_uuid(); sb uuid:=gen_random_uuid();
 pid uuid:=gen_random_uuid(); fid uuid:=gen_random_uuid(); other uuid:=gen_random_uuid(); rev uuid; next_rev uuid;
 value jsonb:=jsonb_build_object('title','Synthetic prayer','text','A synthetic private request.','status','ongoing');
 snapshot jsonb; backup jsonb; invalid jsonb; denied boolean;
begin
 insert into auth.users(id) values(a),(b); insert into auth.sessions(id,user_id) values(sa,a),(sb,b);
 perform set_config('role','authenticated',true); perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id',sa,'role','authenticated')::text,true);
 perform public.ensure_journey('Prayer fixture A','UTC');
 snapshot:=public.mutate_prayer(pid,'save',value,null); rev:=(snapshot#>>array['prayers',pid::text,'revision'])::uuid;
 if snapshot#>>array['prayers',pid::text,'text'] is distinct from 'A synthetic private request.' or snapshot->'rewards'<>'{}'::jsonb or snapshot->'reflections'<>'{}'::jsonb or snapshot->'chapters'<>'{}'::jsonb then raise exception 'Prayer save changed activity'; end if;
 if public.mutate_prayer(pid,'save',value,null) is distinct from snapshot then raise exception 'Prayer retry changed revision'; end if;
 snapshot:=public.mutate_prayer(pid,'followUp',jsonb_build_object('id',fid,'text','A synthetic follow-up','date',current_date),rev);
 next_rev:=(snapshot#>>array['prayers',pid::text,'revision'])::uuid;
 if next_rev=rev or public.mutate_prayer(pid,'followUp',jsonb_build_object('id',fid,'text','A synthetic follow-up','date',current_date),rev) is distinct from snapshot then raise exception 'Follow-up retry/version failure'; end if;
 if public.mutate_prayer(pid,'save',value||jsonb_build_object('status','answered'),rev)->>'error' is distinct from 'prayer_conflict'
 or public.mutate_prayer(pid,'delete','{}'::jsonb,rev)->>'error' is distinct from 'prayer_conflict'
 or public.mutate_prayer(pid,'followUp',jsonb_build_object('id',fid,'text','Changed existing note','date',current_date),next_rev)->>'error' is distinct from 'prayer_conflict' then raise exception 'Stale command overwrote prayer'; end if;
 foreach invalid in array array[value||jsonb_build_object('title',' '),value||jsonb_build_object('text',repeat('x',2001)),value||jsonb_build_object('status','automatic'),value||jsonb_build_object('user_id',a),value||jsonb_build_object('title',U&'\00A0\FEFF')] loop
  denied:=false;begin perform public.mutate_prayer(other,'save',invalid,null);exception when sqlstate '22023' then denied:=true;end;
  if not denied or public.get_journey() is distinct from snapshot then raise exception 'Invalid prayer command changed state'; end if;
 end loop;
 denied:=false;begin perform public.mutate_prayer(pid,'followUp',jsonb_build_object('id',gen_random_uuid(),'text','Future note','date',current_date+1),next_rev);exception when sqlstate '22023' then denied:=true;end;
 if not denied then raise exception 'Future note accepted'; end if;
 snapshot:=public.mutate_prayer(other,'save',value||jsonb_build_object('text',repeat(U&'\+01F64F',2000)),null);
 denied:=false;begin update public.user_prayers set title='Forged direct title' where user_id=a;exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Direct prayer write allowed';end if;
 denied:=false;begin perform private.normalize_prayer(value,current_date);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Private prayer helper exposed';end if;
 backup:=jsonb_build_object('version',1,'timeZone','UTC','chapters','{}'::jsonb,'attempts','{}'::jsonb,'reflections','{}'::jsonb,'prayers',jsonb_build_object(pid,value||jsonb_build_object('status','archived','followUps','{}'::jsonb),gen_random_uuid(),value||jsonb_build_object('followUps',jsonb_build_object(gen_random_uuid(),jsonb_build_object('text','Restored note','date',current_date)))));
 snapshot:=public.restore_journey(backup);
 if snapshot#>>array['prayers',pid::text,'status'] is distinct from 'ongoing' or snapshot#>>array['prayers',pid::text,'followUps',fid::text,'text'] is distinct from 'A synthetic follow-up' or (select count(*) from jsonb_object_keys(snapshot->'prayers'))<>3 then raise exception 'Prayer restore overwrote destination or lost notes';end if;
 if public.restore_journey(backup) is distinct from snapshot then raise exception 'Restore replay changed prayer revisions';end if;
 foreach invalid in array array['[]'::jsonb,jsonb_build_object(gen_random_uuid(),value||jsonb_build_object('followUps','{}'::jsonb,'createdAt','2099-01-01')),jsonb_build_object(gen_random_uuid(),value||jsonb_build_object('followUps',jsonb_build_object(gen_random_uuid(),jsonb_build_object('text','Future','date',current_date+1)))),jsonb_build_object('not-a-uuid',value||jsonb_build_object('followUps','{}'::jsonb))] loop
  denied:=false;begin perform public.restore_journey(jsonb_set(backup,'{prayers}',invalid)||jsonb_build_object('chapters',jsonb_build_object('GEN.1',current_date)));exception when sqlstate '22023' then denied:=true;end;
  if not denied or public.get_journey() is distinct from snapshot then raise exception 'Invalid prayer restore partially committed';end if;
 end loop;
 snapshot:=public.restore_journey(backup-'prayers');
 if (select count(*) from jsonb_object_keys(snapshot->'prayers'))<>3 then raise exception 'Legacy restore erased prayers';end if;
 snapshot:=public.mutate_prayer(pid,'save',value||jsonb_build_object('status','answered'),next_rev);
 next_rev:=(snapshot#>>array['prayers',pid::text,'revision'])::uuid;
 snapshot:=public.mutate_prayer(pid,'delete','{}'::jsonb,next_rev);
 if snapshot->'prayers'?pid::text or public.mutate_prayer(pid,'save',value,rev)->>'error' is distinct from 'prayer_missing' then raise exception 'Deleted prayer silently resurrected';end if;
 if public.mutate_prayer(pid,'delete','{}'::jsonb,next_rev) is distinct from snapshot then raise exception 'Delete retry failed';end if;
 perform set_config('role','none',true);
 update private.request_budgets set requests=1 where user_id=a and bucket='restore';
 insert into public.user_prayers(user_id,id,title,content,status) select a,gen_random_uuid(),'Synthetic cap','Synthetic cap','ongoing' from generate_series(1,198);
 perform set_config('role','authenticated',true);
 if public.mutate_prayer(pid,'save',value,null)->>'error' is distinct from 'prayer_limit' then raise exception 'Prayer cap bypassed';end if;
 denied:=false;begin perform public.restore_journey(jsonb_set(backup,'{prayers}',jsonb_build_object(pid,value||jsonb_build_object('followUps','{}'::jsonb))));exception when sqlstate '22023' then denied:=true;end;
 if not denied then raise exception 'Restore union cap bypassed';end if;
 perform set_config('role','none',true);
 update public.user_prayers set follow_ups=(select jsonb_object_agg(gen_random_uuid(),jsonb_build_object('text','Synthetic cap note','date',current_date)) from generate_series(1,50)) where user_id=a and id=other;
 perform set_config('role','authenticated',true);
 snapshot:=public.get_journey();rev:=(snapshot#>>array['prayers',other::text,'revision'])::uuid;
 if public.mutate_prayer(other,'followUp',jsonb_build_object('id',gen_random_uuid(),'text','Cap attempt','date',current_date),rev)->>'error' is distinct from 'follow_up_limit' then raise exception 'Follow-up cap bypassed';end if;
 perform set_config('request.jwt.claim.sub',b::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'session_id',sb,'role','authenticated')::text,true);
 snapshot:=public.ensure_journey('Prayer fixture B','UTC');
 if snapshot->'prayers'<>'{}'::jsonb or exists(select 1 from public.user_prayers where user_id=a) then raise exception 'Prayers leaked across accounts';end if;
 if public.mutate_prayer(other,'followUp',jsonb_build_object('id',gen_random_uuid(),'text','Cross-account attempt','date',current_date),rev)->>'error' is distinct from 'prayer_missing' then raise exception 'Cross-account prayer changed';end if;
 perform set_config('role','none',true);update private.request_budgets set requests=60 where user_id=b and bucket='write';perform set_config('role','authenticated',true);
 denied:=false;begin perform public.mutate_prayer(pid,'save',value,null);exception when sqlstate 'PT429' then denied:=true;end;
 if not denied then raise exception 'Prayer quota bypassed';end if;
 perform set_config('role','none',true);delete from auth.sessions where id=sa;
 perform set_config('request.jwt.claim.sub',a::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id',sa,'role','authenticated')::text,true);perform set_config('role','authenticated',true);
 denied:=false;begin perform public.mutate_prayer(pid,'save',value,null);exception when sqlstate '42501' then denied:=true;end;
 if not denied or exists(select 1 from public.user_prayers where user_id=a) then raise exception 'Revoked session accessed prayers';end if;
 perform set_config('role','anon',true);denied:=false;begin perform public.mutate_prayer(pid,'save',value,null);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Anonymous prayer command exposed';end if;
 perform set_config('role','none',true);delete from auth.users where id=a;
 if exists(select 1 from public.user_prayers where user_id=a) then raise exception 'Prayer cascade failed';end if;
end $verification$;
