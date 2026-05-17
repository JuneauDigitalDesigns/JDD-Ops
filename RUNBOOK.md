# JDD Operations Runbook

Step-by-step setup for the JDD provisioning pipeline. Read this top-to-bottom
the first time. After that, jump to the "Per-client setup at Checkpoint 3"
section for each new Growth/Enterprise client.

---

## Part A — One-time setup (do this once, before your first paid client)

### A1. Fill in master credentials

```
cd C:\Users\Xander\Desktop\jdd-ops
cp .env.example .env
```

Open `.env` and fill in:

| Variable | Where to get it |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `RESEND_API_KEY` | resend.com → API Keys. Used by Starter sites for lead email delivery. |
| `RESEND_FROM_EMAIL` | A verified sender on a domain you control (e.g. `leads@juneaudigitaldesigns.com`). Reused across every Starter site. |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | console.twilio.com → top-right Account SID / Auth Token |
| `RETELL_API_KEY` | dashboard.retellai.com → API Keys |
| `RETELL_LLM_ID` | One Retell LLM created once; reused for every agent. dashboard.retellai.com → LLM → Create → copy ID. |
| `RETELL_DEFAULT_VOICE_ID` | dashboard.retellai.com → Voices → pick one → copy ID. |
| `AIRTABLE_API_KEY` | airtable.com/create/tokens with `data.records:write` + `schema.bases:write` scopes on your workspace. |
| `AIRTABLE_WORKSPACE_ID` | airtable.com/{workspaceId}/api — copy the workspace ID from the URL. |
| `GITHUB_TOKEN` | github.com/settings/tokens → fine-grained PAT with `repo` + `delete_repo` scopes on `xjuneau1`. |
| `GITHUB_ORG` | `xjuneau1` (or whichever org owns the per-client repos). |
| `VERCEL_TOKEN` | vercel.com/account/tokens → create. Scope = the team that holds client projects. |
| `VERCEL_TEAM_ID` | vercel.com/{team}/~/settings → "Team ID" (only if using a team, not a personal account). |
| `TEMPLATE_REPO` | `xjuneau1/business-site-template` (must already exist on GitHub — see A2). |

`npm install` once after the file is filled.

### A2. Push `business-site-template` to GitHub

The provisioning script clones from `TEMPLATE_REPO`. If the template is local-only,
step 2 of `onboard.js` will fail.

```
cd C:\Users\Xander\Desktop\business-site-template\business-template
gh repo create xjuneau1/business-site-template --private --source=. --push
```

If `gh` CLI isn't installed: create the repo on github.com manually, then:

```
git remote add origin https://github.com/xjuneau1/business-site-template.git
git push -u origin master
```

### A3. Install Vercel's GitHub App on `xjuneau1`

Lets `onboard.js` step 9 call `POST /v10/projects` with a `gitRepository`
field; Vercel auto-detects the repo and auto-deploys on push. Without this,
step 9 will 403 on project creation.

1. Sign in to **vercel.com** with the account that owns the team holding client projects.
2. In the top-left, click your **team name** → confirm the right team is selected. (Personal account is fine; `VERCEL_TEAM_ID` in `.env` reflects which scope.)
3. Visit **https://vercel.com/integrations/github** (or: top nav → **Integrations** → search "GitHub" → click it).
4. Click **Add Integration**. A modal asks which Vercel scope (team). Pick the team that owns your `.env` `VERCEL_TOKEN`.
5. GitHub redirects you. Pick **Install to `xjuneau1`**.
6. **Repository access**: choose **All repositories**. Important — new client repos must be auto-visible to Vercel. With "Only select repositories" you'd have to manually allowlist each one before provisioning.
7. Click **Install**. GitHub redirects back to Vercel.
8. **Verify**: in Vercel dashboard → **Add New… → Project** → repos under `xjuneau1` should appear in the picker.

### A4. Build the Master Make.com scenario

Make.com is the orchestration glue: client lead form → Make webhook → Retell
`create-phone-call` → Twilio dials the lead. The master scenario is a
template you build **once**, then clone per client. Cloning is necessary
because each client has a different Retell `agent_id` and Twilio
`from_number` — the HTTP module hardcodes both.

