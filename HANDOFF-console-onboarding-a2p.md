# HANDOFF — Console onboarding: Make scenario inputs + the A2P paradigm shift

**Repo:** `jdd-ops` (console)
**Date:** 2026-10-29
**Status:** context only — no work started
**Driver:** `PLAN-portal-form-capture.md` §1a–1e and `~/Desktop/JDD-a2p-isv-runbook.html`

---

## 1. What this is

The console's onboarding runbook tells an operator how to stand up the master Make scenario and the
A2P registration. Decisions taken on 2026-10-29 changed both, so the **step copy and the inputs it
asks for are now wrong**. An operator following the current steps literally would build a scenario
that fails for every new client.

This is primarily a **content + inputs** change in `console/src/lib/runbook-content.ts`, with knock-on
changes in the env plumbing. It is not a redesign of the runbook shell.

---

## 2. What changed, in one table

| | Before | After |
|---|---|---|
| Post-call brief sender | the **client's** `TWILIO_NUMBER` | a dedicated **JDD notification number** (`TWILIO_NOTIFICATION_NUMBER`), constant across all clones |
| Post-call brief routing | bare `From`, `messaging_service_sid = NULL` | through JDD's **master** Messaging Service, so it rides the approved campaign and inherits Advanced Opt-Out |
| Client number → sender pool | `onboard.js` adds it to the **master** pool | Growth/Enterprise numbers join **their own** service; Starter/web-only join none |
| A2P campaigns | one shared JDD campaign | JDD's `ACCOUNT_NOTIFICATION` (owner alerts) **plus** a per-client `CUSTOMER_CARE` campaign per Growth/Enterprise client |
| `TWILIO_MESSAGING_SERVICE_SID` | single master value | master stays; per-client becomes **`CLIENT_MESSAGING_SERVICE_SID`** — see §5 |
| Lead delivery | Resend email (Starter) / callback (Growth) | portal capture on every tier, plus callback on Growth/Enterprise |

---

## 3. `console/src/lib/runbook-content.ts` — the specific lines

### Section `a-make-post`, step `a-make-post-build` (~line 519)

**Line 529** currently says:

> Module: Twilio → Send a Message (JDD SID/auth connection). Leave From and To as PLACEHOLDERS —
> onboard.js sets From = client TWILIO_NUMBER and To = the owner's CONSENTED alert number per clone.

`From` is **no longer per-clone**. It is a constant: the JDD notification number. That makes it one
fewer field `patchPostCallBlueprint` has to remap, and it is the whole reason the brief works on day
one for a client whose own A2P registration has not completed. Rewrite to:

- `From` = `TWILIO_NOTIFICATION_NUMBER`, set **once in the master**, identical in every clone
- `To` = the owner's consented alert number, still per-clone
- `MessagingServiceSid` = JDD's **master** service — explicitly set, not omitted

**Line 530** already says to send via the Messaging Service rather than a bare `From`. The
instruction is correct; the implementation never followed it. Measured 2026-10-29: **every message
in the account has `messaging_service_sid = NULL`.** Keep the instruction, and add a verification
substep that reads a message record back and asserts the field is populated — the only way to catch
this is to look.

**Line 528** lists the Airtable mapping as *Date / Caller name / Caller number / Summary / Duration /
Call type / Outcome* — **seven fields. `CLAUDE.md` specifies eleven**: Date, Caller name, Caller
number, Summary, Duration (seconds), Call type, Email, Address, Recording URL, Priority, Outcome
(+ `Site` for enterprise). This is pre-existing drift, not caused by the new work, but it matters
more than it looks: `CLAUDE.md` states the column list is *a contract with the Make master scenario*,
and a column the master writes that `createAirtableBase` does not create is **silently dropped from
every logged call**. Fix the list and run `npm run verify-post-call`, which diffs both sides against
the live master and exercises the real `patchPostCallBlueprint`.

**Line 531** pins the SMS body and notes it must match the A2P campaign sample and `/sms-terms`. Keep
that constraint — it is correct and load-bearing. Note the body stays on the Account lane, so it does
**not** need to change for the per-client campaign work.

### Section `a-twilio-a2p` (~line 548)

This whole step describes registering **JDD** once. That remains necessary but is now only half the
picture. Needed:

- **Line 555** — "Register the JDD Brand (business/EIN) once" → add that the primary business profile
  must be converted to business type **"ISV Reseller or Partner"** in Trust Hub, and its SID recorded
  as `TWILIO_PRIMARY_PROFILE_SID`. Every per-client Secondary Customer Profile links back to it;
  omit that link and the profile evaluates as a direct business and the ISV posture collapses.
