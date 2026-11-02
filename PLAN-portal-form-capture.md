# PLAN — Web-form capture into the client portal

**Status:** drafted 2026-10-29, not started
**Repos touched:** `jdd-ops` (contact route, onboard.js, env), `jdd-schema` (site fields + feature gate),
`juneau-digital-designs` (ingest endpoint, portal Leads surface)
**Related:**
`juneau-digital-designs/PLAN-portal-crm-review-sms.md` — the CRM board this feeds (built, uncommitted) ·
`~/Desktop/JDD-a2p-isv-runbook.html` — per-client A2P registration + EIN handling, the prerequisite for
any customer-facing SMS ·
`~/Desktop/JDD-cost-analysis-2026-10-29.html` — unit economics, incl. this feature's SMS cost

**Last revised:** 2026-10-29, after the ISV / Low-Volume-Standard decision and the EIN
zero-retention requirement. Decisions 10–11 and §1b are from that round.

---

## Verification pass — 2026-10-29

Every code claim below was read against the working tree, not recalled. Line anchors are from that
read; **re-verify before relying on a number**, since any edit above it shifts it.

**Four corrections made as a result** — all were assertions that sounded right and were not:

| Was claimed | Actually true | Fixed in |
|---|---|---|
| `/api/contact` "already forwards the whole body" | It makes **two** outbound calls (Retell `:93`, Resend `:114`) and has **no onward POST**. The forward is new code | §4, §11 banner |
| `leadId` is a ULID | **`ulid` is not a dependency** (nor `nanoid`/`uuid`). Use `crypto.randomUUID()` | §3 |
| `LEAD_DELIVERY_MODE=portal` "check whether it validates" | It is **actively rejected** — `envFields.ts:134` declares `options: ['email','callback']` and `:271-272` enforces it | §1e |
| `planDowngrade.ts` "documents the Resend hazard" | It has **four** Resend code paths (`:110`, `:112`, `:114-116`, `:149`), not a comment | §1e |

**Two breakages found that no section had accounted for:**

- `lib/onboard-checks.js:96` `checkEnvTierMatrix({ lines, plan, webOnly })` asserts the env file
  matches the tier, and is imported by both `npm test` and `--dry-run`. Changing
  `LEAD_DELIVERY_MODE` breaks the suite and every dry run.
- `lib/client-env.js:110` `CARRIED_KEYS` — a key written later in the run and absent from the
  template is **silently dropped on re-run**. Decides where `LEAD_INGEST_TOKEN` must be minted.

**One thing found that saves work:** `lib/repair-ops.js:34` `setTwilioWebhook({…, field, url })`
already parameterises the webhook field, so it can set `smsUrl` as easily as `voiceUrl`.

### Confirmed to exist as described

| Symbol | Location |
|---|---|
| `normalizeE164`, `formatUsPhone` | `juneau-digital-designs/app/lib/phone.ts:17`, `:38` |
| `getPortalRatelimit()` | `app/lib/portal-kv.ts:221` |
| `resolvePortalRequest()` | `app/lib/portal-account.ts:56` |
| `consentRequestContext(req)` | `app/lib/sms-consent.ts:106` |
| `canSendReview()` / `ReviewBlockReason` | `app/lib/review-request.ts:57` / `:49` |
| `recordReviewSend()` writing the un-TTL'd number-owner index | `app/lib/portal-crm.ts` |
| `DRAFT_TTL_SECONDS` = 30 days, no expiry hook | `app/lib/onboarding-draft-store.ts:13`, `:42` |
| `buildClientEnvLines()`, `RING_SECONDS_DEFAULT = 15` | `lib/client-env.js:67`, `:49` |
| `syncVercelEnv` callback-required keys / skip-empty | `lib/vercel-sync.js:762-763` / `:775-776` |
| `PHASE_MAP` / `expectedPhases()` | `console/src/lib/onboard-parse.ts:110` / `run-plan.ts:86` |
| `TWILIO_MESSAGING_SERVICE_SID` readers | `onboard.js:1277`, `:2674-2681`, `:2881-2889`; `lib/reconcile-probes.js:82`; `console/src/lib/goLive/preflight.ts:108`, `go-live-content.ts:257`, `opsSecrets.ts:237`, `runbook-content.ts:561` |
| `onboard.js` emits **10** numbered phases | `log(N, …)` at `:507` → `:3084` |

### Not verified — treat as open

- Whether one Twilio number can join two Messaging Services (§1a) — docs silent, testable
- `DELETE /trusthub/v1/EndUsers/{sid}` support (§1b)
- Retell `retell_llm_dynamic_variables` parameter name (§2)
- Whether an unanswered Retell callback writes any Airtable row (§9)
- Whether Vercel request logs can capture a POST body (§9) — the EIN design assumes not

---

## 0. What this replaces and why

Today a Starter client's web form is delivered by **Resend email** to `brand.email`
(`LEAD_DELIVERY_MODE=email`). That is the whole delivery mechanism: a lead arrives as an HTML
email and lives nowhere else. If the owner deletes it, the lead is gone — there is no record in
the portal, no record in Airtable, nothing.

`lib/site-routes/contact.route.ts` is also where the August cost analysis found a $0-cost,
100%-loss bug: `onboard.js` seeds `RESEND_API_KEY` with `keep('RESEND_API_KEY')`, which is empty
on a new client, and `lib/vercel-sync.js` skips empty values — so the key never reached Vercel and
the route 502'd on every lead until set by hand. **Dropping Resend deletes that failure mode
rather than fixing it.**

### Locked decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Storage | **Upstash KV**, new `portal:lead:*` namespace. Not Airtable — writing there from a client site would need `AIRTABLE_API_KEY` in a client repo, which the hard rules forbid |
| 2 | Starter + Web-only | Form **captured into the portal**. Readable list: name, phone, message, timestamp |
| 3 | Growth + Enterprise | Form continues to fire the **Retell callback** (`create-phone-call`), which already lands in Airtable → portal call log → CRM board |
| 4 | Starter capability ceiling | **No two-way messaging, no pipeline board.** "Starter tells you, Growth acts for you" |
| 5 | Resend | **Removed entirely** from the lead path |
| 6 | Ingest auth | **Per-client token**, never a shared global secret |
| 7 | Owner notification | SMS alert to the owner via the existing `ACCOUNT_NOTIFICATION` campaign |
| 8 | `/api/contact` behaviour | **Always record the lead to the portal first**, on every tier, *then* fire the callback for Growth/Enterprise. Accepted 2026-10-29 — rationale in §1 |
| 9 | Day-one capability | Everything except customer-facing SMS ships on day one, including the post-call owner brief. Only lead-reply and review texting wait on the client's own A2P campaign (§1a) |
| 10 | A2P architecture | **Per-client brand + campaign (ISV)**, registered **Low-Volume Standard**. JDD does not front client traffic. Growth/Enterprise only — see §1b |
| 11 | EIN handling | **Zero retention.** Submit-and-consume in a single request; never written to KV, disk, logs, `site.ts` or the audit log. See §1b |
| 12 | Portal UI ownership | **Not in this plan.** Ends at `portal-leads.ts` + `GET /api/portal/leads`; the CRM v2 Inbox is the consumer. See §12 |
| 13 | Gates | **Three**, not two: `leads` (all tiers), `crm` (live + growth/ent, **not** `airtableBaseId`), `messaging` (`crm` + `a2pStatus === "verified"`). See §5 |

---

## 1. Why `/api/contact` always records — accepted

Decision 3 taken literally — Growth/Enterprise forms *only* fire the callback — has a hole:

**A failed callback leaves no trace.** `create-phone-call` can fail (invalid number, Retell
error, rate limit) and the route returns 502. Even when it succeeds, a lead who does not answer
produces a Retell call with no `call_analyzed` event, so the Make scenario never fires and **no
Airtable row is written**. The lead vanishes. Today Starter at least had an email; under decision
3, Growth would have nothing.

**Resolution (accepted):** `/api/contact` **always records the lead to the portal first**, then
additionally fires the callback for Growth/Enterprise. The ingest call is one HTTP POST that
already has to exist for Starter, so this is nearly free, and it means:

- A failed or unanswered callback still leaves a lead the owner can see and act on
- The form's **message field survives** (the callback path discards it — see §2)
- One code path for all tiers; the tier only decides *what happens next*, not whether the lead
  is recorded
- The CRM board can reconcile a form submission with the callback that followed it, because both
  carry the same E.164

This does not change the product story. Growth still "acts for you" — the receptionist still
calls the lead back within a minute. It just stops a dropped callback from being a lost customer.

---

## 1a. Day-one capability — two SMS lanes, not one

