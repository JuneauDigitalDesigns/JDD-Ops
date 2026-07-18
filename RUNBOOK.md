# JDD Operations Runbook

Step-by-step setup for the JDD provisioning pipeline. Read this top-to-bottom the
first time. After that, the per-client path is: **Part B (build the site) → Part C
(provision) → Part D (wire the lead-callback) → Part E (set up the client portal)**.

> **Repo location:** this repo lives at `C:\Users\Xander\Desktop\ops\jdd-ops`.
> The Desktop is organized into `clients/`, `ops/`, and `templates/`.

> **The site builder ("studio")** is the **Build** tab of the unified console at
> `console` (route `/build`, dev server on port 3040 — run `npm run console`). It is how
> you compose a client site from the prebuilt component catalog and export it into
> `clients/{slug}/repo`. There is **no GitHub template repo** anymore — the blank template
> lives in this repo at `template/` and is copied locally per client.

---

## Part A — One-time setup (do this once, before your first paid client)

### A1. Fill in master credentials

```
cd C:\Users\Xander\Desktop\ops\jdd-ops
cp .env.example .env
```

Open `.env` and fill in:

| Variable | Where to get it |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys. Used in step 6 to generate the Retell agent prompt. |
| `RESEND_API_KEY` | resend.com → API Keys. Used by **Starter** sites for lead email delivery. |
| `RESEND_FROM_EMAIL` | A verified sender on a domain you control (e.g. `leads@juneaudigitaldesigns.com`). Reused across every Starter site. |
| `RETELL_API_KEY` | dashboard.retellai.com → API Keys. Used to create agents **and at runtime by `/api/voice/no-answer`** to register each inbound call (onboard.js copies it into every client `.env.local`). |
| `RETELL_LLM_ID` | A Retell LLM used as the **config template** (model + tools). dashboard.retellai.com → LLM → Create → copy ID. onboard.js clones its model/tools into a **per-client LLM** carrying that client's prompt (the prompt lives on the LLM, not the agent), and stores the per-client LLM id in the client `.env.local`. |
| `RETELL_DEFAULT_VOICE_ID` | dashboard.retellai.com → Voices → pick one → copy ID. |
| `RETELL_SIP_DOMAIN` | *(optional)* SIP host the no-answer leg dials (`sip:{call_id}@<domain>`). Defaults to `sip.retellai.com`; only set if Retell assigns your account a different SIP ingress domain. |
| `TWILIO_ACCOUNT_SID` | console.twilio.com (Growth/Enterprise). Step 8 buys the client's number and sets human-first call routing. |
| `TWILIO_AUTH_TOKEN` | console.twilio.com (Growth/Enterprise). Paired with the SID to purchase + configure the number. |
| `AIRTABLE_API_KEY` | airtable.com/create/tokens with `data.records:write` + `schema.bases:write` scopes on your workspace. |
| `AIRTABLE_WORKSPACE_ID` | airtable.com/{workspaceId}/api — copy the workspace ID from the URL (starts with `wsp`). |
| `GITHUB_TOKEN` | github.com/settings/tokens → fine-grained PAT with `repo` + `delete_repo` scopes on `GITHUB_ORG`. |
| `GITHUB_ORG` | The account/org that owns per-client repos (e.g. `xjuneau1`). Personal accounts work too. |
| `VERCEL_TOKEN` | vercel.com/account/tokens → create. Scope = the team that holds client projects. |
| `VERCEL_TEAM_ID` | vercel.com/{team}/~/settings → "Team ID" (only if using a team, not a personal account). |
| `MAKE_API_KEY` | make.com → Profile → API → create a token. Lets step 8c register the agent in the post-call Data Store. |
| `MAKE_DATA_STORE_ID` | make.com → Data stores → `retell-agent-lookup` → the numeric ID in the URL (see A4). |
| `RETELL_POST_CALL_WEBHOOK_URL` | The webhook URL of the `jdd-post-call-log` Make scenario (see A4). Used to wire agents to post-call logging. |

