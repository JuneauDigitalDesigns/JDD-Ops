# Catalog — legacy vs. vertical-template components

As of the 2026-10 Studio pivot, the Studio no longer offers **per-page templates** or
**per-section variant swapping**. Its unit of choice is now **one bespoke whole-site template
per industry vertical** (see `src/app/c/[slug]/build/vertical-templates.tsx`), applied across all
four core pages at once. The template for the vertical chosen in intake is the only one offered.

## Bespoke vertical-template components (in use)

Pixel-faithful ports of the per-vertical mockups. Fixed designs — **no `skin`** (absent from
`SKINS`), so the exporter never emits a skin prop. Composed by `VERTICAL_TEMPLATES`, not offered
individually.

- HVAC — the Northstar "Home — Standard" mockup (`design/northstar-standard/mockups.html`, derived
  from the uploaded `home-mockups.html` Standard tab). Nine bespoke components, navy/steel/gold,
  Oswald + Inter: `nav/HvacNav`, `hero/HvacHero` (full-bleed image + scrim), `stats/HvacStatBand`,
  `services/HvacServices` (steel-icon card grid, no eyebrow — accent only on card tags),
  `trust/HvacServiceArea` (map + town chips), `faq/HvacFaq` (accordion),
  `testimonials/HvacReviews` (aggregate + quote grid), `finalCta/HvacFinalCta` (navy band + shared
  `<LeadForm>` capture — POSTs to the onboard-owned `/api/contact`), `footer/HvacFooter` (navy).

Other verticals (roofing, plumbing, lawn-care, car-detailing, health) are not built yet; those
clients fall back to the default composition and are offered no template card.

## Legacy components — archived, present, NOT retired from the build

Every other component under `catalog/` (HeroSplit, ServicesGrid, AboutStory, FaqAccordion,
ContactSplit, the PageHeader* set, etc.) and the per-page `PAGE_TEMPLATES` registry
(`page-templates.tsx`) are **kept and still compile**. They are intentionally retained because:

1. The HVAC template's **interim** Services/About/Contact pages still compose from them until
   those pages get bespoke rebuilds.
2. `defaultCompositionFor` / `pageFromType` / `servicePageFrom` (which back the generic 4-page
   fallback, add-page, and per-service pages) still read `PAGE_TEMPLATES`.
3. Any already-exported client whose composition references them must keep rendering + exporting.

They are simply **no longer offered as Studio choices** (the per-page template strip and the
per-section layout/variant switcher were removed from `PageStudio.tsx`). Do not delete them, or
their skins (`@jdd/ui/skins` `SKINS`), or their `CATALOG` entries (`lib/export.ts`) until every
page of every vertical has a bespoke replacement. When that day comes, remove them from
`CATALOG`, `SKINS`, `categories.tsx`, and `page-templates.tsx` together.
