-- Ticks are now the study plan's trainings, not the exam guide's 98 skills,
-- and every training's due date lives here so the two heroes can agree on
-- dates in the app instead of in a pull request.
--
-- quest_targets: one row per training (ids match syllabus.js) plus 'exam'.
-- Seeded with the plan's dates: the last day of each plan week.
-- Members read every row and change only due_on; updated_by is forced to the
-- caller so the row says who last moved it.

create table if not exists public.quest_targets (
  id         text primary key check (id ~ '^[a-z0-9-]+$'),
  due_on     date not null,
  updated_by text
);

insert into public.quest_targets (id, due_on) values
  ('overview',      '2026-10-26'),
  ('question-set',  '2026-10-26'),
  ('d1-review',     '2026-10-26'),
  ('d1-practice',   '2026-11-02'),
  ('d1-simulearn',  '2026-11-02'),
  ('d2-review',     '2026-11-09'),
  ('d2-practice',   '2026-11-09'),
  ('d2-simulearn',  '2026-11-09'),
  ('agentic-dive',  '2026-11-16'),
  ('d3-review',     '2026-11-23'),
  ('d3-practice',   '2026-11-23'),
  ('d4-review',     '2026-11-23'),
  ('d4-practice',   '2026-11-30'),
  ('d5-review',     '2026-11-30'),
  ('d5-practice',   '2026-11-30'),
  ('pretest',       '2026-11-30'),
  ('agentic-lab',   '2026-12-07'),
  ('advanced-plan', '2026-12-07'),
  ('practice-exam', '2026-12-14'),
  ('summary',       '2026-12-14'),
  ('exam',          '2026-12-15')
on conflict (id) do nothing;

alter table public.quest_targets enable row level security;

drop policy if exists quest_targets_select on public.quest_targets;
create policy quest_targets_select on public.quest_targets
  for select to authenticated using (public.is_quest_member());
drop policy if exists quest_targets_update on public.quest_targets;
create policy quest_targets_update on public.quest_targets
  for update to authenticated
  using (public.is_quest_member())
  with check (public.is_quest_member() and updated_by = auth.email());

grant select on public.quest_targets to authenticated;
grant update (due_on, updated_by) on public.quest_targets to authenticated;

-- Ticks name a training now. No skill-id ticks existed when this ran
-- (checked 2026-10-31); the delete only guards the new foreign key.
alter table public.quest_ticks drop constraint if exists quest_ticks_skill_id_check;
delete from public.quest_ticks
  where skill_id not in (select id from public.quest_targets where id <> 'exam');
alter table public.quest_ticks rename column skill_id to training_id;
alter table public.quest_ticks
  add constraint quest_ticks_training_fk foreign key (training_id)
    references public.quest_targets (id) on delete cascade,
  add constraint quest_ticks_not_exam check (training_id <> 'exam');
