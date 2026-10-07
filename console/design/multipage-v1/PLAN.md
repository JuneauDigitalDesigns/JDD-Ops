# Multi-Page Sites — Implementation Plan (v1)

**Author:** Opus · **Executor:** Sonnet · **Approach:** A (page templates are *internal
compositions of the existing section catalog*; the section catalog stays as the engine, the
section-by-section picker is retired from the operator UI).

This document is the single source of truth for the build. Execute phases **in order**. Each
phase ends with an **Acceptance check** that must pass before starting the next. Do not skip,
reorder, or "improve" beyond what is written. If reality contradicts this plan, **stop and
report** rather than improvising.

---

## 0. Goal & non-goals

**Goal.** Turn the console's single-page builder into a multi-page builder that produces a
**default 4-page site** (Home, Services, About, Contact) with an **optional 5th page**, where
the operator picks **one of up to two page templates per page** instead of assembling sections
one category at a time. Keep it as maintainable as the current one-page flow by **reusing the
existing section components, content model, and export pipeline** — a "page template" is just a
named, ordered list of existing section variants.

**Subpage headers are IN scope for v1.** Every non-home page opens with a lightweight page
header (eyebrow + page title + one-line intro + optional CTA/image), rendered by a **new
`pageHeader` catalog category** with 2 variants. Home is untouched: it keeps its existing
conversion hero (`CONTENT.hero`). Page-header copy is real body content, so it lives in
`site.ts` (see §3), not baked into generated files.

**Non-goals (v1).**
- No other new section components beyond `pageHeader`.
- No blog/CMS, no dynamic routes. Pages are static routes under `src/app/<route>/page.tsx`.
- No per-page JSON-LD (home keeps its rich structured data; subpages get literal title/desc/
  canonical only — §4b).

**Product decisions already locked (do not re-litigate):**
- Catalog is of **pages**, not sections; **up to 2 templates per page type**.
- Default pages: **Home, Services, About, Contact**. **Reviews/Testimonials and Work/Gallery
  are homepage *sections*, not their own pages.**
- **1 optional extra page** allowed; page set is **data-driven, 3–7 pages, default 4**.
- The per-section operator picker is **retired from the default flow** (kept only behind an
  optional "Advanced" affordance — §6).

**Guiding rule for where content goes** (used throughout): *client-facing body copy belongs in
`site.ts` (editable, single source of truth); build/meta config may be baked into generated
files.* Page-header text → schema. Per-page SEO tags → baked.

---

## 1. Guardrails (read before touching anything)

These come from `jdd-ops/CLAUDE.md` and hard-won project lessons. Violating them silently ships
broken client sites.

1. **Never invent client values.** Missing content stays in `_meta.missing_fields`. Page-header
   *titles* are structural labels ("Our Services", "About <brand>") and are allowed; page-header
   *facts* (subtext pulled from real copy) must come from existing content or be left empty.
2. **`@jdd/schema` is mirrored — and this plan DOES change it once (§3).**
   `ops/jdd-schema/src/site.ts` (the interfaces) is duplicated as text in
   `ops/jdd-schema/src/site-types-source.ts` (`SITE_TYPES_SOURCE`, inlined verbatim into every
   generated client `site.ts`). Any schema edit must update **all of**: `src/site.ts`, the
   matching text in `site-types-source.ts`, the zod object that parses it, and then **rebuild
   `dist/`** (`npm run build` in `ops/jdd-schema`) — consumers import from `dist/`, not `src/`.
   Zod **strips unknown keys**, so a field not declared in the zod object is silently dropped on
   read. The §3 field is **optional**, so existing clients without it read `undefined` and stay
   valid. Do §3 as one atomic commit; verify a round-trip parse keeps `pageHeaders`.
3. **Windows CRLF.** `ops/jdd-ops/template/src/app/page.tsx` is CRLF. Regexes that match it use
   `\r?\n` (see existing `wirePage`). Preserve that.
4. **Never round-trip source files through PowerShell `Get-Content`/`Set-Content`** — it produces
   UTF-8 mojibake `tsc` won't catch. Use the Edit/Write tools or Node `fs`.
