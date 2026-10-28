# EXEC — Vertical Standard Templates v1 (code-change runbook)

**This is the execution document.** It turns `PLAN-vertical-templates-v1.md` into ordered,
verifiable code tasks. The PLAN is the *why*; this is the *what and where*. Where they ever
disagree, the PLAN's decisions (D1–D16) win and this file has a bug — stop and reconcile.

**Prime directive — do not drift.** Every design value comes from a committed source, never from
your own judgement:

- **Design / colour / layout** → `design/vertical-templates-v1/home-mockups.html` (the approved
  tab for that vertical) and `design/northstar-standard/mockups.html` (HVAC reference).
- **Code pattern** → the existing 12 `Hvac*` components and `hvacTemplate()`. New code mirrors
  their structure exactly; it does not invent a new one.
- **Decisions** → the D1–D16 table and §0–§11 of `PLAN-vertical-templates-v1.md`.

If a task needs a value that is in none of those, **stop and ask** — do not fill it in.

Scope: **four verticals** — roofing, plumbing, lawn-care, car-detailing. **Health is excluded**
(`HANDOFF-health-vertical-research.md`); never add a `health` entry anywhere in this runbook.

---

## A. Operating rules (every task obeys these)

1. **Three repos, one schema line.** `jdd-schema` (source: `~/Desktop/ops/jdd-schema`), consumed
   by `jdd-ops/console`, `jdd-ops` root, and `~/Desktop/ops/juneau-digital-designs`. When schema
   changes, all three re-pin **in the same session** (Rule 11). Never leave them on different pins.
2. **A statistic is never generated (D4).** `about.stats`, `extensions.reviewBadge`, and any price
   or season copy are client-supplied only. Code may hide an empty slot; it may never fill one.
3. **Missing slot → hide, don't fake (D5).** Mirror `HvacServices`: `return null` / omit the block
   when its data is absent. No placeholder text in shipped component output.
4. **New catalog components carry `meta.verticalTemplate: true`** and **no `skin` prop**. They are
   fixed designs; `skinsFor()` returns nothing for them. Do not add them to `skins.ts`.
5. **Components may import only `@/lib/*` symbols that exist in `template/src/lib`.** If a helper
   isn't there, it must be added to `@jdd/ui` + `template/` and re-pinned first, or not used.
   `verifyCatalogImports` + `verifyUiPins` enforce this at export.
6. **Composition rhythm stays UNSET** on every section (see `hvacTemplate()` header comment). Non-home
   pages must open with a `pageHeader`, home must not.
7. **`run npm test` is `node --import tsx --test "test/**/*.test.mjs"`** in `console/`. The root
   suite is `npm test` in `jdd-ops/`. Both must be green at every GATE.
8. **Never touch files outside a task's declared file list.** The branch already carries a large
   working set; keep each commit scoped.
9. **Verify before claiming done.** Run the stated Verify command; paste real output. A red test is
   a stop, not a footnote.
10. **Commit per phase**, not per file; message names the phase and the D-numbers it implements.
11. **Re-pin sequence:** ship the `@jdd/schema` (or `@jdd/ui`) tag first, then in one session bump
    the `github:JuneauDigitalDesigns/...#vX` line in all three `package.json`s, `npm install` each,
    and run every suite. A partial re-pin is the failure this rule exists to prevent.

---

## B. Starting state (verified 2026-10-28)

```
@jdd/schema pins:  console v1.27.0 · jdd-ops root v1.26.0 · agency v1.26.0   (SKEWED)
@jdd/ui/LeadForm:  has `withMessage`, NO `initialMessage` (message is useState(''))
leadModeFor:       exists in @jdd/schema v1.25.0+, reachable from barrel, ('growth')==='phone'
Hvac* components:  12 files under src/components/catalog/*/Hvac*.tsx, all verticalTemplate:true
VERTICAL_LANGUAGES: only `hvac`, and it is WRONG (teal #16556A / cream, pairingId 'instrument')
vertical-templates: hvacTemplate() orders FAQ before reviews (mockup is reviews before FAQ)
palette test facts (real helpers, approved palettes):
  hvac     warm=FAIL(bg #FFFFFF)  AA=FAIL(accent-fg on #E0602C = 4.15 < 4.5)
  roofing  warm=FAIL(bg #FFFFFF)  AA=PASS
  plumbing warm=FAIL(bg #FFFFFF)  AA=PASS
  lawn     warm=PASS              AA=PASS
  detail   warm=PASS              AA=PASS
```

