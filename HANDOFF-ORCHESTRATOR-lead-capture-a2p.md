# ORCHESTRATOR HANDOFF — portal lead capture, the two SMS lanes, and per-client A2P

**Date:** 2026-11-02
**Scope:** everything decided and built across the 2026-10-29 → 11-02 arc
**Repos:** `jdd-ops` (+ `console`), `juneau-digital-designs`, `jdd-schema`, `jdd-ui`
**Nothing is committed.** Both repos have large working trees. See §4 before any rebase or stash.

---

## 1. What this is for

This is the single entry point for the lead-capture / A2P workstream. Several agents have worked
in parallel and each produced its own plan; this file is the map of how they relate, what is
actually built, and what is still open. **Read this before dispatching work** — four of the
documents below supersede or correct each other, and two of them were written before decisions
that changed them.

If you only read one other thing, read `PLAN-portal-form-capture.md` — it carries the verification
pass and the integration surface.

---

## 2. The problem and the shape of the answer

**Starting point.** A Starter client's web form was delivered by Resend email. A lead existed only
as an HTML email — delete it and it was gone. No portal record, no Airtable row, nothing. Worse, on
Growth the form fired a Retell callback and persisted *nothing*: an unanswered callback produces no
`call_analyzed` event, so the Make scenario never runs, so no Airtable row is written, and the lead
evaporates silently.

**Three decisions resolved it.**

### 2a. Leads are recorded first, always, on every tier

`/api/contact` records the lead to the portal before anything else, then Growth/Enterprise
*additionally* place the Retell callback. The tier decides what happens **next**, not whether the
lead is kept. Product line: **"Starter tells you, Growth acts for you."**

### 2b. There are two SMS lanes, not one — this is the keystone idea

| Lane | Traffic | Campaign | Sender | Ready |
|---|---|---|---|---|
| **Account** | post-call briefs, new-lead alerts — JDD → the business owner | JDD's existing `ACCOUNT_NOTIFICATION` (approved) | a dedicated JDD notification number | **day one** |
| **Customer** | lead replies, review requests — the business → its own customer | the client's **own** `CUSTOMER_CARE` campaign | the client's provisioned number | day ~20, Growth/Ent only |

**The rule: who receives the message decides which campaign carries it.** Owner → JDD's. Customer →
theirs. This is what lets everything except two features ship on day one.

Two consequences people get wrong:
- Owner alerts must **not** come from the client's number. A campaign binds to a Messaging Service,
  so the client's number must stay free to join *their* service on day ~20. One dedicated JDD
  number ($1.90/mo agency-wide) resolves it.
- **The post-call brief is already broken for the next real client.** It sends from the client's
  number with `messaging_service_sid = NULL`, working today only because both existing numbers are
  e2e fixtures in JDD's own pool. A new client's number has no campaign association → `30034`.

### 2c. Per-client A2P brand + campaign (ISV), Low-Volume Standard

Each Growth/Enterprise client registers their own brand and campaign so their number sends as
*their* business rather than JDD fronting the traffic. Starter and web-only never send
customer-facing messages, so they **never register** and are complete on day one.

Cost: **$2/mo + $4 one-time per client**, not the $10/mo + $15 originally modelled — Low-Volume
Standard, not Standard. That makes the ISV path ~$1.80/mo more than the shared-campaign shortcut
per Growth client, which is why the compliance argument won easily.

Timeline: **13–20 business days** (3–5 brand + 10–15 campaign). Registration therefore **cannot**
be a blocking phase in `onboard.js`.

---

## 3. Document map — read this before dispatching

### Authoritative

| Document | Repo | Status |
|---|---|---|
| `PLAN-portal-form-capture.md` | jdd-ops | **Primary.** 13 locked decisions, verification pass, §1e cross-repo integration surface |
| `PLAN-console-a2p-registration.md` | jdd-ops | Operator-driven A2P chain in the console. Approved, no work started |
| `PLAN-portal-crm-v2-customers-messaging.md` | agency | CRM v2. **Built** — see §4 |
| `PLAN-public-tier-capability-copy.md` | agency | Public copy, 4 surfaces only. Approved pending wording sign-off |
| `PLAN-console-onboarding-copy.md` | jdd-ops | Console operator-facing copy. Drafted |
| `~/Desktop/JDD-a2p-isv-runbook.html` | — | The registration chain, verified endpoints, EIN handling |
| `~/Desktop/JDD-cost-analysis-2026-10-29.html` | — | Unit economics + the day-one capability matrix |

### Superseded or corrected — do not action as written

