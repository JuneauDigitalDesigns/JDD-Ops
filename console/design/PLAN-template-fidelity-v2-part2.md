# Plan: template fidelity upgrade (v2) — Phases 6 to 12

> Part 2 of 2. Part 1 (section 0 and Phases 0 to 5) is in
> `PLAN-template-fidelity-v2-part1.md`. Authored by an Opus Plan agent against
> `RESEARCH-local-service-visual-design.md` and `DECISIONS-template-fidelity-v2.md`.
> Decision numbers refer to the decisions file. Gap numbers (G1-G8) refer to the research doc.

---

## Phase 6: Page chrome — the sticky call bar and the scroll layer

**Goal:** the highest-ROI conversion element becomes a designed component, and the page gains a
smooth-scroll surface.
**Discharges:** G7; decisions 25, 26, 27, 28.

### Files created

**`C:\Users\Xander\Desktop\ops\jdd-ops\template\src\lib\StickyCallBar.tsx`** (NEW, `'use client'`)

Decision 27: this is on screen constantly and is the highest-ROI conversion element, so it gets
the most design attention of anything on the site.

- Mobile only (`lg:hidden`). It is noise on desktop where the nav already carries a tappable
  number (SPEC §4 requires the nav phone at every breakpoint, so a desktop duplicate is noise).
- Appears only after the hero has scrolled past: a single `IntersectionObserver` on `#top` (the
  id `HeroSplit` already sets on its `<section>`), not a scroll listener. Falls back to
  always-visible when `#top` is absent, so a hero variant without that id never hides the bar.
- Renders **the digits**, not the word "Call" (SPEC §4), at `text-lead font-extrabold`, with the
  assurance line beneath at `text-fine`. Minimum 56px tap target.
- `bg-accent text-accentFg`, `rounded-control` on the inner button, `shadow-slab` upward.
  **No gradient** (decision 30b). No opacity on any text sitting on the accent (SPEC §10a, and
  the existing `catalog-invariants` opacity lint).
- `urgent` tone only if `badge` is supplied and reads as availability ("24/7", "Open now");
  otherwise neutral.
- Adds `padding-bottom` to `<body>` equal to its own height while visible, via a sibling spacer
  div, so it can never cover the footer's last row.
- Entrance: a single CSS transform transition, gated on
  `window.matchMedia('(prefers-reduced-motion: reduce)')` — when it matches, the bar appears
  with no transition. Do **not** import `stillFor` here: it takes a `SkinId` and this element
  has no skin.
- `aria`: the `<a>` carries `aria-label={`Call ${phone}`}`; the bar is a
  `<div role="region" aria-label="Call us">`.

**`C:\Users\Xander\Desktop\ops\jdd-ops\template\src\lib\SmoothScroll.tsx`** (NEW, `'use client'`)

Decision 25. Renders nothing; a single `useEffect` that:
- returns immediately if `window.matchMedia('(prefers-reduced-motion: reduce)').matches` — Lenis
  is never constructed, not merely stopped;
- returns immediately if `window.self !== window.top` — **load-bearing**: the console preview
  runs inside `PreviewFrame`'s iframe, and a smooth-scroll hijack there would fight the studio's
  own scroll container. The preview pane freezes animation anyway (§0.4), so there is nothing to
  see and everything to break;
- otherwise dynamically `await import('lenis')`, constructs with
  `{ duration: 1.05, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)) }`, drives it from
  `requestAnimationFrame`, and destroys it in the cleanup.

Import it from the layout with `next/dynamic` and `ssr: false` so it is never in the first-paint
critical path. `PERF.md` and `template/src/lib/fonts.loader.ts` both document how expensive
blanket byte additions have been here; `lenis` is ~10KB gzipped and this is the only way it is
acceptable.

**Zero-dependency fallback, if `lenis` is rejected for bytes:** delete `SmoothScroll.tsx` and add
`html { scroll-behavior: smooth }` plus
`@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto } }` to
`template/src/styles/globals.css`. Note in the plan record which was chosen.

### Files modified

**`C:\Users\Xander\Desktop\ops\jdd-ops\template\package.json`** — add `"lenis": "^1.1.18"` to
`dependencies`. The export route's `mergePackageJson` (`console/src/lib/export.ts` line ~290)
unions new template deps into an existing client repo without dropping the client's own, so
existing repos pick it up on the next export.

**`C:\Users\Xander\Desktop\ops\jdd-ops\console\package.json`** — add the same `lenis` entry, only
so the console typechecks the dynamic import.

**`C:\Users\Xander\Desktop\ops\jdd-ops\template\src\app\layout.tsx`**
- `import StickyCallBar from '@/lib/StickyCallBar';`
- `const SmoothScroll = dynamic(() => import('@/lib/SmoothScroll'), { ssr: false });`
- Inside `<body>`, after `{children}` and before `<Analytics />`:
```tsx
<SmoothScroll />
<StickyCallBar
  phone={CONTENT.brand.phone}
  phoneHref={CONTENT.brand.phoneHref}
  assurance={CONTENT.hero.trust || null}
  badge={CONTENT.announcement || null}
/>
```
Guard both brand fields: render `null` from `StickyCallBar` when `phoneHref` is empty, so a client
mid-intake does not ship a dead `tel:` link.

**`C:\Users\Xander\Desktop\ops\jdd-ops\console\src\app\c\[slug]\build\PageStudio.tsx`**
The preview must show the bar or the operator cannot design it. Inside the `mode="flow"`
`PreviewFrame` (line ~234), after `editableNodes`, render `<StickyCallBar ... />` imported from
`@template/lib/StickyCallBar`. It will self-disable inside the iframe only for `SmoothScroll`,
not for the bar — the bar's `window.self !== window.top` check does not exist, by design. Its
`IntersectionObserver` works inside the iframe.

**`C:\Users\Xander\Desktop\ops\jdd-ops\console\tsconfig.json`** — add
`"../template/src/lib/StickyCallBar.tsx"` to `include`. The `../template/src/lib/**` content glob
added in Phase 1 is what makes its Tailwind classes generate; this is what makes tsc see it.