**The requirement:** a client gets as much working infrastructure as possible on day one. The
post-call SMS brief already works through JDD's approved brand and must keep working for every
day-one client. Only the client's *own* brand and campaign may take up to 20 business days, and
only Growth/Enterprise need one at all.

That resolves cleanly once you stop treating "SMS" as one thing. There are two lanes with
different senders, different campaigns and different readiness dates:

| Lane | Direction | Campaign | Sender | Ready |
|---|---|---|---|---|
| **Account** | JDD → the business owner | JDD's existing `ACCOUNT_NOTIFICATION` (approved) | a JDD-owned number | **Day one** |
| **Customer** | the business → its own customer | the client's own `CUSTOMER_CARE` (per-client, ISV) | the client's provisioned number | Day ~20, Growth/Ent only |

Post-call briefs and new-lead alerts are **Account lane**. Lead replies and review requests are
**Customer lane**. Nothing in the Account lane depends on the client's registration, so it all
ships day one.

### The sender has to change for this to hold

Today the post-call brief sends from the client's provisioned number with
`messaging_service_sid = NULL`. For a brand-new client that number has no campaign association,
so expect `30034` — it works today only because the two existing numbers are e2e fixtures living
in JDD's own pool.

There is also a structural collision. A campaign binds to a Messaging Service, so the client's
own campaign requires the client's number in the *client's* service — while the Account lane
would want that same number in JDD's service.

_(verify)_ **Whether one number can sit in two Messaging Services at once.** Twilio's public docs
do not state it either way; the sender-pool article implies a move rather than a duplicate
("removed from one service before being assigned to another"). This is cheaply testable against
the existing fixtures before anyone relies on it.

**The design sidesteps the question entirely:** owner alerts should never come from the client's
number. They are JDD→owner traffic, and sending them from the owner's *own business number* is
odd on its face — the owner receives a text from themselves. Use one dedicated JDD notification
number in JDD's existing Messaging Service, pinned explicitly via `sendSms({ from })`, which
already supports it.

This is better regardless of how the two-service question resolves:

- Works day one for every tier, including web-only, with no registration dependency
- One consistent sender the owner can save as a contact, identical across all their sites
- Leaves the client's number free to join the client's own service on day 20 with no contention
- Keeps each lane inside the campaign whose registered use case actually describes it — which is
  the entire point of the ISV migration, applied in both directions

Cost is one extra local number for the whole agency: **$1.90/mo**, not per client.

### What has to change in the Make scenario

The cloned post-call scenario's Twilio module currently sends from the client's number and
bypasses the Messaging Service. Two edits:

1. Set `From` to the JDD notification number — a **constant**, identical in every clone, so it
   becomes one less thing `patchPostCallBlueprint` has to remap per client.
2. Pass `MessagingServiceSid` = JDD's shared service, so the brief sends *through* the approved
   campaign instead of around it. This also makes Advanced Opt-Out apply to briefs, which it
   does not today.

Best done in the master blueprint so every future clone inherits it. `CLAUDE.md`'s rule is that
cloning must stay byte-exact and the master is never modified *by a run* — a deliberate edit is
fine, and `npm run verify-post-call` exists precisely to check it.

### Day-one matrix

| Capability | Web-only | Starter | Growth / Enterprise |
|---|---|---|---|
| Site + web form | day 1 | day 1 | day 1 |
| Portal lead capture | day 1 | day 1 | day 1 |
| Inbound calls, human-first forward, receptionist | — | day 1 | day 1 |
| Airtable call log → portal call log | — | day 1 | day 1 |
| Post-call SMS brief to owner | — | day 1 | day 1 |
| New-lead SMS alert to owner | day 1 | day 1 | day 1 |
| CRM pipeline board | — | — | day 1 |
| Retell lead callback | — | — | day 1 |
| **Lead-reply texting** | never (by design) | never (by design) | **day ~20** |
| **Review-request SMS** | never (by design) | never (by design) | **day ~20** |

Two rows wait. Everything else is day one. **Starter and Web-only are complete on day one** and
never need a per-client brand, because they never send a customer-facing message — so ISV
registration runs for Growth and Enterprise only.

> **Public copy deliberately diverges from this table.** "Day ~20" is a planning estimate and it
> stays one. Nothing client-facing prints a number: the site, the `/sms-terms` disclosure and the
> portal all say customer messaging activates *once the carriers approve your business
> registration*, with no timeframe attached. The delay is the carriers' to grant, not ours to
> promise, and a Growth client who was quoted three weeks and waited five has a complaint whether
> or not we were at fault. So this table is internal: do not transcribe it into copy.
>
> One further gap worth knowing when reading the matrix as a status report: the two waiting rows
> are not waiting on carrier approval *alone*. Lead-reply texting is unbuilt, and review sending
> still routes through the Account-lane Messaging Service (see §1d) rather than the client's own.
> That is why `schedules.ts` describes neither capability — a contract bullet conditioned only on
> carrier approval would be met while the feature still did not work. See
> `juneau-digital-designs/PLAN-public-tier-capability-copy.md` §0 and its addendum §6.

### What the portal must say during the wait

Growth clients will see the CRM board on day one with reply and review actions disabled for about
three weeks. That has to read as progress, not breakage. Reuse the `siteFeature` vocabulary rather
than a bare disabled state — this is exactly the `pending-build` / `connecting` distinction, and
the lesson there was that one undifferentiated `false` told Growth clients they hadn't paid for
something they had. Suggested copy: *"Texting your customers turns on once the carriers approve
your business registration — usually about two more weeks. Calls and leads are unaffected."*

---

## 1b. Prerequisites owned by the A2P runbook

Full flow, endpoints and failure modes live in **`JDD-a2p-isv-runbook.html`**. Kept there rather
than copied here, because two descriptions of a nine-call registration chain will drift and the
runbook is the one with verified endpoints. What follows is only the part that touches *this* work.

### The architecture, settled

Per-client brand + campaign, registered **Low-Volume Standard** — explicitly intended for ISVs
and small businesses with an EIN sending under ~6,000 segments/day. A Growth client at full
minutes sends roughly 600 segments a *month*.

| | Cost | Notes |
|---|---|---|
| Per-client campaign | **$2/mo** | Growth/Enterprise only. Was modelled at $10 (Standard tier) — corrected |
| Per-client registration | **$4 one-time** | LVS brand + campaign; `SkipAutomaticSecVet=true`, no paid vetting |
| JDD notification number | **$1.90/mo** | Agency-wide, not per client. The Account-lane sender (§1a) |
| JDD `ACCOUNT_NOTIFICATION` campaign | $10/mo | Unchanged. Already approved, correct for what it carries |

Net effect: the ISV path costs a Growth client **~$1.80/mo more** than the shared-campaign
shortcut, because the per-client campaign adds $2 while agency overhead drops. The compliance
argument wins and the cost argument stops mattering.

**No Twilio subaccounts required** — Secondary Customer Profiles live on the existing account, so
the single-account architecture survives. But **one Messaging Service per client** is unavoidable,
since a campaign binds to a service. That makes `TWILIO_MESSAGING_SERVICE_SID` a per-client value
where it is currently a master one, which is why it has to land on `PortalSite` alongside
`twilioNumber` (§8 step 1).

### Why Starter never registers

Starter and Web-only send no customer-facing messages (decision 4), so they need no campaign and
are **complete on day one**. Registration runs for Growth and Enterprise only. `a2pStatus` needs a
distinct `not-applicable` terminal state for them — without it they sit in `none` forever and any
"is registration done?" check reads them as perpetually pending. Same trap as `receptionistMode`
being absent versus explicitly `declined`: state it, never infer it from the plan.

### EIN — zero retention, and why it is achievable

The EIN is needed for **exactly one API call, once**: it is
`business_registration_number` on the `customer_profile_business_information` EndUser. Nothing
downstream needs it again — brand registration references the **EndUser SID** (`IT…`), not the
number. Once that EndUser exists the EIN is Twilio's record as registrar, and JDD has no further
use for it ever.

So it is never persisted at all:

```
client types EIN
  → POST /api/onboarding/a2p-identity        one request, over TLS
  → POST /trusthub/v1/EndUsers               EIN in the body, in memory only
  → persist ONLY A2P_BUSINESS_ENDUSER_SID = IT…
  → request ends; plaintext unreachable from that moment
  → response: { ok: true }                   never echoes the value back
```

**The one structural constraint:** the EIN field's submit handler *is* the registration call.
Collecting it at one wizard step and using it at a later one needs somewhere to hold it between
requests, and serverless memory does not survive between invocations — so "somewhere" becomes
storage. Everything else follows from getting that right, and it must be right on the first
attempt: retrofitting zero-retention onto a flow that stored it means auditing every draft, log
and backup that ever existed.