5. **After every change in a client repo, `npm run build` and fix all errors.** The export flow
   already does this; keep it.
6. **Do not `next build` over a running dev server**, and do not use `next dev --turbo` on the
   console (Turbopack breaks `intake.ts` client-schema loading). Use the normal dev server.
7. **No em-dashes in client-facing copy** (page-header copy, generated SEO strings). Use comma/
   colon/period. (This plan's own prose is exempt; generated *site* strings are not.)
8. The exporter's `CATALOG` allowlist in `src/lib/export.ts` is the **security boundary** against
   path traversal. `pageHeader` and its variants must be added to it (§3), or export refuses them.

---

## 2. Core data model (the contract everything else builds on)

Add a new module `src/lib/pages.ts` in the console. This is the vocabulary the registry, the UI,
the draft format, and the exporter all share.

```ts
import type { SkinId } from '@/lib/skins';

/** One placed section inside a page — a reference into the existing section CATALOG. */
export type SectionRef = {
  categoryId: string;   // must be a key of CATALOG in lib/export.ts (incl. new 'pageHeader')
  name: string;         // must be a member of CATALOG[categoryId] (e.g. 'HeroSplit','PageHeaderSimple')
  skin?: SkinId;
};

/** The stable identity of a kind of page. Drives defaults, nav label, and route. */
export type PageTypeId =
  | 'home' | 'services' | 'about' | 'contact'   // the 4 defaults
  | 'reviews' | 'gallery' | 'areas' | 'faq';    // optional-5th candidates

/** A page template = an ordered list of BODY sections (NO nav/footer/seo — those are chrome).
 *  Non-home templates MUST begin with a 'pageHeader' section. */
export type PageTemplate = {
  id: string;             // globally unique, kebab: 'home-standard','services-standard'
  pageType: PageTypeId;
  label: string;          // operator-facing: 'Home — Standard'
  sections: SectionRef[]; // ordered; body sections only
};

/** A page as composed for one client. Editable copy of a template plus routing + SEO. */
export type PageInstance = {
  route: string;          // '' for home; 'services','about','contact', or a custom slug
  pageType: PageTypeId;
  label: string;          // nav label, e.g. 'Services'
  templateId: string;     // provenance; which template seeded this page
  navVisible: boolean;    // appears in site nav
  seo: { title: string; description: string; canonical: string };
  sections: SectionRef[]; // resolved from template, then operator-editable
};

/** The whole site's composition — replaces the old flat Selections+order+skins tri:
 *  nav & footer are chosen ONCE (site chrome); everything else is per page. */
export type SiteComposition = {
  chrome: { nav: SectionRef; footer: SectionRef };
  pages: PageInstance[];  // pages[0] MUST be the home page (route '')
};
```

**Route rules** (exported helpers in `pages.ts`):
- `routePath(route)`: `''` → `src/app/page.tsx`; `'services'` → `src/app/services/page.tsx`.
- `navHref(route)`: `''` → `'/'`; `'services'` → `'/services'`.
- Custom route slugs are lowercase URL slugs (`/^[a-z0-9-]+$/`); reserve `api`, `_next`; reject
  collisions with an existing page's route.

**Constraints (`validateComposition(comp)` helper, throw on violation):**
- 3 ≤ `pages.length` ≤ 7; `pages[0].route === ''`.
- Every `SectionRef` (chrome + all pages) passes the existing `validateEntries` allowlist rules.
- Route uniqueness across pages.
- `chrome.nav.categoryId === 'nav'`, `chrome.footer.categoryId === 'footer'`.
- Home page's sections MUST NOT contain a `pageHeader`; every non-home page's first section MUST
  be a `pageHeader`.

---

## 3. `pageHeader` category + schema change (do this as one contained sub-project)

Subpage headers carry real, editable copy, so header content lives in `SiteContent`.

### 3a. Schema (`ops/jdd-schema`) — the single mirrored change in this plan
Add, following guardrail §1.2 (src + `site-types-source` + zod + rebuild `dist/`):

```ts
export interface PageHeaderContent {
  eyebrow: string;                                 // small kicker; '' to omit
  title: string;                                   // page H1
  sub: string;                                     // one-line intro; '' to omit
  cta: { label: string; href: string } | null;    // null to omit the button
  image?: { url: string; alt: string } | null;     // optional; used by PageHeaderImage
}

// on SiteContent, add (OPTIONAL — undefined for legacy single-page clients):
pageHeaders?: Record<string, PageHeaderContent>;   // keyed by route: 'services','about','contact',…
                                                    // NO 'home'/'' entry — home uses `hero`.
```

Bump the schema version comment; add `PageHeaderContent` to the zod object with the same
optionality; confirm a parse→serialize round-trip preserves a populated `pageHeaders`.

### 3b. Components (`src/components/catalog/pageHeader/`)
Two variants, each a server component that takes an explicit `data: PageHeaderContent` prop plus
optional `skin` (mirror the existing catalog component conventions — export a `meta` with
`id`/`label`, register skins in `@jdd/ui/skins`):
- `PageHeaderSimple` — centered eyebrow/title/sub/cta, no image; renders `id="page-header"`.
- `PageHeaderImage` — split or background-image layout using `data.image`.

They read from the `data` prop, **not** a global `CONTENT` import (they must render different copy
per route). `data.cta` null → omit button; empty `sub`/`eyebrow` → omit that line; missing
`image` → `PageHeaderImage` falls back to a solid `bg-bgSoft` band (never a broken `<img>`).

### 3c. Wire into the three registries (keep them in lockstep — see the note in `export.ts`)
- `CATALOG` in `src/lib/export.ts`: add `pageHeader: ['PageHeaderSimple','PageHeaderImage']`, and
  add `'pageHeader'` to `BODY_SLOTS`.
- Skins registry (`@jdd/ui/skins`): add entries for both variants.
- `categories.tsx`: add a `pageHeader` `CategoryEntry` (icon e.g. `'Article'`), whose `render`
  receives the **active page's** header slice (see §6 preview note).

**Acceptance check (Phase 3):** `ops/jdd-schema` builds; a fixture `SiteContent` with
`pageHeaders` survives zod parse and is present in the emitted `SITE_TYPES_SOURCE`-based client
`site.ts`; both `pageHeader` components render in isolation for a sample `data` (with and without
image/cta/sub).

---

## 4. Export pipeline changes (`src/lib/export.ts` + `src/app/api/build/export/route.ts`)

Highest-risk phase. Keep the existing single-page functions working; add the multi-page path
alongside, then switch the route to it.

### 4a. `placeComponents` — dedupe across pages
Change the **caller** to pass the **de-duplicated union** of every `SectionRef` across `chrome` +
all `pages` (by `categoryId+name`). `placeComponents` itself is unchanged (one file per unique
entry). Add:

```ts
export function collectSectionRefs(comp: SiteComposition): Entry[] // unique by categoryId+name
```

The home SEO variant is included in the union as an `Entry` with `categoryId: 'seo'` (placed as
today). `pageHeader` variants are placed like any other section file.

### 4b. `wirePages` — new function, replaces `wirePage` at the route level
Add `wirePages(repoRoot, slug, comp: SiteComposition): void`. For each `PageInstance`:

1. Path via `routePath(page.route)`; `mkdirSync(dirname, {recursive:true})`.
2. Build the file from an **in-code skeleton** (not from `template/page.tsx`, since there are now
   N routes):

```tsx
import type { Metadata } from 'next';
import { CONTENT } from '@/data/site';            // needed only when a pageHeader is present
import Nav from '@/components/catalog/nav/<NavName>';
import Footer from '@/components/catalog/footer/<FooterName>';
import <Name> from '@/components/catalog/<categoryId>/<Name>';   // one per page.sections entry

// HOME ONLY: emit the SEO re-export exactly as today (keeps LocalBusiness JSON-LD):
//   export { generateMetadata } from '@/components/catalog/seo/<SeoName>';
// SUBPAGES: literal metadata from page.seo:
export const metadata: Metadata = {
  title: <JSON.stringify(page.seo.title)>,
  description: <JSON.stringify(page.seo.description)>,
  alternates: { canonical: <JSON.stringify(page.seo.canonical)> },
};

export default function Page() {
  return (
    <main className="font-sans text-ink">
      <Nav />
      {/* section lines, in page.sections order */}
      <Footer />
    </main>
  );
}
```

   **Section line emission rules:**
   - `pageHeader` sections: `<Name data={CONTENT.pageHeaders[<JSON route>]}${skin} />` — the route
     is `page.route`; this reads the editable slice from `site.ts`. (Home never has a pageHeader,
     so `CONTENT.pageHeaders` is only referenced on subpages.)
   - all other sections: `<Name${skin} />` (component imports its own `CONTENT`, as today).
   - `skin` baked **only** when `supportsSkin(name)` (reuse the exact guard from current
     `wirePage`; components lacking a `skin` prop fail the client build on an excess prop).
   - Drop the top-level `import { CONTENT }` line for pages that contain **no** `pageHeader`
     (avoid the unused-import build error — mirror the existing `wirePage` CONTENT-strip logic).
3. Home → `src/app/page.tsx`. No `@studio:*` anchors in generated files (the generator is
   idempotent by full regeneration).

**Stale-route cleanup:** persist the generated route list at
`clients/<slug>/repo/.studio-pages.json`. On each export, delete any previously-generated
`src/app/<route>/page.tsx` (and now-empty route dir) not present in the new composition.

### 4c. Keep `wirePage` (single-page) as a thin wrapper
Reimplement `wirePage(repoRoot, slug, entries)` to lift a one-page `SiteComposition` (home only;
nav/footer moved from `entries` into `chrome`; `seo` entry preserved) and delegate to
`wirePages`. A home-only site must stay structurally equivalent to today's output.

### 4d. Export route (`api/build/export/route.ts`)
- Accept new body field `composition?: SiteComposition` (keep `selections?: Entry[]` for
  backward compat).
- If `composition` present: `validateComposition` → `collectSectionRefs` → `validateEntries` →
  set `content.nav` (§5) and ensure `content.pageHeaders` covers every subpage route (fill gaps
  via §7, never invent) → `placeComponents(union)` → `wirePages` → `writeSiteContent`. Else fall
  back to the existing single-page path unchanged.
- `verifyCatalogImports` runs over the **union** of placed files (unchanged logic).

**Acceptance check (Phase 4):** A hand-written 4-page `composition` fixture (with `pageHeaders`)
posted to the export route against a scratch slug builds clean (`npm run build`); every subpage
opens with its `PageHeader` showing the correct per-route title from `site.ts`, followed by its
sections, wrapped in Nav/Footer. A home-only composition produces output structurally identical
to the pre-change single-page export (diff the body). Editing `pageHeaders.services.title` in the
exported `site.ts` and rebuilding changes only the Services header (proves it is data-driven).

---

## 5. Nav → route links (`nav-targets.ts` + content)

Today nav is in-page anchors (`#services`). Multi-page nav points at **routes**.

1. **`src/app/c/[slug]/build/nav-targets.ts`:** generalize from a fixed anchor table to
   `navLinksFor(comp): NavItem[]` = for each `navVisible` page, `{ label: page.label, href:
   navHref(page.route) }`, home first. Redefine `isDanglingLink`'s "known target" as "a route in
   `comp.pages`". Update the doc comment.
2. **Nav content:** before `writeSiteContent`, set `content.nav = navLinksFor(comp)`. Generated
   routing, not client-authored copy — does not violate the no-invent rule.
3. **Nav components:** confirm `NavMinimal`/`NavEmergencyBar` render `CONTENT.nav` hrefs as plain
   `<a href>`. If either hard-codes smooth-scroll to `#id`, gate that to same-page `#` hrefs only.
   Read both; change only if needed.

**Acceptance check (Phase 5):** In the exported repo, nav on every page links to `/`,
`/services`, `/about`, `/contact`, and navigation works across real routes.

---

## 6. Builder UI — page picker replaces section picker

Files: `src/app/c/[slug]/build/` (`BuildWizard.tsx`, `StudioStep.tsx`, `categories.tsx`,
`CatalogOverlay.tsx`, `ComponentCard.tsx`, `page-order.ts`).

**Keep as engine (do NOT delete):** `categories.tsx` (variant registry + skins + preview
`render`), all `src/components/catalog/**`, `CATALOG` in `export.ts`. Page-template previews are
composed by rendering each template's `SectionRef`s through the existing `categories.tsx`
`render(skin)` functions.

**New registry:** `src/app/c/[slug]/build/page-templates.tsx` exporting `PAGE_TEMPLATES:
PageTemplate[]` and helpers `templatesFor(pageType)`, `defaultCompositionFor(plan, vertical)`.
Seed (build these first; non-home templates start with a `pageHeader`):

- `home-standard`: hero `HeroSplit` · trust `TrustBadges` · about `AboutFeature` · services
  `ServicesGrid` · work `RecentJobsGrid` · testimonials `TestimonialsGrid` · finalCta
  `FinalCtaBanner`
- `home-bold`: hero `HeroOverlap` · trust `TrustReviewsAggregate` · services `ServicesPanel` ·
  work `BeforeAfter` · testimonials `TestimonialsCarousel` · faq `FaqAccordion` · finalCta
  `FinalCtaSplit`
- `services-standard`: **pageHeader `PageHeaderSimple`** · services `ServicesGrid` · faq
  `FaqAccordion` · finalCta `FinalCtaBanner`
- `about-standard`: **pageHeader `PageHeaderImage`** · about `AboutStory` · trust `ServiceArea` ·
  testimonials `TestimonialsGrid` · finalCta `FinalCtaSimple`
- `contact-standard`: **pageHeader `PageHeaderSimple`** · contact `ContactSplit` · faq
  `FaqStickyAside` · finalCta `FinalCtaBanner`
- Optional-5th seeds (one template each): `reviews-standard` (pageHeader · testimonials
  `TestimonialsGrid` · trust `TrustReviewsAggregate` · finalCta), `gallery-standard` (pageHeader ·
  work `BeforeAfter` · finalCta), `areas-standard` (pageHeader · trust `ServiceArea` · finalCta).
  *(Plan gating: `defaultCompositionFor` picks phone/email finalCta by plan exactly as
  `categories.tsx` `forPlan` does today.)*

**New UX (StudioStep becomes a two-level view):**
- **Left rail: Pages.** Lists `comp.pages`. Controls: add optional page (pick a `PageTypeId` from
  the 5th-candidate set → seed from its default template), remove optional page, rename (nav
  label), toggle `navVisible`, reorder (home pinned first).
- **Stage: the selected page.** Shows **template cards** (up to 2) for that page's `pageType`;
  picking one sets `page.sections`. Live preview composes the sections via `categories.tsx`
  renders (reuse `PreviewFrame`). For the `pageHeader` section, the preview render is fed the
  active page's slice `effective.pageHeaders?.[page.route]` (fallback to a placeholder header from
  the page label when absent) — extend the preview composer to pass this `data`.