### Files modified: the motion-budget cleanup (decisions 26, 28)

**`C:\Users\Xander\Desktop\ops\jdd-ops\packages\ui\src\motion.ts`**
- Mark `parallaxY` `@deprecated` in its JSDoc with "Cut by decision 28 (ornamental). Retained so
  an already-exported client repo keeps compiling; `verifyCatalogImports` reads this module's
  exports, and removing a symbol a shipped component imports is exactly the `parallaxY` failure
  this file's history records. Do not use in new components."
- Keep `clipReveal`, `reveal`, `revealItem`, `revealStagger`, `stillFor`, `EASE`, `viewportOnce`
  unchanged.
- Add a header note: "**Motion budget is per PAGE, not per section** (decision 26): at most two
  sections on a page may own a signature moment, enforced by
  `console/test/page-rhythm.test.mjs`. Micro-reveals are free."

Then run the §0.3 `@jdd/ui` loop and tag **v1.0.4**.

**`C:\Users\Xander\Desktop\ops\jdd-ops\console\test\catalog-invariants.test.mjs`** — add
`no component uses the cut signature effects`: ban `parallaxY` and any `onMouseMove`-driven
CSS-variable cursor glow (`--mx`/`--my` set from a pointer handler) in the catalog. Grep first to
see which files currently use them; if `services/ServicesPanel.tsx` or `services/ServicesSpotlight`
patterns appear, strip them in this phase rather than deferring.

### Verification
```
cd /c/Users/Xander/Desktop/ops/jdd-ops/console  && npm run build && npm test
cd /c/Users/Xander/Desktop/ops/jdd-ops/template && npm run build
cat console/node_modules/@jdd/ui/package.json | grep '"version"'   # 1.0.4
```
Then a real-browser check, which the console preview cannot give you:
`cd template && npm run dev`, open `http://localhost:3000` at a 390px viewport, scroll past the
hero, confirm the bar slides in and the number dials. Set `prefers-reduced-motion: reduce` in
DevTools Rendering and confirm the bar appears instantly and the scroll is native.

**User looks at:** the sticky call bar on a phone-width window of the template dev server, and
the scroll feel.

### Out of scope
Making the call bar operator-configurable or skinnable. Lenis inside the console preview. Any
catalog component change beyond stripping cut effects.

---

## Phase 7: Catalog wave 1 — the archetypes DESIGN-LANGUAGE.md promised

**Goal:** make Phase 0's archetype table true.
**Discharges:** G5 (completion), G6 (partly); decisions 21, 22, 23, 28.

Transcribe from `console/design/foundation-v2/mockups-sections.html`. Every file follows
`studio/catalog/AUTHORING_CONTRACT.md` and its §10 checklist, uses Phase 1 tokens instead of
arbitrary values, and declares `archetype` + `signature`.

| New / changed file | archetype | signature | skins | notes |
|---|---|---|---|---|
| `console/src/components/catalog/services/ServicesShowcase.tsx` (new) | `editorial-index` | false | `[DEF, SOFT]` | Full-width numbered rows on hairline rules; image reveals on hover via CSS only. Numerals **neutral**, not accent (decision 10). Numbers come from `services.items[].n`. |
| `console/src/components/catalog/services/ServicesSpotlight.tsx` (new) | `stacked-panels` | false | `[SOFT, DEF, INV]` | Full-width horizontal panels, one column. **No cursor glow** (decision 28) — that was this component's entire identity in the old catalog and it is cut. Hierarchy from panel height variation and `display-3` vs `card-title`. |
| `console/src/components/catalog/work/WorkSpotlight.tsx` (new) | `feature-rail` | false | `[DEF, INV]` | Large feature panel + rail of `work.projects`; `useState` + `AnimatePresence` swap. Must `return null` when `work.hidden === true` and when `projects.length === 0`. |
| `console/src/components/catalog/work/WorkMasonry.tsx` (new) | `horizontal-pin` | **true** | `[DEF, SOFT]` | `position: sticky` section + a framer-motion `useScroll` horizontal transform. **No GSAP.** When `stillFor(skin, reduce)` is true, render as `overflow-x-auto` + `scroll-snap-type: x mandatory` and bind no scroll transform. The only `signature: true` component in wave 1. |
| `console/src/components/catalog/testimonials/TestimonialsMarquee.tsx` (new) | `marquee` | false | `[SOFT, DEF]` | A **drag/scroll-driven** rail: `overflow-x-auto`, `scroll-snap`, visible scroll affordance. **No `setInterval`, no autoplay** (SPEC §9 survives decision 21). |
| `console/src/components/catalog/work/RecentJobsGrid.tsx` (recompose) | `hero-first-grid` | false | unchanged `[DEF, INV]` | Recompose to a CSS grid whose first cell spans 2 rows and 2 cols. **Do not rename the file** and **do not change `meta.id`, `category` or `consumes`** — `CATALOG`, `SKINS`, `categories.tsx`, `PAGE_TEMPLATES` and two shipped client repos all key off the name. |

Resulting counts: services 5, work 4, testimonials 3 — matching Phase 0's reconciled note.

### Registration (per §0.5, for the five new files)
1. `CATALOG` in `console/src/lib/export.ts` line 43:
   `services: ['ServicesGrid','ServicesAccordion','ServicesPanel','ServicesShowcase','ServicesSpotlight']`,
   `work: ['RecentJobsGrid','BeforeAfter','WorkSpotlight','WorkMasonry']`,
   `testimonials: ['TestimonialsGrid','TestimonialsCarousel','TestimonialsMarquee']`.
2. `SKINS` in `packages/ui/src/skins.ts` — five new entries. Then the §0.3 loop, tag **v1.0.5**.
   Batch all five into this one release.
3. `categories.tsx` — five imports with their metas, five `VariantEntry` rows. No union changes
   (no new categories).
