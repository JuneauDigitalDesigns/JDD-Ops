# Plan: template fidelity upgrade (v2): section 0 and Phases 0 to 5

> **Part 1 of 2.** Part 2 (`PLAN-template-fidelity-v2-part2.md`, same folder) holds Phases 6
> through 12: chrome and smooth scroll, catalog wave 1, catalog wave 2, page structure, the
> image pipeline, the HVAC vertical language, and intake. Part 2 forward-references §0.3 through
> §0.6 of this document and every artifact Phases 1 to 5 create. Read section 0 before starting
> any phase, in either part.
>
> Authored against `RESEARCH-local-service-visual-design.md` (gaps G1 to G8) and
> `DECISIONS-template-fidelity-v2.md` (decisions 1 to 38). Decision numbers and gap numbers
> below refer to those two files. Those 38 decisions are settled: do not relitigate them and do
> not add scope they excluded.
>
> Decision 33: every phase is independently verifiable, ends in a build gate, and ends in
> something the user can look at. Decision 37: Phases 1 to 4 are the shared foundation, built
> once for all verticals. Decision 34: Phase 5 settles the visual language in standalone HTML
> before any component code is written, and is a hard user gate.

---

## Section 0: ground rules

Everything in this section is load-bearing for both parts of the plan. The seven subsections are
cited by name from Phases 0 to 12.

### 0.1 Repo map, and the one-time install fix you must do first

```
C:\Users\Xander\Desktop\ops\
├── jdd-ops\                     (git repo, never deployed)
│   ├── console\                 the operator app; HOSTS the catalog source of truth
│   ├── template\                the blank Next.js base exported into each client repo
│   ├── packages\ui\             @jdd/ui, ITS OWN GIT REPO (see §0.3)
│   ├── design\catalog-v2\SPEC.md     the catalog design spec (part 2 cites §4, §7, §9, §10a)
│   ├── studio\catalog\AUTHORING_CONTRACT.md   the component authoring rules
│   ├── PERF.md                  at the jdd-ops ROOT, not under console/
│   └── clients\<slug>\repo\     generated client repos
└── jdd-schema\                  @jdd/schema, its own git repo, THREE consumers
```

**Do this before Phase 0, as a prerequisite, not as part of any phase.**

`C:\Users\Xander\Desktop\ops\jdd-ops\template\node_modules` predates the `@jdd/ui` dependency.
Verified 2026-10-05: `template/node_modules/@jdd` does not exist and `template/package-lock.json`
contains no `@jdd/ui` entry, so `cd template && npm run build` fails today on an unresolved
`@jdd/ui/palette` import from `template/src/lib/palette.ts`. Every phase in both parts uses that
build as a gate, so fix it once:

```
cd /c/Users/Xander/Desktop/ops/jdd-ops/template
npm install
npm ls @jdd/ui        # must print @jdd/ui@1.0.2, not "(empty)"
npm run build         # must pass BEFORE you change anything
```

If that build fails for any reason other than a missing `@jdd/ui`, stop and report the exact
error. You are establishing a known-green baseline; do not start Phase 0 without one.

Also record the second half of the baseline:

```
cd /c/Users/Xander/Desktop/ops/jdd-ops/console
npm test                 # must pass: 6 suites in console/test/
npm run build            # must pass
npm run check-schema     # CURRENTLY FAILS, see §0.3. Record the output, do not fix it here.
```

### 0.2 Hard constraints

1. **No em-dashes in any user-facing copy.** That means template copy, vertical presets
   (`console/src/data/verticals/*.ts`), component text, `alt` strings, labels, and console UI
   strings. Use commas, colons, or periods. When you edit a file for any other reason, strip the
   em-dashes you find in its user-facing strings as you go. Code comments are not user-facing and
   may keep theirs; do not churn comments for this.
2. **Never invent client values.** `jdd-ops/CLAUDE.md` forbids it. A missing or unknown field is
   flagged in `_meta.missingFields`, never filled with a plausible guess. This applies to every
   new field, preset value, and placeholder `alt` string in this plan.
3. **`@jdd/schema` zod strips unknown keys.** A field absent from the *reading* app's pinned tag
   is silently deleted on read, with no error. Verify any schema claim against
   `C:\Users\Xander\Desktop\ops\jdd-schema\dist\site.d.ts`, never against `src/`. A new field
   needs a version bump plus a re-pin of all three consumers (§0.3). **Nothing in Phases 0 to 5
   requires a schema change.** If you find yourself wanting one, you have gone outside this half
   of the plan.
4. **Never round-trip a source file through PowerShell `Get-Content` / `Set-Content`.** It
   produces silent UTF-8 mojibake that `tsc` will not catch. Use the Write and Edit tools.
5. **Do not run `next dev --turbo` on the console.** Turbopack breaks `intake.ts` client-schema
   loading. A Turbopack stale CSS cache also survives a full restart; only deleting
   `console/.next` clears it. If a CSS change you just made is missing from the dev server,
   delete `console/.next` before investigating anything else.
6. **`console/src/lib/pages.ts` and `console/src/lib/verticals.ts` are imported by client
   components.** Never add `node:fs`, never add `server-only`, never import `@/lib/export` into
   either.
7. **Component `meta.id`, `meta.category`, `meta.consumes` and `meta.skins` must never change
   while restructuring a component.** The studio registry and the exporter read all four. You may
   ADD fields to `meta` (Phase 4 adds two).

### 0.3 The release-and-repin loop

Two shared packages live outside `jdd-ops` as far as npm is concerned, and both are consumed by
pinned git tags. Editing their source and running a build proves nothing until they are released
and re-pinned, because the consumers read `node_modules`, not the working tree.

#### 0.3a `@jdd/ui`

`C:\Users\Xander\Desktop\ops\jdd-ops\packages\ui` is a **separate git repository** nested inside
the `jdd-ops` working tree. Verified state on 2026-10-05:

- remote `origin` = `https://github.com/JuneauDigitalDesigns/jdd-ui.git`
- existing tags: `v1.0.0`, `v1.0.1`, `v1.0.2`
- `package.json` `"version": "1.0.2"`, `"files": ["src"]`, `"type": "module"`, subpath exports for
  `./color ./palette ./skins ./motion ./icons ./img ./merge ./LeadForm`
- the package ships **source**, not a compiled `dist`. Both `console/next.config.js` and
  `template/next.config.js` carry `transpilePackages: ['@jdd/ui']` because of this. Do not add a
  build step; do not add a `dist`.
- consumers: `console/package.json` and `template/package.json` both pin
  `"@jdd/ui": "github:JuneauDigitalDesigns/jdd-ui#v1.0.2"`. Every exported client repo inherits
  the template's pin through `mergePackageJson`.
- **the working tree is dirty**: `git diff` in `packages/ui` shows an uncommitted 39-line addition
  to `src/palette.ts` adding `SectionStyleLike` and `sectionVars`. Phase 2 deletes it. Do not
  commit it.

**The loop. Run it exactly, every time a phase says "run the §0.3 loop and tag vX.Y.Z".**

```
# 1. typecheck the package on its own
cd /c/Users/Xander/Desktop/ops/jdd-ops/packages/ui
npm run typecheck

# 2. bump the version IN package.json to the tag you are about to cut (edit the file, do not
#    use `npm version`, which creates its own commit and tag with a different message shape)

# 3. commit and tag
git add -A
git commit -m "<what changed>"
git tag vX.Y.Z
git push origin HEAD --tags

# 4. re-pin BOTH consumers. The explicit tagged install is mandatory: a plain `npm install`
#    honours the lockfile, which already resolved the OLD tag to a commit sha, so package.json
#    would say the new version while node_modules stayed on the old one.
cd /c/Users/Xander/Desktop/ops/jdd-ops/console
npm install "github:JuneauDigitalDesigns/jdd-ui#vX.Y.Z"
cd /c/Users/Xander/Desktop/ops/jdd-ops/template
npm install "github:JuneauDigitalDesigns/jdd-ui#vX.Y.Z"

# 5. prove it landed in both trees
grep '"version"' /c/Users/Xander/Desktop/ops/jdd-ops/console/node_modules/@jdd/ui/package.json
grep '"version"' /c/Users/Xander/Desktop/ops/jdd-ops/template/node_modules/@jdd/ui/package.json
#    both must print X.Y.Z

# 6. both builds, in this order
cd /c/Users/Xander/Desktop/ops/jdd-ops/console  && npm test && npm run build
cd /c/Users/Xander/Desktop/ops/jdd-ops/template && npm run build
```

There is no `check-pins` script for `@jdd/ui`; step 5 is the check. If step 5 prints the old
version, the install did not re-resolve: delete the `@jdd/ui` entry from that repo's
`package-lock.json` and re-run step 4 for that repo only.

**The tag sequence this whole plan uses.** One release per phase that touches
`packages/ui/src/**`, and no others:

| Tag | Phase | What it carries |
|---|---|---|
| v1.0.3 | **Phase 2 (this part)** | warm palette defaults, deletion of the unpublished `sectionVars` |
| v1.0.4 | Phase 6 (part 2) | motion deprecations |
| v1.0.5 | Phase 7 (part 2) | five new `SKINS` entries |
| v1.0.6 | Phase 8 (part 2) | seven new `SKINS` entries |
| v1.0.7 | Phase 10 (part 2) | the `img.ts` local-asset branch |

Phases 0, 1, 3, 4, 5, 9, 11 and 12 do not touch `packages/ui/src` and must not cut a tag.

#### 0.3b `@jdd/schema`

`C:\Users\Xander\Desktop\ops\jdd-schema`, its own git repo, currently at version `1.19.1`. It has
**three** consumers, enumerated by `console/scripts/check-pins.mjs`:

1. `C:\Users\Xander\Desktop\ops\jdd-ops\console\package.json`
2. `C:\Users\Xander\Desktop\ops\jdd-ops\package.json`
3. `C:\Users\Xander\Desktop\ops\juneau-digital-designs\package.json`

Unlike `@jdd/ui`, this package ships a compiled `dist` and consumers read only `dist`. So the loop
adds a build:

```
cd /c/Users/Xander/Desktop/ops/jdd-schema
npm run build            # rebuilds dist/, the only thing consumers read
npm test
#  bump package.json version, commit, tag vX.Y.Z, push with --tags
#  then, in EACH of the three consumer roots:
npm install "github:JuneauDigitalDesigns/jdd-schema#vX.Y.Z"
cd /c/Users/Xander/Desktop/ops/jdd-ops/console && npm run check-schema
```

`npm run check-schema` must end with
`@jdd/schema pinned and installed consistently at <spec>.`

**Pre-existing failure you must know about, and must not silently "fix".** On 2026-10-05
`npm run check-schema` fails:

```
· console  file:../../jdd-schema  (installed 1.19.1)
· jdd-ops  github:JuneauDigitalDesigns/jdd-schema#v1.18.0  (installed 1.18.0)
· agency   github:JuneauDigitalDesigns/jdd-schema#v1.18.0  (installed 1.18.0)
✖ @jdd/schema pins diverge across 3 consumers.
```

The console is on a `file:` link to the local working copy at 1.19.1 while the other two are on
the v1.18.0 tag. `check-pins.mjs` compares the raw pin STRINGS, so a `file:` spec can never agree
with a `github:` spec and the check can never go green while it stands. Part 2's Phase 12 requires
it to print "pinned and installed consistently at v1.20.0", so that phase, and only that phase,
must convert the console's pin from `file:../../jdd-schema` to the same `github:…#v1.20.0` spec as
the other two. **Phases 0 to 5 do not touch it.** Record the current output in your Phase 0 notes
as a known pre-existing failure so a later phase does not mistake it for a regression it caused.

### 0.4 The console preview pane is hidden, so screenshots lie

The console's browser preview (`PreviewFrame`, the `/c/<slug>/build` studio, and any screenshot
tool pointed at it) runs with `document.visibilityState === 'hidden'`. Consequences, all measured:

- **`framer-motion` animations never run.** Anything whose resting state is
  `initial={{ opacity: 0 }}` renders invisible and stays invisible. It is not a bug in your
  component.
- **CSS `transition` and `animation` do not advance.** Hover and entrance states freeze at their
  start value.
- **Screenshots of the preview pane are therefore not evidence.** A blank or half-rendered
  section in a preview screenshot tells you nothing about the exported site.

**Rules.**

1. Verify visual work by **DOM inspection** (read the rendered element's class list and computed
   styles) or by **`tsc` / `npm run build`**, never by a preview screenshot.
2. To read a settled value that a transition is holding hostage, inject
   `* { transition: none !important; animation: none !important; }` before reading.
3. For anything whose whole point is motion or scroll behaviour (the sticky call bar, smooth
   scroll, a pin-scroll section), verify in a **real browser against the template dev server**:
   `cd template && npm run dev`, then `http://localhost:3000`. That is the only surface where
   motion actually runs.
4. **Never run `next build` over a live dev server** in the same directory. The two fight over
   `.next` and you get a corrupted build with errors that describe nothing real. Stop the dev
   server first.

### 0.5 Every component-registration touchpoint

This is the complete list, derived by reading the code on 2026-10-05. When part 2 says "register
per §0.5", it means walk this list and action every row that applies. A missed row does not fail
the build; it makes the studio offer something the exporter rejects, or makes a component
invisible in the studio, which is how the `*Starter` variants broke.

| # | File | What to change | When |
|---|---|---|---|
| 1 | `console\src\lib\export.ts` → `CATALOG` (line ~43) | add the component name to its category's array | **every new component** |
| 2 | `console\src\lib\export.ts` → `BODY_SLOTS` (line 64) | add the category id, in researched page order | **new category only** |
| 3 | `packages\ui\src\skins.ts` → `SKINS` | add `Name: [DEF, SOFT, …]`, then run the §0.3 loop | **only if the component takes a `skin` prop** |
| 4 | `console\src\app\c\[slug]\build\categories.tsx` | the default import plus `{ meta as xMeta }`, and one `VariantEntry` row inside the right `CategoryEntry.variants` array | **every new component** |
| 5 | same file, `CategoryEntry['id']` union (line 52) | add the new category id literal | **new category only** |
| 6 | same file, `iconName` union (line 54) | add the icon name literal | **new category only** |
| 7 | same file, a new `CategoryEntry` object in `buildCategories`' returned array, positioned in researched page order | the whole `{ id, label, iconName, variants }` object | **new category only** |
| 8 | `console\src\app\c\[slug]\build\page-order.ts` → `CANONICAL_ORDER` | add the category id in page order | **new category only** |
| 9 | `console\src\app\c\[slug]\build\nav-targets.ts` → `TARGETS` | add `{ categoryId, anchor, label }` | **only if the component renders a DOM `id` the site nav may link to** |
| 10 | `console\src\app\c\[slug]\build\page-templates.tsx` → `PAGE_TEMPLATES` | place the component in at least one template | **every new component**, or the studio never surfaces it outside the raw picker |
| 11 | `console\src\app\c\[slug]\build\compose-page.tsx` → `renderSection` | add a branch | **`pageHeader` variants only.** This function hardcodes `PageHeaderSimple` for the whole `pageHeader` category (line ~40), so a new page-header variant renders as `PageHeaderSimple` in the studio until this is changed |
| 12 | `console\src\lib\export.ts` → `wirePages`' `pageHeader` branch (line ~626) | construct the chosen variant, not a hardcoded one | **`pageHeader` variants only** |
| 13 | `console\src\lib\pages.ts` → `PageTypeId` | add the literal | **new page TYPE only**, not a new component |
| 14 | `template\src\lib\**` | if the component imports a helper from `@/lib/x`, that helper must exist in `template/src/lib/`, not only in `console/src/lib/` | **new shared helper only** |
| 15 | `console\tsconfig.json` → `include` | add the explicit `../template/src/...` path | **only when the CONSOLE imports a template-owned file directly** (currently only `structuredData.ts`) |
| 16 | `console\tailwind.config.ts` → `content` | ensure the glob covers the file | **only for template-owned files carrying Tailwind classes**; Phase 1 adds the `../template/src/lib/**` glob once |

**Things that look like touchpoints and are not.** Verified by grep, do not change these for a new
component or category:

- `console\src\app\api\build\source\route.ts` imports `CATALOG` from `@/lib/export`. No second copy.
- `console\src\lib\skins.ts` is a four-line re-export shim of `@jdd/ui/skins`, kept at that path so
  `verifyCatalogImports` finds it. Never add a `SKINS` literal here.
- `template\src\app\page.tsx` uses category-agnostic `@studio:imports` / `@studio:metadata` /
  `@studio:body:start` / `@studio:body:end` markers. No per-category edit.
- `console\src\lib\copy-schema.ts`, `console\src\lib\copy-brief\*`,
  `console\src\components\wizard\CopyWireframe.tsx` and `console\src\lib\section-labels.ts` are
  keyed by **content section** (the `SiteContent` slice), not by catalog category. A component that
  reads an existing schema slice needs no change in any of them.
- `console\src\app\c\[slug]\build\categories.tsx`'s `iconName` has **no resolver**. Grep for
  `Compass` across `console/src` returns only the union and the literals themselves. Extending the
  union is a type-only edit today; if part 2 tells you to "add the new cases to the icon resolver",
  the correct action is to note that no resolver exists.
- `console\test\catalog-invariants.test.mjs` derives its expectations from `CATALOG`, the registry
  file and the real `SKINS` object. You never edit it to register a component; it simply fails
  until rows 1, 3 and 4 agree.

### 0.6 The vertical-language escalation rule

