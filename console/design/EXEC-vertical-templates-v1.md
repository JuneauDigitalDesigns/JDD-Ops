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
- **Verify:** `verifyUiPins` passes for a scratch export (first exercised at the Phase 5 roofing R6 acceptance).

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

## COMPONENT PROGRAMME — the 48 bespoke files  (PLAN §5) — read before Phases 5–9

This is the bulk of the work: **4 verticals × 12 categories = 48 new components**, plus 4
`VERTICAL_TEMPLATES` builders, 4 `VERTICAL_LANGUAGES` entries, and the registration of all 48.
Phases 5, 6, 8, 9 each build one vertical's slice end-to-end; everything that is identical across them is
stated **once here** so a vertical phase is only its deltas.

### Master inventory (48 files — tick each as it lands)

Every cell is a file at `console/src/components/catalog/<category>/<Name>.tsx`.

| category | roofing | lawn | plumbing | car-detailing |
|---|---|---|---|---|
| `nav`          | `RoofingNav`      | `LawnNav`      | `PlumbingNav`      | `DetailNav` |
| `hero`         | `RoofingHero`     | `LawnHero`     | `PlumbingHero`     | `DetailHero` |
| `stats`        | `RoofingStats`    | `LawnStats`    | `PlumbingStats`    | `DetailStats` |
| `services`     | `RoofingServices` | `LawnServices` | `PlumbingServices` | `DetailServices` |
| `trust`        | `RoofingTrust`    | `LawnTrust`    | `PlumbingTrust`    | `DetailTrust` |
| `testimonials` | `RoofingReviews`  | `LawnReviews`  | `PlumbingReviews`  | `DetailReviews` |
| `faq`          | `RoofingFaq`      | `LawnFaq`      | `PlumbingFaq`      | `DetailFaq` |
| `finalCta`     | `RoofingFinalCta` | `LawnFinalCta` | `PlumbingFinalCta` | `DetailFinalCta` |
| `pageHeader`   | `RoofingPageHeader` | `LawnPageHeader` | `PlumbingPageHeader` | `DetailPageHeader` |
| `contact`      | `RoofingContact`  | `LawnContact`  | `PlumbingContact`  | `DetailContact` |
| `footer`       | `RoofingFooter`   | `LawnFooter`   | `PlumbingFooter`   | `DetailFooter` |
| `about`        | `RoofingAbout`    | `LawnAbout`    | `PlumbingAbout`    | `DetailAbout` |

Naming: `<Vertical>` + the category in PascalCase, with `testimonials → <Vertical>Reviews` (matching
`HvacReviews`). **`seo` is NOT per-vertical** — like `hvacTemplate()`, every builder reuses the shared
`SeoLocalBusiness` for chrome SEO, so there is no `<Vertical>Seo` file. The 12th bespoke file is
instead `<Vertical>About` (the about subpage, mirroring `HvacAbout`). **No `Health*` row — parked.**

### Section archetypes — how much each file actually changes

Not all 12 are equally bespoke. This tells you where the design effort goes and where a file is
near-mechanical:

- **Thin (token/treatment only):** `nav`, `footer`, `pageHeader`, `contact`. Structurally the same
  as the `Hvac*` sibling; they differ by palette tokens and small treatment (e.g. roofing's 3px
  bitumen nav border, detailing's near-black footer). Build these first per vertical — they're fast
  and they unblock the composition. (`seo` is not built at all — the builder reuses the shared
  `SeoLocalBusiness`.)
- **Bespoke (real per-vertical layout):** `hero`, `stats`, `services`, `trust`, `testimonials`,
  `finalCta`, `about`. These carry the vertical's thesis and have genuinely different markup per
  vertical (see each phase's spec table). This is where the mockup pane is the source of truth.

### Shared build recipe — applies to every one of the 48 (stated once)

For each file:

1. **Open the matching `Hvac<Section>.tsx`** (`console/src/components/catalog/<cat>/Hvac*.tsx`) as
   the structural pattern. Copy the shape, not the look: the `meta` block
   (`verticalTemplate: true`, `category`, `consumes`, `sharedDeps`), the `{ content = CONTENT }:
   { content?: SiteContent }` prop, the `<E p="…">` / `<Ico>` editable wiring, and the
   null-return/omit degradation.
2. **Take the look from the mockup**, not from judgement: the `#<vertical>` pane + CSS block in
   `design/vertical-templates-v1/home-mockups.html`. Colour tokens come from `brand.palette` (which
   the language now supplies, D12); literal accents the mockup pins that are **not** palette slots
   (e.g. roofing bitumen/amber, detailing gold, lawn sun-gold) are written as the mockup writes
   them — do not invent or "improve" a value.
3. **Wire content** from the schema paths the `Hvac*` sibling consumes (category map below), plus
   any new slot this vertical uses (per its spec table).
4. **Obey the 6 non-negotiables** (below) and the **degradation map** (below).

### The 6 non-negotiables (PLAN §5.2) — every file

1. `meta.verticalTemplate: true` (exempts from anti-slop heuristics).
2. **No `skin` prop.** Fixed designs; never added to `skins.ts`.
3. Imports **only `@/lib/*` symbols present in `template/src/lib`** — `verifyCatalogImports` +
   `verifyUiPins` enforce it. Need a new helper → add to `@jdd/ui` + `template/`, re-pin, or don't
   use it.
4. Every editable string in `<E p="…">`, every icon in `<Ico>`.
5. `finalCta` uses `<LeadForm mode={leadModeFor(content._meta?.selectedPlan)}>` — plan-derived
   (D11), never forced email.
6. D5 degradation (map below). No placeholder text in shipped output.

### Category → schema consumption (constant across verticals, from the `Hvac*` siblings)

| category | reads |
|---|---|
| `nav` | `brand`, `nav[]` |
| `hero` | `hero.*`, `brand.phone/phoneHref`, `extensions.reviewBadge`, `images.hero` |
| `stats` | `about.stats` (+ **lawn:** `seasons`) |
| `services` | `services.*`, `services.items[]` (+ **detail:** `items[].priceFrom`) |
| `trust` | `extensions.serviceArea` (+ **detail:** `extensions.serviceRadiusMiles`) |
| `testimonials` | `testimonials.*`, `extensions.reviewBadge` (aggregate) |
| `faq` | `faq.*` |
| `finalCta` | `finalCta.*`, `<LeadForm>` (+ **lawn:** `extensions.offerBadge`) |
| `pageHeader` | `data` prop (from `subpages[route].header`) — same contract as `HvacPageHeader` |
| `contact` | `subpages` contact copy + `extensions.contactDetails` |
| `footer` | `footer.*`, `brand` |
| `about` | `about.*` (eyebrow/title/body/pillars) — same as `HvacAbout` (about subpage only) |

### Degradation map (D5) — constant across verticals

| absent | behaviour |
|---|---|
| `about.stats` empty | stat band not rendered |
| `seasons` empty (lawn) | **season rail not rendered** (we don't describe a programme the client doesn't run) |
| `extensions.reviewBadge` null | aggregate score/line omitted; **quote cards still render** |
| `extensions.serviceArea` empty | trust/area section not rendered |
| `items[].priceFrom` absent (detail) | that card's footer shows the tag only, no price |
| `extensions.serviceRadiusMiles` absent (detail) | radius statement drops to town run only |
| `extensions.offerBadge` null (lawn) | offer ribbon not rendered |

### Per-vertical common tasks (every Phase 5–8 vertical runs all of these)

Each vertical phase = build its 12 components (its spec table) **+** these five tasks, which are
identical in shape per vertical. They are written out fully for roofing (Phase 5) and referenced by
`→ roofing T·R2..R5` thereafter; do the same edits for the named vertical.

- **R2 Register (3 places):** add the 12 names to `CATALOG` (`console/src/lib/export.ts`); import +
  register each in `console/src/app/c/[slug]/build/categories.tsx` (follow the `Hvac*` rows,
  `render: () => <Name content={effective} />`, no skin); **nothing** in `skins.ts`.
- **R3 Builder + nav:** add `<vertical>Template()` to
  `console/src/app/c/[slug]/build/vertical-templates.tsx` mirroring `hvacTemplate()` — home order
  per that vertical's spec table, the three subpages each opening with `<Vertical>PageHeader`,
  rhythm **unset**, fresh `newSectionId()` per section. Chrome is `{ nav: <Vertical>Nav, footer: <Vertical>Footer, seo: SeoLocalBusiness }` — the SEO
  component is **shared, not per-vertical** (exactly as `hvacTemplate()` does it). The about subpage
  uses `<Vertical>About`. Register the vertical in `VERTICAL_TEMPLATES`. First vertical only: in `export.ts` `wirePages`, change the nav special-case
  `comp.chrome.nav.name === 'HvacNav'` to a **set** covering all vertical navs, or each vertical's
  nav loses its `currentPath`/active state.
- **R4 Language + imagery:** add the vertical's four-axis `VERTICAL_LANGUAGES` entry (palette +
  `pairingId` from PLAN §5.5, a `photography.subjects` list, `rhythm.homeTemplateId` = a real `home`
  template id — reuse `'home-standard'` unless a better shared id exists); add its
  `image-placeholders.ts` curation.
- **R5 Tests:** add the vertical to `vertical-templates.test.mjs` (builds/validate/CATALOG) and to
  `cta-routing.test.mjs` (non-phone CTAs → `/contact`, no href-less CTA). New/extended per-behaviour
  tests are called out in the vertical's phase.
- **R6 Acceptance (PLAN §8):** export to a scratch slug → `npm run build` passes; re-export
  `overwrite:true` → client-evolved files preserved, `brand.phone` still the Twilio number if
  provisioned, `/api/{contact,voice,no-answer}` still the `lib/site-routes` versions; `jdd-ops$ npm
  run onboard -- --dry-run` for the slug reports no new `FAIL:`.

---

## PHASE 5 — ROOFING, end to end  (PLAN §5–§8, §10) — the pipeline-proving vertical

Build roofing **completely** before any other vertical, so a pipeline problem surfaces as a
pipeline problem, not a design question. Home order (R3): `hero · stats(ledger) · services · trust ·
faq · testimonials · finalCta`. **Note roofing is the one vertical with FAQ before reviews.**

### T5.1 — The 12 roofing components  (recipe + non-negotiables above)

| file | source `#roofing` class | vertical-specific spec |
|---|---|---|
| `RoofingNav` | `.nav` | sticky, **3px bitumen bottom border**; "Free inspection" btn → `/contact`; phone `tel:` |
| `RoofingHero` | `.hero` + `.stormcard` | full-bleed photo, **scrim climbs from the bottom** (sky stays visible); right-side **storm-damage card is an inline `<LeadForm>`** (plan-derived, D9/D11); "Book a free inspection →" → `/contact`; hero phone `tel:` |
| `RoofingStats` | `.ledger` | **dark bitumen ledger bar**, 4 cells, amber numerals, hairline dividers. `about.stats`, client-supplied; empty → not rendered |
| `RoofingServices` | `.svc-rows` / `.svc-row` | **ruled rows, not cards**; outlined index numerals (`-webkit-text-stroke`); chevron; hover fills row + colours numeral |
| `RoofingTrust` | `.area` + `.towns` | 4-column **ruled town index** under a pitched-roof watermark; `extensions.serviceArea`; empty → section omitted |
| `RoofingReviews` | `.rev-grid` / `.agg` / `.rq` | **dark aggregate panel** + two large pull-quotes (not 3 cards); `reviewBadge` null → aggregate omitted, quotes stay |
| `RoofingFaq` | `.faq2` | **two-column hairline** accordion, no cards |
| `RoofingFinalCta` | `.ctaband` | photo band + dark scrim, **single inline form row** = `<LeadForm>` plan-derived |
| `RoofingPageHeader` | (thin) | mirror `HvacPageHeader` `data` contract; roofing tokens |
| `RoofingContact` | (thin) | mirror `HvacContact`; roofing tokens |
| `RoofingFooter` | `footer.ftr` | **dark bitumen** footer; clay mark; amber column heads |
| `RoofingAbout` | about subpage (no home pane) | mirror `HvacAbout`; roofing tokens |

- **Done when:** all 12 compile and render in the Studio preview against the `#roofing` tab.

### T5.2–T5.6 — the common tasks
Run **R2, R3, R4, R5, R6** (above) for roofing. R3 home order is the one in this phase's header.
R3 nav-set change (first vertical) lands here. R4 palette: `accent #B4512A`, bg `#FFFFFF`/`#F5F2EF`,
bitumen `#241E1B`, `pairingId 'archivo'`. R5: create `cta-routing.test.mjs` here (roofing only;
`/services` allowlist is added when detailing lands).

**GATE 5 (hard):** roofing's 12 components ship, register, build, export, re-export, and dry-run
clean; `cd console && npm test` green. Commit: `feat(console): roofing vertical template + 12 components`.

---

## PHASE 6 — LAWN  (PLAN §5, §10.2/§10.3/§10.6, D8/D10/D14)

Builds the 12 `Lawn*` components **plus** the three behaviours roofing didn't exercise. Home order
(R3): `hero · stats(band + season rail) · services · trust · reviews · faq · finalCta`.

### T6.1 — The 12 lawn components

| file | source `#lawn` class | vertical-specific spec |
|---|---|---|
| `LawnNav` | `.nav` | warm paper nav; "Get a quote" → `/contact`; phone `tel:` |
| `LawnHero` | `.hero` + `.picker` | warm green scrim; **frequency plan picker** (weekly/bi-weekly/one-time) with a price anchor; **"See my price →" → `/contact?frequency=…`** (T6.2) |
| `LawnStats` | `.statband` + `.srail` | **DUAL (D14):** four-tile trust band (icon above numeral) **and** a slim season rail beneath. `about.stats` empty → no band; `seasons` empty → **no rail**. Degrade independently |
| `LawnServices` | `.svc-grid` / `.svc-card` | cards with a **photo band**, icon pill overlapping the seam |
| `LawnTrust` | `.area` + `.tags` | two-up over a **mow-stripe** field, pill tags; `serviceArea` |
| `LawnReviews` | `.rev-head` / `.rev-agg` / `.qcard` | hairline cards, **photo avatars**, sun-gold stars; `reviewBadge` null → aggregate omitted |
| `LawnFaq` | `.faq` | big soft rounded rows |
| `LawnFinalCta` | `.cta-grid` + `.ribbon` | forest band + white card; **gold offer ribbon = `extensions.offerBadge`** (T6.3); `<LeadForm>` plan-derived |
| `LawnPageHeader` | (thin) | mirror `HvacPageHeader`; lawn tokens |
| `LawnContact` | (thin) | mirror `HvacContact`; lawn tokens |
| `LawnFooter` | `footer.ftr` | forest-dark footer; sun-gold column heads |
| `LawnAbout` | about subpage | mirror `HvacAbout`; warm/forest tokens |

### T6.2 — Hero picker → contact pre-fill (D8)
- `LawnHero` "See my price →" links `/contact?frequency=weekly|biweekly|onetime`.
- The contact page maps the param through a **fixed whitelist** to a fixed string (e.g. `weekly →
  "Weekly mowing — quarter-acre"`) and passes it as `<LeadForm withMessage initialMessage={…}>`
  (prop added in Phase 3). Unmapped value → **empty** message (never echo the raw param — it reaches
  an owner email). Field stays editable.
- **File (new):** `console/test/lead-form-prefill.test.mjs` — seeds the textarea; unmapped → empty.

### T6.3 — Offer ribbon is client-supplied (D10)
- `LawnFinalCta` renders `extensions.offerBadge` in the ribbon; `null` → no ribbon. Never a default.

### T6.4 — Common tasks + behaviour tests
- Run **R2–R6** for lawn. R4 palette: `accent #2F7A33`, bg `#FCFCF8`/`#EFF3E9`, forest `#1E4028`,
  `pairingId 'figtree'`.
- Extend `catalog-invariants.test.mjs`: `offerBadge`/`seasons`/`stats` absence each → omitted.

**GATE 6:** lawn's 12 components + prefill + ribbon + dual-slot all ship and are tested; build/export/
re-export clean. After this every novel mechanism in the programme has shipped once. Commit.

---

## PHASE 7 — Agency "Proof & details" step  (PLAN §4)

- **File:** `juneau-digital-designs/app/components/onboarding/onboardingpageclient.tsx`.
- **Do:** insert a keyed step `{ key:'proof', label:'Proof & details' }` after `apart`, before
  `sound` (the step list is keyed, not positional — safe). Render **only** the slots
  `templateSlots[industry]` declares (stats prompts, reviewAggregate, servicePrices, seasons,
  serviceRadius, offerBadge). It **must not block** — only `activation` blocks; blanks increment the
  advisory `blankCount()` and land in `_meta.missing_fields`. Each stat row shows its `example` as
  placeholder. Step copy: "We'll write your site copy for you. We won't make up numbers about your
  business — these come from you."
- Extend `buildPayload()` to emit the new fields; add them to the `review` summary.
- **Verify:** `npm run build` in the agency repo; a manual pass per vertical shows only that
  vertical's questions.

**GATE 7:** agency form collects the new fields per vertical, nothing blocks. Commit.

---

## PHASE 8 — PLUMBING  (PLAN §5)

Builds the 12 `Plumbing*` components. No new cross-cutting behaviour — every mechanism shipped by
Phase 6, so this is a design-fidelity repeat. Home order (R3): `hero · stats · services · trust ·
reviews · faq · finalCta`.

### T8.1 — The 12 plumbing components

| file | source `#plumbing` class | vertical-specific spec |
|---|---|---|
| `PlumbingNav` | `.nav` | pill CTA "Get a plumber" → `/contact`; phone `tel:` |
| `PlumbingHero` | `.hero` (split) + `.intake` | **split panel**: solid deep-blue left with the lead **`<LeadForm>` inside the hero**, photo right (no scrim-over-text); static "3 trucks out now" dispatch pill (copy, not live) |
| `PlumbingStats` | `.statrow` | **inline hairline** stats, no tiles; `about.stats` client-supplied |
| `PlumbingServices` | `.svc-grid` / `.svc-card` | rounded cards, **circular icon badge**, pill tag floated top-right |
| `PlumbingTrust` | `.area` + `.chips` | **centred** around one oversized `24/7`; pill chips; `serviceArea` |
| `PlumbingReviews` | `.rev-head` / `.aggbox` / `.qcard` | quote-mark cards, aggregate as a **pill in the header**; `reviewBadge` null → aggregate omitted |
| `PlumbingFaq` | `.faq` | rounded rows, **accent left-edge when open** |
| `PlumbingFinalCta` | `.band-cta` + `.cta-form` | **accent-blue band** (not navy — this template has no navy until the footer) + white form card; `<LeadForm>` plan-derived |
| `PlumbingPageHeader` | (thin) | mirror `HvacPageHeader`; plumbing tokens |
| `PlumbingContact` | (thin) | mirror `HvacContact`; plumbing tokens |
| `PlumbingFooter` | `footer.ftr` | deep-blue `#08202F` footer |
| `PlumbingAbout` | about subpage | mirror `HvacAbout`; blue tokens |

### T8.2 — Common tasks
Run **R2–R6** for plumbing. R4 palette: `accent #1E6FA8`, bg `#FFFFFF`/`#EEF4F8`, deep `#0E2A3D`,
`pairingId 'schibsted'`. (plumbing is in `WARMTH_EXEMPT` — white ground.)

**GATE 8:** plumbing's 12 ship, register, build, export, re-export clean. Commit.

---

## PHASE 9 — CAR DETAILING  (PLAN §5, §10.1, D15/D16) — last vertical

Builds the 12 `Detail*` components. Dark-first palette (already passes warmth/AA — **no exemption
needed**). Home order (R3): `hero · stats(strip) · services · trust · reviews · faq · finalCta`.

### T9.1 — The 12 detailing components

| file | source `#detail` class | vertical-specific spec |
|---|---|---|
| `DetailNav` | `.nav` | near-black nav; "Book a detail" → `/contact`; phone `tel:` |
| `DetailHero` | `.hero` | **centred, vignetted**, gold hairline framing; phone `tel:`; **"See packages →" → `/services`** (D16 — the one allowlisted exception) |
| `DetailStats` | `.strip` | thin hairline **strip**, gold numerals; `about.stats` client-supplied |
| `DetailServices` | `.svc-card` + `.svc-foot` / `.svc-price` | **glass package cards** with a **`priceFrom`** line; `items[].priceFrom` absent → **footer shows tag only** (D5/D15), never "$0"/"Call" |
| `DetailTrust` | `.area` + `.rings` + `.run` | centred **mobile-radius** statement, concentric ring, gold-dotted town run; `serviceRadiusMiles` absent → town run only |
| `DetailReviews` | `.rev-head` + `.q2` | **two large quotes on dark**, aggregate centred with one big gold numeral; `reviewBadge` null → aggregate omitted |
| `DetailFaq` | `.faqrows` | **pure hairline rows**, no cards |
| `DetailFinalCta` | `.band-cta` (light) + `.cta-form` (dark) | **the one LIGHT band** on the page with a dark form card; `<LeadForm>` plan-derived |
| `DetailPageHeader` | (thin) | mirror `HvacPageHeader`; dark tokens |
| `DetailContact` | (thin) | mirror `HvacContact`; dark tokens |
| `DetailFooter` | `footer.ftr` | near-black `#08090C` footer |
| `DetailAbout` | about subpage | mirror `HvacAbout`; dark tokens |

### T9.2 — Common tasks + the detailing specials
- Run **R2–R6** for detailing. R4 palette: `accent #C9A14B`, bg `#0D0E12`/`#14161C`, `pairingId
  'bricolage'`. **Not** in `WARMTH_EXEMPT` (its ground isn't pure) — confirm it passes
  `vertical-language.test.mjs` unmodified.
- **Remove** the `applyVerticalTemplate('car-detailing') === null` assertion from
  `vertical-templates.test.mjs` — it now has a builder.
- **Add `/services` to the `cta-routing.test.mjs` allowlist** — detailing's "See packages →" is the
  one documented non-`/contact` conversion-area CTA (D16).

**GATE 9:** detailing's 12 ship, register, build, export, re-export clean; the `car-detailing → null`
assertion is gone and the suite is still green. Commit.

---

## PHASE 10 — Full sweep  (PLAN §7, §10.5)

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
