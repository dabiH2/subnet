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
