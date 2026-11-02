-- Assertions for the AWS study battle. Every `raise exception` aborts the file
-- under ON_ERROR_STOP=1, so a raise is a failed test. The seeded party is
-- replaced with two test members, so editing the party migration never
-- breaks these tests.

delete from public.quest_members;
insert into public.quest_members (email, display_name, hero, color) values
  ('hero@example.com', 'Hero', 'fighter', 'gold'),
  ('pal@example.com',  'Pal',  'mage',    'silver');

-- ---- members tick their own trainings, and on each other's behalf -------------
do $$
declare n int;
begin
  set local role authenticated;
  set local request.jwt.claim.email = 'hero@example.com';
  insert into public.quest_ticks (training_id, person, done_by) values ('d1-review', auth.email(), auth.email());
  insert into public.quest_ticks (training_id, person, done_by) values ('d1-review', 'pal@example.com', auth.email());
  select count(*) into n from public.quest_ticks;
  if n <> 2 then raise exception 'expected 2 ticks, got %', n; end if;
  select count(*) into n from public.quest_members;
  if n <> 2 then raise exception 'a member should read every quest member, got %', n; end if;
end $$;
reset role;

-- ---- forged attribution, a non-member person and an unknown training are refused --
do $$
begin
  set local role authenticated;
  set local request.jwt.claim.email = 'pal@example.com';
  begin
    insert into public.quest_ticks (training_id, person, done_by) values ('d1-practice', auth.email(), 'hero@example.com');
    raise exception 'forged done_by was accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.quest_ticks (training_id, person, done_by) values ('d1-practice', 'outsider@example.com', auth.email());
    raise exception 'a tick for someone outside the party was accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

do $$
begin
  begin
    insert into public.quest_ticks (training_id, person, done_by) values ('1.1.1', 'pal@example.com', 'pal@example.com');
    raise exception 'a tick for an unknown training was accepted';
  exception when foreign_key_violation then null;
  end;
  begin
    insert into public.quest_ticks (training_id, person, done_by) values ('exam', 'pal@example.com', 'pal@example.com');
    raise exception 'the exam row was ticked as a training';
  exception when check_violation then null;
  end;
end $$;

-- ---- either member may untick; nobody can update a tick ---------------------
do $$
declare n int;
begin
  set local role authenticated;
  set local request.jwt.claim.email = 'pal@example.com';
  delete from public.quest_ticks where training_id = 'd1-review' and person = 'hero@example.com';
  select count(*) into n from public.quest_ticks;
  if n <> 1 then raise exception 'cross-member untick failed, % ticks left', n; end if;
  begin
    update public.quest_ticks set person = auth.email();
    raise exception 'a tick was updated';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ---- the exam: a member logs a pass ----------------------------------------
do $$
declare n int;
begin
  set local role authenticated;
  set local request.jwt.claim.email = 'hero@example.com';
  insert into public.quest_exam (person, passed_on, done_by) values (auth.email(), '2026-12-16', auth.email());
  select count(*) into n from public.quest_exam;
  if n <> 1 then raise exception 'pass not recorded'; end if;
end $$;
reset role;

-- ---- someone outside the party sees nothing -------------------------------
do $$
declare n int;
begin
  set local role authenticated;
  set local request.jwt.claim.email = 'stranger@example.com';
  select count(*) into n from public.quest_ticks;
  if n <> 0 then raise exception 'a non-member can read quest ticks'; end if;
  select count(*) into n from public.quest_members;
  if n <> 0 then raise exception 'a non-member can read quest members'; end if;
  begin
    insert into public.quest_ticks (training_id, person, done_by) values ('d2-review', auth.email(), auth.email());
    raise exception 'a non-member could tick';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ---- target dates: members read all 21 and move one, as themselves -------
do $$
declare n int; d date; who text;
begin
  set local role authenticated;
  set local request.jwt.claim.email = 'pal@example.com';
  select count(*) into n from public.quest_targets;
  if n <> 21 then raise exception 'expected 20 trainings plus the exam, got %', n; end if;
  update public.quest_targets set due_on = '2026-11-12', updated_by = auth.email() where id = 'd2-review';
  select due_on, updated_by into d, who from public.quest_targets where id = 'd2-review';
  if d <> '2026-11-12' or who <> 'pal@example.com' then raise exception 'a member could not move a due date'; end if;
  begin
    update public.quest_targets set due_on = '2026-11-13', updated_by = 'hero@example.com' where id = 'd2-review';
    raise exception 'a forged updated_by was accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.quest_targets set id = 'renamed', updated_by = auth.email() where id = 'd2-review';
    raise exception 'a target id was changed';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.quest_targets (id, due_on) values ('extra', '2026-12-01');
    raise exception 'a member added a target';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

do $$
declare n int;
begin
  set local role authenticated;
  set local request.jwt.claim.email = 'stranger@example.com';
  select count(*) into n from public.quest_targets;
  if n <> 0 then raise exception 'a non-member can read target dates'; end if;
  update public.quest_targets set due_on = '2027-01-01', updated_by = auth.email();
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'a non-member moved % due dates', n; end if;
end $$;
reset role;

-- ---- anon sees nothing -------------------------------------------------------
do $$
begin
  set local role anon;
  begin
    perform 1 from public.quest_ticks;
    raise exception 'anon can read quest ticks';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.quest_targets;
    raise exception 'anon can read target dates';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