> **Twilio account credentials required (Growth/Enterprise).** `onboard.js` step 8 buys a
> **JDD-owned Twilio** number via the Twilio API, so you **do** need `TWILIO_ACCOUNT_SID` +
> `TWILIO_AUTH_TOKEN` in `.env`. The number's voiceUrl is pointed at `/api/voice` on the
> client site for human-first routing; it is stored in `.env.local` as `TWILIO_NUMBER` (also
> the Make scenario's `from_number`).
>
> **Inbound routing (do NOT use Retell SIP trunking / number import).** Calls hit `/api/voice`
> first, ring `CLIENT_FORWARD_PHONE` for `CLIENT_FORWARD_RING_SECONDS` (default 25), and on
> no-answer `/api/voice/no-answer` calls Retell `POST /v2/register-phone-call` and dials
> `<Sip>sip:{call_id}@{RETELL_SIP_DOMAIN}</Sip>` (default `sip.retellai.com`). The client
> `.env.local` therefore also carries `RETELL_API_KEY`, `CLIENT_FORWARD_RING_SECONDS`, and
> `RETELL_SIP_DOMAIN`. Importing the number into Retell or configuring a Retell SIP trunk
> bypasses `/api/voice` and breaks the human-first ring.

> **`TEMPLATE_REPO` is deprecated/unused.** `onboard.js` no longer clones a GitHub template.
> Leave it blank.

`npm install` once after the file is filled.

### A2. Install Vercel's GitHub App on `GITHUB_ORG`

Lets `onboard.js` step 9 create a Vercel project linked to the new client repo and
auto-deploy on push. Without this, project creation/link will 403.

1. Sign in to **vercel.com** with the account that owns the team holding client projects.
2. Top-left → confirm the right **team** is selected (matches `VERCEL_TEAM_ID` in `.env`).
3. Visit **https://vercel.com/integrations/github** → **Add Integration**. Pick the team
   that owns your `.env` `VERCEL_TOKEN`.
4. GitHub redirects you → **Install to `{GITHUB_ORG}`**.
5. **Repository access**: choose **All repositories** — new client repos must be auto-visible
   to Vercel. With "Only select repositories" you'd have to allowlist each new repo by hand.
6. **Install**. Verify: Vercel → **Add New… → Project** → repos under `{GITHUB_ORG}` appear.

### A3. Build the outbound lead-callback master Make scenario

> **DEPRECATED (no longer needed).** The lead callback is now placed **directly** by
> the site's `/api/contact` route (Retell `create-phone-call`), owned by onboard.js
> (`lib/site-routes/contact.route.ts`). There is no Make webhook, no per-client clone
> (Part D), and no `MAKE_WEBHOOK_URL`. Skip A3 and Part D. The shared **post-call
> logging** scenario + Data Store (A4) and inbound voice routing are unaffected.

Make.com is the orchestration glue: client lead form → Make webhook → Retell
`create-phone-call` → the agent dials the lead back. The master scenario is a template you
build **once**, then **clone per client** (each client has a different `from_number` and
`agent_id` baked into the HTTP module — see Part F-why at the bottom).

1. Sign up / sign in at **make.com**.
2. **Create a new scenario.**
3. Module 1: **Webhooks → Custom webhook** → **Add** (gets a unique URL — for the master,
   this URL is never used; clones get their own).
4. **Run once** with a test payload so Make learns the body shape. POST this to the webhook:
   ```json
   { "name": "Test Lead", "phone": "9075550142", "email": "", "type": "form", "brand": "test", "receivedAt": "2026-01-01T00:00:00Z" }
   ```
5. Module 2: **HTTP → Make a request**.
   - **URL**: `https://api.retellai.com/v2/create-phone-call`
   - **Method**: `POST`
   - **Headers**: `Authorization: Bearer <YOUR_RETELL_API_KEY>` (paste the real key in the
     master — clones inherit it) · `Content-Type: application/json`
   - **Body type**: Raw → JSON:
     ```json
     {
       "from_number": "<<<TWILIO_NUMBER>>>",
       "to_number": "{{1.phone}}",
       "override_agent_id": "<<<RETELL_AGENT_ID>>>"
     }
     ```
     Leave `<<<TWILIO_NUMBER>>>` and `<<<RETELL_AGENT_ID>>>` as literal placeholders in the
     master. The clone step (Part D) replaces them per client.
6. *(optional)* Module 3: **Email** or **Slack** lead summary wired to `{{1.name}}`,
   `{{1.phone}}`, `{{1.brand}}`.
7. **Save**, then **Deactivate** the master (it should never run — only clones do).

### A4. Build the shared post-call logging scenario + Data Store

This is the pipeline that fills each client's Airtable **Call Log** (which the client portal
reads). One **shared** scenario routes every agent's completed call to the right Airtable base
via a Data Store lookup — **no per-client cloning**.