- **Site style** panel: nav + footer + home SEO variant chosen once (reuse existing catalog cards
  for `nav`/`footer`/`seo` only).
- **Advanced (optional, collapsed):** "Customize sections" disclosure revealing the old
  per-category swap scoped to the current page (reuse `CatalogOverlay`/`ComponentCard`). Default
  flow must not require it. May ship read-only first.

**State:** replace `Selections`/`SkinSelections`/`order` with a single `composition:
SiteComposition` (+ existing undo stack — each mutation checkpoints). From `page-order.ts` keep
only helpers the section-reorder Advanced view still needs; template selection supersedes
`reconcileOrder`.

**Export call:** wizard POSTs `{ slug, composition, content, deploy?, commitMessage? }`.

**Acceptance check (Phase 6):** From a fresh client: land on the 4-page default; switch Home
between `home-standard`/`home-bold` with live preview; add then remove an optional Reviews page;
edit a nav label; see each subpage preview open with its page header; export → the Phase-4 repo.
No per-section picker appears in the default flow.

---

## 7. Content sourcing & onboarding (light touch)

Sections read the **shared** `SiteContent` namespaces regardless of page, so **no new intake
fields are required for section content.** Generated additions, all in
`src/app/api/build/generate-copy/route.ts`, driven off the composition:

1. **`pageHeaders` per subpage route.** Structural title + intro pulled from existing content
   (never fabricated facts):
   - services → `{ eyebrow: "What we do", title: "Our Services", sub: services.sub, cta:
     { label: finalCta.cta || "Get a quote", href: "/contact" } }`
   - about → `{ title: "About " + brand.name, sub: firstSentence(about.body), cta: null }`
   - contact → `{ title: "Get in Touch", sub: brand.short, cta: { label: "Call " + brand.phone,
     href: brand.phoneHref } }`
   - reviews → `title: "What our customers say"`; gallery → `title: "Our Work"`; areas →
     `title: "Areas We Serve"`.
   Any input that is empty → leave that header field empty and add the dotted path to
   `_meta.missing_fields`. Titles are structural labels, not client facts, so they are allowed.
2. **Per-page SEO defaults** (`PageInstance.seo`, baked per §4b): Home from existing `seo.*`;
   Services `"<Services> in <city> | <brand.name>"` (desc `services.sub`); About `"About
   <brand.name>"` (desc first sentence of `about.body`); Contact `"Contact <brand.name> —
   <city>"`; `canonical = "<siteBaseUrl>/<route>"`. Missing inputs → empty + `missing_fields`.
3. **Nav labels & page set** default from `defaultCompositionFor`; operator adjusts in the
   builder. Onboarding form needs **no new questions** for v1.