Rules:

- Not to KV, not to disk, not to `clients/{slug}/.env.local`, and **never to `site.ts`** — that
  file is committed to the client's own GitHub repo
- Not to `console/.state/audit.ndjson`. That log already records key names and never values, which
  is the right pattern; record *"A2P identity submitted and consumed"* with a timestamp
- Never into a `console.log`. The route must not log its request body, and error paths must not
  interpolate the payload — a Twilio 400 echoed verbatim into a log line is the likeliest leak
- Not back to the browser, and not into any error returned to the client
- **Enforce with a test** that spies the Redis client across the registration path and fails on any
  written value matching `\d{2}-?\d{7}`. Preventive rather than regression-driven, which cuts
  against the repo convention — justified because the failure is silent, permanent and
  unrecoverable

**Resume behaviour.** Do *not* unconditionally re-ask. If the EndUser was created before the client
quit, the SID is on file and the EIN is not needed again — re-asking would make them expose it a
second time for no benefit, against the whole point.

- No EndUser SID → ask. Automatic, because nothing was stored.
- EndUser SID present → skip the field; show "business identity on file with our messaging provider."

**Abandonment.** Nothing was stored on the JDD side, so there is nothing to delete there. But if the
EndUser was created, **Twilio still holds it** — so on draft expiry, delete the orphaned TrustHub
objects, guarded on registration never having completed (deleting after brand approval would break
a live registration). _(verify)_ `DELETE /trusthub/v1/EndUsers/{sid}` is supported; if not, overwrite
the attributes with placeholders before discarding the SID.

**Where "draft expiry" already lives:** `juneau-digital-designs/app/lib/onboarding-draft-store.ts:13`
— `const DRAFT_TTL_SECONDS = 60 * 60 * 24 * 30` (30 days), applied via
`set(..., { ex: DRAFT_TTL_SECONDS })` in `saveDraft` (`:42`). There is `getDraft` (`:45`) and
`deleteDraft` (`:57`), but **no expiry hook** — Redis just drops the key, so nothing gets a chance to
clean up Twilio. Two options: sweep on a schedule by reconciling TrustHub objects against live
clients, or call `deleteDraft` explicitly on an abandon action and clean up there. The TTL alone is
not a cleanup mechanism, which is easy to assume and wrong.

**What this does and does not guarantee.** It guarantees no EIN is ever persisted by JDD and that
no JDD surface, route, database or log can produce one — nobody, including the owner, can look one
up after the fact. It does **not** guarantee the plaintext never exists anywhere: Twilio holds it
permanently as registrar; it transits the server's memory for one request, because the TrustHub API
needs account credentials and so cannot be called from the browser; and the client's browser had it.
The accurate term is **zero-retention**, not zero-knowledge. Client-facing copy must stay on that
side of the line — the disclosure in the runbook says outright that Twilio keeps a copy, and that
admission is what makes the rest credible.

**Same treatment for the representative's details.** The authorized representative's first name,
last name, direct email and mobile (step 2.3) are personal data about an individual and are also
needed for exactly one call. Submit-and-consume them too; keep only the `IT…`. The business address
is the one exception worth persisting, since `provisionTwilioNumber` already uses its ZIP for
geography-first number search and it is public in `site.ts` anyway — though note the *registration*
address is conceptually a different field from the site's public one, even when they match.

---

## 1c. Provisioning the JDD notification number

One local Orlando number, bought once, joined to the **existing** approved Messaging Service. No
registration wait: the brand and campaign are already `APPROVED` / `VERIFIED`, and a campaign binds
to the *service*, so any number in that service's sender pool sends under it the moment it lands.

### Manual steps — about five minutes

This is a one-time task, so Console is fine. The read-back in step 4 is the part that matters;
`onboard.js` already learned this lesson for client numbers.

1. **Buy the number.** Twilio Console → Phone Numbers → Buy a number. Country US, capabilities
   **Voice + SMS**, area code **407** (fall back to **321** or **689** — all three are already the
   `TWILIO_DEFAULT_AREA_CODES` default). **Local only — never toll-free:** a toll-free number cannot
   join an A2P Messaging Service, so its texts 30034 until a separate Toll-Free Verification clears.
2. **Name it** something unmistakable — `JDD Notification Sender (do not assign to a client)`. This
   number must never be handed to a client site, and the friendly name is the cheapest guard.
3. **Add it to the existing Messaging Service** (the one in `TWILIO_MESSAGING_SERVICE_SID`) →
   Sender Pool → Add Senders.
4. **Read the pool back** and confirm it is actually there. Do not trust the write:
   ```
   GET https://messaging.twilio.com/v1/Services/{MG…}/PhoneNumbers
   ```
5. **Leave `voiceUrl` unset.** This number is send-only. Nothing should ever dial it, and pointing
   it at a client's `/api/voice` would be actively wrong.
6. **Record it** in `jdd-ops/.env` as `TWILIO_NOTIFICATION_NUMBER=+1407…`, and add it to
   `.env.example`.
7. **Send one test message** through the service from that number to your own mobile, then read the
   message record back and assert `status=delivered`, `error_code=null`, and
   `messaging_service_sid` is **not null**. That last assertion is the one the current Make scenario
   fails.

### If you would rather script it

A `scripts/provision-notification-number.js` is roughly thirty lines and can reuse
`provisionTwilioNumber`'s existing geography-first search and pool read-back wholesale. Worth doing
only if you expect to need a second notification sender later (see the T-Mobile ceiling in §9) —
otherwise the Console path above is less work than reviewing the script.

### Cost

$1.15 local + $0.75 E911 = **$1.90/mo, agency-wide.** Already in the cost model.

---

## 1d. `TWILIO_MESSAGING_SERVICE_SID` — one name, two meanings

The new paradigm needs a per-client Messaging Service while nine existing readers expect one
master. **Do not reuse the same variable name for both.** Two files read the master from
`process.env`, and a same-named per-client value would make environment resolution order decide
which campaign a message sends under — an environment-dependent compliance bug that produces no
error, logs nothing, and only shows up as carrier filtering weeks later.

### Naming

| Scope | Variable | Holds |
|---|---|---|
| Master (`jdd-ops/.env`) | `TWILIO_MESSAGING_SERVICE_SID` | **unchanged** — JDD's Account-lane service, carrying `ACCOUNT_NOTIFICATION` |
| Per client (`clients/{slug}/.env.local`) | `CLIENT_MESSAGING_SERVICE_SID` | the client's own service, carrying their `CUSTOMER_CARE` campaign |
| Portal (`PortalSite`) | `messagingServiceSid` | same value, so the agency site can resolve it — it cannot read a client's `.env.local` |

### Every reader, and what changes

| Reader | Today | After |
|---|---|---|
| `onboard.js:1277` — pool join | adds the client's number to the **master** pool | **Stop.** Growth/Enterprise numbers join their own service; Starter/web-only join none. Leaving this in place puts client numbers under JDD's account-notification campaign, which is the exact mis-registration this migration exists to end |
| `onboard.js:2674-2681` — SMS-consent pre-flight | hard-fails when the master SID is unset or the campaign is unapproved | Reframe against the **Account lane**: owner alerts now need `TWILIO_NOTIFICATION_NUMBER` present and in the master pool. The client's own campaign is no longer a gate on provisioning at all, because the wait is expected |
| `onboard.js:2881-2889` — service read | reads the master service | Keep. It is validating JDD's Account-lane service, which is still correct |
| `lib/reconcile-probes.js:82` | flags a live client number **not** in the master pool as drift | **Invert.** A client number *in* the master pool is now the drift. New check: Growth/Enterprise numbers belong to their own service; a number in the master pool other than the notification sender is a finding |
| `console/src/lib/runbook-content.ts:561` | describes the master-pool join as the mechanism | Rewrite — see the console handoff |
| `console/src/lib/go-live-content.ts:257` | "the agency project does not need this SID" | Still true for the master, but the agency site now needs to resolve the **per-client** one from `PortalSite` for the Customer lane |
| `console/src/lib/goLive/preflight.ts:108` | asserts the SID starts with `MG` | Keep; add the same check for `TWILIO_NOTIFICATION_NUMBER` being E.164 and in the pool |
| `console/src/lib/opsSecrets.ts:237` | surfaces the master SID | Keep, add the notification number |
| agency `app/lib/twilio.ts` `sendSms()` | always sends via the master `MessagingServiceSid` from env | Must take the service as an argument. **Account lane:** master service + `from: TWILIO_NOTIFICATION_NUMBER`. **Customer lane:** the client's service + `from:` the client's number. Defaulting either way silently is how a customer message ends up on the wrong campaign |
| `.env.example:53` | master SID only | Add `TWILIO_NOTIFICATION_NUMBER` |
| `CLAUDE.md:95` | "the sending number must live in the `TWILIO_MESSAGING_SERVICE_SID` sender pool" | Now true only of the notification sender. Client numbers live in their own services |

