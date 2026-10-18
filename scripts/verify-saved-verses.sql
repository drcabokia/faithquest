-- Always execute inside BEGIN/ROLLBACK. Synthetic accounts only.
do $verification$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); sa uuid:=gen_random_uuid(); sb uuid:=gen_random_uuid();
 snapshot jsonb; repeated jsonb; backup jsonb; invalid jsonb; denied boolean; statement text; ref text;
begin
 if (select count(*) from public.bible_chapters where verse_count is not null)<>1189 then raise exception 'Verse reference catalogue incomplete'; end if;
 insert into auth.users(id) values(a),(b);
 insert into auth.sessions(id,user_id) values(sa,a),(sb,b);
 perform set_config('role','authenticated',true);
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id',sa,'role','authenticated')::text,true);
 perform public.ensure_journey('Saved verse fixture A','UTC');
 snapshot:=public.set_saved_verse('JHN',3,16,true);
 repeated:=public.set_saved_verse('JHN',3,16,true);
 if repeated is distinct from snapshot or not(snapshot->'savedVerses'?'JHN.3.16')
 or snapshot->'rewards'<>'{}'::jsonb or snapshot->'chapters'<>'{}'::jsonb or snapshot->'days'<>'{}'::jsonb then raise exception 'Saving a verse changed rewards/progress or was not idempotent'; end if;
 snapshot:=public.set_saved_verse('JHN',3,16,false);
 repeated:=public.set_saved_verse('JHN',3,16,false);
 if repeated is distinct from snapshot or snapshot->'savedVerses'<>'{}'::jsonb then raise exception 'Removing a saved verse was not idempotent'; end if;
 foreach ref in array array['GEN.1.32','GEN.51.1','XXX.1.1','LUK.17.36','ACT.8.37','ACT.15.34','ACT.24.7','ROM.16.25','GEN.1.0'] loop
  denied:=false;
  begin perform public.set_saved_verse(split_part(ref,'.',1),split_part(ref,'.',2)::integer,split_part(ref,'.',3)::integer,true); exception when sqlstate '22023' then denied:=true; end;
  if not denied then raise exception 'Unavailable verse accepted'; end if;
 end loop;
 denied:=false;
 begin perform public.set_saved_verse('JHN',3,16,null); exception when sqlstate '22023' then denied:=true; end;
 if not denied then raise exception 'Missing save intent accepted'; end if;
 snapshot:=public.set_saved_verse('JHN',3,16,true);
 backup:='{"version":1,"timeZone":"UTC","chapters":{},"attempts":{},"reflections":{},"savedVerses":["JHN.3.16","PSA.23.1"]}'::jsonb;
 repeated:=public.restore_journey(backup);
 if repeated#>>'{savedVerses,JHN.3.16}' is distinct from snapshot#>>'{savedVerses,JHN.3.16}'
 or not(repeated->'savedVerses'?'PSA.23.1') or repeated->'rewards'<>'{}'::jsonb then raise exception 'Saved verse backup merge failed'; end if;
 snapshot:=repeated;
 if public.restore_journey(backup) is distinct from snapshot then raise exception 'Repeated saved verse restore changed state'; end if;
 -- Legacy version 1 backups omit savedVerses and retain the current collection.
 if public.restore_journey(backup-'savedVerses') is distinct from snapshot then raise exception 'Legacy restore lost saved verses'; end if;
 -- Reset only this synthetic account's restore quota to exercise invalid batches.
 perform set_config('role','none',true);
 update private.request_budgets set requests=1 where user_id=a and bucket='restore';
 perform set_config('role','authenticated',true);
 foreach invalid in array array[
  backup||'{"savedVerses":null}'::jsonb,
  backup||'{"savedVerses":{}}'::jsonb,
  backup||'{"savedVerses":["GEN.1.2","ACT.8.37"],"chapters":{"GEN.1":"2026-01-01"}}'::jsonb,
  backup||'{"savedVerses":["JHN.03.16"]}'::jsonb,
  backup||'{"savedVerses":[{"book":"JHN","chapter":3,"verse":16,"user_id":"other"}]}'::jsonb
 ] loop
  denied:=false;
  begin perform public.restore_journey(invalid); exception when sqlstate '22023' then denied:=true; end;
  if not denied or public.get_journey() is distinct from snapshot then raise exception 'Invalid saved verse import changed data'; end if;
 end loop;
 foreach statement in array array[
  'select private.valid_verse(''JHN'',3,16)',
  'insert into public.user_saved_verses(user_id,book_id,chapter,verse) values(auth.uid(),''JHN'',3,16)',
  'update public.user_saved_verses set user_id=gen_random_uuid()',
  'delete from public.user_saved_verses'
 ] loop
  denied:=false;
  begin execute statement; exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Direct saved verse/helper access accepted'; end if;
 end loop;
 perform set_config('request.jwt.claim.sub',b::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'session_id',sb,'role','authenticated')::text,true);
 snapshot:=public.ensure_journey('Saved verse fixture B','UTC');
 if snapshot->'savedVerses'<>'{}'::jsonb or exists(select 1 from public.user_saved_verses where user_id=a) then raise exception 'Saved verses leaked to another account'; end if;
 perform public.set_saved_verse('JHN',3,16,false);
 perform set_config('role','none',true);
 if (select count(*) from public.user_saved_verses where user_id=a)<>2 then raise exception 'Other account removed saved verses'; end if;
 insert into public.user_saved_verses(user_id,book_id,chapter,verse)
 select b,c.book_id,c.chapter,v.verse from public.bible_chapters c cross join lateral generate_series(1,c.verse_count) v(verse)
 where not(v.verse=any(c.empty_verses)) order by c.book_id,c.chapter,v.verse limit 1000;
 perform set_config('role','authenticated',true);
 perform public.set_saved_verse('1CH',1,1,true);
 denied:=false;
 begin perform public.set_saved_verse('JHN',3,16,true); exception when sqlstate '22023' then denied:=true; end;
 if not denied then raise exception 'Saved verse cap was bypassed'; end if;
 perform public.set_saved_verse('1CH',1,1,false);
 snapshot:=public.set_saved_verse('JHN',3,16,true);
 if (select count(*) from public.user_saved_verses)<>1000 or snapshot->'rewards'<>'{}'::jsonb then raise exception 'Saved verse cap/replacement changed rewards'; end if;
 denied:=false;
 begin perform public.restore_journey(backup||'{"savedVerses":["GEN.1.1"],"chapters":{"GEN.1":"2026-01-01"}}'::jsonb); exception when sqlstate '22023' then denied:=true; end;
 if not denied or public.get_journey() is distinct from snapshot then raise exception 'Merged saved verse cap was not atomic'; end if;
 perform set_config('role','none',true);
 update private.request_budgets set requests=60 where user_id=b and bucket='write';
 perform set_config('role','authenticated',true);
 denied:=false;
 begin perform public.set_saved_verse('JHN',3,16,false); exception when sqlstate 'PT429' then denied:=true; end;
 if not denied or public.get_journey() is distinct from snapshot then raise exception 'Saved verse quota did not preserve state/read recovery'; end if;
 perform set_config('role','none',true);
 delete from auth.sessions where id=sb;
 perform set_config('role','authenticated',true);
 if exists(select 1 from public.user_saved_verses) then raise exception 'Revoked session read saved verses'; end if;
 denied:=false;
 begin perform public.set_saved_verse('JHN',3,16,false); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Revoked session changed saved verses'; end if;
 perform set_config('role','anon',true);
 foreach statement in array array['select * from public.user_saved_verses','select public.set_saved_verse(''JHN'',3,16,true)'] loop
  denied:=false;
  begin execute statement; exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Anonymous saved verse access accepted'; end if;
 end loop;
 perform set_config('role','none',true);
 delete from auth.users where id=a;
 if exists(select 1 from public.user_saved_verses where user_id=a) or (select count(*) from public.user_saved_verses where user_id=b)<>1000 then raise exception 'Saved verse cascade affected another account'; end if;
 delete from auth.users where id=b;
 if exists(select 1 from public.user_saved_verses where user_id in (a,b)) then raise exception 'Saved verse deletion cascade incomplete'; end if;
end $verification$;
