# AWS GenAI Quest (template)

A two-person study tracker for the AWS Certified Generative AI Developer - Professional (AIP-C01) exam, drawn as an 8-bit boss battle. Each of you ticks off the 20 trainings of the Skill Builder exam prep plan; each exam domain is a monster, and the exam is a dragon that falls to the first logged pass.

It is a static site (plain HTML, CSS and JavaScript, no build) with a Supabase database and Google sign-in. Your copy needs its own Supabase project, Google OAuth client and Netlify site, all on free tiers.

## Set up your own copy

You need the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) and a GitHub account.

1. **Create your repo:** on this repo's GitHub page, click **Use this template**, then clone your new repo.
2. **Name your party:** edit `supabase/migrations/20261101000000_party.sql` with your and your study partner's Gmail addresses and names. Do this before step 4.
3. **Create a Supabase project** at [supabase.com](https://supabase.com/dashboard). From **Project Settings > API**, copy the project URL and the publishable key into `config.js`. The publishable key is safe to commit; row-level security protects the data. Never commit the secret key.
4. **Create the tables:** `supabase link --project-ref <your-project-ref>`, then `supabase db push`.
5. **Create a Netlify site** from your repo (**Add new site > Import an existing project**, leave the build command empty and the publish directory as `.`). Note its address, for example `https://my-quest.netlify.app/`, and put it in `site_url` and `additional_redirect_urls` in `supabase/config.toml`.
6. **Set up Google sign-in:** in [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an OAuth client of type **Web application** with the authorized redirect URI `https://<your-project-ref>.supabase.co/auth/v1/callback`. On the OAuth consent screen, add both Gmail addresses as test users.
7. **Push the auth settings:** run this with the client's id and secret from step 6:
   `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=<id> SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=<secret> supabase config push`
8. **Commit and push** `config.js` and `supabase/config.toml`. Netlify deploys; open your site and sign in with Google.

Set your own due dates in the app with **EDIT DUE DATES**; the defaults come from the plan.

## Check your changes

- Page logic: `node --test tests/`
- Database rules: `bash supabase/tests/run.sh` (needs Podman, or Docker with `CONTAINER_CLI=docker`)
- The page without signing in: open `test.html?state=mid` (other states: `fresh`, `behind`, `dragon`, `won`, `solo`, `outsider`)

`AGENTS.md` describes how the code fits together, for you or a coding agent.
