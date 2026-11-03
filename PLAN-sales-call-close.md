# PLAN — Implement "close a client on a sales call"

**Implements:** `DESIGN-sales-call-close.md` (approved 2026-11-03). Where the two disagree, the design wins
and this plan gets fixed.
**Status:** DRAFT. The orchestrator gave the go-ahead (2026-11-03). Waiting for Xander's sign-off. No code has been written.
**Mockup (the UI spec):** https://claude.ai/artifact/BVZRCi4j7MF1tfAZZzsMps. Copy in §9 is verbatim from it.

---

## 0. Ground rules for whoever builds this

- **Three repos, in order:** `jdd-schema` → `juneau-digital-designs` (agency) → `jdd-ops/console`. Each phase
  ends green (§8) before the next one starts.
- **Shared shapes live in `@jdd/schema`, not in two copies.** The order record, its status enum, the
  resume-step function and the readiness function are defined once there and imported by both apps.
  That's the anti-drift rule for this feature.
- **The console never writes Stripe, Clerk or the order.** It *reads* KV directly for display (it
  already reads the same Upstash instance, via `loadKvCredentials`). Every write goes through the
  agency's `/api/ops/orders/*`.
- **No card data, EIN or password** passes through any code in this plan. EIN handling stays inside the
  A2P chain (§6).
- **Before editing any file, re-read it.** Several of these files are long and carefully commented.
  Keep the existing comment density and voice.
- **Not in v1** (deferred by the defaults in §1): the card path ("Enter card" / MOTO), coupons,
  Enterprise, self-serve clickwrap, and editing the call reference.

## 1. Decisions this plan assumes (confirm or change)

| # | Open decision in the design | v1 default in this plan |
|---|---|---|
| D1 | How the card gets in | **Link only.** The "Enter card" tab renders disabled with "Not enabled yet" until Stripe turns on MOTO. Phase 7 builds it then. |
| D2 | Pricing | **Standard prices only.** There's no coupon field, and `allow_promotion_codes` is off on operator sessions. |
| D3 | Enterprise | **Starter and Growth only in v1.** The Enterprise chip is disabled. Enterprise has consolidation and multi-site rules (`growthSitesForConsolidation`, the site list on the master) that deserve their own pass. |
| D4 | Self-serve clickwrap | **Later, as a separate PR.** v1 adds `acceptance` to the record but leaves `/agreement` untouched. |
| D5 | Call reference | **Automatic:** `"Phone call with {lead phone} · {timestamp ET}"`. Editing it, and the recording id, come with the `/manage` Agreement section (Phase 6). |

## 2. Repos, branches, prerequisites

| Repo | Branch | Base |
|---|---|---|
| `jdd-schema` | `feat/operator-orders` → tag **v1.31.0** | `main` at v1.30.0 |
| `juneau-digital-designs` | `feat/operator-orders` | **`origin/master`** (now includes PRs #27 and #28). Not the main checkout, which is on `feat/pricing-2026-10`. |
| `jdd-ops` | `feat/sales-call-close` | **`claude/a2p-registration-chain-ad797f`**. This **merges after a2p-chain**. Rebase onto that branch's tip before opening the PR (it's still gaining commits, e.g. `a6b16b0` profile.reset). No stub for the SMS step. |

**Merge order (orchestrator, 2026-11-03):** schema v1.31.0 → a2p-chain → agency `feat/operator-orders` and
jdd-ops `feat/sales-call-close`. The agency and console pin bumps to v1.31.0 land together.

**Files owned by other sessions. This plan doesn't edit them:**
- `app/lib/legal/schedules.ts` and the terms text. The agency copy session (`claude/sad-engelbart-178a1f`)
  is changing that wording, and Xander approved it word for word. `buildCallScript` *reads* `getSchedule()`
  and `TERMS_VERSION` at runtime, and the terms hash comes from `hashTermsForPlan` at runtime. So their
  change simply becomes a new script version and hash, with no edit here.
- **The agency EIN strip** (follow-up 1 in a2p-chain's `PLAN-console-a2p-registration.md`. As of
  2026-11-03 it's unassigned and not started, and it's live in production). It owns these files:
  - `app/api/onboarding/a2p-identity/route.ts`
  - `app/lib/a2p-trusthub.mjs`
  - `app/lib/a2p-registration-store.mjs`
  - `app/lib/a2p-identity.mjs`
  - the EIN fields in `app/components/onboarding/onboardingpageclient.tsx`

  This plan doesn't edit them, and it isn't the strip. **This plan's only edit in the onboarding area is
  one line in `app/api/portal/onboarding/route.ts`** (§5.4).
