# PLAN — Operator-driven A2P registration in the console

**Repo:** `jdd-ops` (console + ops root), with one stripping commit in `juneau-digital-designs`
**Date:** 2026-10-31
**Supersedes:** the client-driven design in `juneau-digital-designs/HANDOFF-a2p-onboarding-identity-step.md`
**Reads with:** `~/Desktop/JDD-a2p-isv-runbook.html` (the chain), `HANDOFF-console-onboarding-a2p.md`
(the console's own A2P context — **§6 of it is now wrong, see Phase 6**), `PLAN-portal-form-capture.md` §1b
**Status:** plan, approved decisions recorded in §2, no work started

---

## 1. Why this exists

A2P registration can be delayed for days by a single wrong field, and the operator is the one who
carries that cost. The shipped design let the client's wizard submit trigger the TrustHub calls
directly, with no human between the client's typing and Twilio. This moves the whole flow into the
console, where the operator reviews every value and clicks every vendor write.

**What is actually being moved.** The commit in the agency repo (`7175ecd`) created four *identity
objects* — business EndUser, representative EndUser, Address, address supporting document. It never
created a brand or a campaign and never submitted anything for review, so no registration attempt
has ever been filed. The brand, the campaign, the profile, the evaluation and the submit do not
exist anywhere yet. **This plan is therefore half migration, half first build of the chain.**

---

## 2. Decisions locked (operator, 2026-10-31)

| # | Decision |
|---|---|
| 1 | **Split collection.** The wizard collects business-register fields only. The EIN *and* the authorized representative's name, title, direct email and mobile are typed by the operator in the console. |
| 2 | **Scope is runbook phases 2–4** — profile, identity objects, attach, evaluate, submit, trust product, brand, client Messaging Service, campaign, number attach. **No status poller**; the operator refreshes status by hand. |
| 3 | **Every Twilio write is click-gated.** Identity creates, all three submits, and the Messaging Service / number attach. Nothing reaches Twilio without an explicit confirm. |
| 4 | **The console checks Phase 0** (ISV Reseller conversion + policy SIDs) and hard-blocks per-client registration until it passes. |
| 5 | **The A2P SIDs stay in the Redis record** `jdd:a2p-registration:{slug}`. The console reads and writes that record; a follow-up corrects `/manage` and the sibling handoff, which planned `.env.local` keys instead (Phase 6). |
| 6 | **The portal shows progress with no timeframe.** The console advances `PortalSite.a2pStatus` at each gate. |
| 7 | **The agency commit is stripped, not reverted.** The `.mjs` modules and the test move into `jdd-ops`; the wizard keeps a plain intake form with no EIN field. |
| 8 | *(2026-11-02)* **Build the sole-proprietor path too, the way Twilio actually defines it.** It is not "the EIN path minus the EIN": it is a *Starter* customer profile (policy `RN806dd6…`, a `starter_customer_profile_information` EndUser), a *Sole Proprietor* trust product (policy `RN670d5d…`, a `sole_proprietor_information` EndUser carrying the owner's mobile), `BrandType=SOLE_PROPRIETOR`, an SMS OTP the owner must answer YES to, and `UsAppToPersonUsecase=SOLE_PROPRIETOR`. Both policies were read live and are recorded under `test/fixtures/trusthub/`. Enterprise is refused this path (one number per sole-prop campaign). |
| 9 | *(2026-11-02)* **Business industry is console-only (closes §9.1).** The wizard stops collecting it; the operator picks it in the console, defaulted from the vertical via `DEFAULT_INDUSTRY_BY_VERTICAL`. One copy of the TCR enum, in `lib/a2p-identity.js`, so there is nothing to pin. |
| 10 | *(2026-11-02)* **The end-to-end mock run uses the `_e2e_test_growth` client** ("Your HVAC Co"), with `Mock=true` on the brand, so the whole stack is exercised rather than a brand against JDD's own bundles. Every write in that run is still click-gated. |

---

## 3. Facts this plan rests on (verified, not assumed)

1. **Phase 0 is done (corrected 2026-11-02 — this fact originally read "not done").** The primary
   profile `BU09473483d4fd6808a200190e84309592` is `twilio-approved` with
   `business_identity: isv_reseller_or_partner`, it is recorded in `jdd-ops/.env` as
   `TWILIO_PRIMARY_PROFILE_SID`, and `node scripts/a2p-readiness.js` reports READY on all six checks.
   The two chain policies are **absent from `GET /v1/Policies`** on this account (49 results, all
   Alphanumeric Sender ID), so `lib/a2p-readiness.js` resolves them by SID and verifies them by name.
   Phase 1's "discover from the listing" design is superseded by that; do not reintroduce it. The
   readiness gate itself still blocks every per-client write.
2. **The whole chain is API-driven.** Runbook phases 1–5 are all tagged `Automatable`; 2.7, 3.2 and
   4.2 are `AutomatableWait` (file, then wait on review) and only 5.2 — one real test message — is
   `Manual`. There is no step that forces the operator into the Twilio dashboard. The dashboard
   stays useful for diagnosing a rejection, not for doing the work.
3. **No A2P chain code exists in `jdd-ops`.** No `lib/a2p-register.js`, no TrustHub calls anywhere.
   Only `a2pStatus` plumbing exists: `onboard.js:2326` already sets it (`none` for
   growth/enterprise, `not-applicable` for starter/web-only) and preserves a prior value.
4. **The moved modules fit this repo's conventions exactly.** Root is `"type": "module"`, `lib/*.js`
   is plain ESM, and `npm test` is `node --test "test/**/*.test.mjs"`. The agency-repo modules are
   plain ESM with `@ts-check` for precisely this reason; they become `lib/a2p-identity.js` and
   `lib/a2p-trusthub.js` with no rewrite, and their test runs under the existing suite.
5. **The console can call ops-root code server-side.** `findOpsRoot()` resolves the root, and
   `src/lib/intake.ts:83` establishes the pattern: `await import(/* webpackIgnore: true */ url)`.
   **This is not the ring-window situation.** That one needed two copies because
   `src/lib/envFields.ts` is bundled into the *client*. A2P vendor code is server-only, so it has
   one copy in the ops root — see the trap in §5 Phase 3 for the one piece that is client-bundled.
6. **The console has no auth and assumes localhost** (`next dev -p 3040`). That makes it a *better*
   place for an EIN than a public Vercel route — no public endpoint, no Vercel log retention, no
   client browser — provided the three leak paths in §6 are closed.

---

## 4. Target architecture

```
CLIENT (agency site, Vercel)                 OPERATOR (console, localhost:3040)
─────────────────────────────                ──────────────────────────────────
wizard "Business registration"
  legal name, business type,
  industry (TCR enum), website,
  address street/city/region/zip/country
         │
         │  POST /api/onboarding/a2p-intake
         ▼
  jdd:a2p-intake:{slug}  ← no EIN, no rep PII, reviewable, editable
         │
         └──────────── read ────────────────▶  /c/{slug}/manage/messaging
                                                 │
                                                 ├─ prefilled + fully editable
                                                 ├─ operator types EIN  ─────┐
                                                 ├─ operator types rep PII ──┤
                                                 │                           │  one request each,
                                                 ▼                           │  consumed on the
                                              [click] each vendor write ─────┘  step that needs it
                                                 │
                                                 ▼
                                        jdd:a2p-registration:{slug}   ← SIDs + evaluation only
                                                 │
                                                 └─▶ PortalSite.a2pStatus → client portal progress
```

**The key property, kept from the original design and strengthened.** Each sensitive value is typed
on the step that consumes it, not on one big form: the EIN appears only on the "create business
EndUser" step, the rep's email and mobile only on the "create representative" step. Click-gating
every write therefore *improves* the retention story rather than complicating it — there is no
window in which a collected secret is waiting around for a later step.

---

## 5. Phases

### Phase 0 — pre-flight (no code)

1. Record `cd console && npm test` and root `npm test` as green baselines. Root suite is ~1s.
2. Confirm nothing else is mid-edit in `console/src/lib/manageSections.ts` or `envFields.ts`.
3. Do not touch `console/src/lib/runbook-content.ts` — the sibling handoff owns it.

### Phase 1 — Phase 0 readiness panel (do first; everything else is blocked on it)

**New:** `console/src/app/api/manage/a2p/readiness/route.ts`, surfaced on the new section and on
`/manage` Overview as a single blocking tile.

Reads live, caches nothing:
- `GET /v1/CustomerProfiles/{TWILIO_PRIMARY_PROFILE_SID}` — asserts it exists and its business type
  is ISV Reseller or Partner. Absent SID is a distinct, clearly-worded failure, not a crash.
- `GET /v1/Policies` — discovers the secondary-profile and A2P-messaging policy SIDs rather than
  hardcoding them (runbook 0.2). The runbook's literal `RNdfbf…` is a fallback to compare against,
  never the source.
- Asserts `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` present.

`ok` is `true | false | null` per repo convention — **`null` means "could not check" and is never a
pass.** Every per-client action in Phase 3–5 is disabled while readiness is not `true`, server-side
as well as in the UI. The panel tells the operator exactly what to change in the Twilio console and
which env key to record.

### Phase 2 — move the vendor modules into the ops root

| From (agency repo) | To | Change |
|---|---|---|
| `app/lib/a2p-identity.mjs` | `jdd-ops/lib/a2p-identity.js` | rename only; it is already plain ESM with `@ts-check` |
| `app/lib/a2p-trusthub.mjs` | `jdd-ops/lib/a2p-trusthub.js` | rename; add the phase 2.1/2.5/2.6/2.7 and phase 3/4 calls (Phase 3 below) |
| `app/lib/a2p-registration-store.mjs` | `jdd-ops/lib/a2p-registration-store.js` | rename; widen the record (§7) |
| `test/a2p-identity-retention.test.mjs` | `jdd-ops/test/a2p-identity-retention.test.mjs` | drop the two draft-store wiring tests (they stay in the agency repo); keep the vendor, scrub, rollback and validation tests |

`lib/a2p-identity.js` keeps the TCR industry enum, the business-type enum, the EIN pattern,
`findTaxIdPaths`, `scrubVendorMessage` and the validators **unchanged** — they were written against
the runbook and Twilio's reference, and nothing about moving repos changes them.

### Phase 3 — the chain: `lib/a2p-register.js`

One module, one exported function per runbook step, each taking explicit arguments and an injectable
`fetchImpl` so the suite drives the real code with a spy. No step calls another; the console
sequences them, because the console is where the clicks are.

| Fn | Runbook | Gate |
|---|---|---|
| `createSecondaryProfile` | 2.1 | click |
| `createBusinessEndUser` | 2.2 | click — **the only consumer of the EIN** |
| `createRepEndUser` | 2.3 | click — **the only consumer of the rep's email/mobile** |
| `createAddressAndDocument` | 2.4 | click |
| `attachEntities` | 2.5 | click — includes the primary-profile assignment that declares the reseller relationship |
| `evaluateProfile` | 2.6 | click, free, repeatable |
| `submitProfile` | 2.7 | click — **blocked unless the last evaluation returned `compliant`** |
| `createTrustProduct` | 3.1 | click |
| `registerBrand` | 3.2 | click |
| `createClientMessagingService` | 4.1 | click |
| `createCampaign` | 4.2 | click |
| `attachNumberToService` | 4.3 | click |
| `readStatuses` | 5.1 | read-only refresh button |

**The evaluation is the answer to the delay problem.** 2.6 is a free dry run returning field-level
compliant/noncompliant. Submit is disabled until it passes, and the per-field results render in the
UI. This turns "a wrong field costs days" into "a wrong field costs one click and a retype."

**Client-bundle trap.** The industry and business-type enums are needed by the console's *client*
component for its selects, and a client component cannot import from the ops root — this is the
envFields constraint, and copying the enum would recreate the ring-window two-copies problem. So the
section's **server** component imports `lib/a2p-identity.js` via the `webpackIgnore` pattern and
passes the enums down as props. One copy, no drift, no new pinning test.

### Phase 4 — the console section

- `console/src/lib/manageSections.ts`: one entry, `{ id: 'messaging', label: 'Messaging & A2P', icon: 'chat', plans: VOICE }`. `VOICE` is already `['growth','enterprise']`, so Starter and web-only never see it — the same gate the voice-agent section uses.
- `console/src/components/manage/MessagingSection.tsx`: a stepper driven by the registration record. Each step shows its state (not started / created `SID` / submitted / approved / failed), its gate button, and a `ConfirmWrite` dialog (the component already exists) naming exactly what will be filed.
- `console/src/app/api/manage/a2p/[step]/route.ts`: one route, one step per call, each loading the ops-root module server-side. **Reads `?slug=`, takes everything else in a POST body** — never a query string.
- Intake review: the business fields render prefilled from `jdd:a2p-intake:{slug}`, fully editable, with the operator's edits saved back to that record. A client typo is corrected here, before anything is created.
- A "what the client still owes us" list for an absent intake record, so the operator can chase specific fields rather than re-asking for everything.

### Phase 5 — the agency repo, stripped to intake

One commit in `juneau-digital-designs`:

- **Delete** `app/api/onboarding/a2p-identity/route.ts`, `app/lib/a2p-trusthub.mjs`,
  `app/lib/a2p-registration-store.mjs`. Revert the `proxy.ts` matcher widening **only if** no route
  remains under `/api/onboarding/` — the intake route below lives there, so the matcher stays and
  its comment is reworded.
- **New** `app/api/onboarding/a2p-intake/route.ts` — GET returns the intake record for prefill, PUT
  writes it. No Twilio call anywhere in this repo any more. It **rejects any payload carrying a
  tax-ID-shaped value or an `ein` key**, so the client cannot send one even with a stale bundle.
- **Keep** `app/lib/a2p-identity.mjs` in the agency repo too? **No** — the agency side needs only
  the enums and `findTaxIdPaths`. It keeps a trimmed `app/lib/a2p-intake.mjs` with the industry
  enum, the address validators and `findTaxIdPaths`. The EIN pattern, the TrustHub builders and the
  scrubber go with the vendor code. *Two files now share an industry enum across two repos* — pin
  them equal with a test in the agency repo that reads the ops-root copy, or accept the drift
  knowingly. **Decide before building** (§9).
- The wizard step drops the EIN field, the sole-proprietor choice and the entire representative
  block. Copy changes from "we send this to Twilio now" to "we pass this to our carrier
  registration" — it is no longer true that the client's submit reaches Twilio.
- The A2P fields **stay out of `formData`** and keep their own `useState`, but now persist by
  posting to the intake record on step-advance — so a reload restores them from the record rather
  than from a draft store. The `WizardData` membership test and both draft tripwires stay exactly as
  they are: cheap, and the thing they prevent is the thing someone would otherwise re-add.
- Keep `test/a2p-identity-retention.test.mjs`, reduced to the draft-store half: the tripwire wiring,
  the `WizardData` membership assertion, and the no-false-positives case.

### Phase 6 — the SID-store follow-up (operator's explicit ask)

`HANDOFF-console-onboarding-a2p.md` §6 plans `A2P_*` SIDs as read-only keys in
`console/src/lib/envFields.ts`, i.e. in `clients/{slug}/.env.local`. **Decision 5 overrides that.**
Written as its own handoff — `HANDOFF-a2p-sid-store-correction.md` — because another session may be
working from the sibling handoff right now. It must cover:

1. `envFields.ts` — do **not** add `A2P_*` keys. Note why, inline, or someone adds them back.
2. `/manage → Environment` shows no A2P SIDs; the new Messaging section is their only surface.
3. `CLIENT_MESSAGING_SERVICE_SID` is the **exception** and stays an env var — it is operational
   client config that `onboard.js`, `vercel-sync` and the reconcile probe read, not chain state.
   Its value is also mirrored to `PortalSite.messagingServiceSid` for the portal, as today.
4. `lib/reconcile-probes.js` — the A2P probe reads the Redis record, and the existing master-pool
   probe still needs inverting per the sibling handoff §5.
5. `lib/provisioned-fields.js` / teardown — a torn-down client's registration record must be
   removed too, guarded on registration never having completed (deleting a live brand's objects
   breaks a real registration).

---

## 6. Security invariants, and what enforces each

| Invariant | Enforced by |
|---|---|
| The EIN is never written to any store | `assertNoTaxId` on the registration record (value-shape, survives renames) + the intake route rejecting tax-ID shapes + the two existing draft tripwires in the agency repo |
| The EIN exists for one request | It is a field on the 2.2 step only, posted to a route that calls Twilio and returns `{ ok: true }`. No step before or after it holds the value |
| No request body is logged | Explicit in the route; audit gets the event and the step name, never a field value — matching the console's existing key-names-not-values convention |
| A vendor 400 cannot leak it | `scrubVendorMessage` + `A2pVendorError` scrubbing **at construction**, already built and tested. Twilio quotes the offending value back, and an unhandled throw prints `error.message` |
| It never reaches the audit log | `console/.state/audit.ndjson` entry is `{ slug, step, at }`. A tax-ID-shape assertion on the audit payload, since this is the one log that is written to disk and kept |
| It never travels in a URL | Step routes read `?slug=` only; everything else is a POST body. (Vercel logs search params — irrelevant on localhost, but the habit is the protection) |
| It is never rendered back | No read-back of EndUser attributes into the UI. The section shows SIDs and statuses. If a correction needs the EIN again, the operator retypes it |
| The console is not reachable off-box | Confirm `next dev` is not bound to `0.0.0.0`; the console still has **no auth of any kind** |

---

## 7. Data model

**`jdd:a2p-intake:{slug}`** — written by the agency site, read and edited by the console. No TTL
(it is reference data the operator may need weeks later, and holds nothing sensitive). Contains:
`legalBusinessName`, `businessType`, `businessIndustry`, `websiteUrl`,
`address{street,city,region,postalCode,country}`, `submittedAt`, `updatedAt`, `updatedBy`.

**`jdd:a2p-registration:{slug}`** — the chain's state, console-owned, no TTL. Widened from what
shipped: `registrationPath`, `profileSid`, `businessEndUserSid`, `repEndUserSid`, `addressSid`,
`addressDocSid`, `trustProductSid`, `brandSid`, `campaignSid`, `messagingServiceSid`,
`lastEvaluation{status, results[], at}`, and a timestamp per gate. Nothing in it is sensitive;
`assertNoTaxId` runs on every write regardless.

**`PortalSite.a2pStatus`** — already in `@jdd/schema` v1.30.0 and already initialised by
`onboard.js`. The console advances it on gate clicks and status refreshes:

| Gate | Status after |
|---|---|
| 2.7 submit profile | `profile-pending` |
| refresh shows profile approved | `profile-approved` |
| 3.2 register brand | `brand-pending` |
| refresh shows brand approved | `brand-approved` |
| 4.2 create campaign | `campaign-pending` |
| refresh shows campaign verified | `verified` |
| any rejection | `failed` — surfaced to the operator; maps to `connecting` for portal consumers |

---

## 8. Tests

Root suite, `node --test "test/**/*.test.mjs"`, importing real implementations:

1. The moved retention tests (vendor half) — the EIN reaches exactly one outbound request, no
   persisted value is tax-ID-shaped, a vendor 400 cannot carry it, a partial failure deletes what it
   created, the store refuses a tax-ID-shaped write.
2. **Submit is blocked without a compliant evaluation** — `submitProfile` refuses when the record's
   `lastEvaluation` is absent, stale, or `noncompliant`. This is the delay-prevention guarantee, so
   it is a test and not a UI convention.
3. **Readiness blocks every per-client write** — each gate function refuses when the primary profile
   SID is absent, since a profile submitted without the reseller link is a wasted attempt.
4. **The attach step includes the primary profile** — four `object_sid`s, not three.
5. **Enterprise cannot take the sole-proprietor path**, and the sole-prop path omits the
   registration-number attributes rather than sending them empty.
6. `assertNoTaxId` on the audit payload shape.
7. Agency repo: the draft-store half, plus the intake route rejecting a tax-ID-shaped payload.

Per repo convention, vendor *response* fixtures are recorded, never hand-written. The spies above
assert on **our outbound calls**, which is legitimate. The one shape worth recording for real is the
2.6 evaluation response, once a live profile exists — until then, the evaluation parser is written
defensively and that is stated in its comment rather than assumed away.

---

## 9. Open items to settle before building

> **Resolved 2026-11-02.** 1 → decision 9 (console-only industry). 2 → **merges**: a live
> `POST /v1/EndUsers/{sid}` carrying only `business_name` updated that one key and left the other
> five intact (throwaway EndUser, fake data, no EIN, deleted after — `DELETE` returned 204 and a
> re-read 404). A correction therefore never needs the EIN retyped. 3 → moot: the sole-prop path
> does not use a business EndUser at all (decision 8); that same live call did confirm TrustHub
> *accepts* a business EndUser with no registration number at create time, though it was never
> evaluated. 4 → deferred to the orchestrator's §6 item 5; the registration record carries
> `messagingServiceSid` for it to read. 5 → done (§3 fact 1).
>
> **One more vendor fact the docs got wrong.** Twilio's ISV guide documents an evaluation's
> per-requirement results as `valid[]` / `invalid[]`. Every recorded evaluation on this account
> (`test/fixtures/trusthub/evaluation-*.json`) carries `results[].fields[]` with a `passed` boolean
> per field instead. The parser reads the recorded shape and treats the documented one as a
> fallback.

1. **The shared industry enum.** Two repos now need the TCR list. Pin them with a test, or keep one
   copy and have the agency wizard fetch the enum from... nowhere — it is a separate deployment.
   Most likely answer: duplicate it and pin with a test, as `test/ring-window.test.mjs` already does
   for the ring window. *Needs a decision.*
2. **Does `POST /v1/EndUsers/{sid}` merge attributes or replace them?** Unverified. If it replaces,
   correcting a business name after creation requires the EIN to be retyped, which changes the
   correction UX. Check with one live call before designing the correction flow.
3. **Is a business EndUser accepted with no registration number** on the sole-proprietor path? Still
   unverified, carried over from the shipped code. One live call answers it.
4. **`CLIENT_MESSAGING_SERVICE_SID` ownership** — confirm which readers genuinely need the env copy
   now that 4.1 happens in the console rather than in `onboard.js`.
5. **Phase 0 itself** — the ISV Reseller conversion is a manual Twilio-console action and nothing
   here can do it. The readiness panel makes it visible; someone still has to do it.

---

## 10. Risks

| Risk | Handling |
|---|---|
| Phase 0 never gets done, and registrations are filed as a direct business | Readiness hard-blocks every gate server-side, not just in the UI |
| A stale agency bundle still posts an EIN after the strip | The intake route rejects tax-ID-shaped payloads outright |
| Twelve gate buttons become a flow nobody follows correctly | The stepper derives its state from the record, so the next legal action is always the only enabled one |
| Two industry enums drift | Open item 1 — decide before building |
| The console has no auth and will hold an EIN in a form | Localhost-only, confirmed unbound from `0.0.0.0`; the value is consumed by one request and never rendered back |
| A half-migrated state where both repos can create identity objects | Phase 5 deletes the agency route in the same change that adds the intake route |

---

## 11. Explicitly out of scope

The status poller (decision 2 — manual refresh instead); runbook 5.2's real test message, which
stays a manual operator step; `runbook-content.ts` copy, owned by the sibling handoff; the Make
scenario and notification-number work from `PLAN-portal-form-capture.md`; anything under
`app/components/portal/Crm*`, `app/lib/portal-crm.ts`, `app/lib/crm-contacts.ts` or
`app/api/portal/{crm,customers,inbox,messages}` in the agency repo, which are mid-rewrite.