**The `sendSms()` change is the one to be careful with.** It currently has a single implicit
destination, so every existing caller inherits the Account lane by default — which is correct for
the post-call brief and the lead alert, and wrong for review requests and lead replies. The
already-built `ReviewRequestDialog` path calls it today. Make the service an explicit required
argument rather than an optional override, so adding a new caller forces the author to state which
lane it belongs to. An optional parameter here means the wrong default is one forgotten argument
away, and the failure is silent.

---

## 1e. Cross-repo integration surface — "create a site in the console, get a working production site"

Traced end to end on 2026-10-29. These are the places the new features have to land or the console
flow produces a site that looks provisioned and isn't. Grouped by the failure they prevent.

### The phase contract will fail the build if you add an onboard.js phase

`onboard.js` emits ten numbered phases via `log(N, …)`. Three files must agree, and a test enforces
it:

- `console/src/lib/onboard-parse.ts:110` — `PHASE_MAP` (regex → label, parse side)
- `console/src/lib/run-plan.ts:86` — `expectedPhases()` (plan side)
- `console/test/phase-contract.test.mjs` — replays recorded dry-run stdout for all four client
  shapes and asserts they match

An A2P registration phase, or a lead-token phase, means updating **all three in the same commit**
and re-recording fixtures with `npm run fixtures:dry-run`. Otherwise the new phase renders as
unplanned drift (coral) in the console UI and `cd console && npm test` goes red.

Also: check output must never contain the token `FAIL:` — `onboard-parse.ts` treats any line
carrying it as a fatal run, which would abort the UI's narration over a soft A2P-pending finding.
A2P "not yet verified" is **expected**, not a failure, and must not be worded as one.

### `LEAD_INGEST_TOKEN` will silently fail to reach production

`lib/vercel-sync.js:776` **skips empty values**. That is the exact mechanism behind the August
Resend bug: `keep('RESEND_API_KEY')` returned empty on a new client, the key never reached Vercel,
and `/api/contact` 502'd on every lead at a cost of $0. A token that is minted lazily, or carried
with `keep()` before it exists, reproduces the bug one-for-one.

- Mint `LEAD_INGEST_TOKEN` **unconditionally in `buildClientEnvLines`** (`lib/client-env.js`), never
  via `keep()` with an empty fallback
- `lib/vercel-sync.js:763` hardcodes `['RETELL_API_KEY','TWILIO_NUMBER','RETELL_AGENT_ID']` as the
  required set for callback mode. `LEAD_INGEST_TOKEN` is required on **every** tier including
  web-only — add it to a tier-independent required list so sync warns loudly when it is absent
- Add a correctness check in `lib/onboard-checks.js` asserting the token exists, is 64 hex chars,
  and resolves in KV. Both the test suite and `--dry-run` import that module, so the dry run will
  answer "would this provision correctly?" rather than just "would it run"

### `lib/client-env.js` is where the tier split becomes real

Lines 83–88 currently branch Resend-vs-callback. The new shape:

```
LEAD_DELIVERY_MODE=portal           # every tier — replaces email|callback
LEAD_INGEST_TOKEN=<64 hex>          # every tier, never empty
LEAD_INGEST_URL=https://www.juneaudigitaldesigns.com/api/ingest/lead
CLIENT_MESSAGING_SERVICE_SID=MG…    # Growth/Enterprise only, after A2P verifies (§1d)
```

