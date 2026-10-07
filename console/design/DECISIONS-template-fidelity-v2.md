# Decisions: template fidelity upgrade (v2)

Captured 2026-10-05, from 38 questions answered against
`RESEARCH-local-service-visual-design.md`. This file is the authoritative decision record for
the upgrade. The plan is derived from it. Read the research doc for the evidence behind each.

## Positioning

| # | Decision |
|---|---|
| 1 | **Tier B visuals on Tier A conversion architecture.** Premium type, neutral grounds, asymmetric composition, restrained accent. Every Tier A conversion non-negotiable is kept. |
| 2 | **Scope: tokens, components, and the build flow.** All eight gaps are in scope. |
| 3 | **Back-compat is additive.** Deprecated tokens and skin ids keep resolving. No live client site breaks. |
| 4 | **First move: the template token layer** (gap G2). |

## Typography

| # | Decision |
|---|---|
| 5 | **Licensing: best free/open faces that read premium.** Self-hosted woff2. No paid licensing regime. |
| 6 | **Replace `fonts.ts` entirely with curated pairings.** Operator picks a pairing, not two independent fonts. The old loose list goes away. |
| 7 | **Pairing model: single high-quality grotesque.** Display and body are the same family, differentiated by weight, size and tracking. |
| 8 | **Type scale: fluid `clamp()` with negative tracking baked into the large steps.** |

## Color

| # | Decision |
|---|---|
| 9 | **Default grounds move to warm unbleached neutrals; ink to warm charcoal.** Off pure white and pure black. AA contrast suite must be re-run, every derived token shifts. |
| 10 | **Accent demoted to primary CTA and urgency only.** Eyebrows, rules, icons and numerals go neutral. |
| 11 | **Honor the trade color conventions, execute them at a higher level.** Sophisticated tones of the expected trade coding, not saturated primaries. |
| 12 | **One dark anchor section per page, maximum.** |

## Photography

| # | Decision |
|---|---|
| 13 | **Keep shipping stock placeholders, but curate them far better.** No go-live gate. Existing `_meta.placeholder_images` provenance tracking is preserved. |
| 14 | **No AI-generated imagery for people, crew, or completed work.** Allowed only for abstract texture or background plates where nothing is claimed. |
| 15 | **Enforce aspect ratios, focal crops, and a subtle unified grade.** This is what makes mixed-quality source material read as one professional set, and it is also what stops curated stock reading as stock. |
| 16 | **Build the build-time image pipeline now.** Fetch once at export, emit AVIF/WebP at several widths into `/public`, reference those. Replaces the `img.ts` origin-resize shim and kills the Unsplash hotlink dependency. |

## Page structure

| # | Decision |
|---|---|
| 17 | **Adopt the researched home order:** hero > differentiators > services > service areas > proof > recent work > faq > contact. |
| 18 | **Add two new section categories: differentiators/why-us, and a stats band with count-up.** (Process steps and financing strip were considered and not selected.) |
| 19 | **Several distinct page-header archetypes**, so subpages stop opening identically on every client site. |
| 20 | **Generate one page per service.** |

## Catalog

| # | Decision |
|---|---|
| 21 | **Build the seven components `DESIGN-LANGUAGE.md` cites but does not have.** They are the right archetypes. The doc becomes true rather than being trimmed. |
| 22 | **Three to four variants per major category**, two for chrome (nav, footer, seo). |
| 23 | **Declare `archetype` in each component's `meta`, and lint for collisions within a category.** The variety rule becomes mechanical, not prose. |
| 24 | **Section rhythm is encoded at the page-template level**, not inside components. Page templates decide which sections are full-bleed, contained, or text-dominant. |

## Motion and interaction

| # | Decision |
|---|---|
| 25 | **Add a global smooth-scroll layer (Lenis or equivalent), reduced-motion gated** via the existing `stillFor` pattern. |
| 26 | **Motion budget: one or two signature moments per PAGE**, not per section. Tightens the current rule. Micro-reveals stay free. |
| 27 | **The sticky mobile call bar is a first-class designed component.** It is on screen constantly and is the highest-ROI conversion element, so it gets the most design attention of anything on the site. |
| 28 | **Interaction only where it does real work.** Keep Feature+Rail and sticky-swap (they let a visitor explore without scrolling). Cut ornamental cursor glow and parallax. |

## Copy and guardrails