---

## PHASE 1 — Close the schema pin skew  (PLAN §1)

### T1.1 — Re-pin the two laggards to v1.27.0
- **Files:** `jdd-ops/package.json`, `juneau-digital-designs/package.json`.
- **Do:** change `"@jdd/schema": "github:JuneauDigitalDesigns/jdd-schema#v1.26.0"` → `#v1.27.0`.
  `npm install` in each.
- **Verify:** `jdd-ops$ npm test` green; `juneau-digital-designs$ npm run build` succeeds.
- **Done when:** all three repos read `#v1.27.0` and both suites/builds pass.

### T1.2 — Fix the stale CLAUDE.md pin note
- **File:** `jdd-ops/CLAUDE.md`. **Do:** the line pinning schema at v1.25.1 → v1.27.0.
- **Verify:** `grep -n "1.25.1" jdd-ops/CLAUDE.md` returns nothing schema-related.

**GATE 1:** three repos on one pin, both suites green. Commit: `chore(deps): align @jdd/schema v1.27.0 across console, ops root, agency`.

---

## PHASE 2 — Repair the HVAC ground truth  (PLAN §2, D6/D12) — do before any new vertical

### T2.1 — Correct `VERTICAL_LANGUAGES.hvac` to the approved values
- **File:** `console/src/data/vertical-language.ts`.
- **Do:** replace the `hvac.palette` and `hvac.pairingId` with:
  ```
  pairingId: 'oswald'
  palette: { accent:'#E0602C', accentFg:'#FFFFFF', bg:'#FFFFFF', bgSoft:'#F4F6F8',
             ink:'#13293F', inkSoft:'#4C5E74', rule:'#E2E8F0' }
  ```
  Leave `photography` and `rhythm` as-is. Update the block comment: the HVAC accent/ground are the
  approved Northstar values and `VERTICAL_LANGUAGES` is now the single palette authority (D12); the
  cream/teal override is deleted, not relocated.
- **Do NOT** touch `verticals/hvac.ts`'s palette — it becomes vestigial; a separate cleanup deletes
  it later (PLAN §2.1). Leaving it avoids widening this change.
- **Verify:** deferred to T2.5 (the test changes land first or the suite is red here).

### T2.2 — Make the palette test yield to the approved designs (PLAN resolution 2026-10-28)
- **Files:** `console/test/vertical-language.test.mjs`, and `console/test/helpers/contrast.mjs`.
- **Do, in `contrast.mjs`:** add an optional large-text threshold to the accent-fg check only.
  `--accent-fg` renders solely as a bold button label (large text), where the WCAG AA bar is **3.0**,
  not 4.5. Change the `--accent-fg` assertion in `assertPaletteAA` to compare against `3.0`; keep
  every other check at `AA = 4.5`. Comment why (button-label = large/bold text).
- **Do, in `vertical-language.test.mjs`:** add a documented warmth-exemption set and skip `assertWarm`
  for its members, mirroring how `hvac.ts` documents its own contrast exemption:
  ```
  // These verticals intentionally use a pure-white or dark ground — the bespoke templates
  // (design/vertical-templates-v1/home-mockups.html) deliberately drop decision 9's shared warm
  // ground. assertWarm is therefore scoped out for them, per the 2026-10-28 resolution.
  const WARMTH_EXEMPT = new Set(['hvac', 'roofing', 'plumbing']);
  ```
  In the warmth test, `if (WARMTH_EXEMPT.has(v)) continue;` before `assertWarm`.
  **Do NOT weaken the four-axis key-set assertion** (line ~48) — it stays exactly `['pairingId',
  'palette','photography','rhythm']`.
- **Verify:** `cd console && node --import tsx --test test/vertical-language.test.mjs` → green with
  only `hvac` present.

### T2.3 — Fix the home section-order disagreement (D6c)
- **File:** `console/src/app/c/[slug]/build/vertical-templates.tsx`, `hvacTemplate()` home page.
- **Do:** reorder so `HvacReviews` (testimonials) precedes `HvacFaq` — matching the mockup
  `… trust → testimonials → faq → finalCta`.
- **File:** `console/test/vertical-templates.test.mjs` — update the HVAC-home assertion that currently
  pins FAQ-before-reviews to the new order.
- **Verify:** `node --import tsx --test test/vertical-templates.test.mjs` green.