4. `PAGE_TEMPLATES` — Phase 9 places them; for now add each to at least one existing template so
   the studio shows them.

### Verification
```
cd /c/Users/Xander/Desktop/ops/jdd-ops/console && npm test && npm run build
```
`catalog-invariants` proves `CATALOG`/registry/`SKINS` agree, every `<img>` has width+height, no
gradients, no `grid-cols-3`, no archetype collisions. Then a real export: pick a template
containing each new component in the console and run Launch against a scratch slug — the export
route runs `npm install` + `npm run build` **inside the client repo**, which is the only thing
that proves the files are copy-paste portable.

**User looks at:** each new component in the console catalog picker, against the HVAC vertical,
compared side by side with its specimen in `mockups-sections.html`.

### Out of scope
`differentiators`, `stats`, page-header variants, `about`/`faq` third variants (Phase 8). Page
reordering (Phase 9).

---

## Phase 8: Catalog wave 2 — new categories and coverage

**Goal:** the two new section categories, the page-header archetypes, and 3-4 variants in every
major category.
**Discharges:** G4 (prep), G6 (completion); decisions 18, 19, 22, 23.

### The schema decision that keeps this cheap

**`differentiators` reads `about.pillars` (`{k,t,d}[]`) and `stats` reads `about.stats`
(`{n,l}[]`).** Both already exist in `@jdd/schema`'s `SiteContent`, are already generated by the
copywriter (`console/src/lib/copy-schema.ts` `CopyResult.about.pillars` / `.stats`), and are
already editable in the Brand drawer. **Therefore: no `@jdd/schema` change, no version bump, no
re-pin, no `copy-schema.ts` change, no `CopyWireframe.tsx` change, no `section-labels.ts`
change.** This honours `AUTHORING_CONTRACT.md` §0's rule that variety comes from design, never
from new data fields.

Both must `return null` on an empty array (§5 of the contract).

### Files created

| File | archetype | signature | skins |
|---|---|---|---|
| `console/src/components/catalog/differentiators/DifferentiatorsIndex.tsx` | `editorial-index` | false | `[DEF, SOFT]` |
| `console/src/components/catalog/differentiators/DifferentiatorsPanels.tsx` | `stacked-panels` | false | `[SOFT, DEF, INV]` |
| `console/src/components/catalog/differentiators/DifferentiatorsRail.tsx` | `inline-strip` | false | `[DEF, SOFT]` |
| `console/src/components/catalog/stats/StatsBand.tsx` | `count-up-centerpiece` | **true** | `[INV, DEF]` |
| `console/src/components/catalog/stats/StatsLedger.tsx` | `numbered-ledger` | false | `[DEF, SOFT]` |
| `console/src/components/catalog/pageHeader/PageHeaderEditorial.tsx` | `editorial-index` | false | none (skinless, like `PageHeaderSimple`) |
| `console/src/components/catalog/pageHeader/PageHeaderOverlap.tsx` | `overlap-split` | false | none |
| `console/src/components/catalog/pageHeader/PageHeaderMinimal.tsx` | `inline-strip` | false | none |
| `console/src/components/catalog/about/AboutSticky.tsx` | `sticky-swap` | false | `[DEF, SOFT]` |
| `console/src/components/catalog/faq/FaqIndex.tsx` | `editorial-index` | false | `[DEF, SOFT, INV]` |

`StatsBand` uses `@/lib/useCountUp` — which exists in **both** `console/src/lib/useCountUp.ts` and
`template/src/lib/useCountUp.ts`, so `verifyCatalogImports` passes. Confirm the two are in sync
before relying on it (`diff console/src/lib/useCountUp.ts template/src/lib/useCountUp.ts`).
Decision 18 explicitly ships count-up, overriding SPEC §9; Phase 0 already recorded that
amendment. Gate it on `stillFor(skin, reduce)` — when still, render the final value immediately.

The three new page headers take the same `{ data: PageHeaderContent; editPrefix?: string }` props
as `PageHeaderSimple` — read that file and match the signature exactly, because
`compose-page.tsx` line 40 and `wirePages`' `pageHeader` branch (`export.ts` line 626) both
construct them positionally by prop name.

### Registration (two new categories — the full §0.5 list)

- `console/src/lib/export.ts`: add `differentiators: [...]` and `stats: [...]` to `CATALOG`; add
  both ids to `BODY_SLOTS` (line 64) **between `trust` and `about`** for `differentiators` and
  after it for `stats`, matching the researched order.
- `console/src/app/c/[slug]/build/categories.tsx`: extend the `CategoryEntry['id']` union
  (line 52) with `'differentiators' | 'stats'`; extend `iconName` (line 54) with
  `'Lightning' | 'ChartBar'`; add two `CategoryEntry` objects; add the ten imports and variant
  rows. Check the icon name resolver wherever `iconName` is consumed and add the two new cases.
- `console/src/app/c/[slug]/build/page-order.ts`: `CANONICAL_ORDER` becomes
  `['nav','hero','trust','differentiators','services','work','stats','testimonials','faq','finalCta','contact','footer']`.
- `console/src/app/c/[slug]/build/nav-targets.ts`: no new anchors (neither category is a nav
  destination).
- `packages/ui/src/skins.ts`: the seven skinned new components. §0.3 loop, tag **v1.0.6**.
- Then: `grep -rn "'finalCta'" /c/Users/Xander/Desktop/ops/jdd-ops/console/src --include=*.ts --include=*.tsx`
  and resolve every hit not already covered. Known safe hits (no change needed):
  `copy-schema.ts`, `copy-brief/*`, `CopyWireframe.tsx`, `section-labels.ts` — all keyed by
  **content section**, not by catalog category.

### Verification
```
cd /c/Users/Xander/Desktop/ops/jdd-ops/console && npm test && npm run build
```
Then export a scratch client whose home template carries `differentiators` + `stats` and confirm
the client repo's own `npm run build` passes (this is what proves the new `BODY_SLOTS` ids wire
correctly through `wirePages`).

