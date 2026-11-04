# CLAUDE.md — jdd-ops context

Read this file completely before every session.

## What this repo is

The ops repo for Juneau Digital Designs. It holds master credentials, the
`onboard.js` provisioning orchestrator, and one subfolder per client under
`clients/{slug}/`. **Never deployed.** Each client gets its own GitHub repo
+ Vercel project, provisioned from `TEMPLATE_REPO` by `onboard.js`.

## The data model

Two files per client:
1. `clients/{slug}/site.ts` — the schema (brand, palette, hero, services, etc.).
   Exports `CONTENT` typed as `SiteContent`. This is the single source of truth.
2. `clients/{slug}/.env.local` — secrets only (`RETELL_AGENT_ID`, `RETELL_API_KEY`,
   `RETELL_SIP_DOMAIN`, `RETELL_LLM_ID`, `TWILIO_NUMBER`, `CLIENT_FORWARD_PHONE`,
   `MAKE_POST_CALL_HOOK_ID` + `MAKE_POST_CALL_SCENARIO_ID` (this client's own webhook and its
   clone — each recorded the instant it exists, so an interrupted run resumes instead of
   creating a second one),
   `CLIENT_FORWARD_RING_SECONDS`, `AIRTABLE_BASE_ID`, `VERCEL_PROJECT_NAME`).

## Plan tiers

Since the 2026-10-12 reprice, **every tier includes the AI receptionist.** Tiers differ by
capability, not by whether a receptionist exists. What now gates the voice stack is NOT the
plan but `intake.receptionistMode`: a Starter client who declined it is "web-only" and gets the
site alone. Everyone else gets the full stack.

| Plan       | Site(s) | Voice agent | Twilio number | Airtable base | Lead delivery |
|------------|---------|-------------|---------------|---------------|---------------|
| starter    | 1       | ✓           | ✓             | ✓ (1)         | Straight into the portal inbox (`LEAD_CALLBACK=off`) |
| growth     | 1       | ✓           | ✓             | ✓ (1)         | Agent calls the submitter back, then into the inbox (`LEAD_CALLBACK=on`) + CRM |
| enterprise | N (2–3) | ✓ per site  | ✓ per site    | ✓ (1 shared with `Site` column) | Same as growth, per site |
| *web-only* | 1       | —           | —             | —             | Straight into the portal inbox |

**Email is not a lead delivery mode.** `LEAD_DELIVERY_MODE` is `portal` on every tier,
always — every client's web-form leads land in that client's portal inbox. Resend is
agency-side transactional mail only. Anything describing a Starter lead email is pre-portal
and wrong.

**Web-only is not a plan.** It is `plan: "starter"` + `receptionistMode: "declined"`, priced
identically to Starter, offered only when a client refuses AI on their line. onboard.js gates
the voice stack on `isWebOnly` (from `@jdd/schema`), never on `plan === 'starter'`.

**Starter and Growth run the identical stack front to back** — number rings the owner, agent
picks up on no-answer, Make webhook fires, Airtable row is written, the agency texts the owner
that a lead is waiting (if they have opted in). Three things differ, and only three:

1. **Web-form behaviour.** Starter drops the submission straight into the portal inbox.
   Growth has the agent call the submitter back, collect details, and put *that* in the
   inbox. This is `LEAD_CALLBACK=on|off`, the one provisioning difference in `.env.local`.
2. **CRM access.** Growth and Enterprise only; gated portal-side on `PortalSite.plan`.
3. **Included minutes.** `MinuteCaps` is keyed by plan.

A growth → starter downgrade is therefore **non-destructive**: it keeps the number, the
agent and the LLM, flips `LEAD_CALLBACK` to `off`, and lets the plan field carry the CRM gate
and the allowance. It used to release the number and delete the agent, which was correct
before the 2026-10-12 reprice and silently became a way to strip a paying client afterwards.

**The receptionist mode must be stated, never inferred.** onboard.js refuses to run without it
(the intake carries it, or pass `--receptionist forwarded|published|declined`), because the
wrong guess either buys a number for a client who declined or withholds one a client paid for.

Enterprise sites share the master Retell account's minute pool; Starter and Growth are metered
per site (100 and 350 minutes). Per-site Twilio numbers route inbound calls through `/api/voice`
(human-first) then to per-site Retell agents on no-answer.

Master env prerequisites for provisioning any client with a receptionist (every tier except
web-only): `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` (in addition to `RETELL_API_KEY`,
`ANTHROPIC_API_KEY`, etc.).

## Hard rules — never break these

- The schema file is `src/data/site.ts` inside each client repo (NOT `site.js`).
- Each client's secrets live in `clients/{slug}/.env.local` only.
- Never commit `.env` or any `clients/*/.env.local` (see `.gitignore`).
- When schema fields are missing or unknown, populate `_meta.missingFields` —
  **never invent values**.