Decisions 35 and 37 are in tension, and the Known Tensions section of
`DECISIONS-template-fidelity-v2.md` names the mitigation: a vertical's design language must stay a
**thin layer** over one shared foundation. Part 2's `VerticalLanguage` type (Phase 11) has exactly
four axes, deliberately: type pairing, palette, photography direction, rhythm preference. There is
no field that can name a component or a vertical-private page template.

**The tripwire.** If, while building a vertical, a section appears to need its own component, that
is a signal the shared foundation is too thin. It is not a signal to add a field.

**The rule, in priority order:**

1. **Stop.** Do not add a field to `VerticalLanguage`. Do not add a vertical-private page
   template. Do not create `components/catalog/<category>/<Vertical><Name>.tsx`.
2. Ask whether an existing archetype, re-skinned and fed this vertical's own content, does the
   job. In almost every case it does, because the content differs and the structure does not.
3. If it genuinely does not, the fix is to **generalise the needed thing into the shared catalog**
   as a new archetype available to every vertical, which means it belongs in a catalog wave
   (part 2, Phase 7 or 8), not in the vertical's phase.
4. **Escalate to the user** before doing step 3. Report: the vertical, the section, the archetype
   you tried, why it failed, and the shared component you propose instead. The user decides
   whether the foundation gets widened. This is a planning decision, not an implementation one.

`console/test/vertical-language.test.mjs` (part 2, Phase 11) makes clauses 1 and 3 mechanical: it
asserts that `Object.keys(VERTICAL_LANGUAGES.hvac)` is exactly
`['pairingId','palette','photography','rhythm']`, and that the set of page-template ids referenced
by all verticals is a subset of `PAGE_TEMPLATES`. Both fail the moment someone widens the type or
adds a private template.

### 0.7 Phase hygiene

- Work one phase at a time, in order, except where the dependency graph at the end of part 2 marks
  two as parallel (P4 alongside P1 to P3; P10 alongside P7 and P8).
- Every phase ends with the build gate written in its Verification block. Do not start the next
  phase on a red gate.
- `cd` paths in this plan are written in the Git Bash form (`/c/Users/Xander/...`). The Bash tool
  takes them verbatim. If you use the PowerShell tool instead, convert to `C:\Users\Xander\...`.
- When a phase says "the user looks at X", say so explicitly in your report and name the URL,
  file path, or screen. Decision 33 requires something lookable-at per phase.

---

## Phase 0: make the documentation true before anything is built from it

**Goal:** remove the single highest hallucination risk in the codebase, so no later phase can be
told to "match a file that does not exist".
**Discharges:** G5; research §8 item 9. Prepares decisions 21, 23.

`console/DESIGN-LANGUAGE.md` cites seven reference implementations that are **not in the repo**,
and claims five services variants where three exist. An executor told to match
`services/ServicesShowcase.tsx` will invent it. This phase is documentation only: no `.tsx`
changes, no token changes, no build behaviour changes.

### 0.A Verify the claim before you edit (do this first, do not trust this plan)

```
cd /c/Users/Xander/Desktop/ops/jdd-ops/console/src/components/catalog
ls services/ work/ testimonials/
```
Expected on 2026-10-05, and what the rest of this plan assumes: **30 components in 15
categories**, specifically

```
about/        AboutFeature, AboutStory
contact/      ContactCardOverlap, ContactInlineStrip, ContactSplit
faq/          FaqAccordion, FaqStickyAside
finalCta/     FinalCtaBanner, FinalCtaSimple, FinalCtaSplit
footer/       FooterColumns, FooterMinimal
hero/         HeroFormFocus, HeroOverlap, HeroSplit
nav/          NavEmergencyBar, NavMinimal
pageHeader/   PageHeaderSimple
seo/          SeoDefault, SeoLocalBusiness
services/     ServicesAccordion, ServicesGrid, ServicesPanel
testimonials/ TestimonialsCarousel, TestimonialsGrid
trust/        ServiceArea, TrustBadges, TrustReviewsAggregate
work/         BeforeAfter, RecentJobsGrid
```
and these seven files **absent**: `services/ServicesShowcase.tsx`,
`services/ServicesSpotlight.tsx`, `work/WorkSpotlight.tsx`, `work/WorkGrid.tsx`,
`work/WorkMasonry.tsx`, `testimonials/TestimonialsRotator.tsx`, and any testimonials marquee.

If the listing differs from the above, **stop and report the difference**. The archetype table you
are about to write, and Phase 4's lint that enforces it, both depend on this exact set.

### Files modified

#### `C:\Users\Xander\Desktop\ops\jdd-ops\console\DESIGN-LANGUAGE.md`

Rewrite the **Structural archetypes** table and the **Per-category guidance** section so every
reference points at a file that exists today, and every archetype id matches the vocabulary
Phase 4 introduces. Keep the opening principle ("recompose the layout, don't decorate the grid")
verbatim: it is correct and matches Tier B.

Replace the existing archetype table with the following **reconciled archetype table**. The
`Status` column is the only honest way to carry the aspiration without lying about the present.
`Built by` names the phase, which is why this table can only be written now.

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
| `editorial-index` | Full-width numbered rows on hairline rules, imagery revealing on hover | `services/ServicesShowcase.tsx` | **not built, Phase 7** |
| `stacked-panels` | Full-width horizontal panels, one column, hierarchy from panel height | `services/ServicesSpotlight.tsx` | **not built, Phase 7** |
| `feature-rail` | Large feature panel plus a rail of all items; picking one swaps the feature | `work/WorkSpotlight.tsx` | **not built, Phase 7** |
| `horizontal-pin` | Section pins to the viewport while content scrolls sideways | `work/WorkMasonry.tsx` | **not built, Phase 7** |
| `marquee` | A drag and scroll driven rail, no autoplay | `testimonials/TestimonialsMarquee.tsx` | **not built, Phase 7** |
| `hero-first-grid` | CSS grid whose first cell spans two rows and two columns | `work/RecentJobsGrid.tsx` | **recomposed in Phase 7**; today it is `card-grid` |
| `numbered-ledger` | Figures as a numbered ledger on rules, not as cards | `stats/StatsLedger.tsx` | **not built, Phase 8** |
| `none` | Non-visual; emits metadata or JSON-LD only | `seo/SeoDefault.tsx`, `seo/SeoLocalBusiness.tsx` | built |

Then make these specific corrections in the same file:

1. **Delete the claim of "five services variants."** The line currently reads "the five services
   variants are Feature+Rail, Editorial Index, Stacked Panels, Dense Mosaic, Split Accordion."
   Replace with: "Today services carries three variants: `card-grid` (`ServicesGrid`),
   `sticky-swap` (`ServicesAccordion`) and `dense-mosaic` (`ServicesPanel`). Phase 7 of
   `design/PLAN-template-fidelity-v2-part2.md` adds `editorial-index` and `stacked-panels`."
2. **Delete the `work/WorkGrid.tsx` and `testimonials/TestimonialsRotator.tsx` rows entirely.**
   They are not in the table above because part 2 does not build them. Part 2's Phase 7 recomposes
   `RecentJobsGrid` to the `hero-first-grid` archetype instead of adding `WorkGrid`, and ships
   `TestimonialsMarquee` instead of a rotator. Add a one-line note saying so, so a future reader
   does not re-add them.
3. **Remove `Rotator` from the per-category guidance for testimonials.** The three testimonials
   archetypes after Phase 7 are `dense-mosaic`, `snap-carousel`, `marquee`.
4. **Correct the Feature+Rail reference.** It currently points at `services/ServicesGrid.tsx`,
   which was recomposed away from Feature+Rail on 2026-08-19 (its own file header says so).
   `feature-rail`'s only reference is `work/WorkSpotlight.tsx`, built in Phase 7.
5. **Update the Motion & interactivity section** to match decisions 26 and 28: the budget is
   **one or two signature moments per PAGE**, not per section; micro-reveals stay free; cursor
   glow and `parallaxY` are **cut** as ornamental. Note that `parallaxY` stays exported from
   `@jdd/ui/motion` for back-compat (decision 3) but must not be used in new components.
6. **Update the editorial-print signature section** for decision 10: the hairline eyebrow's rule
   and the heavy numerals go **neutral**, not accent. Accent is reserved for the primary CTA and
   for genuine urgency. Replace `bg-accent` with `bg-rule` in the eyebrow snippet and "dim
   inactive, accent active" with "dim inactive, full-ink active".
7. **Delete the `tracking-[-0.03em]` and `tracking-[0.24em]` snippets.** Both are already banned:
   `console/test/catalog-invariants.test.mjs` fails any file containing `tracking-[0.2`, and
   SPEC §3 sets display tracking at `-0.015em`. Point at Phase 1's `tracking-tight` and
   `tracking-display` tokens instead.
8. **Add a header block at the top of the file**:

   ```
   > Reconciled 2026-10-05 against the files actually in the repo (Phase 0 of
   > `design/PLAN-template-fidelity-v2-part1.md`). Before this pass, seven of the reference
   > implementations named here did not exist. If you are about to "match" a file this document
   > names, `ls` it first. Archetype ids are the same vocabulary as `src/lib/archetypes.ts` and
   > each component's `meta.archetype`; `console/test/catalog-invariants.test.mjs` enforces that
   > no two variants in one category share an archetype.
   ```

#### `C:\Users\Xander\Desktop\ops\jdd-ops\design\catalog-v2\SPEC.md`

Add, at the end of §9 (Motion), a **decision-18 amendment note**, verbatim:

```
### §9 amendment, 2026-10-05 (decision 18)

The "Cut entirely" list above bans count-up stats. Decision 18 of
`console/design/DECISIONS-template-fidelity-v2.md` reverses that for ONE case: a dedicated stats
band is now a first-class section category and it DOES count up. The reasoning for the original
cut was that `AboutFeature`'s count-up fired above the fold and competed with LCP; a stats band
sits mid-page, below the fold, so that reasoning does not apply to it.

Scope of the amendment, which is narrow on purpose:
  • `stats/StatsBand.tsx` may count up. It is the only component that may.
  • It must gate on `stillFor(skin, reduce)` and render the final value immediately when still.
  • Everything else in §9 stands, including the autoplay ban: `testimonials/TestimonialsMarquee`
    is drag and scroll driven, with no `setInterval`.
  • Nothing above the fold animates on load. That rule is measured (see PERF.md) and is not
    amended.
```

Do not edit any other part of SPEC.md. §1, §4, §7, §10 and §10a are cited by part 2 and must stay
as they are.

#### `C:\Users\Xander\Desktop\ops\jdd-ops\studio\catalog\COMPONENTS.md`

This file still describes a 16-component, 2-variants-per-category v1 target and a File System
Access API export flow that no longer exists. Replace its body with a six-line pointer so nobody
builds from it:

```
# Component backlog (superseded)

The live catalog is `console/src/components/catalog/**`, registered per
`design/PLAN-template-fidelity-v2-part1.md` §0.5. The authoring rules are in
`AUTHORING_CONTRACT.md` in this folder. The archetype vocabulary and per-category coverage targets
are in `console/DESIGN-LANGUAGE.md`. The build-out plan is
`console/design/PLAN-template-fidelity-v2-part1.md` and `-part2.md`.

This file described a 16-component v1 and an export flow that no longer exists. Kept as a stub so
its path does not 404 from older notes.
```

Leave `AUTHORING_CONTRACT.md` alone. It is correct, it is self-contained, and part 2 cites its §0,
§5 and §10 by number.

### Files created

#### `C:\Users\Xander\Desktop\ops\jdd-ops\console\design\foundation-v2\NOTES.md`

The running record for this upgrade. Create the folder. Seed it with:

- the verified catalog inventory from step 0.A, as a fenced block;
- the reconciled archetype table (copy it, so Phase 4 has a single place to transcribe from);
- the decision-18 amendment note and where it was filed;
- **the pre-existing `check-schema` failure** from §0.3b, quoted verbatim, labelled
  "pre-existing on 2026-10-05, owned by part 2 Phase 12, not caused by this upgrade";
- a one-line entry per phase as you complete it, recording the `@jdd/ui` tag cut (if any) and
  anything you had to decide that this plan did not specify. Part 2's Phase 6 explicitly asks you
  to "note in the plan record which was chosen" for the Lenis-versus-`scroll-behavior` fork; this
  file is that record.

### Verification

```
cd /c/Users/Xander/Desktop/ops/jdd-ops/console && npm test && npm run build
```
Both must still pass: this phase changes no code, so a failure means you edited a `.tsx` by
mistake. Then prove the doc is true:

```
cd /c/Users/Xander/Desktop/ops/jdd-ops
# every .tsx path named in DESIGN-LANGUAGE.md must exist OR be marked "not built"
grep -oE '`[a-zA-Z]+/[A-Za-z]+\.tsx`' console/DESIGN-LANGUAGE.md | tr -d '`' | sort -u | \
  while read p; do [ -f "console/src/components/catalog/$p" ] && echo "OK   $p" || echo "MISS $p"; done
```
Every `MISS` line must correspond to a row whose Status column says "not built, Phase 7" or
"not built, Phase 8". There must be no `MISS` for a row marked "built".

**User looks at:** `console/DESIGN-LANGUAGE.md` rendered, specifically the archetype table's
Status column, and `console/design/foundation-v2/NOTES.md`.

### Out of scope

Any `.tsx` change. Any token, palette or font change. Building any of the seven missing components
(Phase 7 and Phase 8 own those). Trimming the aspiration out of `DESIGN-LANGUAGE.md`: decision 21
says the doc becomes true by the components being built, not by the ambition being deleted.

---

## Phase 1: the exported template gets a real token layer

**Goal:** the thing we ship to clients gains a type scale, spacing scale, radius scale, shadow
scale and tracking scale, from one source that both the preview and the export read, so they
cannot drift.
**Discharges:** G2; decisions 4, 8, 24. Prepares 30(d).

This is decision 4's first move and research §8 item 4 calls it the highest-leverage single change.
`template/tailwind.config.ts` currently extends **only** `colors`, `textColor.accent`, `fontFamily`
(sans, heading) and one `backgroundImage` (`accent-grad`). There is no `fontSize`, `spacing`,
`borderRadius`, `boxShadow`, `letterSpacing` or `maxWidth`. Every size, gutter and radius in the
catalog is an inline arbitrary value decided per component, which is the mechanical reason
components drift as they are edited.

**Read before editing:** `template/tailwind.config.ts`, `console/tailwind.config.ts` (both in
full, including the comment blocks, which explain the two token worlds), and
`design/catalog-v2/SPEC.md` §3 and §5, which contain the measured scale this phase encodes.

**The two token worlds, which you must not conflate.** `console/tailwind.config.ts`'s header says
it and it is still true:

- **Client-brand tokens** (`accent`, `bg`, `bgSoft`, `ink`, `inkSoft`, `rule`, `accent050`,
  `inkPanel`, `onInk`, `urgent`, and the `font-sans` / `font-heading` families) bind to CSS
  variables set per previewed route from `CONTENT.brand`. They are reserved for catalog preview
  components. A client may have a dark palette and that must keep rendering.
- **Console chrome tokens** (`surface`, `panel`, `fg*`, `ui*`, `font-chrome`, `font-display`,
  `shadow-raised|panel|overlay|floating`, `rounded-xl2|panel`, and the whole `fontSize` scale with
  its 14px body floor) are the console's own UI. The console is light-only warm cream. Never unify.

The new sizing tokens this phase adds are a **third** set: they belong to the client-brand world,
they are named so they cannot collide with the chrome `fontSize` keys (`sm`, `base`, `lg`, `xl`,
`label`, `kicker`, `meta`), and they are consumed only by catalog components. The console must gain
them so the studio preview renders the same sizes the export will.

**Note on `textColor.accent`.** Both configs remap `text-accent` to
`var(--accent-text, var(--accent))`. In the **console** the `var(--accent)` fallback is
load-bearing: `--accent-text` is only set where `paletteVars()` is applied (the `/build` preview
subtree), but console chrome also uses `text-accent` (the icon picker), so without the fallback
those chrome elements resolve an undefined var. In the **template** every element that can use
`text-accent` is inside the `<body>` that carries `paletteVars()`, so the fallback is belt and
braces rather than load-bearing. Leave both exactly as they are.

### Files created

#### `C:\Users\Xander\Desktop\ops\jdd-ops\template\src\styles\tokens.ts`

The shared token source. **Both** `template/tailwind.config.ts` and `console/tailwind.config.ts`
import from it, which is the whole point: preview and export cannot drift because there is one
file. It lives under `template/src/styles/` because `TEMPLATE_OWNED_PREFIXES` in
`console/src/lib/export.ts` is `['src/lib/', 'src/styles/']`, so an export with `overwrite: true`
refreshes it into every client repo. `tailwind.config.ts` is in `TEMPLATE_OWNED_FILES`, so the
config that imports it is refreshed in the same pass and the pair can never land half-updated.

The module must be **dependency-free**: no imports at all, no `type { Config }`, plain exported
object literals. It is loaded by Tailwind's config loader (jiti) from two directories and by `tsc`
in two projects.

```ts
/**
 * THE shared design tokens for every client site.
 *
 * Imported by BOTH template/tailwind.config.ts and console/tailwind.config.ts, so the studio
 * preview and the exported site resolve identical sizes. Before this file existed, the template
 * had no scale at all (only fontFamily and one backgroundImage), so every size, gutter, radius and
 * shadow in the catalog was an inline arbitrary value decided per component. That is gap G2 in
 * design/RESEARCH-local-service-visual-design.md and it is the mechanical reason components drift
 * as they are edited.
 *
 * Lives under src/styles/ so TEMPLATE_OWNED_PREFIXES refreshes it into client repos on an
 * `overwrite` export, in the same pass as the tailwind.config.ts that imports it.
 *
 * DEPENDENCY-FREE on purpose: loaded by Tailwind's jiti config loader from two different
 * directories. No imports, no types from tailwindcss.
 *
 * Numbers come from design/catalog-v2/SPEC.md §3 (type) and §5 (buttons), which are measured
 * against a 390px phone and a 1000px+ desktop, not invented here.
 */