**User looks at:** the two new categories in the studio picker with three and two variants, and
all four page headers side by side against `mockups-hvac-subpages.html`.

### Out of scope
Any `@jdd/schema` change. A third nav/footer/seo variant (decision 22 caps chrome at two).
Process-steps and financing-strip sections — decision 18 considered and **did not select** them.

---

## Phase 9: Page structure — researched order, encoded rhythm, per-service pages

**Goal:** the default build stops omitting the trust layer, section rhythm stops being uniform,
and every service gets a page.
**Discharges:** G4; decisions 17, 19, 20, 24, 12, 30(d).

### 9a. Rhythm becomes a field on the section ref

**`console/src/lib/pages.ts`** (CLIENT-SAFE — no `node:fs`, no `server-only`, no `@/lib/export`):
```ts
/** Where a section sits in the page's vertical rhythm. Decided by the PAGE TEMPLATE, never by
 *  the component (decision 24), which is what makes decision 30d's non-uniform-padding ban
 *  enforceable at the only level that can see a whole page. Classes come from
 *  template/src/styles/rhythm.plugin.ts. */
export type SectionRhythm = 'bleed' | 'tight' | 'normal' | 'loose' | 'text';
export type SectionRef = { id?: string; categoryId: string; name: string; skin?: SkinId; rhythm?: SectionRhythm };
export const rhythmClass = (r?: SectionRhythm): string => (r ? `rh-${r}` : '');
```
Add to `validateComposition`: a page whose sections all share one rhythm throws
(`Page "<route>" uses a uniform section rhythm; decision 30d bans it.`), and a page with more
than one `skin === 'inverted'` throws (decision 12). Both run on the client, in the studio,
before an export request is built.

**`console/src/lib/export.ts`, `wirePages` (line 549)** — the `emit()` helper currently wraps a
section in a `sectionVars` div only when it carries a style. Extend it so a ref with a `rhythm`
also gets `rhythmClass(ref.rhythm)` on that wrapper, and so a ref with a rhythm but no style
still gets a `<div className="rh-loose">` wrapper. Keep the existing byte-identical output for a
ref with neither, so an unstyled legacy page's generated file does not change. Import
`rhythmClass` from `@/lib/pages` (already imported for `styleKeyFor`/`routePath`).

**`console/src/app/c/[slug]/build/PageStudio.tsx`, `SectionShell`** — apply
`rhythmClass(ref.rhythm)` to the inner `<div style={style}>` so the preview and the export agree.

**`console/test/page-rhythm.test.mjs`** — un-skip test 3 from Phase 4.

### 9b. The three home templates and the researched order

**`console/src/app/c/[slug]/build/page-templates.tsx`** — extend the `S()` helper to
`S(categoryId, name, rhythm?, skin?)` and replace the two home templates, adding a third. One
section per category, so the interim `homeLegacyView` flattening cannot lose one:

- **`home-standard`** — hero `HeroSplit` `bleed` → differentiators `DifferentiatorsIndex` `normal`
  → services `ServicesGrid` `loose` → trust `ServiceArea` `tight` → testimonials
  `TestimonialsGrid` `normal` → work `RecentJobsGrid` `bleed` → faq `FaqAccordion` `loose` →
  finalCta `FinalCtaBanner` `tight` + `skin: 'inverted'`
- **`home-bold`** — hero `HeroOverlap` `bleed` → stats `StatsBand` `tight` + `skin: 'inverted'` →
  differentiators `DifferentiatorsPanels` `loose` → services `ServicesShowcase` `normal` → trust
  `TrustReviewsAggregate` `tight` → work `WorkSpotlight` `bleed` → testimonials
  `TestimonialsMarquee` `normal` → finalCta `FinalCtaSplit` `loose`
- **`home-quiet`** (new) — hero `HeroFormFocus` `normal` → trust `TrustBadges` `tight` →
  differentiators `DifferentiatorsRail` `text` → services `ServicesSpotlight` `loose` →
  testimonials `TestimonialsCarousel` `normal` → faq `FaqIndex` `text` → contact `ContactSplit`
  `loose` + `skin: 'inverted'`

Each satisfies research §3's order (hero → differentiators → services → service areas → proof →
work → faq → contact), one inverted section, at most one `signature: true` component, and at
least three distinct rhythms with no three consecutive repeats.

Also add rhythms to the existing nine non-home templates, and swap `PageHeaderSimple` for a
different page-header archetype in the second template of each page type (decision 19's point is
that subpages stop opening identically). Add a third template per core page type using the
wave-1 and wave-2 components.

**`console/src/app/c/[slug]/build/nav-targets.ts`** — the anchor table predates multi-page
routing; confirm `navLinksFor` is what actually feeds `content.nav` (export route line 162) and
that the anchor table is only used for dangling-link detection. Add `differentiators` and `stats`
only if that detection needs them.

### 9c. One page per service (decision 20)

**`console/src/lib/pages.ts`:**
- Add `'service'` to `PageTypeId`.
- Widen `isValidRoute` to allow exactly one slash: `/^[a-z0-9-]+(\/[a-z0-9-]+)?$/` and keep the
  `RESERVED_ROUTES` check against the **first** segment. `routePath()` already produces
  `src/app/services/ac-repair/page.tsx` from `'services/ac-repair'` with no change, and
  `navHref()` already yields `/services/ac-repair`.
- Raise `MAX_PAGES` from 7 to **16** (4 core + up to 3 optional + up to 9 services) and update
  the error message.
- Add:
```ts
/** One page per service (decision 20). Routes are services/<slug of item.t>. navVisible is
 *  false: these are linked from the services section, not the top nav, which would otherwise
 *  overflow. Header copy is derived from the client's own service item, never invented. */
export function servicePageRoutes(items: { t: string }[]): string[]
```
using `slugify` from `console/src/lib/slugify.ts`.

