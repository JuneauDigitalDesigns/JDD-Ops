# Catalog Design Language

The reference for enriching catalog components (`src/components/catalog/**`). Open it before
touching a component. Worked examples to read alongside: **`hero/HeroSplit.tsx`** and the five
**`services/*`** variants — every idea below is implemented in one of them.

## The one principle: recompose the layout, don't decorate the grid

A component earns its keep by its **structure** — the composition a visitor reads before any copy.
The failure mode we corrected: keeping a generic 3/4-column card grid and sprinkling on hairlines,
corner numerals, and clip overlays. That is decoration, and it still reads as a run-of-the-mill
local-services template.

So the process for each component is:
1. **Pick a structural archetype** (below) that differs from its siblings — recompose the layout.
2. **Layer the editorial-print signature** (typography, hairlines, geometry) onto that structure.
3. **Add one interaction / motion moment** if it earns its place.

**Variation is mandatory.** Within a category, every variant must be a *different* archetype — the
five services variants are Feature+Rail, Editorial Index, Stacked Panels, Dense Mosaic, Split
Accordion. Never clone one treatment across a category.

---

## Structural archetypes

The catalog already contains proven implementations of each. Adapt these rather than invent. Every
one honors skins / `stillFor` where the file is skin-aware (see Guardrails).

| Archetype | What it is | Interaction / state | Reference implementation |
|---|---|---|---|
| **Asymmetric split** | Dominant panel bleeding off-edge vs. a constrained column | scroll parallax (opt-in) | `hero/HeroSplit.tsx` |
| **Feature + Rail** | Large feature panel + a rail listing all items; picking one swaps the feature | `useState` + `AnimatePresence` swap, hover/click | `services/ServicesGrid.tsx` (swap from `faq/FaqStickyAside`, split from `work/WorkSpotlight`) |
| **Editorial Index** | Full-width numbered rows on hairline rules; imagery reveals on hover | CSS hover-reveal | `services/ServicesShowcase.tsx` |
| **Stacked panels** | Full-width horizontal panels in a single column | cursor-tracked glow (opt-in) | `services/ServicesSpotlight.tsx` |
| **Dense mosaic** | Multi-col grid, `grid-flow-dense`, dramatic varied spans (tall feature, wide bands) | — | `services/ServicesPanel.tsx` |
| **Split + sticky swap** | Controlled list on one side; a sticky media/answer panel that follows the active item | `useState`, `AnimatePresence`, `lg:sticky` | `services/ServicesAccordion.tsx`, `faq/FaqStickyAside.tsx` |
| **Overlap split** | Two panels overlapping via negative margin; async form on one side | form state | `contact/ContactCardOverlap.tsx` |
| **Hero-first grid** | CSS grid where the first cell spans 2 rows/cols for emphasis | — | `work/WorkGrid.tsx` |
| **Horizontal pin-scroll** | Section pins to viewport while content scrolls sideways | GSAP ScrollTrigger + scroll-snap fallback | `work/WorkMasonry.tsx` |
| **Count-up centerpiece** | Centered statement + media + stats that count up on view | IntersectionObserver + `@/lib/useCountUp` | `about/AboutFeature.tsx` |
| **Rotator** | Single centered item + dot pagination, manual or auto | `useState` (+ `setInterval`) | `testimonials/TestimonialsRotator.tsx` |

When a category needs a structure not in this list, invent one — but make it a genuine composition,
not a decorated grid, and add it here once it ships.

---

## The editorial-print signature

This is the through-line layered *onto* a strong structure — never a substitute for one. Hallmarks:

- **Breakout display type** — oversized headings, tight tracking (`tracking-[-0.03em]`), that can
  escape their column (`hero/HeroSplit`).
- **Hairline eyebrow** — `flex items-center gap-3` + `<span class="h-px w-8 bg-accent">` + uppercase
  `tracking-[0.24em]` label. Safe in almost any header.