/* ── Type scale ───────────────────────────────────────────────────────────────
   Fluid clamp() per decision 8, with negative tracking baked into the large steps so a display
   size is never set without its tracking. Tailwind fontSize entries are
   [size, { lineHeight, letterSpacing, fontWeight? }].

   Key names are deliberately NOT Tailwind's sm/base/lg/xl: the console's own chrome owns those
   keys with a 14px body floor, and these two scales must not collide. */
export const fontSize = {
  // 36px at 390 -> 58px at 1000+, capped. SPEC §3's h1. "Names the service and the city."
  'display-1': ['clamp(2.25rem, 1.42rem + 3.60vw, 3.625rem)', { lineHeight: '1.02', letterSpacing: '-0.022em' }],
  // 32px -> 42px. SPEC §3's h2.
  'display-2': ['clamp(2rem, 1.62rem + 1.65vw, 2.625rem)',    { lineHeight: '1.06', letterSpacing: '-0.018em' }],
  // 24px -> 28px. Sub-section headings, and the large half of a two-step hierarchy inside a
  // stacked-panels or editorial-index row.
  'display-3': ['clamp(1.5rem, 1.35rem + 0.65vw, 1.75rem)',   { lineHeight: '1.12', letterSpacing: '-0.014em' }],
  // 21px fixed. SPEC §3's h3. A card title does not need to grow with the viewport.
  'card-title': ['1.3125rem', { lineHeight: '1.25', letterSpacing: '-0.010em' }],
  // 19px -> 21px. One step above body: the sticky call bar's digits, a hero sub, a pull quote.
  lead:  ['clamp(1.1875rem, 1.13rem + 0.25vw, 1.3125rem)', { lineHeight: '1.42', letterSpacing: '-0.005em' }],
  // 17px fixed. SPEC §3's body. THE workhorse.
  body:  ['1.0625rem', { lineHeight: '1.55' }],
  // 15px fixed. SPEC §3's small / proof text.
  small: ['0.9375rem', { lineHeight: '1.50' }],
  // 13px. The floor. Legal lines, the assurance line under the phone digits, meta.
  // Nothing below this, ever: the next step down is unreadable on a phone in sunlight.
  fine:  ['0.8125rem', { lineHeight: '1.45', letterSpacing: '0.010em' }],
} as const;

/* ── Tracking ─────────────────────────────────────────────────────────────────
   The old `tracking-[-0.03em]` and `tracking-[0.24em]` are both CUT (SPEC §3; the second is
   already enforced by console/test/catalog-invariants.test.mjs). These four are the whole set. */
export const letterSpacing = {
  display: '-0.022em',  // only on text already set at display-1
  tight:   '-0.015em',  // SPEC §3's heading default
  snug:    '-0.010em',
  wide:    '0.010em',   // the ONLY positive step. Not a wide-tracked uppercase eyebrow.
} as const;

/* ── Spacing ──────────────────────────────────────────────────────────────────
   Added to Tailwind's default spacing scale, not replacing it. Only the named steps a component
   should reach for; everything else stays on the stock 4px ramp.

   The `section-*` steps are consumed by rhythm.plugin.ts, which is the ONLY thing that should use
   them: section padding is decided by the page template, never by the component (decision 24). */
export const spacing = {
  gutter:        'clamp(1.25rem, 0.90rem + 1.60vw, 2rem)',  // 20px -> 32px page gutter
  'section-tight':  'clamp(1.75rem, 1.40rem + 1.60vw, 2.75rem)', // 28px -> 44px
  'section-normal': 'clamp(3rem, 2.30rem + 3.20vw, 5rem)',       // 48px -> 80px
  'section-loose':  'clamp(4.50rem, 3.30rem + 5.40vw, 8rem)',    // 72px -> 128px
} as const;

/* ── Radius ───────────────────────────────────────────────────────────────────
   SPEC §5: buttons are 8px. "Nothing is a pill; nothing is rounded-sm."
   `rounded-control` is the single radius for every button, input and tappable chip, so a client
   site cannot end up with three button shapes. */
export const borderRadius = {
  control: '8px',
  panel:   '14px',   // cards, media frames
  slab:    '2px',    // a near-square corner, for a deliberately hard-edged panel
} as const;

/* ── Elevation ────────────────────────────────────────────────────────────────
   One ladder, warm-tinted to match decision 9's warm charcoal ink. The light-surface values are
   byte-for-byte what services/ServicesGrid.tsx already inlines, so adopting the token is a visual
   no-op on that component and a correction everywhere else.

   `shadow-slab` is the card default. `shadow-slab-lift` is its hover twin. `shadow-slab-ink` is
   the inverted-surface twin, because a warm shadow is invisible on a dark panel. */
export const boxShadow = {
  slab:        '0 1px 2px rgba(28,16,9,.05), 0 14px 30px -12px rgba(28,16,9,.22)',
  'slab-lift': '0 2px 4px rgba(28,16,9,.06), 0 22px 42px -14px rgba(28,16,9,.28)',
  'slab-ink':  '0 14px 30px -12px rgba(0,0,0,.50)',
  // The offset-shadow primary CTA from DESIGN-LANGUAGE.md's editorial signature, as a token
  // rather than an inline arbitrary value. Light and inverted variants.
  offset:      '4px 4px 0 rgba(28,16,9,.85)',
  'offset-ink':'4px 4px 0 rgba(255,255,255,.12)',
} as const;

/* ── Measure ──────────────────────────────────────────────────────────────────
   Tier B's "left-aligned ragged-right text with generous margins and controlled max-widths"
   (research §5). `max-w-measure` is the one correct width for a paragraph. */
export const maxWidth = {
  measure: '46ch',
  content: '72rem',   // the page container, matching the catalog's existing max-w-6xl
} as const;
```

#### `C:\Users\Xander\Desktop\ops\jdd-ops\template\src\styles\rhythm.plugin.ts`

A Tailwind plugin emitting the five rhythm classes that part 2's Phase 9 applies. Decision 24:
**section rhythm is encoded at the page-template level, not inside components.** The exporter wraps
each section in a `<div className="rh-*">`; this plugin is what makes that wrapper mean something.

Why a plugin and not utilities in `tokens.ts`: the padding has to **override** the component's own
`py-14 lg:py-20`. Tailwind utilities and plugin utilities sit in the same layer with unreliable
source order, so the override is explicit `!important` on the padding only, which is correct here:
the page template is the higher authority over the component, and that is exactly what decision 24
says.

```ts
/**
 * The section-rhythm utilities, `rh-bleed | rh-tight | rh-normal | rh-loose | rh-text`.
 *
 * Decision 24 of console/design/DECISIONS-template-fidelity-v2.md: rhythm is decided by the PAGE
 * TEMPLATE, never by the component. Research §6 item 8 names uniform section rhythm as one of the
 * eight things that make a site read as AI-made, and decision 30(d) bans it outright. A component
 * cannot see a whole page, so it cannot be the thing that varies.
 *
 * How it is applied: console/src/lib/export.ts's wirePages wraps a section in
 * `<div className="rh-loose">`, and PageStudio's SectionShell applies the same class so the
 * preview and the export agree. The wrapper has exactly one child, which is the component's root
 * element (a <section>, or <header>/<footer> for chrome), hence the `> *` selector.
 *
 * The `!important` is deliberate and is the only one in the system: catalog components carry their
 * own `py-14 lg:py-20`, and the page template has to win. Only padding-block is forced; nothing
 * else about the component is touched.
 */
import plugin from 'tailwindcss/plugin';
import { spacing } from './tokens';

export default plugin(({ addUtilities }) => {
  const band = (v: string) => ({ paddingBlock: `${v} !important` });
  addUtilities({
    // Full-bleed: the component owns its own edges, so the wrapper contributes nothing vertically
    // and lets the child's media reach the viewport edge.
    '.rh-bleed > *': { paddingBlock: '0 !important' },
    '.rh-bleed > * > div': { maxWidth: 'none', paddingInline: '0' },

    '.rh-tight > *':  band(spacing['section-tight']),
    '.rh-normal > *': band(spacing['section-normal']),
    '.rh-loose > *':  band(spacing['section-loose']),

    // Text-dominant: normal band, but the content column is narrowed so the section reads as
    // prose against its neighbours. This is the "alternating text-dominant sections against
    // full-bleed photography" rhythm from research §5.
    '.rh-text > *': band(spacing['section-normal']),
    '.rh-text > * > div': { maxWidth: '60rem', marginInline: 'auto' },
  });
});
```

### Files modified

#### `C:\Users\Xander\Desktop\ops\jdd-ops\template\tailwind.config.ts`

Add the imports and splice the new scales into `theme.extend`. **Keep every existing key exactly as
it is**: `colors` (all of it, including the derived tones and `urgent`), `textColor.accent`,
`fontFamily.sans`, `fontFamily.heading`, and `backgroundImage['accent-grad']`.

```ts
import type { Config } from 'tailwindcss';
import {
  fontSize, letterSpacing, spacing, borderRadius, boxShadow, maxWidth,
} from './src/styles/tokens';
import rhythm from './src/styles/rhythm.plugin';
```

and inside `theme.extend`, after the existing `fontFamily` block:

```ts
      fontSize,
      letterSpacing,
      spacing,
      borderRadius,
      boxShadow,
      maxWidth,
```

and change `plugins: []` to `plugins: [rhythm]`.

Leave `backgroundImage['accent-grad']` in place. Decision 3: back-compat is additive and deprecated
tokens keep resolving, and already-exported client repos have `bg-accent-grad` baked into their
page files. Add a one-line comment above it:
`// DEPRECATED by decision 30(b): no new component may use it. Kept so shipped repos still build.`

Finally, extend `content` so the plugin's own module and the tokens file are not treated as
scannable source noise, and so a client repo that gains `src/lib/StickyCallBar.tsx` in part 2's
Phase 6 has its classes generated. Current value is `['./src/**/*.{ts,tsx}']`, which already covers
both; **no change needed here**. Confirm by reading it rather than assuming.

#### `C:\Users\Xander\Desktop\ops\jdd-ops\console\tailwind.config.ts`

Three changes, each surgical.

1. **Import the shared tokens from the template**, so the preview resolves the same sizes:

```ts
import {
  fontSize as brandFontSize, letterSpacing as brandTracking, spacing as brandSpacing,
  borderRadius as brandRadius, boxShadow as brandShadow, maxWidth as brandMaxWidth,
} from '../template/src/styles/tokens';
import rhythm from '../template/src/styles/rhythm.plugin';
```

2. **Merge, do not replace.** The console's own `fontSize`, `letterSpacing`, `boxShadow` and
   `borderRadius` keys are chrome and must survive. Spread the brand tokens FIRST so a name
   collision resolves in favour of chrome, and add a comment saying why:

```ts
      // CLIENT-BRAND sizing, shared with the exported template via ../template/src/styles/tokens.
      // Spread first so the console's own CHROME keys below always win a name collision: the
      // chrome scale has a 14px body floor that must not be overwritten by a client-site scale.
      // The two sets use disjoint key names on purpose (display-1/card-title/lead/body/small/fine
      // vs sm/base/lg/xl/label/kicker/meta), so no collision is expected; the ordering is a guard.
      fontSize: { ...brandFontSize, /* …the existing console chrome fontSize entries, unchanged… */ },
      letterSpacing: { ...brandTracking, /* …existing tightest/tightish/wideish/widest2… */ },
      spacing: { ...brandSpacing },
      boxShadow: { ...brandShadow, /* …existing raised/panel/overlay/floating/glow… */ },
      borderRadius: { ...brandRadius, /* …existing xl2/panel… */ },
      maxWidth: { ...brandMaxWidth },
```

   **Watch `borderRadius.panel`.** The console already defines `panel: '12px'` (matching `.panel`
   in `globals.css`) and `tokens.ts` defines `panel: '14px'`. The spread order above makes the
   console's 12px win, which is correct: `rounded-panel` in console chrome must keep matching
   `.panel`. Add a comment at that key recording the collision and that it is intentional, so
   nobody "fixes" it later. Catalog preview components must therefore use `rounded-[14px]` only if
   they genuinely need the template value; prefer `rounded-control` and `rounded-slab`, which do
   not collide.

3. **Add the template content glob and the plugin.**

```ts
  content: [
    './src/**/*.{ts,tsx}',
    // Template-owned code the console RENDERS (part 2's Phase 6 imports
    // @template/lib/StickyCallBar into PageStudio). Without this glob its Tailwind classes are
    // never generated in the console build and the preview renders an unstyled bar.
    '../template/src/lib/**/*.{ts,tsx}',
  ],
  ...
  plugins: [rhythm],
```

### Files NOT modified, and why

- `template/src/styles/globals.css`: Phase 2 owns it (the `:root` default palette).
- Any catalog component: migrating the ~30 components off inline arbitrary values onto these
  tokens is part 2's work, done as each component is touched in Phases 7, 8 and 9. This phase only
  makes the tokens exist. **Do not do a sweeping find-and-replace across the catalog here**; it
  would be a large untestable diff in a phase whose gate cannot detect visual regressions.
- `console/tsconfig.json`: `include` is `["next-env.d.ts", "**/*.ts", "**/*.tsx",
  ".next/types/**/*.ts", "../template/src/lib/structuredData.ts"]`. `tailwind.config.ts` matches
  `**/*.ts` and `tsc` follows its imports, so the two new template files typecheck without an
  `include` entry. Part 2's Phase 6 adds an explicit entry for `StickyCallBar.tsx` because that one
  is imported by a `.tsx` component, not by the config.

### Verification

```
cd /c/Users/Xander/Desktop/ops/jdd-ops/console  && npm run build && npm test
cd /c/Users/Xander/Desktop/ops/jdd-ops/template && npm run build
```
A Tailwind config that fails to load the `.ts` token module fails the build loudly, so a green
build is the proof that both configs resolve the shared file.

Then prove the utilities actually generate, which a build alone does not. Add a throwaway element
carrying every new token to `template/src/app/page.tsx` inside the `@studio:body` region:

```tsx
<div className="rh-loose">
  <section className="px-gutter max-w-content mx-auto">
    <h1 className="text-display-1 tracking-display">display-1</h1>
    <h2 className="text-display-2">display-2</h2>
    <h3 className="text-display-3">display-3</h3>
    <p className="text-card-title">card-title</p>
    <p className="text-lead">lead</p>
    <p className="text-body">body</p>
    <p className="text-small">small</p>
    <p className="text-fine">fine</p>
    <button className="rounded-control shadow-slab bg-accent text-accentFg px-6 py-4">control</button>
    <div className="rounded-panel shadow-slab-lift max-w-measure">panel</div>
  </section>
</div>
```

```
cd /c/Users/Xander/Desktop/ops/jdd-ops/template && npm run build
grep -c 'rh-loose' .next/static/css/*.css        # must be >= 1
grep -o 'clamp(2.25rem[^)]*)' .next/static/css/*.css | head -1   # display-1 is in the sheet
```
Then `npm run dev` and look at `http://localhost:3000` in a real browser at 390px and at 1440px:
the eight type steps must visibly step, and `display-1` must grow between the two widths while
`card-title` does not. **Delete the throwaway block before closing the phase** and re-run the
template build.

**User looks at:** the eight type steps at 390px and 1440px side by side in a real browser, and
`template/src/styles/tokens.ts` as a document, since it is now the spec.

### Out of scope

Changing any colour (Phase 2). Changing any font (Phase 3). Migrating components onto the tokens
(part 2, Phases 7 to 9). Adding a `rhythm` field to `SectionRef` or emitting the wrapper from
`wirePages`: that is part 2's Phase 9a, and this phase deliberately ships the classes before
anything applies them so the two changes can be verified separately.

---

## Phase 2: grounds go warm and unbleached, inks go warm charcoal

**Goal:** move every default ground off `#ffffff` and every default ink off `#000000` / cool navy,
re-derive the whole palette, and prove AA still holds for every accent a client can pick.
**Discharges:** decisions 9, 10 (token side), 3; research §8 item 1.

Decision 9 shifts **every derived token**, because `paletteVars()` computes a tint ramp,
`--accent-text` (an AA loop), `--urgent`, `--ink-panel`, `--on-ink`, `--on-ink-soft` and
`--rule-ink` from the seven authored ones. It also ends `@jdd/ui` tag **v1.0.3**.

**Read before editing:** `packages/ui/src/palette.ts` in full (every comment block records a
shipped defect, so none of them is decorative), `packages/ui/src/color.ts`,
`console/test/palette-contrast.test.mjs`, `template/src/styles/globals.css`,
`console/src/data/site.ts` lines 20 to 50, and all six `console/src/data/verticals/*.ts` palettes.

### 2a. The two hardcoded cool defaults in `@jdd/ui`

#### `C:\Users\Xander\Desktop\ops\jdd-ops\packages\ui\src\palette.ts`

Four edits. Nothing else in the file changes.

1. **Add the two warm anchors** near the top, above `paletteVars`:

