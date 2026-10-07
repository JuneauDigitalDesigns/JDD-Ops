# Plan: Convert-to-Client from /leads + agency-site onboarding gate

Author: Opus 4.8 (planning). Executor: Sonnet. Repo: `jdd-ops/console`.
Every path below is relative to `console/` unless noted. Do not invent symbols or KV keys;
every one named here was verified to exist. Where a decision is marked **[DECISION]** it was
made by the operator in the QA session and is not open for re-interpretation.

---

## 0. Context you must load before editing (do not re-derive)

Data model facts that this plan depends on:

- A **lead** is a KV record (`jdd:lead:item:{id}`, index `jdd:lead:index`), shapes in
  `src/lib/leadTypes.ts`, server I/O in `src/lib/leadQueue.ts`. Stages:
  `new | qualified | quoted | won | lost` (`LEAD_STAGES`). A lead already carries
  `convertedSlug?`, `clientRecordId?`, `email?`, `planInterest: 'starter'|'growth'|'enterprise'|null`,
  `businessName`, `name`, `phone`, `trade?`.
- A **client** in the roster is a folder on disk: `clients/{slug}/site.ts`. The roster
  (`/clients`, `src/components/picker/ClientIndex.tsx`) reads it via `/api/runbook/clients`.
- `convertLead(lead, slug, { email, siteSlugs })` in `src/lib/leadConversion.ts` ALREADY
  marks a lead `won`, sets `convertedSlug`, and (when an email is present + KV configured)
  creates/links a `ClientRecord` via `ensureClientRecord`, setting `clientRecordId`. Reuse it;
  do not reimplement the linking.
- A **ClientRecord** (`jdd:client:*`, `src/lib/clientRecord.ts`, schema in `@jdd/schema`)
  carries `{ id, email, slug, siteSlugs, leadId, stage }`. Resolve by slug with
  `getClientRecordBySlug(slug)`.
- A **PortalAccount / AccountRecord** (`@jdd/schema`, console reader `src/lib/accountStore.ts`)
  is keyed by normalized email. `getAccount(email)` returns it. Each `sites[]` entry has
  `status: 'pending-onboarding' | 'building' | 'live'`; the account has `onboardingCompletedAt?`.
  This record is written by the agency site's onboarding flow. **It is the authoritative
  signal that a client onboarded via the agency site.**
- The per-client shell `src/app/c/[slug]/layout.tsx` computes a `tools` object
  (`build/onboard/manage/account`, each `{ enabled, reason }`) and passes it through
  `ClientProvider` to `ClientChrome`, which dims disabled tabs and shows `reason` as a
  tooltip. This is the gate surface. A `pending` (paid-but-not-onboarded, KV-only, no folder)
  client already disables build/onboard here with a reason. You are extending this pattern.
- The console already sends email via Resend: `getResend()` in `src/lib/resend.ts`, live
  example in `src/app/api/c/[slug]/remind/route.ts`, email builder pattern in
  `src/lib/emails/onboarding-reminder.ts`. From-address env: `RESEND_FROM_EMAIL`
  (fallback `'Juneau Digital Designs <hello@juneaudigitaldesigns.com>'`).
- Every console mutation is appended to `console/.state/audit.ndjson` (key names, never
  values). Find the existing audit helper (grep `audit.ndjson`) and reuse it for new writes.

