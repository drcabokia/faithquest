-- Always execute inside BEGIN/ROLLBACK. Generated accounts and synthetic text only.
do $verification$
declare a uuid:=gen_random_uuid(); sa uuid:=gen_random_uuid(); snapshot jsonb; result jsonb;
 original text; revised text; today date:=(now() at time zone 'UTC')::date; denied boolean;
begin
 insert into auth.users(id) values(a);
 insert into auth.sessions(id,user_id) values(sa,a);
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id',sa,'role','authenticated')::text,true);
 perform set_config('role','authenticated',true);
 perform public.ensure_journey('Journal conflict fixture','UTC');
 snapshot:=public.save_journal_entry(today,'The first synthetic journal entry for this date.','prayer',null);
 original:=snapshot#>>array['reflections',today::text,'revision'];
 if original is null then raise exception 'Missing journal revision'; end if;
 result:=public.save_journal_entry(today,'A competing synthetic first entry must not overwrite.','gratitude',null);
 if result->>'error' is distinct from 'journal_conflict' or public.get_journey() is distinct from snapshot then raise exception 'Concurrent create overwrote saved journal'; end if;
 -- Retrying a committed intent is a true no-op, even with an absent/stale token.
 result:=public.save_journal_entry(today,'The first synthetic journal entry for this date.','prayer',null);
 if result is distinct from snapshot then raise exception 'Lost response retry changed revision or timestamp'; end if;
 snapshot:=public.save_journal_entry(today,'The first synthetic journal entry for this date.','gratitude',original);
 revised:=snapshot#>>array['reflections',today::text,'revision'];
 if revised=original then raise exception 'Category-only edit did not change revision'; end if;
 result:=public.save_journal_entry(today,'A stale synthetic text edit must not replace the category.','prayer',original);
 if result->>'error' is distinct from 'journal_conflict' or public.get_journey() is distinct from snapshot then raise exception 'Stale text/category edit overwrote journal'; end if;
 -- Change back in the SAME transaction/timestamp: revisions must still differ.
 snapshot:=public.save_journal_entry(today,'The first synthetic journal entry for this date.','prayer',revised);
 if snapshot#>>array['reflections',today::text,'revision']=original then raise exception 'Reused revision after reverting category'; end if;
 result:=public.save_journal_entry(today,'An old synthetic draft cannot bypass a reverted version.','application',original);
 if result->>'error' is distinct from 'journal_conflict' or public.get_journey() is distinct from snapshot then raise exception 'Stale revision bypassed reverted content'; end if;
 snapshot:=public.save_journal_entry(today,'An explicitly reviewed synthetic replacement is accepted.','application',snapshot#>>array['reflections',today::text,'revision']);
 if (select sum(amount) from public.xp_transactions where user_id=a)<>20 then raise exception 'Journal conflict/replacement duplicated XP'; end if;
 -- Destination entries/revisions survive restore; imported rows get fresh tokens.
 result:=public.restore_journey(jsonb_build_object('version',1,'timeZone','UTC','chapters','{}'::jsonb,'attempts','{}'::jsonb,'reflections',jsonb_build_object(
 today::text,jsonb_build_object('text','A conflicting synthetic backup must never overwrite.'),
 (today-1)::text,jsonb_build_object('text','A legacy synthetic journal entry restored without a revision.'))));
 if result#>array['reflections',today::text] is distinct from snapshot#>array['reflections',today::text]
 or result#>>array['reflections',(today-1)::text,'revision'] is null then raise exception 'Restore changed a revision or failed to mint one'; end if;
 -- Obsolete clients cannot bypass the guarded command, even with active sessions.
 denied:=false;
 begin perform public.save_reflection(today,'An unguarded synthetic write must be denied.'); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Legacy journal endpoint remains writable'; end if;
 denied:=false;
 begin perform public.save_categorized_reflection(today,'An unguarded synthetic category write must be denied.','prayer'); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Legacy category endpoint remains writable'; end if;
 if has_function_privilege('anon','public.save_journal_entry(date,text,text,text)','execute') then raise exception 'Anonymous journal RPC allowed'; end if;
 perform set_config('role','none',true);
 delete from auth.users where id=a;
end $verification$;