### T2.4 — Add the palette regression test (PLAN §2.4)
- **File (new):** `console/test/vertical-palette.test.mjs`.
- **Do:** assert, for every built-in vertical that has a language entry, that `presetFor(v)` resolves
  to that language's accent + the pairing's heading font. Minimum: `presetFor('hvac').brand.palette
  .accent === '#E0602C'` and `fontHeading` contains `oswald`. This is the test that would have caught
  the teal/Instrument override. **Break it once** (revert T2.1) and confirm it goes red before trusting it.
- **Note:** `presetFor` runtime-imports `@jdd/schema`; follow the import technique the existing
  `vertical-templates.test.mjs` uses (it documents how to load under the node runner).
- **Verify:** new test green; reverting T2.1 turns it red.

### T2.5 — Full HVAC gate
- **Verify:** `cd console && npm test` fully green. Visually confirm HVAC in the Studio preview is
  orange/navy/Oswald, not teal/cream/Instrument.

**GATE 2 (hard):** do not start any new vertical until T2.5 passes. Commit:
`fix(console): HVAC template renders the approved orange/navy/Oswald (D6/D12)`.

---

## PHASE 3 — `@jdd/ui`: `LeadForm.initialMessage`  (PLAN §10.3, D8)

### T3.1 — Add the prop
- **File:** `~/Desktop/ops/jdd-ops/console/node_modules/@jdd/ui/src/LeadForm.tsx` is a *mirror*; edit
  the **source** repo `@jdd/ui` (find it the way the schema source lives at `~/Desktop/ops/jdd-schema`;
  if the `@jdd/ui` source repo isn't on disk, STOP and ask — do not edit node_modules).
- **Do:** add `initialMessage?: string` to the props; change `useState('')` for `message` to
  `useState(initialMessage ?? '')`. Default keeps all existing call sites byte-identical. The field
  stays editable (do not make it readOnly).
- **Verify:** `@jdd/ui` builds/tests; `LeadForm({withMessage, initialMessage:'x'})` seeds the textarea.

### T3.2 — Ship + re-pin (Rule 11)
- Ship a `@jdd/ui` minor. Bump the `@jdd/ui` pin in **`template/package.json`** and **console**,
  `npm install`, let `mergePackageJson` carry it to client repos on export.
- **Verify:** `verifyUiPins` passes for a scratch export (checked at T6 gate).

**GATE 3:** `@jdd/ui` shipped, template + console re-pinned. Commit in each repo.

---

## PHASE 4 — `@jdd/schema`: template slots + mapping  (PLAN §3, D4/D10/D14) → v1.28.0

All edits in `~/Desktop/ops/jdd-schema/src`.

### T4.1 — `industry-menu.ts`: add `TemplateSlots`
- **Do:** add the `TemplateSlots` interface from PLAN §3.1 (including `offerBadge: boolean`), add a
  `templateSlots: TemplateSlots` field to `IndustryMenu`, and populate it per the PLAN §3.1 table for
  roofing, plumbing, lawn-care, car-detailing. **hvac** also needs an entry (stats + reviewAggregate).
  **No health entry.**
- **Lawn (D14):** `stats` has 4 prompts AND `seasons` has 4 — lawn carries both.
- **Verify:** `cd ~/Desktop/ops/jdd-schema && npm test` green.

### T4.2 — `site.ts`: add the three new content slots
- **File:** `~/Desktop/ops/jdd-schema/src/site.ts`.
- **Do:** on `ExtensionsContent` add `offerBadge?: string | null;` and
  `serviceRadiusMiles?: string | null;`. On the service item interface add
  `priceFrom?: string | null;`. Add a `seasons?: { key:string; label:string; body:string }[] | null`
  slot where the content tree expects it (sibling of `about`/`services` — follow the existing section
  shape). `about.stats` and `extensions.reviewBadge` already exist — reuse them, do not duplicate.
- **Verify:** schema typechecks.

### T4.3 — `brand-intake.ts`: submission fields + mapper + flags
- **Do:** add the optional `BrandIntakeSubmission` fields from PLAN §3.2 (`stats`, `reviewAggregate`,
  `servicePrices`, `seasons`, `serviceRadiusMiles`, `offerBadge`; `hoursPerDay` only if health were in
  scope — it isn't, so skip it this cycle). In `mapBrandIntakeToIntake`:
  - replace `about.stats: repeat(S.stats, () => ({n:'',l:''}))` with a map from `f.stats`, emitting
    **only filled entries** (empty array is correct).
  - replace `extensions.reviewBadge: null` with a map from `f.reviewAggregate` (still `null` when absent).
  - map `offerBadge`, `servicePrices`→service items' `priceFrom`, `seasons`, `serviceRadiusMiles`.
  - `flag(...)` each unsupplied slot into `_meta.missing_fields`.
- **Verify:** schema tests green; a submission with empty stats maps to empty `about.stats` (not `{n:'',l:''}`×N).

### T4.4 — Mirror EVERY new field into `SITE_TYPES_SOURCE` (PLAN §3.4 — fatal if skipped)
- **File:** `~/Desktop/ops/jdd-schema/src/site-types-source.ts`.
- **Do:** add the exact same field declarations added to `site.ts` in T4.2. The inlined interface the
  client repo compiles against must match the real type, or every exported repo fails `next build`.
- **Verify:** add/extend a schema test asserting `SITE_TYPES_SOURCE` contains `offerBadge`,
  `priceFrom`, `seasons`, `serviceRadiusMiles` (precedent: the v1.25.1 "mirror the 4 drifted fields" fix).

### T4.5 — The D4 guard: statistics are never generated
- **Where:** the console copy path (the module that calls the copywriter). Find it via
  `grep -rl "copywriter\|generateCopy\|anthropic" console/src/lib`.
- **Do:** (a) the copywriter prompt states `about.stats` and `extensions.reviewBadge` are
  client-supplied and must be left untouched; (b) a hard post-generation assertion rejects any
  generation that introduces a stat entry or reviewBadge absent from the intake.
- **File (new):** `console/test/no-generated-stats.test.mjs` — empty stats in → empty stats out; break
  the guard and watch it go red (CLAUDE.md: a test that can't fail is decoration).

### T4.6 — Ship v1.28.0 + re-pin (Rule 11)
- Tag `@jdd/schema` v1.28.0. Re-pin console + jdd-ops root + agency to `#v1.28.0`, `npm install` each.
- **Verify:** all three suites/builds green.

**GATE 4:** schema v1.28.0 shipped, three repos re-pinned, `SITE_TYPES_SOURCE` mirrored and tested.
Commit in each repo.

---

## PHASE 5 — ROOFING, end to end  (PLAN §5–§8, §10) — the pipeline-proving vertical

Build roofing completely before any other vertical, so a pipeline problem surfaces as a pipeline
problem, not a design question.

### T5.1 — The 12 roofing components
- **Files (new):** `console/src/components/catalog/<cat>/Roofing<Section>.tsx` for all 12 categories:
  `nav footer seo pageHeader hero stats services trust faq testimonials finalCta contact`.
- **Recipe for each (no deviation):**
  1. Open the matching `Hvac<Section>.tsx` as the structural pattern — copy its `meta` shape
     (`verticalTemplate:true`, `consumes`, `sharedDeps`), its `content = CONTENT` prop, its `<E>`/`<Ico>`
     editable wiring, and its null-return degradation.
  2. Take the **visual** values (colours, radii, spacing, type) from the `#roofing` pane and `#roofing`
     CSS block in `design/vertical-templates-v1/home-mockups.html`. Do not re-pick colours — the tokens
     come from `brand.palette` (which after Phase 6 the language supplies) plus the literal accents the
     mockup pins (bitumen/amber hex that aren't palette slots) exactly as the mockup writes them.
  3. Wire content from the same schema paths the `Hvac*` sibling consumes, plus the new slots roofing
     uses: none beyond stats/reviewBadge/serviceArea for roofing (it has no prices/seasons/offer).
  4. CTA rules (D7/D16, §10.1): non-phone CTAs link `/contact`; phone CTAs `tel:`; the storm-card
     button submits an inline `<LeadForm>` (D9). Lead mode is plan-derived via `leadModeFor(_meta.selectedPlan)`
     — the storm card and final CTA both use it. Do NOT force email (D11).
- **Done when:** all 12 compile in the console and render in the Studio preview.

### T5.2 — Register in all three places (PLAN §5.3)
- `console/src/lib/export.ts` → add the 12 `Roofing*` names to the `CATALOG` category arrays.
- `console/src/app/c/[slug]/build/categories.tsx` → import + register each (follow the `Hvac*` rows;
  `render: () => <Roofing… content={effective} />`, no skin).
- `skins.ts` → **nothing** (they take no skin).
- **Verify:** `node --import tsx --test test/catalog-invariants.test.mjs` green.

### T5.3 — The roofing builder + nav currentPath
- **File:** `console/src/app/c/[slug]/build/vertical-templates.tsx`.
- **Do:** add `roofingTemplate()` mirroring `hvacTemplate()` with roofing's home order
  (`hero · stats · services · trust · faq · testimonials · finalCta`, per PLAN §5.4) and the three
  subpages each opening with `RoofingPageHeader`. Register `roofing` in `VERTICAL_TEMPLATES`. Rhythm unset.
- **File:** `console/src/lib/export.ts`, `wirePages` — the nav special-case currently reads
  `comp.chrome.nav.name === 'HvacNav'`. Change to a set membership test covering all vertical navs
  (`HvacNav`, `RoofingNav`, …). Otherwise the per-vertical nav loses its `currentPath`/active state.
- **Verify:** `node --import tsx --test test/vertical-templates.test.mjs` green (see T5.5 for its edits).

### T5.4 — The roofing language entry
- **File:** `console/src/data/vertical-language.ts` — add `roofing` (four axes) with the PLAN §5.5
  palette (`accent #B4512A`, bg `#FFFFFF`/`#F5F2EF`, bitumen `#241E1B`), `pairingId 'archivo'`, a
  `photography.subjects` list, and a `rhythm.homeTemplateId` that is a real `home` template id (the
  test requires it — reuse `'home-standard'` unless a better shared id exists).
- **File:** `console/src/data/image-placeholders.ts` — add a roofing curation (follow the existing
  per-vertical table).
- **Verify:** `vertical-language.test.mjs` green (roofing is in `WARMTH_EXEMPT` from T2.2).

### T5.5 — Tests
- `console/test/vertical-templates.test.mjs` — add roofing to the builds/validate/CATALOG assertions.
  (The `car-detailing → null` assertion stays true until Phase 8; leave it.)
- `console/test/cta-routing.test.mjs` (new) — roofing's non-phone CTAs are `/contact` (allowlisting
  `/services` is a detailing-only concern, add it when detailing lands); no href-less CTA anchor.
- **Verify:** `cd console && npm test` green.

### T5.6 — Export / build / re-export acceptance (PLAN §8)
- Export roofing to a scratch slug. `npm run build` in the client repo passes.
- Re-export with `overwrite:true`: client-evolved files preserved, `brand.phone` still the Twilio
  number (if one was provisioned), `/api/contact|voice|no-answer` still the `lib/site-routes` versions.
- `jdd-ops$ npm run onboard -- --dry-run` for the scratch slug reports no new `FAIL:` token.
- **Verify:** all three above pass; paste the build result.

**GATE 5 (hard):** roofing builds, exports, re-exports, and dry-runs clean. Commit:
`feat(console): roofing vertical template (D1–D16 as applicable)`.

---

## PHASE 6 — LAWN  (PLAN §10.2/§10.3/§10.6, D8/D10/D14) — proves the remaining new behaviours

Same T5.1–T5.6 shape for `Lawn*`, plus the behaviours roofing didn't exercise:

### T6.1 — `LawnStats` renders stat band + season rail (D14)
- One component in the `stats` category renders both the four-tile trust band and the slim season
  rail beneath (markup/CSS from the `#lawn` pane). Each half degrades independently (D5): empty stats →
  no band; absent `seasons` → **no rail** (we never describe a programme the client doesn't run).

### T6.2 — The hero frequency picker → `/contact` pre-fill (D8)
- Hero "See my price →" links `/contact?frequency=weekly|biweekly|onetime`.
- The contact page maps the param through a **fixed whitelist** to a fixed string (e.g.
  `weekly → "Weekly mowing — quarter-acre"`) and passes it as `<LeadForm withMessage
  initialMessage={...}>`. An unmapped value yields an empty message (never echo the raw param — it
  reaches an owner email). Field stays editable.
- **File (new):** `console/test/lead-form-prefill.test.mjs` — seeds the textarea; unmapped param → empty.

### T6.3 — The offer ribbon is client-supplied (D10)
- `LawnFinalCta` renders `extensions.offerBadge` in the ribbon; `null` → no ribbon (D5). Never a default.

### T6.4 — Tests + acceptance
- Extend `catalog-invariants` (offerBadge/seasons/stats absence → omitted) and `cta-routing` for lawn.
- Run T5.6 acceptance for lawn.

**GATE 6:** lawn builds/exports/re-exports clean; prefill + ribbon + dual-slot all covered by tests.
After this, every novel mechanism in the programme has shipped once. Commit.

---

## PHASE 7 — Agency "Proof & details" step  (PLAN §4)

- **File:** `juneau-digital-designs/app/components/onboarding/onboardingpageclient.tsx`.
- **Do:** insert a keyed step `{ key:'proof', label:'Proof & details' }` after `apart`, before `sound`
  (the step list is keyed, not positional — safe). Render **only** the slots
  `templateSlots[industry]` declares (stats prompts, reviewAggregate, servicePrices, seasons,
  serviceRadius, offerBadge). It **must not block** — only `activation` blocks; blanks increment the
  existing advisory `blankCount()` and land in `_meta.missing_fields`. Each stat row shows its
  `example` as placeholder. Step copy: "We'll write your site copy for you. We won't make up numbers
  about your business — these come from you."
- Extend `buildPayload()` to emit the new fields and add them to the `review` summary.
- **Verify:** `npm run build` in the agency repo; a manual pass of the step per vertical shows only
  that vertical's questions.

**GATE 7:** agency form collects the new fields per vertical, nothing blocks. Commit.

---

## PHASE 8 — PLUMBING, then CAR DETAILING  (PLAN §5, §10.1, D15/D16)

Each repeats T5.1–T5.6. Vertical-specific notes:

- **Plumbing:** split-panel hero with the intake `<LeadForm>` inside it; live-dispatch pill is static
  copy; home order per PLAN §5.4. No prices/seasons/offer.
- **Car detailing (last):**
  - Remove the `car-detailing → null` assertion from `vertical-templates.test.mjs` (it now has a builder).
  - Service cards show `priceFrom` from the client; absent → tag-only footer (D5/D15). Never "$0" / "Call".
  - Hero "See packages →" links **`/services`** (D16) — add `/services` to the `cta-routing` allowlist;
    it is the one documented exception. The phone CTA is `tel:`; the final CTA is a plan-derived `<LeadForm>`.
  - Dark palette: already passes warmth/AA, so no exemption needed; confirm with `vertical-language.test.mjs`.

**GATE 8:** both build/export/re-export/dry-run clean. Commit each vertical separately.

---

## PHASE 9 — Full sweep  (PLAN §7, §10.5)

- **Verify:** `cd console && npm test` and `cd jdd-ops && npm test` both fully green.
- Confirm present and passing: `vertical-templates`, `vertical-language`, `vertical-palette`,
  `catalog-invariants`, `cta-routing`, `lead-form-prefill`, `no-generated-stats`, `palette-contrast`,
  `composition-manifest`, `multipage-pages`, `phase-contract` (expected unchanged — no `log()` added to
  onboard.js), `provisioned-fields`.
- Spot-check each of the four verticals in the Studio preview against its mockup tab.

**FINAL GATE:** both suites green, four verticals render and export. The programme is done; health
remains parked per `HANDOFF-health-vertical-research.md`.

---

## Quick reference — files touched

| Area | Files |
|---|---|
| schema (v1.28.0) | `jdd-schema/src/{industry-menu,site,brand-intake,site-types-source}.ts` + tests |
| @jdd/ui minor | `@jdd/ui/src/LeadForm.tsx` |
| console langs | `src/data/vertical-language.ts`, `src/data/image-placeholders.ts` |
| console catalog | `src/components/catalog/*/{Roofing,Lawn,Plumbing,Detail}*.tsx` (48) |
| console wiring | `src/app/c/[slug]/build/{vertical-templates.tsx,categories.tsx}`, `src/lib/export.ts` |
| console copy guard | the copywriter-calling lib module (grep) |
| console tests | `vertical-palette`, `cta-routing`, `lead-form-prefill`, `no-generated-stats` (new) + edits to `vertical-templates`, `vertical-language`, `contrast.mjs`, `catalog-invariants` |
| agency | `app/components/onboarding/onboardingpageclient.tsx` |
| pins | `package.json` × (console, jdd-ops root, agency) |
| docs | `jdd-ops/CLAUDE.md` pin note |

**Not touched by this runbook:** `verticals/*.ts` palettes (vestigial, delete later), onboard.js
`log()` calls (phase-contract must stay green), any `health` entry anywhere.