```ts
/**
 * The warm anchors. Decision 9 of console/design/DECISIONS-template-fidelity-v2.md moves every
 * default ground off pure white and every default ink off pure black / cool navy: research §5
 * records that both 2026 trend data and every Tier B measurement point the same way, and that
 * pure-white grounds plus indigo accents are a named AI-sameness tell (research §6 item 3).
 *
 * These are the fallbacks the derivation reaches for when the client's own ink is unusable, so
 * they have to be concrete values, not a hue rotation of something.
 */
const WARM_INK = '#1A1512';    // warm charcoal. Replaces the old cool navy '#0f1b2d'.
const WARM_PAPER = '#FBF8F4';  // warm off-white. Replaces pure '#ffffff' as a FOREGROUND.
```

2. **`readableOn`** currently signs as `readableOn(bg: string, dark = '#0f1b2d')` and returns
   `'#ffffff'` for the light option, comparing against `contrastRatio(1, lb)` (a hardcoded
   luminance of 1 for pure white). Change the default and the light candidate:

```ts
/** The warm off-white or `dark` (brand ink), whichever contrasts better against `bg`.
 *  Neither candidate is a pure value any more (decision 9): pure white on a dark panel is the
 *  cheap tell, and the warm off-white is 18:1 on the ink panel, so nothing is lost. */
export function readableOn(bg: string, dark = WARM_INK): string {
  try {
    const lb = relLuminance(bg);
    const lightC = contrastRatio(relLuminance(WARM_PAPER), lb);
    const darkC = contrastRatio(relLuminance(dark), lb);
    return darkC > lightC ? dark : WARM_PAPER;
  } catch {
    return WARM_PAPER;
  }
}
```

3. **`accentText`'s direction targets.** It currently steps `toward = isDarkHex(primary) ?
   '#ffffff' : '#000000'`. Change to `WARM_PAPER` and a warm near-black:

```ts
    const toward = isDarkHex(primary) ? WARM_PAPER : '#181310';
```
   Keep the 24-iteration bound, the 8%-per-step `mix`, the "must clear AA on EVERY surface"
   loop over `bgs`, and the `readableOn(primary)` bailout, all unchanged. Those three properties
   are each load-bearing and each documented in the file.

4. **`--accent-fg`'s fallback.** The line is currently
   `readableOn(accent, isDarkHex(ink) ? ink : '#0f1b2d')`. Change the literal to `WARM_INK`:

```ts
    '--accent-fg': passesAA(p.accentFg, accent)
      ? (p.accentFg as string)
      : readableOn(accent, isDarkHex(ink) ? ink : WARM_INK),
```
   Do not change the `passesAA` guard. It exists because a client set `#FFFFFF` on `#e08b29`
   (2.66:1) and the old `??` skipped the computed answer entirely. `paletteVars`' line 50
   `const onInk = readableOn(inkPanel, dark ? ink : '#0f1b2d')` gets the same treatment: replace
   that literal with `WARM_INK` too.

5. **`--accent-grad`.** Leave the token. Decision 3 is additive back-compat and shipped client
   repos use `bg-accent-grad`. Add above it:
   `// DEPRECATED by decision 30(b). Still derived so shipped repos keep rendering; no new component may use it.`

### 2b. Delete the unpublished `sectionVars` from `@jdd/ui`

`packages/ui/src/palette.ts` has an **uncommitted** 39-line addition (verify with
`cd packages/ui && git diff --stat`) exporting `SectionStyleLike` and `sectionVars`. It is not in
the published v1.0.2: `grep -n sectionVars console/node_modules/@jdd/ui/src/palette.ts` returns
nothing.

**Delete both the type and the function from `packages/ui/src/palette.ts`.** Reasons, all three
real:

1. Nothing imports them from `@jdd/ui`. Verified: every `sectionVars` consumer
   (`console/src/app/c/[slug]/build/PageStudio.tsx`, `console/src/lib/export.ts`'s generated
   `import { sectionVars } from '@/lib/palette'`) resolves to the **local** definition in
   `console/src/lib/palette.ts` or `template/src/lib/palette.ts`.
2. Publishing it creates a star-export collision. `template/src/lib/palette.ts` begins
   `export * from '@jdd/ui/palette';` and then defines its own `sectionVars`. A local export
   shadows a star re-export so it compiles, but it is ambiguous to every reader and one refactor
   away from resolving to the wrong implementation.
3. `template/src/lib/palette.ts`'s own header states the correct rationale for where it lives:
   "@jdd/ui is a pinned GitHub dependency; defining it in this template-owned lib means an
   `overwrite` export refreshes it into client repos without republishing @jdd/ui." Publishing it
   would invert that deliberate decision.

After deleting, add a short note in its place:

```ts
/* `sectionVars` is intentionally NOT in this package. It is defined in template/src/lib/palette.ts
   (and its console twin) because those are TEMPLATE-OWNED files: an `overwrite` export refreshes
   them into every client repo with no @jdd/ui release. A copy here was added and never published;
   it was deleted rather than published, to avoid a star-export collision with the template's own
   definition. Keep the two twins byte-identical to each other. */
```

Then **confirm the two twins are still byte-identical** in their `sectionVars` bodies:

```
cd /c/Users/Xander/Desktop/ops/jdd-ops
diff <(sed -n '/export function sectionVars/,/^}/p' console/src/lib/palette.ts) \
     <(sed -n '/export function sectionVars/,/^}/p' template/src/lib/palette.ts)
```
The only expected difference is `_paletteVars` versus `paletteVars` naming; if the bodies differ
otherwise, align the console's to the template's and say so in `NOTES.md`. Do **not** unify
`typographyVars`: the console's version deliberately also applies `fontFamily` and `fontWeight` to
the preview subtree so the brand drawer's font picker does something visible, and a real site must
not have that. Its own comment calls this "the same class of intentional seam as editable.tsx."

### 2c. Release `@jdd/ui` v1.0.3

Run the **§0.3a loop** and tag **v1.0.3**, commit message
`feat: warm palette anchors (decision 9); drop the unpublished sectionVars`. Step 5 of the loop
must print `1.0.3` from **both** `console/node_modules` and `template/node_modules`.

### 2d. The seven authored palettes

One shared warm neutral ground applies to all of them. **Each file keeps its own `accent` and
`accentFg` untouched**: the per-vertical accent is part 2's Phase 11 work for HVAC and a later
cycle for the rest, and decision 11 (honour the trade colour conventions at a higher level) is a
design decision that belongs in a vertical's own phase, not here.

The shared set, used verbatim in all seven files:

```
bg:      "#FAF7F2"   // paper
bgSoft:  "#F1EBE2"   // limestone
ink:     "#1A1512"   // warm charcoal
inkSoft: "#584E45"
rule:    "#DFD6C9"
```

Measured before writing them down, so they are not a guess: `inkSoft #584E45` on `bg #FAF7F2` is
**7.59:1**, and on `bgSoft #F1EBE2` is **6.84:1**. Both clear AA for normal text with margin.
`ink #1A1512` on `bg` is above 15:1.

Files to edit, all seven, `brand.palette` only:

1. `C:\Users\Xander\Desktop\ops\jdd-ops\console\src\data\site.ts` (lines ~34 to 41). This one also
   currently has **no `accentFg`**; leave it absent, the derivation supplies it.
2. `C:\Users\Xander\Desktop\ops\jdd-ops\console\src\data\verticals\hvac.ts`
3. `...\verticals\roofing.ts`
4. `...\verticals\plumbing.ts`
5. `...\verticals\lawn-care.ts`
6. `...\verticals\car-detailing.ts`
7. `...\verticals\health.ts`

While in each of those seven files, also **strip em-dashes from user-facing strings** per §0.2.
`hvac.ts` has at least two: `announcement` ("24/7 emergency HVAC service — call us any time") and
`hero.sub` ("Fast, reliable HVAC service — from emergency repairs"). Replace with a comma or a
colon. Do not reword beyond the punctuation.

#### `C:\Users\Xander\Desktop\ops\jdd-ops\template\src\styles\globals.css`

The `:root` block is the pre-hydration fallback and the standalone-template palette. It is
currently a cool default set (`--bg: #ffffff`, `--ink: #0f1b2d`, `--accent: #1e6fbf`). Replace the
colour values with the warm set plus a sophisticated, trade-coded accent rather than the generic
blue:

```css
:root {
  /* Decision 9: warm unbleached ground, warm charcoal ink. Decision 11: the accent is a
     sophisticated tone of the expected HVAC blue coding, not a saturated primary. This block is
     the pre-hydration fallback and the standalone-template palette; layout.tsx overrides all of
     it per client from CONTENT.brand. */
  --accent: #1F5C7A;
  --accent-fg: #FBF8F4;
  --bg: #FAF7F2;
  --bg-soft: #F1EBE2;
  --ink: #1A1512;
  --ink-soft: #584E45;
  --rule: #DFD6C9;
  /* font vars unchanged here; Phase 3 owns them */
}
```
Leave the `body` and `h1..h6` rules alone.

#### Decision 10's token side

Decision 10 demotes the accent to the primary CTA and urgency only; eyebrows, rules, icons and
numerals go neutral. The **component** side of that is part 2's work as each file is touched. The
**token** side is here, and it is one change: in `packages/ui/src/skins.ts`'s `skinClasses`, the
`eyebrow` key is `'text-accent'` for `soft`, `default` and `editorial`, and `'text-accent200'` for
`inverted` / `contrast`.

**Do not change `skinClasses`.** Changing `eyebrow` would silently restyle every already-exported
client repo on its next `overwrite`, and the eyebrows themselves are being removed from components
rather than recoloured (SPEC §3 cuts wide-tracked uppercase eyebrows; the h2 carries that job).
Instead, add a comment above the `eyebrow` entries recording the direction:

```ts
        // Decision 10 demotes the accent to the primary CTA and urgency only. `eyebrow` keeps
        // text-accent for back-compat (decision 3: a shipped repo must keep rendering), but NO NEW
        // component should use s.eyebrow as a colour cue. Eyebrows are being removed, not
        // recoloured: SPEC §3 gives the h2 that job and puts a plain sentence under it.
```

### 2e. The AA contrast suite

`C:\Users\Xander\Desktop\ops\jdd-ops\console\test\palette-contrast.test.mjs` **already exists**
(verified) and runs the real `@jdd/ui` implementation against seven awkward accents on three
surface sets. **Extend it, do not replace it.** Part 2's Phase 11 reuses its helpers, so the
helpers have to be importable without re-running its tests.

#### `C:\Users\Xander\Desktop\ops\jdd-ops\console\test\helpers\contrast.mjs` (NEW)

Extract the reusable machinery into a plain module with no `node:test` import, so importing it does
not execute any test:

```js
// Shared contrast assertions. Lives outside *.test.mjs on purpose: console/test/
// vertical-language.test.mjs (part 2, Phase 11) imports these, and importing a test file would
// re-run its tests. Runs the REAL implementation from @jdd/ui rather than restating the maths,
// because a test that reimplements the thing it is testing proves nothing.
import assert from 'node:assert/strict';
import { paletteVars, contrast } from '@jdd/ui/palette';

export const AA = 4.5;
export const TYPO = { fontSans: 'x', fontHeading: 'x', headingWeight: 700, bodyWeight: 400 };

/** paletteVars() for one palette object (the 7 authored slots). */
export function varsFor(palette) {
  return paletteVars({ palette, typography: TYPO });
}

/**
 * Every derived token that renders as TEXT clears AA on every surface it can land on.
 * `label` is prefixed to each failure so a caller with many palettes can tell them apart.
 */
export function assertPaletteAA(palette, label) {
  const v = varsFor(palette);
  const on = (fg, bg, what) =>
    assert.ok(contrast(fg, bg) >= AA, `${label}: ${what} ${fg} on ${bg} = ${contrast(fg, bg).toFixed(2)}`);
  on(v['--accent-text'], palette.bg, '--accent-text');
  on(v['--accent-text'], palette.bgSoft, '--accent-text');
  on(v['--accent-fg'], palette.accent, '--accent-fg');
  on(v['--urgent'], palette.bg, '--urgent');
  on(v['--urgent'], palette.bgSoft, '--urgent');
  on(v['--on-ink'], v['--ink-panel'], '--on-ink');
  on(palette.inkSoft, palette.bg, 'inkSoft');
  on(palette.inkSoft, palette.bgSoft, 'inkSoft');
}

/** Decision 9: no authored surface or ink may be a pure value. */
export function assertWarm(palette, label) {
  const pure = new Set(['#ffffff', '#fff', '#000000', '#000']);
  for (const slot of ['bg', 'bgSoft', 'ink', 'inkSoft', 'rule']) {
    assert.ok(
      !pure.has(String(palette[slot]).toLowerCase()),
      `${label}: ${slot} is ${palette[slot]}; decision 9 moves grounds off pure white and inks off pure black`,
    );
  }
}
```

#### `palette-contrast.test.mjs` (MODIFIED)

1. Replace its local `AA`, `TYPO` and `varsFor` with imports from `./helpers/contrast.mjs`. Keep
   `contrast` and `paletteVars` imported directly where its own bespoke assertions need them.
2. **Replace the `LIGHT` and `DEEP_SOFT` bases with the Phase 2d warm set**, and keep `DARK` as is
   (a client may still author a dark palette and that path has a documented history of breaking):

```js
const WARM     = { bg: '#FAF7F2', bgSoft: '#F1EBE2', ink: '#1A1512', inkSoft: '#584E45', rule: '#DFD6C9' };
const WARM_DEEP = { ...WARM, bgSoft: '#E8DFD2' };   // a deeper soft band, the case that nearly failed before
const DARK = { bg: '#0e1116', bgSoft: '#161b22', ink: '#f5f5f5', inkSoft: '#b9b9b9', rule: '#2a2f36' };
```

3. **Extend `ACCENTS`** with the six shipped vertical accents, so the suite is testing the colours
   that actually go out, not only adversarial ones. Keep all seven existing entries:

```js
  ['#E05C2A', 'hvac preset'],          // already present, keep
  ['#475569', 'roofing preset'],
  ['#1E6FA8', 'plumbing preset'],
  ['#3D8E40', 'lawn-care preset'],
  ['#1A1A2E', 'car-detailing preset'],
  ['#0E9C8A', 'health preset'],
  ['#1F5C7A', 'the new globals.css default'],
```

4. **Add three new tests:**

```js
test('every shipped palette is warm and clears AA', async () => {
  // The seven authored palettes as they exist on disk, read rather than restated, so a future
  // edit to a preset is caught here instead of in a browser.
  //  (import CONTENT from ../src/data/site.ts and the six verticals via ../src/lib/verticals.ts's
  //   VERTICAL_PRESETS, which is client-safe and has no node:fs)
});

test('the pre-hydration :root defaults in globals.css are warm', () => {
  // Parse template/src/styles/globals.css's :root block with a regex and run assertWarm on it.
  // This is the one palette no TypeScript import can reach, and it is what a visitor sees for
  // the first paint of every client site.
});

test('a warm ground never resolves a pure-white foreground', () => {
  // readableOn's light candidate is WARM_PAPER, not #ffffff (decision 9). Assert that
  // paletteVars on the DARK base yields an --on-ink that is not '#ffffff'.
});
```

5. **The two existing `accentFg` tests must still pass unchanged.** Check them explicitly, because
   they assert against `'#ffffff'`:
   - `'an illegible accentFg from the schema is REJECTED'` asserts `notEqual(..., '#ffffff')`. After
     the change `readableOn` returns `#FBF8F4` for the light case, so this still passes.
   - `'a legible accentFg from the schema IS honoured'` sets accent `#1C1009` with accentFg
     `#FFFFFF` and asserts `equal(..., '#ffffff')`. That path goes through `passesAA` and returns
     the schema value verbatim, so it is unaffected. **Do not "modernise" this assertion**: it is
     testing that we honour a client who chose correctly, including a client who chose pure white.
   - `'an already-legible accent is passed through unchanged'` uses `#1f6f78` on the old `LIGHT`
     base. On the new `WARM` base recompute: if `#1f6f78` no longer clears 4.5 on `#F1EBE2`, the
     assertion `equal(v['--accent-text'], '#1f6f78')` will fail legitimately. Compute it, and if it
     fails, change the accent in that one test to a value that does pass and note the new ratio in
     the test's comment. Do not weaken the assertion.

### Verification

```
cd /c/Users/Xander/Desktop/ops/jdd-ops/packages/ui && npm run typecheck
cd /c/Users/Xander/Desktop/ops/jdd-ops/console && npm test && npm run build
cd /c/Users/Xander/Desktop/ops/jdd-ops/template && npm run build
grep '"version"' /c/Users/Xander/Desktop/ops/jdd-ops/console/node_modules/@jdd/ui/package.json
grep '"version"' /c/Users/Xander/Desktop/ops/jdd-ops/template/node_modules/@jdd/ui/package.json
# both: 1.0.3
grep -rn "0f1b2d\|'#ffffff'\|#FFFFFF" /c/Users/Xander/Desktop/ops/jdd-ops/packages/ui/src/palette.ts
# expect ZERO hits for 0f1b2d; any #ffffff hit must be inside a comment quoting a historic value
grep -rn 'sectionVars' /c/Users/Xander/Desktop/ops/jdd-ops/packages/ui/src/
# expect only the explanatory comment, no `export function`
```

Then look at it, which no test can do:

```
cd /c/Users/Xander/Desktop/ops/jdd-ops/template && npm run dev
```
Open `http://localhost:3000`. The page ground must be warm paper, not white, and the body ink must
be warm charcoal, not navy. Then start the console (`cd console && npm run dev`, port 3040, **not
`--turbo`**) and open a client's `/c/<slug>/build`: the preview must show the same warm ground, and
the Brand drawer's palette pane must read the new hexes.

