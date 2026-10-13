# PLAN: Tier form-wiring, build/catalog side (console)

**Date:** 2026-10-13
**Repo:** `C:\Users\Xander\Desktop\ops\jdd-ops\console`
**Companion:** `../PLAN-tier-form-wiring-ops.md` (schema helper, onboard guard, template stub, test client, provisioning verification).
**Status:** audit-confirmed, precautionary. The form components are already correct per-plan; this plan centralizes the mapping, closes two multipage gaps, and adds the invariants so it can't silently regress.

**Hard dependency:** `../PLAN-tier-form-wiring-ops.md` §1 must be done first (`@jdd/schema` v1.25.0 with `leadModeFor`, repinned in `console/package.json`). The component edits below import `leadModeFor` and will not build until it is installed.

---

## 0. The coupling, from the build side

Each form component chooses its field set from `content._meta.selectedPlan`: `starter → email`, else `phone`. That mode is handed to the shared `<LeadForm>` (`@jdd/ui/LeadForm`, re-exported via `src/lib/LeadForm.tsx`). The exported client repo's `src/data/site.ts` carries `_meta.selectedPlan` (written by `writeSiteContent`, `export.ts:704`; `copyBrief` is stripped, `selectedPlan` is kept). The server route's behavior is set separately at provision time (`LEAD_DELIVERY_MODE`). See the ops plan §0 for why they must agree and where the real divergence risk is.

Today the mapping is duplicated as an **inline ternary in six components**. Centralizing it into `leadModeFor` is the point of this plan: one rule, enforced by one test.

Verify line numbers before editing (they drift):

```
grep -rn "selectedPlan === 'starter' ? 'email' : 'phone'" src/components/catalog
```

---

## 1. Form components adopt `leadModeFor`

Replace the inline ternary in all six form-bearing components with the shared helper. Each currently has a line like:

```ts
const mode = content._meta?.selectedPlan === 'starter' ? 'email' : 'phone';
```

Replace with:

```ts
import { leadModeFor } from '@jdd/schema';
// …
const mode = leadModeFor(content._meta?.selectedPlan ?? 'growth');
```

Keep the `?? 'growth'` fallback: `_meta.selectedPlan` is typed optional on `SiteContent`, and defaulting an *absent* value to `phone` preserves today's behavior exactly (the inline ternary already did this — a missing value fell to the `: 'phone'` branch). The onboard guard and export check (below) are what ensure the value is actually present for real clients; this fallback only keeps the catalog browser rendering when previewing a seed without a stamped plan.

The six files and their current mode lines:

| File | Line (verify) |
|---|---|
| `src/components/catalog/hero/HeroFormFocus.tsx` | 67 |
| `src/components/catalog/contact/ContactCardOverlap.tsx` | 39 |
| `src/components/catalog/contact/ContactInlineStrip.tsx` | 48 |
| `src/components/catalog/contact/ContactSplit.tsx` | 38 |
| `src/components/catalog/finalCta/FinalCtaBanner.tsx` | 46 |
| `src/components/catalog/finalCta/FinalCtaSplit.tsx` | 43 |

These are exactly the components that import `@/lib/LeadForm` and render `<LeadForm mode={mode} …>`. `FinalCtaSimple` is **not** in this list — it renders no form (see §3).

After editing, confirm each exported client repo still resolves `@jdd/schema` (it is already a dependency; the import adds no new package). Run `npm run build` in `console` and fix all type errors.

---

## 2. Export-time invariants: a site must be able to capture a lead

**Owner decision:** export/test must fail if a site ships with no lead form at all, and the Contact page must have one. A silent revenue hole is worse than a loud build failure.

### 2.1 What counts as a lead form

The six LeadForm-bearing components by catalog id (meta `id` field):

```
hero-form-focus, contact-card-overlap, contact-inline-strip, contact-split,
final-cta-banner, final-cta-split
```

`FinalCtaSimple` (`final-cta-simple`) and any pure phone/CTA component do **not** count — they collect nothing.

Define this set once in a small exported const (e.g. `src/lib/leadForms.ts`: `export const LEAD_FORM_IDS = new Set([...])`) so the export check and the test (§5) share it. Derive it from meta if practical (scan catalog metas for a `LeadForm` usage marker); a hand-maintained set is acceptable if you add it to the §5 test's coverage so a new form component that forgets to join the set is caught.