**`console/src/app/c/[slug]/build/page-templates.tsx`:**
- `PAGE_META.service = { route: '', label: 'Service' }` — the route is per-instance, so
  `pageFromType('service')` must not be used; add `servicePageFrom(item, route)` instead and make
  `pageFromType` throw for `'service'` with a message pointing at it.
- Two templates: `service-standard` (pageHeader `PageHeaderOverlap` `bleed` → services
  `ServicesAccordion` `normal` → work `BeforeAfter` `loose` → faq `FaqStickyAside` `normal` →
  finalCta `FinalCtaBanner` `tight`) and `service-proof` (pageHeader `PageHeaderEditorial`
  `normal` → differentiators `DifferentiatorsIndex` `loose` → testimonials `TestimonialsGrid`
  `normal` → trust `ServiceArea` `tight` → contact `ContactInlineStrip` `tight`).
- Add `'service'` to neither `OPTIONAL_PAGE_TYPES` nor `CORE_ADD_PAGE_TYPES`; service pages are
  generated, not operator-added one at a time.

**Header copy without inventing values:** the export route must ensure
`content.subpages[route].header` exists for every service route, derived as
`{ eyebrow: item.tag, title: item.t, sub: item.d, cta: null }`. All four come from the client's
own `services.items[]`. Add this next to the existing "ensure `content.pageHeaders` covers every
subpage route (fill gaps, never invent)" step the multipage plan describes, in
`console/src/app/api/build/export/route.ts` after line 162.

**A generate-pages affordance** in `console/src/app/c/[slug]/build/PagesMenu.tsx`: one button,
"Generate a page for each service", that calls a new `onGenerateServicePages()` handler in
`BuildWizard.tsx` which appends `servicePageFrom(item, route)` for each
`effective.services.items`, skipping routes already present. Idempotent.

### 9d. The interim-bridge hazard you must check first

`PageStudio` still builds `legacy`/`exportEntries` via `homeLegacyView` for Launch and Deploy, and
`homeLegacyView` flattens to **one component per category** (last wins). Before changing any home
template, **read the `fetch` body in `console/src/app/c/[slug]/build/LaunchDialog.tsx` and
`DeployDialog.tsx`** and confirm both send `composition`. The export route prefers `composition`
when present (`route.ts` lines 116-118, 157, 262), so if both send it, `wirePages` runs and the
legacy flattening is cosmetic. **If either sends only `selections`, fix that before Phase 9
proceeds** — otherwise an eight-section home page silently exports as five.

### Verification
```
cd /c/Users/Xander/Desktop/ops/jdd-ops/console && npm test && npm run build
```
`page-rhythm.test.mjs` now enforces decisions 12, 26 and 30(d) across every template. Then export
a scratch client with `home-standard` + generated service pages and confirm: the client repo's
`npm run build` passes; `clients/<slug>/repo/src/app/services/<slug>/page.tsx` exists for each
service; each wraps its sections in `rh-*` divs; each subpage's header shows that service's own
title.

**User looks at:** the console preview of all three home templates, and the generated service
page files on disk.

### Out of scope
Any new component. A nav dropdown for service pages (`navVisible: false` is the decision).
Changing `MIN_PAGES`.

---

## Phase 10: The build-time image pipeline

**Goal:** fetch each image once at export, emit AVIF/WebP at several widths into `/public`, kill
the Unsplash hotlink, and enforce one ratio and one grade.
**Discharges:** G3 (partly); decisions 15, 16, 13.

### 10a. Apply the curated HVAC set

**`console/src/data/image-placeholders.ts`** — replace the four photo ids in the `hvac` entry's
`heroSlides`, `aboutFeature` and `serviceImages` with the curated ids from
`console/design/foundation-v2/photography.md`, and rewrite each `alt` against research §4's shot
list. Leave the other five verticals until their cycles. **Do not touch** `opts.includeWork`,
`KNOWN_PLACEHOLDER_URLS`, `isOwnPlaceholder`, `needsFill` or the `filled` reporting — that
provenance machinery is what decision 13 explicitly preserves, and `KNOWN_PLACEHOLDER_URLS` is
derived from the table so it updates itself.

### 10b. The pipeline

**`console/src/lib/image-pipeline.ts`** (NEW, server-only). `import 'server-only'` at the top; it
is only ever called from the export route.

```ts
export const RATIOS = { hero: 16/10, aboutFeature: 4/5, service: 3/2, work: 3/2, avatar: 1 } as const;
export const WIDTHS = [480, 768, 1024, 1536, 2048] as const;
export async function materializeImages(
  repoRoot: string, slug: string, content: SiteContent,
  step: (m: string) => void,
): Promise<{ content: SiteContent; localized: string[]; failed: string[] }>
```
Behaviour:
- Walk exactly the slots `fillImagePlaceholders` writes: `images.hero.portrait`,
  `images.hero.slides[].url`, `images.about.feature`, `services.items[].image.url`,
  `work.projects[].image.url`, `images.testimonials.avatars[]`, `images.footer.logoImage`. Each
  slot declares which `RATIOS` key it uses.
- For each absolute `http(s)` URL: `fetch` once, `sha256` the bytes, and for each width in
  `WIDTHS` not exceeding the source width, emit
  `clients/<slug>/repo/public/img/<hash>-<w>.webp` and `.avif`.
- **Crop:** `sharp(buf).resize(w, Math.round(w / ratio), { fit: 'cover', position: 'attention' })`.
  `attention` is sharp's saliency crop, which gives decision 15's focal crop with no per-image
  metadata to author.
- **Grade (one fixed recipe, decision 15):**
  `.modulate({ saturation: 0.88, brightness: 1.02 }).linear(1.04, -6).tint('#FFF8F0')` applied
  before the format encode, in that order, for **every** image. One recipe is what makes mixed
  sources read as one set.
- Rewrite the slot value to `/img/<hash>.webp` (the base, no width) and record
  `_meta.local_images: Record<originalUrl, '/img/<hash>'>`.
- **Never throw.** On any fetch or encode failure, leave the original URL in place, push it to
  `failed`, and `step()` a warning. A placeholder photo must never fail a deploy.