| Document | What happened |
|---|---|
| `HANDOFF-console-onboarding-a2p.md` **§6** | **Corrected** by `HANDOFF-a2p-sid-store-correction.md` (operator, 10-31). A2P SIDs live in Redis at `jdd:a2p-registration:{slug}`, **not** in `envFields.ts` / `.env.local`. The rest of that handoff stands. |
| `agency/HANDOFF-a2p-onboarding-identity-step.md` | **Superseded** by `PLAN-console-a2p-registration.md`. The client-driven wizard design is replaced by operator-driven. Commit `7175ecd` created four identity objects but never a brand or campaign — **no registration has ever been filed.** |
| `HANDOFF-tier-capability-copy.md` | Absorbed into `PLAN-public-tier-capability-copy.md`. Keep for rationale. |
| `HANDOFF-leadform-sms-consent.md` | Still valid; now also a driver for `PLAN-console-onboarding-copy.md` |
| `HANDOFF-retell-voice-consent.md` | Closes the `_(decide)_` I left open in form-capture §11 — consent basis for callers who *phoned* rather than filled a form |

---

## 4. Code state

**Branches:** `jdd-ops` → `feat/onboard-wizard-redesign`; `juneau-digital-designs` →
`feat/pricing-2026-10`. **Nothing committed.** Run `git status` first; do not rebase or stash
without asking — the entire CRM v2 feature and this work are both uncommitted.

**`@jdd/schema` is at v1.30.0 and all three consumers are pinned to it.** It already carries
`twilioNumber`, `messagingServiceSid`, `a2pStatus` (with `not-applicable` terminal),
`WebLead` + `zWebLead`, the `leads` / `crm` / `messaging` gates, and
`FEATURE_REQUIREMENT` as a `Partial<Record<…>>`. The schema work is **done** — do not re-cut it.

### Built and verified this session (lead capture, end to end)

Agency site:
- `app/lib/portal-leads.ts` **(new)** — `portal:lead:*` storage, token mint/register/resolve/revoke,
  `listLeads`/`getLead`/`markLeadRead`/`purgeLeads`. Validates on read via `zWebLead`, skipping
  malformed records rather than failing the Inbox.
- `app/api/ingest/lead/route.ts` **(new)** — per-client bearer token; **account resolved from the
  token, never from the body**; rate-limited after auth; honeypot; length caps; 503 on KV outage vs
  401 on bad token.
- `app/api/portal/inbox/route.ts` — leads wired into the seam CRM v2 left. Both sources degrade
  independently: no Airtable base → lead-only inbox; lead-store failure → call-only inbox.

jdd-ops:
- `lib/site-routes/contact.route.ts` — rewritten: record first, then dial. Forwards the **whole
  body**, so the consent object arrives with no further change here. Resend removed.
- `lib/client-env.js` — `LEAD_DELIVERY_MODE=portal`, `LEAD_CALLBACK=on|off`, token minted in the
  template (not deferred), `newIngestToken()`, both new keys added to `CARRIED_KEYS`.
- `lib/account-store.js` — `accountScope()`, `registerLeadIngestToken()`, `revokeLeadIngestToken()`.
- `onboard.js` — writes `twilioNumber`/`messagingServiceSid`/`a2pStatus` to `PortalSite`, registers
  the ingest token at portal-link time, Resend pre-flight replaced with a KV warning.
- `lib/onboard-checks.js` — `checkEnvTierMatrix` rewritten for the new contract; validates token
  format and ingest URL; rejects Resend leftovers.
- `lib/vercel-sync.js` — tier-independent ingest-key guard + `LEAD_CALLBACK` guard.
- `console/src/lib/envFields.ts` — `portal` option, `LEAD_CALLBACK`, `LEAD_INGEST_URL`;
  `LEAD_INGEST_TOKEN` + `CLIENT_MESSAGING_SERVICE_SID` in `LOCKED_KEYS`.
- `test/checks-env.test.mjs` updated; `test/lead-ingest.test.mjs` **(new)**.
- `.env.example` — Resend reframed as agency-only; `LEAD_INGEST_URL` documented.

### Verification (all re-run 2026-11-02)

| Check | Result |
|---|---|
| `npm test` (root) | **134 pass, 0 fail, 0 skip** |
| `cd console && npm test` | **399 pass, 0 fail, 0 skip** — phase contract fully exercised |
| agency `npm test` | 13 pass |
| agency `tsc --noEmit` | clean |
| console `tsc --noEmit` | clean |
| agency `npm run build` | compiles; `/api/ingest/lead` + `/api/portal/inbox` registered |
| `npm run fixtures:dry-run:check` | all current |

### Built by the CRM agent (do not rebuild)