**Acceptance check (Phase 7):** `generate-copy` on a real client draft fills every subpage's
`pageHeaders` entry and `seo`, with city/service-aware strings, lists gaps in `missing_fields`,
and produces no em-dashes.

---

## 8. Draft format, load, and migration

- **Draft shape** (`api/build/save-draft`, `save-brief`, `load-client`): persist `composition`.
  On load, if a draft/older client has the **legacy** shape (`selections`+`order`+`skins`, single
  page), run `liftLegacyToComposition(legacy)`: home page = ordered body entries; `chrome` = the
  legacy `nav`/`footer` entries; home SEO = the legacy `seo` entry; `seo`/`nav`/`footer` removed
  from the page's `sections`; `pageHeaders` stays undefined (home has none). Store the lifted
  composition; never mutate the client repo until the operator re-exports.
- **Existing live clients are untouched** until re-exported. Re-exporting an unchanged single-page
  client must produce a structurally identical `src/app/page.tsx` (guaranteed by §4c). Verify on a
  real client (e.g. `arthur-s-plumbing`) with a dry no-deploy export into a scratch copy before
  trusting the migration.

**Acceptance check (Phase 8):** Loading an existing single-page client shows a valid 1-page
composition; exporting it (no deploy) yields a repo whose `page.tsx` body diffs only cosmetically
from the pre-change output.