### 2.2 The check

Add a composition-level validation that runs before page generation in the export flow. `validateEntries` (`export.ts:109`) validates flat entries against the allowlist; the new check operates on the `SiteComposition` (`src/lib/pages.ts`, `comp.pages` each with `sections: SectionRef[]`). Add a `validateComposition(comp: SiteComposition)` in `export.ts` (or `pages.ts`) and call it from the export route alongside `validateEntries`:

```ts
// A site that captures no leads is a silent revenue hole. Require at least one lead form
// somewhere, and require the Contact page (if one exists) to be the place it lives.
export function validateComposition(comp: SiteComposition): void {
  const allRefs = comp.pages.flatMap((p) => p.sections);
  const hasAnyForm = allRefs.some((r) => LEAD_FORM_IDS.has(metaIdFor(r))); // map SectionRef -> meta id
  if (!hasAnyForm) {
    throw new Error('Composition has no lead-capture form. Add a contact or final-CTA form before exporting.');
  }
  const contact = comp.pages.find((p) => p.route === 'contact');
  if (contact && !contact.sections.some((r) => LEAD_FORM_IDS.has(metaIdFor(r)))) {
    throw new Error('The Contact page has no lead form. Add a contact-* component to it before exporting.');
  }
}
```

`SectionRef` is `{ categoryId, name, skin?, rhythm? }` (`pages.ts:28`); `metaIdFor` resolves a ref to its component meta `id` (there is already a name→meta lookup used by the catalog; reuse it rather than writing a second mapping). If no such helper exists, key `LEAD_FORM_IDS` on `name` instead of meta `id` and name the set accordingly — but keep it one source shared with the test.

The Contact-page clause is conditional on a Contact page existing because `MIN_PAGES` is 1 and a one-page site is still valid; the owner's intended default is Home + Contact (both from the discussion), so for the normal 4-page build this clause is live.

---

## 3. `FinalCtaSimple`: fix the subpage `#contact` anchor

**File:** `src/components/catalog/finalCta/FinalCtaSimple.tsx` (CTA button `href="#contact"`, ~line 46).
**Problem:** `#contact` is a same-page anchor. It resolves on the home page (which has a `#contact` section) but goes nowhere from a subpage (About, Services) on a 4-page site, which is the new default. The CTA then dead-ends exactly where you want the lead to convert.

**Fix:** when the site has a dedicated Contact page, the CTA should link to `/contact`, not `#contact`. The component renders from `CONTENT` and does not know the composition at render time, so the cleanest fix is to make the href plan/route-aware from content:

- Prefer an existing route hint if one is present in `SiteContent.nav` (the exported nav carries `{label, href}` per page — see `navLinksFor`, `pages.ts:110`). If `nav` contains an href of `/contact`, use it; otherwise fall back to `#contact` (single-page site).
- Concretely: `const contactHref = content.nav?.some((n) => n.href === '/contact') ? '/contact' : '#contact';` and use `contactHref` on the CTA.

This keeps single-page sites working (anchor) and fixes multipage sites (route). Verify `SiteContent.nav` is populated at export for multipage sites (it is: `navLinksFor` feeds it). If `nav` is not on `SiteContent` in the type, use the subpages map or add the minimal field read — do not hardcode `/contact` unconditionally, since a one-page site has no such route.

---

## 4. `planChange`: flag a site as needing re-export after a tier change

**Owner decision:** a plan change flags the site for re-export/re-sync; the onboard guard (ops §2) then catches a stale build at provision. Do **not** auto-regenerate pages here.