| # | Decision |
|---|---|
| 29 | **Expand intake to demand specifics:** named towns, license number, year established, owner name, equipment brands carried, response-time commitment. Specificity is the documented antidote to looking AI-made, and the no-inventing-values rule means it has to come from intake. |
| 30 | **Hard-ban all four named tells**, the way brand-name watermarks already are: (a) three equal feature cards in a row, (b) gradient overlays and soft gradient hero backgrounds, (c) generic line-art service icons, (d) uniform section padding and height across a page. |
| 31 | **Verification: build full reference sites per vertical and review them visually.** Automated checks do not measure whether something looks expensive. Use the existing `vercel deploy --yes` preview workflow. |
| 32 | **Conversion non-negotiables are documented and checked by hand at go-live.** No new build-time enforcement machinery. The list: tap-to-call, sticky mobile call, named service area, review aggregate above the fold, license displayed, form at six fields or fewer. |

## Execution

| # | Decision |
|---|---|
| 33 | **Phased plan, each phase independently verifiable**, ending in a build gate and something lookable-at. |
| 34 | **Design in standalone HTML mockups first, then convert to components.** Visual decisions get settled before code decisions. Use the design-template skill flow. |
| 35 | **Distinct design language per vertical** (not one house system). |
| 36 | **Existing clients are untouched.** Atlantic and Air Service are `externalManaged` starter shims, not built from this template. No redeploys. |
| 37 | **Shared foundation first, then one vertical design language per cycle.** Tokens, archetypes, components and page templates are built once and shared; each vertical then layers its own type pairing, palette, photography direction and rhythm. Avoids a 6x up-front mockup cost. |
| 38 | **HVAC is the first vertical.** It is the default vertical and the one the fixtures and `_e2e_test_growth` already use. |

## Known tensions to watch

- **35 vs. 37.** Distinct-per-vertical is a 6x multiplier on design work and pulls against the
  goal of building sites *quickly*. 37 is the mitigation: the shared foundation must carry as
  much as possible so a vertical language is a thin layer (type pairing, palette, photography
  direction, rhythm preferences), not a new component set. If a vertical language starts
  requiring its own components, that is a signal the foundation is too thin.
- **13 vs. the research.** Keeping stock placeholders is a deliberate acceptance of the
  largest documented distrust signal in this sector. Decision 15 (enforced crop and grade) is
  what makes it survivable. Worth revisiting if a client site underperforms.
- **32.** Hand-checking the conversion list means it depends on operator discipline. If sites
  start shipping without a named service area, revisit and automate.

---

# Addendum: reconciliation round, 2026-10-05

Decisions 39 to 52, from a second question round after the plan was drafted. These resolve
things the plan surfaced or got wrong. **Where an addendum decision contradicts the plan, the
addendum wins and the plan must be amended.**

## Verified pre-existing breakages (prerequisites, not new work)

All three confirmed by direct inspection, not inferred. Each invalidates a build gate the plan
leans on, so each must be fixed before Phase 0 begins.

| # | Breakage | Evidence |
|---|---|---|
| P1 | **`cd template && npm run build` cannot pass.** `template/package.json:19` requires `@jdd/ui#v1.0.2`; `template/node_modules/@jdd` does not exist. Fix with `npm install` in `template/`. Confirm the private GitHub dep actually resolves under the current `gh` auth. | Declared-but-not-installed dependency confirmed. The build itself was not run. |
| P2 | **`npm run check-schema` cannot pass.** `console/package.json:19` pins `@jdd/schema` as `file:../../jdd-schema`; jdd-ops root `package.json:33` pins `github:…#v1.18.0`. `check-pins.mjs` compares pin strings, so a `file:` spec can never equal a `github:` one. | Both pins read directly. |
| P3 | **`packages/ui/src/palette.ts` has an uncommitted `sectionVars`.** Note `packages/ui/` is gitignored by jdd-ops (`.gitignore:24`) **and is its own git repo**, so checking from the jdd-ops root reports a misleadingly clean tree. Inside the package: ` M src/palette.ts`, and `sectionVars` is absent from both `HEAD` and tag `v1.0.2`. | Checked inside `packages/ui`. |

## Decisions