Drop `LEAD_TO_EMAIL`, `LEAD_BRAND_NAME`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` — all four.
**`LEAD_BRAND_NAME` is confirmed droppable** (resolved 2026-10-29): the portal reads the display
name from `PortalSite`, so a second copy in client env would only be free to drift.

### ⚠️ Two things `LEAD_DELIVERY_MODE=portal` breaks — both verified, both silent-ish

**1. The console will reject it as invalid.** `console/src/lib/envFields.ts:134` declares
`options: ['email', 'callback']`, and `:271-272` validates against that list:

```ts
if (field.options && !field.options.includes(value)) {
  return { ok: false, error: `${field.label} must be one of: ${field.options.join(', ')}.` };
}
```

So an operator editing any field on that client in `/manage → Environment` gets a hard validation
failure on a value **onboard.js itself wrote**. Add `'portal'` to `:134` in the same commit that
changes `client-env.js`.

**2. `checkEnvTierMatrix` will fail the correctness checks.**
`lib/onboard-checks.js:96` — `checkEnvTierMatrix({ lines, plan, webOnly })` asserts the env file
matches the tier. It is called from `runCorrectnessChecks` (`onboard.js:2017` area) and is imported
by both `npm test` and `onboard.js --dry-run`, so this breaks the suite *and* every dry run. Update
the predicate and its fixtures together — and remember `ok` is `true | false | null` where **`null`
means "could not check" and is never a pass**.

**3. `CARRIED_KEYS` decides whether the token survives a re-run.**
`lib/client-env.js:110` — `const CARRIED_KEYS = ['AIRTABLE_SITE_TAG', 'CLERK_USER_ID',
'PORTAL_ACCOUNT_EMAIL']`. Anything onboard.js writes *later in the run* and that is absent from the
template above is **silently dropped on every re-run**. So `LEAD_INGEST_TOKEN` must either be minted
inside `buildClientEnvLines` (preferred — it needs no vendor call, so there is no reason to defer
it) **or** added to `CARRIED_KEYS`. Minting it in the template and *also* listing it in
`CARRIED_KEYS` is the belt-and-braces option and costs nothing.

Note also `lib/client-env.js:80` — `const wantsEmailLeads = plan === 'starter'` — which is how a
web-only client (also `plan: 'starter'`) currently lands in email mode. That whole branch
(`:84-89`) goes away; the replacement is unconditional `LEAD_DELIVERY_MODE=portal` with the callback
decided at runtime by plan, not by a second env value.

The doc comment at `:70-78` describes the Starter-email/Growth-callback split as "the only intended
runtime difference" — **update the comment too.** Prose that can silently steer behaviour is part of
the behaviour; that is exactly the lesson the ring-window test was written to enforce.

### The console Environment UI needs the new keys declared

`console/src/lib/envFields.ts` drives `/manage → Environment`. Keys absent from it are not editable
or visible, so a provisioned-but-undeclared key is invisible drift.

| Key | Group | Editable? |
|---|---|---|
| `LEAD_DELIVERY_MODE` | leads | existing field — add `portal` to its options |
| `LEAD_INGEST_TOKEN` | leads | **read-only** — onboard.js owns it; rotating it by hand breaks ingest until KV is updated |
| `LEAD_INGEST_URL` | leads | editable (useful for pointing a test client at a preview deploy) |
| `CLIENT_MESSAGING_SERVICE_SID` | integrations | **read-only** — A2P registration owns it |
| `A2P_BRAND_SID`, `A2P_CUSTOMER_PROFILE_SID`, `A2P_BUSINESS_ENDUSER_SID`, `A2P_REP_ENDUSER_SID`, `A2P_ADDRESS_SID`, `A2P_ADDRESS_DOC_SID`, `A2P_PROFILE_BUNDLE_SID` | integrations | **read-only** |
| `A2P_BRAND_TYPE`, `A2P_CAMPAIGN_STATUS` | integrations | read-only, status display |

Remove the Resend fields (`LEAD_TO_EMAIL`, `RESEND_FROM_EMAIL`) once step 8 lands. Note
`envFields.ts:212` already masks anything matching `^(AIRTABLE|RESEND|MAKE)_` — `A2P_*` SIDs are not
secrets (they are opaque references) so they should **not** be masked; the EIN is the only sensitive
value and it is never stored (§1b).

Also note the web-only grouping rule: empty groups hide themselves, and a web-only client currently
shows only the `leads` group. That still holds, and it is now the group that actually does something
for them.

### Teardown will orphan billable A2P resources

`lib/teardown-ops.js` deletes the GitHub repo, Twilio number, Retell agent + LLM, Vercel project,
Airtable base and Make scenario. It knows nothing about **TrustHub objects or Messaging Services**.
Tearing down a Growth client today would leave:

- a per-client Messaging Service
- a brand registration and a **campaign still billing $2/mo, forever**
- a Secondary Customer Profile plus three EndUsers and a SupportingDocument holding that client's
  business details — including the EIN we were careful never to store ourselves

That last one is the serious half: the privacy posture in §1b is undermined if offboarding leaves
the data sitting in TrustHub indefinitely. Teardown must delete the campaign, the Messaging Service,
the brand and the TrustHub bundle, in that order, and the same `_e2e` guard rails apply.

### Teardown also orphans portal KV — and one key is a correctness bug, not hygiene

`teardown-ops.js` deletes vendor resources and the client's KV *account* record, but nothing
sweeps the portal's own namespaces. After the CRM v2 work lands, that includes `portal:crm:v2:*`
(customers, transcripts), `portal:lead:*` and `portal:lead:token:v1:*` from this plan, and two
reverse indexes:

```
portal:number-owner:v1:{e164}        → { acctScope, slug }   # inbound SMS routing
portal:review:sent:v1:{acctScope}:{e164}
portal:review:number-owner:v1:{e164} → acctScope             # already shipped
```

Stale CRM and lead keys are hygiene — they expire on their 400-day backstop and nothing reads them
once the account record is gone. **The number-owner indexes are different.** They are keyed by phone
number with **no account scope in the key and no TTL**, and Twilio **recycles released numbers**. So:

1. Client offboards, number is released back to Twilio
2. Twilio reassigns it — possibly to another JDD client, possibly to an unrelated business
3. Someone texts that number
4. The inbound webhook resolves `portal:number-owner:v1:{e164}` → **the former client's account**

A stranger's inbound SMS lands in a former client's thread, or a new client's customer reply is
routed into the wrong account entirely. That is a cross-tenant data leak with no error anywhere to
find it — the same shape as the bugs `CLAUDE.md`'s testing section exists to catch.

**This already applies to shipped code.** `recordReviewSend()` in `portal-crm.ts` writes
`portal:review:number-owner:v1:{e164}` with no TTL today, and `markReviewOptOut()` /
`markReviewDeliveryByNumber()` read it to resolve an account from a bare number. Nothing deletes it.
So the bug is live in the review feature regardless of this plan, and `releaseTwilioNumber()` is the
natural place to fix it: **release the number and delete every index keyed by it in the same step,
or do not release the number.**

Belt and braces worth having: give the number-owner keys a TTL, and have the inbound webhook
cross-check that the resolved `acctScope` still owns that number before writing to a thread. A
reverse index that can outlive the fact it describes should not be the sole authority.

### Reconcile needs its Twilio probe inverted

`lib/reconcile-probes.js:69` — `probeTwilioNumber({ …, messagingServiceSid })` is passed the
**master** SID and flags a live number *not* in that pool as drift. Under the new paradigm that is
backwards for client numbers (§1d). New checks worth having, since reconcile is the only thing that
catches silent misconfiguration:

- a Growth/Enterprise number must be in **its own** service, not the master pool
- the notification number must be in the **master** pool
- `A2P_CAMPAIGN_STATUS` on disk must match what Twilio reports live — a campaign that moved to
  `FAILED` after provisioning is otherwise invisible
- the client's Messaging Service `InboundRequestUrl` must be set and
  `UseInboundWebhookOnNumber` false, or inbound replies reach nothing

### Repair ops and plan upgrades

- `lib/repair-ops.js` — a Starter → Growth upgrade now has to *start A2P registration*, not just
  flip `LEAD_DELIVERY_MODE`. The upgrade cannot complete synchronously; it has to leave the client
  in `a2pStatus: brand-pending` and let the poller finish. `console/src/app/api/manage/plan/route.ts`
  is where that surfaces, and it is already the route that inherited the wrong ring-window default
  from prose — worth re-reading rather than assuming.
- **Reusable, don't rewrite:** `lib/repair-ops.js:34` —
  `setTwilioWebhook({ accountSid, authToken, phoneNumber, field, url })` already takes the webhook
  **field** as a parameter, so it can set `smsUrl` as easily as `voiceUrl`. If the A2P work goes the
  per-number route instead of the service-level inbound URL (§1b), this is the function to call
  rather than writing new Twilio code.
- A Growth → Starter **downgrade** should stop the campaign billing.
  `console/src/lib/planDowngrade.ts` needs both the A2P teardown subset **and** removal of its
  Resend-specific logic, which is more than a passing mention: `:110` resolves `LEAD_TO_EMAIL`,
  `:112` warns when `brand.email` is missing, `:114-116` warns when `RESEND_API_KEY` is unset
  (noting "onboard.js never seeds it either; a fresh starter client has the same gap"), and `:149`
  returns `resendKeySet` in the preview payload. All four go when Resend does — including the
  consumer of `resendKeySet` in whatever renders that preview.

### Go-live preflight

`console/src/lib/goLive/preflight.ts:108` asserts `TWILIO_MESSAGING_SERVICE_SID` starts with `MG`.
Add: `TWILIO_NOTIFICATION_NUMBER` is E.164 and present in the master pool, and — for Growth/Enterprise
— `LEAD_INGEST_TOKEN` resolves in KV. `console/src/lib/go-live-content.ts:257` currently tells the
operator the agency project does not need the messaging SID; that stays true of the master but the
agency site now needs the **per-client** one, resolved from `PortalSite`.

### What "fully functional on day one" actually requires

A console-created Growth site is fully functional at provision time **except** lead replies and
review requests, which wait on A2P (§1a). For that to be true rather than aspirational, all of the
following must hold at the end of a run — and each is worth a `lib/onboard-checks.js` predicate so
`--dry-run` can answer it:

1. `LEAD_INGEST_TOKEN` present, non-empty, synced to Vercel, resolvable in KV
2. `twilioNumber` + `messagingServiceSid` written to `PortalSite` (not just `.env.local`)
3. `leads` feature gate resolves `ready` for the new site
4. The post-call brief sends from `TWILIO_NOTIFICATION_NUMBER` through the master service
5. `a2pStatus` set — `not-applicable` for Starter/web-only, `brand-pending` for Growth/Enterprise
6. The portal renders the pending state rather than a bare disabled control

---

## 2. The message field is lost on the callback path

The form collects `{name, phone, message}`. `create-phone-call` sends `{from_number, to_number,
override_agent_id}` — the message is discarded, so the agent calls back knowing nothing and has to
ask "what can we help with?" when the customer already typed it.

Retell supports passing context into the LLM at call time. Pass the name and message so the agent
opens with it:

```
POST https://api.retellai.com/v2/create-phone-call
{
  from_number, to_number, override_agent_id,
  retell_llm_dynamic_variables: {
    lead_name: "Jane Smith",
    lead_message: "AC out since this morning, two kids at home"
  }
}
```

_(verify)_ Confirm the exact parameter name and that the per-client LLM prompt references these
variables — a dynamic variable the prompt never mentions is silently ignored. The prompt is
Claude-generated in `onboard.js`, so the template needs a line for it.

This is a small change with an outsized quality effect: the difference between "hi, you enquired
on our website" and "hi Jane, I understand your AC has been out since this morning."

---

## 3. Data model — Upstash KV

New `app/lib/portal-leads.ts` on the agency site (`server-only`), following `portal-crm.ts`
conventions. Every key carries `acctScope` (`accountScope(account.email)`), per the invariant in
`portal-kv.ts`.

```ts
leadKey(acctScope, slug, leadId)   // portal:lead:v1:{acctScope}:{slug}:{leadId}
leadIndexKey(acctScope, slug)      // portal:lead:index:v1:{acctScope}:{slug}  — sorted set by ts
leadTokenKey(token)                // portal:lead:token:v1:{token} → {acctScope, slug}
```

```ts
export interface WebLead {
  leadId: string;            // crypto.randomUUID() — ordering comes from the index, not the id
  slug: string;
  name: string | null;
  phone: string | null;      // E.164 when parseable, raw retained separately
  phoneRaw: string | null;
  email: string | null;      // optional; keep the field, see §7
  message: string | null;
  fields: Record<string, string>;  // anything else the form posted
  createdAt: string;         // ISO
  readAt: string | null;     // set when the owner opens it
  source: "web-form";
  callbackPlaced: boolean;   // Growth/Enterprise: did create-phone-call succeed
}
```

`leadId` is a random id rather than a hash of content, because two identical enquiries from the same
person an hour apart are two leads, not one.

⚠️ **Correction (verified 2026-10-29):** an earlier draft specified a ULID. **`ulid` is not a
dependency** of the agency site, and neither is `nanoid` or `uuid`. Use the built-in
`crypto.randomUUID()` and add nothing — sortability is not needed, because `leadIndexKey` is a
**sorted set scored by `createdAt`**, so ordering comes from the index rather than the id.

**Retention:** 400-day backstop expiry, matching `CrmContact`'s reasoning in `portal-crm.ts` —
state, not cache, but a dormant account should eventually stop occupying keys.

**`WebLead` is a published contract as of 2026-10-29.** The CRM v2 Inbox is being built against this
interface, so any change needs a heads-up to that work *before* it lands, not after.

**Contact identity:** `normalizeE164(phone)`, imported from `app/lib/phone.ts`. Sharing the join key
is what makes a web lead and a phone call from the same number collapse onto one customer — the
whole reason to reuse the function rather than invent a lead-specific id.

**Do not import from `crm-contacts.ts`.** That module is being repurposed in CRM v2, so a reference
to it here would go stale. `normalizeE164` remains the shared key; take it from `phone.ts` directly.

---

## 4. Ingest path

```
client site form
  → POST /api/contact        (same-origin, no CORS, owned by onboard.js)
  → POST {agency}/api/ingest/lead   (server-side, per-client token)
  → KV
  → portal reads
