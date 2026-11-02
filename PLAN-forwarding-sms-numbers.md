# PLAN — forwarding number + SMS alert number (two distinct lines, surfaced in the console)

Status: drafted 2026-10-23. Scope approved by Xander: full end-to-end (schema, jdd-ops, console, agency site).
Supersedes the open items in `HANDOFF-console-forwarding-number.md`.

---

## 0. The model (read first)

There are **three** phone numbers in a provisioned client, with three different jobs. Two of
them already work; this plan adds the third and makes all three legible in the console.

| Number | Where it lives today | Job |
|---|---|---|
| **Published** — `brand.phone` / `brand.phoneHref` | client repo `src/data/site.ts`, swapped to the JDD Twilio number by `applyTwilioNumberToSite` | what the website shows and what customers dial |
| **Call-forward target** — `CLIENT_FORWARD_PHONE` | `clients/{slug}/.env.local` | where `/api/voice` rings hop 1 before the agent |
| **SMS alert number** — `intake.smsAlerts.phone` | intake envelope, baked into the Make.com post-call clone by `cloneAndWirePostCall` | where post-call summary texts go |

Two facts drive the whole plan:

1. **The forward target is hardwired to `brand.phone`** at `lib/client-env.js:99`
   (`CLIENT_FORWARD_PHONE=${content.brand.phone}`). There is no way for a client to forward to a
   *different* line than the one they advertised. The signing flow already captures an explicit
   `agreement.forwardingNumber`, but it dead-ends on the agreement record and never reaches
   onboard.js.
2. **The SMS alert number never touches `.env.local`.** It is wired straight into the Make clone,
   so `/manage` cannot show or edit it.

### The two receptionist modes (Xander's definition, 2026-10-23)

`receptionistMode` is already `forwarded | published | declined` everywhere. Today the routing
code (`lib/site-routes/voice.route.ts`) ignores the distinction and always rings
`CLIENT_FORWARD_PHONE` first. This plan makes the two modes behave differently, as intended:

- **`forwarded`** — JDD publishes the Twilio number. `/api/voice` rings the owner's line first for
  `CLIENT_FORWARD_RING_SECONDS` (15s), then falls through to the Retell agent. The forward target
  is **`forwardingNumber` when the client named a distinct line, else `brand.phone`**.
- **`published`** — the client forwards *their own* advertised line to our Twilio number, so our
  number must go **straight to the agent** with no owner leg. Ringing an owner leg here would loop
  (their line forwards back to us). In this mode there is **no** `CLIENT_FORWARD_PHONE`.
- **`declined`** — web-only. No voice stack at all. Unchanged.

### The SMS number is independent

The SMS alert number may be the **same** as the forward number or a **different** one (owner's
cell for texts, a landline for forwarded calls). It is captured and wired independently via
`smsAlerts` and is unaffected by the forwarded/published choice.

### Decisions locked

- `forwardingNumber` lives on the **Intake envelope + `.env.local`**, exactly like `smsAlerts` and
  `receptionistMode`. It is **not** added to `PortalSite`/`zPortalAccount`. (This keeps owner-private
  numbers off the browser-readable account record, matching the existing `smsAlerts` rule, and keeps
  the change small.)
- The forward target already surfaces in the console as `CLIENT_FORWARD_PHONE`; we only need to feed
  it the right value.
- The SMS number gets persisted to `.env.local` as a new `SMS_ALERT_NUMBER` key and a curated console
  field. See the honest caveat in §6 about what "editable" can and cannot mean.

---

## 1. The new `.env.local` contract

For a **voice** client (not web-only):

```
RECEPTIONIST_MODE=forwarded|published        # NEW — drives /api/voice and the console
RETELL_AGENT_ID=…
RETELL_LLM_ID=…
RETELL_API_KEY=…
RETELL_SIP_DOMAIN=sip.retellai.com
TWILIO_NUMBER=…
# forwarded mode only:
CLIENT_FORWARD_PHONE=<forwardingNumber || brand.phone>   # CHANGED (was always brand.phone)
CLIENT_FORWARD_RING_SECONDS=15
# (published mode: both CLIENT_FORWARD_* keys are OMITTED)
AIRTABLE_BASE_ID=…
RETELL_POST_CALL_WEBHOOK_URL=…
SMS_ALERT_NUMBER=<smsAlerts.phone>           # NEW — only when SMS consent is on file
VERCEL_PROJECT_NAME=…
```

