-- AWS GenAI Quest: two people studying for AWS Certified Generative AI
-- Developer - Professional tick the exam guide's 98 skills.
--
-- quest_members is the allowlist: only those Google accounts read or write.
-- The syllabus itself is public (it is the public exam guide) and lives in
-- served JS, so the database only knows skill ids, checked by shape.

create table if not exists public.quest_members (
  email        text primary key,
  display_name text not null,
  hero         text not null check (hero in ('fighter', 'mage')),
  color        text
);

create or replace function public.is_quest_member()
returns boolean language sql security definer set search_path = public stable
as $$ select exists (select 1 from public.quest_members where email = auth.email()); $$;

create or replace function public.is_quest_member_email(addr text)
returns boolean language sql security definer set search_path = public stable
as $$ select exists (select 1 from public.quest_members where email = addr); $$;

-- One row per (skill, person). done_by is who tapped, so one may tick a skill
-- on the other's behalf and the row still says who did it.
create table if not exists public.quest_ticks (
  skill_id text not null check (skill_id ~ '^[1-5]\.[1-9]\.[1-9]$'),
  person   text not null,
  done_by  text not null default auth.email(),
  done_at  timestamptz not null default now(),
  primary key (skill_id, person)
);

-- The dragon: one row per person who passed the exam.
create table if not exists public.quest_exam (
  person    text primary key,
  passed_on date not null default current_date,
  done_by   text not null default auth.email()
);

alter table public.quest_members enable row level security;
alter table public.quest_ticks   enable row level security;
alter table public.quest_exam    enable row level security;

drop policy if exists quest_members_select on public.quest_members;
create policy quest_members_select on public.quest_members
  for select to authenticated using (public.is_quest_member());

drop policy if exists quest_ticks_select on public.quest_ticks;
create policy quest_ticks_select on public.quest_ticks
  for select to authenticated using (public.is_quest_member());
drop policy if exists quest_ticks_insert on public.quest_ticks;
create policy quest_ticks_insert on public.quest_ticks
  for insert to authenticated
  with check (public.is_quest_member() and done_by = auth.email() and public.is_quest_member_email(person));
drop policy if exists quest_ticks_delete on public.quest_ticks;
create policy quest_ticks_delete on public.quest_ticks
  for delete to authenticated using (public.is_quest_member());

drop policy if exists quest_exam_select on public.quest_exam;
create policy quest_exam_select on public.quest_exam
  for select to authenticated using (public.is_quest_member());
drop policy if exists quest_exam_insert on public.quest_exam;
create policy quest_exam_insert on public.quest_exam
  for insert to authenticated
  with check (public.is_quest_member() and done_by = auth.email() and public.is_quest_member_email(person));
drop policy if exists quest_exam_delete on public.quest_exam;
create policy quest_exam_delete on public.quest_exam
  for delete to authenticated using (public.is_quest_member());

-- No update grants: a tick or a pass is a fact; fixing one is delete + insert.
grant select                 on public.quest_members to authenticated;
grant select, insert, delete on public.quest_ticks   to authenticated;
grant select, insert, delete on public.quest_exam    to authenticated;
grant execute on function public.is_quest_member()           to authenticated;
grant execute on function public.is_quest_member_email(text) to authenticated;

-- The party is seeded in the last migration (..._party.sql), which each
-- copy of this template edits before its first `supabase db push`.