- `app/api/portal/sms-consent/route.ts` and `SettingsSection.tsx` (PR #28). They aren't touched.

Overlap check (orchestrator, against origin/master): no open agency branch touches `checkout-fulfillment.ts`,
the Stripe webhook, `welcome-email.ts`, `portal/onboarding/route.ts`, the agreement types or `/api/ops/*`.

**Prerequisites Xander does by hand** (nothing here is automated):
1. Generate `OPS_ORDERS_SECRET`. Put it in the agency's Vercel env (Preview + Production) and in `jdd-ops/.env`.
2. In the Stripe Dashboard → Settings → Public details, set the Terms of Service URL. `consent_collection`
   refuses to work without it.
3. Add `checkout.session.expired` to the agency's Stripe webhook endpoint events (test and live).
4. The Clerk dev instance needs invitations enabled (the default). There are no Clerk dashboard changes for prod.
5. For local testing: the Stripe CLI (`stripe listen --forward-to localhost:3000/api/webhooks/stripe`)
   with **test** keys.

## 3. Phase 1 — `@jdd/schema` v1.31.0

New file `src/operator-order.ts`, exported from `src/index.ts`:

- `ORDER_STATUSES = ["draft","terms-accepted","awaiting-payment","paid","fulfilled","expired","cancelled"]`
- `zOperatorOrder`: exactly the design's §4.1 shape, plus these fields:
  - `convertedAt?: number`. The console has created `clients/<slug>/` and linked the lead.
  - `invite?: { kind: "invitation" | "existing-login"; invitationId?: string; sentAt: number }`
  - `payment.shortCode?: string`
  - `callRef: string`
  - `version: 1`
- `canTransition(from, to)`: the allowed status moves. `draft→terms-accepted→awaiting-payment→paid→fulfilled`;
  `awaiting-payment→expired→awaiting-payment` (resend); any non-terminal status `→cancelled`; nothing leaves
  `fulfilled` or `cancelled`.
- `resumeStepFor({ order, a2pPortalStatus })` returns `"order"|"terms"|"payment"|"setup"|"sms"|"done"`. It
  implements the design's §8c table exactly. `a2pPortalStatus` is the A2P chain's `portalStatusFor` string,
  or `null` on Starter.
- `readinessFor({ order, site, a2pPortalStatus })` returns the four lights `{ id, value, tone }`. The tones
  are `ok|wait|warn|bad|off`, and the values are the exact strings in §9.

`src/account.ts`: `zPortalSite` gains `slugLocked: z.boolean().optional()` and `orderId: z.string().optional()`.
**This is required, not cosmetic:** `zPortalSite` is a plain `z.object`, so `getAccount`'s `safeParse`
silently *strips* unknown keys. Without this step, `slugLocked` would vanish on the first read.

Tests (`test/operator-order.test.mjs`):
- every status pair through `canTransition`;
- one case per row of the resume table;
- readiness for Starter (SMS lights "Not needed") and for "Needs EIN";
- a `zPortalSite` round-trip that keeps `slugLocked`. Break it by removing the field and watch it go red.

Then: tag `v1.31.0`, bump the pin in both apps' `package.json`, and run the console's `npm run check-schema`.

## 4. Phase 2 — agency: orders, terms, payment link

### 4.1 Shared auth
`app/lib/ops-auth.ts`: move `authorize` + `secretMatches` out of `api/ops/plan-sync/route.ts` into
`authorizeOps(request, envVar)`, unchanged in behaviour (fail closed, constant-time compare). plan-sync calls it
with `"OPS_SHARED_SECRET"`, the orders routes with `"OPS_ORDERS_SECRET"`. Check `api/ops/sms-consent`. If it
has its own copy, move it onto the helper too. If not, leave it alone.

### 4.2 Store — `app/lib/operator-orders.ts`
- `jdd:order:{id}`, using `zOperatorOrder` on read (invalid → null + log, like `account-store.ts`). It gets
  a 7-day TTL while `draft`. The TTL is cleared (`persist`) on `paid`.
- `jdd:order-by-lead:{leadId}` → id. Keeps one open order per lead: create is idempotent on lead id.
- `jdd:slug-claim:{slug}` → order id, `SET NX`, released on `cancelled`/`expired`. Kept on `paid`.
- `jdd:pay:{shortCode}` → order id. TTL = session expiry.
- `jdd:orders:index` sorted set (score `createdAt`) for `GET ?status=`.
- `saveOrder(next, prev)` rejects any status change `canTransition` refuses.

### 4.3 Agreement record
- `agreement-types.ts`: `AgreementAcceptance` union (design §4.2). `AgreementSubmission.signatureDataUrl`
  becomes optional. `AgreementRecord` gains `acceptance?`. `/api/agreement`'s `validate()` still *requires*
  the signature, so self-serve is unchanged.
- `pdf-signer.ts`: `generateSignedPdf` gets a verbal branch. In place of the signature image, it prints an
  acceptance block. The ESIGN paragraph (line ~168) gets a verbal-consent variant. **That wording is legal
  copy: Xander approves the text in §9.4 before merge.**
- New `app/lib/verbal-agreement.ts`, `recordVerbalAcceptance(order, { operator, scriptHash, termsHash })`.
  It:
  1. recomputes `hashTermsForPlan(plan, { webOnly })` (or `hashAddendumForPlan` for an addendum) and the
     script hash, and throws `terms-changed` on a mismatch;
  2. builds the `AgreementRecord` (verbal acceptance, signer = contact, entity fields from the order);
  3. runs `generateSignedPdf`, then `put` to Blob, then `saveAgreement`;
  4. writes `masterAgreement` on the account *only if the account already exists*. A new account gets it at
     fulfillment;
  5. `after()` → `sendClientAgreementEmail`.

  It reuses the existing functions and copies none of them.

### 4.4 Read-aloud script — `app/lib/legal/call-script.ts`
`buildCallScript(plan, period)` returns `{ version, hash, lines[] }`. It builds the six lines from
`getSchedule(plan)` (prices, fee, minutes) and the §9.2 text. `version = "${TERMS_VERSION}-${plan}-${period}"`.
`hash` is the sha256 of the joined lines. Annual wording is checked against the terms before merge (open item O1).

### 4.5 Routes — `app/api/ops/orders/**` (all `runtime = "nodejs"`, all `authorizeOps(..., "OPS_ORDERS_SECRET")`)

| File | Handler | Notes |
|---|---|---|
| `route.ts` | `POST` create | Validates the same rules as `/api/agreement` `validate()` (declined is Starter only, forwarded needs a number via `normalizeE164`), plus v1 refuses `enterprise`. Claims the slug (409 `slug-taken`). Returns `{order, account, agreementKind, block, script, totals}`. `account` + `agreementKind` come from `getAccount`, `masterNeedsResign` and `canAddPlan`, the same helpers `/start` uses. |
| `route.ts` | `GET ?leadId=` / `?status=paid&unconverted=1` | Read only |
| `[id]/route.ts` | `GET` | If `awaiting-payment` and `payment.checkoutSessionId` is set: `stripe.checkout.sessions.retrieve`, and if paid, `provisionPaidSession(session)` (idempotent, §4.6). Returns the order. |
| `[id]/route.ts` | `PATCH` | Only while `draft`. Re-validates and returns a new script. |
| `[id]/accept-terms/route.ts` | `POST` | §4.3. Then `draft→terms-accepted`. |
| `[id]/payment/route.ts` | `POST {method:"link"}` | Creates the account if it's missing (`createAccount`+`saveAccount`, no Clerk link), then `getOrCreateCustomerId`. Then a Checkout Session with the same line items as `/api/checkout` (`priceIdFor`, `onboardingPriceId`), `customer`, `metadata` and `subscription_data.metadata` = `{order_id, agreement_id, plan, period, site_slug}`, `consent_collection.terms_of_service="required"`, `payment_method_options.card.request_three_d_secure="any"`, `expires_at = now+24h`, `success_url = /checkout/thanks`, `cancel_url = /checkout/thanks?cancelled=1`. Writes `shortCode` (6 chars, no lookalikes), then `→awaiting-payment`. |
| `[id]/resend-link/route.ts` | `POST` | If the session expired, opens a new one, new code, `expired→awaiting-payment` |
| `[id]/mark-converted/route.ts` | `POST` | Sets `convertedAt`. Idempotent. Called by the console after it seeds the folder. |
| `[id]/resend-invite/route.ts` | `POST` | §5.3. Refused once the client has signed in (`account.clerkUserId` set) or when `invite.kind = "existing-login"`. |
| `[id]/cancel/route.ts` | `POST` | Expires the session (`stripe.checkout.sessions.expire`), releases the slug, `→cancelled` |

Plus `app/pay/[code]/route.ts`: a public GET that looks up `jdd:pay:{code}` and 302s to the session URL. It
404s once the link expired or was paid, and shows nothing else. And `app/checkout/thanks/page.tsx`: a static
"Payment received. Check your email to set up your portal login." with a `cancelled` variant. **It is not**
`/checkout/success`, which requires sign-in and would bounce a client who has no login yet.

## 5. Phase 3 — agency: fulfillment, invite, onboarding

### 5.1 `checkout-fulfillment.ts`
At the top of `provisionPaidSession`, after the `paid` check: `if (session.metadata?.order_id) return
provisionOperatorOrder(session)`. **It has to dispatch here, not in the webhook.** The success page and the
ops `GET` both call `provisionPaidSession`. If the old path ran first, it would create a `pending-xxxx` site
and the `sessionId` idempotency would lock that wrong slug in.

`provisionOperatorOrder(session)`, in the same file:
1. Load the order. If it's missing → log + null.
2. Call `createPendingSite(order.client.email, {...})` with:
   - `slug: order.siteSlug`, `slugLocked: true`, `orderId`, `sessionId: session.id`;
   - `status: "pending-onboarding"`, `plan`, `name: dba || legalName`;
   - `signerEmail`, `signerName`, `receptionistMode`;
   - `agreementId`, `agreementPdfUrl`, `agreementVersion`, `stripeCustomerId`.

   It's idempotent on `sessionId`, as today.
3. Set `masterAgreement` on the account if the order's agreement is a master.
4. `persistAgreement(agreementId)`.
5. Order `→paid` (keep `paidAt`, `amountTotal`, `subscriptionId`), then `→fulfilled` after step 6.
6. Run `invitePortalUser` (§5.3) and store `order.invite`.
7. Return a `FulfilledSession`-compatible object, so the webhook's welcome-email block works unchanged.

**Check during build:** `createPendingSite` also writes the console's `jdd:pending-onboard:{slug}` index. The
console convert then creates `clients/{slug}`. Confirm `ClientIndex` shows one card for that slug, not a
`PendingOnboardCard` *and* a `ClientCard`. If it shows two, skip `writePendingRecord` for `slugLocked`
sites. The console roster gets them from disk anyway.

### 5.2 Webhook — `api/webhooks/stripe/route.ts`
- `checkout.session.completed`: no change needed (dispatch is inside `provisionPaidSession`). The welcome
  email gets `inviteUrl` / `existingLogin` from the result.
- **New:** `checkout.session.expired` with `metadata.order_id` → order `awaiting-payment→expired`, release
  the slug claim. Nothing else.

### 5.3 Portal invite — `app/lib/portal-invite.ts`
`invitePortalUser(email)` follows the orchestrator's convention, verbatim:
- If `clerkClient.users.getUserList({ emailAddress: [email] })` has a user → `{ kind: "existing-login" }`.
- Otherwise → `invitations.createInvitation({ emailAddress, redirectUrl: ${origin}/portal, notify: false,
  ignoreExisting: true })` → `{ kind: "invitation", invitationId, url }`.

`resendPortalInvite(order)` → `invitations.revokeInvitation(old)` then create a new one. **No function in
this plan generates, sets or emails a password.**

`welcome-email.ts`: two new optional inputs, `inviteUrl` ("Set up your portal login" button) and
`existingLogin` ("Sign in as usual"). Without them it renders today's email byte-for-byte. Prove that
with a snapshot of the rendered HTML before and after.

### 5.4 Portal onboarding — `api/portal/onboarding/route.ts` (~line 258)
`const newSlug = site.slugLocked ? site.slug : uniqueSlug(slugifyBrand(slugSource), account, site.slug);`

That's one line, and the existing comment block gets a sentence on why it's there. `enqueueIntake` already
uses `newSlug` as `slugGuess`, so the intake also arrives under the locked slug.

## 6. Phase 4 — the A2P dependency (a2p-chain session's code)

The approved mockup's SMS step is a compact form: registration type, EIN now/later, business,
representative, address, one typed confirm, then a checklist. The embedded `A2pRegistrationPanel` today is
the full stepper, with a confirm dialog per write. The handoff forbids a second EIN form, so the wizard
**does not build one.** Instead, two requests go to the a2p-chain session once this plan is signed off:

- **R1 — `variant="close-wizard"` on `A2pRegistrationPanel`**: the mockup's layout and copy (§9.5), the
  same component, so the panel is still the only EIN form there is.
- **R2 — one confirmed batch run**: "Submit registration" runs `profile.create → business.create → rep.create
  → address.create → profile.attach → profile.evaluate → profile.submit → trust.create → trust.evaluate →
  trust.submit` under **one** typed-slug confirm. It stops at the first failure and returns per-step
  results, which is what the checklist animates. "Save" (EIN later) runs the same chain minus
  `business.create` and everything after it.
- **R3 — already accepted:** `profile.reset` (follow-up 8) for changing the registration type on Resume.

Until R1/R2 land, the console's SMS step renders the panel as it is today, embedded. That still works,
just with more clicks.

## 7. Phase 5 — console

All new routes use the loopback guard. Move the copy that `manage/plan/billing/route.ts` has into
`src/lib/loopback.ts`, and use it from the new routes only. All writes call `appendAudit`, with key
names and statuses only, never values.

| File | What |
|---|---|
| `src/lib/opsSecrets.ts` | `loadPortalOpsConfig()` also returns `ordersSecret` (`OPS_ORDERS_SECRET`) |
| `src/lib/salesOrders.ts` (server-only) | Typed `fetch` wrappers for every §4.5 endpoint, plus `readOrderFromKv(id)` / `readOrderByLead(leadId)` for display (KV read, `zOperatorOrder`) |
| `src/app/api/sales/orders/**` | Thin proxies that mirror §4.5 one-to-one. The browser never sees the secret. |
| `src/app/api/sales/slug-check/route.ts` | `isValidSlug` + no `clients/{slug}/site.ts` + no A2P record (`readRegistration`). The agency's claim on create is the final word. |
| `src/app/api/sales/orders/[id]/convert/route.ts` | Reads the order and refuses unless it's `paid`/`fulfilled`. Then `seedClientFolder({slug: order.siteSlug, name, plan, vertical: order.vertical})`, where `EXISTS` with the same slug counts as success (design §3 edge case). Then `convertLead(lead, slug, {email})`, then agency `mark-converted`. Returns per-item results for the Setup checklist. |
| `src/app/leads/[id]/close/page.tsx` | Server: lead, `readOrderByLead`, A2P status (`readRegistration`+`portalStatusFor`), `resumeStepFor(...)`. Renders `CloseWizard` at that step. |
| `src/components/close/CloseWizard.tsx` + `Stepper`, `OrderStep`, `TermsStep`, `PaymentStep`, `SetupStep`, `SmsStep`, `DoneStep` | The mockup, in console tokens (`panel`, `btn`, `field-label`…). Steps before the resume step are ✓ and not clickable. PaymentStep polls `GET /api/sales/orders/{id}` every 3s while waiting and stops on paid/expired/unmount. SetupStep calls `convert` once, then animates the real results. |
| `src/components/close/ReadinessStrip.tsx` | Renders `readinessFor(...)` |
| `LeadModal.tsx` | "Close on call" → `/leads/{id}/close` when there's no open order, "Resume" when there is one. The existing Convert button stays for leads closed some other way. |
| `ClientIndex.tsx` (`ClientCard`) | Readiness strip + Resume / Resend invite links when the client record has an order (KV read). This is a roster render from disk plus KV, with no agency HTTP. |
| `manage/[section]/page.tsx` (on the a2p branch) | Messaging & A2P is reachable while `awaitingOnboarding` **when the client came from an order** |
| `manageSections.ts` + `AgreementSection.tsx` | Phase 6, below |

Paid-but-unconverted (the client paid later, from the link): `/leads` page load calls
`GET /api/sales/orders?status=paid&unconverted=1` and runs `convert` for each. This is the design's
"finishes next time you open Leads".

## 8. Verification per phase (green before moving on)

| Phase | Must pass |
|---|---|
| 1 schema | `npm test`, `npm run build`. Then the console's `npm run check-schema` after the pin bump. |
| 2–3 agency | `npm test`, `npx tsc --noEmit`, `npm run build`. Then a **Stripe test-mode run on localhost** with test keys, the Stripe CLI forwarding, and the Clerk dev instance: (a) card 4242: paid → site with locked slug, invite email, `/portal/onboarding` keeps the slug; (b) 3DS card 4000 0027 6000 3184: challenge, then paid; (c) let a session expire (`stripe checkout sessions expire`): order `expired`, slug released, resend works; (d) a self-serve purchase end to end, to prove nothing regressed. |
| 4 A2P | The a2p-chain session's own suite. Every filing run uses `mock: true` in testing. |
| 5 console | `cd console && npm test` (new `test/close-flow.test.mjs`: the slug-check rules, the convert route's EXISTS-is-ok rule, the proxy refusing non-loopback hosts), `npx tsc --noEmit`, `npm run build`. Root `npm test` stays green (it isn't touched). Then the full wizard on `localhost:3040` against the local agency. |

Every test encodes a real failure mode from this work: the stripped `slugLocked`, the success-page race,
the rename, and the password rule.

## 9. Copy deck (verbatim from the approved mockup)

### 9.1 Order
Header: `{DBA or business name}` / `{contact} · {mobile}`. Stepper: Order · Terms · Payment · Setup · SMS
registration · Done (SMS registration is hidden on Starter).
- **Fields:** Plan · Billing · Due today / Then · "Renews automatically · cancel any time" · Business:
  Legal business name, Business name (DBA), Trade, Contact name, Email (portal login), Contact mobile,
  Site ID ("✓ Available").
- **Phone setup:**
  - Keep your current number: "Customers keep calling the number you use today. Calls you miss forward to
    your receptionist." The field is "Your current business number", with "The number customers call
    today. We'll send forwarding steps for your carrier."
  - Get a new number from us: "A new local number for your cards, truck and Google listing. It rings you
    first, and calls you miss go to your receptionist." Below it: "Your new number is assigned during setup
    and emailed to you."
  - Website only: "No receptionist." / "Starter plan only."
- **Buttons:** Save draft · Continue.

### 9.2 Terms
The six lines from `buildCallScript`. "Read the full Terms of Service (v5.1)". "**Client verbally agreed**
to the terms above". Accept terms. Then "✓ Terms accepted. A copy is on its way to {email}." with Continue.

### 9.3 Payment
- **Header:** `{today}` due today, then `{recurring}`.
- **Tabs:** Link · Enter card.
- **Link tab:** "Payment link" / `juneaudigitaldesigns.com/pay/{code}` / "Secure checkout by Stripe ·
  expires in 24 hours" / Copy link.
- **Waiting:** "Waiting for payment…" ✓ Terms accepted / ✓ Payment link opened / … Payment. Buttons:
  Switch to card · Cancel.
- **Bank-verification case** (Phase 7): "This card needs bank verification. Use a payment link instead.
  Nothing was charged."

### 9.4 Setup, Done, and the PDF block
- **Setup:** "Setting up {name}…" / "{name} is set up".
  - Payment received: "{amount} · receipt sent to {email}"
  - Portal account created: "{email}"
  - Portal invite sent: "Welcome email with a link to set up your login". For an existing login:
    "Site added to your existing login".
  - Client file created: "Site ID {slug}"
  - Lead marked won: "Moved to Clients"
- **Done:** "You're all set". The tiles are Payment / Onboarding / SMS brand / SMS campaign. Then Next steps:
  1. Terms confirmation
  2. Payment collected
  3. Set up your portal login, with **Resend invite**
  4. Complete onboarding in the portal

  Then Open client.
- **PDF acceptance block (needs Xander's approval):** "Accepted by verbal consent during a telephone call on
  {date, time ET}. The terms summarised above were read to {signer name} ({signer email}), who agreed to
  them. Acceptance was recorded by Juneau Digital Designs (operator: {operator}). Call reference: {callRef}.
  Script {version}, SHA-256 {scriptHash}. Terms SHA-256 {termsHash}."

### 9.5 SMS registration
Registration type (Business with an EIN · Sole proprietor) · EIN available now? (Yes · Add later) · Business ·
Authorized representative · Business address · "Type {slug} to submit" · Submit registration / Save.
Checklist: Business profile submitted · Messaging registration submitted · Review started. With Add later, the
last item is "EIN still needed".

## 10. Phase 6 / 7 (after v1)

- **6. `/manage` Agreement section.** A new `agreement` id in `manageSections.ts` (all plans) and
  `AgreementSection.tsx`: call reference (editable), recording id, script and terms hashes, PDF link,
  acceptance method. It needs agency `PATCH /api/ops/orders/{id}/call-record`.
- **7. Card path (MOTO).** Only after Stripe enables it. Agency `POST /payment {method:"dashboard-moto"}` +
  `POST /charge` + an `invoice.paid` (`billing_reason=subscription_create`, `metadata.order_id`) dispatch
  into `provisionOperatorOrder`. Console Enter card tab. A `sessionId` stand-in is needed for
  `createPendingSite`'s idempotency, so decide that then.

## 11. Open items found while planning

- **O1** The Terms line 4 wording for annual prepay ("stops at the end of the period you have already paid
  for"). Check it against terms-v5.1's annual clause before merge.
- **O2** `createPendingSite` also feeds the console's pending index (§5.1 check).
- **O3** Fulfillment never records `stripeSubscriptionId` on a first purchase today (plan-sync fills it
  later). The operator path stores it on the order. It's out of scope to change for self-serve.
- **O5 — DECIDED (Xander, 2026-11-03): the client never enters the EIN in the portal.** The agency
  onboarding form must not collect it. The operator collects it, either on the closing call or later via
  Resume. Removing the existing portal EIN step is the separate "agency EIN strip" (see §2). It's
  unassigned and still live, and the orchestrator is taking the assignment up with Xander. It's not part
  of this plan. Nothing in this plan builds or depends on a portal EIN path, and
  `resumeStepFor` never expects the business identity to show up from anywhere but the wizard.
- **O4** Rollback: everything new is behind the new endpoints and `order_id` metadata. Self-serve sessions
  never carry `order_id`, so reverting the agency PR leaves self-serve exactly as it is. The one shared
  edit is the dispatch line in `provisionPaidSession`.

## 12. As built (2026-11-03): where the build differs from this plan

| Plan said | Built | Why |
|---|---|---|
| Order step per mockup | Adds **Entity type**, **Business address**, **Title** | The agreement PDF names the client as "a {entity} located at {address}" and prints the signer's title. The mockup didn't collect them, and they can't be invented. |
| Console shows prices | New agency `GET /api/ops/orders/prices` (from Schedule A) + console `/api/sales/prices` | The console has no price source, and a copy would drift. |
| Expired link releases the Site ID | The claim is **kept** on expiry, and released only by Cancel | A lapsed link is a client who hasn't paid yet, not one who said no. |
| Welcome email sent by the webhook | The operator path sends it from inside fulfilment, behind the same NX claim | Only the first fulfilling caller holds the invite URL (it isn't stored). |
| "Read the full Terms of Service" link | **Removed** | The agency has no public terms page. `/agreement` is the signing flow. The terms are emailed on acceptance. |
| LeadModal shows "Resume" for an open order | One **Close on call** button | The lead record doesn't carry order state. The wizard opens at the resume step either way. Client cards do show **Resume**. |
| ClientIndex: check for a duplicate card (O2) | Confirmed, and **fixed in the roster**: a pending entry is hidden when a client folder has the same slug | |
| Welcome email unchanged "byte-for-byte" for self-serve | Same content and markup. Whitespace around the steps differs. | Not snapshot-tested: the agency suite is `.mjs` only and can't import TS. |
| Agency tests | None added. The order rules (`canTransition`, `resumeStepFor`, `readinessFor`, `slugLocked` round-trip) are tested in `@jdd/schema` | The agency's test runner is plain `node --test` over `.mjs`. |
| jdd-ops branch `feat/sales-call-close` | Built on **`claude/sales-close-design-0f5f8d`**, rebased onto a2p-chain's tip | A guard stops this session from writing to another worktree. |
| Pin bump to v1.31.0 | **Not done yet** | It needs the `v1.31.0` tag pushed to GitHub (Xander's go-ahead). Typechecks/builds ran against the local schema build copied into `node_modules`. |
| Phase 8 Stripe test-mode run | **Not done** | It needs `OPS_ORDERS_SECRET`, Stripe test keys, the Stripe CLI and a Clerk dev instance on localhost. Xander runs it or approves it. |
| SMS step | Embeds `A2pRegistrationPanel` as it is | R1/R2 were sent to a2p-chain. Until then it's the full stepper. |