Web-only clients keep **none** of the voice keys (unchanged; the new keys join the exclusion list).

---

## 2. `@jdd/schema` (cut a new tag, bump the pin)

Current version 1.26.0, pin `github:JuneauDigitalDesigns/jdd-schema#v1.25.1` in consumers.

### 2a. `src/intake.ts` — add `forwardingNumber` to the envelope

On both `Intake` and `IntakeEnvelope`, beside `receptionistMode`:

```ts
  /**
   * The business line the owner wants inbound calls forwarded to, when receptionistMode is
   * "forwarded" and it differs from brand.phone (a landline, a different cell). Envelope-level
   * and kept OFF SiteContent/PortalSite for the same reason as smsAlerts: every SiteContent field
   * is serialized into the public client repo, and PortalAccount is browser-readable on the portal
   * hot path. onboard.js reads this to set CLIENT_FORWARD_PHONE. Absent means "use brand.phone".
   */
  forwardingNumber?: string;
```

### 2b. `src/brand-intake.ts`

Add to `BrandIntakeSubmission` (beside `receptionistMode`, line ~42):

```ts
  /** The existing business line to forward to. Only meaningful when receptionistMode === "forwarded". */
  forwardingNumber?: string;
```

In `mapBrandIntakeToIntake`, carry it onto the envelope exactly like `receptionist` (line ~400):

```ts
  const forwarding = sub.forwardingNumber ? { forwardingNumber: sub.forwardingNumber } : {};
```

and spread `...forwarding` into all three `return` objects (single-site and both enterprise
branches), right after `...receptionist`.

### 2c. `src/zod.ts` — REQUIRED or it is silently dropped

`zIntake` has **no `.passthrough()`** (zod.ts:121-123), so an undeclared key is stripped on parse —
the same trap that forced `smsAlerts` to be declared there. Add to `zIntake` (line ~124):

```ts
export const zIntake = z.object({
  plan,
  siteCount: z.number().int().positive().optional(),
  sites: z.array(zSiteContent).min(1),
  smsAlerts: zSmsAlerts.nullish(),
  forwardingNumber: z.string().optional(),   // NEW — or onboard.js loses it on queue round-trip
});
```

And to `zBrandIntakeSubmission` (line ~182, beside `receptionistMode`):

```ts
    forwardingNumber: z.string().optional(),
```

### 2d. Ship it

```bash
cd /c/Users/Xander/Desktop/ops/jdd-schema
npm run build          # refresh dist/ — consumers read dist, not src
# commit, tag v1.27.0, push tag
```

Then bump the pin to `github:JuneauDigitalDesigns/jdd-schema#v1.27.0` in **every** consumer's
`package.json` and reinstall: `jdd-ops`, `jdd-ops/console`, `juneau-digital-designs`.
(Reminder from memory `reference-jdd-schema-types-mirror`: a client repo type-erroring on a field
the console compiles fine is `SITE_TYPES_SOURCE` drift — not relevant here since this field is
envelope-level, not on `SiteContent`, but worth remembering if a client build complains.)

---

## 3. `jdd-ops`

### 3a. `lib/client-env.js` — thread the envelope values, branch on mode

**Signature** (line 67): add three optional args.

```js
export function buildClientEnvLines({ siteSlug, plan, content, webOnly, prev = {}, env = {}, receptionistMode, forwardingNumber, smsAlerts }) {
```

**Replace the whole `if (wantsVoice) { … }` block** (lines 90-103) with:

