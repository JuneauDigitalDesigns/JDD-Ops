# PLAN: Tier form-wiring, provisioning side (ops)

**Date:** 2026-10-13
**Repo:** `C:\Users\Xander\Desktop\ops\jdd-ops`
**Companion:** `console/PLAN-tier-form-wiring-console.md` (the catalog / form-component / export side).
**Status:** audit-confirmed. This is a precautionary audit, not a bug chase. The pipeline is mostly correct; this plan closes the one real drift vector and removes two landmines.

Read `HANDOFF-starter-receptionist.md` first for the tier model. This plan assumes that work has landed (`@jdd/schema` is at v1.24.0, `isWebOnly` exists, Starter provisions the full stack with `LEAD_DELIVERY_MODE=email`).

---

## 0. The one thing to understand before you touch anything

A web lead's fate is decided in **two places**:

1. **Build time** — each form component picks its field set from `content._meta.selectedPlan`: `starter` collects an email, everything else collects a phone. This is baked into the exported client repo's `src/data/site.ts`.
2. **Provision time** — `onboard.js` sets the env var `LEAD_DELIVERY_MODE` (`starter → email` Resend to owner; else `callback` Retell `create-phone-call`). The route at `lib/site-routes/contact.route.ts` branches on it.

**These must agree, or leads are lost.** If a form collects an email but the route runs `callback`, `toE164('')` returns null and the route 400s on every submit. If a form collects a phone but the route runs `email`, the owner gets an email with a phone and no callback ever fires.

**Key finding from the audit — do not re-derive this:**

- For a **`CONTENT`-shape** schema (single site), `onboard.js:232` reads the plan *from* `CONTENT._meta.selectedPlan` — the same field the form reads. They **cannot** diverge. `_e2e_test_growth` is this shape.
- For an **`INTAKE`-shape** schema (envelope with top-level `plan` + `sites[]`), `onboard.js` reads `intake.plan` from the envelope (`loadIntake` at `onboard.js:201`, returns `mod.INTAKE` directly at ~line 226), while each form reads `site._meta.selectedPlan`. `withPlan()` writes both together but **nothing asserts they agree on read.** This is the only real divergence vector. The guard in §2 targets exactly this.

Verify line numbers before editing; they drift. Re-grep:

```
grep -n "selectedPlan\|LEAD_DELIVERY_MODE\|loadIntake\|validateIntake" onboard.js
```

---

## 1. Phase 0 (shared gate): `@jdd/schema` — `leadModeFor()`

This is the single source of truth the console form components, the console test, and the onboard guard all import, the way `isWebOnly` is shared today. It is a **hard gate**: do not start §2 or the console plan until this is published and repinned.

### 1.1 Add the helper

In `../jdd-schema/src/intake.ts`, beside the `plan` type (the `"starter" | "growth" | "enterprise"` union already used there):

```ts
/**
 * The lead-capture mode a plan's website forms use, and the ONLY place the mapping lives.
 *
 * `email`  — starter (and web-only starter): the form collects an email and /api/contact
 *            Resends the owner a lead email (LEAD_DELIVERY_MODE=email).
 * `phone`  — growth / enterprise: the form collects a phone and /api/contact calls Retell
 *            create-phone-call so the agent dials the lead back (LEAD_DELIVERY_MODE=callback).
 *
 * Imported by the catalog form components, console/test/lead-mode-invariants.test.mjs, and
 * onboard.js's plan-consistency guard, so the mapping is impossible to drift between them.
 * This is the client-FORM mode; the server route keys off LEAD_DELIVERY_MODE, which onboard.js
 * derives from the same plan — see onboard.js:1358.
 */
export function leadModeFor(plan: "starter" | "growth" | "enterprise"): "email" | "phone" {
  return plan === "starter" ? "email" : "phone";
}
```

Use whatever the existing exported plan type alias is named in `intake.ts` rather than re-typing the union inline, if one exists (grep `export type` in `intake.ts`). Do not create a second plan type.

### 1.2 Export, build, publish

- Re-export from `../jdd-schema/src/index.ts` (add `leadModeFor` to the intake exports block).
- `cd ../jdd-schema && npm run build && npm test` — green.
- Bump `../jdd-schema/package.json` to **v1.25.0**.
- Commit **both `src/` and `dist/`** (dist is committed; a src-only change ships nothing — see memory `reference-jdd-schema-zod-strips`). Tag, push. Pushing needs the JDD GitHub account (`/github-account-switch`).

### 1.3 Repin consumers

Bump `@jdd/schema` to `1.25.0` and `npm install` in:

- `jdd-ops/package.json`
- `jdd-ops/console/package.json`

Verify the helper is present in each `node_modules/@jdd/schema/dist/`, never `src/`. The agency repo (`juneau-digital-designs`) does not consume `leadModeFor` and does not need a repin. Exported client repos pick up v1.25.0 at their next provision/install (they already depend on `@jdd/schema`).