```

### Current state of `contact.route.ts`, verified

Read before editing — the route is smaller than it sounds and has no plumbing to reuse:

| Fact | Anchor |
|---|---|
| Mode switch, defaults to `'email'` | `const mode = process.env.LEAD_DELIVERY_MODE ?? 'email'` |
| Callback branch — reads **only** `data.phone` | `:93` `fetch('https://api.retellai.com/v2/create-phone-call')` |
| Email branch — folds all posted fields into the email body | `:114` `fetch('https://api.resend.com/emails')` |
| **No onward POST to anything else** | — the ingest forward is new code |
| Returns 502 on upstream failure, 400 on bad phone, 500 on missing env | existing behaviour to preserve |

So §1's "always record first" is implemented by adding a **third** outbound call, placed *before*
the mode switch, which posts the **entire parsed body** plus the slug-derived context. Forwarding
the whole body rather than a whitelist is deliberate: it is what lets the consent object (§11) and
any future form field arrive without touching this file again — the same reasoning the route's own
header already gives for the email builder.

### Why not post the form straight to the agency site

Three reasons: it needs CORS; it exposes the ingest endpoint to the open internet with no
same-origin signal; and a client site that can post as any client is a cross-tenant hole. Keeping
`/api/contact` as the entry point also means no change to `LeadForm` beyond field config.

### Auth — per-client token, not `OPS_SHARED_SECRET`

`/api/ops/plan-sync` uses a global `OPS_SHARED_SECRET` with `timingSafeEqual`. That is correct for
ops-console → agency site, where there is one caller. It is **wrong here**: every client site
would hold a secret that can write leads to any account.

- `onboard.js` mints `LEAD_INGEST_TOKEN` (32 random bytes, hex) per client
- Written to `clients/{slug}/.env.local`, synced to Vercel, **recorded the instant it exists** so
  an interrupted run resumes rather than minting a second one
- Agency site stores `portal:lead:token:v1:{token} → {acctScope, slug}` at provision time
- `/api/ingest/lead` resolves account + slug **from the token**, never from the request body — a
  posted slug is not trusted

### Abuse surface

A public form writing to a store is a spam vector that Resend used to absorb. Needed:

- `getPortalRatelimit()` keyed on token + source IP
- Honeypot field in `LeadForm` (hidden input; non-empty ⇒ silent 200, no write)
- Length caps: name 200, message 2000, total body 8 KB
- Reject when `phone` fails `normalizeE164` **and** `email` is absent — a lead with no reachable
  contact is not a lead

### Failure behaviour

If ingest fails, `/api/contact` returns **502** and `LeadForm` already renders "That didn't send.
Please try again, or call us directly." That is the correct outcome: the customer learns
immediately and has the phone number in front of them. It is strictly better than today's silent
Resend failure.

_(decide)_ Whether to dual-write to email during cutover as a safety net. Contradicts decision 5,
but makes the migration reversible for the first few clients. My recommendation: ship without it,
because a 502 the customer *sees* beats an email nobody reads — but keep the Resend branch in
`contact.route.ts` behind `LEAD_DELIVERY_MODE=email` for one release so a rollback is an env flip.

---

## 5. Feature gating — three new gates

`siteFeature(site, "calls")` keys off `airtableBaseId` and returns `not-on-plan` for web-only.
Lead capture cannot hang off it: web-only has no Airtable base and will never have one.

Add to `jdd-schema` `entitlements.ts`:

| Gate | Requirement | Tiers |
|---|---|---|
| `leads` | nothing beyond `status === "live"` | **all**, including web-only |
| `crm` | `status === "live"` **and** plan is growth/enterprise | Growth, Enterprise |
| `messaging` | `crm` ready **and** `a2pStatus === "verified"` | Growth, Enterprise, after ~day 20 |

### Why `crm` must not require `airtableBaseId`

An earlier draft of this section gated `crm` on `airtableBaseId`. **That was wrong**, and it is the
same mistake §5 was written to warn about. The v2 CRM holds **web leads as well as calls**, so a
Growth site that is `live` but not yet Airtable-wired would report `connecting` and hide a CRM the
client could already use for form leads. Gate on `live` + plan; let the *calls* portion of the CRM
degrade on its own via the existing `calls` gate.

### Why `messaging` is a separate gate

Without it, "has CRM access" and "can actually send a text" collapse into one flag, and a Growth
client gets a dead button for three weeks instead of the progress copy in §1a. The whole point of
tracking `a2pStatus` is to be able to say *why* the control is disabled. Two gates make that
expressible; one does not.

### `FEATURE_REQUIREMENT`

It currently maps every feature to a `keyof PortalSite`. `leads` has no required id, so either allow
`null` there or give it `slug`. **Prefer making the map's value optional** — inventing a fake
requirement to satisfy a type is exactly how `calls` ended up gating on an Airtable id.

### Navigation — two items, not one

Superseded by an owner decision taken after this plan was drafted: the portal gets **Inbox** and
**Customers** as two separate nav items. **Starter gets Inbox only.** The earlier "one nav item, two
capability levels" is withdrawn — a single item that silently changes shape by tier also leaves
nowhere clean to place the Starter upsell showcase.

---

## 6. Owner notification

Text the owner "New lead from {name} — open your portal." Recipient is the **account holder**, so
it rides the existing `ACCOUNT_NOTIFICATION` campaign and needs no new A2P registration. Reuse
`sendSms()` and the existing `sms:consent:*` log; honour `SmsAlerts` consent and suppress when
revoked.

~$0.012 per lead. Available on every tier including web-only, because it never touches a customer.

**Do not** send this from the client's own number — it is JDD→owner traffic on JDD's campaign, and
the client's number has to stay free to join *their* Messaging Service on day 20 (§1a). Pin
`from` to the dedicated JDD notification number via `sendSms({ from })`, which already supports it:

```
TWILIO_NOTIFICATION_NUMBER=+1…   # master .env, agency-wide
```

Pinning rather than letting the service auto-select matters for UX as much as architecture — the
owner gets every alert from one consistent sender they can save as a contact, identical across all
their sites, instead of whichever number the pool happened to pick.

---

## 7. Form fields

`LeadForm` already supports `mode` and `withMessage`, so this is config, not a rewrite.

- Starter/Web-only: `mode="phone"` + `withMessage` → name, phone, message
- Growth/Enterprise: same — the callback needs the phone, and the message now travels (§2)

**Keep email as an optional field.** The user's framing was name + phone + message, and phone is
right as the *required* contact. But dropping email entirely removes the owner's only non-SMS
reply channel, and some customers would rather be emailed. Optional costs nothing and
`buildLeadEmail`'s existing "labelled table of all posted fields" logic shows it already tolerates
arbitrary fields.

---

## 8. Execution order

0. **Protect the day-one post-call brief first.** Buy the JDD notification number, add it to JDD's
   existing Messaging Service, and patch the master post-call blueprint to send `From` that number
   with `MessagingServiceSid` set (§1a). Run `npm run verify-post-call`. **This is the only item
   here that is already broken for the next real client** — today's brief would send from an
   unregistered new number and `30034`. Everything else in this plan is additive; this is a fix.
1. **`jdd-schema`** — one release, coordinated with the CRM agent (§12): `WebLead` type, the
   `leads` / `crm` / `messaging` gates, `FEATURE_REQUIREMENT` made optional, and **`twilioNumber` +
   `messagingServiceSid` + `a2pStatus`** on `PortalSite`. `a2pStatus` must ship in the *same*
   release — §1e items 5–6 require it for the portal to render the pending state, and an earlier
   draft of this step omitted it.
2. **Agency site, data layer only**: `portal-leads.ts`, `POST /api/ingest/lead`,
   `GET /api/portal/leads`. Unit-test the token resolution and the E164 join. **Stop here — do not
   build lead UI** (§8 note below).
3. **`onboard.js`**: mint + record `LEAD_INGEST_TOKEN`, register it in KV, write
   `LEAD_DELIVERY_MODE=portal`, drop the Resend vars from `writeClientEnvLocal`.
4. **`contact.route.ts`**: always-ingest, then callback for growth/enterprise. Add the honeypot
   and the caps. Keep the Resend branch for one release.
5. ~~**Portal UI**: Leads list for all tiers; wire web leads into the existing CRM board.~~
   **Withdrawn — not this plan's deliverable.** The CRM board is being rewritten (v2) by a separate
   agent, and the **Inbox is the consumer of `GET /api/portal/leads`**. Building a Leads list here
   would be thrown away. This plan ends at the data layer; the portal surface belongs to the CRM
   work. Coordinate via §12 rather than building ahead of it.
6. **Owner SMS alert**, pinned to `TWILIO_NOTIFICATION_NUMBER` (§6).
7. **Backfill**: mint tokens for existing clients, re-sync env, redeploy.
8. **Remove Resend** from `.env.example`, `envFields.ts`, `contact.route.ts` and the docs.

Each phase: `npm test` green at the root, `cd console && npm test` green, `tsc --noEmit` clean on
the agency site.

### Runs in parallel, owned by the A2P runbook

Independent of steps 1–8 and on a longer clock, so start it early:

- **Convert the primary Twilio profile to "ISV Reseller or Partner."** Minutes of work in the
  Console, blocks every per-client registration. Do it first.
- **Add the A2P identity step to the onboarding wizard**, built submit-and-consume from the start
  (§1b). Every client onboarded before this exists needs backfilling by hand.
- **Build `lib/a2p-register.js` against mock brands** (`Mock=true` registers free and moves through
  the real status transitions). Resumable, evaluation-gated.
- **Add `a2pStatus` + the portal pending state**, so the 13–20 business day wait reads as progress.

Nothing in steps 1–8 depends on any of this. Lead *capture* ships without A2P; only lead *replies*
wait.

---

## 9. Open verifications

- _(verify)_ Retell `retell_llm_dynamic_variables` parameter name, and that the generated agent
  prompt references `lead_name` / `lead_message`.
- _(verify)_ Whether a Retell callback that is never answered produces **any** Airtable row. The
  whole case for always-ingest rests on this; if Retell does log unanswered outbound calls with
  usable data, §1 is weaker (though the message-field argument stands either way).
- _(verify)_ `getPortalRatelimit()`'s current limits are appropriate for an unauthenticated public
  form — it was sized for authenticated portal traffic.
- _(verify)_ Whether one Twilio number can belong to two Messaging Services simultaneously (§1a).
  The recommended design does not depend on the answer, but knowing it closes off a whole class of
  future confusion. Testable in minutes against the e2e fixtures.
- _(verify)_ T-Mobile daily segment headroom once every client's post-call brief and lead alert
  funnels through one JDD notification number. JDD's brand reads
  `tmobile.brand_tier: LOW`. At 25 Growth clients this is roughly 500 segments/day in total, which
  should be comfortable — but it is now a single shared ceiling rather than spread across numbers,
  and brand vetting is the lever that raises it.
- _(verify)_ `DELETE /trusthub/v1/EndUsers/{sid}` is supported, for the abandonment cleanup in §1b.
  Fallback is overwriting the attributes with placeholders.
- _(verify)_ Which TCR `business_industry` enum values map to the verticals actually sold
  (plumbing, lawn care, car detailing, HVAC). The intake's freeform `industry` will not map, and a
  wrong value is a brand rejection and a restart — days, not minutes.
- _(verify)_ Whether Vercel request logs can ever capture a POST body. The EIN design assumes they
  cannot; if they can, the a2p-identity route needs explicit log suppression rather than just
  discipline about `console.log`.
- _(decide)_ Dual-write to email during cutover (§4).
- _(decide)_ Whether web-only clients get the owner SMS alert by default or opt in — they have no
  receptionist, so an SMS from JDD may be their only notification channel.
- _(decide)_ Where the A2P identity step sits in the wizard. It must be late enough that the client
  is committed (an EIN prompt early in a signup flow reads as a scam) but it cannot be *after*
  anything that would make the submit-and-consume request span two steps.

---

## 10. What this does **not** do

- **No customer-facing texting on Starter or Web-only, ever** — that is decision 4, a product
  boundary rather than a limitation. It is also what keeps those tiers free of any A2P
  registration.
- No lead-reply or review texting on Growth/Enterprise until their own campaign verifies
  (`JDD-a2p-isv-runbook.html`). Everything else on those tiers is day one.
- No change to the Airtable `Call Log` schema — the column list stays a contract with the Make
  master scenario, and web leads deliberately do not go there.
- No change to the Account-lane campaign. JDD's `ACCOUNT_NOTIFICATION` registration is correct for
  what it carries and stays exactly as it is.
- **No portal lead UI.** Withdrawn from scope (§8 step 5). This plan ends at `portal-leads.ts` and
  `GET /api/portal/leads`; the Inbox in CRM v2 is the consumer.
- **No client-site consent capture.** The `LeadForm` disclosure, the hashed wording module and the
  `@jdd/ui` release are handed off in `HANDOFF-leadform-sms-consent.md`. This plan consumes the
  `consent` object the form posts and owns the server-side gate — see the scope split at the top of
  §11.

---

## 11. Customer consent before the client may message them

> **Scope split (2026-10-29).** This section is the **design rationale and the server-side gate**.
> The **client-site capture work is NOT in this plan** — it is handed off separately in
> `HANDOFF-leadform-sms-consent.md` and owned by another agent.
>
> | Owned here | Owned by the consent handoff |
> |---|---|
> | `canMessageContact()` and the `messaging` gate | `LeadForm` disclosure UI |
> | `portal:msg-consent:v1:*` storage | `lead-consent-text.ts` wording/version/hash |
> | STOP → revocation wiring | The `@jdd/ui` release + pin bumps |
> | Promoting the posted `consent` object into `WebLead.consent` | Posting a well-formed `consent` object |
>
> **The seam is the POST body.** ⚠️ **Correction (verified 2026-10-29):** an earlier draft said
> `/api/contact` "already forwards the whole body." It does not. `lib/site-routes/contact.route.ts`
> makes exactly two outbound calls — Retell `create-phone-call` (`:93`) and Resend (`:114`) — and
> has **no onward POST at all**. The forward is something *this plan adds* (§4).
>
> The scope split still holds, because the two changes are independent in both directions: the form
> can post a `consent` object today and `contact.route.ts` simply ignores unknown fields (the
> callback branch reads only `data.phone`; the email branch folds extras into the email body). Once
> this plan adds the forward — which posts the **whole body** — the field starts arriving with no
> further change to the form. Nobody is blocked on anybody.
>
> Do not edit `LeadForm.tsx` or the `@jdd/ui` package from this plan; the other agent will not edit
> `contact.route.ts`, the ingest endpoint, `portal-leads.ts` or `WebLead`.
>
> The `consent` payload shape below is **fixed by agreement between the two**. Changing it needs a
> heads-up both ways.

**Requirement:** a business owner must not be able to text a customer who has not consented.
Agreed. But the proposed mechanism — force a consent-gathering text before allowing subsequent
messages — does not work, and the reason is worth stating before the design.

### The circularity

> "Send a default message asking for consent, then unlock the thread."

That first message **is a text to someone who has not consented.** If the premise is that consent is
required before texting, then a consent-request text is the one message the premise forbids. It is
also the least defensible message in the thread: unsolicited, sent to someone who never asked for
it, and carrying no transactional purpose. A carrier complaint about *that* message is harder to
answer than a complaint about a reply to an enquiry.

So the gate cannot be a message. **It has to be the web form.**

### Where consent actually comes from

A consumer who fills in a form, types their own mobile number and writes "my AC is out, please call"
has initiated contact and asked to be contacted about that matter. Under the conversational /
consumer-initiated model that is prior express consent for a **responsive** reply — which is exactly
what the Inbox sends. Nothing further is needed, and inserting a consent request would add friction
to a conversation the customer started.

That makes the real work **capture at the form, not a gate in the thread** — which is precisely why
it was split out. The form currently carries no SMS disclosure at all. Handed off; see
`HANDOFF-leadform-sms-consent.md` for the implementation, including the non-obvious detail that the
one real `LeadForm` implementation lives in the **`jdd-ui` repo** and reaches client sites only via a
tag + pin bump.

What this plan still does on receipt of a lead:

- Promote the posted `consent` object into `WebLead.consent`
- **Re-stamp `capturedAt` server-side** — a client-supplied timestamp is not evidence
- Attach `ip` + `userAgent` via the existing `consentRequestContext(req)`
- Treat a lead arriving with **no** `consent` object as `basis: null` → messaging blocked, not
  silently allowed. Leads from client sites still on an older `@jdd/ui` pin will look exactly like
  this, so the gate must fail closed

### ⚠️ This changes the `WebLead` contract

Adding consent fields to `WebLead` touches the interface §3 declares a published contract. **Flag to
the CRM v2 agent before it lands**, since the Inbox is built against it:

```ts
  consent: {
    basis: "web-form" | "inbound-sms" | "inbound-call";
    textHash: string | null;      // null for basis !== "web-form"
    textVersion: string | null;
    capturedAt: string;           // ISO
    ip: string | null;
    userAgent: string | null;
  } | null;                       // null = no consent basis; messaging blocked
