-- Bounded, authenticated backup merge; existing activity always wins.
begin;
alter table private.request_budgets drop constraint request_budgets_bucket_check;
alter table private.request_budgets add constraint request_budgets_bucket_check check(bucket in ('read','write','export','delete','health','restore'));
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
  when 'restore' then cap:=3; seconds:=900;
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
create function public.restore_journey(p_backup jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid := private.actor(); plan uuid; zone text; today date;
 entry record; day_date date;
begin
 perform private.enforce_request_limit('write');
 perform private.enforce_request_limit('restore');
 select reading_plan_id,timezone,(now() at time zone timezone)::date into plan,zone,today from public.profiles where id=actor;
 if p_backup is null or octet_length(p_backup::text)>5242880 or jsonb_typeof(p_backup)<>'object' then
  raise exception 'Invalid backup' using errcode='22023';
 end if;
 if (select count(*) from jsonb_object_keys(p_backup))<>5
 or p_backup->'version' is distinct from '1'::jsonb
 or p_backup->'timeZone' is distinct from to_jsonb(zone)
 or jsonb_typeof(p_backup->'chapters') is distinct from 'object'
 or jsonb_typeof(p_backup->'attempts') is distinct from 'object'
 or jsonb_typeof(p_backup->'reflections') is distinct from 'object' then
  raise exception 'Invalid backup or timezone mismatch' using errcode='22023';
 end if;
 if (select count(*) from jsonb_object_keys(p_backup->'chapters'))>1189
 or (select count(*) from jsonb_object_keys(p_backup->'attempts'))>1000
 or (select count(*) from jsonb_object_keys(p_backup->'reflections'))>3660 then
  raise exception 'Backup is too large' using errcode='22023';
 end if;
 -- Validate every row before applying any of them. Dates are checked again in
 -- PostgreSQL so a direct RPC cannot bypass the browser or Next.js validator.
 for entry in select key,value from jsonb_each(p_backup->'chapters') loop
  if jsonb_typeof(entry.value) is distinct from 'string'
  or (entry.value#>>'{}') !~ '^\d{4}-\d{2}-\d{2}$'
  or not exists(select 1 from public.reading_plan_day_chapters where plan_id=plan and book_id||'.'||chapter=entry.key) then
   raise exception 'Invalid backup chapter' using errcode='22023';
  end if;
  day_date:=(entry.value#>>'{}')::date;
  if day_date>today then raise exception 'Future activity' using errcode='22023'; end if;
 end loop;
 for entry in select key,value from jsonb_each(p_backup->'attempts') loop
  if jsonb_typeof(entry.value) is distinct from 'object' then raise exception 'Invalid backup attempt' using errcode='22023'; end if;
  if (select count(*) from jsonb_object_keys(entry.value))<>2
  or jsonb_typeof(entry.value->'answer') is distinct from 'number'
  or (entry.value->>'answer') !~ '^[0-3]$'
  or jsonb_typeof(entry.value->'date') is distinct from 'string'
  or (entry.value->>'date') !~ '^\d{4}-\d{2}-\d{2}$'
  or not exists(select 1 from public.quiz_questions q join private.quiz_answers a on a.question_id=q.id where q.id=entry.key and q.plan_id=plan and q.reviewed) then
   raise exception 'Invalid backup attempt' using errcode='22023';
  end if;
  day_date:=(entry.value->>'date')::date;
  if day_date>today then raise exception 'Future activity' using errcode='22023'; end if;
 end loop;
 for entry in select key,value from jsonb_each(p_backup->'reflections') loop
  if jsonb_typeof(entry.value) is distinct from 'object' then raise exception 'Invalid backup reflection' using errcode='22023'; end if;
  if entry.key !~ '^\d{4}-\d{2}-\d{2}$'
  or (select count(*) from jsonb_object_keys(entry.value))<>1
  or jsonb_typeof(entry.value->'text') is distinct from 'string'
  or char_length(trim(entry.value->>'text')) not between 20 and 10000 then
   raise exception 'Invalid backup reflection' using errcode='22023';
  end if;
  day_date:=entry.key::date;
  if day_date>today then raise exception 'Future activity' using errcode='22023'; end if;
 end loop;
 insert into public.user_chapter_progress(user_id,book_id,chapter,completion_date)
 select actor,split_part(key,'.',1),split_part(key,'.',2)::smallint,(value#>>'{}')::date from jsonb_each(p_backup->'chapters') on conflict do nothing;
 insert into public.quiz_attempts(user_id,question_id,selected_option,is_correct,correct_option,explanation,attempted_at)
 select actor,q.id,(e.value->>'answer')::smallint,(e.value->>'answer')::integer=a.correct_option,a.correct_option,a.explanation,
 ((e.value->>'date')::date+time '12:00') at time zone zone
 from jsonb_each(p_backup->'attempts') e join public.quiz_questions q on q.id=e.key join private.quiz_answers a on a.question_id=q.id on conflict do nothing;
 insert into public.reflections(user_id,reflection_date,content)
 select actor,key::date,trim(value->>'text') from jsonb_each(p_backup->'reflections') on conflict do nothing;
 -- Reconstruct only earned rewards, from the merged authoritative records.
 insert into public.user_reading_progress(user_id,plan_id,day,completion_date)
 select actor,plan,a.day,max(c.completion_date) from public.reading_plan_day_chapters a
 left join public.user_chapter_progress c on c.user_id=actor and c.book_id=a.book_id and c.chapter=a.chapter
 where a.plan_id=plan group by a.day having count(*)=count(c.chapter) on conflict do nothing;
 insert into public.xp_transactions(user_id,activity_key,activity_type,amount,activity_date)
 select actor,'reading:'||day,'reading',50,completion_date from public.user_reading_progress where user_id=actor and plan_id=plan on conflict do nothing;
 insert into public.xp_transactions(user_id,activity_key,activity_type,amount,activity_date)
 select actor,'book:'||b.id,'book',150,max(c.completion_date) from public.bible_books b
 join public.user_chapter_progress c on c.user_id=actor and c.book_id=b.id group by b.id,b.chapter_count having count(*)=b.chapter_count on conflict do nothing;
 insert into public.xp_transactions(user_id,activity_key,activity_type,amount,activity_date)
 select actor,'quiz:'||question_id,'quiz',10,(attempted_at at time zone zone)::date from public.quiz_attempts where user_id=actor and is_correct on conflict do nothing;
 insert into public.xp_transactions(user_id,activity_key,activity_type,amount,activity_date)
 select actor,'reflection:'||reflection_date,'reflection',20,reflection_date from public.reflections where user_id=actor on conflict do nothing;
 perform private.unlock_achievements(actor);
 return public.get_journey();
end $$;
revoke all on function public.restore_journey(jsonb) from public,anon,authenticated;
grant execute on function public.restore_journey(jsonb) to authenticated;

-- Assistant-authored factual questions checked against the bundled WEB text.
insert into public.quiz_questions(id,plan_id,day,question,options,scripture_reference,reviewed) select 'gen-babel',id,4,'Why was the city called Babel?','["It was built beside the sea", "Yahweh confused the language there", "It was Abram’s birthplace", "Noah landed there"]'::jsonb,'Genesis 11:9',true from public.reading_plans where slug='canonical' and published;
insert into private.quiz_answers(question_id,correct_option,explanation) values ('gen-babel',1,'Genesis connects Babel’s name with Yahweh confusing the language of the earth.');
insert into public.quiz_questions(id,plan_id,day,question,options,scripture_reference,reviewed) select 'gen-abram-age',id,4,'How old was Abram when he departed from Haran?','["Forty", "Sixty", "Seventy-five", "One hundred"]'::jsonb,'Genesis 12:4',true from public.reading_plans where slug='canonical' and published;
insert into private.quiz_answers(question_id,correct_option,explanation) values ('gen-abram-age',2,'Abram was seventy-five when he left Haran as Yahweh had told him.');
insert into public.quiz_questions(id,plan_id,day,question,options,scripture_reference,reviewed) select 'gen-melchizedek',id,5,'What did Melchizedek bring out?','["Bread and wine", "Milk and honey", "Fish and oil", "Silver and gold"]'::jsonb,'Genesis 14:18',true from public.reading_plans where slug='canonical' and published;
insert into private.quiz_answers(question_id,correct_option,explanation) values ('gen-melchizedek',0,'Melchizedek, king of Salem and priest of God Most High, brought bread and wine.');
insert into public.quiz_questions(id,plan_id,day,question,options,scripture_reference,reviewed) select 'gen-ishmael',id,5,'What did Abram name the son Hagar bore him?','["Isaac", "Jacob", "Joseph", "Ishmael"]'::jsonb,'Genesis 16:15',true from public.reading_plans where slug='canonical' and published;
insert into private.quiz_answers(question_id,correct_option,explanation) values ('gen-ishmael',3,'Abram named Hagar’s son Ishmael.');
insert into public.quiz_questions(id,plan_id,day,question,options,scripture_reference,reviewed) select 'gen-abraham-name',id,6,'What new name did God give Abram?','["Israel", "Abraham", "Isaac", "Aaron"]'::jsonb,'Genesis 17:5',true from public.reading_plans where slug='canonical' and published;
insert into private.quiz_answers(question_id,correct_option,explanation) values ('gen-abraham-name',1,'God changed Abram’s name to Abraham and spoke of making him the father of many nations.');
insert into public.quiz_questions(id,plan_id,day,question,options,scripture_reference,reviewed) select 'gen-lots-wife',id,6,'What did Lot’s wife become after looking back?','["A pillar of salt", "A tree", "A cloud", "A spring"]'::jsonb,'Genesis 19:26',true from public.reading_plans where slug='canonical' and published;
insert into private.quiz_answers(question_id,correct_option,explanation) values ('gen-lots-wife',0,'Genesis records that Lot’s wife looked back and became a pillar of salt.');
insert into public.quiz_questions(id,plan_id,day,question,options,scripture_reference,reviewed) select 'gen-isaac-name',id,7,'What did Abraham name the son Sarah bore him?','["Ishmael", "Esau", "Isaac", "Judah"]'::jsonb,'Genesis 21:3',true from public.reading_plans where slug='canonical' and published;
insert into private.quiz_answers(question_id,correct_option,explanation) values ('gen-isaac-name',2,'Abraham named the son born to him and Sarah Isaac.');
insert into public.quiz_questions(id,plan_id,day,question,options,scripture_reference,reviewed) select 'gen-ram',id,7,'What animal did Abraham see caught in the thicket by its horns?','["A calf", "A goat", "A donkey", "A ram"]'::jsonb,'Genesis 22:13',true from public.reading_plans where slug='canonical' and published;
insert into private.quiz_answers(question_id,correct_option,explanation) values ('gen-ram',3,'Abraham saw a ram caught by its horns and offered it instead of his son.');
insert into public.quiz_questions(id,plan_id,day,question,options,scripture_reference,reviewed) select 'gen-sarah-burial',id,8,'Where did Abraham bury Sarah?','["A cave at Mount Sinai", "The cave of Machpelah", "A field in Egypt", "A garden in Babel"]'::jsonb,'Genesis 23:19',true from public.reading_plans where slug='canonical' and published;
insert into private.quiz_answers(question_id,correct_option,explanation) values ('gen-sarah-burial',1,'Abraham buried Sarah in the cave of the field of Machpelah, before Mamre.');
insert into public.quiz_questions(id,plan_id,day,question,options,scripture_reference,reviewed) select 'gen-esau-meal',id,8,'What meal did Jacob give Esau?','["Bread and lentil stew", "Fish and bread", "Roasted lamb and herbs", "Manna and quail"]'::jsonb,'Genesis 25:34',true from public.reading_plans where slug='canonical' and published;
insert into private.quiz_answers(question_id,correct_option,explanation) values ('gen-esau-meal',0,'Jacob gave Esau bread and lentil stew after the exchange concerning Esau’s birthright.');
insert into public.quiz_questions(id,plan_id,day,question,options,scripture_reference,reviewed) select 'gen-stairway',id,9,'What did Jacob see reaching from earth to heaven in his dream?','["A river", "A tower", "A stairway", "A mountain"]'::jsonb,'Genesis 28:12',true from public.reading_plans where slug='canonical' and published;
insert into private.quiz_answers(question_id,correct_option,explanation) values ('gen-stairway',2,'Jacob dreamed of a stairway reaching to heaven, with God’s angels ascending and descending.');
insert into public.quiz_questions(id,plan_id,day,question,options,scripture_reference,reviewed) select 'gen-rachel-years',id,9,'How many years did Jacob offer to serve for Rachel?','["Three", "Seven", "Ten", "Twenty"]'::jsonb,'Genesis 29:18',true from public.reading_plans where slug='canonical' and published;
insert into private.quiz_answers(question_id,correct_option,explanation) values ('gen-rachel-years',1,'Jacob offered to serve Laban seven years for Rachel, his younger daughter.');
insert into public.quiz_questions(id,plan_id,day,question,options,scripture_reference,reviewed) select 'gen-joseph-name',id,10,'What did Rachel name her son in this verse?','["Benjamin", "Dan", "Levi", "Joseph"]'::jsonb,'Genesis 30:24',true from public.reading_plans where slug='canonical' and published;
insert into private.quiz_answers(question_id,correct_option,explanation) values ('gen-joseph-name',3,'Rachel named her son Joseph and asked Yahweh to add another son.');
insert into public.quiz_questions(id,plan_id,day,question,options,scripture_reference,reviewed) select 'gen-israel-name',id,10,'What new name was Jacob given?','["Israel", "Abraham", "Edom", "Judah"]'::jsonb,'Genesis 32:28',true from public.reading_plans where slug='canonical' and published;
insert into private.quiz_answers(question_id,correct_option,explanation) values ('gen-israel-name',0,'Jacob was told that his name would be Israel.');
insert into public.quiz_questions(id,plan_id,day,question,options,scripture_reference,reviewed) select 'gen-esau-greeting',id,11,'How did Esau greet Jacob when they met?','["He hid from him", "He embraced and kissed him", "He took him prisoner", "He sent him away"]'::jsonb,'Genesis 33:4',true from public.reading_plans where slug='canonical' and published;
insert into private.quiz_answers(question_id,correct_option,explanation) values ('gen-esau-greeting',1,'Esau ran to Jacob, embraced and kissed him, and they wept.');
insert into public.quiz_questions(id,plan_id,day,question,options,scripture_reference,reviewed) select 'gen-rachel-burial',id,11,'Near which place was Rachel buried?','["Bethel", "Shechem", "Ephrath, also called Bethlehem", "Jericho"]'::jsonb,'Genesis 35:19',true from public.reading_plans where slug='canonical' and published;
insert into private.quiz_answers(question_id,correct_option,explanation) values ('gen-rachel-burial',2,'Rachel was buried on the way to Ephrath, which is also called Bethlehem.');
insert into public.quiz_questions(id,plan_id,day,question,options,scripture_reference,reviewed) select 'gen-joseph-price',id,12,'For how much was Joseph sold to the Ishmaelites?','["Ten pieces of gold", "Thirty pieces of silver", "Fifty pieces of gold", "Twenty pieces of silver"]'::jsonb,'Genesis 37:28',true from public.reading_plans where slug='canonical' and published;
insert into private.quiz_answers(question_id,correct_option,explanation) values ('gen-joseph-price',3,'Genesis gives the price as twenty pieces of silver.');
insert into public.quiz_questions(id,plan_id,day,question,options,scripture_reference,reviewed) select 'gen-potiphar',id,12,'Who bought Joseph in Egypt?','["Potiphar, Pharaoh’s officer", "Laban", "Melchizedek", "The chief baker"]'::jsonb,'Genesis 39:1',true from public.reading_plans where slug='canonical' and published;
insert into private.quiz_answers(question_id,correct_option,explanation) values ('gen-potiphar',0,'Potiphar, an officer of Pharaoh and captain of the guard, bought Joseph.');
insert into public.quiz_questions(id,plan_id,day,question,options,scripture_reference,reviewed) select 'gen-cupbearer',id,13,'Whom did Pharaoh restore to his position?','["The chief baker", "The chief cup bearer", "Joseph", "The prison keeper"]'::jsonb,'Genesis 40:21',true from public.reading_plans where slug='canonical' and published;
insert into private.quiz_answers(question_id,correct_option,explanation) values ('gen-cupbearer',1,'Pharaoh restored the chief cup bearer, who again placed the cup in Pharaoh’s hand.');
insert into public.quiz_questions(id,plan_id,day,question,options,scripture_reference,reviewed) select 'gen-famine-years',id,13,'How many years of famine were foretold after the years of plenty?','["Three", "Five", "Seven", "Twelve"]'::jsonb,'Genesis 41:30',true from public.reading_plans where slug='canonical' and published;
insert into private.quiz_answers(question_id,correct_option,explanation) values ('gen-famine-years',2,'Joseph foretold seven years of famine after the years of plenty.');
insert into public.quiz_questions(id,plan_id,day,question,options,scripture_reference,reviewed) select 'gen-benjamin-portion',id,14,'How large was Benjamin’s portion compared with the others?','["The same size", "Twice as large", "Three times as large", "Five times as large"]'::jsonb,'Genesis 43:34',true from public.reading_plans where slug='canonical' and published;
insert into private.quiz_answers(question_id,correct_option,explanation) values ('gen-benjamin-portion',3,'Benjamin’s portion was five times as large as any of the others’ portions.');
insert into public.quiz_questions(id,plan_id,day,question,options,scripture_reference,reviewed) select 'gen-joseph-revealed',id,14,'Who did Joseph say he was when he spoke to his brothers?','["Their brother whom they sold into Egypt", "A messenger from Canaan", "The chief baker", "A merchant from Salem"]'::jsonb,'Genesis 45:4',true from public.reading_plans where slug='canonical' and published;
insert into private.quiz_answers(question_id,correct_option,explanation) values ('gen-joseph-revealed',0,'Joseph identified himself as their brother, whom they had sold into Egypt.');
commit;
