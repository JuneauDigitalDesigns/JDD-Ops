# Catalog Design Language

> Reconciled 2026-10-05 against the files actually in the repo (Phase 0 of
> `design/PLAN-template-fidelity-v2.md`). Before this pass, seven of the reference
> implementations named here did not exist. If you are about to "match" a file this document
> names, `ls` it first. Archetype ids are the same vocabulary as `src/lib/archetypes.ts` and
> each component's `meta.archetype`; `console/test/catalog-invariants.test.mjs` enforces that
> no two variants in one category share an archetype.

The reference for enriching catalog components (`src/components/catalog/**`). Open it before
touching a component. Worked examples to read alongside: **`hero/HeroSplit.tsx`** and the
`services/*` variants; every idea below is implemented in one of them.

## The one principle: recompose the layout, don't decorate the grid

A component earns its keep by its **structure**, the composition a visitor reads before any
copy. The failure mode we corrected: keeping a generic 3/4-column card grid and sprinkling on
hairlines, corner numerals, and clip overlays. That is decoration, and it still reads as a
run-of-the-mill local-services template.

So the process for each component is:
1. **Pick a structural archetype** (below) that differs from its siblings: recompose the layout.
2. **Layer the editorial-print signature** (typography, hairlines, geometry) onto that structure.
3. **Add one interaction / motion moment** if it earns its place.

**Variation is mandatory.** Within a category, every variant must be a *different* archetype.
Today services carries three variants: `card-grid` (`ServicesGrid`), `sticky-swap`
(`ServicesAccordion`) and `dense-mosaic` (`ServicesPanel`). Phase 7 of
`design/PLAN-template-fidelity-v2.md` adds `editorial-index` and `stacked-panels`. Never clone
one treatment across a category.

---

## Structural archetypes

The `Status` column is the only honest way to carry the aspiration without lying about the
present. `Built by` is implied by the Status column, since this table can only be written now
that the build-out plan exists.

| Archetype id | What it is | Reference implementation | Status |
|---|---|---|---|
| `asymmetric-split` | Dominant panel bleeding off-edge against a constrained column | `hero/HeroSplit.tsx` | built |
| `form-led-split` | Split whose dominant side is the lead form, not media | `hero/HeroFormFocus.tsx` | built |
| `full-bleed-overlay` | Edge-to-edge photograph with copy laid over a flat scrim | `hero/HeroOverlap.tsx` | built |
| `card-grid` | Uniform cards over the client's full, variable-length list | `services/ServicesGrid.tsx` | built |
| `sticky-swap` | Controlled list on one side, a sticky panel that follows the active item | `services/ServicesAccordion.tsx`, `faq/FaqStickyAside.tsx` | built |
| `dense-mosaic` | Multi-column `grid-flow-dense` with deliberately varied spans | `services/ServicesPanel.tsx`, `testimonials/TestimonialsGrid.tsx` | built |
| `accordion` | Disclosure list, no media panel | `faq/FaqAccordion.tsx` | built |
| `snap-carousel` | Horizontal scroll with `scroll-snap`, user-driven only | `testimonials/TestimonialsCarousel.tsx` | built |
| `count-up-centerpiece` | Centred statement plus media plus stats that count on view | `about/AboutFeature.tsx` | built |
| `before-after` | Paired comparison of one job | `work/BeforeAfter.tsx` | built |
| `overlap-split` | Two panels overlapping via negative margin | `contact/ContactCardOverlap.tsx`, `finalCta/FinalCtaSplit.tsx` | built |
| `inline-strip` | A single-row band of short facts, no cards | `trust/TrustBadges.tsx`, `contact/ContactInlineStrip.tsx`, `footer/FooterMinimal.tsx` | built |
| `aggregate-badge` | One rating plus count plus locality, as the whole section | `trust/TrustReviewsAggregate.tsx` | built |
| `map-list` | Named places as a list beside a locality graphic | `trust/ServiceArea.tsx` | built |
| `full-bleed-band` | One edge-to-edge statement plus one action | `finalCta/FinalCtaBanner.tsx` | built |
| `centered-statement` | Centred heading plus sentence, no media | `finalCta/FinalCtaSimple.tsx`, `pageHeader/PageHeaderSimple.tsx` | built |
| `column-grid` | Link columns, footer only | `footer/FooterColumns.tsx` | built |
| `sticky-bar` | Scroll-reactive top bar | `nav/NavMinimal.tsx` | built |
| `stacked-bars` | Two stacked bars, availability strip over nav | `nav/NavEmergencyBar.tsx` | built |
| `editorial-index` | Full-width numbered rows on hairline rules, imagery revealing on hover | `services/ServicesShowcase.tsx` | not built, Phase 7 |
| `stacked-panels` | Full-width horizontal panels, one column, hierarchy from panel height | `services/ServicesSpotlight.tsx` | not built, Phase 7 |
| `feature-rail` | Large feature panel plus a rail of all items; picking one swaps the feature | `work/WorkSpotlight.tsx` | not built, Phase 7 |
| `horizontal-pin` | Section pins to the viewport while content scrolls sideways | `work/WorkMasonry.tsx` | not built, Phase 7 |
| `marquee` | A drag and scroll driven rail, no autoplay | `testimonials/TestimonialsMarquee.tsx` | not built, Phase 7 |
| `hero-first-grid` | CSS grid whose first cell spans two rows and two columns | `work/RecentJobsGrid.tsx` | recomposed in Phase 7; today it is `card-grid` |
| `numbered-ledger` | Figures as a numbered ledger on rules, not as cards | `stats/StatsLedger.tsx` | not built, Phase 8 |
| `none` | Non-visual; emits metadata or JSON-LD only | `seo/SeoDefault.tsx`, `seo/SeoLocalBusiness.tsx` | built |

