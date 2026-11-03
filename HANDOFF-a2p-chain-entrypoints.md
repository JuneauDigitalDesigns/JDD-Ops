# HANDOFF — A2P chain entry points (for the sales-call flow)

**Repo:** `jdd-ops` · **Branch:** `claude/a2p-registration-chain-ad797f` · **Date:** 2026-11-02
**Owner of everything below:** the A2P chain (`PLAN-console-a2p-registration.md`). Call into it; do
not re-implement any of it, and above all do not build a second EIN form.

---

## 1. How to drive it — two supported ways, nothing else

**A. Embed the UI (recommended).**

```tsx
// in a SERVER component
import { loadA2pEnums } from '@/lib/a2pChain';
import { A2pRegistrationPanel } from '@/components/manage/MessagingSection';

<A2pRegistrationPanel slug={slug} enums={await loadA2pEnums()} embedded />
```

That is the whole stepper: readiness banner, intake corrections, every step form (EIN included), the
always-on confirm dialog, the typed-slug confirm on filings, sensitive-field clearing. `embedded` only
drops the page header and width. It needs no `ManageProvider`.

**B. Call the server entry point** from your own route, if you must drive a step without the panel:

```ts
import { runA2pStepForClient } from '@/lib/a2pServer';
const { status, json } = await runA2pStepForClient(ctx /* ClientContext */, 'profile.create', {
  input: { registrationPath: 'standard' },
  confirm: true,                 // only ever after a human clicked a confirm
  confirmSlug: ctx.slug,         // required for the four filing steps, typed by the human
});
```

The HTTP form of the same thing is `POST /api/manage/a2p/{step}?slug=` with that object as the JSON
body. **The slug is the only thing that may go in the URL.** Never log the body.

Reads: `GET /api/manage/a2p?slug=` (record, steps, availability, intake, what the client still owes)
and `GET /api/manage/a2p/readiness`.

## 2. Steps, inputs, gates

Every step except `status.refresh` is a Twilio write: it needs `confirm: true` and re-runs Phase 0
readiness server-side. **Filing** steps (start a review clock or a fee) also need `confirmSlug`.

| Step | Runbook | Input (`input`) | Needs first | Filing |
|---|---|---|---|---|
| `profile.create` | 2.1 | `registrationPath: 'standard' \| 'sole-proprietor'` (sole-prop refused for Enterprise; fixed forever) | Growth/Enterprise plan | |
| `business.create` | 2.2 | `legalBusinessName, businessType, businessIndustry, websiteUrl, ein` — **the only EIN consumer** | profile | |
| `business.update` | 2.2 | any of the above minus `ein` (Twilio merges) | business EndUser, not filed | |
| `rep.create` | 2.3 | `firstName, lastName, email, phone` (+ `jobPosition` enum, `businessTitle` on standard) | profile | |
| `rep.update` | 2.3 | `jobPosition`, `businessTitle` | rep EndUser, not filed | |
| `address.create` | 2.4 | `customerName, street, city, region, postalCode, country` | profile | |
| `profile.attach` | 2.5 | — | all identity objects | |
| `profile.evaluate` | 2.6 | — (free, repeatable) | attached | |
| `profile.submit` | 2.7 | — | a **current compliant** evaluation | ✓ |
| `trust.create` | 3.1 | standard: `companyType, brandContactEmail`; sole-prop: `brandName, mobile, vertical?` | profile submitted | |
| `trust.evaluate` / `trust.submit` | 3.1 | — | as for the profile | submit ✓ |
| `brand.register` | 3.2 | `mock: boolean` | both bundles **in-review or approved** | ✓ |
| `brand.otp` | 3.2 | — (sole-prop only) | brand APPROVED | |
| `service.create` | 4.1 | `friendlyName` | brand registered | |
| `campaign.create` | 4.2 | `usecase, description, messageFlow, messageSamples[], hasEmbeddedLinks, hasEmbeddedPhone, opt*Message?` | brand APPROVED (+ OTP verified, sole-prop) | ✓ |
| `number.attach` | 4.3 | `siteSlug, moveFromMaster?` — the number comes from that site's `.env.local`, never the body | Messaging Service + a provisioned `TWILIO_NUMBER` | |
| `status.refresh` | 5.1 | — (read-only) | a record | |

`availability(record, …)` in `lib/a2p-register.js` is the single source of which step is legal now; the
GET returns it. Don't recompute it.

## 3. What the chain needs before a client is provisioned

Your working assumption is right, with one timing caveat that matters for "file during the call".

