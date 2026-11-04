# DESIGN — Close a client on a sales call

**Status:** APPROVED by Xander, 2026-11-03 (with the registration-type edit in §8c). Design only, no code written.
**Repos touched when built:** `juneau-digital-designs` (agency), `jdd-ops/console`, `@jdd/schema`.
**Mockup:** https://claude.ai/artifact/BVZRCi4j7MF1tfAZZzsMps

---

## 1. The flow in one paragraph

On a call, Xander opens the lead in the console and clicks **Close on call**. A wizard takes the
order (plan, period, legal name, email, phone handling), shows a short script he reads aloud, and
he ticks **Client verbally agreed**. The agency site records that as an agreement and immediately
emails the client the terms (which also proves the email address is right while they are still on
the phone). Payment happens on a Stripe surface only: Stripe Dashboard if Xander types the card
himself, or a link the client opens on their own phone. The console watches until Stripe says paid.
Then everything that happens after a self-serve purchase happens here too: the agency creates the
portal account and site record and sends a portal invite, and the console creates the
`clients/<slug>/` shell and marks the lead won. For Growth and Enterprise, the wizard then embeds
the A2P panel so the brand paperwork goes in before they hang up.

## 2. Where each piece lives — Xander's steer, checked

**Agreed: route it through the agency site.** It already owns everything with money or identity in
it: the Stripe write key, Clerk, the portal account store, the terms text with its version and hash,
the agreement PDF, the Stripe webhook, fulfillment and the welcome email. The console has no auth,
a read-only Stripe key, and a standing rule against Stripe write code. Rebuilding any of that in the
console would mean two purchase pipelines that drift apart.

Three refinements:

1. **A new API, not a new page.** "Another route for me to come in" should be a set of
   secret-gated `/api/ops/orders/*` endpoints, the same pattern as `/api/ops/plan-sync`, with the
   console wizard as the only UI. A browser page for Xander on the public agency site would need a
   real admin login, and that is a project of its own. The only page on the agency site Xander
   ever sees is Stripe's.