```js
  if (wantsVoice) {
    // forwarded = JDD publishes the Twilio number and /api/voice rings the owner first, then the
    // agent. published = the client forwards their OWN line to our number, so /api/voice goes
    // straight to the agent and there is NO owner leg. Resolve from the explicit envelope value,
    // falling back to whatever the file already said (a console plan-upgrade carries no envelope)
    // and finally to the legacy behaviour, which was always-forward.
    const mode = receptionistMode || prev.RECEPTIONIST_MODE || 'forwarded';
    lines.push(`RECEPTIONIST_MODE=${mode}`);
    lines.push(`RETELL_AGENT_ID=${keep('RETELL_AGENT_ID')}`);
    lines.push(`RETELL_LLM_ID=${keep('RETELL_LLM_ID')}`);
    lines.push(`RETELL_API_KEY=${env.RETELL_API_KEY || ''}`);
    lines.push(`RETELL_SIP_DOMAIN=${env.RETELL_SIP_DOMAIN || 'sip.retellai.com'}`);
    lines.push(`TWILIO_NUMBER=${keep('TWILIO_NUMBER')}`);
    if (mode === 'forwarded') {
      // The forward target is the explicit forwardingNumber captured at signing when the client
      // named a distinct line, else brand.phone (today's behaviour), else a value preserved from
      // a prior run. Left in the client's raw form on purpose: /api/voice and the console both
      // normalise to E.164, exactly as they already do for brand.phone.
      const forward = forwardingNumber || prev.CLIENT_FORWARD_PHONE || content.brand.phone;
      lines.push(`CLIENT_FORWARD_PHONE=${forward}`);
      lines.push(`CLIENT_FORWARD_RING_SECONDS=${clampRingSeconds(keep('CLIENT_FORWARD_RING_SECONDS') || RING_SECONDS_DEFAULT)}`);
    }
    lines.push(`AIRTABLE_BASE_ID=${keep('AIRTABLE_BASE_ID')}`);
    lines.push(`RETELL_POST_CALL_WEBHOOK_URL=${keep('RETELL_POST_CALL_WEBHOOK_URL')}`);
    // SMS alert destination. Independent of the forward number: the owner can take texts on a cell
    // while calls forward to a landline, or use one number for both. Written for console visibility
    // and as the single stored source. NOTE: the Make clone's Twilio module carries its own baked
    // copy (cloneAndWirePostCall), so editing this re-points texts only after the post-call wiring
    // is re-run — see PLAN §6.
    const smsNumber = (smsAlerts && smsAlerts.consented && smsAlerts.phone) ? smsAlerts.phone : keep('SMS_ALERT_NUMBER');
    if (smsNumber) lines.push(`SMS_ALERT_NUMBER=${smsNumber}`);
  }
```

Update the module's top comment (the "CLIENT_FORWARD_PHONE is the owner's real line and never the
Twilio number" paragraph) to say the forward target is now `forwardingNumber || brand.phone`, and
that published mode writes no forward target.

### 3b. `onboard.js` — pass the envelope values through

**`writeClientEnvLocal`** (line 842) signature and call to `buildClientEnvLines`:

```js
function writeClientEnvLocal(clientDir, siteSlug, plan, content, webOnly, envelope = {}) {
  log(4, `Write .env.local (plan=${plan}${webOnly ? ', website-only' : ''})`);
  const prev = readEnvLocal(clientDir);
  const { lines, carried } = buildClientEnvLines({
    siteSlug, plan, content, webOnly, prev, env: process.env,
    receptionistMode: envelope.receptionistMode,
    forwardingNumber: envelope.forwardingNumber,
    smsAlerts: envelope.smsAlerts,
  });
  // …rest unchanged…
```

Also extend the "preserved" log list (line 861) to include the new keys so the console audit and
the operator see them carried:

```js
  const preserved = [
    ...['RETELL_AGENT_ID', 'TWILIO_NUMBER', 'CLIENT_FORWARD_PHONE', 'AIRTABLE_BASE_ID', 'RECEPTIONIST_MODE', 'SMS_ALERT_NUMBER'].filter((k) => prev[k]),
    ...carried,
  ];
```

**Call site** in `main()` (line 2971):