- Never modify `TEMPLATE_REPO`'s main branch from a client session.
- After every code change in a client repo, run `npm run build` and fix all errors.
- Never expose `RETELL_API_KEY`, `TWILIO_AUTH_TOKEN`, `AIRTABLE_API_KEY`, or any
  master credential in client-side code.
- Never import `next/font/google` anywhere: not in `template/`, a catalog component, or the
  console. A build must not touch the network for fonts: next/font/google downloads every
  declared family on every build, and Next 14.2 crashes on the ~5% of Google responses whose
  file URL has no extension, or the download simply fails (the console's own build did, on
  2026-11-04, after the #16 patch for the first case). Everything loads committed woff2 files
  via `next/font/local`, vendored by `scripts/vendor-fonts.js`: the pairing families in
  `template/src/lib/fonts/` (the console's pairing loader points at those same files) and the
  console's chrome fonts in `console/src/app/fonts/`. onboard.js writes the template's loader
  and files into every client repo on every run (`lib/site-fonts.js`), which is how repos
  copied before the fix get it. `test/template-fonts.test.mjs` enforces all of it.

## How components in client repos consume the schema

```ts
import { CONTENT } from '@/data/site'
const { brand, hero, services } = CONTENT
```

Tailwind colors come from the palette via inline CSS variables wired in
`src/components/VariationD.tsx`:
```tsx
<div style={{ '--accent': brand.palette.accent }} className="bg-[var(--accent)]">
```

## Twilio ownership

JDD owns all numbers via the master Twilio account (`TWILIO_ACCOUNT_SID` /
`TWILIO_AUTH_TOKEN`). Clients have no Twilio access. Number costs ~$2/mo,
bundled into the client fee.

**Numbers are LOCAL only — never toll-free.** A toll-free number can't join the
A2P 10DLC Messaging Service, so its texts fail with 30034 until a separate
Toll-Free Verification clears. `provisionTwilioNumber` searches geography-first
(business-address ZIP → brand-phone area code → `TWILIO_DEFAULT_AREA_CODES`,
default `407,321,689` → `TWILIO_DEFAULT_REGION`, default `FL`) and hard-fails if
no local number is available rather than buying toll-free. Expanding to new
regions is an env edit.

**A2P SMS — two lanes. Who receives a message decides which campaign carries it.**

- **Account lane** — to the business owner: post-call briefs, new-lead alerts. Rides JDD's own
  approved `ACCOUNT_NOTIFICATION` campaign, sent from one dedicated number,
  `TWILIO_NOTIFICATION_NUMBER`, which sits in the `TWILIO_MESSAGING_SERVICE_SID` pool with its
  voiceUrl deliberately unset. **The agency sends every account-lane text**: new-lead alerts and,
  since 2026-11-03, the post-call brief. So the notification number lives in the agency's env,
  and its `sendSms` refuses to send without it. onboard.js no longer checks it, because nothing
  in a clone sends SMS any more. For a client with SMS consent, pre-flight still hard-fails when
  the service SID is unset or the campaign isn't approved (`usAppToPersonRegistered`).
- **Customer lane** — to the owner's customers: portal replies, review requests. Each
  Growth/Enterprise client's own `CUSTOMER_CARE` campaign and number, registered per client
  through the console's A2P chain. 13–20 business days of carrier review per client; not live.

**A client's number must never send account-lane traffic.** A campaign binds to a Messaging
Service and a number sits in exactly one, so a client number used for owner alerts is stranded
in JDD's service and can never join the client's own campaign. Make can't break this any more:
clones carry no Twilio module, and the agency's `sendSms` pins the account lane's `From` to
`TWILIO_NOTIFICATION_NUMBER`. `checkOwnerBriefViaAgency` replaced `checkAccountLaneSender`, which
checked the `from` that onboard.js used to stamp onto each clone's Twilio module.

**Pool membership is what associates a number with a campaign — not naming the service in the
API call.** The account's history shows one number going `30034` → `delivered` when the campaign
was approved, with `messaging_service_sid` null on every message before and after. So `30034`
means "this number is not associated with an approved campaign", not "the call omitted the
service SID". This file used to imply the latter.

**Transitional, and the reconcile probe still reflects the old design.** onboard.js still adds
each client number to the master pool and reads it back, and the reconcile engine still flags a
live client number that is *not* in the master pool. Under the two-lane design that is backwards
— a client number *in* the master pool is the drift — but flipping it needs each client's own
Messaging Service SID to compare against, which the A2P chain hasn't produced yet
(`HANDOFF-ORCHESTRATOR-lead-capture-a2p.md` §6 items 5 and 7). Until then the flag is correct for
how onboard.js actually provisions. Don't "fix" it ahead of those.

**The owner's end-of-call brief is sent by the agency, not by Make.** Each clone's last module
is an `http:MakeRequest` that POSTs the call (form-encoded `call_id`, `caller_name`,
`caller_priority`, `caller_number`, `airtable_record_id`) to `https://www.juneaudigitaldesigns.com/api/ingest/call`
with `Authorization: Bearer <this site's LEAD_INGEST_TOKEN>`. The agency resolves the account
from the token, reads the owner's SMS consent **at send time** (the portal's `sms:consent:*`),
texts once per Retell `call_id`, and sends on the account lane from its own
`TWILIO_NOTIFICATION_NUMBER`.

It used to be a Twilio module in each clone, with `to`, `from` and whether to text at all
stamped in by `patchPostCallBlueprint` at onboarding and never re-read. Owner opt-in moved to the
portal and never reached Make: on 2026-11-03 the growth fixture's clone had no Twilio module,
and a completed callback briefed nobody. So `patchPostCallBlueprint` now replaces the master's
`Bearer REPLACE_PER_CLIENT` placeholder with the site's token, drops any Twilio module (a
leftover one double-texts under stale consent), and drops the HTTP module if the site has no
token. `checkOwnerBriefViaAgency` enforces the shape: no Twilio, one POST to `www`
`/api/ingest/call` (the apex 307s and loses the header), form-encoded, carrying `call_id`, with
"evaluate all states as errors" OFF (repeated errors deactivate the scenario and stop the call
log too), and this site's token. The token is a credential: it is written into the clone and
never printed by onboard.js, the checks, or the verifier.