| # | Decision |
|---|---|
| 39 | **Placeholder detection reads `_meta`, not the URL.** Phase 10 rewrites slots to `/img/<hash>`, which silently defeats `isOwnPlaceholder` (`image-placeholders.ts:218`, an exact match against `KNOWN_PLACEHOLDER_URLS`) and therefore `needsFill` (`:262`). Without this, a stock placeholder becomes permanently indistinguishable from a real client photo on the next export, destroying the one property decision 13 was chosen to keep. Rewrite detection to consult `_meta.placeholder_images` and `_meta.local_images`. |
| 40 | **Convert the console's `@jdd/schema` pin to the github tag**, so all three consumers agree and exported client repos resolve reproducibly. Accepts losing `file:` local-iteration convenience. |
| 41 | **Delete the uncommitted `sectionVars` from `@jdd/ui`**; `template/src/lib/palette.ts` keeps its own. Publishing it would create a shadowed star-export, since the template does `export * from '@jdd/ui/palette'` and then redefines the symbol. |
| 42 | **`WorkGrid` and `TestimonialsRotator` are not built.** `RecentJobsGrid` is recomposed into the `hero-first-grid` archetype, and `TestimonialsCarousel` already fills the rotator slot; building either would be a duplicate archetype the collision lint rejects. Delete those two references from `DESIGN-LANGUAGE.md` in Phase 0. |
| 43 | **The reference site is `_e2e_test_growth`, exported and built locally, not deployed.** Accepts that fidelity gets judged in a desktop browser at 390px rather than on a real phone. |
| 44 | **Image output: 4 widths (640/1024/1536/2048) in WebP, plus AVIF for the hero only.** Amends Phase 10's 5 widths in both formats. Vercel is on **Pro** and bots are handled, so egress is not the constraint; export duration is, because the export route already runs `npm install` plus a full build. AVIF is reserved for the LCP element where its slower encode pays for itself. |
| 45 | **Service body copy is generated from client facts and flagged for review** (not fabricated, not left thin). |
| 46 | **Health & Wellness reuses the system as-is**, treated as a premium trade. The Tier B language (neutral grounds, restrained accent, editorial type) arguably suits it better than it suits roofing. No separate research pass. |
| 47 | **Copy review lives on the Intake step of `/build`.** |
| 48 | **Service body copy reuses `services.items[].detail`**, which already exists in `copy-schema.ts:37` and is already generated per service. **No `@jdd/schema` bump, no re-pin.** `subpages` keeps owning page headers and SEO. |
| 49 | **The copy review is grouped by page**, home sections first, then Services, About, Contact, then each service page. |
| 50 | **Review verdicts are per section per page instance.** The verdict key must include the route or the per-instance section id, the way `sectionStyles` already keys off instance id. A section placed on two pages is approved independently. |
| 51 | **Unreviewed generated copy blocks leaving the Intake step.** |
| 52 | **Correction: Vercel is on Pro, not Hobby.** The Sep 2026 bandwidth spike was AI bot scraping of client sites plus a stalled deploy, already fixed in code and Vercel config. Do not size image pipelines or asset counts as though egress were scarce. |

## New work the plan does not cover

**A multi-page copy review phase is missing. Sequence it after Phase 9 and before Phase 11,
since it depends on per-service pages existing and the reference site should carry reviewed copy.**

Verified gaps it must close:
1. **Subpage copy is generated but has no review surface.** `subpages` is defined in
   `copy-schema.ts:56`, requested by `src/app/api/build/generate-copy/route.ts`, and applied by
   `src/lib/copy-brief/apply-generated.ts`. But `CopyWireframe.tsx`'s `WIREFRAME_ORDER` (line 21)
   is `brand, announcement, hero, trust, about, services, work, testimonials, faq, finalCta,
   footer, seo` and omits `subpages`. Grep confirms `subpages` appears in **no** file under
   `src/components/wizard/`. Subpage copy reaches client sites unreviewed today, before decision
   20 multiplies it by up to nine routes.
2. `CopyWireframe` must be restructured per decision 49, and `SectionVerdict` re-keyed per
   decision 50.
3. The Intake-step gate from decision 51 must be wired, and `services.items[].detail` must
   become visible and reviewable per decision 48.

Files in scope: `console/src/components/wizard/CopyWireframe.tsx`,
`console/src/components/wizard/IntakeStep.tsx`,
`console/src/components/wizard/copy-primitives.tsx`, `console/src/lib/copy-schema.ts`,
`console/src/lib/copy-brief/*`, `console/src/app/api/build/generate-copy/route.ts`.

## Tensions added by this round

- **43 vs 31.** Decision 31 says fidelity is judged by a person looking at a real site, and
  decision 27 makes the sticky mobile call bar the most design-attended element on the site. But
  43 declines a deploy, so the first fidelity review happens in a desktop browser at 390px, which
  is where §0.4's hidden-preview constraint and framer-motion freezing already bite. Worth
  revisiting if the local review feels untrustworthy.
- **46 is untested.** Reusing the trades system for Health & Wellness is a reasonable bet, but
  the research behind every palette, photography and proof decision is trades-only. If the health
  vertical's first build looks wrong, the cause is this decision and not the foundation.