**Steps 1.1–1.3 are a hard gate. The console plan's component edits import `leadModeFor`; they will not build until this is installed.**

---

## 2. onboard.js — the plan-consistency guard

**Goal:** before any paid resource is touched, refuse an `INTAKE`-shape run whose envelope `plan` disagrees with any site's `_meta.selectedPlan`, because the form and the route would then be wired for different plans.

### 2.1 Where

In `validateIntake` (around `onboard.js:338`, where `validPlans` and the enterprise site-count checks already live — this is the right place because it runs at step 1, before the GitHub repo and before Twilio/Retell). Add after the existing plan/receptionist checks:

```js
// Form field-set vs lead-delivery coupling (PLAN-tier-form-wiring §0).
// Each site's form reads _meta.selectedPlan to choose email- vs phone-capture; onboard sets
// LEAD_DELIVERY_MODE from intake.plan. For a CONTENT schema these are the same field and cannot
// disagree. For an INTAKE envelope they are separate, so assert them equal here: a mismatch means
// the already-built site collects the wrong field for the route we are about to provision, and
// every lead is lost silently. Refuse rather than guess which one is right.
for (const [i, site] of intake.sites.entries()) {
  const sitePlan = site?._meta?.selectedPlan;
  if (sitePlan && sitePlan !== intake.plan) {
    errors.push(
      `site[${i}] was built for plan "${sitePlan}" but this run provisions "${intake.plan}" ` +
      `(lead form would be ${leadModeFor(sitePlan)}-capture while /api/contact runs ` +
      `${intake.plan === 'starter' ? 'email' : 'callback'}). Re-export the site for "${intake.plan}" ` +
      `in the console Build studio, or correct the plan, before provisioning.`,
    );
  }
}
```

Import `leadModeFor` alongside the existing `isWebOnly` import from `@jdd/schema` at the top of `onboard.js`.

A site with **no** `_meta.selectedPlan` is left to the existing missing-field handling (`CONTENT` path already hard-fails at `onboard.js:234`; an `INTAKE` site without it is a schema the Build studio never produced). Do not infer or backfill it here.

### 2.2 Operator-facing behavior on mismatch (owner decision)

The guard must **stop and offer a choice**, not silently abort or auto-fix:

- **Default / non-TTY:** hard-fail with the message above and a non-zero exit. The message names both plans and tells the operator to re-export in the console.
- **Re-export escape hatch:** add a CLI flag `--reexport-on-plan-mismatch`. When present, instead of failing, onboard re-stamps `_meta.selectedPlan = intake.plan` on each mismatched site and rewrites the client schema in place (reuse the schema-rewrite path `planChange.ts` uses — `rewriteClientSchema` in `console/src/lib/export.ts` is server-only; in onboard, do the equivalent minimal in-place rewrite of `clients/{slug}/site.ts`, or shell out to the console export). Log each rewrite loudly, then continue.

Keep it simple: the flag is the "re-export and continue" option; its absence is "cancel / go no further." Do **not** make re-export the default — matching the receptionist precedent, a money-spending correction is stated, never assumed.

> Implementation note for Sonnet: onboard.js is a plain Node script, not the Next server, so it cannot import the `server-only` `rewriteClientSchema` directly. The lowest-risk re-export is to update the single `_meta.selectedPlan` string in `clients/{slug}/site.ts` with a targeted regex replace (the field is a JSON-ish `"selectedPlan": "<plan>"` line, see `_e2e_test_growth/site.ts:623`) and re-run `loadIntake`. Do not round-trip the whole file through a serializer. If a clean in-place rewrite is not achievable in 2 attempts, fall back to: print the exact console command to re-export and exit non-zero (the default behavior), and note the flag as not-yet-implemented rather than shipping a fragile rewrite.

### 2.3 Dry-run must surface the guard

`validateIntake` already runs before provisioning, so `--dry-run` exercises the guard for free. Confirm a mismatched synthetic `INTAKE` fails the dry-run (see §5).

---

## 3. Replace the stale template `/api/contact` stub

**File:** `template/src/app/api/contact/route.ts`
**Problem:** it still branches on `LEAD_DELIVERY_MODE === 'webhook'` and posts to `MAKE_WEBHOOK_URL`, an architecture nothing sets any more. It is guarded from clobbering live routes by `ONBOARD_OWNED` (`console/src/lib/export.ts:133`), but it means the template builds against a lie and a stray copy reintroduces the dead path.

**Fix:** replace the stub body with the current logic, mirroring `lib/site-routes/contact.route.ts` (the authoritative source onboard writes). Concretely:

- Copy `lib/site-routes/contact.route.ts` verbatim into `template/src/app/api/contact/route.ts`. It reads only `process.env` and has no secrets inlined, so it is safe to ship as the template stub, and now the template builds truthfully against the same two-branch (`email` / `callback`) logic the provisioned route uses.
- There is no `webhook` branch and no `MAKE_WEBHOOK_URL` reference afterward. Grep the repo to confirm nothing else references `MAKE_WEBHOOK_URL`:

```
grep -rn "MAKE_WEBHOOK_URL\|=== 'webhook'" template/ lib/ --include=*.ts
```

- Rebuild the template standalone (`cd template && npm run build`) to confirm it compiles with the real route.

Update the comment at `export.ts:124-132` (the `ONBOARD_OWNED` block) to drop the "retired webhook architecture" warning, since the stub no longer carries it; keep the ownership note that onboard still owns the live route.

---

## 4. Starter test client with a receptionist

**Goal:** a provisionable Starter-with-receptionist client that proves the email lead path end-to-end, alongside `_e2e_test_growth` which proves the callback path.

- **Create `clients/_e2e_test_starter/`** by cloning `clients/_e2e_test_growth/site.ts`. It is `CONTENT` shape (`export const CONTENT: SiteContent`, `_meta.selectedPlan` at line ~623).
- Flip `_meta.selectedPlan` from `"growth"` to `"starter"`.
- Set `brand.email` to a real inbox you can check (this becomes `LEAD_TO_EMAIL`).
- Give it a distinct `brand.name` / slug-appropriate copy so it is obviously the starter fixture.
- Do **not** add `receptionistMode` to the `CONTENT` file. Per `loadIntake`, a CONTENT schema deliberately leaves it unset; supply it at provision time with `--receptionist forwarded` (starter-with-receptionist, human-first routing). This exercises the `--receptionist` path too.
- Honor `CONSOLE_INCLUDE_FIXTURES` and **do not purge `_e2e_test_growth`** (memory `project-external-managed-clients`).

Provision (dry-run first, always):

```
node onboard.js --slug _e2e_test_starter --receptionist forwarded --dry-run
node onboard.js --slug _e2e_test_starter --receptionist forwarded
```

The dry-run must show, for this Starter: a Twilio search+purchase, a Retell agent + per-client LLM, an Airtable base, a post-call clone, a portal upsert with a **non-null** `retellAgentId`, and `LEAD_DELIVERY_MODE=email`. It must **not** show any outbound-callback wiring.

---

## 5. Verification (provisioning side)

- [ ] `cd ../jdd-schema && npm test` green after §1; `leadModeFor('starter') === 'email'`, `leadModeFor('growth') === 'phone'`, `leadModeFor('enterprise') === 'phone'`.
- [ ] A synthetic `INTAKE` object with `plan: 'growth'` but a site `_meta.selectedPlan: 'starter'` **fails** `validateIntake` / `--dry-run` with the §2.1 message. (Add this as a small assertion or a throwaway fixture; it does not need a live client.)
- [ ] The matching case (`plan` equals site `selectedPlan`) passes unchanged.
- [ ] `_e2e_test_starter` dry-run shows the full voice stack, `LEAD_DELIVERY_MODE=email`, and no callback wiring.
- [ ] After a real provision of `_e2e_test_starter`: submit the deployed site's web form and confirm a Resend lead email arrives at `brand.email`, and **no** outbound callback fires.
- [ ] `_e2e_test_growth` still behaves as callback (regression guard): submit its form, confirm Retell `create-phone-call` is attempted.
- [ ] `template/` builds standalone with the replaced `/api/contact` stub; no `MAKE_WEBHOOK_URL` references remain anywhere.
- [ ] `_e2e_test_starter`'s portal record keeps a non-null `retellAgentId` after a console repair (the G5 + S1 double-null regression from the receptionist handoff).

When provisioning the number, import `vercelAppHost` for the voiceUrl host — never re-derive the underscore transform inline (`_e2e_test_growth` serves at `e2etestgrowth.vercel.app`). See `CLAUDE.md`.

---

## 6. Out of scope

- **Enterprise** multi-site verification. Enterprise behaves like Growth per site (`phone`/`callback`); deferred by owner decision. The §2 guard still covers it correctly if an enterprise envelope ever desyncs, because it loops all sites.
- **Live clients** Atlantic and Air Service. They are `receptionistMode: 'declined'` web-only shims, out of scope for this audit (owner decision: new + test clients only).
- Pricing, agreements, Stripe. See the pricing docs.
- The console-side work (form components adopting `leadModeFor`, the ≥1-form / Contact-page export checks, the `FinalCtaSimple` `#contact` fix, the planChange rebuild flag, the catalog test). All in the companion `console/PLAN-tier-form-wiring-console.md`.

If anything blocks you, stop and report it rather than inventing a plan mapping, a provisioning default, or a route behavior.