```js
    const { lines: envLines } = writeClientEnvLocal(clientDir, siteSlug, intake.plan, site, webOnly, {
      receptionistMode: intake.receptionistMode,
      forwardingNumber: intake.forwardingNumber,
      smsAlerts: intake.smsAlerts,
    });
```

**`runCorrectnessChecks`** — thread `forwardingNumber` so the "forward preserved" check compares
against the *intended* forward target, not always `brand.phone`. Signature (line 2012):

```js
async function runCorrectnessChecks({ envLines, plan, webOnly, twilioNumber, phoneSwap, baseId, siteTag, smsAlerts, forwardingNumber, clientDir }) {
```

Change the `checkForwardPreserved` call (line 2019):

```js
    checkForwardPreserved({
      lines: envLines,
      expectedForward: forwardingNumber || phoneSwap?.previous || null,
      webOnly,
    }),
```

And pass it at the `main()` call site (line 3031 block), adding:

```js
      forwardingNumber: intake.forwardingNumber,
```

### 3c. `lib/site-routes/voice.route.ts` — implement the published branch

This file is written verbatim into every client repo on each onboard run and has no shared imports
(the standalone-copy exception). Add, immediately after the `forwardPhone` block (after line 32):

```ts
  // "published" mode: the client has forwarded their OWN business line to this Twilio number, so
  // there is no owner leg to ring — doing so would loop back to a line that forwards to us. Hand
  // straight to the Retell agent by re-entering the no-answer route, which registers the call and
  // returns the SIP dial. A <Redirect> carries From/To but no DialCallStatus, so no-answer treats
  // it as a fall-through (never "completed") and connects the agent.
  if ((process.env.RECEPTIONIST_MODE ?? 'forwarded') === 'published') {
    const baseUrl = req.nextUrl.origin;
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Redirect method="POST">${baseUrl}/api/voice/no-answer</Redirect></Response>`,
      { headers: { 'Content-Type': 'text/xml' } },
    );
  }
```

Place this **before** the `if (!forwardPhone)` guard so a published client with no
`CLIENT_FORWARD_PHONE` is not rejected with "This number is not configured." Default is `forwarded`
so existing deployed routes behave exactly as today until re-provisioned.

Mirror the same `RECEPTIONIST_MODE` default handling into `template/src/app/api/voice/route.ts` so
a freshly scaffolded repo matches what onboard.js writes (grep showed the template keeps its own
copy). No change needed to `no-answer.route.ts`.

### 3d. `lib/onboard-checks.js` — make the matrix mode-aware

**`checkEnvTierMatrix`** (line 96). Replace the voice-keys section (lines 106-115) with:

```js
  // Voice keys every receptionist client must have, regardless of mode.
  const coreVoiceKeys = ['RETELL_AGENT_ID', 'TWILIO_NUMBER', 'AIRTABLE_BASE_ID', 'RECEPTIONIST_MODE'];
  // The forward leg exists ONLY in forwarded mode. Published clients forward their own line to us,
  // so /api/voice goes straight to the agent and must carry no forward target.
  const forwardKeys = ['CLIENT_FORWARD_PHONE'];
  const allVoiceKeys = [...coreVoiceKeys, ...forwardKeys, 'SMS_ALERT_NUMBER'];

  if (webOnly) {
    const present = allVoiceKeys.filter((k) => k in env);
    if (present.length) return bad(id, `web-only client must have no voice keys, found: ${present.join(', ')}`);
    return ok(id, `LEAD_DELIVERY_MODE=${expected}, voice stack absent (web-only)`);
  }

  const mode = env.RECEPTIONIST_MODE;
  if (mode !== 'forwarded' && mode !== 'published') {
    return bad(id, `RECEPTIONIST_MODE is "${mode ?? '(unset)'}" (expected forwarded|published for a receptionist client)`);
  }
  const required = mode === 'forwarded' ? [...coreVoiceKeys, ...forwardKeys] : coreVoiceKeys;
  const missing = required.filter((k) => !(k in env));
  if (missing.length) return bad(id, `receptionist client (${mode}) is missing voice keys: ${missing.join(', ')}`);
  if (mode === 'published' && 'CLIENT_FORWARD_PHONE' in env) {
    return bad(id, 'published client must not set CLIENT_FORWARD_PHONE — /api/voice goes straight to the agent');
  }
  return ok(id, `LEAD_DELIVERY_MODE=${expected}, voice stack present (${mode})`);