2. **Extend the agreement record, don't replace it.** Fulfillment, addenda, `masterNeedsResign`,
   the PDF and the client email all key on `agreement_id`. Adding an `acceptance` field ("how was
   this accepted") keeps every existing signed agreement valid and every downstream reader
   unchanged. The new **order** record replaces the *purchase intent*, not the agreement: it
   answers "who is buying what", which an authenticated browser session answers in self-serve.
3. **A2P stays in the console.** The registration chain lives in the ops root and uses the master
   Twilio credentials. The agency doesn't need it. It only shows `a2pStatus` on the portal.

```
                    ┌──────────────────────── jdd-ops (local) ─────────────────────────┐
                    │  console /leads/{id}/close  (wizard UI)                          │
 Xander ───────────▶│     │ server route /api/sales/orders/* (adds x-ops-secret)       │
                    │     │                    convertLead + seedClientFolder ─▶ clients/<slug>/site.ts
                    │     │                    A2pRegistrationPanel ─▶ runA2pStep ─▶ Twilio TrustHub / TCR
                    └─────┼────────────────────────────────────────────────────────────┘
                          │ HTTPS + OPS_ORDERS_SECRET (server-to-server only)
                    ┌─────▼──────────────── juneau-digital-designs (Vercel) ──────────────┐
                    │  /api/ops/orders/*  ── operator-orders store  jdd:order:{id}         │
                    │     ├─ accept-terms ─▶ AgreementRecord (acceptance: verbal) + PDF   │
                    │     │                  └─▶ Resend: terms confirmation email          │
                    │     ├─ payment ──────▶ Stripe: Customer, Checkout Session / sub      │
                    │     └─ status ◀───── order.status (written by fulfillment)          │
                    │  /api/webhooks/stripe ─▶ fulfillOrder ─▶ PortalAccount + PortalSite  │
                    │                                     ├─▶ Clerk invitation             │
                    │                                     └─▶ Resend: welcome + invite     │
                    └─────────────────────────────────────────────────────────────────────┘
   Client's phone ◀── terms email, payment link (optional), portal invite
```

| Piece | Lives in | Talks to |
|---|---|---|
| Wizard UI, readiness strip | console `src/app/leads/[id]/close` | its own server proxy only, never the agency from the browser |
| Proxy | console `src/app/api/sales/orders/*` | agency `/api/ops/orders/*` with the secret header |
| Order record | agency KV `jdd:order:{id}` | written by the ops routes and fulfillment |
| Terms acceptance | agency `AgreementRecord` + Blob PDF | `legal/` hashes, `agreement-email.ts` |
| Card entry | Stripe Dashboard or Stripe Checkout | never the console, never an agency page |
| Paid → account/site/invite | agency `checkout-fulfillment.ts` (generalised) | Stripe webhook, Clerk, Resend |
| Lead → client shell | console `leadConversion.ts` (existing) | local disk + lead queue + ClientRecord |
| A2P | console, embedded `A2pRegistrationPanel` | `jdd:a2p-registration:{slug}`, Twilio |

## 3. Slug alignment — settled

**The slug is chosen once, on step 1 of the wizard, and every system uses it from then on.**

Today the three sides each make their own: fulfillment writes `pending-<last 8 of session id>`, the
portal onboarding renames it to `slugifyBrand(brandShort)`, and console convert uses
`slugify(lead.businessName)`. Those match only by luck, and the A2P record (`jdd:a2p-registration:{slug}`)
has to be written *during the call*, before any of them run.

- Wizard proposes `slugify(DBA or legal name)`. Xander can edit it.
- Console checks it's free: no `clients/<slug>/` folder, no A2P record.
- Agency checks it's free: not on the target account, and not reserved by another open order, using
  `SET jdd:slug-claim:{slug} NX`. The claim is released if the order is cancelled or expires.
- It travels as `order.siteSlug` → Stripe metadata `site_slug` → `PortalSite.slug` (no `pending-`
  placeholder) with `slugLocked: true` → console convert → A2P key.
- **One change to the portal onboarding route:** when `site.slugLocked`, keep `site.slug` instead of
  renaming. Self-serve is unchanged: no lock, same rename as today.
- Edge case: if the client pays from the link and finishes portal onboarding before the console has
  converted, the intake import may create the folder first. Convert then sees the folder with the
  same slug and only links the lead, rather than returning 409.

## 4. Records

### 4.1 Order (new) — `jdd:order:{orderId}`, agency KV

Kept for 7 days as a draft and made permanent once paid. It replaces the purchase intent on this path.

```ts
interface OperatorOrder {
  id: string;                       // "ord_" + random
  version: 1;
  source: "operator-call";
  status: "draft" | "terms-accepted" | "awaiting-payment" | "paid" | "fulfilled"
        | "expired" | "cancelled";
  leadId: string;                   // console lead queue id
  siteSlug: string;                 // locked, see §3
  plan: "starter" | "growth" | "enterprise";
  period: "monthly" | "annual";
  pricing: { kind: "standard" } | { kind: "coupon"; couponId: string; label: string };
  client: {
    legalName: string; dba?: string; entityType?: string; address?: string;
    contactName: string; contactTitle?: string;
    email: string;                  // becomes the portal account key
    phone: string;
  };
  vertical: string;                 // needed by convert + A2P industry default
  receptionistMode?: "forwarded" | "published" | "declined"; // absent on Enterprise
  forwardingNumber?: string;
  enterpriseSites?: string[];       // ≥ 2 on an Enterprise master
  agreementId?: string;             // set by accept-terms
  agreementKind?: "master" | "addendum";
  payment?: {
    method: "link" | "dashboard-moto" | "checkout-moto";
    stripeCustomerId: string;
    checkoutSessionId?: string; checkoutUrl?: string; shortCode?: string; expiresAt?: number;
    linkSentTo?: string;
    subscriptionId?: string; amountTotal?: number; paidAt?: number;
  };
  fulfilledAt?: number; inviteSentAt?: number;
  events: { at: number; kind: string; text: string }[];   // the console shows these
  createdAt: number; updatedAt: number;
}
```

There's no EIN, card data or SMS consent on it. Fields the client never said are left out, never
guessed (the same rule as `_meta.missingFields`).

### 4.2 Agreement (extended) — `AgreementRecord`

```ts
acceptance?:                         // absent = drawn signature (every record that exists today)
  | { method: "drawn-signature" }
  | { method: "clickwrap"; checkedAt: string; ip: string; userAgent: string }   // self-serve tick
  | { method: "verbal-operator";
      orderId: string;
      operator: string;              // "xander"
      callRef: string;               // see open decision D5
      scriptVersion: string; scriptHash: string;   // the exact read-aloud text
      readAt: string; confirmedAt: string; };
signatureDataUrl?: string;           // now optional; required only for drawn-signature
```

`audit.termsHash` and `agreementVersion` work exactly as today. The PDF replaces the signature image
with an acceptance block ("Accepted by verbal consent on a telephone call on 3 Nov 2026 14:12 ET,
entered by Juneau Digital Designs (operator: Xander Juneau), call ref …"), and the audit page also
shows the script hash.

If the link path is used, the Checkout Session also sets `consent_collection.terms_of_service:
"required"`, so the client ticks the ToS box themselves on Stripe's page. Stripe stores that on the
session, which makes it stronger evidence than the verbal tick. The fulfillment copies it onto the
order (`events: "ToS accepted on Stripe Checkout"`).

### 4.3 Portal site (schema additions)

`PortalSite.slugLocked?: boolean`, `PortalSite.orderId?: string`. Everything else (`agreementId`,
`agreementVersion`, `receptionistMode`, `stripeCustomerId`) is set exactly as fulfillment already does.

## 5. Ops endpoint contract — `juneau-digital-designs/app/api/ops/orders`

All endpoints: `x-ops-secret` header, compared in constant time, fail closed when unset (the
`authorize` function from `plan-sync`, moved into a shared helper). They are called only by the console server,
never by a browser. JSON in and out. Errors use `{ error, code }`.

| Method & path | Body | Does | Returns |
|---|---|---|---|
| `POST /api/ops/orders` | order fields from §4.1 minus ids/status; header `Idempotency-Key: lead:{leadId}` | Validates using the same rules as `/api/agreement`'s `validate()` (declined = Starter only, forwarded needs a number, Enterprise ≥ 2 sites). Claims the slug. Looks up the account by email. | `{ order, account: "new" \| "existing", agreementKind, block?: canAddPlan reason, script: { version, hash, lines[] }, totalToday, recurring }` |
| `PATCH /api/ops/orders/{id}` | any order field, only while `draft` | Re-validates and re-issues the script | same as above |
| `POST /api/ops/orders/{id}/accept-terms` | `{ confirmed: true, operator, scriptHash, termsHash, callRef? }` (callRef defaults to lead phone + timestamp; editable later in `/manage`) | Recomputes both hashes on the server and returns 409 `terms-changed` if they don't match. Writes the AgreementRecord (verbal), PDF and confirmation email, and moves status → `terms-accepted`. | `{ agreementId, pdfUrl, emailSentTo }` |
| `POST /api/ops/orders/{id}/payment` | `{ method: "link" }` | Creates the email-keyed account if missing (as `/start` does today), the Customer, and the Checkout Session (same line items as `/api/checkout`, metadata `order_id, agreement_id, plan, period, site_slug`, ToS consent required, `request_three_d_secure: "any"`, 24h expiry), plus a short code for `/pay/{code}`. The wizard only copies the link: there's no email-it button, since the client is on screen share. | `{ url, shortUrl, expiresAt }` |
| | `{ method: "dashboard-moto" }` | Creates the account and Customer (metadata `order_id`) and stamps `paymentStartedAt`. | `{ dashboardUrl }` (that Customer's page in Stripe) |
| `POST /api/ops/orders/{id}/charge` | `{}` — MOTO path only | Only works while `awaiting-payment`. Uses the card added to that Customer *after* `paymentStartedAt` and creates the subscription with the onboarding fee as an invoice item. The amount is fixed by the server. | `{ status: "paid" \| "requires_action" \| "declined", message }` |
| `GET /api/ops/orders/{id}` | — | Read-only. If `awaiting-payment` and Stripe hasn't confirmed within 20s, it also retrieves the session and runs the same idempotent fulfillment the success page runs. | `{ order, readiness: { paid, invite } }` |
| `GET /api/ops/orders?status=paid&unconverted=1` | — | Paid orders the console hasn't converted yet (the client paid later from the link). | `{ orders[] }` |
| `POST /api/ops/orders/{id}/resend-link` | `{}` | Opens a new session if the old one expired and re-sends the email | as `payment` |
| `POST /api/ops/orders/{id}/resend-invite` | `{}` | Revokes the open Clerk invitation and creates a new one, then re-sends the welcome email. Refused once the client has signed in, or if there's no invitation on this order (an existing login). See §8b. | `{ sentTo, invitedAt }` |
| `POST /api/ops/orders/{id}/cancel` | `{ reason }` | Expires the session, releases the slug claim | `{ order }` |

**Secret scope.** These endpoints can do more than plan-sync can: open sessions, and (MOTO path)
charge a card that is on file. They should use their own `OPS_ORDERS_SECRET`, so a leak of one
secret doesn't hand over the other. `charge` stays narrow: one order, the state it must be in, a card
added after the order's payment step started, an amount the server sets.

## 6. Changes to existing agency code

| File | Change | Risk to what works today |
|---|---|---|
| `lib/agreement-types.ts` | `acceptance` union; `signatureDataUrl` optional | none: absent = drawn signature |
| `lib/pdf-signer.ts` | acceptance block when there's no signature image | none for signed records |
| `lib/checkout-fulfillment.ts` | identity from `order_id` **or** `purchase_id`; `site_slug` from metadata when present instead of `pendingSlugFor`; set `slugLocked`, `orderId`; then `fulfillOrder` hooks (Clerk invite, order → fulfilled). Today's code path for a `purchase_id` session stays the same. | medium: this is the hot path, so it needs tests for both shapes |
| `api/webhooks/stripe/route.ts` | MOTO path only: `invoice.paid` with `billing_reason=subscription_create` and `metadata.order_id` → `fulfillOrder` | low, additive |
| `api/portal/onboarding/route.ts` | skip the rename when `site.slugLocked`; `slugGuess = site.slug` | low |
| `lib/welcome-email.ts` | variant with a Clerk invitation link ("Set up your portal login") | low |
| `api/ops/plan-sync/route.ts` | `authorize` moved into a shared helper | none |
| **new** `lib/operator-orders.ts`, `api/ops/orders/**`, `app/pay/[code]/route.ts` (redirect) | — | — |
| `/agreement` page + `/api/agreement` | **separate PR, can come later:** self-serve swaps the signature pad for a checkbox (`acceptance.method = "clickwrap"`), keeping the scroll gate | contained to self-serve |

**Portal invite.** Use `clerkClient.invitations.createInvitation({ emailAddress, redirectUrl:
/portal, notify: false, ignoreExisting: true })` and put the link in our own welcome email.
Accepting the invite creates a Clerk user with a verified email, and the portal then finds the
email-keyed account and links it (`resolveAccountForUser` → `linkClerkUser`). That path already
exists: "a client who paid before ever signing up already has a record keyed on their address".
A returning client who already has a login gets a "new site added" email instead of an invite.

**SMS consent is deliberately not collected on the call.** Today it's an optional box on the
signing page, separate from the purchase. If Xander ticked it on someone's behalf, that would be
the weakest consent record we hold for texting. The client opts in themselves on the portal
(the existing `/api/portal/sms-consent`) or in the onboarding wizard.

## 7. Console changes

- `/leads` card and `LeadModal`: a **Close on call** button. The call script's close step links there too.
- `src/app/leads/[id]/close/page.tsx`: the wizard (steps in §8). Server proxy `src/app/api/sales/orders/*`
  adds the secret. The browser never sees it.
- After paid: the existing `convertLead` + `seedClientFolder` with the locked slug, plan, vertical, email.
  The lead stage becomes `won`. On load, `/leads` also finishes any paid-but-unconverted orders.
- A2P: `<A2pRegistrationPanel slug={slug} enums={…} embedded />`, with the industry preselected
  from the vertical (`enums.defaultIndustryByVertical`).
- `ReadinessStrip` component, used on the lead card, the `/clients` roster and `/manage` Overview:

| Light | Reads | States |
|---|---|---|
| Paid | order status (agency GET) or a PortalSite existing | link sent · awaiting · paid · failed |
| Onboarding intake | account store (already read by `onboardingGate`) | invite sent · signed in · intake submitted |
| A2P brand | `readRegistration` + `portalStatusFor` (local, no Twilio call) | n/a · not started · needs EIN · bundles in review · ready to file · brand pending · approved · failed |
| A2P campaign | same record | n/a · waits on brand · pending · verified · failed |

Starter and web-only show A2P as **n/a**, because their owner alerts go out on JDD's own account
campaign.

## 8. Wizard steps

**Screen-share rule (Xander, 2026-11-03).** The client watches this wizard over Zoom or FaceTime.
So the copy is labels and short instructions, written so a client can see it. There's no copy that
explains things to the operator, and no internal ids, hashes, vertical names or vendor jargon on
screen. The header is just the business name, contact and phone. There's no call timer and no
lead/activity sidebar: that already lives on the lead.

1. **Order.** Plan, billing, the due-today / then amounts, business fields (legal name, DBA, trade,
   contact, email as the portal login, phone, Site ID with "✓ Available"), and phone setup ("Keep current
   number" + number to forward, "New business number", "Website only" for Starter only). Enterprise
   gets a site list instead of phone setup. The agency's new-vs-returning check runs silently. It only
   shows if it blocks the purchase.
2. **Terms.** Just the six checkable script lines, a "Read the full Terms of Service" link, the
   **Client verbally agreed** box and **Accept terms**. The confirmation then reads "A copy is on its
   way to {email}".
3. **Payment.** Tabs **Link** (big short URL + **Copy link**) and **Enter card** (Open Stripe ↗, then
   Charge). Then **Waiting for payment…**. A card that needs bank verification gets switched to a link.
4. **Setup** (automatic once paid): an animated checklist. Payment received → portal account → invite
   sent → client file → lead marked won.
5. **SMS registration** (Growth/Enterprise only; hidden on Starter): registration type and "EIN available now?" selectors, then
   business, representative and address fields, then a typed Site ID and **Submit registration**. A
   second animated checklist confirms it: profile submitted → messaging registration submitted →
   review started. With **Add later**, the button is **Save** and the last item reads "EIN still needed".
6. **Done.** "You're all set", four status tiles, then **Next steps**: terms emailed ✓, payment
   collected ✓, set up your portal login, complete onboarding in the portal (which unlocks the build).
   One button: **Open client**.

**Phone setup wording.** It matches the self-serve agreement page. `forwarded` means "Keep your current
number", and its field is "Your current business number" (the line customers call today, which they
forward to us). `published` means "Get a new number from us" (the number JDD provisions becomes their
business line). Both ring the owner first. The contact field is labelled "Contact mobile" so it can't
be confused with the business line.

### 8c. Resume

A close can stop at any step: the client wants to pay later, or doesn't have their EIN. Resuming opens
the **same wizard** at the first unfinished step. Everything before it shows as ✓ in the stepper and
can't be redone: no re-accepting terms, no second charge. The wizard works out where it is from the
records. It keeps no state of its own.

| Records say | Opens at | Shows |
|---|---|---|
| order `draft` | Order | the saved fields |
| `terms-accepted` | Payment | Link / Enter card |
| `awaiting-payment` | Payment | Waiting, with the same link (or a fresh one if it expired) |
| `paid`, not converted | Setup | runs the convert checklist |
| fulfilled, Growth/Enterprise, A2P record incomplete | SMS registration | saved parts collapsed to ✓ rows with Edit (where the A2P chain still allows `*.update`). Only the missing parts are open. The EIN is never prefilled |
| fulfilled, bundles in review / ready to file | SMS registration | Refresh status, then **File brand** once it unlocks |
| all done | Done | |

- **Entry points:** **Resume** on the lead card while the order is open, and on the client card / Manage
  Overview while any light needs action (for example Lakeside Roofing → "Needs EIN").
- **Reads:** `GET /api/ops/orders?leadId=` (agency), `readRegistration({ slug })` and the A2P intake
  (local), and the account store. The slug locked at order time is what joins all three.
- **Only the operator collects the EIN** (Xander, 2026-11-03), either on the closing call or on a follow-up
  via Resume. The agency onboarding form must not collect it. Its existing A2P identity step is being
  removed (a2p-chain follow-up 1).
- **Registration type stays editable until the profile is submitted** (Xander, 2026-11-03). A client
  saved as "Business with an EIN" may turn out to have no EIN, or the reverse. Today the A2P chain fixes
  `registrationPath` forever at `profile.create`, so this needs one new chain step,
  `profile.reset`: discard the *unsubmitted* draft (delete its TrustHub objects, clear the record), then
  `profile.create` again with the other path. Rules:
  - It's refused once `profile.submit` has run. After that, the Edit link becomes "Locked: submitted for
    review".
  - It's refused for sole-proprietor on Enterprise.
  - It needs the usual confirm.
  - The representative's details are re-entered, since we never stored them. The address and business
    intake survive, because they live in `jdd:a2p-intake:{slug}`.
  - The a2p-chain session has accepted it as follow-up 8 in `PLAN-console-a2p-registration.md` §12
    (branch `claude/a2p-registration-chain-ad797f`, a6b16b0). Two refinements from them:
    - **The Twilio address and its supporting document survive a reset.** Both registration types accept
      the same address, so only the profile, the EndUsers and the assignments are deleted. The UI keeps
      the address prefilled.
    - **Deletes are only partly verified.** Deleting an EndUser has been checked live. Deleting a draft
      CustomerProfile, Address, SupportingDocument or EntityAssignment is believed to work but hasn't
      been tested. It gets verified, with Xander's yes, before the step relies on it.
- **Edits after terms are accepted** don't go through the wizard. Changing plan or price means cancelling
  the order and starting a new one, so the agreement on file always matches what was charged.

### Moved out of the wizard, into `/manage/{slug}`

These are operator records, so they belong on the client's page, not on a screen the client watches:

| Data | Home | Notes |
|---|---|---|
| Call reference, recording id, script hash, terms hash, acceptance PDF | new **Agreement** section (or a card on Overview) | `accept-terms` fills in the call reference automatically (lead phone + timestamp). It can be edited here, and the recording id is added here. Read through `GET /api/ops/orders/{id}`. |
| A2P registration record (SIDs, per-bundle status, Refresh, file brand) | existing **Messaging & A2P** section | That section is locked today while a client is pending onboarding (A2P handoff §3). It has to unlock for clients created by this flow, or "file the brand later" has nowhere to happen. |
| Payment method, order events | Overview recent activity | Already the console's audit pattern. |

## 8a. 3-D Secure and phone payments — setup

**Link path (3-D Secure).** Stripe Checkout already runs 3-D Secure whenever the bank asks for it.
To *ask for it ourselves* on the first payment, and get the liability shift more often, the ops
endpoint sets this when it creates the session:
`payment_method_options: { card: { request_three_d_secure: "any" } }`.
Renewals are off-session and can't be challenged. So any Radar block rule must exempt them:
`Block if not :is_3d_secure: and not :is_off_session:` (custom rules need Radar for Fraud Teams /
Radar Plus). A liability shift is likely for an authenticated payment, but Stripe doesn't guarantee it.

**Card path (MOTO).** It's off until Stripe enables it. 1) Ask Stripe support to enable mail/telephone
(MOTO) payments on the account. Describe it as sales-call orders where the cardholder starts the
payment by phone. 2) Ask them to confirm the Dashboard path for adding a card to an existing customer
as MOTO, and whether a subscription Checkout Session can be MOTO (undocumented). 3) Complete the PCI
SAQ for manual entry (C-VT). 4) Only then build `charge` and the `invoice.paid` trigger. MOTO payments
are exempt from 3-D Secure by definition, so this path never gets a liability shift.