**User looks at:** the template dev server and the console preview side by side at the same zoom.
The question is whether the ground reads as paper rather than as a screen, and whether the ink
reads warm. A side-by-side against the old pure-white screenshot is the clearest way to see it.

### Out of scope

Per-vertical accents (part 2, Phase 11 for HVAC; a later cycle for the other five). Removing
`text-accent` from any component (part 2, as each file is touched). Deleting `--accent-grad` or the
three deprecated skin ids: decision 3 keeps both resolving, and `skins.ts`'s own header explains
that `editorial` / `contrast` / `quiet` must stay in `SkinId` and in `skinClasses` so an
already-exported repo with `skin="editorial"` baked into its `page.tsx` keeps rendering.

---

## Phase 3: the font registry is replaced by curated pairings

**Goal:** the operator picks one curated pairing instead of two independent fonts from a list that
is, verbatim, the AI-tell font list.
**Discharges:** G1; decisions 5, 6, 7. Supplies `FONT_PAIRINGS` and `pairingFor(id)` including the
`'instrument'` pairing that part 2's Phase 11 names.

Research §7 G1: `console/src/lib/fonts.ts` offers exactly Inter, Manrope, Poppins, Sora, Work Sans,
Plus Jakarta Sans, Roboto Slab, Playfair Display. Six of eight are the canonical
statistically-average web fonts, and no combination out of that list reads Tier B. Decision 6 says
replace it entirely; decision 7 sets the model (single high-quality grotesque, display and body the
same family, differentiated by weight, size and tracking); decision 5 sets the licensing (best
free and open faces, self-hosted woff2, no paid regime).

### 3a. Trace the chain before you change it

The whole chain, verified 2026-10-05. Read every file in it before editing any of it.

```
console/src/lib/fonts.ts          FONT_OPTIONS[] : { id, label, varName, stack, role }
  ├─ console/src/app/c/[slug]/build/brand/TypographyPane.tsx   line 6, line 50
  │     FontSpecimenList filters by role, writes o.stack via setField(path, o.stack)
  │     into brand.typography.fontHeading and brand.typography.fontSans
  └─ console/src/components/fields/index.tsx                   line 14, line 149
        FontSelect: the same list as a <select>, same two paths

brand.typography.{fontSans,fontHeading}  (the full `stack` STRING, e.g.
  "var(--font-inter), system-ui, sans-serif")
  ├─ console/src/lib/palette.ts  typographyVars()  -> --font-sans / --font-heading
  │     (plus fontFamily + fontWeight on the preview subtree, console-only, intentional)
  ├─ template/src/lib/palette.ts -> @jdd/ui/palette typographyVars() -> the same two vars
  └─ tailwind: fontFamily.sans = var(--font-sans), fontFamily.heading = var(--font-heading)
        in BOTH tailwind.config.ts files

the CSS variables the stacks NAME must be defined by a loaded next/font:
  ├─ console/src/lib/fonts.loader.ts    industryFontVars  (ALL EIGHT, always)
  │     consumed by console/src/app/layout.tsx line 7 and line 47
  └─ template/src/lib/fonts.loader.ts   fontVarsFor(...stacks)  (SELECTIVE)
        consumed by template/src/app/layout.tsx line 7 and the <html className=...>
```

**The asymmetry between the two loaders is deliberate and must survive this phase.**
`template/src/lib/fonts.loader.ts`'s header records the measurement: it used to export a single
`industryFontVars` string attached unconditionally, `next/font` preloads by default, and every
client site therefore shipped **12 `<link rel="preload" as="font">` tags and 292KB of woff2**, the
largest byte category on the page. LCP was 4.2s of which 3519ms (84%) was Render Delay, on a text
element. Lighthouse Performance 84. Two fixes were needed and both must be preserved:

1. `preload: false` on **every** family in the template loader.
2. `fontVarsFor()` attaches only the families the brand's stacks actually name, so an unreferenced
   `@font-face` never matches an element and is never downloaded.

The console's loader deliberately still loads everything and does **not** set `preload: false`,
because it is the font picker and preview surface and needs every family resolvable at once. Its
own comment says "Do not sync the two." Honour that.

### 3b. The five pairings

All five exist in the installed Next's Google font list (verified against
`console/node_modules/next/dist/compiled/@next/font/dist/google/index.d.ts`), all are open-licensed,
`next/font/google` self-hosts the woff2 so decision 5 is satisfied with no licensing regime, and
none is on the AI-tell list.

| id | Family | Weights available | Display weight | Body weight | Why it reads premium |
|---|---|---|---|---|---|
| `instrument` | Instrument Sans | 400 to 700 | **700** | 400 | Neutral-modern grotesque with real aperture control. The closest free analogue to the Suisse Intl that Haven Constructions self-hosts. **The default.** |
| `schibsted` | Schibsted Grotesk | 400 to 900 | 800 | 400 | Editorial grotesque, built for a newspaper. Carries an 800 without going generic. |
| `bricolage` | Bricolage Grotesque | 200 to 800 | 800 | 400 | Characterful display grotesque. Has a voice, which is the documented antidote to statistical averaging. |
| `figtree` | Figtree | 300 to 900 | 800 | 400 | Warm humanist. The right register for a trade whose language is reassurance. |
| `archivo` | Archivo | 100 to 900 | 800 | 500 | Grotesque with real width range; the closest free analogue to a condensed trade face without being Teko. |

**`instrument` caps at 700.** That is why a pairing carries its own display weight rather than
inheriting SPEC §3's blanket 800: Instrument Sans has no 800, and asking `next/font` for one is a
build error. Record this in the pairing's own comment.

### Files created

#### `C:\Users\Xander\Desktop\ops\jdd-ops\console\src\lib\fonts.ts` (REPLACED, same path)

Keep the path. Two call sites import `@/lib/fonts` and the file must stay client-safe (no
`next/font` import), which its current header already states.

```ts
// Curated TYPE PAIRINGS, replacing the old loose FONT_OPTIONS list (decision 6 of
// console/design/DECISIONS-template-fidelity-v2.md).
//
// WHY A PAIRING AND NOT TWO DROPDOWNS. The old registry offered eight families across two
// independent selects, which is 64 combinations, of which roughly four were any good and most
// read as the statistically-average web (gap G1: six of the eight were Inter / Manrope / Poppins /
// Sora / Work Sans / Plus Jakarta Sans). An operator cannot be expected to know which pairing is
// premium. So the operator picks ONE pairing and gets a whole typographic position.
//
// THE MODEL (decision 7): a single high-quality grotesque carries the whole site. Display and body
// are the SAME family, differentiated by weight, size and tracking. This is Haven Constructions'
// move (Suisse Intl alone) rather than Spence's (a paid display serif over a paid grotesque), and
// it is the one of the two that is reachable with open faces.
//
// LICENSING (decision 5): every family here is open-licensed and served by next/font/google, which
// SELF-HOSTS the woff2 at build time. No Typekit, no paid regime, no runtime third-party request.
//
// CLIENT-SAFE: no next/font import here, so the Brand drawer can use it. The families are loaded
// in fonts.loader.ts (console) and template/src/lib/fonts.loader.ts (template). A `varName` that
// no loader defines means that font silently never loads, so the two loaders' VAR_TO_CLASS keys
// must stay in step with `varName` below. console/test/fonts.test.mjs asserts that they do.

/** One curated typographic position. `display` and `body` are treatments of ONE family. */
export interface FontPairing {
  id: string;
  label: string;
  /** The CSS variable both loaders define via next/font. */
  varName: string;
  /** The full font-family stack written into brand.typography. */
  stack: string;
  /** Display treatment. `weight` must be a weight the family actually ships. */
  display: { weight: number; tracking: string; lineHeight: number };
  body: { weight: number };
  /** One sentence for the operator, shown under the specimen. No em-dashes. */
  note: string;
}

export const FONT_PAIRINGS: FontPairing[] = [
  {
    id: 'instrument',
    label: 'Instrument',
    varName: '--font-instrument',
    stack: 'var(--font-instrument), system-ui, sans-serif',
    // Instrument Sans ships 400 to 700 ONLY. SPEC §3 asks for 800 headings; this family has no
    // 800, and requesting one from next/font is a build error. 700 at display-1 with -0.022em
    // tracking reads as heavy as an 800 at a looser track.
    display: { weight: 700, tracking: '-0.022em', lineHeight: 1.02 },
    body: { weight: 400 },
    note: 'Neutral and modern. The quietest of the five, and the one that gets out of the way of photography.',
  },
  {
    id: 'schibsted',
    label: 'Schibsted Grotesk',
    varName: '--font-schibsted',
    stack: 'var(--font-schibsted), system-ui, sans-serif',
    display: { weight: 800, tracking: '-0.020em', lineHeight: 1.02 },
    body: { weight: 400 },
    note: 'Editorial. Built for a newspaper, so it holds a heavy weight without looking generic.',
  },
  {
    id: 'bricolage',
    label: 'Bricolage Grotesque',
    varName: '--font-bricolage',
    stack: 'var(--font-bricolage), system-ui, sans-serif',
    display: { weight: 800, tracking: '-0.018em', lineHeight: 1.00 },
    body: { weight: 400 },
    note: 'Has a voice. Pick it when the business has one too.',
  },
  {
    id: 'figtree',
    label: 'Figtree',
    varName: '--font-figtree',
    stack: 'var(--font-figtree), system-ui, sans-serif',
    display: { weight: 800, tracking: '-0.020em', lineHeight: 1.04 },
    body: { weight: 400 },
    note: 'Warm and humanist. The friendliest of the five without being soft.',
  },
  {
    id: 'archivo',
    label: 'Archivo',
    varName: '--font-archivo',
    stack: 'var(--font-archivo), system-ui, sans-serif',
    display: { weight: 800, tracking: '-0.024em', lineHeight: 0.98 },
    // Archivo's 400 is slightly light at 17px, so its body steps up one notch.
    body: { weight: 500 },
    note: 'Tight and industrial. The closest to a trade condensed face without the 2016 register.',
  },
];

export const DEFAULT_PAIRING_ID = 'instrument';

const BY_ID = new Map(FONT_PAIRINGS.map((p) => [p.id, p]));

/** The pairing for an id, falling back to the default. Guarded because a draft or a client record
 *  can carry an id from a registry revision that no longer exists, and a missing pairing must not
 *  crash the Brand drawer. */
export function pairingFor(id: string | null | undefined): FontPairing {
  return (id ? BY_ID.get(id) : undefined) ?? BY_ID.get(DEFAULT_PAIRING_ID)!;
}

/**
 * A pairing as `brand.typography`. Exactly the six fields the schema's typography object carries,
 * so a caller can splat it: `brand.typography = typographyFor('instrument')`.
 *
 * This is what makes a pairing ONE choice: the operator picks an id and all six fields move
 * together, instead of two font strings moving independently of three numeric treatments.
 */
export function typographyFor(id: string | null | undefined) {
  const p = pairingFor(id);
  return {
    fontSans: p.stack,
    fontHeading: p.stack,
    headingWeight: p.display.weight,
    bodyWeight: p.body.weight,
    headingTracking: p.display.tracking,
    headingLineHeight: p.display.lineHeight,
  };
}

/** The pairing whose `stack` matches an authored brand.typography value, or null for a system
 *  stack or a stack from the retired FONT_OPTIONS registry. The Brand drawer uses this to show
 *  which pairing is selected without storing a separate id in the schema. */
export function pairingIdFromStack(stack: string | null | undefined): string | null {
  if (!stack) return null;
  return FONT_PAIRINGS.find((p) => p.stack === stack)?.id ?? null;
}
```

**Note on where the id is stored.** `pairingIdFromStack` exists so this phase needs **no
`@jdd/schema` change**: the selected pairing is recovered from the `stack` string already in
`brand.typography.fontSans`, which the exporter already writes. Do not add a `pairingId` field to
the schema. That would be a version bump, a re-pin of three consumers, and a silent-data-loss
window, to store something derivable.

#### `C:\Users\Xander\Desktop\ops\jdd-ops\console\test\fonts.test.mjs` (NEW)

Four assertions. This is the phase's real gate, because a `varName` with no loader entry fails
silently rather than loudly.

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FONT_PAIRINGS, DEFAULT_PAIRING_ID, pairingFor, typographyFor, pairingIdFromStack }
  from '../src/lib/fonts.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OPS = path.resolve(ROOT, '..');

test('every pairing varName is defined by BOTH loaders', () => {
  // A varName the loader does not map means that font silently never loads: the stack resolves to
  // its system fallback and the site looks like it was never styled. There is no error.
  const consoleLoader = readFileSync(path.join(ROOT, 'src/lib/fonts.loader.ts'), 'utf8');
  const tplLoader = readFileSync(path.join(OPS, 'template/src/lib/fonts.loader.ts'), 'utf8');
  for (const p of FONT_PAIRINGS) {
    assert.ok(consoleLoader.includes(`'${p.varName}'`), `console loader is missing ${p.varName}`);
    assert.ok(tplLoader.includes(`'${p.varName}'`), `template loader is missing ${p.varName}`);
  }
});

test('the template loader keeps preload:false on every family', () => {
  // Measured: blanket preload cost 292KB of woff2 and 84% of a 4.2s LCP in Render Delay.
  // See the header of template/src/lib/fonts.loader.ts and PERF.md.
  const tpl = readFileSync(path.join(OPS, 'template/src/lib/fonts.loader.ts'), 'utf8');
  const families = tpl.match(/=\s*[A-Z][A-Za-z_]*\(\{[^}]*\}\)/g) ?? [];
  assert.equal(families.length, FONT_PAIRINGS.length);
  for (const f of families) assert.match(f, /preload:\s*false/, f);
});

test('the default pairing resolves and every id is unique', () => {
  assert.equal(pairingFor(DEFAULT_PAIRING_ID).id, DEFAULT_PAIRING_ID);
  assert.equal(pairingFor('nope').id, DEFAULT_PAIRING_ID);
  assert.equal(pairingFor(null).id, DEFAULT_PAIRING_ID);
  assert.equal(new Set(FONT_PAIRINGS.map((p) => p.id)).size, FONT_PAIRINGS.length);
  assert.ok(FONT_PAIRINGS.some((p) => p.id === 'instrument'), 'part 2 Phase 11 names this id');
});

test('typographyFor round-trips through pairingIdFromStack', () => {
  for (const p of FONT_PAIRINGS) {
    const t = typographyFor(p.id);
    assert.equal(pairingIdFromStack(t.fontSans), p.id);
    assert.equal(t.fontHeading, t.fontSans, 'decision 7: one family, two treatments');
  }
  assert.equal(pairingIdFromStack('-apple-system, sans-serif'), null);
});
```

### Files modified

#### `C:\Users\Xander\Desktop\ops\jdd-ops\console\src\lib\fonts.loader.ts`

Replace the eight imports and eight constructions with the five pairings' families. Keep
`industryFontVars` as the exported name and its shape (a single space-joined string), because
`console/src/app/layout.tsx` line 47 interpolates it into `<html className>` alongside the chrome
fonts. Keep the absence of `preload: false`, and add the reason as a comment so a future reader
does not "sync" it with the template.

```ts
import { Instrument_Sans, Schibsted_Grotesk, Bricolage_Grotesque, Figtree, Archivo }
  from 'next/font/google';

// Explicit weight arrays, not 'variable': loading the variable axis costs materially more bytes
// and the pairings use exactly two weights each. See lib/fonts.ts for which.
const instrument = Instrument_Sans({ subsets: ['latin'], variable: '--font-instrument', weight: ['400', '700'], display: 'swap' });
const schibsted  = Schibsted_Grotesk({ subsets: ['latin'], variable: '--font-schibsted', weight: ['400', '800'], display: 'swap' });
const bricolage  = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage', weight: ['400', '800'], display: 'swap' });
const figtree    = Figtree({ subsets: ['latin'], variable: '--font-figtree', weight: ['400', '800'], display: 'swap' });
const archivo    = Archivo({ subsets: ['latin'], variable: '--font-archivo', weight: ['500', '800'], display: 'swap' });

// The CONSOLE loads all five unconditionally and WITHOUT preload:false, unlike the template's
// twin. It is the pairing picker and the preview surface, so every family has to be resolvable at
// once and the bytes are an operator-machine cost, not a client-site cost. Do not sync the two.
export const industryFontVars = [
  instrument.variable, schibsted.variable, bricolage.variable, figtree.variable, archivo.variable,
].join(' ');
```

#### `C:\Users\Xander\Desktop\ops\jdd-ops\template\src\lib\fonts.loader.ts`

Same five families, with `preload: false` on each, and `VAR_TO_CLASS` rekeyed. **Keep the entire
header comment block**: it is the record of the 292KB measurement and the reason this file is
selective. Update only the sentence that says "all eight" to "all five", and update the note about
the console's twin.

```ts
const instrument = Instrument_Sans({ subsets: ['latin'], variable: '--font-instrument', weight: ['400', '700'], display: 'swap', preload: false });
// …the other four, same shape, each with preload: false…