- **Line 557** — "Use-case: Customer Care / account notifications" is ambiguous and the live value is
  specific. Measured: the existing campaign is `ACCOUNT_NOTIFICATION`, `has_embedded_links: false`.
  State it exactly, and state that it carries **owner alerts only**.
- **Line 561** — rewrite. The master-pool join is no longer how client numbers are handled, and the
  hard-fail logic it describes changes (§5).
- **Line 565** — "Until a number's registration is approved, owner SMS silently fails with 30034"
  becomes **false for owner alerts**, because they now send from the already-approved notification
  number. It stays true for customer-facing SMS. Reword to distinguish the lanes, or an operator will
  read a pending A2P status as "briefs are broken" when they are fine.
- **New step needed** — buying and wiring the notification number. Full manual walkthrough is in
  `PLAN-portal-form-capture.md` §1c. Local Orlando number (407 → 321 → 689), **never toll-free**,
  added to the master service, pool read back, `voiceUrl` left unset, one real test message verified.
- **New section needed** — per-client A2P registration (Growth/Enterprise only). Do **not** inline the
  nine-call TrustHub chain here; link to `JDD-a2p-isv-runbook.html`. Two descriptions of that chain
  will drift and the runbook is the one with verified endpoints. What the console step *should* carry:
  the status the operator is waiting on, where it is surfaced, and what to do on `FAILED`.

### New onboarding inputs

The wizard has to collect what TrustHub needs, which the intake does not have today. Full gap table
in the runbook §"Four facts" #4. Summary:

- Legal business name *(must match the IRS record character-for-character)*
- Business type, EIN, TCR business-industry **enum** (not freeform), website URL
- Address **decomposed** — street / city / region / postal / country as separate fields. The schema
  has one freeform `address: string`; do not try to parse it, a mis-parsed region fails the
  compliance evaluation with no obvious cause
- Authorized representative: first name, last name, job position, business title, direct email, phone

**The EIN has a hard constraint: zero retention.** Submit-and-consume in a single request, never
written to KV, disk, logs, `site.ts` or the audit log. Read `PLAN-portal-form-capture.md` §1b in full
before building the field — retrofitting this is far worse than getting it right once.

---

## 4. The phase contract will fail your build

`onboard.js` emits ten phases via `log(N, …)`. If this work adds one — A2P registration, or the lead
ingest token — **three files must change in the same commit**:

| File | Holds |
|---|---|
| `console/src/lib/onboard-parse.ts:110` | `PHASE_MAP` — regex → label (parse side) |
| `console/src/lib/run-plan.ts:86` | `expectedPhases()` — plan side, including gating per client shape |
| `console/test/phase-contract.test.mjs` | replays recorded dry-run stdout for all four shapes |

Then re-record: `npm run fixtures:dry-run`. Skip it and the new phase renders as unplanned drift
(coral) in the UI and `cd console && npm test` goes red.

**One trap:** check output must never contain the token `FAIL:` — `onboard-parse.ts` treats any line
carrying it as a fatal run and would abort the UI's narration. "A2P campaign not yet verified" is an
**expected** state for roughly three weeks, not a failure. Word it accordingly.

---

## 5. The `TWILIO_MESSAGING_SERVICE_SID` collision

The new paradigm needs a per-client Messaging Service while nine existing readers expect one master.
**Do not reuse the name.** Two readers pull it from `process.env`; a same-named per-client value makes
environment resolution order decide which campaign a message sends under — an environment-dependent
compliance bug that logs nothing and surfaces weeks later as carrier filtering.

| Scope | Variable |
|---|---|
| Master `jdd-ops/.env` | `TWILIO_MESSAGING_SERVICE_SID` — unchanged, JDD's Account lane |
| Per client `.env.local` | **`CLIENT_MESSAGING_SERVICE_SID`** |
| Portal (`PortalSite`) | `messagingServiceSid` — the agency site cannot read a client's `.env.local` |

Console-side readers to touch:

| File | Change |
|---|---|
| `console/src/lib/runbook-content.ts:561` | Rewrite the copy (§3) |
| `console/src/lib/goLive/preflight.ts:108` | Keep the `MG` assertion; add `TWILIO_NOTIFICATION_NUMBER` is E.164 and in the master pool |
| `console/src/lib/go-live-content.ts:257` | Still true of the master; note the agency site now needs the per-client SID from `PortalSite` |
| `console/src/lib/opsSecrets.ts:237` | Add the notification number |
| `console/src/lib/envFields.ts` | Declare the new keys — see §6 |

Ops-side readers (`onboard.js:1277/2674/2881`, `lib/reconcile-probes.js:82`) are enumerated with
their specific before/after in `PLAN-portal-form-capture.md` §1d. **Reconcile's Twilio probe needs
inverting** — it currently flags a live number *not* in the master pool as drift, which is backwards
for client numbers now.

