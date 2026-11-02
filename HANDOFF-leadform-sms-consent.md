# HANDOFF — Capture SMS consent on client sites (LeadForm)

**Date:** 2026-10-29
**Status:** context only — no work started
**Goal:** the web form on every client site must capture and evidence the customer's consent to be
texted, before the business owner can reply to them from the portal.

---

## 1. Scope — and the hard non-conflict rule

`jdd-ops/PLAN-portal-form-capture.md` is being implemented in parallel. It owns the **server side**
of lead capture. This handoff owns the **client-side capture surface only**.

### You own

| File | Change |
|---|---|
| `~/Desktop/ops/jdd-ui/src/LeadForm.tsx` | Disclosure UI + consent payload |
| `~/Desktop/ops/jdd-ui/src/lead-consent-text.ts` *(new)* | The canonical wording + version + hash |
| `~/Desktop/ops/jdd-ui/src/index.ts` | Export the new module |
| `jdd-ops/template/package.json` | `@jdd/ui` pin bump |
| `jdd-ops/console/package.json` | `@jdd/ui` pin bump |

### ⛔ Do NOT touch these — the other plan owns them

- `jdd-ops/lib/site-routes/contact.route.ts` — being rewritten for always-ingest. **You do not need
  it** (see §2).
- The agency site's `POST /api/ingest/lead`, `app/lib/portal-leads.ts`, `GET /api/portal/leads`
- The `WebLead` interface in `jdd-schema` — a published contract; the plan's §3 already reserves the
  `consent` field for your payload
- `jdd-ops/packages/ui/` — a **stale clone**, see §3
- Anything in `clients/*/repo/` — generated output, never hand-edited

If you believe you need a file in the forbidden list, stop and raise it rather than editing it.

---

## 2. The seam — why there is zero file overlap

⚠️ **Corrected after reading the code (2026-10-29).** An earlier draft of this handoff said
`/api/contact` "already forwards the whole posted body." **It does not.**
`jdd-ops/lib/site-routes/contact.route.ts` makes exactly two outbound calls — Retell
`create-phone-call` (`:93`) and Resend (`:114`) — and has no onward POST at all. The forward to the
ingest endpoint is new code that the **other** plan adds.

**Your work is still independent, in both directions.** The route ignores fields it does not know
about: the callback branch reads only `data.phone`, and the email branch folds any extra fields into
the owner email. So adding `consent` to the POST body today is harmless — it will be carried in the
Starter lead email and ignored on Growth. When the other plan lands its forward, which posts the
**whole body**, the field starts arriving at the ingest endpoint with no further change from you.

So the eventual shape is:

```
LeadForm  ──POST {name, phone, message, consent:{…}}──▶  /api/contact
                                                              │ forwards body
                                                              ▼
                                               /api/ingest/lead  ──▶  WebLead.consent
            ^^^^^^^ you own this                                ^^^^^^^ the plan owns this
```

**Your deliverable is that the form posts a well-formed `consent` object.** Nothing you ship depends
on the ingest existing, and nothing the other agent ships depends on the form being updated first.
Either order works.

One consequence worth knowing: **leads submitted before the pin reaches a given client site will
arrive with no `consent` object at all.** The plan's gate treats that as `basis: null` → messaging
blocked, deliberately failing closed. So a client whose site is still on an older `@jdd/ui` pin will
see captured leads they cannot reply to, with the reason shown. That is correct behaviour, not a bug
— but it is the reason §4's pin-bump question matters.

### The payload contract — agreed; do not change unilaterally

```ts
consent: {
  basis: "web-form";
  textHash: string;     // SHA-256 of the exact disclosure string rendered
  textVersion: string;  // e.g. "lead-sms-consent-v1"
  capturedAt: string;   // ISO 8601, client clock — server re-stamps authoritatively
}
```

The server adds `ip` and `userAgent` (it already has `consentRequestContext(req)` for this) and
re-stamps the timestamp — a client-supplied time is not evidence. Send it anyway for diagnostics.

**This shape is fixed by agreement with the plan's §3.** If you need to change it, flag it to that
work before merging, not after.

---

## 3. ⚠️ Where `LeadForm` actually lives — five copies, one implementation

This is the single biggest trap in this task. Verified 2026-10-29:

| Path | What it is | Edit? |
|---|---|---|
| `~/Desktop/ops/jdd-ui/src/LeadForm.tsx` | **The implementation, 214 lines. HEAD = v1.2.0.** Remote: `JuneauDigitalDesigns/jdd-ui` | ✅ **YES — this one** |
| `jdd-ops/packages/ui/src/LeadForm.tsx` | A **second clone of the same repo**, HEAD stuck at **v1.1.0**, no v1.2.0 tag, content divergent | ❌ **NO — stale** |
| `jdd-ops/template/src/lib/LeadForm.tsx` | 5-line re-export shim: `export * from '@jdd/ui/LeadForm'` | ❌ no |
| `jdd-ops/console/src/lib/LeadForm.tsx` | Identical shim | ❌ no |
| `clients/*/repo/src/lib/LeadForm.tsx` | The shim, copied by `copyTemplate` | ❌ no |

**Both clones report `version: 1.2.0` in `package.json`, but only `~/Desktop/ops/jdd-ui` actually has
the v1.2.0 commit** (`16eabee feat(ui): v1.2.0 add LeadForm.initialMessage`). `packages/ui` is one
release behind at `3d4db36` (v1.1.0). Editing there means writing against old code and then either
colliding on the tag or silently losing the `initialMessage` prop. Confirm with
`git -C <dir> log --oneline -1` before your first edit.

Worth asking the operator whether `jdd-ops/packages/ui` should simply be deleted — a stale duplicate
clone of a published package, nested inside a consumer of that package, has no good outcome.

---

## 4. Release and distribution — the part that is easy to get wrong

Editing the implementation does **not** reach client sites. The chain:

1. Edit + build in `~/Desktop/ops/jdd-ui`
2. Commit and **tag** — next is `v1.3.0` (new prop/behaviour, so minor not patch)
3. Push the tag; both consumers pin by tag, not branch
4. Bump `"@jdd/ui"` in **`template/package.json`** *and* **`console/package.json`** to `#v1.3.0` —
   both, or the console preview and the exported site disagree
5. `npm install` in `console/` so the preview renders the new form

### Existing client repos will NOT pick this up automatically

Two separate reasons, both verified:

- **`copyTemplate(repoRoot, slug, { overwrite })`** returns early when the repo already exists and
  `overwrite` is false. A normal re-run therefore does not refresh `src/lib/`. Note the contrast with
  `writeOnboardRoutes`, which copies `lib/site-routes/*` **unconditionally on every run** — routes
  refresh, template files do not.
- **`package.json` is not template-owned.** The export route says so explicitly: *"package.json is
  not template-owned, so the export will not change the pin for you."* So even an overwrite export
  leaves the old `@jdd/ui` pin in place.

So each existing client needs its `@jdd/ui` pin bumped and a redeploy. The two e2e fixtures are
**already stale** — `_e2e_test_growth` on `#v1.0.7`, `_e2e_test_starter` on `#v1.1.0`, against
template/console at `#v1.2.0`. Expect to fix those as part of this, and expect the export route's
pin-comparison check to flag them.

_(decide with the operator)_ whether to batch-bump existing clients now or let the next onboard.js
re-run carry it. **A client site collecting phone numbers with no disclosure is the thing this task
exists to fix**, so leaving live sites on the old form defeats the purpose — but it is a
redeploy-everything decision, not yours to take alone.

---

## 5. What to build

### 5.1 `lead-consent-text.ts` — mirror the proven pattern

`juneau-digital-designs/app/lib/sms-consent-text.ts` already solves this exact problem for the
owner-alert program. Copy its structure and read its header comment first. Non-negotiables it
encodes:

- **One canonical string.** What renders, what gets hashed, and what is submitted to the carrier as
  opt-in language must never disagree.
- **Client-safe.** No `server-only`, no `node:crypto` at module scope — the form renders it.
- **Versioned.** `LEAD_SMS_CONSENT_VERSION`, bumped in the **same commit** as any wording change. Old
  events keep their own hash and version so they stay provable against the words actually shown, not
  whatever the string says later.

Suggested wording — **have the operator approve before shipping**, this is carrier-reviewable:

> By giving us your number you agree we may text you about your enquiry. Message and data rates may
> apply. Message frequency varies. Reply STOP to opt out, HELP for help.

### 5.2 The form change

- Render the disclosure **beside the phone field**, always visible — not behind a tooltip, not in a
  collapsed section, not only in a linked policy