- Logo images (`images.footer.logoImage`) skip the crop and the grade — a logo must not be
  recoloured. Resize on the long edge only.

**`console/package.json`** — add `"sharp": "^0.33.5"` to **devDependencies**. The pipeline runs in
the console at export time; client repos only serve the emitted files, so they stay
dependency-free. Note this in the module header.

**`template/public/img/.gitkeep`** (NEW) — run
`ls /c/Users/Xander/Desktop/ops/jdd-ops/template/public` first; create the directory if it is
absent. `public/` is not in `TEMPLATE_OWNED_PREFIXES`, so a first export copies it and
`overwrite` leaves a client's own emitted images alone, which is correct.

**`packages/ui/src/img.ts`** — add a second entry to `HOSTS`' logic: before the URL parse, if
`url` starts with `/img/` and has no extension, return
``{ src: `${url}.webp`, srcSet: WIDTHS.map(w => `${url}-${w}.webp ${w}w`).join(', ') }``. Keep the
Unsplash branch and the "do not add a host on the assumption it supports `?w=`" warning
(decision 3). Update `WIDTHS` to match the pipeline's five. Then the §0.3 loop, tag **v1.0.7**.

Components should additionally emit `<picture>` with an AVIF `<source>`; since `responsiveImage`
returns a plain object, add a sibling
`export function responsivePicture(url): { avifSrcSet?: string; webpSrcSet?: string; src: string }`
rather than changing `responsiveImage`'s shape, which ~every component calls.

**`console/src/app/api/build/export/route.ts`** — call `materializeImages` inside
`withPlaceholders`' caller, **after** `resolveUploads` and **after** `fillImagePlaceholders`,
**before** `writeSiteContent`, for both the `content` branch (line 218) and the `vertical` branch
(line 219-224). Merge `localized`/`failed` into the existing `_meta` write alongside
`placeholder_images`. `step()` a line naming how many images were localized and how many were
left hotlinked.

### Verification
```
cd /c/Users/Xander/Desktop/ops/jdd-ops/console && npm install && npm test && npm run build
```
Then export a scratch HVAC client and check on disk:
```
ls /c/Users/Xander/Desktop/ops/jdd-ops/clients/<slug>/repo/public/img | head
grep -c 'images.unsplash.com' /c/Users/Xander/Desktop/ops/jdd-ops/clients/<slug>/repo/src/data/site.ts   # expect 0
grep -n 'local_images' /c/Users/Xander/Desktop/ops/jdd-ops/clients/<slug>/repo/src/data/site.ts
```
Then `cd clients/<slug>/repo && npm run build && npm start` and confirm in DevTools Network that
the hero serves a local `.avif` or `.webp` at a width appropriate to the viewport, and that no
request leaves for `images.unsplash.com`.

**User looks at:** the hero photograph in a real browser at phone and desktop width, the uniform
grade across hero / about / service / work images, and a Network panel with zero third-party
image requests.

### Out of scope
A go-live gate on stock photography (decision 13 explicitly declines one). AI-generated imagery
of any kind (decision 14). Re-curating the other five verticals.

---

## Phase 11: The HVAC vertical language, and the reference site

**Goal:** make decision 35's per-vertical layer a typed, thin, enforced thing, and look at a
finished HVAC site.
**Discharges:** decisions 35, 37, 38, 11, 31, 32; §0.6.

### 11a. The thin layer, typed

**`console/src/data/vertical-language.ts`** (NEW; client-safe, no `node:fs`):
```ts
/**
 * A vertical's design language: EXACTLY four axes (decision 35), layered over the one shared
 * foundation (decision 37). There is deliberately NO field here that can name a component or a
 * vertical-private page template. If a vertical ever needs one, the foundation is too thin and
 * the fix is to generalise that component into the shared catalog, not to widen this type.
 * See the Known tensions section of DECISIONS-template-fidelity-v2.md.
 */
export type VerticalLanguage = {
  pairingId: string;                                   // a FONT_PAIRINGS id
  palette: { accent: string; accentFg: string | null; bg: string; bgSoft: string; ink: string; inkSoft: string; rule: string };
  photography: { subjects: string[]; grade: 'house'; ratioBias: 'wide' | 'tall' | 'square' };
  rhythm: { homeTemplateId: string; proofSkin: SkinId };
};
export const VERTICAL_LANGUAGES: Record<string, VerticalLanguage>;
export function languageFor(id: VerticalId): VerticalLanguage;   // guarded, falls back to hvac
```
Populate **only** `hvac`, transcribed from
`console/design/foundation-v2/VERTICAL-LANGUAGE-hvac.md`: `pairingId: 'instrument'`, the
Phase 2/3 palette, `subjects` from `photography.md`, `grade: 'house'` (there is exactly one
grade, decision 15), `homeTemplateId: 'home-standard'`, `proofSkin: 'soft'`. Honour decision 11:
a sophisticated tone of the expected HVAC blue-plus-warm coding, not a saturated primary.

**`console/src/lib/verticals.ts`** — `presetFor(id)` composes the language onto the preset so the
two cannot disagree: merge `languageFor(id).palette` into `brand.palette` and
`pairingFor(language.pairingId)` into `brand.typography`. Keep the existing guarded-fallback
behaviour and the client-safe constraint.

**`console/test/vertical-language.test.mjs`** (NEW) — the §0.6 enforcement:
1. every `VERTICAL_LANGUAGES[v].pairingId` exists in `FONT_PAIRINGS`;
2. every `rhythm.homeTemplateId` exists in `PAGE_TEMPLATES` **and has `pageType === 'home'`**;
3. the set of template ids referenced across all verticals is a **subset** of `PAGE_TEMPLATES`
   ids, so no vertical can carry a private template;
4. every palette runs clean through the Phase 2 contrast assertions (reuse the helpers from
   `palette-contrast.test.mjs` rather than restating the maths);