```

### Consent basis by origin — the case nobody has raised yet

The CRM holds customers from **calls**, not just forms. Those have no form submission and no hashed
disclosure, so their consent basis is weaker and must be treated differently rather than assumed:

| Origin | Basis | Posture |
|---|---|---|
| Web form with disclosure shown | Strongest — they typed the number and saw the wording | Allow |
| Customer texted the business first | Strongest — they opened the channel | Allow |
| Customer **called** the business | Consumer-initiated, but no written record and no disclosure | **Decide.** Defensible for a responsive reply; weaker than a form |
| No phone, or number unparseable | None | Block — `no-number` |
| Previously sent STOP | Revoked | Block permanently |

The call-only case is the one to settle deliberately. It is also the common one: most CRM customers
will arrive via the receptionist, not the form. _(decide)_ Recommended position: allow a responsive
reply within a window of the call, require the first message to identify the business and carry
opt-out, and log `basis: "inbound-call"` so the weaker basis is visible in an audit rather than
indistinguishable from a form consent.

### The gate belongs in the API; the UI only reflects it

**UI gating is not a compliance control.** It is a convenience. The API is callable directly, and a
control that exists only in React is one fetch away from being bypassed — it would also be useless
as evidence, since it leaves no record of having blocked anything.

Mirror `canSendReview()` exactly — it is already the right shape, server-side with a discriminated
reason, enforced in the route rather than the dialog:

```ts
export type MessageBlockReason =
  | "no-number"          // unparseable or absent
  | "no-consent"         // no consent basis on record
  | "consent-expired"    // basis too old, see window below
  | "opted-out"          // STOP received — permanent
  | "a2p-not-verified";  // the client's campaign isn't live yet (§5 `messaging` gate)