const VAR_TO_CLASS: Record<string, string> = {
  '--font-instrument': instrument.variable,
  '--font-schibsted': schibsted.variable,
  '--font-bricolage': bricolage.variable,
  '--font-figtree': figtree.variable,
  '--font-archivo': archivo.variable,
};
```

Keep `fontVarsFor(...stacks)` and its word-boundary regex (`${varName}(?![\\w-])`) exactly as they
are. The boundary matters: `--font-archivo` must not match inside a hypothetical
`--font-archivo-expanded`.

#### `C:\Users\Xander\Desktop\ops\jdd-ops\console\src\app\c\[slug]\build\brand\TypographyPane.tsx`

The pane currently shows two `FontSpecimenList`s (heading, body) plus two `WeightPicker`s plus two
sliders. Decision 6 collapses the two font lists into **one pairing list**, and the pairing already
carries weight, tracking and line height, so the pickers and sliders become overrides rather than
primary controls.

Changes:

1. `import { FONT_PAIRINGS, pairingIdFromStack, typographyFor } from '@/lib/fonts';` and drop the
   `FONT_OPTIONS` import.
2. Delete `FontSpecimenList` and replace it with a `PairingList` that renders one button per
   pairing. Each button:
   - is `aria-pressed` when `pairingIdFromStack(str(content,'brand.typography.fontSans')) === p.id`;
   - renders the client's own `brand.name` (falling back to the existing `SPECIMEN_FALLBACK`,
     `'Aa Hamburgefons'`) at `fontFamily: p.stack`, `fontWeight: p.display.weight`,
     `letterSpacing: p.display.tracking`, so the specimen shows the actual display treatment, not
     just the family;
   - shows `p.label` above and `p.note` below at the pane's existing small sizes;
   - **on click writes all six fields**, each through the existing `setField` so each lands on the
     undo stack as one logical change:
     ```ts
     const t = typographyFor(p.id);
     setField('brand.typography.fontSans', t.fontSans);
     setField('brand.typography.fontHeading', t.fontHeading);
     setField('brand.typography.headingWeight', t.headingWeight);
     setField('brand.typography.bodyWeight', t.bodyWeight);
     setField('brand.typography.headingTracking', t.headingTracking);
     setField('brand.typography.headingLineHeight', t.headingLineHeight);
     ```
3. Keep both `WeightPicker`s and both sliders below the pairing list, under a small heading reading
   `Overrides`, with one line of helper copy: `A pairing sets all of these. Change one only if the
   client asks.` Keep `headingTracking`'s string-with-em-suffix write exactly as it is; the pane's
   own comment notes that the slider is numeric and must write the suffix back or the schema shape
   silently changes.
4. Keep the isolated specimen block at the bottom unchanged.
5. Keep the whole header comment block about what actually reaches the live preview. It is accurate
   and it is the only place that explains why a hero's own `leading-[0.95]` outranks the brand
   value.

#### `C:\Users\Xander\Desktop\ops\jdd-ops\console\src\components\fields\index.tsx`

`FontSelect` (line ~144) is the second, simpler picker: a `<select>` over `FONT_OPTIONS` filtered
by `role`, used wherever a generic field list is rendered. Replace it with a `PairingSelect` over
`FONT_PAIRINGS`, writing the same six fields on change. Drop the `filter: 'sans' | 'heading'` prop
(there is no role axis any more) and update every call site; grep for `FontSelect` to find them.
Keep the "System (current)" escape option for a brand whose stack matches no pairing, so an
existing client's authored system stack is not silently reassigned by opening the drawer.

#### The seven authored `brand.typography` objects

All seven currently carry a plain system stack:
`"-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"` for both `fontSans` and
`fontHeading`, `headingWeight: 700`, `bodyWeight: 400`, `headingTracking: "-0.01em"`,
`headingLineHeight: 1.2`. Set each to `typographyFor('instrument')`'s values, written out as
literals (these are data files, not code that can call a function):

```ts
    typography: {
      fontSans:          "var(--font-instrument), system-ui, sans-serif",
      fontHeading:       "var(--font-instrument), system-ui, sans-serif",
      headingWeight:     700,
      bodyWeight:        400,
      headingTracking:   "-0.022em",
      headingLineHeight: 1.02,
    },
```

Files: `console/src/data/site.ts` and the six `console/src/data/verticals/*.ts`. Per-vertical
pairings are part 2's Phase 11 (`VerticalLanguage.pairingId`); everything starts on `instrument`.

**This changes the byte profile of every client site**, from zero font bytes (a system stack ships
nothing) to one self-hosted family at two weights. That is the intended trade: G1 says a client
cannot currently pick a combination that reads Tier B, and a system stack is the most average
possible answer. The template loader's selectivity means it is **one** family, not five, and
`preload: false` means it is fetched after CSS has established it is wanted. Record the measured
cost in `NOTES.md` after the Phase 3 verification run.

### Verification

```
cd /c/Users/Xander/Desktop/ops/jdd-ops/console  && npm test && npm run build
cd /c/Users/Xander/Desktop/ops/jdd-ops/template && npm run build
grep -rn "FONT_OPTIONS" /c/Users/Xander/Desktop/ops/jdd-ops/console/src
# expect ZERO hits. Any hit is a call site you missed and the build will have caught it.
```

Then prove only one family ships, which is the part the build cannot tell you:

```
cd /c/Users/Xander/Desktop/ops/jdd-ops/template && npm run build
ls .next/static/media/*.woff2 | wc -l      # expect 2 (one family, two weights), not 10
grep -ro 'font-instrument' .next/static/css/ | head -1   # the chosen family is in the sheet
grep -ro 'font-schibsted'  .next/static/css/ | wc -l     # expect 0: an unchosen family is absent
```

Then look at it:

```
cd /c/Users/Xander/Desktop/ops/jdd-ops/template && npm run dev   # http://localhost:3000
cd /c/Users/Xander/Desktop/ops/jdd-ops/console  && npm run dev   # http://localhost:3040
```
In the console, open a client's `/c/<slug>/build`, open the Brand drawer, and click through all
five pairings. The live preview to the left must change family, weight, tracking and line height on
each click. In DevTools Network, filter to `font`: a single pairing must fetch two woff2 files and
no more.

**User looks at:** the five specimens in the Brand drawer, each rendering the client's own business
name at that pairing's display treatment, and the live preview changing as each is clicked. The
question is whether any of the five reads like the Tier A font list, and whether `instrument`
carries a 58px `display-1` convincingly at 700.

### Out of scope

Self-hosting a woff2 outside `next/font/google` (decision 5 accepts Google-served open faces, which
`next/font` self-hosts at build time anyway). A display serif paired against a grotesque: decision
7 settled on one family. A `pairingId` field in `@jdd/schema`. Per-vertical pairings (part 2,
Phase 11). Changing any component's typography classes (part 2).

---

## Phase 4: the variety rule and the four bans become mechanical

**Goal:** archetype variety stops being prose in a markdown file and becomes a failing test, and
the four named AI tells become lints rather than good intentions.
**Discharges:** decisions 23, 30(a), 30(b), 30(c), 26, 12; research §6 items 1, 2, 3, 8. Prepares
30(d) for part 2's Phase 9.

This phase is **independent of Phases 1 to 3** and can run alongside them (see part 2's dependency
graph). It touches 30 component files but each change is one or two lines, and the new tests are
what make the change safe.

**Read before editing:** `console/test/catalog-invariants.test.mjs` in full (every existing test
corresponds to a defect that shipped and passed typecheck, build and Lighthouse, so none is
ceremonial), `studio/catalog/AUTHORING_CONTRACT.md` §6 for the `meta` shape, and the reconciled
archetype table you wrote in Phase 0.

### 4a. The archetype vocabulary as a module

#### `C:\Users\Xander\Desktop\ops\jdd-ops\console\src\lib\archetypes.ts` (NEW)

Dependency-free so a `.mjs` test can import it by relative path, and client-safe so the studio can
show an archetype label in the picker later.

```ts
/**
 * The structural-archetype vocabulary. Decision 23 of
 * console/design/DECISIONS-template-fidelity-v2.md: every component DECLARES its archetype in
 * `meta.archetype`, and console/test/catalog-invariants.test.mjs fails when two variants in one
 * category share one. The variety rule becomes mechanical instead of prose.
 *
 * WHY THIS MATTERS. Research §6 item 7 names "identical navigation patterns across every section
 * and page" and item 8 names "uniform section rhythm" as two of the eight things that make a site
 * read as AI-made. Gap G6 is that with two variants in six categories there is not enough catalog
 * for two sites built from it to look like different sites: two clients in the same vertical land
 * on the same composition. The collision lint is what stops a THIRD variant being added as a
 * decorated copy of an existing one, which is the cheap way to grow a count without growing
 * variety.
 *
 * DEPENDENCY-FREE on purpose: imported by relative path from a .mjs test.
 * Keep in step with the archetype table in console/DESIGN-LANGUAGE.md.
 */
export const ARCHETYPES = [
  'accordion',
  'aggregate-badge',
  'asymmetric-split',
  'before-after',
  'card-grid',
  'centered-statement',
  'column-grid',
  'count-up-centerpiece',
  'dense-mosaic',
  'editorial-index',
  'feature-rail',
  'form-led-split',
  'full-bleed-band',
  'full-bleed-overlay',
  'hero-first-grid',
  'horizontal-pin',
  'inline-strip',
  'map-list',
  'marquee',
  'numbered-ledger',
  'overlap-split',
  'snap-carousel',
  'stacked-bars',
  'stacked-panels',
  'sticky-bar',
  'sticky-swap',
  /** Non-visual. SEO variants emit metadata or JSON-LD and render nothing, so they have no
   *  structure to vary and are exempt from the collision rule. */
  'none',
] as const;

export type Archetype = typeof ARCHETYPES[number];

/** Categories exempt from the collision rule, because their members have no structure. */
export const COLLISION_EXEMPT_CATEGORIES = ['seo'] as const;
```

### 4b. `archetype` and `signature` on all 30 metas

Add exactly two fields to each component's existing `meta` object. **Do not touch `id`, `category`,
`label`, `consumes`, `sharedDeps` or `skins`** (§0.2 rule 7).

```ts
  /** Structural archetype, from src/lib/archetypes.ts. Unique within the category. */
  archetype: 'card-grid',
  /** True if this component owns a SIGNATURE motion moment (a scroll-linked transform, a pin,
   *  a count-up). Decision 26 budgets these per PAGE, not per section: at most two on a page,
   *  enforced by console/test/page-rhythm.test.mjs. Micro-reveals are free and do not count. */
  signature: false,
```

The assignment, all 30 files, under `console/src/components/catalog/`. Every value is the archetype
the component **is today**, not the one it will be: a `meta` that lies is worse than no `meta`.

| File | `archetype` | `signature` |
|---|---|---|
| `nav/NavMinimal.tsx` | `sticky-bar` | false |
| `nav/NavEmergencyBar.tsx` | `stacked-bars` | false |
| `pageHeader/PageHeaderSimple.tsx` | `centered-statement` | false |
| `hero/HeroSplit.tsx` | `asymmetric-split` | false |
| `hero/HeroFormFocus.tsx` | `form-led-split` | false |
| `hero/HeroOverlap.tsx` | `full-bleed-overlay` | false |
| `trust/TrustBadges.tsx` | `inline-strip` | false |
| `trust/TrustReviewsAggregate.tsx` | `aggregate-badge` | false |
| `trust/ServiceArea.tsx` | `map-list` | false |
| `about/AboutFeature.tsx` | `count-up-centerpiece` | **true** |
| `about/AboutStory.tsx` | `asymmetric-split` | false |
| `services/ServicesGrid.tsx` | `card-grid` | false |
| `services/ServicesAccordion.tsx` | `sticky-swap` | false |
| `services/ServicesPanel.tsx` | `dense-mosaic` | false |
| `work/RecentJobsGrid.tsx` | `card-grid` | false |
| `work/BeforeAfter.tsx` | `before-after` | false |
| `testimonials/TestimonialsGrid.tsx` | `dense-mosaic` | false |
| `testimonials/TestimonialsCarousel.tsx` | `snap-carousel` | false |
| `faq/FaqAccordion.tsx` | `accordion` | false |
| `faq/FaqStickyAside.tsx` | `sticky-swap` | false |
| `finalCta/FinalCtaBanner.tsx` | `full-bleed-band` | false |
| `finalCta/FinalCtaSimple.tsx` | `centered-statement` | false |
| `finalCta/FinalCtaSplit.tsx` | `overlap-split` | false |
| `contact/ContactSplit.tsx` | `asymmetric-split` | false |
| `contact/ContactCardOverlap.tsx` | `overlap-split` | false |
| `contact/ContactInlineStrip.tsx` | `inline-strip` | false |
| `footer/FooterColumns.tsx` | `column-grid` | false |
| `footer/FooterMinimal.tsx` | `inline-strip` | false |
| `seo/SeoDefault.tsx` | `none` | false |
| `seo/SeoLocalBusiness.tsx` | `none` | false |

Three things to notice, because each is a judgement the executor must not re-make:

- **`work/RecentJobsGrid.tsx` is `card-grid` today**, not `hero-first-grid`. Its grid is
  `grid gap-4 sm:grid-cols-2 lg:grid-cols-3` with no span variation. Part 2's Phase 7 recomposes it
  and changes this value to `hero-first-grid` in the same commit as the recompose. Declaring the
  aspiration now would make the collision lint green against a layout that does not exist.
- **`about/AboutFeature.tsx` is the one `signature: true`.** It uses `useCountUp`. SPEC §9 cut
  count-up and decision 18 restored it for a stats band only; `AboutFeature` still has it today, so
  it is declared honestly. Part 2's Phase 8 adds `stats/StatsBand` as a second one, and part 2's
  Phase 9 places them on different page templates for exactly this reason.
- **`card-grid` appears twice** (services and work) and `inline-strip` three times (trust, contact,
  footer) and `asymmetric-split`, `overlap-split`, `centered-statement`, `dense-mosaic`,
  `sticky-swap` twice each. All legal: the rule is uniqueness **within a category**, not globally.
  Two categories using the same structure for different content is fine; two variants in one
  category doing it is the failure the rule exists to catch.

### 4c. Decision 30(b): remove the gradients

Nine occurrences in eight files, found by `grep -rn "gradient\|accent-grad"
console/src/components/catalog/`. Each substitution is specified so no design decision is made
mid-implementation.

| File, line | Today | Replace with | Why |
|---|---|---|---|
| `hero/HeroOverlap.tsx` ~64 | `bg-gradient-to-r from-ink/70 via-ink/30 to-transparent` | `bg-ink/55` | **The named tell.** Research §6 item 1 is "hero with a confident headline over a soft gradient." A flat scrim at a measured opacity does the same legibility job and reads as a deliberate plate, not a feather. |
| `services/ServicesPanel.tsx` ~83 | `bg-gradient-to-t from-ink/90 via-ink/45 to-ink/10` | `bg-ink/60` | Same tell, over a photo. |
| `contact/ContactCardOverlap.tsx` ~42 | inline `radial-gradient(120% 80% at 100% 0%, color-mix(...), transparent 60%), var(--ink-panel)` | `background: 'var(--ink-panel)'` | A soft accent glow is decoration, not structure. |
| `finalCta/FinalCtaSplit.tsx` ~45 | `bg-accent-grad p-10 text-white` | `bg-accent p-10 text-accentFg` | Two fixes in one line: the gradient goes, and `text-white` becomes the derived `--accent-fg`. `text-white` on an authored accent is the exact shipped defect `palette-contrast.test.mjs` exists to catch (`#ffffff` on `#e08b29` is 2.66:1). |
| `about/AboutFeature.tsx` ~82 | `bg-accent-grad` | `bg-accent` | Flat accent panel. |
| `hero/HeroSplit.tsx` ~169 | `bg-accent-grad` on the image-absent placeholder panel | the AUTHORING_CONTRACT §3 fallback (below) | A placeholder should read as a placeholder, not as a branded gradient slab. |
| `services/ServicesAccordion.tsx` ~104 | `bg-accent-grad` image fallback | the §3 fallback | same |
| `work/BeforeAfter.tsx` ~19 | `bg-accent-grad` image fallback | the §3 fallback | same |
| `work/RecentJobsGrid.tsx` ~62 | `bg-accent-grad` image fallback | the §3 fallback | same |

The AUTHORING_CONTRACT §3 fallback, verbatim, so all four image-absent cases are identical:

```tsx
<div className="flex h-full w-full items-center justify-center bg-bgSoft
                bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.03)_10px,rgba(0,0,0,0.03)_20px)]">
  <span className="font-sans text-fine uppercase tracking-wide text-inkSoft">{caption}</span>
</div>
```

**Two patterns that stay and are allowed by name in the lint**, because neither is a gradient in
the sense the decision bans:

- `repeating-linear-gradient(45deg, …)`, the 45-degree hatch. It has hard stops, it is the
  contract's own mandated placeholder, and it reads as a technical fill. Occurrences:
  `hero/HeroOverlap.tsx` ~61 and the four fallbacks above.
- `radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)` with a `backgroundSize`, the dot
  grid. Also hard-stopped; it is a halftone, not a feather. Occurrences:
  `about/AboutFeature.tsx` ~85 and `finalCta/FinalCtaSplit.tsx` ~54.

`--accent-grad` itself stays derived in `packages/ui/src/palette.ts` and `bg-accent-grad` stays
registered in both Tailwind configs (decision 3: a shipped client repo has it baked into its
`page.tsx`). Phase 2 already added the deprecation comments. After this phase, **zero catalog
components use it**, which is the point.

### 4d. The tests

#### `C:\Users\Xander\Desktop\ops\jdd-ops\console\test\catalog-invariants.test.mjs` (MODIFIED)

Keep every existing test. Add an `ARCHETYPES` import and four new tests. The existing
`components()` helper already gives `{ name, category, rel, src }` for every file, so all four read
from `ALL`.

```js
import { ARCHETYPES, COLLISION_EXEMPT_CATEGORIES } from '../src/lib/archetypes.ts';
```