```

**`checkForwardNotSelf`** — no change. Its existing guard
`if (!('CLIENT_FORWARD_PHONE' in env)) return skip` already skips published clients.

**`checkForwardPreserved`** (line 173) — rename `previousPhone` → `expectedForward` and update the
message, so a distinct forwarding number is accepted rather than flagged:

```js
export function checkForwardPreserved({ lines, expectedForward, webOnly }) {
  const id = 'site.forwardPreserved';
  if (webOnly) return skip(id, 'web-only client has no forward target');
  const env = envLinesToObject(lines);
  if (!('CLIENT_FORWARD_PHONE' in env)) return skip(id, 'no forward leg for this client (published or web-only)');
  if (!expectedForward) return skip(id, 'intended forward target unknown');
  if (!bothDialable(env.CLIENT_FORWARD_PHONE, expectedForward)) {
    return skip(id, `cannot compare "${env.CLIENT_FORWARD_PHONE}" with "${expectedForward}" — one is not a dialable number`);
  }
  if (!sameLine(env.CLIENT_FORWARD_PHONE, expectedForward)) {
    return bad(id, `CLIENT_FORWARD_PHONE is ${env.CLIENT_FORWARD_PHONE}, expected the forward line ${expectedForward}`);
  }
  return ok(id, `forward target is the intended line ${expectedForward}`);
}
```

### 3e. Tests (hard rule: `npm test` stays green)

- `test/ring-window.test.mjs` — asserts `CLIENT_FORWARD_PHONE=brand.phone` in built env for voice
  tiers. Update the growth/enterprise fixtures to assert `RECEPTIONIST_MODE=forwarded` and the
  forward target. Add a fixture with `forwardingNumber` set and assert `CLIENT_FORWARD_PHONE` equals
  it. Add a `published` fixture and assert `CLIENT_FORWARD_PHONE` is **absent** and a `<Redirect>` is
  the expected routing (if the test exercises the route) — at minimum assert the env shape.
- `test/checks-env.test.mjs` — add cases for: published client with no `CLIENT_FORWARD_PHONE`
  (pass), published client that wrongly set it (fail), voice client missing `RECEPTIONIST_MODE`
  (fail), web-only with any new key present (fail). Every case must encode a real shipped-bug shape
  per the repo's test doctrine; break the fix and watch it go red before trusting it.
- `test/checks-phone.test.mjs` — rename to `expectedForward`; add a distinct-forwardingNumber case.
- `console/test/phase-contract.test.mjs` — `.env.local` body changes but **no `log()` calls change**,
  so phases should be unaffected. Re-record dry-run output (`npm run fixtures:dry-run`) and confirm
  the phase set is identical. If it drifts, something emitted a new `log()` — revert that, the env
  write must stay silent.
- Add fixtures carrying `forwardingNumber` / `receptionistMode: "published"` under
  `test/fixtures/intake/`.

Run `npm test` (root) and `cd console && npm test`.

---

## 4. `jdd-ops/console` — surface both numbers

### 4a. `src/lib/envFields.ts`

**Make voice fields available to Starter-with-receptionist (gap C).** Today `VOICE =
['growth','enterprise']` (line 59), so a Starter client WITH a receptionist sees none of the routing
fields, contradicting CLAUDE.md. Change voice fields to all plans and gate web-only separately:

```ts
const VOICE: Plan[] = ['starter', 'growth', 'enterprise'];   // was ['growth','enterprise']
```

**Add two curated fields** to `ENV_FIELDS`:

```ts
  {
    key: 'RECEPTIONIST_MODE',
    group: 'routing',
    label: 'Receptionist mode',
    help:
      '“forwarded”: we publish the JDD number and ring the owner first, then the agent. ' +
      '“published”: the client forwards their own line to the JDD number and calls go straight to the agent. ' +
      'Takes effect on the deployed route only after the client is re-provisioned.',
    kind: 'select',
    plans: VOICE,
    options: ['forwarded', 'published'],
  },
  {
    key: 'SMS_ALERT_NUMBER',
    group: 'leads',
    label: 'SMS alert number',
    help:
      'Where post-call summary texts go. Can match or differ from the forward number. ' +
      'Display only: to change it, edit the client’s intake smsAlerts and re-run onboard ' +
      '(the Make automation holds the live copy). See RUNBOOK.',
    kind: 'phone',
    plans: VOICE,
    placeholder: '+12073181838',
  },