export async function canMessageContact(
  acctScope: string,
  e164: string | null,
): Promise<{ allowed: true } | { allowed: false; reason: MessageBlockReason }>;
```

Called by `POST /api/portal/messages` **before** any Twilio call, and separately by the GET that
renders the thread so the UI can show the reason. Same value, two consumers, one authority.

### Consent has a window, and inbound refreshes it

Consent to be contacted about an enquiry is not perpetual. A reply four months later to a form from
January is not responsive, it is cold outreach.

- Default window: **90 days** from the most recent consent event or inbound message _(decide the
  number)_
- **Any inbound message or call from that number refreshes it** — the cleanest possible signal that
  the channel is still live
- Past the window the thread goes **read-only** rather than disappearing: the history stays visible,
  the composer is disabled with an explanation, and it unlocks again the moment they contact the
  business

### Where the "default message" idea does belong

Reframed, it is a good instinct. Not a consent request — a **compliant first reply**. The first
outbound message in any thread must identify the business and carry opt-out language, which is a
carrier expectation for the campaign regardless of consent. So:

- Pre-fill the first reply from a template: *"Hi {firstName}, it's {businessName} replying about your
  enquiry. {editable} Reply STOP to opt out."*
- The client may edit the middle; business identification and the STOP tail are **appended
  server-side and never trusted to the client-edited body** — exactly as `review-request.ts` already
  does with the review link and tail
- Only the *first* message in a thread needs the full identification; subsequent replies in an active
  conversation do not

### Separate namespace from the owner-alert consent store

`app/lib/sms-consent.ts` keys on `sms:consent:log:{phone}` with `ConsentSource` of
`agreement | portal-settings | sms-keyword`. That store is the **owner-alert program** — JDD's own
`ACCOUNT_NOTIFICATION` campaign, a different registrant and a different legal basis.

**Do not reuse it.** Conflating the two would make "did this person consent?" ambiguous about *which
program*, and the keys are not account-scoped, so one client's customer consent would be visible
across the whole estate. Use a new acct-scoped namespace:

```
portal:msg-consent:v1:{acctScope}:{e164}       → basis + hash + timestamps
portal:msg-consent:log:v1:{acctScope}:{e164}   → append-only events
```

Append-only, same reasoning as `sms-consent.ts`: revoking appends a revocation rather than editing
the grant, because history that can be rewritten is not evidence.

### STOP

Already half-built. The inbound webhook (`app/api/webhooks/twilio-sms/route.ts`) handles STOP and
calls `markReviewOptOut`. Extend the same branch to write a revocation into the namespace above, so
one STOP from a customer blocks review requests **and** thread replies. Twilio's Advanced Opt-Out
blocks at the carrier either way; this keeps our own records truthful, which is the half that an
audit reads.

### What this does not resolve

**Review requests remain the weak case, and this does not fix them.** A review request weeks after a
completed job is not responsive to an enquiry, so the consumer-initiated basis does not cover it.
`PLAN-portal-crm-review-sms.md` decision 5 already accepted that as a documented-risk transactional
follow-up with a one-per-number hard block. That posture is unchanged here — but note the gate above
gives it a better foundation than it had: a review request to a number whose only consent basis is
`inbound-call`, outside the window, is now *visibly* the riskiest send in the system rather than
indistinguishable from the rest.

Not legal advice. The framing above is the defensible reading of conversational-messaging practice,
and it is a judgment call of the same kind already recorded in that decision.

---

## 12. Coordination with the CRM v2 work

A separate agent is building the portal CRM (v2) against the same surfaces. Division of labour as of
2026-10-29:

| Owned here | Owned by CRM v2 |
|---|---|
| `/api/contact` always-ingest + callback (§1, §2) | Inbox and Customers nav + all portal lead UI |
| `POST /api/ingest/lead`, per-client token auth (§4) | Consuming `GET /api/portal/leads` |
| `portal-leads.ts`, the `WebLead` shape (§3) | `portal:crm:v2:*` namespaces |
| `onboard.js` env + token minting (§1e) | Pipeline, transcripts, customer records |
| A2P registration, lanes, notification number (§1a–1d) | Rendering the `messaging` pending state |
| Teardown sweep of vendor + KV resources (§1e) | — |

### Adopted from their review

Their points 1–8 are incorporated above: the `crm` gate dropped `airtableBaseId`, the `messaging`
gate was added, navigation became two items, step 5 was withdrawn, `a2pStatus` joined step 1,
portal-KV teardown was added, `LEAD_BRAND_NAME` was resolved as droppable, and the
`crm-contacts.ts` reference was replaced with a direct `phone.ts` import.

### Published contracts — changes need a heads-up both ways

- **`WebLead`** (§3) — the Inbox is built against it
- **`a2pStatus`** states and `not-applicable` as a terminal value (§1b)
- **`CLIENT_MESSAGING_SERVICE_SID` vs master naming**, and `sendSms()` taking the service as a
  **required** argument (§1d) — reached independently by both sides
- **`TWILIO_NOTIFICATION_NUMBER`** as the Account-lane sender (§1a, §1c)

### One `jdd-schema` release must carry all of it

Whoever cuts it first includes the whole set, or the other side's code will not typecheck:

- `twilioNumber`, `messagingServiceSid`, `a2pStatus` on `PortalSite`
- `WebLead`
- `leads` / `crm` / `messaging` gates, with `FEATURE_REQUIREMENT` values made optional

**Correction to the incoming note:** it said "current released version is v1.29.0," which is true of
the *source* but hides a split pin. Verified 2026-10-29:

| Consumer | Pinned | Installed |
|---|---|---|
| `jdd-ops` | `#v1.28.0` | 1.28.0 |
| `jdd-ops/console` | `#v1.28.0` | 1.28.0 |
| `juneau-digital-designs` | `#v1.29.0` | 1.29.0 |

So the agency site is already a version ahead and **two of three consumers are behind**. This is not
cosmetic: `onboard.js` is what writes `a2pStatus`, and it lives in `jdd-ops` at 1.28.0 — it cannot
reference a type it does not have. The release commit therefore has to **re-pin all three**, not
just cut the tag. Follow the existing `chore(deps): pin @jdd/schema vX` convention, and re-pin ops
and console in the same commit that bumps the schema.