- Compute the hash of the rendered string and include it in the payload
- Add the `consent` object to the existing `fetch('/api/contact')` body

_(decide with the operator)_ **notice vs checkbox.** For a transactional reply to a consumer-initiated
enquiry, clear notice is generally sufficient and converts better. An unchecked checkbox is stronger
evidence but adds friction to the one element on the page that makes money. The existing owner-alert
program uses an unchecked checkbox — but that is a *marketing-adjacent recurring* program, which is a
different risk profile from replying to someone who just asked to be contacted. Recommend **notice**,
with the hash as the evidence, and make it a prop so it can change without a redeploy of logic.

### 5.3 Do NOT build a consent-gathering text

You may be tempted to add a "send a consent request first" flow. **It does not work and must not be
built.** That first message is itself a text to someone who has not consented — the one message the
premise forbids, and the least defensible in the thread: unsolicited, no transactional purpose. The
consent comes from the form; the reply is responsive to an enquiry the customer opened. Full reasoning
in the plan's §11.

---

## 6. Constraints on `LeadForm` you must not regress

This component has a documented history; read its header comment before editing. It replaced thirteen
hand-rolled copies, and the bugs it fixed are easy to reintroduce:

- **`16px` input font size is not a style choice.** iOS Safari zooms the viewport on focus for
  anything smaller and yanks the page mid-form.
- **Every input needs a real `<label>`.** A placeholder is not an accessible name — it is announced
  inconsistently and vanishes on input. The disclosure needs `aria-describedby` wiring to the phone
  field, not a bare `<p>`.
- **`status === 'error'` must stay rendered.** The original bug was setting it and never showing it:
  a failed POST showed the user nothing and the lead was lost silently.
- **`useId()` per instance.** Two forms can render on one page (contact strip + final CTA); hardcoded
  ids point every label at the first form.
- **Do not break `initialMessage`** — added in v1.2.0, so it is new and likely in use.
- **Keep `email` optional.** Phone is the required contact, but dropping email removes the owner's
  only non-SMS reply channel.
- Validation stays **deliberately permissive** (`looksLikePhone` = any 7+ digits). Rejecting
  valid-but-unusual input costs leads, which is worse than forwarding one bad number.

---

## 7. Verification before handing back

- `verifyCatalogImports` still passes — it checks the shim path exists, which is why the shims are
  kept at `@/lib/…` rather than importing `@jdd/ui` directly from catalog components
- Build the console (`cd console && npm run build`) and at least one client repo. **Hard rule from
  `CLAUDE.md`: after every code change in a client repo, run `npm run build` and fix all errors.**
- Render both form variants (`mode="phone"` and `mode="email"`, with and without `withMessage`) and
  confirm the disclosure appears in each, at both `surface="light"` and `"dark"`
- Submit a real form against a preview deploy and confirm the `consent` object arrives in the POST
  body with a hash that matches `LEAD_SMS_CONSENT_VERSION`
- Confirm the hash is stable — the same rendered string must produce the same hash across runs, or it
  is worthless as evidence

---

## 8. Read first

| Document | Why |
|---|---|
| `jdd-ops/PLAN-portal-form-capture.md` **§11** | The consent model: where consent comes from, the circularity argument, the server-side gate, the consent window |
| `jdd-ops/PLAN-portal-form-capture.md` **§3, §4, §7** | The `WebLead` contract, the ingest path, and the form-field decisions — so you know what the other agent is building |
| `juneau-digital-designs/app/lib/sms-consent-text.ts` | The hashed/versioned pattern to copy |
| `~/Desktop/ops/jdd-ui/src/LeadForm.tsx` | The component's own header comment — read it before editing |
| `jdd-ops/console/src/app/api/build/export/route.ts` ~line 348 | How the `@jdd/ui` pin comparison and the shim-vs-real-file distinction work |

---

## 9. Out of scope

- The portal-side messaging gate (`canMessageContact`) — plan §11, server side
- Consent for customers whose only origin is a **phone call** rather than a form — a real open
  question, flagged in plan §11 as `_(decide)_`, and not solvable from the form
- Review-request consent — a separate, weaker case already recorded in
  `juneau-digital-designs/PLAN-portal-crm-review-sms.md` decision 5
- `/sms-terms` and the privacy policy — public disclosure copy, covered by
  `juneau-digital-designs/HANDOFF-tier-capability-copy.md` §3, and it needs operator approval