---

## 6. `envFields.ts` — new keys must be declared or they are invisible

`console/src/lib/envFields.ts` drives `/manage → Environment`. A provisioned key absent from it
cannot be seen or edited, so it becomes invisible drift.

| Key | Group | Editable |
|---|---|---|
| `LEAD_DELIVERY_MODE` | leads | existing — **add `portal` as a valid value** (`:128`) |
| `LEAD_INGEST_TOKEN` | leads | read-only (onboard.js owns it; editing breaks ingest until KV is updated) |
| `LEAD_INGEST_URL` | leads | editable — useful for pointing a test client at a preview deploy |
| `CLIENT_MESSAGING_SERVICE_SID` | integrations | read-only |
| `A2P_*` SIDs + `A2P_BRAND_TYPE` + `A2P_CAMPAIGN_STATUS` | integrations | read-only |

Remove `LEAD_TO_EMAIL` and `RESEND_FROM_EMAIL` when Resend is dropped. Note `:212` masks
`^(AIRTABLE|RESEND|MAKE)_` — **`A2P_*` SIDs are opaque references, not secrets, and should not be
masked.** The EIN is the only sensitive value and it is never stored.

Also: this file is bundled by Next and **cannot import from the ops root**, which is why the ring
window exists as two copies pinned equal by `test/ring-window.test.mjs`. Do not try to "fix" that by
importing `lib/client-env.js` here.

---

## 7. `LEAD_INGEST_TOKEN` will silently fail to reach production

`lib/vercel-sync.js:776` **skips empty values.** That is precisely the August Resend bug:
`keep('RESEND_API_KEY')` returned empty on a new client, the key never reached Vercel, and
`/api/contact` 502'd on every lead at a cost of $0 and a loss of 100% of leads.

- Mint the token **unconditionally** in `buildClientEnvLines` (`lib/client-env.js`), never via
  `keep()` with an empty fallback
- `lib/vercel-sync.js:763` hardcodes `['RETELL_API_KEY','TWILIO_NUMBER','RETELL_AGENT_ID']` as
  required for callback mode. The ingest token is required on **every** tier including web-only —
  add a tier-independent required list
- Add a predicate to `lib/onboard-checks.js` asserting it exists, is 64 hex chars, and resolves in
  KV. Both `npm test` and `onboard.js --dry-run` import that module, so the dry run answers "would
  this provision correctly?" rather than merely "would it run"

---

## 8. Definition of done

A console-created Growth site is fully functional at provision time **except** lead replies and
review requests, which wait on A2P. For that to be real rather than aspirational, each of these
should be a `lib/onboard-checks.js` predicate so `--dry-run` can answer it:

1. `LEAD_INGEST_TOKEN` present, non-empty, synced to Vercel, resolvable in KV
2. `twilioNumber` + `messagingServiceSid` written to `PortalSite`, not just `.env.local`
3. The `leads` feature gate resolves `ready` for the new site
4. The post-call brief sends from `TWILIO_NOTIFICATION_NUMBER` through the master service, and a read
   back of the message record shows `messaging_service_sid` **not null**
5. `a2pStatus` set — `not-applicable` for Starter/web-only, `brand-pending` for Growth/Enterprise
6. The portal renders the A2P pending state, not a bare disabled control

---

## 9. Hard rules for this repo

- **Any change to `onboard.js` or `lib/` keeps `npm test` green.** The suite exists because seven
  bugs shipped in the provisioning path and *not one produced an error*.
- **Import real implementations, never mocks.** Fixtures are *recorded*, never hand-written — four
  of those seven bugs were wrong beliefs about vendor APIs, and a hand-written fixture encodes the
  belief, so the test certifies the bug.
- **Every test encodes a bug that actually shipped.** The EIN-retention test in
  `PLAN-portal-form-capture.md` §1b is a deliberate exception, justified in place.
- `ok` is `true | false | null`. **`null` means "could not check"** and is never a pass.
- After touching either side of the Airtable/Make contract, run `npm run verify-post-call`.
- **The master Make scenario is never modified by a run.** A deliberate edit (§3) is fine;
  `npm run fixtures:refresh` reporting `make/master-blueprint.json` unchanged is the proof that
  cloning stayed byte-exact.

## 10. Read first

- `PLAN-portal-form-capture.md` — §1a two lanes, §1c notification number, §1d the SID collision,
  §1e the full cross-repo integration surface
- `~/Desktop/JDD-a2p-isv-runbook.html` — the registration chain, verified endpoints, EIN handling
- `CLAUDE.md` — Twilio ownership, Airtable contract, testing rules
- `RUNBOOK.md` — note it still describes the superseded shared-scenario design in Part A4
