-- Reviewed quiz prompts are public; solutions remain in the private schema.
begin;
insert into public.quiz_questions(id,plan_id,day,question,options,scripture_reference,reviewed) values ('gen-light','1cefbf9d-bb72-47ec-a095-9bfba706e365',1,'What did God call the light?','["Day","Heaven","Earth","Sea"]'::jsonb,'Genesis 1:5',true);
insert into private.quiz_answers(question_id,correct_option,explanation) values ('gen-light',0,'God called the light day and the darkness night.');
insert into public.quiz_questions(id,plan_id,day,question,options,scripture_reference,reviewed) values ('gen-rest','1cefbf9d-bb72-47ec-a095-9bfba706e365',1,'On which day did God rest from his work?','["The third day","The sixth day","The seventh day","The first day"]'::jsonb,'Genesis 2:2–3',true);
insert into private.quiz_answers(question_id,correct_option,explanation) values ('gen-rest',2,'God rested on the seventh day, blessed it, and made it holy.');
insert into public.quiz_questions(id,plan_id,day,question,options,scripture_reference,reviewed) values ('gen-garden','1cefbf9d-bb72-47ec-a095-9bfba706e365',1,'Where did God place the man to cultivate and keep it?','["Babel","The garden of Eden","Egypt","Mount Sinai"]'::jsonb,'Genesis 2:15',true);
insert into private.quiz_answers(question_id,correct_option,explanation) values ('gen-garden',1,'Yahweh God placed the man in the garden of Eden to cultivate and keep it.');
insert into public.quiz_questions(id,plan_id,day,question,options,scripture_reference,reviewed) values ('gen-noah','1cefbf9d-bb72-47ec-a095-9bfba706e365',2,'Who was told to build an ark?','["Abraham","Moses","Noah","David"]'::jsonb,'Genesis 6:13–14',true);
insert into private.quiz_answers(question_id,correct_option,explanation) values ('gen-noah',2,'God spoke to Noah and instructed him to make an ark of gopher wood.');
insert into public.quiz_questions(id,plan_id,day,question,options,scripture_reference,reviewed) values ('gen-walk','1cefbf9d-bb72-47ec-a095-9bfba706e365',2,'Who is described as having walked with God before God took him?','["Cain","Enoch","Lamech","Pharaoh"]'::jsonb,'Genesis 5:24',true);
insert into private.quiz_answers(question_id,correct_option,explanation) values ('gen-walk',1,'Genesis records that Enoch walked with God, and God took him.');
insert into public.quiz_questions(id,plan_id,day,question,options,scripture_reference,reviewed) values ('gen-rainbow','1cefbf9d-bb72-47ec-a095-9bfba706e365',3,'What sign did God give of his covenant with the earth?','["A rainbow in the cloud","A pillar of fire","A stone tablet","A star"]'::jsonb,'Genesis 9:12–13',true);
insert into private.quiz_answers(question_id,correct_option,explanation) values ('gen-rainbow',0,'God set his rainbow in the cloud as a sign of the covenant between himself and the earth.');
commit;