`app/lib/portal-crm.ts`, `crm-contacts.ts` (`buildInbox`), `review-request.ts`,
`app/api/portal/{inbox,customers,messages,tasks}`, `InboxSection.tsx`,
`app/components/portal/crm/`, `app/api/webhooks/twilio-status`. The old `/api/portal/crm` route is
gone. **`crm-contacts.ts` was repurposed in v2 — do not import from it; take `normalizeE164` from
`app/lib/phone.ts`.**

### Built by the A2P agent

`lib/a2p-readiness.js` + `scripts/a2p-readiness.js` — `checkA2pReadiness`, `assertA2pReady`,
`listCustomerProfiles`, `listPolicies`, `readProfileBusinessInfo`.

---

## 5. ⚠️ One conflict I introduced — needs reconciling

My `onboard.js` change reads `CLIENT_MESSAGING_SERVICE_SID` from the client's **`.env.local`** to
populate `PortalSite.messagingServiceSid`, and I added it to `CARRIED_KEYS` and `LOCKED_KEYS`.

`HANDOFF-a2p-sid-store-correction.md` (decided after I wrote that) puts the registration chain's
SIDs in **Redis** at `jdd:a2p-registration:{slug}` instead.

**Nothing is broken right now** — no code populates `CLIENT_MESSAGING_SERVICE_SID` yet, so the field
resolves `null` either way and `siteFeature(site, 'messaging')` correctly reports not-ready. But the
source of truth must be settled before the A2P chain starts writing:

- **If the SID lives only in Redis:** `onboard.js` should read it from the A2P record, and the
  `.env.local` key plus its `CARRIED_KEYS`/`LOCKED_KEYS` entries should be dropped.
- **If it stays in `.env.local`:** the correction needs an explicit carve-out saying this one key is
  different, because the deployed client site genuinely does not need it — only the portal does.

My read: the Redis record is the better home, and `.env.local` should lose the key. Flagging rather
than deciding, since it is the A2P plan's call.

---

## 6. Outstanding work, in dependency order

### Do first — independent, and already broken
1. **Buy the JDD notification number** (Orlando 407/321/689, local only, never toll-free), add it to
   the **existing** master Messaging Service, read the pool back, leave `voiceUrl` unset, record as
   `TWILIO_NOTIFICATION_NUMBER`. Manual steps: `PLAN-portal-form-capture.md` §1c.
2. **Patch the master Make blueprint** — `From` = that number (a constant in every clone),
   `MessagingServiceSid` = master service. Run `npm run verify-post-call`. Without this the next
   real client's post-call brief `30034`s.
3. **Convert the primary Twilio profile to "ISV Reseller or Partner"** in Trust Hub. Minutes of
   work, blocks every per-client registration.

### Then
4. **A2P registration chain** — `PLAN-console-a2p-registration.md`. Build against `Mock=true`
   brands first; they register free and move through real status transitions.
5. **Resolve §5 above** before the chain writes any SID.
6. **Teardown sweep.** `lib/teardown-ops.js` knows nothing about TrustHub objects, Messaging
   Services, `portal:lead:*`, `portal:lead:token:v1:*`, `portal:crm:v2:*`, or the number-owner
   indexes. Two distinct problems: orphaned campaigns **bill $2/mo forever**, and —
   **this one is a correctness bug, not hygiene** — `portal:number-owner:v1:{e164}` and
   `portal:review:number-owner:v1:{e164}` have **no account scope in the key and no TTL**, while
   Twilio **recycles released numbers**. A released number reassigned elsewhere routes a stranger's
   inbound SMS into the former client's thread. This is live in shipped review-request code today.
   Fix in `releaseTwilioNumber()`: release the number and delete every index keyed by it in the same
   step, or do not release it.
7. **Reconcile probe inversion** — `lib/reconcile-probes.js:69/82` flags a live number *not* in the
   master pool as drift. Backwards now: a client number *in* the master pool is the drift.
8. **`planDowngrade.ts` Resend removal** — four live code paths at `:110`, `:112`, `:114-116`, `:149`
   (returns `resendKeySet`), plus whatever renders that preview.
9. **Owner SMS alert on a new lead** — Account lane, pinned to `TWILIO_NOTIFICATION_NUMBER`.
10. **LeadForm SMS consent** — `HANDOFF-leadform-sms-consent.md`. Separate agent.
11. **Public + console copy** — `PLAN-public-tier-capability-copy.md`, `PLAN-console-onboarding-copy.md`.
12. **Retell voice consent** — `HANDOFF-retell-voice-consent.md`.

---

## 7. Traps — each of these has already cost someone time

- **`LeadForm` exists in five places, one implementation.** Edit `~/Desktop/ops/jdd-ui/src/LeadForm.tsx`
  (HEAD = v1.2.0). **`jdd-ops/packages/ui/` is a stale second clone of the same repo at v1.1.0** with
  divergent content — both report `version: 1.2.0` in `package.json`. `template/src/lib/` and
  `console/src/lib/` are 5-line re-export shims. Consider deleting the stale clone.