```

Update the `CLIENT_FORWARD_PHONE` help to note it is unused in published mode. (`groupForKey` already
sorts `RECEPTIONIST_MODE`/`CLIENT_FORWARD` into `routing` and `SMS_ALERT_NUMBER` into `leads` via the
prefix fallbacks, but the curated entries above make them first-class.)

**Make `SMS_ALERT_NUMBER` read-only (option 1 is locked — see §6).** The authoritative source is
`intake.smsAlerts`, which onboard.js re-reads and would overwrite any console env edit on the next
run, and the live texts come from the Make clone, which an env edit does not touch. So an editable
field would be a lie that silently reverts. Add it to `LOCKED_KEYS` (line ~286) so the panel renders
it as display-only; the curated entry above still supplies its label, help and `leads` grouping:

```ts
export const LOCKED_KEYS = new Set([
  'VERCEL_PROJECT_NAME',
  'CLERK_USER_ID',
  'RETELL_LLM_ID',
  'PORTAL_ACCOUNT_EMAIL',
  'SMS_ALERT_NUMBER', // display only; re-point by editing intake smsAlerts + re-running onboard (PLAN §6)
]);
```

(`RECEPTIONIST_MODE` stays editable: flipping it in the console is a real change that takes effect
once the client is re-provisioned, per §8.)

**Make grouping web-only-aware** so a web-only client is not shown routing fields now that VOICE
includes starter. Change `fieldsForPlan` / `groupedFieldsForPlan`:

```ts
export function fieldsForPlan(plan: Plan, opts: { webOnly?: boolean } = {}): EnvField[] {
  const base = ENV_FIELDS.filter((f) => f.plans.includes(plan));
  if (!opts.webOnly) return base;
  // Web-only (declined receptionist): only lead delivery applies. Routing + integrations are voice.
  return base.filter((f) => (f.group ?? 'advanced') === 'leads');
}

export function groupedFieldsForPlan(
  plan: Plan,
  opts: { webOnly?: boolean } = {},
): Array<{ group: (typeof ENV_GROUPS)[number]; fields: EnvField[] }> {
  const forPlan = fieldsForPlan(plan, opts);
  return ENV_GROUPS.map((group) => ({
    group,
    fields: forPlan.filter((f) => (f.group ?? 'advanced') === group.id),
  })).filter((g) => g.fields.length > 0);
}
```

### 4b. Call sites pass `webOnly`

Two consumers (confirmed by grep):

- `src/app/api/manage/env/route.ts:76` — `fieldsForPlan(plan)`. Derive web-only from the env it is
  already reading (`webOnly = !('RECEPTIONIST_MODE' in env) && !('TWILIO_NUMBER' in env)` for a
  starter plan) or from the account record's `receptionistMode === 'declined'`, and pass
  `fieldsForPlan(plan, { webOnly })`.
- The `/manage` Environment UI component that calls `groupedFieldsForPlan(plan)` — pass
  `{ webOnly }`. `src/lib/clients.ts:103` already computes `webOnly` via `isWebOnly`; thread that
  value into the section props. (Grep `groupedFieldsForPlan` to find the exact component; it is the
  Environment section under `src/components/manage/`.)

### 4c. `src/lib/clientEnv.ts` (type only, optional)

`ClientEnvModule.buildClientEnvLines` arg type can gain the optional
`receptionistMode?/forwardingNumber?/smsAlerts?` for completeness. The console plan-upgrade route
passes none and relies on `prev` preservation (§3a), so **no behavioural change is required** — but
updating the type keeps it honest. The dynamic import means the runtime picks up the new client-env
automatically.

---

## 5. `juneau-digital-designs` (agency site, producer)

The agreement already captures `agreement.forwardingNumber` and `FulfilledSession` already carries
it out for the welcome email. `createPendingSite` deliberately omits it from `PortalSite` — **leave
that as-is** (matches our decision not to touch `PortalSite`). The gap is the **onboarding wizard →
intake** path.

### 5a. `app/components/onboarding/onboardingpageclient.tsx`

1. Add to the `formData` shape (beside `receptionistMode`, line ~133):

```ts
    /** The business line to forward to, when receptionistMode === "forwarded". May equal brand phone. */
    forwardingNumber: string;