The master's HTTP module was built in the Make UI and recorded, never written from memory: an
`http:MakeRequest` saved with nothing filled in has no `mapper` at all, and one first saved
with `method: "get"`, which the agency's route would have refused. If you rebuild it, re-record
it with `npm run fixtures:refresh`.

**`airtable_record_id` is `{{8.id}}`**, the row the Airtable module just wrote, picked in Make's
mapping panel and recorded (2026-11-03). It is the portal's id for a call (`InboxItem.id`), so
the owner's text can link to it. Retell's `call_id` is stored nowhere the portal can search: no
column holds it, and the recording URL is an unrelated hash. `checkOwnerBriefViaAgency` requires
the field to name THIS scenario's Airtable module. Clone module ids survive cloning, so a clone's
`8` is its own row.

**A master edit never reaches an existing clone**, because a clone is a copy taken at onboarding.
`npm run repatch-post-call -- --slug <slug>` (add `--site site-N` for an enterprise site) brings
one clone up to the current master:
- It keeps the clone's own webhook trigger (`parameters.hook`). Copying the master wholesale would
  bind the clone to the master's hook.
- It rebuilds everything after the trigger through the real `patchPostCallBlueprint`.
- It **previews unless `--write`**, runs every blueprint check first and refuses on any failure.
- Before writing, it saves the old blueprint beside the client's `.env.local`. That file contains
  the token, so it stays local.
- It reads back and re-checks, and leaves the clone's on/off state as it was.

**The site must advertise the Twilio number, not the owner's.** Two numbers with two jobs:

| Value | Holds | Job |
|---|---|---|
| `brand.phone` / `brand.phoneHref` in `src/data/site.ts` | the JDD Twilio number | what the website shows and what customers dial |
| `CLIENT_FORWARD_PHONE` in `.env.local` | the owner's real line | where `/api/voice` forwards on hop 1 |

`applyTwilioNumberToSite` performs the swap after the number is purchased and before the
commit, gated on `!isWebOnly` — **not on plan.** A Starter client with a receptionist owns a
number and must publish it exactly like Growth. Until this existed the deployed site kept the
intake number, so every real caller dialed the owner directly and bypassed `/api/voice`
entirely: no human-first forward, no Retell fallback, no Airtable row. The receptionist worked
and was simply never reached — a failure with no error anywhere to find.

Order is load-bearing: `writeClientEnvLocal` runs *before* the swap so it captures the owner's
number as the forward target. Mutate `brand.phone` any earlier and `CLIENT_FORWARD_PHONE`
becomes the Twilio number — `/api/voice` then forwards to the number that invoked it.