- **Changes to `@jdd/ui` do not reach existing clients.** `copyTemplate` returns early when the repo
  exists and `overwrite` is false, and `package.json` is not template-owned, so even an overwrite
  export leaves the old pin. The two e2e fixtures are on `#v1.0.7` and `#v1.1.0`.
- **The phase contract silently skips in CI.** `test/fixtures/dry-run/*.log` is gitignored
  (`.gitignore:13` `*.log`) and untracked, and `phase-contract.test.mjs` calls `t.skip()` when a
  fixture is missing. It passed here only because fixtures were regenerated locally. On a fresh
  clone the contract is **not enforced** — which contradicts `CLAUDE.md`. Repo-policy decision:
  commit the recordings or rename them off `*.log`.
- **Adding a `log(N, …)` phase to `onboard.js` requires three files in one commit** —
  `onboard-parse.ts:110` (`PHASE_MAP`), `run-plan.ts:86` (`expectedPhases()`), and re-recorded
  fixtures. Also: check output must never contain `FAIL:` — `onboard-parse.ts` treats it as fatal,
  and "A2P not yet verified" is an **expected** three-week state.
- **`accountScope` is duplicated across repos and a mismatch fails silently.** `lib/account-store.js`
  and `app/lib/portal-kv.ts:82` must stay byte-identical: sha256 of the trimmed lowercased email,
  first 16 hex chars. A mismatch writes a valid record to a key nobody reads and every lead 401s.
  Pinned by `test/lead-ingest.test.mjs`.
- **`lib/vercel-sync.js:776` skips empty values.** That is exactly how Resend broke: key seeded
  empty → skipped → never reached Vercel → 502 on every lead, $0 cost, 100% loss. Never mint a
  required key with an empty fallback.
- **`EnvField` has no `readOnly` property.** Read-only is `LOCKED_KEYS`. An invented flag renders as
  editable.
- **Writing a `PortalSite` field unconditionally resets it on re-run.** `entry` is rebuilt every run,
  so `a2pStatus` must be carried forward or a verified client silently re-locks.
- Tailwind v4 scans from the git root: a markdown file containing `C:` + backslash + `Users` fails
  the build with "Invalid code point" blamed on `globals.css:1:1`. Use forward slashes in docs.

---

## 8. Open questions for the operator

1. **`CLIENT_MESSAGING_SERVICE_SID` source of truth** — §5 above.
2. **Phase-contract fixtures** — commit them or rename off `*.log`?
3. **Batch-bump existing clients' `@jdd/ui` pin** when the consent form lands? A live site collecting
   phone numbers with no disclosure is the thing that work exists to fix, but it is a
   redeploy-everything call.
4. **Consent basis for call-origin customers** — `HANDOFF-retell-voice-consent.md` proposes the
   answer; needs sign-off.
5. **Notice vs checkbox** for the form's SMS disclosure. Recommended: notice, with the hash as
   evidence.
6. **Delete `jdd-ops/packages/ui/`?** Stale duplicate clone of a published package, nested inside a
   consumer of it.

### Still unverified — treat as open, do not assume
- Whether one Twilio number can join two Messaging Services (docs silent; cheaply testable)
- `DELETE /trusthub/v1/EndUsers/{sid}` support
- Retell `retell_llm_dynamic_variables` parameter name
- Whether an unanswered Retell callback writes any Airtable row
- **Whether Vercel request logs can capture a POST body** — the EIN zero-retention design assumes
  not, and it is the only unverified assumption that design rests on
- Whether the existing A2P campaign bills $2 (Low-Volume) or $10 (Standard) — inferred from
  `brand_type: STANDARD` + a Standard use case, not read off an invoice

---

## 9. Measured vendor facts (2026-10-29, read-only probe)

Worth not re-discovering: brand `APPROVED` / `STANDARD` / `VERIFIED`; campaign `VERIFIED`, use case
**`ACCOUNT_NOTIFICATION`**, `has_embedded_links: false`, `tmobile.brand_tier: LOW`, AT&T 4 msg/sec.
Messaging Service has `inbound_request_url: (none)` and `use_inbound_webhook_on_number: true`, and
both pooled numbers have `sms_url` empty — **so inbound SMS reaches nothing today**, and setting the
service-level URL alone will not work while that flag is true. All 8 messages in the account have
`messaging_service_sid = NULL`; the four most recent are `delivered`, the four older ones `30034`.
Only two numbers exist, both e2e fixtures.

`has_embedded_links: false` is why the built review-request feature would be filtered the first time
it sent a review URL — every per-client campaign must register `true`.