```
   Initialise it to `""` in the initial state, and prefill from a new
   `signedForwardingNumber` prop the same way `signedReceptionistMode` prefills `receptionistMode`
   (around line 302: `forwardingNumber: signedForwardingNumber ?? ""`).

2. Add the prop (beside `signedReceptionistMode`, line ~564):

```ts
    signedForwardingNumber?: string;
```
   and thread it from the onboarding page (`app/portal/onboarding/page.tsx`) which reads the
   agreement/site record — pass `agreement.forwardingNumber` through.

3. Add a forward-number input in the activation step, in a new conditional block placed right after
   the `receptionistMode !== "" && !== "declined"` helper block (after line 1746), shown **only for
   forwarded**:

```tsx
                                {formData.receptionistMode === "forwarded" && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
                                            Number to forward calls to
                                        </label>
                                        <p style={{ ...helpText }}>
                                            The line that should ring first when someone calls. Often your
                                            cell or main business line. It can be the same number you gave us
                                            or a different one, and it does not have to be able to receive texts.
                                        </p>
                                        <input
                                            type="tel"
                                            value={formData.forwardingNumber}
                                            onChange={(e) => set("forwardingNumber", e.target.value)}
                                            placeholder={formData.phone || "(207) 318-1838"}
                                            className="w-full rounded-xl border border-[var(--rule)] bg-[var(--surface)] px-4 py-3"
                                        />
                                    </div>
                                )}
```

4. Include it in the submit payload (line ~1012, beside the `receptionistMode` spread):

```ts
                            ...(formData.receptionistMode === "forwarded" && formData.forwardingNumber
                                ? { forwardingNumber: formData.forwardingNumber }
                                : {}),
```

(Optional) add a `ReviewItem` for the forward number in the review step (~line 1776).

### 5b. `app/api/portal/onboarding/route.ts`

Sanitize and pass it into the submission (after the `receptionistMode` narrowing, line ~136):

```ts
        // Only forwarded clients name a line to forward to; drop it otherwise so a stale value from
        // a mode switch never reaches provisioning.
        const forwardingNumber =
            receptionistMode === "forwarded" ? sanitize(body.forwardingNumber, 60) : "";
```

Add to the `submission` object (line ~209, beside the `receptionistMode` spread):

```ts
            ...(forwardingNumber ? { forwardingNumber } : {}),