5. `Object.keys(VERTICAL_LANGUAGES.hvac)` is exactly
   `['pairingId','palette','photography','rhythm']` — a structural assertion that fails the
   moment someone widens the type.

### 11b. The conversion checklist (decision 32)

**`console/design/CONVERSION-NON-NEGOTIABLES.md`** (NEW). Decision 32 is explicit that this is
**hand-checked at go-live, with no new build-time enforcement machinery.** Six items, each with
how to check it and which file owns it:

| # | Non-negotiable | How to check | Owner |
|---|---|---|---|
| 1 | Tap-to-call | every phone number is an `<a href={brand.phoneHref}>` | `nav/*`, `hero/*`, `StickyCallBar` |
| 2 | Sticky mobile call bar | visible at 390px after the hero scrolls past | `template/src/lib/StickyCallBar.tsx` |
| 3 | Named service area | `extensions.serviceArea` is non-empty and `trust/ServiceArea` is placed | intake, `page-templates.tsx` |
| 4 | Review aggregate above the fold | `extensions.reviewBadge` is non-null and the hero renders it **not** behind a breakpoint (SPEC §7) | intake, `hero/*` |
| 5 | License displayed | `brand.license` is non-null and the nav or footer renders it | intake, `nav/*`, `footer/*` |
| 6 | Form at six fields or fewer | `LeadForm` ships two, plus one optional message | `packages/ui/src/LeadForm.tsx` |

Add a line to `console/src/lib/go-live-content.ts`'s checklist pointing at this file, so it
surfaces in the operator's go-live flow rather than only on disk.

### 11c. The reference site (decision 31)

Build and look at a full HVAC site. **Check `console/src/lib/onboardingGate.ts`'s `lockedReason()`
first** — the export route calls it (line 155) and it will refuse a slug with no client record. If
a fresh `_ref_hvac` slug is refused, use the existing permanent `_e2e_test_growth` client instead
(it is the HVAC fixture decision 38 names) and **do not deploy it**, only export and build
locally.

```
# in the console UI: select the HVAC vertical, apply home-standard, generate service pages, Launch
cd /c/Users/Xander/Desktop/ops/jdd-ops/clients/<slug>/repo
npm run build
vercel deploy --yes
```
Then walk `CONVERSION-NON-NEGOTIABLES.md` against the preview URL by hand, at 390px and at
1440px. Tear down with `npm run teardown -- --slug <slug>` if a scratch slug was used.

**Decision 36 is absolute: Atlantic and Air Service are untouched.** They are `externalManaged`
starter shims, not built from this template. No redeploys, no re-exports, no `overwrite`.

### Verification
```
cd /c/Users/Xander/Desktop/ops/jdd-ops/console && npm test && npm run build
```
plus the deployed preview URL and a completed hand-check of the six items.

**User looks at:** the live Vercel preview of a complete HVAC site on a phone and on a desktop.
This is the real gate for the whole upgrade: does it look expensive, and does it still convert.

### Out of scope
The other five vertical languages — each is its own later cycle (decision 37), and each is a
Phase 5 mockup plus a `VERTICAL_LANGUAGES` entry plus a
`console/src/data/verticals/<id>.ts` palette and `image-placeholders.ts` curation. **No new
components.** If one appears to be needed, stop and escalate per §0.6.

---

## Phase 12: Intake demands the specifics (cross-repo)

**Goal:** the documented antidote to looking AI-made is specificity, and the no-inventing rule
means it must come from intake.
**Discharges:** decision 29; research §6 item 6.

Last because it is the only phase that spans three repos and bumps the pinned schema. Everything
before it is self-contained in `jdd-ops`.

### 12a. What already exists (do not re-add)

- `brand.license` — exists, nullable. Currently marked "no longer asked" in
  `jdd-schema/src/brand-intake.ts`.
- `brand.established` — exists, nullable. Same note.
- `extensions.serviceArea?: string[] | null` — **exists in `dist/site.d.ts`**, so a client site
  receives it today. The intake field `serviceArea` exists and maps at `brand-intake.ts` line 290.
- Equipment brands carried → **`trust.logos: string[]` with `trust.label`**. The HVAC preset
  already sets `label: "Certified by"` with an empty list and a comment saying logos must come
  from the client. Relabel to "Brands we install" in the HVAC preset and map intake's existing
  `notableClients`/`certifications` plus a new field into it. No schema change for this one.
- Response-time commitment → `hero.frictionReducers[]` and `hero.heroBullets[]` already carry it
  ("Same-day availability", "24/7"). A structured field is still worth having for the stats band
  and the sticky bar's assurance line.

### 12b. What needs the bump

`@jdd/schema` **v1.20.0**, in `jdd-schema/src/site.ts` `ExtensionsContent` (all optional and
nullable, so no existing reader breaks):
```ts
ownerName?: string | null;      // for the About page and the owner photo caption
brandsCarried?: string[] | null;
responseTime?: string | null;   // e.g. "under 60 minutes", client's own words
```
and in `jdd-schema/src/brand-intake.ts` `BrandIntakeSubmission`: `ownerName?: string`,
`brandsCarried?: string` (comma/newline list, use the existing `splitList`),
`responseTime?: string`. Move `established`, `license` and `serviceArea` back to **asked**, and in
`buildScaffold`'s flags list add every one of the six that is unsupplied to `missing_fields` —
which is the whole mechanism by which the no-inventing rule becomes visible in the console.

Then the §0.3 `@jdd/schema` loop: `npm run build` (rebuilds `dist`, the only thing consumers
read), commit, tag `v1.20.0`, push, re-pin **all three** consumers with an explicit
`npm install "github:…#v1.20.0"`, and `cd console && npm run check-schema` until it prints
"pinned and installed consistently at v1.20.0".

**Verify against `dist`, not `src`:**
`grep -n "ownerName\|brandsCarried\|responseTime" /c/Users/Xander/Desktop/ops/jdd-schema/dist/site.d.ts`.

### 12c. jdd-ops side