- **Heavy numerals** — `font-heading font-black`, oversized indices/stats; dim inactive, accent active.
- **Hairline rules** — thin `border`/`divide` in the skin's rule color as structure, not heavy boxes.
- **Geometric edges** — diagonal `clip-path` seams and accent corners instead of soft gradient feathers.
- **Offset-shadow CTA** — the primary-button signature: `rounded-sm` + `4px 4px 0 rgba(0,0,0,.85)`
  (light) / `rgba(255,255,255,.12)` (dark), lift on hover. Reserve for the *primary* CTA; secondary
  actions stay as text links (`hover:text-accent`).
- **Rotated edge label** — vertical `-rotate-90` mark up a tall section's edge (`hero/HeroSplit`).
- **Asymmetry & whitespace** — deliberate imbalance and room to breathe; crowding reads as templated.

Use a few, cleanly. A section usually carries 2–3 of these, not all of them.

---

## Motion & interactivity

Interactivity is **welcome** where it earns its place — state swaps, hover-reveals, cursor glow,
sticky-follow, scroll effects. Two tiers of motion live in `@/lib/motion`:

- **Micro (default, free):** `reveal`, `revealItem`, `revealStagger`, hover lifts.
- **Signature (opt-in, sparing):** `parallaxY(ref, still, range?)` and the `clipReveal` variant — one
  standout scroll moment per section, not per element.

Every effect must no-op under `quiet` skin / reduced motion: compute `const still = stillFor(skin,
reduce)` (or `const reduce = useReducedMotion()` in skinless files) and gate on it. The picker/swap
still *works* when still — it just doesn't animate.

---

## Per-category guidance

Each variant in a category = a different archetype. Suggested pairings (not a straitjacket):

- **hero** — Asymmetric split (done). Other variants: Feature+Rail, Count-up centerpiece.
- **services** — Feature+Rail · Editorial Index · Stacked panels · Dense mosaic · Split accordion (done).
- **work** — Hero-first grid · Horizontal pin · Feature+Rail · Overlap. Media-forward; `clipReveal` fits.
- **testimonials** — Rotator · Editorial Index of quotes · Dense mosaic of cards · marquee. Heavy
  pull-quote numerals; keep existing rotator/marquee motion.
- **about** — Count-up centerpiece · Asymmetric split · Split + sticky. Heavy numerals on stat bands.
- **faq** — Split + sticky swap (two-pane) · controlled accordion · Editorial Index of questions.
- **contact / finalCta** — Overlap split · Asymmetric split. Offset-shadow CTA is the primary button.
- **trust / footer / nav** — Restrained: hairlines + type + heavy numerals only. No big archetype,
  no parallax. These are the quiet surfaces that let the loud ones land.

Two adjacent sections on one page should not repeat the same headline move; the archetype variety
across categories already handles most of this.

---

## Guardrails

- **Honor skins.** No hard-coded colors in skin-aware files — pull `skinClasses(skin)` (`s.section`,
  `s.heading`, `s.body`, `s.eyebrow`, `s.rule`, `s.card`, `s.cardRule`) + accent tokens. Skinless
  files (e.g. `services/ServicesPanel`, `ServicesAccordion` — not in `src/lib/skins.ts`) keep their
  own color model; don't force skins on them.
- **Honor `stillFor` / reduced motion.** Gate all motion; interactive pickers still function when still.
- **Unique `<E>` paths.** Each editable field wrapped in exactly one place. When a value appears twice
  (e.g. a title in both a rail and a feature), wrap it once and render the other as a plain mirror.
- **Preserve `meta`.** Never change a component's `id`, `category`, `consumes`, or `skins` while
  restructuring — the studio + export pipeline read them.
- **One signature motion moment per section.** Micro-reveals are free; scroll/cursor effects are budgeted to one.
- **No brand-name watermarks.** The giant background text from `brand.name`/`short` is banned — use
  structure, geometry, and heavy numerals for presence instead.

When in doubt, open `hero/HeroSplit.tsx` or `services/ServicesGrid.tsx` and match the discipline: a
strong structure first, a few editorial moves on top, one interaction that earns its place.