1. Sign up at **make.com** (free tier is enough to start).
2. Click **Create a new scenario**.
3. Add the first module: **Webhooks → Custom webhook**. Click **Add** to create the webhook (it'll get a unique URL — for the master, this URL is never used; clones get their own).
4. **Run once** with a test payload so Make learns the body structure. Click "Run once" then in another browser tab POST this JSON to the webhook URL with curl or Postman:
   ```json
   { "name": "Test Lead", "phone": "9075550142", "email": "", "type": "form", "brand": "test", "receivedAt": "2026-05-13T00:00:00Z" }
   ```
   Make will detect the schema and store it for later modules to reference.
5. Add the second module: **HTTP → Make a request**.
   - **URL**: `https://api.retellai.com/v2/create-phone-call`
   - **Method**: `POST`
   - **Headers**:
     - `Authorization: Bearer <YOUR_RETELL_API_KEY>` (paste your real key here in the master — clones inherit)
     - `Content-Type: application/json`
   - **Body type**: Raw → JSON
   - **Body**:
     ```json
     {
       "from_number": "<<<TWILIO_NUMBER>>>",
       "to_number": "{{1.phone}}",
       "override_agent_id": "<<<RETELL_AGENT_ID>>>"
     }
     ```
     Leave `<<<TWILIO_NUMBER>>>` and `<<<RETELL_AGENT_ID>>>` as literal placeholders in the master. The clone step replaces them with real values per client. `{{1.phone}}` references the phone field from module 1's payload — Make's UI lets you click-to-insert it.
6. *(optional)* Add a third module: **Email → Send an Email** or **Slack → Create a Message** with a lead summary. Useful to get a heads-up when a lead lands. Wire body fields to `{{1.name}}`, `{{1.phone}}`, `{{1.brand}}`.
7. **Save** the scenario.
8. **Deactivate** the master (toggle in the bottom-left, scenario editor). The master should never run — only clones do.

---

## Part B — Per-client setup at Checkpoint 3

After `npm run onboard -- --schema clients/{slug}/site.ts` completes
successfully and prints the handoff summary, do this for **every Growth or
Enterprise site**. (Skip for Starter — Starter uses Resend email, no Make
scenario needed.)

For Enterprise clients, repeat steps 1-7 **once per site** — each site (`site-1`,
`site-2`, optionally `site-3`) gets its own clone with its own webhook URL.

### B1. Clone the master Make scenario

1. In Make dashboard, open the master scenario.
2. Click **"…"** (top-right) → **Clone**.
3. Rename the clone: `Lead → Retell: <brand short>` (e.g. `Lead → Retell: Peak` for Growth, or `Lead → Retell: Peak — Anchorage` for an Enterprise site).

### B2. Grab the new webhook URL

1. Open the cloned scenario.
2. Click the **Webhook trigger** module (module 1).
3. Click **Copy address to clipboard** — this is the new client/site's unique webhook URL.

### B3. Replace placeholders with the client's real values

1. Open `clients/{slug}/.env.local` in your editor. For Enterprise, this is
   `clients/{baseSlug}/site-N/.env.local`. Note the values of:
   - `TWILIO_NUMBER` (e.g. `+19075551234`)
   - `RETELL_AGENT_ID` (e.g. `agent_abc123…`)
2. Back in Make, open the **HTTP module** in the clone.
3. In the body, replace `<<<TWILIO_NUMBER>>>` with the real Twilio number from `.env.local`.
4. Replace `<<<RETELL_AGENT_ID>>>` with the real `RETELL_AGENT_ID`.

### B4. Activate the cloned scenario

Toggle **Active** in the bottom-left of the scenario editor. The clone is now live and listening on its webhook URL.

### B5. Paste the webhook URL into the client's `.env.local`

Open `clients/{slug}/.env.local` (or `clients/{baseSlug}/site-N/.env.local`) and set:

```
MAKE_WEBHOOK_URL=https://hook.us1.make.com/...your unique URL...
```

### B6. Push the env var to Vercel

```
cd C:\Users\Xander\Desktop\jdd-ops
npm run sync-env -- --slug {slug}
```

For Enterprise sites, the slug includes the site folder: `--slug {baseSlug}/site-N`.

### B7. Trigger a redeploy on Vercel

Either:
- Push any commit to the client's GitHub repo (Vercel auto-deploys), or
- In the Vercel dashboard → the project → **Deployments** tab → "…" → **Redeploy**.

### B8. Live test

Submit the lead form on the deployed site with your own phone number. The
Retell agent should call your phone within 60 seconds with the brand's
greeting.

If nothing happens within 90 seconds, check:
1. Vercel function logs for `/api/contact` → did it 200 or 500?
2. Make scenario "History" tab → did the webhook fire? Did the Retell HTTP request succeed?
3. Retell dashboard → outbound call logs → was the call attempted? Any error?

---

## Part C — Why clone per client (not one shared scenario)

Each client has different values that get baked into the Make scenario:

- **Retell `agent_id`**: each client has their own Retell agent with their own
  persona, prompt, and brand greeting. Calling the wrong agent_id would route
  the lead to the wrong client's voicebot.
- **Twilio `from_number`**: each client owns their own Twilio number. Calling
  with the wrong from_number would show a different caller-ID to the lead.

Since the HTTP module's body is static JSON, these two values are hardcoded.
One scenario = one client/site.

**Could we use one shared scenario instead?** Yes — a router-based design
with a Make Data Store (or Airtable lookup) keyed on `brand` from the payload
could pull the right agent_id + from_number dynamically. Trade-offs:
- ✓ One scenario to maintain
- ✗ Adds a lookup step (latency + a failure point)
- ✗ Harder to debug per-client; harder to disable just one client
- ✗ Per-client changes require editing the data store, not the scenario

The PDF blueprint and current architecture deliberately chose per-client clones
for isolation. Sticking with clones until scale forces a refactor (~30+ clients).

---

## Part D — Cleanup of test resources

After running through any `_e2e-*` fixture:

```
cd C:\Users\Xander\Desktop\jdd-ops
npm run teardown -- --slug _e2e-{name}
```

This deletes:
- All GitHub repos for the cluster
- All Vercel projects
- All Retell agents (via DELETE /delete-agent/{id})
- All purchased Twilio numbers
- The shared Airtable base
- The local `clients/{slug}/` folder

Refuses to run unless the slug starts with `_e2e-`. **Real client teardown is
intentionally not scripted** — do it by hand so you can't accidentally
delete a paying customer's infrastructure.

Make scenarios are not deleted by teardown — do that manually in the Make
dashboard if needed (otherwise leaving an inactive clone around is harmless).