- `console/src/lib/intake-path-map.ts` — add the three new form paths to `FORM_PATH_MAP`
  (`ownerName` → `extensions.ownerName`, `brandsCarried` → `trust.logos`, `responseTime` →
  `extensions.responseTime`) and remove nothing. Add a
  `console/test/intake-path-map.test.mjs` case for each (the file already exists).
- `console/src/lib/field-labels.ts` — add the three to `KEY_FIELDS` so they appear in the curated
  "All fields" section.
- `console/src/data/site.ts` and `console/src/data/verticals/hvac.ts` — add the three
  `extensions` keys as `null`. **Never a sample value.**
- `console/src/lib/copy-brief/facts.ts` — add the three to the facts the copywriter is allowed to
  use and forbidden to invent. Read the file first; it is the place that already enforces "only
  ever populated when grounded in website notes or operator details".
- The components that read them: `about/AboutStory` and `about/AboutSticky` (owner name, guarded),
  `trust/TrustBadges` (brands carried, guarded, `return null` when empty),
  `template/src/lib/StickyCallBar.tsx` (`responseTime` as the assurance line, falling back to
  `hero.trust`). All guarded per `AUTHORING_CONTRACT.md` §5.

### 12d. Agency repo (separate task, separate gate)

The onboarding form lives at `C:\Users\Xander\Desktop\ops\juneau-digital-designs`. **The planner
did not inspect that repo**, so locate the form before editing:
`grep -rln "serviceArea\|notableClients" --include=*.tsx <that repo>/src`. Add six inputs (owner
name, license number, year established, named towns, brands carried, response-time commitment),
each clearly marked as the thing that stops the site looking generic. Then `npm run build` in that
repo as its own gate.

### Verification
```
cd /c/Users/Xander/Desktop/ops/jdd-schema && npm test && npm run build
cd /c/Users/Xander/Desktop/ops/jdd-ops/console && npm run check-schema && npm test && npm run build
cd /c/Users/Xander/Desktop/ops/jdd-ops && node onboard.js --schema clients/_e2e_test_growth/site.ts --dry-run   # exit 0
cd /c/Users/Xander/Desktop/ops/juneau-digital-designs && npm run build
```
**User looks at:** the onboarding form's six new fields, and the console's Intake checklist
flagging each one that a client leaves blank.

### Out of scope
Generating any of the six from a model. Making any of them required (a new business genuinely has
no `established`, and the honest outcome is a flagged blank, not an invention).

---

## Dependency order and what can run in parallel

```
P0 (docs) ──┬─> P1 (tokens) ──> P2 (palette) ──> P3 (type) ──┐
            └─> P4 (archetype meta + lints) ─────────────────┤
                                                             v
                                                      P5 (HVAC mockups)  <- USER GATE
                                                             │
                                      ┌──────────────────────┼──────────────────────┐
                                      v                      v                      v
                              P6 (chrome)            P7 (catalog w1)         P10 (image pipeline)
                                      │                      │                      │
                                      │                      v                      │
                                      │              P8 (catalog w2)                │
                                      │                      │                      │
                                      └──────────────────────┼──────────────────────┘
                                                             v
                                                      P9 (page structure)
                                                             │
                                                             v
                                           P11 (HVAC language + ref site)  <- USER GATE
                                                             │
                                                             v
                                                      P12 (intake, cross-repo)
```

P4 is independent of P1-P3 and can run alongside them. P10 is independent of P7/P8 and can run
alongside them. Everything after P5 depends on the user signing off the mockups. P12 is last
because it is the only phase that bumps the pinned schema across three repos.

`@jdd/ui` tag sequence, one release per phase that touches `packages/ui/src`: **v1.0.3** (P2,
palette warmth + remove the unpublished `sectionVars`), **v1.0.4** (P6, motion deprecations),
**v1.0.5** (P7, five `SKINS` entries), **v1.0.6** (P8, seven `SKINS` entries), **v1.0.7** (P10,
`img.ts` local-asset branch). Re-pin console **and** template each time, with an explicit tagged
`npm install`.

---

## Critical files for implementation

- `C:\Users\Xander\Desktop\ops\jdd-ops\template\tailwind.config.ts` — the exported token world;
  Phase 1's whole purpose, and the file that makes preview and export agree once it and
  `console/tailwind.config.ts` both import `template/src/styles/tokens.ts`
- `C:\Users\Xander\Desktop\ops\jdd-ops\packages\ui\src\palette.ts` — every derived token
  (`--accent-text` AA loop, `urgentTone`, `--ink-panel`, `--on-ink`) shifts under decision 9;
  carries two hardcoded cool defaults (`readableOn`'s `#0f1b2d`, `accentText`'s `#000000`) that
  must go warm, and is gated by `console\test\palette-contrast.test.mjs`
- `C:\Users\Xander\Desktop\ops\jdd-ops\console\src\lib\export.ts` — `CATALOG` (line 43) is the
  server-side allowlist, `BODY_SLOTS` (line 64) gates new categories, `TEMPLATE_OWNED_PREFIXES`
  (line 143) decides what `overwrite` refreshes, `verifyCatalogImports` (line 370) is the drift
  gate, and `wirePages` (line 549) is where decision 24's rhythm wrapper is emitted
- `C:\Users\Xander\Desktop\ops\jdd-ops\console\src\app\c\[slug]\build\categories.tsx` — the studio
  registry; every new component and both new categories land here, including the `CategoryEntry`
  `id` and `iconName` unions
- `C:\Users\Xander\Desktop\ops\jdd-ops\console\test\catalog-invariants.test.mjs` — where the
  archetype-collision lint (decision 23) and the four hard bans (decision 30 a-c) run, and the one
  test that proves `CATALOG`, the studio registry and `SKINS` still agree
- `C:\Users\Xander\Desktop\ops\jdd-ops\console\src\app\c\[slug]\build\page-templates.tsx` —
  decisions 17, 19, 20 and 24 all land here, and it is what
  `console\test\page-rhythm.test.mjs` reads to enforce decisions 12, 26 and 30(d)