- **Works on a fresh lead conversion.** The routes need only `clients/{slug}/site.ts` with a plan — the
  `/api/leads/convert` shell has `_meta.selectedPlan`. No `.env.local`, number, Messaging Service or portal
  account is needed for anything up to and including `service.create`.
- **Only `number.attach` needs provisioning** (a site `TWILIO_NUMBER`). `campaign.create` needs the
  brand APPROVED, which is days away anyway.
- **Caveat — the brand probably will NOT be filed during the call.** `brand.register` waits for BOTH
  bundles to reach `in-review`, and each starts at `pending-review` when submitted ("often minutes,
  occasionally days"). Realistic in-call goal: identity objects → evaluate → **submit the profile** →
  trust product → evaluate → **submit it**. The brand is a later click after a `status.refresh`. The
  carrier clock that matters (TCR's) starts at the brand, so getting both bundles submitted on the call
  is the win.
- **`/manage → Messaging & A2P` is unreachable before provisioning** — the section page locks every
  section while a client is pending/awaiting onboarding. That is why §1A exists: embed the panel in
  your wizard. The API routes are not gated that way.
- **Portal status gap.** `a2pStatus` is pushed to `PortalSite` only on a status *change*, and only for
  sites with a `CLERK_USER_ID`. A client registered before their portal exists will show `onboard.js`'s
  initial `none` until the next change. Fix belongs where the portal account is linked (onboard.js /
  §6 item 5): set `a2pStatus` from `portalStatusFor(readRegistration(slug))` instead of `none` when a
  record exists. Not done here — onboard.js is another session's.
- **Industry default.** The convert step knows the vertical; `DEFAULT_INDUSTRY_BY_VERTICAL` (in
  `lib/a2p-identity.js`, exposed in `enums.defaultIndustryByVertical`) maps it. The panel currently
  shows that map as a hint because `/manage` has no vertical; the wizard could preselect it.

## 3a. Two things the sales-call flow needs, and how they already work

- **Resume later when the client has no EIN to hand.** Nothing to build. Steps are independent
  clicks gated only by the record: run `profile.create`, `rep.create` and `address.create` on the
  call, and leave `business.create` (the only EIN step) for later. The record keeps the SIDs; the EIN
  was never there, so resuming is simply opening the panel again and filling that one step.
  `profile.attach` stays locked until the business EndUser exists. Do not hold the EIN in wizard
  state "until the client finds it" — that is the retention the whole design exists to avoid.
- **Read-only status for client cards.** Server-side: `(await loadStore()).readRegistration({ slug })`
  then `(await loadRegister()).portalStatusFor(record)` (`none | profile-pending | profile-approved |
  brand-pending | brand-approved | campaign-pending | verified | failed`), plus `record.mock`,
  `record.statuses.brand` and `record.statuses.campaign` for detail. Both loaders live in
  `@/lib/a2pChain`. Or `GET /api/manage/a2p?slug=` → `portalStatus` + `record`. Both are reads of our
  own record: no Twilio call. Fresh vendor state needs a human `status.refresh` (no poller, decision 2).

## 4. Record shape (`jdd:a2p-registration:{slug}`, base client slug, no TTL)

Fixed key list: `REGISTRATION_KEYS` in `lib/a2p-registration-store.js` — writes naming any other key,
or carrying a tax-ID-shaped value, are refused. Read it with `readRegistration({ slug })`; **never
write it** outside `runStep`.

`version, slug, registrationPath, mock, profileSid, businessEndUserSid, repEndUserSid, addressSid,
addressDocSid, profileAssignments, lastEvaluation{status,sid,failures[],at}, profileChangedAt,
trustProductSid, trustEndUserSid, trustAssignments, lastTrustEvaluation, trustChangedAt, brandSid,
brandType, messagingServiceSid, campaignSid, numbers{siteSlug:{e164,phoneNumberSid,inService,…}},
statuses{profile,trustProduct,brand,brandIdentity,campaign,refreshedAt}, errors{brand[],campaign[]},
gates, createdAt, updatedAt`.

Intake (`jdd:a2p-intake:{slug}`, `INTAKE_KEYS`): `legalBusinessName, businessType, websiteUrl,
address{street,city,region,postalCode,country}` + timestamps. No EIN, no rep, no industry.

## 5. Rules you inherit by calling in

- The EIN, rep details and sole-prop mobile exist for one request each. Do not put them in wizard
  state that outlives the step, in a draft, in KV, in a URL, or in a log. The panel already clears them.
- Never send `confirm: true` on a human's behalf without a click; never default `mock` to false.
- After editing any `lib/a2p-*.js`, restart the console (ESM cache — see `console/src/lib/a2pChain.ts`).