`WorkGrid` and `TestimonialsRotator` were cited here before 2026-10-05 and are deliberately NOT
in the table: decision 42. `RecentJobsGrid` became `hero-first-grid` and `TestimonialsCarousel`
already owns `snap-carousel`, so either one would collide within its category and fail
`console/test/catalog-invariants.test.mjs`.

When a category needs a structure not in this list, invent one, but make it a genuine
composition, not a decorated grid, and add it here once it ships.

---

## The editorial-print signature

This is the through-line layered *onto* a strong structure, never a substitute for one.
Hallmarks:

- **Breakout display type**: oversized headings set on the `tracking-display` token
  (`letterSpacing.display`, `-0.022em`, used only on text already at `text-display-1`), that
  can escape their column (`hero/HeroSplit`).
- **Hairline eyebrow**: `flex items-center gap-3` + `<span class="h-px w-8 bg-rule">` + uppercase
  `tracking-wide` label. Neutral, not accent: decision 10 reserves accent for the primary CTA
  and for genuine urgency. `tracking-wide` is deliberately restrained (`+0.010em`, the only
  positive step in Phase 1's scale), not the old dramatic wide-tracked eyebrow.
- **Heavy numerals**: `font-heading font-black`, oversized indices/stats; dim inactive, full-ink
  active.
- **Hairline rules**: thin `border`/`divide` in the skin's rule color as structure, not heavy
  boxes.
- **Geometric edges**: diagonal `clip-path` seams and accent corners instead of soft gradient
  feathers.
- **Offset-shadow CTA**: the primary-button signature, `rounded-control` plus
  `4px 4px 0 rgba(0,0,0,.85)` (light) / `rgba(255,255,255,.12)` (dark), lift on hover. Reserve
  for the *primary* CTA; secondary actions stay as text links (`hover:text-accent`).
- **Rotated edge label**: vertical `-rotate-90` mark up a tall section's edge (`hero/HeroSplit`).
- **Asymmetry and whitespace**: deliberate imbalance and room to breathe; crowding reads as
  templated.

Use a few, cleanly. A section usually carries 2 to 3 of these, not all of them.

---

## Motion and interactivity

### Section 9 amendment, 2026-10-05 (decision 18)

The budget is **one or two signature moments per PAGE**, not per section (decisions 26 and 28).
Micro-reveals stay free and unlimited. Cursor glow and `parallaxY` are **cut** as ornamental:
`parallaxY` stays exported from `@jdd/ui/motion` for back-compat (decision 3) but must not be
used in any new component. Interaction is welcome where it does real work, state swaps,
hover-reveals, sticky-follow, scroll effects that let a visitor explore without scrolling, but
not as decoration for its own sake.

Two tiers of motion live in `@/lib/motion`:

- **Micro (default, free):** `reveal`, `revealItem`, `revealStagger`, hover lifts.
- **Signature (opt-in, sparing, budgeted per PAGE):** the `clipReveal` variant. At most one or
  two sections on a given page may own a signature moment; `console/test/page-rhythm.test.mjs`
  enforces this across every page template.

Every effect must no-op under reduced motion: compute `const still = stillFor(skin, reduce)`
(or `const reduce = useReducedMotion()` in skinless files) and gate on it. The picker/swap still
*works* when still, it just doesn't animate.

---

## Per-category guidance

Each variant in a category is a different archetype. Suggested pairings (not a straitjacket):

- **hero**: Asymmetric split (done, `HeroSplit`), form-led split (done, `HeroFormFocus`),
  full-bleed overlay (done, `HeroOverlap`).
- **services**: Card grid, sticky swap, dense mosaic (done). Phase 7 adds editorial index and
  stacked panels.
- **work**: Before/after, hero-first grid (done, `RecentJobsGrid` recomposed in Phase 7). Phase 7
  adds feature-rail and horizontal pin. Media-forward; `clipReveal` fits.
- **testimonials**: Snap carousel, dense mosaic (done). Phase 7 adds marquee. The three
  testimonials archetypes after Phase 7 are dense mosaic, snap carousel, marquee. Heavy
  pull-quote numerals; keep the existing carousel motion.
- **about**: Count-up centerpiece (done, `AboutFeature`). Heavy numerals on stat bands.
- **faq**: Sticky swap (two-pane), controlled accordion. An editorial index of questions is a
  candidate third variant when faq needs one.
- **contact / finalCta**: Overlap split, asymmetric split, full-bleed band. Offset-shadow CTA is
  the primary button.
- **trust / footer / nav**: restrained to hairlines, type and heavy numerals only. No big
  archetype, no parallax. These are the quiet surfaces that let the loud ones land.

Two adjacent sections on one page should not repeat the same headline move; the archetype
variety across categories already handles most of this.

---

## Guardrails

- **Honor skins.** No hard-coded colors in skin-aware files: pull `skinClasses(skin)`
  (`s.section`, `s.heading`, `s.body`, `s.eyebrow`, `s.rule`, `s.card`, `s.cardRule`) plus accent
  tokens. Skinless files (`services/ServicesPanel`, `services/ServicesAccordion`, not in
  `src/lib/skins.ts`) keep their own color model; don't force skins on them.
- **Honor `stillFor` / reduced motion.** Gate all motion; interactive pickers still function when
  still.
- **Unique `<E>` paths.** Each editable field wrapped in exactly one place. When a value appears
  twice (e.g. a title in both a rail and a feature), wrap it once and render the other as a plain
  mirror.
- **Preserve `meta`.** Never change a component's `id`, `category`, `consumes`, or `skins` while
  restructuring: the studio and export pipeline read them.
- **Motion budget is per page, not per section** (decision 26). At most two sections on a page
  may own a signature moment; micro-reveals are free and unlimited.
- **No brand-name watermarks.** The giant background text from `brand.name`/`short` is banned:
  use structure, geometry, and heavy numerals for presence instead.

When in doubt, open `hero/HeroSplit.tsx` or `services/ServicesGrid.tsx` and match the
discipline: a strong structure first, a few editorial moves on top, one interaction that earns
its place.