## 8b. Portal login — DECIDED (orchestrator, 2026-11-03)

**No temporary passwords, ever, for real clients.** This convention applies across every session:

1. A portal account created on the server gets a Clerk **invitation** only
   (`createInvitation({ notify: false })`). The invite link goes in our welcome email, and the client
   picks a password, an email code or Google when they accept it. Nothing generates, sets, stores, logs
   or emails a password.
2. If a Clerk user already exists for that email, no invite is sent. The site is attached to their
   account and the welcome email says "sign in as usual". The Setup step reads "Site added to your
   existing login" in place of "Portal invite sent".
3. **Resend invite** revokes the old invitation and creates a new one. It's the one recovery path for a
   lost or expired link. It appears on the wizard's Done step (next to "Set up your portal login") and on
   the client card while Onboarding is still "Invite sent". The console calls a new agency endpoint
   `POST /api/ops/orders/{id}/resend-invite`. It works only while the client hasn't signed in, and only
   for the order's own email.
4. The only code that sets a Clerk password stays `provisionPortalTestLogin` in onboard.js, for test
   fixtures only. Don't copy that pattern.

## 9. Honest limits

- **The brand probably won't be *filed* on the call.** `brand.register` waits for both bundles to reach
  `in-review`, which Twilio says is "often minutes, occasionally days". So on the call we get both
  bundles submitted. Filing the brand is a later click after a status refresh. The 13–20 business-day
  carrier clock starts at the brand, so the card shows **Ready to file** to prompt that click.
