# Catalog v2 — design spec

Direction: **confident local operator**. The site should look like a business that has been
around twenty years and is good at its job. Trustworthy over stylish. If a choice is between
looking designed and looking competent, pick competent.

The reference implementation is `mockups.html` in this folder, built on the real
`_e2e_test_growth` palette including the derived tokens added in Phase 1.

---

## 1. Surfaces replace skins

`editorial | contrast | quiet` are gone. Three **surface roles**, describing where a section
sits in the page rhythm rather than a design attitude:

| Role | Background | Text | Use |
|---|---|---|---|
| `default` | `--bg` | `--ink` | Hero, most content |
| `soft` | `--bg-soft` | `--ink` | Alternating band, services, FAQ |
| `inverted` | `--ink-panel` | `--on-ink` | CTA, trust, footer |

**Sections are separated by mass, not by lines.** Hairline `border-rule` dividers between
sections are cut. Rules survive only *inside* a component where they separate a claim from its
proof (the hero proof list, card footers).

`quiet` is not replaced. It existed mainly to disable motion, and the global motion policy
now does that.

## 2. Color

`--accent` is the authored brand hex and is for **fills, borders and icons only.**

Accent-colored **type** must use `--accent-text` (derived, guaranteed ≥4.5:1 on `--bg`).
Tailwind's `theme.textColor.accent` already maps `text-accent` to it, so this is automatic.

`--accent-fg` is chosen by measured contrast, never trusted from the schema.

`--urgent` (derived, accent rotated toward red, ≥4.5:1) carries availability and emergency
cues only: "Emergency service 24/7", "Same-day". Never used decoratively.

## 3. Type

| | Mobile (390) | Desktop (≥1000) |
|---|---|---|
| h1 | 36px | **58px, capped** |
| h2 | 32px | 42px |
| h3 (card) | 21px | 21px |
| Body | 17px | 17px |
| Small / proof | 15px | 15px |

Weight **800** for headings, letter-spacing `-0.015em`, line-height `1.05`. Normal tracking,
not the old `-0.04em`. Body line-height `1.55`.

The h1 must **name the service and the city**. It is a search result and a reassurance, not a
slogan.

**Cut:** `-rotate-90` edge labels · `text-[16rem]` ghost numerals · wide-tracked uppercase
eyebrows (`tracking-[0.24em]`) · hairline section dividers. Where an eyebrow was labelling a
section, the h2 now carries that job and a plain supporting sentence sits under it.

## 4. Phone is the primary action

- The phone button shows **the digits**, not the word "Call". The number is itself a trust
  signal.