**Inbound call routing (two-hop):**
1. Caller dials the Twilio number → Twilio POSTs to `/api/voice` on the client site
2. `/api/voice` normalizes `CLIENT_FORWARD_PHONE` (brand's real phone) to E.164 and
   dials it with a timeout of `CLIENT_FORWARD_RING_SECONDS` (default 15s). The
   forward leg sets `callerId=TWILIO_NUMBER` so it originates from the JDD-owned
   number (arbitrary customer caller IDs get rejected by carriers/STIR-SHAKEN —
   Twilio 13224). **Keep this below ~20s:** if the forward rings long enough for the
   owner's carrier voicemail to answer, Twilio scores that as answered
   (`DialCallStatus=completed`), the no-answer branch never fires, and the caller
   lands in voicemail instead of the Retell agent. Owners whose voicemail picks up
   earlier than ~15s can still race it — the one case a short window can't cover.

   **This is now enforced, not just documented.** `lib/client-env.js` owns
   `RING_SECONDS_DEFAULT = 15` / `MIN = 5` / `MAX = 20`, and `/api/voice` clamps whatever it is
   handed rather than applying it verbatim — env reaches production by routes other than the
   console UI. Two copies of those numbers are unavoidable and pinned equal by
   `test/ring-window.test.mjs`: `console/src/lib/envFields.ts` (bundled by Next, so it cannot
   import from the ops root) and `lib/site-routes/voice.route.ts` (written verbatim into client
   repos, which have no `@jdd/schema` dependency — the same standalone-copy exception that
   package documents for its own inline `toE164`).

   The rule used to live only in prose, and the prose disagreed: RUNBOOK.md said "default 25",
   which propagated into the console's plan-upgrade route and into the Environment field (max
   60, placeholder 25). Any client upgraded to Growth through `/manage` would have inherited a
   ring window that can route callers past the receptionist. The ring-window test therefore
   asserts the **docs** too — prose that can silently steer behaviour is part of the behaviour.

   Note the clamp ships in route code, which only gets rewritten by an `onboard.js` run —
   `npm run sync-env` pushes env, not routes. Until a client is re-run, the UI cap is its only
   protection.
3. If answered: normal call, done
4. If no-answer / busy / failed: `/api/voice/no-answer` calls Retell's
   `POST https://api.retellai.com/v2/register-phone-call` API (Bearer
   `RETELL_API_KEY`, body `{ agent_id, direction: "inbound", from_number,
   to_number }`) → gets back `call_id` → returns
   `<Dial><Sip>sip:{call_id}@{RETELL_SIP_DOMAIN}</Sip></Dial>` TwiML
   (`RETELL_SIP_DOMAIN` default `sip.retellai.com`) → Twilio
   connects the call to the Retell AI agent over SIP (no bridge server needed;
   the SIP leg must be dialed within 5 min of register-phone-call).

The `voiceUrl` is set at number-purchase time to `https://{vercelHost}.vercel.app/api/voice`,
where `vercelHost` is `vercelAppHost(siteSlug)` from `@jdd/schema`.

**Vercel REMOVES characters that aren't valid in a DNS label; it does not substitute
hyphens.** `e2e_test_growth` serves at `e2etestgrowth.vercel.app`, not
`e2e-test-growth.vercel.app`. This file previously documented the rule as
`.replace(/_/g, '-')`, and three call sites implemented it that way — which pointed the
voiceUrl of any underscore-containing slug at a hostname that does not resolve. Inbound
calls then fail with nothing surfacing on our side: the number looks configured and the
agent looks healthy. Never re-derive this transform inline; import it.

The derivation is best-effort — Vercel appends a hash on collision or overlong labels — so
anything that can ask the API should prefer `listProjectDomains`. `vercelAppHost` exists for
the window before the project is created, which is exactly when the number is bought. The
reconcile engine re-checks the number against the host Vercel actually reports.

Vercel keeps `.vercel.app` URLs live permanently, so no update is needed after a custom domain is assigned.

## Retell agent

One agent per client, each backed by its **own per-client Retell LLM**. JDD owns
the Retell account. Prompt is Claude-generated from the intake schema, saved to
`clients/{slug}/agent-prompt.txt` for review before upload. Agent qualifies leads,
answers FAQs from intake, defers prices to owner, never invents facts.

**The prompt lives on the LLM, not the agent.** For a `retell-llm` response
engine, `general_prompt` passed to `create-agent`/`update-agent` is ignored — so
onboard.js creates a per-client LLM (cloning `RETELL_LLM_ID`'s model+tools) with
the prompt and binds the agent to it; the per-client LLM id is saved as
`RETELL_LLM_ID` in the client `.env.local`. `npm run update-prompt -- --slug {slug}` edits that
LLM (`update-retell-llm`: prompt + the fixed `begin_message` recording disclosure) **and** the
agent's `post_call_analysis_data` in one command, so a prompt that asks for SMS consent never
runs on an agent with no field to record it. It refuses a prompt missing the approved consent
ask; `--prompt-only` keeps the old prompt-alone behaviour. It also **refuses an agent bound to
the master LLM**, because the push would rewrite every client's template. And it takes the spoken
business name from `agent_name` unless you pass `--business`: pass it whenever the agent's name
isn't the business (the growth fixture's agent was called "Master Agent").

**Changes to the consent wording don't reach existing clients by themselves.** onboard.js keeps
the prompt on disk once an agent exists. `npm run regenerate-prompt -- --slug <slug>` writes a
fresh one through the real generator (saving the old file beside it, local only), and
`update-prompt` then pushes it. `npm run verify-agents` is the read-only guard: for every client
agent, `checkLiveAgentSetup` reads the agent and the LLM it is **actually bound to**, and fails it
if any of these are missing:
- its own LLM (not the master);
- the recording disclosure as `begin_message`;
- the approved ask in the prompt;
- an `sms_consent` field;
- the voicemail hang-up.