```

`mapBrandIntakeToIntake` then carries it onto the envelope (§2b), `zBrandIntakeSubmission` accepts it
(§2c), and because the whole intake is serialized by the console exporter
(`console/src/lib/export.ts:735`) it reaches `clients/{slug}/site.ts` → onboard.js with no further
console change. `completeSiteOnboarding` needs **no** change (forwardingNumber is not a PortalSite
field by decision).

### 5c. `app/lib/checkout-fulfillment.ts`

No change. The handoff suggested copying `agreement.forwardingNumber` onto the pending site in
`createPendingSite`; we are **not** adding it to `PortalSite`, so this stays omitted. The value still
reaches onboard.js through the wizard path above, and still reaches the welcome email through
`FulfilledSession` (already wired). Update the stale comment at lines 130-134 if desired to say the
field now flows via the intake envelope rather than being unsupported.

---

## 6. SMS number: display-only (LOCKED — option 1, 2026-10-23)

The runtime SMS send happens **inside the Make.com post-call clone**, whose Twilio module has the
destination number **baked in** at provision time by `cloneAndWirePostCall`. It is *not* read from
`.env.local` at call time, and `intake.smsAlerts` (in `clients/{slug}/site.ts`) is the authoritative
source onboard.js re-reads on every run. Therefore:

**Decision:** `SMS_ALERT_NUMBER` is **surfaced in the console as display-only** (read-only; see §4a's
`LOCKED_KEYS` addition). It makes the number visible and gives it a single stored home in
`.env.local`, but it is never the thing that re-points texts.

**To actually change where texts go:** edit the client's intake `smsAlerts` (or the underlying consent
record) and **re-run onboard** for that client — `cloneAndWirePostCall` reads `intake.smsAlerts` and
re-patches the Make clone's Twilio module. Document this one-liner in `RUNBOOK.md` beside the existing
post-call / `verify-post-call` notes.

**Why not make the env field authoritative + editable:** that was the rejected option 2 (have
`cloneAndWirePostCall` read `SMS_ALERT_NUMBER` and add a console action to re-patch the live clone in
place via `patchPostCallBlueprint`). It is a larger, stateful change and is explicitly **out of
scope** for this plan. Revisit only if re-running onboard to change one number proves too heavy in
practice.

---

## 7. Sequencing

1. `@jdd/schema`: §2, build, tag `v1.27.0`, push.
2. Bump pin in `jdd-ops`, `jdd-ops/console`, `juneau-digital-designs`; reinstall.
3. `jdd-ops` ops + routes + checks + tests: §3. Keep `npm test` and `console` suite green.
4. `console`: §4.
5. `juneau-digital-designs`: §5. Typecheck / build touched files.
6. Smoke test with a dry run per shape:
   ```bash
   cd /c/Users/Xander/Desktop/ops/jdd-ops
   npm run onboard -- --schema clients/_e2e_test_growth/site.ts --dry-run --receptionist forwarded
   npm run onboard -- --schema clients/_e2e_test_growth/site.ts --dry-run --receptionist published
   ```
   Confirm: forwarded writes `CLIENT_FORWARD_PHONE` = forwardingNumber (when set); published omits
   it and the correctness checks pass; both write `RECEPTIONIST_MODE`; SMS fixture writes
   `SMS_ALERT_NUMBER`.

## 8. Roll-out note for existing clients

The `voice.route.ts` published branch and `RECEPTIONIST_MODE` handling ship in **route code**, which
is rewritten only by an onboard run (`writeApiRoutes`) — `npm run sync-env` pushes env, not routes
(same caveat CLAUDE.md records for the ring-window clamp). So flipping `RECEPTIONIST_MODE` in the
console for a client provisioned before this change does nothing until that client is re-provisioned.
New clients and any re-run client get the full behaviour. Default is `forwarded`, so no existing
client's routing changes silently.

## 9. Risks / watch-items

- **zod strip** (§2c) is the single highest-risk omission: forget it and `forwardingNumber` vanishes
  on the queue round-trip with no error. It is the first thing to verify in the smoke test.
- **`checkForwardPreserved` rename** touches `checks-phone.test.mjs`; keep the arg name consistent.
- **Published + `checkSitePublishesTwilioNumber`:** this check still requires the site to publish the
  Twilio number for every non-web-only client. That remains correct — a published-mode client whose
  customers dial the Twilio number directly still reaches `/api/voice`. No change needed, but confirm
  it is the intended behaviour (vs. letting a published client keep advertising their own number).
  If you want published clients to keep their own advertised number, that is a follow-up to
  `applyTwilioNumberToSite` and the check, and should be decided explicitly.
- **Web-only detection in the console env route** (§4b) must not misfire for a starter-with-
  receptionist (which now legitimately has routing fields).