---

## 9. Future enhancements (explicitly out of scope for v1)
- Data-driven per-page SEO in `SiteContent` (`pageMeta[]`) with per-page JSON-LD.
- Second templates for Services/About/Contact/optional pages (v1 ships one each except Home; two
  `pageHeader` variants exist and can be swapped via Advanced).
- Cross-page in-nav anchors (e.g. `/#reviews`) for homepage sections.
- More `pageHeader` variants (video, breadcrumb, search).

---

## 10. Execution order & suggested commits
1. **Phase 2** — `lib/pages.ts` types + validators (+ unit tests in `console/test`).
2. **Phase 3** — `pageHeader` schema change (atomic: src + `site-types-source` + zod + `dist/`),
   the two `pageHeader` components, and the three-registry wiring. Isolated and verifiable before
   anything depends on it.
3. **Phase 4** — `wirePages`, `collectSectionRefs`, route wiring; `wirePage` becomes wrapper;
   export route accepts `composition`. **Fixture-drive a build before any UI.**
4. **Phase 5** — nav route links.
5. **Phase 7** — `generate-copy` per-page headers + SEO.
6. **Phase 6** — builder UI (page rail + template stage + site-style + Advanced).
7. **Phase 8** — draft format + legacy migration + real-client dry-run.
8. **Docs** — update `jdd-ops/CLAUDE.md` build/`/manage` notes and this folder's README.

Each phase: run `npm run build` (console; and `ops/jdd-schema` for Phase 3) plus, for
export-touching phases, a real scratch export build. Commit per phase with a message naming the
phase. Do not deploy any client during this work.