**File:** `src/lib/planChange.ts`. Today it rewrites `clients/{slug}/site.ts` (envelope `plan` + each site's `_meta.selectedPlan` via `withPlan`, `writePlanToSchema`), the caller rewrites `.env.local` (`LEAD_DELIVERY_MODE` + mode keys), and `mirrorPlanToPortal` updates KV. It does **not** regenerate the already-exported `src/app/**/page.tsx` files.

Why that is mostly fine and where it isn't:
- The six adapting form components read `_meta.selectedPlan` at render, so a rewritten `site.ts` flips their mode on the next deploy without regenerating pages.
- **But** `FinalCtaSimple` hard-codes `leadMode: 'phone'` in its meta and is filtered to growth/enterprise by `buildCategories` (`categories.tsx:86`). A site downgraded growth→starter that had `FinalCtaSimple` placed keeps a phone-oriented CTA the starter catalog would never have offered. And a non-adapting component is exactly the kind of thing the export invariants (§2) and a fresh re-export exist to reconcile.

**Fix:** after `writePlanToSchema` succeeds, write a small marker that the site needs re-export, and surface it:

- Add a `needsReexport: true` (with `reason: 'plan-change'`, `from`, `to`, timestamp) entry to the per-repo page-tracking file the export already maintains (`.studio-pages.json` at the repo root — see `export.ts` around line 657, the stale-page cleanup tracker), or a sibling `.studio-reexport.json` if cleaner. One file, read by the console roster.
- Surface it on the `/manage/{slug}` Overview (health tiles) as a drift warning: "Plan changed to X; site not re-exported." Reuse the existing env-drift tile pattern.
- Append the plan change to `console/.state/audit.ndjson` (key names only) like every other console write.

The guard in ops §2 is the backstop: if the operator provisions/redeploys without re-exporting and the envelope/site plans disagree (INTAKE shape), onboard refuses. For a CONTENT-shape single-site client the two are the same field and cannot disagree, so the marker is the only signal — which is why it must be visible in the console.

Keep the change minimal: this is a flag + a tile, not a re-export pipeline.

---

## 5. Test: lock the mapping and the invariants

Add `console/test/lead-mode-invariants.test.mjs` (sibling of `catalog-invariants.test.mjs`), wired into the same test runner. Assert:

1. **One source.** No catalog component contains the inline ternary `selectedPlan === 'starter' ? 'email' : 'phone'` any more; the six form components import `leadModeFor` from `@jdd/schema`. (Grep the component sources; fail on any stray inline copy. This is what makes §1 stick.)
2. **The mapping.** `leadModeFor('starter') === 'email'`, `leadModeFor('growth') === 'phone'`, `leadModeFor('enterprise') === 'phone'`.
3. **Form-set integrity.** Every component that imports/renders `<LeadForm>` is in `LEAD_FORM_IDS`, and nothing else is. A new form component that forgets to join the set fails here (covers the §2.1 hand-maintained-set risk).
4. **Composition invariants.** Extend `console/test/multipage-pages.test.mjs` (or add here): a representative 4-page composition passes `validateComposition`; a composition with zero form components throws; a composition whose Contact page has no form throws.

Run the full suite:

```
cd console && npm test
```

All green, including the existing `catalog-invariants`, `multipage-pages`, `page-rhythm`, and `section-styles` tests (don't regress them).

---

## 6. Verification (build side)

- [ ] `console` builds (`npm run build`) after the `leadModeFor` adoption; no type errors.
- [ ] `npm test` green, including the new `lead-mode-invariants` test and the extended composition checks.
- [ ] Building `_e2e_test_starter` (created in ops §4) in the Build studio shows email-capture forms (email field, no phone) on the home final-CTA and the Contact page.
- [ ] Building `_e2e_test_growth` still shows phone-capture forms.
- [ ] On a 4-page export, a `FinalCtaSimple` CTA on a subpage links to `/contact` (not a dead `#contact`); on a one-page export it still uses `#contact`.
- [ ] Exporting a composition with no form throws the §2 error; adding one form clears it.
- [ ] A plan change on a built client raises the "needs re-export" tile on `/manage/{slug}` Overview.
- [ ] **Owner review gate:** build `_e2e_test_starter` locally and view in a real browser (per memory `project-jdd-template-fidelity-v2`, real-browser review required; no deploy needed for this step). Confirm the starter email form renders and submits to `/api/contact` without error against the provisioned route.

---

## 7. Out of scope

- The schema helper, onboard guard, template stub, test-client provisioning, and all provisioning-side verification. See `../PLAN-tier-form-wiring-ops.md`.
- Enterprise multi-site catalog verification (owner decision: Starter + Growth only).
- Any change to `<LeadForm>` field set or copy. The current fields (name + email + optional message for `email`; name + phone for `phone`) match the owner's "email only" starter decision; do not add a phone field to the starter form.
- Live clients Atlantic / Air Service (web-only shims, excluded).

If the schema import, the `metaIdFor`/`LEAD_FORM_IDS` mapping, or the `nav`-aware href can't be wired cleanly in two attempts, stop and report the exact blocker rather than hardcoding a plan or a route.
