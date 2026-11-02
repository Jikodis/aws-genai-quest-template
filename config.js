/* Public config for the AWS study battle. The publishable key is safe to
   embed; row-level security is the real guard. Never put the Supabase secret
   key here. No emails or names: those come from the RLS-gated quest_members
   table after sign-in. TODAY is only ever set by test.html. */
window.CONFIG = {
  // Fill both from your Supabase project: Project Settings, API.
  SUPABASE_URL: 'https://YOUR-PROJECT-REF.supabase.co',
  SUPABASE_KEY: 'sb_publishable_YOUR_KEY'
};