Found 2026-11-04 when both test agents failed every one, and the growth agent was on the master
LLM. Retell refused to re-point it ("Cannot update response engine after agent versions have been
created"), so it was replaced by a new agent bound to its own LLM. onboard.js now refuses to adopt
or bind the master as a client's own LLM. A dry run reports the exact LLM and agent a new client
gets, built by the same `clientLlmCreateBody` / `clientAgentCreateBody` the real run sends.

**Every agent hangs up on voicemail** (`voicemail_option: { action: { type: "hangup" } }`, an
*agent* field, `VOICEMAIL_OPTION` in `lib/voice-consent.js`). onboard.js sets it at creation and
`update-prompt` pushes it to existing client agents **first and on its own**: with
`--prompt-only`, with `--voicemail-only` (the safety setting alone), and even when the prompt
lacks the consent ask and the run refuses. A safety setting must not wait on prompt regeneration.
An API-created agent has voicemail detection OFF
unless the field is set; the dashboard's hang-up default doesn't apply. On 2026-11-03 the growth
fixture's agent spent 48 s talking to an unanswered lead's voicemail.

**Live calls use the agent's latest draft.** The fixture agent is `is_published: false` at
version 9, and its calls ran on version 9. So `update-agent` / `update-retell-llm` take effect
with no publish step.

Note: Retell blocks changing an agent's
`response_engine` once it has multiple versions — re-point at provision time, not
after.

## Airtable

Base name: `{brand.name} — Calls`
Table: `Call Log`
Fields: Date, Caller name, Caller number, Summary, Duration (seconds),
Call type, Email, Address, Recording URL, Priority, SMS consent, Outcome
(+ `Site` for enterprise). The list lives once, in `lib/call-log-fields.js`; `onboard.js` and
`lib/repair-ops.js` both import it. Never copy it — the repair copy once drifted to 7 columns.

**`SMS consent` is the caller's spoken answer to the closing SMS question** —
`custom_analysis_data.sms_consent`, `granted`/`declined`/`unknown`, lowercase. `unknown` blocks
and `declined` is sticky. The wording, the opening recording disclosure and the analysis schema
all live in `lib/voice-consent.js`, word-for-word as the operator approved them (the disclosure
and schema on 2026-11-02; the current consent ask on 2026-11-04);
don't reword them without sign-off. Every `custom_analysis_data.*` the master reads must be
extracted by the agent (`checkAnalysisCoversBlueprint`): Email, Address and Priority were blank
on every call until that was true. The master's mapping for this column was a deliberate,
approved edit (2026-11-02), not provisioning drift.

**This column list is a contract with the Make master scenario, not a preference.** Step 8c
remaps the cloned blueprint's Airtable module by **column name** (master field id → name →
client field id), because Airtable table and field ids are *base-scoped* — the master's
`tbl…`/`fld…` mean nothing in a freshly created client base. A column the master writes but
`createAirtableBase` doesn't create is silently dropped from every logged call. Run
`npm run verify-post-call` after touching either side; it diffs them against the live master
and runs the real `patchPostCallBlueprint`.

**A base created before a column existed doesn't gain it by itself** (e.g. `SMS consent` on bases
older than 2026-11-02, which also makes `airtable.schemaCovers` refuse an onboard re-run).
`npm run repair-call-log -- --slug <slug>` previews which `CALL_LOG_FIELDS` columns the table lacks;
`--write` adds them exactly as onboard.js would and reads back. It is additive only: an existing
column is never retyped, since Airtable's API can't edit a select's choices anyway. The console
shows the same thing as the `airtable.missingColumns` finding, with an "Add …" button.

Two gotchas worth keeping:

- **`Call type` and `Priority` choices are lowercase on purpose.** The master maps
  `{{1.call.direction}}` straight in, Retell emits `inbound`/`outbound`, and the module runs
  with `typecast: false` — so prettier labels like `Inbound` / `Outbound callback` are
  rejected as an invalid option and fail the **whole row**, not just that cell. `Priority` is
  `emergency`/`callback` for the same reason.