Rules from `jdd-ops/CLAUDE.md` that bind this work:
- Never invent schema values. Unknown fields stay in `_meta.missing_fields`.
- No em-dashes in any user-facing copy (buttons, emails, banners). Use commas, colons, periods.
- After code changes run `npm run build` (or the console's typecheck) and fix errors. Note the
  repo emits pre-existing tsc noise; filter to files you touched.

**Non-goals / out of scope (do not do):** changing the agency-site (producer) repo; changing
how leads are produced; adding auth to the console; reworking drag-and-drop; touching enterprise
multi-site provisioning logic beyond what is written here.

---

## Decisions locked in the QA session

1. Light up ONLY unconverted won cards (`stage==='won' && !clientRecordId && !convertedSlug`).
2. Light-up style: green (`--ok`) glow border + soft pulse.
3. Convert creates the disk folder AND links the lead (via `convertLead`).
4. Convert opens a small confirm dialog, prefilled from the lead.
5. After a successful convert, go to `/clients` and scroll to + briefly highlight the new card.
6. Plan is REQUIRED in the convert dialog; prefill from `planInterest` when set, otherwise no
   default (operator must pick).
7. An already-converted won lead shows a DISABLED "Convert to Client" button with an
   "Already converted" tooltip (plus the existing "Became a client" line).
8. Email is REQUIRED to convert. Prefill from `lead.email`; operator can type it in the dialog.
9. Build/Onboard unlock when the client's linked PortalAccount has a site whose status is past
   `pending-onboarding` (i.e. `building` or `live`). No account / still `pending-onboarding`
   stays locked. Join is by email.
10. DROP the "New client" escape hatch on `/clients` entirely. Every client funnels in through
    `/leads`, starting as a lead, always. The only client-creation path is Convert-to-Client.
11. Enforce the gate at THREE layers: the layout `tools` gate, route redirects on
    `build`/`onboard` pages, and server guards on the build/onboard write APIs.
12. Locked client UX: dimmed Build/Onboard tabs with a reason; Manage stays reachable and, while
    locked, shows a "send welcome email" card + a "copy signup link" button. Manage becomes full
    the moment the client is onboarded (single transition; "built" is not a separate Manage gate).
13. Welcome email is sent via Resend to the client's email; CTA link is
    `https://www.juneaudigitaldesigns.com/portal/sign-up?redirect_url=%2Fstart%3Fplan%3D{plan}`
    where `{plan}` is `starter|growth|enterprise`.

---

## FEATURE A — Convert won lead to client, and light up ready cards

### A1. Export the slugify helper (shared prefill)

`src/lib/leadConversion.ts`: the module-private `slugify(name)` (line ~78, "Match intake's
slugifyBrand exactly") must be reused by the dialog and the convert route. Add `export` to it.
Do not create a second slugify anywhere.

### A2. Shared client-folder writer

Currently `src/app/api/clients/create/route.ts` writes `clients/{slug}/site.ts` from a vertical
preset. We are deleting that route (Feature B, step B7) but must keep its folder-seeding logic.

Extract it into a reusable helper. Add to `src/lib/export.ts` (which already exports
`resolveRepoRoot`, `isValidSlug`, `writeClientIntake`, `IntakeEnvelope`) a function:

```ts
// Seed a real clients/<slug>/site.ts from a vertical preset. Only brand.name/short are
// supplied by the operator; everything else keeps the preset placeholder and stays in
// _meta.missing_fields (CLAUDE.md: never invent values). Throws on invalid slug / existing folder.
export function seedClientFolder(input: {
  repoRoot: string;
  slug: string;
  name: string;
  plan: 'starter' | 'growth' | 'enterprise';
  vertical: VerticalId;
}): void
```

Move the body of the existing `POST` in `clients/create/route.ts` (the `VERTICAL_PRESETS[vertical]`
lookup, the `existsSync` check that throws a 409-equivalent, the `IntakeEnvelope` construction with
`brand.name`/`short`, `_meta.selectedPlan`, `missing_fields` minus `brand.name`, and the
`writeClientIntake` call) into this helper. Import `VERTICAL_PRESETS, VerticalId` from
`@/lib/verticals`. For the "already exists" case, throw a typed error the caller can turn into a 409
(e.g. `throw Object.assign(new Error(...), { code: 'EXISTS' })`).

### A3. Convert API route

Create `src/app/api/leads/convert/route.ts` (`runtime = 'nodejs'`, `dynamic = 'force-dynamic'`).

`POST` body: `{ id: string, slug: string, plan: 'starter'|'growth'|'enterprise', vertical: VerticalId, email: string }`.

Steps, in order:
1. `if (!leadQueueConfigured()) return 503`.
2. Validate: `id` non-empty; `isValidSlug(slug)`; `plan` in the three; `vertical` in `VERTICAL_PRESETS`;
   `email` present and looks like an email (simple regex, same tolerance as elsewhere). Any miss -> 400.
3. `const lead = await getLead(id)` -> 404 if null.
4. `const repoRoot = resolveRepoRoot();` then `seedClientFolder({ repoRoot, slug, name: lead.businessName, plan, vertical })`.
   Catch the `EXISTS` error -> return 409 `{ error, needsSlug: true }` so the dialog can ask for another slug.
5. Persist the email onto the lead if it changed: if `email !== lead.email`, call
   `patchLead(id, { email, activity: { kind: 'field', text: 'Email added at conversion' } })`.
6. `const updated = await convertLead({ ...lead, email }, slug, { email });` (this marks won, writes
   `convertedSlug`, and links the `ClientRecord`). If it returns null -> 500.
7. Return `{ ok: true, slug }`.

Do NOT trigger provisioning or build here. Convert only creates the shell + link.

### A4. Convert dialog component

Create `src/components/leads/ConvertDialog.tsx`, modeled closely on
`src/components/picker/NewClientDialog.tsx` (reuse its layout/classes). Props:
`{ lead: QueuedLead; onConverted: (slug: string) => void; onClose: () => void }`.

Fields, all prefilled from the lead:
- **Business name** (readonly display of `lead.businessName`, used as `name`).
- **Slug**: default `slugify(lead.businessName)`; editable; validate `^[A-Za-z0-9_-]+$`.
- **Email**: default `lead.email ?? ''`; REQUIRED; editable.
- **Plan**: `<select>` of `starter|growth|enterprise`; default to `lead.planInterest` when set,
  otherwise NO selection and the submit button is disabled until one is chosen. **[DECISION 6]**
- **Vertical**: `<select>` from `VERTICALS`; default `VERTICALS[0].id`.

Submit posts to `/api/leads/convert`. On `409 needsSlug`, show the error inline and keep the dialog
open so the operator can change the slug. On success, call `onConverted(data.slug)`. Copy on the
primary button: `Convert to client`. No em-dashes anywhere in this component.

### A5. Wire the Convert button into LeadModal

`src/components/leads/LeadModal.tsx`, left column, near the existing `convertedSlug` block (~line 430):

- Compute `const converted = Boolean(lead.clientRecordId || lead.convertedSlug);`
- Show a "Convert to Client" primary button ONLY when `lead.stage === 'won'`.
  - If `converted`: render it DISABLED with `title="Already converted"` (**[DECISION 7]**). Keep the
    existing "Became a client, {slug}" line below it.
  - Else: enabled; clicking sets local state to open `ConvertDialog`.
- `LeadModal` needs a way to bubble the chosen slug up to `LeadsView` for navigation. Add an optional
  prop `onConverted?: (slug: string) => void` to `LeadModal` and call it from the dialog's
  `onConverted`. Do not navigate from inside the modal.

### A6. Navigate + highlight after convert

`src/components/leads/LeadsView.tsx`:
- Import `useRouter` from `next/navigation`.
- Pass `onConverted={(slug) => router.push(`/clients?new=${slug}`)}` into `LeadModal`.
- Also close the modal and clear `openId`/`freshId` when converting.

`src/components/picker/ClientIndex.tsx`:
- Read `const params = useSearchParams(); const highlightSlug = params.get('new');`
  (add `'use client'` already present; import `useSearchParams` from `next/navigation`).
- When rendering the `ClientCard` whose `ctx.slug === highlightSlug`, attach a ref and, in a
  `useEffect` keyed on the list being loaded + `highlightSlug`, call `scrollIntoView({ behavior:'smooth', block:'center' })`
  and apply a temporary highlight class for ~2.5s then remove it.
- Add a small highlight treatment (green ring using `--ok`) via a CSS class (see A8 for where CSS
  lives). Keep it subtle. After first application, clear the `?new` param with
  `router.replace('/clients')` so a refresh does not re-highlight.

### A7. Light up ready-to-convert won cards

`src/components/leads/LeadCard.tsx`, in `LeadFace`:
- Compute `const readyToConvert = lead.stage === 'won' && !lead.clientRecordId && !lead.convertedSlug;`
  (**[DECISION 1]**).
- When `readyToConvert`, override the card container style: `borderColor: 'var(--ok)'`, add a green
  glow `boxShadow` layered over the existing shadow, and add a CSS class `lead-ready` that runs a soft
  pulse (**[DECISION 2]**). Precedence: `readyToConvert` beats the `stale` warn border (a won lead is
  not stale anyway; `stageCanGoStale` excludes won, so they will not collide, but code the override
  so ready wins).
- The `DragOverlay` also renders `LeadFace`; the glow following a dragged ready card is fine.

### A8. CSS for pulse + highlight

Add to `src/app/globals.css` (the Next.js global; confirm it is the one imported by
`src/app/layout.tsx`):

```css
@keyframes leadReadyPulse {
  0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--ok) 45%, transparent); }
  50%      { box-shadow: 0 0 0 6px color-mix(in srgb, var(--ok) 0%, transparent); }
}
.lead-ready { animation: leadReadyPulse 2.4s ease-in-out infinite; }

@keyframes clientNewHighlight {
  from { box-shadow: 0 0 0 3px var(--ok); }
  to   { box-shadow: 0 0 0 0 transparent; }
}
.client-new-highlight { animation: clientNewHighlight 2.5s ease-out 1; }
```

If `color-mix` is not acceptable in this toolchain, fall back to a static `rgba` glow plus an
opacity pulse. Prefer reduced-motion safety: wrap the pulse in
`@media (prefers-reduced-motion: no-preference)`.

---

## FEATURE B — Onboarding gate (block build/onboard until agency-site onboarding)

### B1. The gate helper (single source of truth)

Create `src/lib/onboardingGate.ts` (`import 'server-only'`):

```ts
export interface OnboardingGate {
  onboarded: boolean;
  email: string | null;
  reason: string | null; // user-facing, null when onboarded
}

// Onboarded == the client's linked PortalAccount (resolved by email) has a site whose
// status is past 'pending-onboarding' (i.e. 'building' or 'live'), or onboardingCompletedAt
// is set. Join is by email via the ClientRecord for this slug. [DECISION 9/13]
export async function getOnboardingGate(slug: string): Promise<OnboardingGate>
```

Implementation:
1. If `!clientRecordsConfigured() || !accountStoreConfigured()`: **fail-open** ->
   `{ onboarded: true, email: null, reason: null }`. Rationale: the gate is a workflow guardrail,
   not security, and a console without KV must still function in dev. **[ASSUMPTION - confirm with
   operator; flip to fail-closed if they prefer.]**
2. `const rec = await getClientRecordBySlug(slug);` If no record or no `rec.email` ->
   `{ onboarded: false, email: rec?.email ?? null, reason: "Waiting on the client's onboarding. Send them the signup link from Manage." }`.
3. `const account = await getAccount(rec.email);` If none -> locked (same reason as step 2).
4. `const onboarded = Boolean(account.onboardingCompletedAt) || account.sites.some(s => s.status === 'building' || s.status === 'live');`
   Prefer the site matching `slug` if present, but treat any onboarded site on the account as
   sufficient (one account maps to one client for starter/growth; enterprise shares an account).
5. Return `{ onboarded, email: rec.email, reason: onboarded ? null : "Waiting on the client's onboarding. Send them the signup link from Manage." }`.

Wrap KV calls in try/catch and fail-open on a thrown error (do not 500 the whole `/c/*` shell).
Keep the exact `reason` string in one exported const so the layout, redirects, and API guards share it.

### B2. Layout gate

`src/app/c/[slug]/layout.tsx`, in the NON-pending branch (the `else` around line 105):
- `const gate = await getOnboardingGate(ctx.slug);`
- `build: { enabled: gate.onboarded, reason: gate.onboarded ? null : gate.reason }`
- `onboard: { enabled: gate.onboarded && ctx.hasIntake, reason: gate.onboarded ? (ctx.hasIntake ? null : 'No readable site.ts yet.') : gate.reason }`
- `manage: { enabled: true, reason: null }` — force-enable so the locked client is reachable to send
  the welcome email (mirrors how the `pending` branch force-enables manage). Do not gate manage on
  `isManageable(ctx)` anymore; instead OverviewSection decides what to render (B5). **[DECISION 10/12/15]**
- `account`: leave exactly as-is (provisioning-gated).

The existing `pending` branch is unchanged (it already disables build/onboard).

### B3. Redirect on the shell entry

`src/app/c/[slug]/page.tsx`: currently
`if (!ctx.hasIntake || ctx.detectedStatus === 'needs-build') redirect(.../build)`.
Add ahead of it: compute the gate; if `!gate.onboarded`, `redirect(`/c/${slug}/manage`)` so a locked
client lands on the welcome-email card instead of an unusable build wizard.

### B4. Redirect on build/onboard pages

`src/app/c/[slug]/build/page.tsx` and `src/app/c/[slug]/onboard/page.tsx` (both server components):
at the top, `const gate = await getOnboardingGate(params.slug); if (!gate.onboarded) redirect(`/c/${params.slug}/manage`);`
This is the second enforcement layer. **[DECISION 11]**

### B5. Manage Overview: locked vs full

`src/components/manage/OverviewSection.tsx` (rendered by `app/c/[slug]/manage/page.tsx` and
`app/c/[slug]/manage/[section]/page.tsx`). The server side already resolves the client; add the gate
result into `ManageContext` (or fetch it in the manage layout/page and pass down) so OverviewSection
knows `onboarded` + `email`.
- When `!onboarded`: render a "Welcome the client" card INSTEAD of the normal health tiles:
  - One short explanatory line (no em-dashes): "This client has not onboarded yet. Send them the
    signup link to begin."
  - The recipient email (from the gate).
  - A primary "Send welcome email" button -> `POST /api/c/{slug}/welcome` (B6). Show success/failure
    inline; disable while sending.
  - A secondary "Copy signup link" button that copies
    `https://www.juneaudigitaldesigns.com/portal/sign-up?redirect_url=%2Fstart%3Fplan%3D{plan}`
    to the clipboard (**[DECISION 12/13]**), where `{plan}` is the client's plan (`ctx.plan`).
- When `onboarded`: render the existing full Overview unchanged.

Keep this a clean top-level branch so it is obvious and easy to remove later.

### B6. Welcome email builder + route

Create `src/lib/emails/welcome-onboarding.ts` modeled on `src/lib/emails/onboarding-reminder.ts`:

```ts
export function buildWelcomeEmail(input: {
  clientName: string;
  plan: 'starter' | 'growth' | 'enterprise';
}): { subject: string; html: string; text: string }
```

- CTA URL: `https://www.juneaudigitaldesigns.com/portal/sign-up?redirect_url=%2Fstart%3Fplan%3D${input.plan}`
  (do not re-encode; it is already encoded).
- Branded, warm, short. NO em-dashes. Example text body (adapt, keep tone):
  "Hi {clientName}, welcome to Juneau Digital Designs. To get started, create your account and
  complete a short onboarding form. It takes about five minutes. Click here to begin: {url}.
  Once you finish, we will build your site."
- HTML version: reuse the reminder email's HTML shell/styles for visual consistency.

Create `src/app/api/c/[slug]/welcome/route.ts` (`POST`), modeled on `remind/route.ts` but sourced
from the ClientRecord, not the pending-onboard KV:
1. `SLUG_RE` check -> 400.
2. `const rec = await getClientRecordBySlug(slug);` If no `rec?.email` -> 400
   ("No email on file for this client.").
3. Resolve plan: read it from `ctx`/disk (`getClientCached(slug)` -> `ctx.plan`) or from the
   ClientRecord if it carries one; default to the same plan the folder was seeded with.
4. `const { subject, html, text } = buildWelcomeEmail({ clientName: <brand/display name>, plan });`
5. Send with `getResend()`, `from: process.env.RESEND_FROM_EMAIL || 'Juneau Digital Designs <hello@juneaudigitaldesigns.com>'`,
   `to: rec.email`. Handle `result.error` -> 502.
6. Append an audit line (`welcome-email-sent`, slug, recipient email key only) to `.state/audit.ndjson`
   using the existing audit helper.
7. Return `{ ok: true, to: rec.email }`.

This is a "send message on the user's behalf" action, but it is operator-initiated by a button click
in the console UI, which is the confirmation. Do not send automatically anywhere.

### B7. Drop the "New client" escape hatch  [DECISION 10]

- `src/components/picker/ClientIndex.tsx`: remove the `creating` state, the `NewClientDialog` import
  and its render (`{creating && <NewClientDialog .../>}`), the `openBuild` handler if now unused, and
  the `onNew` prop passed to `IndexControls`.
- `src/components/picker/IndexControls.tsx`: remove the `onNew` prop (type + destructure) and the
  "New client" button (line ~57-59) and its `Plus` import if now unused.
- Delete `src/components/picker/NewClientDialog.tsx`.
- Delete `src/app/api/clients/create/route.ts` (its folder-seeding moved to `seedClientFolder`, A2).
  Grep the repo for any other caller of `/api/clients/create` first; there should be none after the
  above. If one exists, stop and report rather than guessing.
- Update the empty-state copy in `ClientIndex` (currently "Use New client to add one.") to point at
  the funnel instead, e.g.: "No clients yet. Clients start as leads, convert a won lead from the
  Leads board." No em-dashes.

---

## Edge cases to handle explicitly

- **Convert when a `clients/{slug}` folder already exists** (e.g. slug collision): route returns 409
  `needsSlug`; dialog keeps open and asks for a different slug. Never overwrite an existing folder.
- **Convert a lead with no email**: dialog blocks submit until an email is entered (**[DECISION 8]**).
- **Lead already `won` before Convert**: expected; `convertLead` is safe to call. The card was in the
  Won column already; converting just adds the link and stops the glow (because `clientRecordId` is now set).
- **KV not configured**: gate fails open (B1 step 1). Leads/convert routes already 503 when
  `leadQueueConfigured()` is false; keep that.
- **Account exists but still `pending-onboarding`**: locked (correct). Unlocks automatically when the
  agency site advances the site to `building`/`live`; the shell re-reads the gate on next load
  (routes are `force-dynamic`), no manual refresh of server state needed.
- **Enterprise account with multiple sites**: onboarded if ANY site is past `pending-onboarding`
  (B1 step 4).
- **`?new=` highlight on a client not in the current filtered view** (e.g. a plan filter is active):
  do not force it visible; just skip the scroll if the node is absent. Still clear the param.

---

## Verification (do all before declaring done)

1. Typecheck/build the console; fix errors in touched files only.
2. Manual/preview flow (use the preview tools, dev server name in `.claude/launch.json`):
   - On `/leads`, drag a lead to Won -> its card shows the green glow + pulse.
   - Open it -> "Convert to Client" enabled. Convert with a plan + email -> lands on `/clients`,
     the new card scrolls into view and highlights; the won card's glow is gone; the modal shows the
     "Became a client" line and a disabled Convert button.
   - Open the new client at `/c/{slug}` -> redirected to Manage; Build/Onboard tabs dimmed with the
     waiting reason; Manage shows the welcome card with Send + Copy link.
   - "Copy signup link" copies exactly
     `https://www.juneaudigitaldesigns.com/portal/sign-up?redirect_url=%2Fstart%3Fplan%3D{plan}`.
   - Directly navigating to `/c/{slug}/build` while locked -> redirected to Manage.
   - Hitting a guarded build/onboard write API while locked -> 403.
   - Simulate onboarding: with a linked account whose site status is `building`, reload -> Build/Onboard
     unlock, Manage shows the full Overview.
   - Confirm the "New client" button is gone from `/clients` and `NewClientDialog` no longer exists.
3. Grep for leftover em-dashes in every string you added (emails, banners, buttons, empty state).

## Suggested commit slices (optional)

1. Gate helper + layout/redirect/API guards + welcome route/email (Feature B core).
2. Manage Overview locked card + copy-link.
3. Convert route + dialog + LeadModal button + light-up + highlight (Feature A).
4. Remove the escape hatch (delete NewClientDialog + clients/create, extract seedClientFolder).