```
Any Retell agent → call_ended webhook → Make: jdd-post-call-log
   → Data Store lookup: agent_id → base_id → Airtable: Create Record in {base_id}/Call Log
```

1. **Create a Data Store** — make.com → **Data stores** → **Create a data store**:
   - Name: `retell-agent-lookup`
   - Fields: `base_id` (text), `client_name` (text), `table_name` (text).
   - Copy its numeric ID from the URL into `.env` as `MAKE_DATA_STORE_ID`.
   - Onboarding adds one row per Growth/Enterprise client automatically (step 8c), keyed by
     the client's `RETELL_AGENT_ID`.
2. **Create the scenario** `jdd-post-call-log`:
   - Module 1: **Webhooks → Custom webhook** named `retell-post-call`. Copy its URL into
     `.env` as `RETELL_POST_CALL_WEBHOOK_URL`. **Run once** and POST a sample Retell
     `call_ended` payload so Make learns the schema (see `retell-post-call-airtable-plan.md`
     for a ready-to-paste payload).
   - Module 2: **Data store → Get a record** — store `retell-agent-lookup`, key `{{1.agent_id}}`.
   - Module 3: **Airtable → Create a Record** — Base ID `{{2.base_id}}`, Table `Call Log`,
     map Date / Caller name / Caller number / Summary / Duration / Call type / Outcome from
     the payload (see the plan doc for exact field expressions).
   - Add an **error handler → Resume** on Module 2 so an unknown `agent_id` doesn't halt it.
   - **Activate** the scenario.
3. **Wire each Retell agent to the webhook.** `onboard.js` does **not** yet set the agent's
   post-call webhook automatically, so for each agent: Retell dashboard → **Agents** →
   {agent} → **Settings** → **Post-call webhook URL** → paste `RETELL_POST_CALL_WEBHOOK_URL`
   → Save. (Do this at Part F / Checkpoint 3 for each new client.)

### A5. Client portal master setup (in the agency repo)

The client portal lives in `ops/juneau-digital-designs` (route `/portal`) and is configured
by **that** repo's `.env`, not this one. Do this once:

1. **Clerk** — create a Clerk application; set `CLERK_SECRET_KEY` +
   `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (and the sign-in URL vars) in the agency `.env` and on
   Vercel. The portal protects `/portal` and `/api/portal/*` via Clerk middleware.
2. **Vercel Web Analytics access** — the portal's Traffic tab reads each client's traffic via
   the Vercel Web Analytics API. Set `VERCEL_TOKEN` (a read-scoped access token) and, if the
   projects live under a team, `VERCEL_TEAM_ID` in the **agency** `.env` and on the portal's
   Vercel project. No per-client Google service account is needed.
3. **PageSpeed Insights API key** → `PAGESPEED_API_KEY` (still Google; one global key, powers the
   Performance tab).
4. **Upstash Redis** (cache + rate-limit) — provision via Vercel → Storage; confirm the env
   var names match what `portal-kv.ts` reads (`Redis.fromEnv()`).
5. **Airtable** — `AIRTABLE_API_KEY` (the same JDD key) so the portal can read each client's
   Call Log base.

---

## Part B — Build the client site (studio)

Compose the site from the prebuilt component catalog and export it into `clients/{slug}/repo`.

### Option 1 — Studio (drag-and-drop, recommended)

1. Start the console: `npm run console` (runs `console` on port 3040), then open the
   **Build** tab at `http://localhost:3040/build`.
2. In the studio, **name the client** (this is the `slug`), pick and order components (nav,
   hero, services, FAQ, contact, footer, SEO, …), and preview live.
3. Click **Export**. The studio copies `template/` → `clients/{slug}/repo`, installs the
   content schema, wires `page.tsx`, then runs `npm install && npm run build` to verify it
   compiles. On success you have `clients/{slug}/repo` ready to provision.

### Option 2 — Manual scaffold

```
npm run new-client -- --slug {slug}     # copies template/ → clients/{slug}/repo, scaffolds clients/{slug}/site.ts
# fill in clients/{slug}/site.ts (the INTAKE); drop catalog components; wire SLOTs in src/app/page.tsx
npm run hydrate -- --slug {slug}        # splice real content into the repo for an accurate preview
(cd clients/{slug}/repo && npm run dev) # preview
```

Either way you end with two files that drive provisioning:
- `clients/{slug}/site.ts` — the intake (`export const INTAKE` or legacy `CONTENT`). Source of truth.
- `clients/{slug}/repo/` — the local Next.js site (gitignored here; pushed to its own repo in step 8).

---

## Part C — Provision (onboard.js)

```
cd C:\Users\Xander\Desktop\ops\jdd-ops
npm run onboard -- --schema clients/{slug}/site.ts        # add --dry-run to preview with no side effects
```

`onboard.js` runs 9 steps, gated by the intake's `plan` (`starter` / `growth` / `enterprise`):

1. Load + validate the intake (and pre-flight credential check).
2. Create an **empty** GitHub repo under `{GITHUB_ORG}/{slug}` and point the local
   `clients/{slug}/repo` origin at it (no template clone).
3. Write `src/data/site.ts` into the local repo.
4. Write `clients/{slug}/.env.local` (idempotent — preserves already-provisioned IDs).
5. `npm install && npm run build` in the local repo.
6. **Starter stops here for voice.** Growth/Enterprise continue:
   6. Claude generates the Retell agent prompt → `clients/{slug}/agent-prompt.txt`.
   7. Create a **per-client Retell LLM** (cloning `RETELL_LLM_ID`'s model + tools,
      carrying this client's prompt) and an agent bound to it. The prompt lives on
      the LLM — `update-prompt` later edits the LLM, not the agent.
   8. **Provision a JDD-owned Twilio number** (local area code, else toll-free) and set its
      voiceUrl to `https://{slug}.vercel.app/api/voice` → stored as `TWILIO_NUMBER`; create the
      Airtable base (shared for Enterprise, with a per-site `Site` column); register the agent
      in the Make `retell-agent-lookup` Data Store (step 8c).
9. Commit + push the local repo (Vercel auto-deploys); sync env vars to the Vercel project.

For **Enterprise** (2–3 sites), steps repeat per site; sites share one Airtable base and the
master Retell minute pool, each with its own agent + number.

On completion `onboard.js` prints a handoff summary with repo URL, agent ID, number, and the
checkpoint next-steps.

- **Starter** → verify the lead email arrives after a test form submission; verify the
  deployed Vercel URL. (No voice agent, no Make scenario.)
- **Growth / Enterprise** → continue to Part D and Part E.

---

## Part D — Wire the lead-callback (per Growth/Enterprise site, Checkpoint 3)

> **DEPRECATED (no longer needed).** The lead callback is placed directly by the site's
> `/api/contact` route — no Make clone, no `MAKE_WEBHOOK_URL`, no `sync-env` step for it.
> onboard.js already writes the route and syncs `RETELL_API_KEY` / `TWILIO_NUMBER` /
> `RETELL_AGENT_ID` to Vercel. Skip this entire part. (Still do D8's post-call webhook
> check via A4 if you rely on Airtable call logging.)

For Enterprise, repeat **once per site** (`site-1`, `site-2`, …) — each gets its own clone.

### D1. Clone the outbound master scenario
Make dashboard → open the master → **"…" → Clone** → rename `Lead → Retell: <brand short>`
(Enterprise: `… — <site>`).

### D2. Grab the clone's webhook URL
Open the clone → **Webhook trigger** module → **Copy address to clipboard**.

### D3. Replace placeholders with the client's real values
From `clients/{slug}/.env.local` (Enterprise: `clients/{baseSlug}/site-N/.env.local`) read
`TWILIO_NUMBER` and `RETELL_AGENT_ID`. In the clone's **HTTP module** body, replace
`<<<TWILIO_NUMBER>>>` and `<<<RETELL_AGENT_ID>>>` with those real values.

### D4. Activate the clone
Toggle **Active** (bottom-left of the scenario editor).

### D5. Paste the webhook URL into `.env.local`
```
MAKE_WEBHOOK_URL=https://hook.us1.make.com/...your unique URL...
```

### D6. Push the env var to Vercel
```
npm run sync-env -- --slug {slug}          # Enterprise: --slug {baseSlug}/site-N
```

### D7. Redeploy
Push any commit to the client repo (Vercel auto-deploys), or Vercel → project → **Deployments**
→ "…" → **Redeploy**.

### D8. Post-call webhook + live test
- Ensure the agent's **Post-call webhook URL** is set (A4 step 3) so calls log to Airtable.
- Submit the lead form on the deployed site with your own phone number. The agent should call
  back within ~60s. If nothing in 90s, check: Vercel `/api/contact` logs (200 vs 500); Make
  clone **History** (webhook fired? Retell call succeeded?); Retell outbound call logs; then
  the `jdd-post-call-log` scenario History + the Airtable Call Log row.

---

## Part E — Set up the client portal (per client)

Gives the client a `/portal` login showing Traffic (Vercel Web Analytics), Calls (Airtable), and
Performance (PageSpeed). The portal reads everything from the client's **Clerk user metadata**.

### E1. Enable Web Analytics on the client's Vercel project
Vercel → the client's project → **Analytics → Enable Web Analytics**. The exported site already
renders `<Analytics />` from `@vercel/analytics` (in the template root layout), so once enabled
the project starts collecting page views + visitors automatically — no per-client Google setup,
no service-account grant. The Traffic tab stays empty until the site receives real visitors.

### E2. Create the client's Clerk user + metadata
`onboard.js` normally writes this automatically (including `vercelProjectId`). To do it by hand:
Clerk dashboard → **Users → Create user** for the client. Set **publicMetadata** to:
```json
{
  "slug": "{slug}",
  "name": "Client Brand Name",
  "plan": "growth",
  "canonical": "https://clientsite.com",
  "airtableBaseId": "appXXXXXXXXXXXXXX",
  "vercelProjectId": "prj_XXXXXXXXXXXXXXXX"
}
```
- `slug`, `name`, `plan`, `canonical` come from `clients/{slug}/site.ts`.
- `airtableBaseId` comes from `clients/{slug}/.env.local` (`AIRTABLE_BASE_ID`). **Starter:**
  set `airtableBaseId` to `null` (no call data).
- `vercelProjectId` is the project's `prj_…` id (Vercel → project → **Settings → General**).
  Leave `null` to hide the Traffic tab.
- **Enterprise:** add a `sites` array, one entry per site:
  ```json
  "sites": [
    { "slug": "{slug}-1", "name": "Site One", "canonical": "https://site1.com", "vercelProjectId": "prj_111" },
    { "slug": "{slug}-2", "name": "Site Two", "canonical": "https://site2.com", "vercelProjectId": "prj_222" }
  ]
  ```

### E3. Invite the client
Send them the `/portal/sign-in` link (or a Clerk invitation). Confirm the three tabs render
with real data.

---

## Part F — Why clone the outbound scenario per client (not one shared scenario)

The outbound HTTP module bakes in two per-client values:
- **Retell `agent_id`** — each client has their own agent/persona; the wrong ID routes the
  lead to the wrong voicebot.
- **`from_number`** — each client owns their own number; the wrong one shows the wrong
  caller-ID.

A shared router design (Data Store keyed on `brand`) is possible but adds a lookup
(latency + failure point), is harder to debug/disable per client, and moves per-client edits
into a data store. We deliberately use per-client clones for isolation until scale forces a
refactor (~30+ clients).

> Note the **post-call** scenario (Part A4) is the opposite choice — it *is* shared, because
> its routing key (`agent_id`) is already in the payload, so a Data Store lookup is natural.

---

## Part G — Cleanup of test resources

After running any `_e2e-*` fixture:
```
cd C:\Users\Xander\Desktop\ops\jdd-ops
npm run teardown -- --slug _e2e-{name}
```
Deletes: all GitHub repos for the cluster, all Vercel projects, all Retell agents (and their
provisioned numbers), the shared Airtable base, and the local `clients/{slug}/` folder.
Refuses unless the slug starts with `_e2e-`. **Real client teardown is intentionally not
scripted** — do it by hand so you can't accidentally delete a paying customer's infra.

Make scenarios and Clerk users are **not** deleted by teardown — remove an inactive clone, the
`retell-agent-lookup` row, and the Clerk user manually in their dashboards if needed.
