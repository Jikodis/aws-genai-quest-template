-- The party: the Google accounts allowed to sign in, one fighter and one mage.
-- EDIT BEFORE YOUR FIRST `supabase db push`: put your own and your study
-- partner's Gmail addresses and names here. Once pushed, never edit this file;
-- add a member later with a new migration that inserts one more row.
insert into public.quest_members (email, display_name, hero, color) values
  ('you@gmail.com',     'You',     'fighter', 'gold'),
  ('partner@gmail.com', 'Partner', 'mage',    'silver')
on conflict (email) do nothing;