- **Never map an analysis field into a singleSelect bare.** Retell returns `""` for a field it
  could not fill, and Airtable rejects `""` as a new option ("Insufficient permissions to
  create new select option") — the whole row is lost and Make deactivates the scenario, so
  later calls queue behind it. On 2026-11-03 this ate a completed Growth callback. `Priority`
  and `SMS consent` are mapped through total `if()` expressions (`SELECT_MAPPINGS` in
  `lib/voice-consent.js`) that fall back to `callback` / `unknown`;
  `checkSelectMappingsTotal` enforces it in the dry run, the suite and `verify-post-call`.
- **Nothing writes `Outcome`.** The master has no mapping for it; it exists for the owner to
  set by hand while triaging, which is why it keeps human-cased labels.

The per-client clone also **drops the master's `datastore:GetRecord` module**, a leftover of
the superseded one-shared-scenario design that looked the Airtable base up per agent. Each
clone hardcodes its own base, and no datastore record is ever written for a new agent — a
GetRecord miss emits no bundle and halts the route before Airtable runs. Its `{{1.event}} =
call_analyzed` filter is carried forward onto the next module, or the clone would log a row
for `call_started` and `call_ended` too: three rows per call, two of them empty.

## Vercel env sync (step 9 / `sync-env`)

After step 8 commits and pushes the client repo, step 9 pushes env vars from
`clients/{slug}/.env.local` to the client's Vercel project so the deployed
`/api/contact` route has what it needs. For Growth/Enterprise the lead callback
is placed **directly** by `/api/contact` (Retell `create-phone-call`), so the
synced vars that matter are `RETELL_API_KEY`, `TWILIO_NUMBER`, and
`RETELL_AGENT_ID` (all written by onboard.js). No Make webhook is involved.

Prerequisites (one-time setup):
- `VERCEL_TOKEN` set in `.env`
- `VERCEL_TEAM_ID` set in `.env` (if using a Vercel team)
- The GitHub-Vercel integration is authorized at the org level (so Vercel
  auto-detects new client repos). If a project doesn't exist when sync runs,
  step 9 creates it programmatically linked to `GITHUB_ORG/{slug}`.

If you edit `clients/{slug}/.env.local` after provisioning, re-sync and redeploy:

```
npm run sync-env -- --slug {slug}
```

Or use the console: **`/manage` → Environment** does the whole loop in the UI — see below.

## The console `/manage` route

A client-first control panel. `/manage` lists every client that has a `.env.local`, with
last-deploy state and an HTTP probe of the live site; opening one gives a rail + stage
shell at `/manage/{slug}/{section}` (enterprise site selection rides on `?site=`).

| Section | What it does |
|---|---|
| Overview | Health tiles (deploy, domain attached+verified, env drift) + recent activity |
| Environment | Edit `.env.local` → push to Vercel → redeploy |
| Deployments | Last 10 builds, redeploy |
| Voice agent | Edit `agent-prompt.txt`, push to the client's Retell LLM (any client with a receptionist, i.e. every tier except web-only) |
| Portal | Which account the client signs in with; attach/repair |

Things worth knowing:

- **Env drift is never automatic.** Resolving it costs one Vercel request *per key*
  (`listProjectEnv`), so it is an explicit button on the roster and on Overview, and is
  scoped to the viewed site via `?site=`.
- Curated fields are grouped Call routing / Lead delivery / Integrations; web-only clients
  (declined receptionist) only have the middle one, and empty groups hide themselves. A
  Starter client WITH a receptionist now has all three, like Growth.
- Master credentials are masked, with reveal-on-click via `/api/manage/env/reveal` (one
  named key, disk only — localhost-only assumption; delete that route first if the console
  is ever deployed). `VERCEL_PROJECT_NAME` / `CLERK_USER_ID` / `RETELL_LLM_ID` are
  read-only, since onboard.js owns them.
- Changing `AIRTABLE_BASE_ID` also updates the portal account record, which stores its own
  copy.
- **Every write is appended to `console/.state/audit.ndjson`** (key names, never values)
  and shown as Recent activity. This is the only accountability the console has — it still
  has no auth of any kind.
- The voice-agent editor reads `agent-prompt.txt` from disk. There is no read-back from
  Retell, so it can lag a change made in the Retell dashboard; the UI says so.

## Lead capture (every tier)

The final-CTA form POSTs to `/api/contact`. `LEAD_DELIVERY_MODE` is `portal` on every tier; the
only tier difference here is `LEAD_CALLBACK`:

1. **If `LEAD_CALLBACK=on`** (Growth/Enterprise), the route normalizes the phone to E.164 and calls
   `POST https://api.retellai.com/v2/create-phone-call` (Bearer `RETELL_API_KEY`, body
   `{ from_number: TWILIO_NUMBER, to_number, override_agent_id: RETELL_AGENT_ID,
   agent_override: { retell_llm: { begin_message: <outbound opening line> } },
   retell_llm_dynamic_variables: { lead_name } }`) so the agent dials the lead back, opening with
   the approved recording disclosure and identity check.
2. **If that callback was placed, the submission is NOT recorded.** The lead reaches the portal
   only through the completed call.
3. **Otherwise** (Starter, web-only, a callback Retell refused, no dialable number), the whole
   posted body goes to `LEAD_INGEST_URL` with the per-client bearer `LEAD_INGEST_TOKEN`, so fields
   like the form's `consent` object arrive with no further change here, and the owner is texted
   at once. The route returns 502 only when that write fails: nothing happened, so the form shows
   the phone number as a fallback.

**An unanswered callback is a lost lead (operator decision, 2026-11-03).** It must produce no
after-call run and nothing in the client's portal. Both halves enforce it:

- **The route** doesn't record a placed callback, so the form submission never becomes a portal
  lead by itself.
- **The post-call scenario's trigger filter** lets an outbound call through only when it actually
  connected to a person. Retell still sends `call_analyzed` for a call that never connected, so
  the filter, not Retell, has to stop it. Inbound and other calls pass as before. The rejected
  cases, as Retell reports them:
  - `call_status: "not_connected"` with `dial_no_answer` / `dial_busy` / `dial_failed`;
  - `disconnection_reason: "voicemail_reached"` / `"ivr_reached"`;
  - **voicemail as it really shows up on these agents:** `call_status: "ended"` with an ordinary
    `agent_hangup` / `user_hangup` and `call_analysis.in_voicemail: true`. Voicemail detection is
    off, so `voicemail_reached` has never appeared on this account. A filter on
    `disconnection_reason` alone lets voicemail through.

  **Voicemail counts as unanswered.** The filter (master module 2, carried onto each clone's
  Airtable module) was built in the Make UI and recorded. It has two OR groups: anything not
  `outbound` passes as before, and an `outbound` call passes only if `ended`, `in_voicemail` ≠
  `true`, and the reason isn't `voicemail_reached` / `ivr_reached`. `checkConnectedCallsOnly`
  *evaluates* it the way Make does against `lib/call-outcomes.js`. Those cases are this account's
  real outcomes (`test/fixtures/retell/call-outcomes.json`, captured by `fixtures:refresh`) plus
  Retell's documented never-connected ones, and a newly recorded outcome with no case fails the
  suite.

**Why this replaced "always record".** Recording every submission was itself a fix. The route
before it placed the callback and persisted nothing, so a callback Retell refused lost the lead
without a trace. That case is still recorded. But "always record" put an answered callback in the
portal twice (form, then call) and left an unanswered one in the inbox as a "new lead" nobody had
spoken to.

What the rule gives up: a lead who doesn't pick up is gone. So is the web form's `consent`
object, which only travels with a recorded submission, and so is a call Retell accepts and then
fails to place (an `error`-status call, such as a telephony-provider failure).

Resend is agency-side transactional mail only; anything describing a Starter lead email is
pre-portal and wrong.

**The `/api/contact`, `/api/voice`, and `/api/voice/no-answer` route code is owned by onboard.js**
(`lib/site-routes/*.ts`) and written into the repo on every run — it is not sourced
from `template/` or the client repo.

## Never wire a client to a master resource

A client must own its Airtable base and its own clone of the post-call Make scenario. Sharing
a master resource does not look broken — it looks like a working client whose calls land in
someone else's log.

`_e2e_test_growth` had exactly this: `AIRTABLE_BASE_ID` set to the master base, and its Retell
agent's `webhook_url` pointing at the **master scenario's own hook**. So the one client that
existed to prove the pipeline ran entirely through the master and never once exercised
`cloneAndWirePostCall`. Five bugs in that function shipped behind it. The fixture was proving
the master works, which was never the question.

`verifyNoMasterResources` now refuses at pre-flight — before the Twilio purchase, the agent,
the base and the clone — if any site's `AIRTABLE_BASE_ID` is the master base or its
`RETELL_POST_CALL_WEBHOOK_URL` is the master's hook. Both are fatal because the corresponding
create step short-circuits on an existing value and would reuse the master rather than replace
it.

A **live agent** pointing at the master hook is only a warning: when no webhook is recorded
yet, the run will clone the master and re-point the agent at that clone, so refusing would
block the very run that fixes it. The agent is read live because the env file can be silent
while the agent is wired — which is precisely how the e2e fixture hid.

**The master scenario is never modified by a run.** `cloneAndWirePostCall` GETs the blueprint,
clones, and patches *the copy*; cloning stays byte-exact. `npm run fixtures:refresh` reporting
`make/master-blueprint.json` and `make/scenario.json` unchanged after a run is the proof.
Deliberate, operator-approved edits do happen. Each one is re-recorded and committed with its
reason, so its diff never looks like drift. So far: the SMS consent mapping, the total select
mappings, and replacing the Twilio module with the agency HTTP module (2026-11-02 / 03).

**A webhook-triggered scenario cannot be cloned without supplying a new hook.** Make tries to
attach the clone to the master's hook, which already belongs to the master, and refuses with
`{"detail":"The hook already has a scenario assigned.","code":"IM000"}`. So step 8c creates a
`gateway-webhook` first and passes `hook: { <masterHookId>: <newHookId> }` in the clone body.
The new hook mirrors the master's `method`/`headers`/`stringify` (all false) because those
decide the payload shape every `{{1.call.…}}` mapping reads from.

**Legacy hooks to be aware of.** The team holds five webhooks with no scenario attached, from
the superseded shared-scenario design. One is still referenced: `retell-post-call` (hook
`2333518`) appears in the root `.env.local` as a global `RETELL_POST_CALL_WEBHOOK_URL` — which
Next.js auto-loads for the console — and in `RUNBOOK.md`'s manual setup steps. Nothing is
listening on it, so anything posting there goes nowhere. Per-client webhooks come from the
clone now; that global is dead config, not a fallback.

## Testing

**Hard rule: any change to `onboard.js` or `lib/` keeps `npm test` green.** The suite exists
because seven bugs shipped in the provisioning path and *not one of them produced an error* —
the number looked configured, the agent looked healthy, and the call log was simply empty.

```
npm test                      # root suite — onboard.js + lib/, hermetic, ~1s
npm run fixtures:refresh      # re-capture vendor payloads; drift shows up as a git diff
npm run fixtures:dry-run      # re-record dry-run output for the phase contract
cd console && npm test        # console suite (includes the phase contract)
```

### One predicate module, two callers

`lib/onboard-checks.js` holds the correctness predicates. Both the test suite and
`onboard.js --dry-run` import *the same functions*:

```
lib/onboard-checks.js    ← the single implementation
  ├── test/*.test.mjs        runs them against recorded fixtures   (CI + pre-commit)
  └── onboard.js --dry-run   runs them against THIS client         (operator + console UI)
```

A dry run therefore answers **"would this provision correctly?"**, not just "would it run".
If the dry run had its own copy of the rules it could bless a client the suite would reject —
the same mistake as a mocked test certifying a 404.

`ok` is `true | false | null`. **`null` means "could not check"** (no credentials, nothing
provisioned yet) and is never a pass. CI has no secrets, so the vendor-facing checks degrade
to `null` there and run fully on a machine that has them.

### Why fixtures are recorded, never hand-written

Four of the seven bugs were wrong *beliefs about vendor APIs*. A hand-written fixture encodes
the belief, so the test certifies the bug — a mock returning `{hooks:[{url}]}` would have made
the `/scenarios/{id}/hooks` test pass forever while production 404s. Only a recorded response
can contradict us. `scripts/refresh-fixtures.js` re-captures them read-only and scrubs the
real call data Make stores in the blueprint (recording URLs, call SID, phone numbers).

The Airtable side is checked differently and deliberately: `CALL_LOG_FIELDS` — the spec
onboard.js sends to create-base — is compared against a recorded read of the live master. That
proves what the *next* client base will look like, where a captured client base would only
prove what one historical base looked like.

### The phase contract

`console/test/phase-contract.test.mjs` replays recorded dry-run stdout for all four client
shapes through the real parser and asserts the phases match `expectedPhases()`. This is the
guard `run-plan.ts`'s header asks for, automated. Add or reorder a `log()` call in onboard.js
without updating `PHASE_MAP` and `expectedPhases()` and it fails.

**`test/fixtures/dry-run/*.log` is tracked on purpose** — `.gitignore` carries an explicit
negation for it, and `.gitattributes` pins it to LF. For a while `*.log` swallowed those files,
and the cost was not that the contract broke but that it quietly stopped existing: every
assertion in the test is guarded by `t.skip()` on a missing fixture, so it reported a clean pass
having checked nothing. A missing recording now fails rather than skips, and the recorder says
MISSING rather than blaming `onboard.js` for drift.

**`npm run fixtures:dry-run:check` is a LOCAL guard, not a CI one.** Regenerating a dry run
needs `.env`: without it `resolveMasterResources()` cannot run, the whole step-11 Make block is
absent from the output, and the check summary drops from "3 passed, 1 failed, 6 not checked" to
"2 passed, 1 failed, 7 not checked". CI has no secrets by design, so a recording made here can
never match one regenerated there — the step failed every run regardless of the code, and has
been removed from the workflow. Run it yourself before committing a change to `onboard.js`'s
`log()` calls. What CI enforces is the *replay*: `phase-contract.test.mjs` parses the committed
recordings, which needs no credentials.

Check output must never contain the token `FAIL:` — `onboard-parse.ts` treats any line
carrying it as a fatal run, which would abort the UI's narration over a soft finding.

### Conventions (inherited from `console/test/`)

- `node:test` + `node:assert/strict`, files named `*.test.mjs`. No test framework, and the
  root suite needs no devDependencies at all — root code is plain ESM, so no `tsx`.
- **Import real implementations, never mocks.**
- **Every test encodes a bug that actually shipped**, not a hypothetical edge case.
- A regression test that cannot fail is decoration. When adding one, break the fix and watch
  it go red before you trust it.

## When uncertain

- Schema field is null or in `_meta.missingFields` → flag, do not invent.
- Build error can't be fixed in 2 attempts → stop, report exact error.
- Asked to violate hard rules → refuse, explain why.
- Schema conflicts with task prompt → schema wins.
