-- Local-only stand-in for the parts of Supabase that migrations depend on.
-- Production already provides these; this exists so row-level security can be
-- exercised against a throwaway Postgres with no Supabase stack running.

create extension if not exists pgcrypto;   -- gen_random_uuid()

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

grant usage on schema public to anon, authenticated;

create schema if not exists auth;

-- Supabase's auth.email() reads the verified JWT. Locally we read a setting
-- each test assigns, which is what lets a test pretend to be a given member.
create or replace function auth.email() returns text
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.email', true), '') $$;

grant usage on schema auth to anon, authenticated;
grant execute on function auth.email() to anon, authenticated;