**Test: `every component declares a known archetype and a signature flag`**
```js
// Decision 23. A component without these is invisible to the collision lint and to
// page-rhythm.test.mjs's motion budget, so a missing field is a silent hole in both.
for (const c of ALL) {
  const a = /archetype:\s*'([a-z-]+)'/.exec(c.src);
  assert.ok(a, `${c.rel}: meta has no archetype`);
  assert.ok(ARCHETYPES.includes(a[1]), `${c.rel}: unknown archetype '${a[1]}'`);
  assert.match(c.src, /signature:\s*(true|false)/, `${c.rel}: meta has no signature flag`);
}
```

**Test: `no two variants in a category share an archetype`**
```js
// THE variety rule, decision 23, mechanical at last. Gap G6: the rule was prose in
// DESIGN-LANGUAGE.md and the catalog grew variants that were decorated copies of their siblings.
const byCat = new Map();
for (const c of ALL) {
  if (COLLISION_EXEMPT_CATEGORIES.includes(c.category)) continue;   // seo renders nothing
  const a = /archetype:\s*'([a-z-]+)'/.exec(c.src)[1];
  const seen = byCat.get(c.category) ?? new Map();
  assert.ok(!seen.has(a), `${c.category}: ${c.name} and ${seen.get(a)} are both '${a}'. ` +
    `Recompose one into a different structure (see console/DESIGN-LANGUAGE.md), do not decorate it.`);
  seen.set(a, c.name);
  byCat.set(c.category, seen);
}
```

**Test: `no uniform three-up card row (decision 30a)`**
```js
// Research §6 item 2: "three equal feature cards in a row, fading in on scroll." The tell is
// THREE EQUAL CARDS, not a 3-column grid over a client's real variable-length list:
// services/ServicesGrid renders every service the client has, commonly six, and is legitimate.
// So the ban is precise, and it is three clauses rather than a blanket grid-cols-3 regex:
const SPANNED = /col-span-|row-span-|grid-flow-dense/;
const ICON_CARD_CATEGORIES = ['differentiators', 'about', 'trust'];
const bad = [];
for (const c of ALL) {
  if (!/\bgrid-cols-3\b/.test(c.src)) continue;            // matches sm:/md:/lg: prefixes too
  if (/\.slice\(0,\s*3\)/.test(c.src)) { bad.push(`${c.rel}: grid-cols-3 over a hard-capped three`); continue; }
  if (!/\.map\(/.test(c.src))          { bad.push(`${c.rel}: grid-cols-3 with three literal children`); continue; }
  if (ICON_CARD_CATEGORIES.includes(c.category) && !SPANNED.test(c.src)) {
    bad.push(`${c.rel}: a uniform three-up in '${c.category}', which is where the tell lives`);
  }
}
assert.deepEqual(bad, [], 'get presence from span variation or from a different archetype entirely');
```
Verified against the catalog as it stands: `services/ServicesGrid.tsx`,
`work/RecentJobsGrid.tsx` and `testimonials/TestimonialsGrid.tsx` are the only three files
containing `lg:grid-cols-3`, and all three pass. `TestimonialsGrid` passes on span variation
(`col-span-2` plus `grid-flow-dense`); the other two pass because they map over the client's full
list in a category where the tell does not live. **No baseline allowlist is needed**, which is why
the rule is phrased this way rather than as a blanket ban with exceptions.

**Test: `no gradients (decision 30b)`**
```js
// Research §6 items 1 and 3. Two hard-stopped patterns are allowed by name because neither is a
// feather: the 45-degree hatch (AUTHORING_CONTRACT §3's own mandated image placeholder) and the
// 1px dot grid. Everything else, including bg-accent-grad, is out.
const ALLOWED = [/repeating-linear-gradient\(/g, /radial-gradient\(circle at 1px 1px/g];
const bad = [];
for (const c of ALL) {
  let src = c.src;
  for (const a of ALLOWED) src = src.replace(a, '');
  for (const m of src.matchAll(/bg-accent-grad|bg-gradient-to-|linear-gradient\(|radial-gradient\(/g)) {
    bad.push(`${c.rel}: ${m[0]}`);
  }
}
assert.deepEqual(bad, [], 'flat scrims and flat accent fills; --accent-grad is deprecated (decision 3 keeps it resolving for shipped repos only)');
```

**Test: `icons are solid and weighty (decision 30c)`**
```js
// SPEC §6: "Solid, weighty, literal." Research §4 names "generic line-art service icons" as part
// of the decorative vocabulary where the cheapness lives. Phosphor's thin/light/regular weights
// ARE line art. Measured on 2026-10-05 the catalog uses only bold and fill, so this test locks in
// a property the catalog already has rather than asking for a migration.
const bad = [];
for (const c of ALL) {
  for (const m of c.src.matchAll(/weight="(\w+)"/g)) {
    if (!['bold', 'fill'].includes(m[1])) bad.push(`${c.rel}: weight="${m[1]}"`);
  }
}
assert.deepEqual(bad, []);
```

#### `C:\Users\Xander\Desktop\ops\jdd-ops\console\test\page-rhythm.test.mjs` (NEW)

Three tests. **Tests 1 and 2 run now. Test 3 ships SKIPPED** and part 2's Phase 9 un-skips it,
because nothing applies a rhythm until that phase adds the `rhythm` field to `SectionRef`.

```js
import { test, skip } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGE_TEMPLATES } from '../src/app/c/[slug]/build/page-templates.tsx';

// PAGE-LEVEL invariants. Everything here is a property of a WHOLE PAGE, which is why it cannot
// live in catalog-invariants.test.mjs: a component cannot see the page it is placed on, and that
// is exactly why decision 24 puts rhythm at the template level.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_DIR = path.join(ROOT, 'src/components/catalog');

/** component name -> meta.signature, read from the file rather than restated. */
const SIGNATURE = new Map();
for (const cat of readdirSync(CATALOG_DIR)) {
  for (const f of readdirSync(path.join(CATALOG_DIR, cat))) {
    if (!f.endsWith('.tsx')) continue;
    const src = readFileSync(path.join(CATALOG_DIR, cat, f), 'utf8');
    SIGNATURE.set(f.replace('.tsx', ''), /signature:\s*true/.test(src));
  }
}

test('at most one inverted section per page (decision 12)', () => {
  // "One dark anchor section per page, maximum." Two dark bands on one page stops either of them
  // being an anchor, and the page reads as striped rather than as having a centre of gravity.
  for (const t of PAGE_TEMPLATES) {
    const inverted = t.sections.filter((s) => s.skin === 'inverted');
    assert.ok(inverted.length <= 1,
      `${t.id} has ${inverted.length} inverted sections: ${inverted.map((s) => s.name).join(', ')}`);
  }
});

test('at most two signature motion moments per page (decision 26)', () => {
  // Decision 26 TIGHTENS the old rule from one-per-section to one-or-two-per-PAGE. Research §5:
  // "the premium signal is not more animation, it is fewer, better-executed moments."
  // Micro-reveals (reveal/revealItem/revealStagger) are free and are not counted.
  for (const t of PAGE_TEMPLATES) {
    const sig = t.sections.filter((s) => SIGNATURE.get(s.name) === true);
    assert.ok(sig.length <= 2,
      `${t.id} places ${sig.length} signature components: ${sig.map((s) => s.name).join(', ')}`);
  }
});

// UN-SKIP THIS IN PART 2's PHASE 9, which is the phase that adds `rhythm` to SectionRef and sets
// it on every template. It is written now, and skipped, so that phase has a test to turn on rather
// than a test to invent, and so the rule is reviewable before anything is built against it.
skip('section rhythm is never uniform (decision 30d)', () => {
  for (const t of PAGE_TEMPLATES) {
    const rhythms = t.sections.map((s) => s.rhythm);
    assert.ok(rhythms.every(Boolean), `${t.id}: every section needs an explicit rhythm`);
    assert.ok(new Set(rhythms).size >= 3,
      `${t.id}: only ${new Set(rhythms).size} distinct rhythms. Research §6 item 8 names uniform ` +
      `section rhythm as an AI-sameness tell and decision 30(d) bans it.`);
    for (let i = 2; i < rhythms.length; i++) {
      assert.ok(!(rhythms[i] === rhythms[i - 1] && rhythms[i] === rhythms[i - 2]),
        `${t.id}: three consecutive '${rhythms[i]}' sections at index ${i - 2}`);
    }
  }
});
```

Verified that tests 1 and 2 pass against the 11 templates as they stand: no current template sets
any `skin`, so test 1 counts zero; the only `signature: true` component is `about/AboutFeature`,
which no current template places, so test 2 counts zero. Both are therefore green on arrival and
become meaningful as part 2's Phase 9 fills the templates in.

#### `C:\Users\Xander\Desktop\ops\jdd-ops\console\DESIGN-LANGUAGE.md`

One addition, since Phase 0 wrote the archetype table and this phase makes it enforceable: under
the table, add

```
Archetype ids are declared in each component's `meta.archetype` and validated against
`src/lib/archetypes.ts`. `console/test/catalog-invariants.test.mjs` fails when two variants in one
category share an archetype, so "add a variant" means "add a structure", not "restyle a sibling".
`meta.signature` marks a component that owns a scroll-linked or count-up moment;
`console/test/page-rhythm.test.mjs` caps those at two per page (decision 26).
```

### Verification

```
cd /c/Users/Xander/Desktop/ops/jdd-ops/console && npm test && npm run build
```
`npm test` must now report **8** suites (the six that existed, plus `fonts.test.mjs` from Phase 3
and `page-rhythm.test.mjs`), with the one skipped test reported as skipped, not as passed.

Then prove the lints actually bite, which a green run does not. Make each failure happen on purpose
and confirm the message, then revert:

```
cd /c/Users/Xander/Desktop/ops/jdd-ops/console
# 1. collision lint
sed -i "s/archetype: 'accordion'/archetype: 'sticky-swap'/" src/components/catalog/faq/FaqAccordion.tsx
npm test 2>&1 | grep -i "are both 'sticky-swap'"     # must match
git checkout src/components/catalog/faq/FaqAccordion.tsx

# 2. gradient lint
#    add `className="bg-gradient-to-b"` to any catalog file, run npm test, expect the gradient
#    failure naming that file, then revert.

# 3. the three-up lint
#    add `.slice(0, 3)` next to an existing grid-cols-3, run npm test, expect the
#    "hard-capped three" failure, then revert.
```
Do all three. A lint nobody has seen fail is a lint nobody knows works.

Then confirm the gradients are gone for real:

```
grep -rn "bg-accent-grad\|bg-gradient-to-" /c/Users/Xander/Desktop/ops/jdd-ops/console/src/components/catalog/
# expect ZERO hits
grep -rn "text-white" /c/Users/Xander/Desktop/ops/jdd-ops/console/src/components/catalog/
# expect ZERO hits: on-accent text is text-accentFg, on-ink text is text-onInk
```

**User looks at:** `hero/HeroOverlap` and `services/ServicesPanel` in the console preview, before
and after, at the same viewport. The question is whether the flat scrim reads as a deliberate plate
rather than as a cheaper version of the gradient. Also `finalCta/FinalCtaSplit`, whose panel went
from a branded gradient to a flat accent fill, and whose label went from `text-white` to the
derived AA-correct foreground.

### Out of scope

Decision 30(d), uniform section padding: the test is written and skipped here, and part 2's Phase 9
turns it on when `SectionRef` gains `rhythm`. Building any new component. Changing any component's
layout beyond the nine gradient substitutions. Migrating components onto Phase 1's tokens. Removing
`parallaxY` from `@jdd/ui/motion` or adding the cut-effects lint, both of which are part 2's
Phase 6 and depend on tag v1.0.4.

---

## Phase 5: settle the visual language in standalone HTML. USER GATE.

**Goal:** every visual decision part 2 implements is made and approved here, in HTML that is cheap
to throw away, before a single component is written.
**Discharges:** decisions 34, 37, 38, 1, 11, 13, 14, 15, 35 (HVAC only); research §8 items 2, 5, 7.

**This phase ends in a hard stop.** Nothing in part 2 begins until the user has looked at the
mockups and said yes. Decision 34 exists because visual decisions made inside component code are
expensive to reverse and get defended rather than redone, and because an executor handed "build
`ServicesShowcase`" with no specimen will invent one. The four deliverables below are what turn
part 2's Phases 7 and 8 from design work into transcription.

**Use the `design-template` skill flow** (decision 34 names it). Its wireframe and mockup stages
produce exactly the tabbed single-file HTML this phase needs. If the skill's own flow conflicts with
the file names or contents specified below, the names and contents below win: part 2 references
them by path.

### Inputs you must read first, and build the mockups ON

- `C:\Users\Xander\Desktop\ops\jdd-ops\design\catalog-v2\SPEC.md` in full. §3 (type), §4 (phone is
  the primary action), §5 (buttons), §6 (icons), §7 (trust is in the hero and repeats), §8
  (mobile-first at 390px, breakpoints 700 and 1000), §10 (images), §10a (never opacity on text),
  §11 (focus) are all binding on the mockups, not just on the components.
- `C:\Users\Xander\Desktop\ops\jdd-ops\console\design\RESEARCH-local-service-visual-design.md` §3
  (the Tier A conversion architecture that must survive), §4 (Tier A's decorative vocabulary, which
  is the list of things to avoid), §5 (the Tier B grammar to import), §6 (the eight AI tells).
- `C:\Users\Xander\Desktop\ops\jdd-ops\template\src\styles\tokens.ts` from Phase 1. **The mockups
  must use these exact values**, declared as CSS custom properties at the top of each file, so a
  specimen cannot be drawn at a size the components cannot reproduce.
- The Phase 2 warm palette, the Phase 3 `instrument` pairing, and the Phase 0 archetype table.
- `C:\Users\Xander\Desktop\ops\jdd-ops\console\design\home-premium-v1\mockups.html` and
  `...\multipage-v1\client-site-mockups.html` as format precedent only. Do not copy their palette
  or type; both predate decisions 9 and 6.

### Deliverable 1: `C:\Users\Xander\Desktop\ops\jdd-ops\console\design\foundation-v2\mockups-sections.html`

One self-contained HTML file, no build step, no external CSS or JS beyond the Google Fonts link for
Instrument Sans. A tab or anchor bar at the top to jump between specimens. Every specimen rendered
twice, at **390px** and at **1280px**, side by side or on adjacent tabs, because SPEC §8 composes
at 390 first and "desktop breakpoints may only add room, never add meaning."

Declare the token layer once, at the top, copied from Phase 1 and Phase 2:

```html
<style>
  :root{
    --accent:/* the HVAC accent you choose in Deliverable 4 */; --accent-fg:#FBF8F4;
    --bg:#FAF7F2; --bg-soft:#F1EBE2; --ink:#1A1512; --ink-soft:#584E45; --rule:#DFD6C9;
    --font: 'Instrument Sans', system-ui, sans-serif;
    --display-1: clamp(2.25rem, 1.42rem + 3.60vw, 3.625rem);
    --display-2: clamp(2rem, 1.62rem + 1.65vw, 2.625rem);
    --display-3: clamp(1.5rem, 1.35rem + 0.65vw, 1.75rem);
    --card-title: 1.3125rem; --lead: clamp(1.1875rem,1.13rem + .25vw,1.3125rem);
    --body: 1.0625rem; --small: .9375rem; --fine: .8125rem;
    --radius-control: 8px; --radius-panel: 14px;
    --shadow-slab: 0 1px 2px rgba(28,16,9,.05), 0 14px 30px -12px rgba(28,16,9,.22);
    --rh-tight: clamp(1.75rem,1.40rem + 1.60vw,2.75rem);
    --rh-normal: clamp(3rem,2.30rem + 3.20vw,5rem);
    --rh-loose: clamp(4.50rem,3.30rem + 5.40vw,8rem);
  }
</style>
```

**Fourteen specimens, one per thing part 2 builds.** Each must be labelled with its archetype id,
its target file path, and the phase that builds it, so transcription is unambiguous.

