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
   `RETELL_SIP_DOMAIN`, `TWILIO_NUMBER`, `CLIENT_FORWARD_PHONE`,
   `CLIENT_FORWARD_RING_SECONDS`, `AIRTABLE_BASE_ID`, `VERCEL_PROJECT_NAME`).

## Plan tiers

The intake schema's top-level `plan` field gates which provisioning steps run.

| Plan       | Site(s) | Voice agent | Twilio number | Airtable base | Lead delivery |
|------------|---------|-------------|---------------|---------------|---------------|
| starter    | 1       | —           | —             | —             | Resend email to `brand.email` |
| growth     | 1       | ✓           | ✓             | ✓ (1)         | Site `/api/contact` → Retell `create-phone-call` |
| enterprise | N (2–3) | ✓ per site  | ✓ per site    | ✓ (1 shared with `Site` column) | Site `/api/contact` → Retell `create-phone-call` |

Enterprise sites share the master Retell account's minute pool. Per-site
Twilio numbers route inbound calls through `/api/voice` (human-first) then to
per-site Retell agents on no-answer.

Master env prerequisites for Growth/Enterprise provisioning: `TWILIO_ACCOUNT_SID`,
`TWILIO_AUTH_TOKEN` (in addition to `RETELL_API_KEY`, `ANTHROPIC_API_KEY`, etc.).

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

**Inbound call routing (two-hop):**
1. Caller dials the Twilio number → Twilio POSTs to `/api/voice` on the client site
2. `/api/voice` normalizes `CLIENT_FORWARD_PHONE` (brand's real phone) to E.164 and
   dials it with a timeout of `CLIENT_FORWARD_RING_SECONDS` (default 25s). The
   forward leg sets `callerId=TWILIO_NUMBER` so it originates from the JDD-owned
   number (arbitrary customer caller IDs get rejected by carriers/STIR-SHAKEN —
   Twilio 13224)
3. If answered: normal call, done
4. If no-answer / busy / failed: `/api/voice/no-answer` calls Retell's
   `POST https://api.retellai.com/v2/register-phone-call` API (Bearer
   `RETELL_API_KEY`, body `{ agent_id, direction: "inbound", from_number,
   to_number }`) → gets back `call_id` → returns
   `<Dial><Sip>sip:{call_id}@{RETELL_SIP_DOMAIN}</Sip></Dial>` TwiML
   (`RETELL_SIP_DOMAIN` default `sip.retellai.com`) → Twilio
   connects the call to the Retell AI agent over SIP (no bridge server needed;
   the SIP leg must be dialed within 5 min of register-phone-call).

The `voiceUrl` is set at number-purchase time to `https://{vercelHost}.vercel.app/api/voice`, where `vercelHost` is `sanitizeProjectName(siteSlug).replace(/_/g, '-')` — underscores are not valid in DNS hostnames and Vercel renders them as hyphens anyway.
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
`RETELL_LLM_ID` in the client `.env.local`. `npm run update-prompt` edits that LLM
(`update-retell-llm`), not the agent. Note: Retell blocks changing an agent's
`response_engine` once it has multiple versions — re-point at provision time, not
after.

## Airtable

Base name: `{brand.name} — Calls`
Table: `Call Log`
Fields: Date, Caller name, Caller number, Summary, Duration (seconds),
Call type, Outcome.

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

## Lead callback (Growth/Enterprise)

The final-CTA form POSTs `{name, phone}` to `/api/contact`. With
`LEAD_DELIVERY_MODE=callback`, the route normalizes the phone to E.164 and calls
`POST https://api.retellai.com/v2/create-phone-call` (Bearer `RETELL_API_KEY`,
body `{ from_number: TWILIO_NUMBER, to_number, override_agent_id: RETELL_AGENT_ID }`)
so the Retell agent dials the lead back. Starter uses `LEAD_DELIVERY_MODE=email`
(Resend): the route sends the owner a formatted HTML lead email (subject/heading
personalized via `LEAD_BRAND_NAME`, a labeled field table built from all posted form
fields, `reply_to` set to the lead's email when present) and returns HTTP 502 if the
Resend send fails rather than silently reporting success. **The `/api/contact`,
`/api/voice`, and `/api/voice/no-answer` route code is owned by onboard.js**
(`lib/site-routes/*.ts`) and written into the repo on every run — it is not sourced
from `template/` or the client repo.

## When uncertain

- Schema field is null or in `_meta.missingFields` → flag, do not invent.
- Build error can't be fixed in 2 attempts → stop, report exact error.
- Asked to violate hard rules → refuse, explain why.
- Schema conflicts with task prompt → schema wins.