- **45 + 51 vs the no-inventing rule.** Generated-then-reviewed copy is the narrowest path that
  still produces real pages, but it puts a model's prose on a client site contingent on an
  operator actually reading it. The gate is load-bearing, so it must be a hard block.

---

# Addendum 2: schema state, motion, grade, 2026-10-05

## P4: the fourth prerequisite, and it resequences the plan

**`jdd-schema` has 33 lines of uncommitted, untagged v2.2 work on top of tag `v1.19.1`.** I read
the full diff: it is entirely additive, every new field is optional, and it is coherent rather
than half-finished. Contents:

| Addition | Where |
|---|---|
| `detail?: string` (2-3 sentence expansion for the Services page) | `ServiceItem` |
| `story?: string[]` (multi-paragraph story for the About page) | `AboutContent` |
| `interface SectionStyle` (per-section accent/bg/bgSoft/headingWeight/scale override) | new |
| `interface PageHeaderContent` (eyebrow, title, sub, nullable cta) | new |
| `interface SubpageContent` (`header` + per-page `seo`, nothing else) | new |
| `subpages` (per-route content for non-home pages) | `SiteContent` |

Who is affected, verified:
- **Console: unaffected.** Its `file:../../jdd-schema` pin reads the uncommitted source directly,
  which is why none of this has surfaced.
- **Exported client repos: unaffected.** They define `SiteContent` locally and do not depend on
  `@jdd/schema` at all (see the comment at the top of `packages/ui/src/palette.ts`).
- **jdd-ops root `onboard.js` and the agency repo: affected.** Both pin `v1.18.0`, two tags
  behind `v1.19.1` and missing every v2.2 field, so zod silently strips them on read.

**This corrects decision 48.** I said `detail` needed no schema bump because it already existed.
It exists in `console/src/lib/copy-schema.ts` (the copy *generation* schema, committed) and in
`@jdd/schema`'s `site.ts` (the *site content* schema, untagged). Those are different schemas and
conflating them was an error. `detail` is usable, but only after the tag and re-pin.

`SubpageContent` carrying only `header` + `seo` independently confirms that subpages has no body
copy, which is why `services.items[].detail` is the right home for service prose.

## Decisions

| # | Decision |
|---|---|
| 53 | **Commit and tag the v2.2 schema work as `v1.20.0` and re-pin every consumer, as a PREREQUISITE.** This moves out of Phase 12 and joins P1-P3 before Phase 0. Phases 8 and 9 depend on `PageHeaderContent` and `SectionStyle`, so the plan's current ordering (schema work last) is wrong. Phase 12 then only adds the decision-29 intake fields, which can keep its own later bump. |
| 54 | **Ship Lenis**, as the plan specifies: ~10KB gzipped, dynamically imported, `ssr: false`, disabled under reduced motion and inside the preview iframe. Settles decision 25's open "or equivalent". The CSS-only fallback is not taken. |
| 55 | **Drop the `.tint('#FFF8F0')` from the image grade recipe.** Keep the saturation and contrast passes, which are what actually make mixed-quality photos cohere. With decision 9 moving grounds to warm unbleached neutrals, a warm tint on top pushes the whole page toward sepia. Amends Phase 10. |
| 56 | **Amend both plan halves into one consistent document**, authored by Opus. Two documents that disagree is the single biggest drift risk for a Sonnet executor, which is the thing this whole plan exists to prevent. |

## Prerequisite summary, all four

Fix all of these before Phase 0. Each one invalidates a build gate the plan depends on.

| # | Fix |
|---|---|
| P1 | `npm install` in `template/`; confirm `@jdd/ui#v1.0.2` resolves under current `gh` auth |
| P2 | Convert the console's `@jdd/schema` pin from `file:` to the github tag (decision 40), which is only possible once P4 has produced a tag containing what the console currently relies on |
| P3 | Delete the uncommitted `sectionVars` from `packages/ui/src/palette.ts` (decision 41) |
| P4 | Commit and tag `jdd-schema` v2.2 work as `v1.20.0`; re-pin console, jdd-ops root and the agency (decision 53) |

**P2 and P4 are ordered: P4 first.** Converting the console off `file:` before the tag exists
would strand it on `v1.19.1`, which lacks every v2.2 field the console is actively using.

## Operational note

`CONSOLE_INCLUDE_FIXTURES=0` in `console/.env.local:7`, so `_e2e_test_growth` is hidden from the
roster by default. Per `console/src/lib/fixtures.ts`, the roster's `?fixtures=1` toggle "wins
outright" over the env flag, so decision 43's reference build is reachable without changing the
env. Use the toggle, do not flip the flag.
