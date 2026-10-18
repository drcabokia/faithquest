-- Always execute inside BEGIN/ROLLBACK. Generated synthetic accounts only.
do $verification$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); sa uuid:=gen_random_uuid(); sb uuid:=gen_random_uuid();
 snapshot jsonb; backup jsonb; invalid jsonb; denied boolean; stamp text;
begin
 insert into auth.users(id) values(a),(b);
 insert into auth.sessions(id,user_id) values(sa,a),(sb,b);
 perform set_config('role','authenticated',true);
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id',sa,'role','authenticated')::text,true);
 perform public.ensure_journey('Verse notes fixture A','UTC');
 snapshot:=public.set_saved_verse('JHN',3,16,true);
 stamp:=snapshot#>>'{savedVerses,JHN.3.16}';
 snapshot:=public.set_verse_note('JHN',3,16,'  A synthetic private verse note.  ',null);
 if snapshot#>>'{verseNotes,JHN.3.16,text}' is distinct from 'A synthetic private verse note.'
 or snapshot#>>'{savedVerses,JHN.3.16}' is distinct from stamp
 or snapshot->'rewards'<>'{}'::jsonb or snapshot->'chapters'<>'{}'::jsonb then raise exception 'Note save changed Scripture references or activity'; end if;
 if public.set_verse_note('JHN',3,16,'A synthetic private verse note.',null) is distinct from snapshot then raise exception 'Same intent retry changed note timestamp'; end if;
 if public.set_verse_note('JHN',3,16,'A stale synthetic note.',null)->>'error' is distinct from 'note_conflict' then raise exception 'Stale note overwrote saved text'; end if;
 if public.set_saved_verse('JHN',3,16,false)->>'error' is distinct from 'verse_has_note' then raise exception 'Removal discarded a private note'; end if;
 if public.set_verse_note('GEN',1,1,'An unsaved synthetic note.',null)->>'error' is distinct from 'verse_not_saved' then raise exception 'Note invented saved reference'; end if;
 if public.get_journey() is distinct from snapshot then raise exception 'Rejected note command changed state'; end if;
 foreach invalid in array array['""'::jsonb,to_jsonb(repeat('x',2001)),to_jsonb(U&'\00A0\2000\FEFF'::text)] loop
  denied:=false;
  begin perform public.set_verse_note('JHN',3,16,invalid#>>'{}','A synthetic private verse note.'); exception when sqlstate '22023' then denied:=true; end;
  if not denied or public.get_journey() is distinct from snapshot then raise exception 'Invalid note changed state'; end if;
 end loop;
 perform public.set_verse_note('JHN',3,16,repeat(U&'\+01F64F',2000),'A synthetic private verse note.');
 snapshot:=public.set_verse_note('JHN',3,16,'A synthetic private verse note.',repeat(U&'\+01F64F',2000));
 denied:=false;
 begin update public.user_saved_verses set note='Direct forged note' where user_id=a; exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Direct note writes allowed'; end if;
 denied:=false;
 begin perform private.trim_verse_note('private helper'); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Private note helper exposed'; end if;
 backup:=jsonb_build_object('version',1,'timeZone','UTC','chapters','{}'::jsonb,'attempts','{}'::jsonb,'reflections','{}'::jsonb,
  'savedVerses',jsonb_build_array('JHN.3.16','GEN.1.1'),'verseNotes',jsonb_build_object('JHN.3.16','A conflicting synthetic imported note.','GEN.1.1','An imported synthetic private note.'));
 snapshot:=public.restore_journey(backup);
 if snapshot#>>'{verseNotes,JHN.3.16,text}' is distinct from 'A synthetic private verse note.'
 or snapshot#>>'{verseNotes,GEN.1.1,text}' is distinct from 'An imported synthetic private note.'
 or snapshot#>>'{verseNotes,GEN.1.1,updatedAt}' is distinct from to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') then raise exception 'Note restore overwrote existing text or trusted imported time'; end if;
 if public.restore_journey(backup) is distinct from snapshot then raise exception 'Note restore replay changed state'; end if;
 foreach invalid in array array[
  jsonb_build_object('GEN.1.2','No matching saved reference'),
  jsonb_build_object('JHN.3.16',jsonb_build_object('text','Injected note','updatedAt','2099-01-01')),
  jsonb_build_object('JHN.3.16',null),jsonb_build_object('JHN.3.16',repeat('x',2001)),
  '[]'::jsonb
 ] loop
  denied:=false;
  begin perform public.restore_journey(jsonb_set(backup,'{verseNotes}',invalid)||jsonb_build_object('chapters',jsonb_build_object('GEN.1',(now() at time zone 'UTC')::date))); exception when sqlstate '22023' then denied:=true; end;
  if not denied or public.get_journey() is distinct from snapshot then raise exception 'Invalid note restore partially committed'; end if;
 end loop;
 snapshot:=public.set_verse_note('JHN',3,16,'A newer synthetic note.','A synthetic private verse note.');
 if public.set_verse_note('JHN',3,16,null,'A synthetic private verse note.')->>'error' is distinct from 'note_conflict' then raise exception 'Stale delete discarded newer note'; end if;
 snapshot:=public.set_verse_note('JHN',3,16,null,'A newer synthetic note.');
 if snapshot->'verseNotes'?'JHN.3.16' or not(snapshot->'savedVerses'?'JHN.3.16') then raise exception 'Explicit deletion removed verse or retained note'; end if;
 snapshot:=public.set_saved_verse('JHN',3,16,false);
 if snapshot->'savedVerses'?'JHN.3.16' then raise exception 'Note-free removal failed'; end if;
 -- Legacy backups retain notes and require no new optional field.
 snapshot:=public.restore_journey(backup-'verseNotes');
 if snapshot#>>'{verseNotes,GEN.1.1,text}' is distinct from 'An imported synthetic private note.' then raise exception 'Legacy backup erased notes'; end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'session_id',sb,'role','authenticated')::text,true);
 snapshot:=public.ensure_journey('Verse notes fixture B','UTC');
 if snapshot->'verseNotes'<>'{}'::jsonb or exists(select 1 from public.user_saved_verses where user_id=a) then raise exception 'Notes leaked to another account'; end if;
 if public.set_verse_note('GEN',1,1,'Cross account attempt',null)->>'error' is distinct from 'verse_not_saved' then raise exception 'Notes crossed ownership'; end if;
 perform set_config('role','none',true);
 update private.request_budgets set requests=60 where user_id=b and bucket='write';
 perform set_config('role','authenticated',true);
 denied:=false;
 begin perform public.set_verse_note('GEN',1,1,'Quota attempt',null); exception when sqlstate 'PT429' then denied:=true; end;
 if not denied then raise exception 'Note write budget bypassed'; end if;
 perform set_config('role','none',true);
 delete from auth.sessions where id=sa;
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id',sa,'role','authenticated')::text,true);
 perform set_config('role','authenticated',true);
 denied:=false;
 begin perform public.set_verse_note('GEN',1,1,'Revoked attempt','An imported synthetic private note.'); exception when sqlstate '42501' then denied:=true; end;
 if not denied or exists(select 1 from public.user_saved_verses where user_id=a) then raise exception 'Revoked session accessed notes'; end if;
 perform set_config('role','anon',true);
 denied:=false;
 begin perform public.set_verse_note('GEN',1,1,'Anonymous attempt',null); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Anonymous note command exposed'; end if;
 perform set_config('role','none',true);
 delete from auth.users where id=a;
 if exists(select 1 from public.user_saved_verses where user_id=a) then raise exception 'Note deletion cascade failed'; end if;
end $verification$;
