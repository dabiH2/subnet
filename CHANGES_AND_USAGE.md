# Subnet — Sharing, Forking, and Parameterized Agents

This document summarizes all modifications made on top of the original repo and explains how to use and deploy them.

---

## What’s new

### 1) Shareable public pages
- **New route:** `/a/[slug]` (e.g. `/a/123-research-assistant`)
- Human-friendly slug built from `{id}-{kebab-title}` — **no DB migrations** needed.
- Public page shows title, description, tools, **parameters summary** (if any), and CTAs:
  - **Run this agent**
  - **Fork** (to edit)
  - **Share link** (copies the public URL)

### 2) Fork → Create (edit-first)
- “Fork” now navigates to **`/create?from=<id>`** and **prefills the form** with the original agent’s configuration.
- You can edit everything, then save your own copy.
- Keeps migrations **zero** (we did not add lineage columns yet).

### 3) Parameterized agents (Prompt Variables)
- Agents can define **variables** used inside the prompt body with `{token}` syntax, e.g. `{topic}`.
- The variables are stored **inside the prompt** as a hidden HTML block:
  ```html
  <!-- VARS
  { "topic": {"label":"Topic","required":true}, "tone": {"label":"Tone","type":"select","options":["casual","formal"],"default":"casual"} }
  VARS -->
  <rest of your prompt that can reference {topic} and {tone}>
  ```
- **Create page** now has a **visual Parameter Builder** (no JSON typing):
  - add/edit/delete/reorder variables;
  - set label, type (text/textarea/select/number), placeholder, default, required;
  - for **select**, options are edited as comma-separated text (committed on blur/Enter, with live preview);
  - **inline preview** under the active parameter shows how end-users will see it;
  - “Insert `{token}`” buttons insert tokens into the prompt at the cursor.

### 4) Run page improvements
- Detects parameters and shows a **Parameters** form.
- Builds an **override prompt** by substituting user values (sent to the run API).
- **Instruction Set** viewer shows the **clean prompt body** (the hidden VARS block is stripped).
- **URL prefill:** `/run/:id?topic=LLMs&tone=formal` pre-populates the form.
- **Effective Prompt preview** toggle shows the live prompt after substitution.
- **Smart share dialog:** If parameters differ from defaults, the Share button opens a dialog:
  - **Base version** → copies the public page link.
  - **Include current values** → copies a direct `/run/:id?...` link with query params.

---

## File changes

### New files
- `lib/slugify.ts`
- `lib/vars.ts` — parses/strips the hidden VARS block; applies `{token}` substitutions.
- `app/a/[slug]/page.tsx` — public share page.
- `app/api/agents/[id]/fork/route.ts` — (optional) API to clone an agent (kept for future use).
- `components/agent-share-controls.tsx` — client-only Share/Fork buttons.
- `components/agent-param-form.tsx` — parameter form on the Run page (URL prefill + live preview).
- `components/param-builder.tsx` — **visual parameter builder** on the Create page.
- `components/share-chooser.tsx` — dialog to choose base link vs link with current values.

### Modified files
- `app/create/page.tsx`
  - Fork-prefill (`?from=<id>`), parameter builder, “Insert token” support.
  - Rebuilds prompt with `buildPromptWithVars(vars, body)`.
- `app/run/[id]/page.tsx`
  - Strips VARS block for display; renders `AgentParamForm`.
  - Sends `overridePrompt` to API if parameters are provided.
  - Effective Prompt preview toggle.
  - Smart share dialog if parameters differ from defaults.
- `app/api/agents/[id]/run/route.ts`
  - Accepts optional `overridePrompt` in the request JSON and uses it instead of `agent.prompt`.

---

## How to use (local dev)

### Prereqs
- Node 18+ and pnpm installed.

### Setup
```bash
pnpm install

# .env
DATABASE_URL=postgres://<user>:<pass>@<host>/<db>?sslmode=require
SUBCONSCIOUS_API_KEY=sk-...

# DB
pnpm db:migrate
pnpm db:seed

# Dev
pnpm dev
# open http://localhost:3000
```

### Create a templated agent
1. Go to **Create**.
2. Write your **prompt body**, e.g.:
   ```
   You are a research assistant. Write a {tone} summary about {topic}.
   ```
3. In **Parameters**:
   - Add a parameter **topic** → label “Topic”, required.
   - Add a parameter **tone** → type “Select”, options: `casual, formal`, default “casual`.
   - Use **Insert `{token}`** to add tokens to the prompt.
4. Choose tools, title, description → **Create Agent**.

### Run an agent
- Open the agent; fill the form; click **Run Agent**.
- Toggle **Effective Prompt** to see the substituted prompt.
- URL prefill works: `/run/123?topic=LLMs&tone=formal`.

### Share an agent
- From **Run**, click **Share**:
  - If parameter values are unchanged → base link to the public page is copied.
  - If changed → a dialog lets you copy either the base link or a **/run** link with your current values.

### Fork an agent
- Click **Fork** anywhere → opens **Create** with the original config prefilled for editing.
- Save as your own copy.

---

## Vercel deployment guide

### 1) Prepare a production Postgres
- Use **Neon** (recommended) or your own Postgres.
- Create a **production database** and copy its connection string.

### 2) Create a Vercel project
- Push your repo to GitHub/GitLab/Bitbucket.
- On **Vercel**, “New Project” → import your repo.
- **Environment Variables** (Project → Settings → Environment Variables):
  - `DATABASE_URL` = your **production** Postgres URL (Neon connection string).
  - `SUBCONSCIOUS_API_KEY` = your key.
  - (Optional) `NEXT_PUBLIC_SITE_URL` for canonical URLs.
- **Build settings**:
  - Build Command: `pnpm build`
  - Install Command: `pnpm install`
  - Output: (default for Next.js)
  - Node version: 18+ (Vercel defaults are fine)

### 3) Run migrations (once, against prod DB)
Vercel doesn’t run Drizzle migrations automatically on each deploy. Run them **once** locally against your production DB:

```bash
# CAUTION: This writes to production DB
DATABASE_URL="postgres://...prod..." pnpm db:migrate
```

(Alternatively, wire a small GitHub Action that runs `pnpm db:migrate` on deploy to `main`.)

### 4) Deploy
- Push to `main` (or your chosen branch) → Vercel builds & deploys.
- Visit your domain → the app should be live.

### 5) Post-deploy checks
- Create an agent in production, confirm it saves & lists on home page.
- Open a **share** link, verify Run and Fork.
- Try a parametrized agent; confirm **Effective Prompt** and **Share dialog** behavior.

### Notes / Gotchas
- If you switch DB providers, update `DATABASE_URL` and re-run migrations against the new DB.
- If the **share page** complains about `params` being a Promise, ensure you’re on the version that `await`s `params` in `/a/[slug]/page.tsx`.
- If the **run** route streams, make sure it’s **Node runtime** (default). Edge runtime + Drizzle/pg isn’t supported.

---

## Dev tips

- **No DB migrations required** for Parts 1–2. If you later want “Forked from …” attribution, add a nullable `forked_from_id` in `agents` and display it on run/share pages.
- To debug prompt variables, look at `lib/vars.ts` and the `AgentParamForm` usage in `app/run/[id]/page.tsx`.

Happy shipping 🚀