| # | Specimen | Archetype | Built by | What this specimen has to settle |
|---|---|---|---|---|
| 1 | **Sticky call bar** | n/a | P6, `template/src/lib/StickyCallBar.tsx` | Decision 27: this gets the most design attention of anything. Settle: the digits at `--lead` weight 700 (SPEC §4 says digits, not the word "Call"), the assurance line at `--fine` under it, the 56px minimum tap target, the upward slab shadow, whether the availability badge reads urgent or neutral, and what it looks like sitting over the footer's last row. |
| 2 | `ServicesShowcase` | `editorial-index` | P7 | Full-width numbered rows on hairline rules. Settle: numeral size and that numerals are **neutral ink, not accent** (decision 10); the rule weight; the hover image reveal's geometry; row height at 390 where there is no room for a reveal. |
| 3 | `ServicesSpotlight` | `stacked-panels` | P7 | Full-width horizontal panels, one column, **no cursor glow** (decision 28 cuts it, and it was this component's entire identity in the old catalog). Settle: how hierarchy comes from panel height variation plus `--display-3` against `--card-title`, with no decoration doing that job. |
| 4 | `WorkSpotlight` | `feature-rail` | P7 | Large feature panel plus a rail. Settle: the feature-to-rail ratio, the active-item cue (ink, not accent), and the 390px fallback where a side rail cannot exist. |
| 5 | `WorkMasonry` | `horizontal-pin` | P7, **the only `signature: true` in wave 1** | Settle: how many cards are visible mid-pin, the scroll-to-translate ratio, and critically what the **reduced-motion fallback** looks like, which is an `overflow-x-auto` scroll-snap rail. Draw both. |
| 6 | `TestimonialsMarquee` | `marquee` | P7 | **Drag and scroll driven, no autoplay** (SPEC §9 survives decision 21). Settle: the visible scroll affordance, because a rail with no affordance that also does not autoplay looks broken. |
| 7 | `RecentJobsGrid` recomposed | `hero-first-grid` | P7 | Settle: the first cell spanning two rows and two columns, how it degrades to one column at 390, and what happens with four jobs versus nine. |
| 8 | `DifferentiatorsIndex` | `editorial-index` | P8 | Reads `about.pillars`. Settle how this differs visibly from specimen 2, since they share an archetype across categories. |
| 9 | `DifferentiatorsPanels` | `stacked-panels` | P8 | Same, against specimen 3. |
| 10 | `DifferentiatorsRail` | `inline-strip` | P8 | The high-on-the-page differentiator strip research §3 says recurs in nearly every teardown. Settle: how it carries four claims in one band without becoming four equal icon cards (decision 30a). |
| 11 | `StatsBand` | `count-up-centerpiece` | P8, `signature: true` | Reads `about.stats`. Settle: the figure size, that the figures are **neutral** (decision 10), and the still state, which must render the final value immediately. |
| 12 | `StatsLedger` | `numbered-ledger` | P8 | Settle how figures-as-a-ledger-on-rules differs from specimen 11 structurally, not decoratively. |
| 13 | `AboutSticky` | `sticky-swap` | P8 | Settle the sticky panel's offset and its 390px collapse. |
| 14 | `FaqIndex` | `editorial-index` | P8 | Third use of `editorial-index`, in a third category. Settle: a question index with no media reveal. |

**Rules binding on every specimen, each traceable to a decision or a measured defect:**

- **Mobile first.** Compose at 390. If an element appears only above a breakpoint it is decoration
  and must be cut, not hidden (SPEC §8). The old catalog hid its review badge behind
  `hidden lg:block`; SPEC §7 bans that explicitly.
- **No accent on eyebrows, rules, icons or numerals** (decision 10). Accent appears on the primary
  CTA and on genuine urgency. Colour interest comes from photography. If a specimen looks flat
  without accent, the structure is too weak and that is the finding, not a reason to add accent.
- **No gradients** (decision 30b). Flat scrims over photography.
- **No three equal cards in a row** (decision 30a).
- **No wide-tracked uppercase eyebrows, no `-rotate-90` edge labels, no ghost numerals, no hairline
  section dividers** (SPEC §3's cut list; the first is already a failing lint).
- **No opacity on text** (SPEC §10a). Hierarchy from size and weight.
- **Every `<img>` carries `width` and `height`** matching its wrapper ratio (SPEC §10; omitting it
  measured CLS 0.193).
- **Nothing above the fold animates on load** (SPEC §9; measured, 84% of a 4.2s LCP).
- **Focus: `3px solid var(--accent-text)` at `outline-offset: 3px`** on every focusable element,
  including inside inverted sections (SPEC §11). Draw a focused state for at least one button and
  one input.
- **No em-dashes in any copy in the file** (§0.2).
- **Copy must be specific, and must not invent client facts.** Research §6 item 6 names vague copy
  as a tell and decision 29 makes specificity an intake demand. Use the `hvac` preset's own strings
  from `console/src/data/verticals/hvac.ts` where they exist, and where a specimen needs a fact the
  preset does not have (an owner name, a license number), write a visibly bracketed placeholder
  like `[owner name, from intake]` rather than a plausible invention. That bracket is the point: it
  shows the user which fields part 2's Phase 12 has to add to intake.

### Deliverable 2: `C:\Users\Xander\Desktop\ops\jdd-ops\console\design\foundation-v2\mockups-hvac-subpages.html`

Same token header, same dual-width treatment. Decision 19: several distinct page-header
archetypes, so subpages stop opening identically on every client site.

Six specimens:

1. `PageHeaderSimple` as it is today (`centered-statement`), as the baseline to differ from. Read
   `console/src/components/catalog/pageHeader/PageHeaderSimple.tsx` and reproduce it honestly.
2. `PageHeaderEditorial` (`editorial-index`).
3. `PageHeaderOverlap` (`overlap-split`).
4. `PageHeaderMinimal` (`inline-strip`).
5. A full **`service-standard`** page, top to bottom: `PageHeaderOverlap` at `rh-bleed`,
   `ServicesAccordion` at `rh-normal`, `BeforeAfter` at `rh-loose`, `FaqStickyAside` at `rh-normal`,
   `FinalCtaBanner` at `rh-tight`. This is the specimen that settles **rhythm**, which is the one
   thing no single-section mockup can show.
6. A full **`service-proof`** page: `PageHeaderEditorial` at `rh-normal`,
   `DifferentiatorsIndex` at `rh-loose`, `TestimonialsGrid` at `rh-normal`, `ServiceArea` at
   `rh-tight`, `ContactInlineStrip` at `rh-tight`.

For 5 and 6, annotate each section with its `rh-*` class in a visible margin label, and include
**one inverted section and no more** (decision 12). These two specimens are what the user is
actually approving when they approve "the rhythm", so the vertical spacing must be drawn to the
real `--rh-*` values, not eyeballed.

All four page headers must take the same data shape, because `compose-page.tsx` and `wirePages`
both construct them by prop name: `{ data: PageHeaderContent; editPrefix?: string }` where
`PageHeaderContent` is `{ eyebrow, title, sub, cta }`. Read `PageHeaderSimple.tsx` and match. A
header archetype that needs a fifth field is out of scope, because the field does not exist in the
schema and §0.2 rule 3 applies.

### Deliverable 3: `C:\Users\Xander\Desktop\ops\jdd-ops\console\design\foundation-v2\photography.md`

The photography direction, and the curated image set part 2's Phase 10 transcribes into
`console/src/data/image-placeholders.ts`'s `hvac` entry.

Decision 13 is deliberate and uncomfortable: we keep shipping stock placeholders, with no go-live
gate, while the research says stock is the single largest cheapness and distrust signal in this
exact sector. Decision 15 is what makes it survivable: **enforced aspect ratios, focal crops, and
one subtle unified grade**, which is what makes mixed-quality source material read as one
professional set and is also what stops curated stock reading as stock. State that tension at the
top of the file, in those terms, so nobody later mistakes the policy for an endorsement.

Contents:

1. **The shot list**, from research §4, as a client deliverable checklist: team group photo in
   branded uniforms (home, about); action shots on the job including tight shots of hands working
   (home, service pages); individual headshots especially leadership (about); branded truck and
   equipment (home); before and after pairs (service pages); customer handshake at job completion
   (testimonials); smiling family with the finished work (case studies); seasonal work (blog);
   behind the scenes office and dispatch (about).
2. **The slots that actually exist in the schema**, mapped to shot-list items. Read
   `console/src/data/image-placeholders.ts` and list exactly: `images.hero.portrait`,
   `images.hero.slides[].url`, `images.about.feature`, `services.items[].image.url`,
   `work.projects[].image.url`, `images.testimonials.avatars[]`, `images.footer.logoImage`. A shot
   with no slot is a note for a future schema change, not a thing to add now.
3. **The curated HVAC set.** One `images.unsplash.com` photo id per slot, each chosen against the
   shot list, each with the `alt` string part 2 will ship. Rules:
   - **Verify every URL returns 200 before writing it down.** A dead placeholder ships a broken
     image, and `image-placeholders.ts`'s own header says "THESE URLS SHIP."
   - Prefer real working scenes over posed studio people. Research §4: sites without crew or
     customer faces above the fold are consistently criticised; sites leading with a real photo of
     owners or crew in front of the service vehicle are consistently praised. Choose accordingly,
     while being honest in the `alt` that this is not yet the client's own crew.
   - **No AI-generated imagery for people, crew, or completed work** (decision 14). AI is allowed
     only for abstract texture or a background plate where nothing is claimed. Note which, if any,
     of the chosen plates are in that category.
   - **No em-dashes in any `alt` string** (§0.2).
   - Write each entry as `slot | photo id | ratio key | alt`.
4. **The ratios**, one per slot, which part 2's Phase 10 encodes as its `RATIOS` constant:
   `hero 16/10`, `aboutFeature 4/5`, `service 3/2`, `work 3/2`, `avatar 1/1`. If a chosen photo
   cannot survive its ratio with a saliency crop, choose a different photo rather than changing the
   ratio: decision 15 says the ratios are enforced.
5. **The grade, as one fixed recipe.** Part 2's Phase 10 applies, in this order, to every image
   except logos: `modulate({ saturation: 0.88, brightness: 1.02 })`, then `linear(1.04, -6)`, then
   `tint('#FFF8F0')`. State explicitly that there is exactly **one** grade (`grade: 'house'` is the
   only legal value in part 2's `VerticalLanguage`), and why: one recipe is what makes mixed
   sources read as one set. Include a before and after of one image in the mockup file so the user
   can see what the grade does, since no amount of prose settles it. Logos skip the crop and the
   grade, because a logo must not be recoloured.
6. **The `subjects` list** part 2's Phase 11 copies into `VERTICAL_LANGUAGES.hvac.photography`:
   four to six short noun phrases naming what an HVAC photograph should be of. No em-dashes.

### Deliverable 4: `C:\Users\Xander\Desktop\ops\jdd-ops\console\design\foundation-v2\VERTICAL-LANGUAGE-hvac.md`

The HVAC vertical's design language, on exactly the four axes part 2's Phase 11 types. Writing it
here, in prose, before it is typed, is what keeps it thin: a fifth axis would be obvious as prose
and is invisible as a type field.

Structure the file as the four axes and nothing else. **Do not add a fifth.** §0.6 is the rule, and
part 2's `vertical-language.test.mjs` asserts
`Object.keys(VERTICAL_LANGUAGES.hvac) === ['pairingId','palette','photography','rhythm']`.

1. **`pairingId`**: `'instrument'`. State why against the other four from Phase 3's table.
2. **`palette`**: the seven slots, as hexes. `bg`, `bgSoft`, `ink`, `inkSoft`, `rule` are the Phase
   2 shared warm set; `accent` and `accentFg` are the HVAC decision. **Decision 11 governs the
   accent**: honour the trade colour convention and execute it at a higher level. The convention is
   blue plus red or orange, encoding cool and warm literally, and the research notes the industry
   treats breaking it as noteworthy. So: a sophisticated, desaturated tone of that coding, not a
   saturated primary. The current `hvac.ts` accent is `#E05C2A`, a saturated orange that is exactly
   the Tier A register. Propose a replacement and **justify it with measured contrast**:
   - run it through `console/test/helpers/contrast.mjs`'s `assertPaletteAA` before writing it down;
   - record `--accent-text`, `--accent-fg` and `--urgent` as the derivation produces them, and the
     ratio of each on `bg` and `bgSoft`;
   - remember `--urgent` is a fixed alert red pulled only as far as legibility requires, and that a
     brand accent close to red collides with it. If the proposed accent is within sight of
     `#B3251A`, say so and pick differently: urgency only works as a signal if it reads as a
     different thing from the brand.
3. **`photography`**: `subjects` (from Deliverable 3 item 6), `grade: 'house'` (the only value),
   `ratioBias`: one of `'wide' | 'tall' | 'square'`, with one sentence of reasoning.
4. **`rhythm`**: `homeTemplateId` (which of part 2's three home templates HVAC defaults to; part 2
   expects `'home-standard'`) and `proofSkin` (which skin the proof section takes; part 2 expects
   `'soft'`). Both must be values that exist: `homeTemplateId` must name a real `PAGE_TEMPLATES` id
   with `pageType === 'home'`, and `proofSkin` must be a real `SkinId`.

Close the file with a short section headed **"What HVAC does NOT get"**, listing: no HVAC-only
component, no HVAC-only page template, no second grade, no extra axis. Quote §0.6's escalation
rule. This section is cheap to write now and is the thing a future vertical cycle will read when it
is tempted.

### Verification

Mockups are HTML with no build step, so the code gate is the two repos still being green plus the
files existing and being self-contained:

```
cd /c/Users/Xander/Desktop/ops/jdd-ops/console  && npm test && npm run build
cd /c/Users/Xander/Desktop/ops/jdd-ops/template && npm run build
ls -la /c/Users/Xander/Desktop/ops/jdd-ops/console/design/foundation-v2/
# mockups-sections.html, mockups-hvac-subpages.html, photography.md,
# VERTICAL-LANGUAGE-hvac.md, NOTES.md

# self-contained: the only external reference may be the Google Fonts stylesheet
grep -oE '(src|href)="https?://[^"]+' console/design/foundation-v2/mockups-sections.html | sort -u
grep -oE '(src|href)="https?://[^"]+' console/design/foundation-v2/mockups-hvac-subpages.html | sort -u
# expect only fonts.googleapis.com / fonts.gstatic.com and images.unsplash.com

# no em-dashes in the deliverables
grep -n $'—' console/design/foundation-v2/*.html console/design/foundation-v2/*.md
# expect ZERO hits

# every curated photo URL resolves
# (for each id in photography.md)
curl -s -o /dev/null -w '%{http_code} %{url_effective}\n' "https://images.unsplash.com/photo-<id>?w=800"
# every line must start 200
```

Then open both HTML files **directly in a real browser** (`file://`), not in the console preview
pane: §0.4 means the preview pane freezes CSS transitions and framer-motion, and these mockups have
hover states and a pinned scroll specimen that must actually run. Check each specimen at 390px and
1280px using DevTools device emulation.

### The user gate

Stop here and present, explicitly:

- the two HTML files, by `file://` path, with a one-line note of what each tab is;
- the proposed HVAC accent, with its measured `--accent-text` / `--accent-fg` / `--urgent` ratios;
- the grade before-and-after;
- any bracketed `[from intake]` placeholder you had to use, as the list of fields part 2's Phase 12
  must add;
- anything you could not resolve without a design decision this plan did not make.

**The three questions the user is answering**, and they should be asked in these terms:

1. **Does it look expensive?** Research §2: the thesis is Tier B's visual language on Tier A's
   conversion architecture, and nobody is serving that overlap. If a specimen still reads like a
   WordPress trades template, say which and why.
2. **Does it still convert?** Walk SPEC §4 and §7 and research §3's non-negotiables against
   specimen 1 and the two full page specimens: tap-to-call, sticky mobile call, named service area,
   review aggregate above the fold at every breakpoint, license displayed, form at six fields or
   fewer. Aesthetics is the axis being improved, so the conversion architecture is the thing that
   must not regress.
3. **Is each specimen a different structure, or the same structure restyled?** This is gap G6 and
   decision 23. Specimens 2, 8 and 14 all claim `editorial-index`; 3 and 9 both claim
   `stacked-panels`; 11 and 12 are both figures. If any pair reads as one treatment twice, the
   catalog will not deliver variety no matter how many variants it has, and the fix is here, not in
   part 2.

**Do not begin any part 2 phase until the user has answered.** If the answer is "not yet", iterate
in HTML. That is the entire reason this phase exists and it is far cheaper than iterating in
components, in two repos, behind a `@jdd/ui` release.

**User looks at:** `console/design/foundation-v2/mockups-sections.html` and
`mockups-hvac-subpages.html` in a real browser at 390px and 1280px, plus the proposed HVAC accent
and the graded image pair.

### Out of scope

Any `.tsx` file. Any registration (§0.5). The other five verticals: decision 37 makes each its own
later cycle, and each is a Phase 5 repeat plus a `VERTICAL_LANGUAGES` entry plus a
`console/src/data/verticals/<id>.ts` palette plus an `image-placeholders.ts` curation, with **no
new components** (§0.6). Any change to `console/src/data/image-placeholders.ts` itself: that is part
2's Phase 10a, which transcribes Deliverable 3.

---

## Handoff to part 2

Phases 0 to 5 leave this behind, and part 2 consumes all of it:

| Artifact | Created by | Consumed by |
|---|---|---|
| §0.3 release-and-repin loop | this document | part 2 Phases 6, 7, 8, 10, 12 |
| §0.4 hidden-preview constraint | this document | part 2, every phase with a visual gate |
| §0.5 registration touchpoint list | this document | part 2 Phases 7, 8 |
| §0.6 escalation rule | this document | part 2 Phase 11 |
| Reconciled archetype table, SPEC §9 amendment | Phase 0 | part 2 Phases 7, 8 |
| `template/src/styles/tokens.ts`, `rhythm.plugin.ts`, the `../template/src/lib/**` glob | Phase 1 | part 2 Phases 6, 7, 8, 9 |
| `@jdd/ui` v1.0.3, `console/test/helpers/contrast.mjs` | Phase 2 | part 2 Phases 6, 11 |
| `FONT_PAIRINGS`, `pairingFor`, the `'instrument'` pairing | Phase 3 | part 2 Phase 11 |
| `meta.archetype` / `meta.signature`, `catalog-invariants` bans, `page-rhythm.test.mjs` with test 3 skipped | Phase 4 | part 2 Phases 6, 7, 8, 9 |
| `foundation-v2/mockups-sections.html`, `mockups-hvac-subpages.html`, `photography.md`, `VERTICAL-LANGUAGE-hvac.md` | Phase 5 | part 2 Phases 7, 8, 10, 11 |
| `foundation-v2/NOTES.md` | Phase 0, appended every phase | the whole upgrade |

The dependency graph, the `@jdd/ui` tag sequence and the critical-files list are at the end of
`PLAN-template-fidelity-v2-part2.md`. Continue there, at Phase 6, once the Phase 5 gate is passed.