- **No EIN means no clock.** Sole proprietors without an EIN have their own path
  (`registrationPath: "sole-proprietor"`, Growth only, and it can't be changed later). That's a
  different branch from "has an EIN but not to hand".
- **Verbal consent is weaker evidence than a signature** unless the call is recorded. Florida
  requires everyone on the call to consent to recording. So if you record, say so at the start.

## 10. Open decisions for Xander

- **D1 — How the card gets in.** Present both; pick the default.
  - *Link to their phone* (recommended default): works with today's Stripe setup. 2.9% + 30¢. 3-D
    Secure happens on their own phone, so fraud liability shifts to the bank. Zero PCI scope. They
    tick the ToS box themselves. Costs about a minute on the call.
  - *Stripe Dashboard, you type it (MOTO):* Stripe has to enable phone payments on the account first.
    The first charge is 3.4% + 30¢, then the normal rate. Stripe calls it "for exceptional
    circumstances" (SAQ C-VT). There's no 3-D Secure, so a fraud chargeback falls on JDD. It needs the
    `charge` endpoint and an `invoice.paid` fulfillment trigger.
  - *MOTO inside Stripe Checkout:* Stripe doesn't document it for subscriptions. Ask Stripe support.
    If it exists, it's the cleanest "I type it" path.
  - *Not an option:* opening the normal checkout link and typing their card yourself. Stripe sees your
    device as the cardholder's, a 3-D Secure challenge would land on your screen with the code on their
    phone, and it misclassifies a phone order as online.
- **D2 — Pricing.** Standard prices only, or a fixed menu of pre-made Stripe coupons (e.g. "waive
  onboarding fee"). No free-typed amounts: the console has no auth. Whichever you pick goes into the
  script and the confirmation email.
- **D3 — Enterprise.** The same wizard with a site list (phone handling asked per site at onboarding),
  or Starter/Growth only in v1.
- **D4 — Self-serve clickwrap.** Replace the signature pad on `/agreement` as part of this, or later.
- **D5 — Call reference.** Free text + the auto timestamp and number, or record calls (with the
  Florida announcement) and store the recording id.

## 11. Not in scope

Production code, live Stripe/Clerk/Twilio calls, master edits. The A2P chain is owned by the a2p-chain
session (`HANDOFF-a2p-chain-entrypoints.md`). This design calls into it and changes nothing in it.