- It carries a short assurance line underneath ("a person answers 24/7", "average answer time
  under 30 seconds").
- The form CTA is **secondary** styling.
- Nav carries a tappable phone at **every** breakpoint, minimum 48px target. On mobile it
  collapses to an icon, never disappears.

## 5. Buttons

Large, solid, `8px` radius, weight 800, `18px 22px` padding, full-width on mobile and
auto-width from 700px. Primary is `--accent` fill with `--accent-fg`. Secondary is a 2px
`--ink` outline that inverts on hover. Nothing is a pill; nothing is `rounded-sm`.

## 6. Icons

Solid, weighty, literal. A furnace, a snowflake, a wrench, a shield, a clock. 22px inline,
27px inside a card's icon tile. Icons in an accent-tinted (`--accent-100`) rounded square, not
floating loose.

Decorative icons take `aria-hidden="true"`. Icons that carry meaning get a text label beside
them, never an icon alone.

## 7. Trust is in the hero, and repeats

The hero carries, at **every breakpoint**: star rating with review count and locality, and a
four-item proof grid (licensed/insured, response time, pricing honesty, warranty).

The old catalog hid its review badge behind `hidden lg:block`. **Nothing essential may sit
inside a hidden-until-breakpoint wrapper.** Trust repeats near every conversion point.

Components must degrade cleanly when a client lacks a credential: show what is real, never
render an empty shell.

## 8. Mobile-first is a rule, not an aspiration

Every component is composed at **390px first**. Desktop breakpoints may only add room, never
add meaning. If an element appears only above a breakpoint, it is decoration and should be
cut instead.

Breakpoints: `700px` (columns appear), `1000px` (full desktop composition).

## 9. Motion

**Nothing above the fold animates on load.** This is measured, not aesthetic: the hero's
LCP paragraph used to sit behind `initial={{opacity:0}}` with a 350ms delay, which put 84% of
a 4.2s LCP in Render Delay. See `PERF.md`.

Below the fold, CSS entrance reveals are fine. Hover, focus and press states everywhere.

**Cut entirely:** cursor-tracking gradients (`HeroKinetic`, `ServicesSpotlight`) · count-up
stats (`AboutFeature`) · auto-advancing carousels (`TestimonialsMarquee`,
`TestimonialsRotator`) · the infinite `TrustMarquee`.

## 10. Images

Every in-flow `<img>` carries `width`/`height` matching its wrapper's ratio. This is
load-bearing even though CSS sets the rendered size: it is the only intrinsic ratio available
before the bytes arrive. Omitting it cost CLS 0.193 in testing.

Hero image: `fetchpriority="high"`, `loading="eager"`, never animated.

## 11. Focus

One global rule: `3px solid var(--accent-text)`, `outline-offset: 3px`. Every focusable
element, including inside inverted sections.

---

---

## The pruned catalog (28, from 60)

Cut 2026-08-19. Kept variants do genuinely different **jobs**; variants that differed only by
decoration are gone, as are components whose entire identity was a motion effect we cut.

| Category | Components |
|---|---|
| nav (2) | `NavMinimal` (standard, phone visible at every breakpoint) · `NavEmergencyBar` (24/7 strip) |
| hero (3) | `HeroSplit` (image-led) · `HeroFormFocus` (form-led) · `HeroOverlap` (full-bleed) |
| services (3) | `ServicesGrid` · `ServicesAccordion` · `ServicesPanel` |
| testimonials (2) | `TestimonialsGrid` · `TestimonialsCarousel` (user-driven, no autoplay) |
| work (2) | `RecentJobsGrid` · `BeforeAfter` — reframed from portfolio |
| about (2) | `AboutStory` · `AboutFeature` |
| faq (2) | `FaqAccordion` · `FaqStickyAside` |
| trust (2) | `TrustBadges` · `TrustReviewsAggregate` |
| contact (3) | `ContactSplit` · `ContactInlineStrip` · `ContactCardOverlap` |
| finalCta (3) | `FinalCtaBanner` · `FinalCtaSplit` · `FinalCtaSimple` |
| footer (2) | `FooterColumns` · `FooterMinimal` |
| seo (2) | `SeoDefault` · `SeoLocalBusiness` |

Removing a component means editing **three** places or the studio will offer something the
exporter refuses: `CATALOG` in `lib/export.ts`, `SKINS` in `lib/skins.ts`, and the registry in
`app/c/[slug]/build/categories.tsx`. `/api/build/source` now imports `CATALOG` rather than
keeping its own copy.

### Known gaps from this prune

- **Starter-plan lead capture has no variant.** `categories.tsx` filters by
  `leadMode === 'email'` for starter clients, and the seven `*Starter` components that
  carried that flag are gone. The surviving contact / finalCta components must take a
  `leadMode` prop via the shared `LeadForm` island before a starter client can be built.
  Note this was **already broken**: `CATALOG` never listed a `*Starter` name, so
  `validateEntries` would have rejected the export anyway. No live client is affected — both
  existing clients are on growth.
- **`ServiceArea` is not built yet.** It is a new component, so it belongs with the
  recomposition rather than the prune.

## Open, deliberately

- **Photography.** The mockup uses stock. Policy is curated per-vertical stock at launch,
  swapped for real client photos when available, with the console flagging sites still on
  placeholders.
- **`FooterBrandCta` logo sizing.** Still unsized and in flow; needs a reserved-height wrapper
  rather than a guessed ratio. See `PERF.md`.
- **Form composition.** The shared `LeadForm` island is specified but not drawn here; the CTA
  section shows the phone-primary arrangement it must slot into.
