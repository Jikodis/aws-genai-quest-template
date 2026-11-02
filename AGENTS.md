# AWS GenAI Quest: guide for agents and contributors

A two-person study tracker for **AWS Certified Generative AI Developer - Professional (AIP-C01)**, drawn as an 8-bit boss battle. A fighter and a mage tick off the 20 trainings in the study plan (the Skill Builder Exam Prep Plan plus three agentic pieces); each of the five exam domains is a monster, and the exam is a dragon that falls to the first logged pass. Setup for a new copy is in `README.md`.

## How it ships
- **Static site, no build.** Plain HTML, CSS and classic `<script>` files at the repo root. No `package.json`, no bundler. Keep it that way.
- **Netlify serves this repo root as its own site.** Every asset path in the page stays relative, so the site also works behind a proxy at a folder path.
- **Changes go through pull requests into `main`.** Netlify builds a deploy preview for each one; merging to `main` deploys.
- **Committed = public.** Netlify serves every file in the repo. `_redirects` 404s `supabase/`, `tests/`, `AGENTS.md`, `README.md` and `test.html`; add a line for any new internal file.

## Files
| File | What it does |
| --- | --- |
| `index.html`, `styles.css` | The page: battle canvas, monster and party windows, the spellbook checklist, the final battle |
| `syllabus.js` | The 5 domains and the 20 trainings with their plan due dates ("AI Engineer Study Plan (AWS)", Oct 20 2026). Ids must match the `quest_targets` seed; a node test checks it. Served on purpose: course names are public |
| `quest.js` | Pure rules, no DOM. Tested by `node --test tests/` |
| `battle.js` | Drawing only: a 256x144 canvas scaled with nearest-neighbour |
| `data.js`, `config.js` | Supabase client and Google sign-in. `config.js` holds only the public project URL and publishable key |
| `app.js` | Wires the four together |
| `test.html` | Stub states without a login: `?state=fresh\|mid\|behind\|dragon\|won\|solo\|outsider`. `CONFIG.TODAY` pins the date there and is never set in `config.js` |

## The rules (`quest.js`)
- Each domain is a monster with one HP per hero for each of its Review, Practice and SimuLearn trainings, so it falls only when both have finished them. A tick in a later domain hits that monster early. Trainings with domain 0 (overview, practice tests, agentic courses) hit no monster but count for pace.
- **Due dates live in the `quest_targets` table**, one row per training plus `exam`, seeded from the plan. Either member changes them in the app (EDIT DUE DATES); the page falls back to `syllabus.js` dates only for a missing row. Expected work ramps across each training's window: from the day after the previous due date (a week before the first) to its own.
- A hero's HP is **pace, not progress**: 80% when exactly on pace, full a training or more ahead, minus 20% per training behind, so 4 behind is a knockout.
- The Exam Dragon appears after the five monsters. Nothing studied hurts it; the first logged pass ends it in one hit, whatever is still standing.

## Art
All sprites are original: heroes are 16x20 pixel grids, monsters are flat shapes plus a 1px black outline pass (`outline()` in `battle.js`). The look is inspired by 8-bit RPG battle screens; never copy sprites, fonts or names from an existing game. Every animation is skipped under `prefers-reduced-motion`.

## Backend: Supabase
- Its own Supabase project, Google sign-in only, Email provider off.
- **Security model:** the publishable key in `config.js` is safe to serve; **row-level security is the real guard**. There is no server, so the secret key (`sb_secret_...`) never goes anywhere in this repo or in Netlify.
- `quest_members` is the allowlist (email, display_name, `hero` fighter or mage, color), checked by `is_quest_member()`. `quest_targets` holds the due dates (members select, and update only `due_on` with `updated_by` forced to themselves). `quest_ticks` has one row per (training, person), with a foreign key to `quest_targets`; `done_by` is forced to the caller, either member may untick, nobody can update. `quest_exam` has one row per person who passed.
- **The database changes only through migrations** in `supabase/migrations/`, applied with `supabase --workdir <repo> db push`. Never edit an applied migration; add a new one. Never change the schema in the dashboard SQL editor.
- **SQL tests:** `bash supabase/tests/run.sh` boots a throwaway Postgres 17 in Podman, stubs Supabase's auth (`harness.sql`), applies every migration and runs `*_test.sql`. Run it after any migration change.

## Gotchas
- Don't reuse an `id` between an SVG or canvas and a form control.
- Google OAuth is in Testing mode: a new player must be added as a test user on the Google Cloud OAuth consent screen and as a `quest_members` row (by a new migration; the party seed is `..._party.sql`) before they can sign in.
