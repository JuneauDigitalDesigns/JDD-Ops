# Implementation notes: template fidelity upgrade (v2)

Running log kept by the executor. Phase 0 onward appends below the prerequisites section.
Read `PLAN-template-fidelity-v2.md` for what each step means; this file only records outcomes.

## Prerequisites, completed 2026-10-05

| # | Outcome |
|---|---|
| P1 | `npm install` in `template/` resolved `@jdd/ui@1.0.2` under the active `JuneauDigitalDesigns` gh account. `npm run build` passed clean (11 routes). |
| P4 | Read the full uncommitted `jdd-schema` diff before touching it: additive only, matched the plan's table exactly (`ServiceItem.detail`, `AboutContent.story`, `SectionStyle`, `PageHeaderContent`, `SubpageContent`, `SiteContent.subpages`, plus `SiteContent.sectionStyles`). `npm run build` and `npm test` (219/219) passed pre-tag. Bumped `package.json` to `1.20.0` by hand (not `npm version`), committed `591d856`, tagged `v1.20.0`, pushed. All six additions confirmed present in `dist/site.d.ts`, never checked against `src`. |
| P2 | Ran as a side effect of P4's re-pin step, per the plan's own note. `npm install "github:JuneauDigitalDesigns/jdd-schema#v1.20.0"` in `console/` rewrote `package.json`'s `@jdd/schema` entry from `file:../../jdd-schema` to the github tag directly; no manual edit needed. `npm run check-schema` prints the expected success line with all three consumers agreeing at `1.20.0`. |
| P3 | No action taken, by design. `packages/ui` tree still shows only `M src/palette.ts` (the uncommitted `sectionVars`), nothing staged, no stash. Left for Phase 2 to delete. |

Full verification run, all green:
- `cd template && npm ls @jdd/ui` → `@jdd/ui@1.0.2`; `npm run build` → exit 0
- `grep -nE "detail\?|story\?|SectionStyle|PageHeaderContent|SubpageContent|subpages" jdd-schema/dist/site.d.ts` → all six present
- `console: npm run check-schema` → `@jdd/schema pinned and installed consistently at github:JuneauDigitalDesigns/jdd-schema#v1.20.0.`
- `jdd-ops: node onboard.js --schema clients/_e2e_test_growth/site.ts --dry-run` → exit 0 (pre-existing `_meta.missingFields` warnings on that fixture are unrelated to this change)
- `juneau-digital-designs: npm run build` → exit 0

One transient tooling error (a Bash safety-classifier hiccup, "claude-sonnet-5 is temporarily unavailable") interrupted the agency build on the first attempt; retried immediately and it passed. Not a code or schema issue.

No deviations from the plan. Decision 48's correction stands: `services.items[].detail` now exists in both the copy-generation schema (`console/src/lib/copy-schema.ts`, already committed) and the site-content schema (`@jdd/schema`, now tagged `v1.20.0`).

## §0.1 known-green baseline, established 2026-10-06

| Command | Result |
|---|---|
| `cd template && npm run build` | pass, exit 0 |
| `cd console && npm test` | pass, 106/106, 6 suites |
| `cd console && npm run build` | pass, exit 0, after one unrelated detour (below) |
| `cd console && npm run check-schema` | pass, pinned at `v1.20.0` across all three consumers |

**Detour, not caused by this plan.** The first `console && npm run build` attempt EPERM'd on
`.next/trace`, then a naive retry hung for 3 hours because the retry was piped through `tail`,
which silently discarded the real exit code (`cmd | tail; echo $?` reports `tail`'s exit code,
not the build's). Root cause of the EPERM: a live `next dev -p 3040` server (PIDs 27300/26132/
32284) was holding the `.next` directory. Identified via `Get-CimInstance Win32_Process`, asked
before touching it, user confirmed, stopped it, `rm -rf .next`, rebuilt clean.

That rebuild then surfaced a real, pre-existing, plan-unrelated type error: `audit.ts` had an
uncommitted `'client.welcome'` addition to `AuditAction` plus a new untracked 74-line
`src/app/api/manage/firewall/route.ts` that used `action: 'firewall.apply'`, never added to the
union. Investigated before touching anything (this looked like interrupted in-progress work, not
mine to silently fix): `getFirewallStatus`/`syncVercelFirewall` already existed and worked in
`vercelSync.ts`, the route called them correctly, this was one missing union member from done.
Asked the user; they confirmed. Added `| 'firewall.apply'` to `AuditAction`. A second, different
error then surfaced: `detail: result` failed because `FirewallSyncResult` (a closed interface,
no index signature) can't satisfy `Record<string, unknown>`. Asked again rather than assuming
blanket permission extended past the first fix; confirmed; changed to `detail: { ...result }`
(a spread, not a cast). Re-ran `npm test` (106/106, confirming the two edits were isolated) and
`npm run build` (real exit 0, captured to a log file, not through `tail`, this time). Both fixes
are mechanical completions of an already-working feature, not design decisions: no behavior was
invented, nothing beyond the two compile errors was touched, nothing was committed.

**Lesson for later phases:** never pipe a build command through `tail` or any filter when the
exit code matters; capture to a file with `cmd > log 2>&1; echo $? >> log` instead, the way the
retry above did. A pipeline's `$?` is the last command's exit code, not the first's, and that
silently converts a real failure into a false green.

## Verified catalog inventory (0.A, re-confirmed 2026-10-06)

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
30 components, 15 categories. Matched the plan's assumption exactly. The seven cited-but-absent
files (`services/ServicesShowcase.tsx`, `services/ServicesSpotlight.tsx`, `work/WorkSpotlight.tsx`,
`work/WorkGrid.tsx`, `work/WorkMasonry.tsx`, `testimonials/TestimonialsRotator.tsx`, and any
testimonials marquee) were confirmed absent.

## Reconciled archetype table

Written into `console/DESIGN-LANGUAGE.md`. Copied here so Phase 4 has one place to transcribe
`meta.archetype` values from without re-opening that file:

| Archetype id | Reference implementation | Status |
|---|---|---|
| `asymmetric-split` | `hero/HeroSplit.tsx` | built |
| `form-led-split` | `hero/HeroFormFocus.tsx` | built |
| `full-bleed-overlay` | `hero/HeroOverlap.tsx` | built |
| `card-grid` | `services/ServicesGrid.tsx` | built |
| `sticky-swap` | `services/ServicesAccordion.tsx`, `faq/FaqStickyAside.tsx` | built |
| `dense-mosaic` | `services/ServicesPanel.tsx`, `testimonials/TestimonialsGrid.tsx` | built |
| `accordion` | `faq/FaqAccordion.tsx` | built |
| `snap-carousel` | `testimonials/TestimonialsCarousel.tsx` | built |
| `count-up-centerpiece` | `about/AboutFeature.tsx` | built |
| `before-after` | `work/BeforeAfter.tsx` | built |
| `overlap-split` | `contact/ContactCardOverlap.tsx`, `finalCta/FinalCtaSplit.tsx` | built |
| `inline-strip` | `trust/TrustBadges.tsx`, `contact/ContactInlineStrip.tsx`, `footer/FooterMinimal.tsx` | built |
| `aggregate-badge` | `trust/TrustReviewsAggregate.tsx` | built |
| `map-list` | `trust/ServiceArea.tsx` | built |
| `full-bleed-band` | `finalCta/FinalCtaBanner.tsx` | built |
| `centered-statement` | `finalCta/FinalCtaSimple.tsx`, `pageHeader/PageHeaderSimple.tsx` | built |
| `column-grid` | `footer/FooterColumns.tsx` | built |
| `sticky-bar` | `nav/NavMinimal.tsx` | built |
| `stacked-bars` | `nav/NavEmergencyBar.tsx` | built |
| `editorial-index` | `services/ServicesShowcase.tsx` | not built, Phase 7 |
| `stacked-panels` | `services/ServicesSpotlight.tsx` | not built, Phase 7 |
| `feature-rail` | `work/WorkSpotlight.tsx` | not built, Phase 7 |
| `horizontal-pin` | `work/WorkMasonry.tsx` | not built, Phase 7 |
| `marquee` | `testimonials/TestimonialsMarquee.tsx` | not built, Phase 7 |
| `hero-first-grid` | `work/RecentJobsGrid.tsx` | recomposed in Phase 7; today it is `card-grid` |
| `numbered-ledger` | `stats/StatsLedger.tsx` | not built, Phase 8 |
| `none` | `seo/SeoDefault.tsx`, `seo/SeoLocalBusiness.tsx` | built |

`AboutStory.tsx` has no assigned archetype yet; Phase 4 assigns it when walking all 30 `meta`
exports, not guessed here.

## Phase 0, completed 2026-10-06

Edited three files, no `.tsx` changes, no token/palette/font changes, confirmed by the clean
`npm test` and `npm run build` passes above (the only build failure was the pre-existing,
unrelated firewall gap, fixed and logged separately above).

- `console/DESIGN-LANGUAGE.md`: full rewrite. Header block added verbatim. Archetype table
  replaced with the reconciled 27-row table. `WorkGrid`/`TestimonialsRotator` deletion note
  (decision 42) added directly under the table. "Five services variants" claim corrected to
  three, with the Phase 7 addition noted. Testimonials per-category guidance lost "Rotator".
  Motion section rewritten for decisions 26/28 (budget per page, not per section; cursor glow
  and `parallaxY` cut). Editorial-print signature's eyebrow and numerals moved to neutral
  (decision 10): `bg-accent` to `bg-rule`, "accent active" to "full-ink active". The two deleted
  tracking snippets now point at Phase 1's real token names (`tracking-display`, `tracking-wide`)
  rather than the invented ones; confirmed the actual names by reading Phase 1's `letterSpacing`
  export before writing, since the eyebrow case needed `tracking-wide`, not `tracking-tight`, and
  Phase 1's own comment on `wide` warns against assuming the old dramatic eyebrow tracking.
- `design/catalog-v2/SPEC.md`: §9 amendment note added verbatim (decision 18), bullet glyph
  matched exactly (`•`, not `-`).
- `studio/catalog/COMPONENTS.md`: full replacement with the six-line superseded pointer.
  `AUTHORING_CONTRACT.md` untouched, as instructed.

**Judgment calls made, not specified by the plan:**
1. Also fixed the intro line's echo of the "five services variants" claim (it said "the five
   `services/*` variants", same error repeated two paragraphs above the one the plan named).
   Leaving it would have contradicted the correction one section later.
2. Converted per-category guidance to reference archetype ids/built-status consistently with the
   new table, beyond the single required testimonials edit, since the header block's own claim
   ("archetype ids are the same vocabulary") would otherwise be false for that section.
3. Fixed the Guardrails section's "one signature motion moment per section" bullet, which
   directly contradicted the decision-26 rewrite two sections above it in the same document.
4. Stripped every em-dash in the file while rewriting it (not just the ones in content the plan
   explicitly edited), per the hard constraint to strip existing ones when editing a page. Zero
   remain, confirmed by `grep -cP '\x{2014}'`.

No `@jdd/ui` tag cut this phase (no `packages/ui` source changed). No smooth-scroll decision to
make, decision 54 already settles it.

## Phase 1, completed 2026-10-06

Gap G2 closed. The exported template now has a real token layer, shared with the console so the
studio preview and the export cannot drift.

**Created:**
- `template/src/styles/tokens.ts`: the shared token source. Dependency-free (no imports at all),
  because Tailwind's jiti config loader reads it from two different directories. Carries
  `fontSize` (8 steps, fluid clamp with tracking baked into the display sizes),
  `letterSpacing` (4), `spacing` (gutter + 3 section bands), `borderRadius` (3), `boxShadow` (5,
  including the offset-shadow CTA pair), `maxWidth` (2). Values transcribed from SPEC §3 and §5,
  not invented; I checked the clamp formulas against SPEC §3's measured table (h1 36 to 58px
  capped, h2 32 to 42px) before writing.
- `template/src/styles/rhythm.plugin.ts`: emits `rh-bleed | rh-tight | rh-normal | rh-loose |
  rh-text`. Ships the classes before anything applies them, per the plan, so Phase 9a's wiring
  can be verified as a separate change.

**Modified:**
- `template/tailwind.config.ts`: added the two imports, spliced the six scales into
  `theme.extend` after `fontFamily`, `plugins: []` to `plugins: [rhythm]`, and added the
  decision-30(b) deprecation comment above `accent-grad`. Every pre-existing key preserved
  byte-for-byte (verified by reading the whole file back).
- `console/tailwind.config.ts`: imported the same tokens under `brand*` aliases, added the
  `../template/src/lib/**` content glob for Phase 6, `plugins: [rhythm]`, and merged each scale
  with the brand tokens spread FIRST so chrome always wins a name collision. Added `spacing` and
  `maxWidth` keys (chrome had neither). Recorded the one intentional collision in a comment:
  chrome's `borderRadius.panel: 12px` beats tokens' `14px`, because `rounded-panel` has to keep
  matching `.panel` in `globals.css`.

**One deviation from the plan, and why.** The plan's `tokens.ts` listing ends `fontSize` with
`as const`. That does not compile: `as const` freezes each `[size, config]` pair into a
`readonly` tuple, and Tailwind's `Config` type requires a mutable tuple there, so
`console/tailwind.config.ts:45` failed with "is 'readonly' and cannot be assigned to the mutable
type". Fixed by giving `fontSize` an explicit
`Record<string, [string, { lineHeight: string; letterSpacing?: string }]>` annotation and
dropping its `as const`. A type annotation adds no runtime import, so the module stays
dependency-free as required. The other five exports keep `as const` (plain string values, no
tuple problem). **No token value changed**, only the typing mechanism.

**Verification, all green:**
- `console: npm run build` exit 0, `npm test` 106/106, `template: npm run build` exit 0
- Generated CSS proof (the build alone does not prove utilities emit): added the plan's
  throwaway specimen block, rebuilt, and confirmed in
  `.next/static/css/216d0bd74b192043.css`: `rh-loose` present, `display-1`'s clamp present as
  `clamp(2.25rem,1.42rem + 3.6vw,3.625rem)` (Tailwind normalizes `3.60vw` to `3.6vw`, a
  formatting no-op), and all 15 specimen tokens present.
- Specimen block deleted, template rebuilt clean (page size back to the original 138 B,
  confirming no residue), console re-verified 106/106 and exit 0.

**Two process notes.** First, a scripted `grep -c` check reported 0 for every class and briefly
looked like a real failure; the bug was mine, not the build's: with a single CSS file `grep -c`
omits the `filename:` prefix, so the `awk -F: '{s+=$2}'` summing nothing. Re-ran against the
file directly and everything was present. Second, a `npm run build` intended for `template/` ran
in `console/` instead, because the Bash tool's working directory persists between calls. It was
caught after 6 minutes by checking the log (it said `jdd-console@0.1.0`, not
`business-site-template@0.1.0`). **Always `cd` explicitly in a build command and confirm the
package name in the log header before trusting the result.**

**Not done, deliberately (plan's Out of scope):** no colour change (Phase 2), no font change
(Phase 3), no migration of the ~30 catalog components onto these tokens (Phases 7 to 9, as each
is touched). The plan explicitly forbids a sweeping find-and-replace here, since this phase's
gate cannot detect visual regressions.

**Still owed to the user from this phase:** the real-browser look at the eight type steps at
390px and 1440px. The specimen has been deleted, so that check is best folded into Phase 5's
mockups or Phase 12's reference site, both of which are real user gates with real pages to look
at. Flagged rather than silently skipped.

## Phase 2, completed 2026-10-06. Cut `@jdd/ui` v1.0.3.

Decision 9 landed: every default ground is off pure white and every default ink off pure black
and cool navy.

**Verified the plan's measured claims before writing them down**, rather than trusting them.
All three were exact: `inkSoft #584E45` on `bg #FAF7F2` is **7.59:1**, on `bgSoft #F1EBE2` is
**6.84:1**, and `ink #1A1512` on `bg` is **16.94:1**.

**`packages/ui/src/palette.ts`** (2a): added `WARM_INK = #1A1512` and `WARM_PAPER = #FBF8F4`;
`readableOn`'s default and light candidate both moved off pure values; `accentText`'s step target
moved to `WARM_PAPER` / `#181310`; the two `#0f1b2d` literals in `--accent-fg` and `onInk` moved
to `WARM_INK`. The `passesAA` guard, the 24-iteration bound, the 8%-per-step mix and the
every-surface loop were all left exactly as they were, as instructed: each is load-bearing and
each documents a shipped defect.

**2b:** deleted the uncommitted `SectionStyleLike` + `sectionVars` from `@jdd/ui` and left the
explanatory comment. Verified first that nothing imports them from the package: every consumer
(`PageStudio.tsx`, the generated import in `export.ts`) resolves to the local
`@/lib/palette` twin. Confirmed the console and template `sectionVars` bodies are still
byte-identical with the plan's `diff` command; they are, so no alignment was needed.

**2d:** the warm set applied to all seven palettes (`src/data/site.ts` plus the six verticals),
each keeping its own `accent` and `accentFg` untouched. `globals.css`'s `:root` moved to the warm
set plus the `#1F5C7A` trade-coded accent (measured: 6.85:1 as text on bg, 6.17:1 on bgSoft,
6.91:1 for accent-fg on accent).

**Decision 10's token side:** added the comment above `skinClasses` and deliberately did NOT
change the `eyebrow` values, per the plan: changing them would silently restyle every exported
repo on its next overwrite, and eyebrows are being removed rather than recoloured.

### Three deviations and additions, all deliberate

1. **`rampTarget` also moved to `WARM_PAPER`.** The plan listed four edits in `palette.ts` and
   did not mention `rampTarget = dark ? bg : '#ffffff'`, but its own verification step expects
   zero non-comment `#ffffff` in the file, which is only satisfiable if this one moves too. It is
   also correct on the merits: mixing the accent toward pure white produced faintly COOL tints
   (`--accent-050/100/200`) sitting on a warm paper ground, the exact mismatch decision 9 exists
   to remove. These are background tints, so the change is not contrast-bearing.
2. **Created `packages/ui/tsconfig.json`.** The package's `typecheck` script has always pointed
   at a `tsconfig.json` that did not exist, so `npm run typecheck` failed with TS5058 instead of
   checking anything. Since §0.3a step 1 uses typecheck as the first gate of every `@jdd/ui`
   release, and this plan cuts four more (v1.0.4 to v1.0.7), the gate had to become real before
   the first one. It now passes and did catch nothing, which is the expected outcome.
3. **One `0f1b2d` string remains in `palette.ts`**, against the plan's "expect ZERO". It is
   inside the comment documenting what `WARM_INK` replaced. Confirmed no live occurrence remains
   anywhere in `packages/ui/src`, `console/src/data` or `template/src/styles`.

### A real pre-existing accessibility defect this phase exposed

Extending the contrast suite's `ACCENTS` to the six shipped vertical accents, as 2e instructs,
surfaced a genuine shipped bug that has nothing to do with decision 9:

**lawn-care's accent `#3D8E40` cannot carry AA-compliant text as a solid fill with ANY
foreground.** Measured every candidate: warm ink `#1A1512` = **4.43**, old navy `#0f1b2d` =
4.23, pure white = 4.08, warm paper `#FBF8F4` = 3.86. The bar is 4.5. So the lawn-care preset
ships a primary CTA that fails WCAG AA **today**, and did before this phase. Decision 9 improves
it (4.23 to 4.43) without clearing the bar.

Not fixed here, because fixing it means changing the vertical's accent and decision 11 reserves
per-vertical accents for that vertical's own cycle, which the plan lists in Phase 2's out of
scope. Handled in the suite as a **named, documented exception rather than a weakened
assertion**: `UNREACHABLE_FG` holds exactly one accent, carries the measured numbers, and the
test still asserts the derivation returns the best available option (>= 4.4). A third test,
`lawn-care is the ONLY palette with an unreachable accent foreground`, pins the exception so it
cannot quietly grow to a second vertical.

**This needs a decision from the user**: change lawn-care's accent to something slightly darker
that can clear 4.5, or accept a non-compliant CTA on that vertical until its own cycle.

### 2e, as built

- **`console/test/helpers/contrast.mjs`** (new): `AA`, `TYPO`, `varsFor`, `assertPaletteAA`,
  `assertWarm`. No `node:test` import, so Phase 12 can import it without re-running tests.
- **`palette-contrast.test.mjs`**: `LIGHT`/`DEEP_SOFT` replaced by `WARM`/`WARM_DEEP`, `DARK`
  kept; `ACCENTS` extended with the six shipped accents plus the new globals default; four new
  tests (every shipped palette is warm / clears AA / the lawn-care exception is unique / the
  pre-hydration `:root` is warm / a warm ground never resolves pure white).
- **The three existing assertions survived unchanged**, as required. In particular
  `'an already-legible accent is passed through unchanged'` was predicted by the plan to possibly
  fail on the warm base; re-measured, `#1f6f78` is 5.45:1 on bg and **4.92:1** on bgSoft, so it
  still clears AA and comes back untouched. No assertion was weakened.
- **One implementation deviation:** the "every shipped palette" test reads the palettes by
  parsing the `.ts` files from disk rather than importing them. Importing fails even with tsx in
  the test command, because those modules carry `import type { SiteContent } from "@jdd/schema"`
  and the schema's exports map declares only `types` and `import` conditions, so tsx's CJS-side
  resolution throws `ERR_PACKAGE_PATH_NOT_EXPORTED`. Parsing is also closer to the test's stated
  intent: it asserts on what is literally written on disk, which is what a careless future edit
  changes.

### Verification, all green

- `packages/ui: npm run typecheck` exit 0 (now a real gate)
- `console: npm test` **165/165** (was 106; the new contrast tests account for the rest)
- `console: npm run build` exit 0, `template: npm run build` exit 0 (confirmed
  `business-site-template@0.1.0` in the log header, per the Phase 1 lesson)
- `@jdd/ui` v1.0.3 present in BOTH `console/node_modules` and `template/node_modules`, with
  `WARM_PAPER` confirmed in both installed copies
- greps: zero live `0f1b2d`, every `#ffffff` in a comment, `sectionVars` comment-only

**A note on why the suite initially showed 5 failures.** The first run was against the still-
installed v1.0.2, so the tests were checking new expectations against old code. That is inherent
to this package's shape (consumers read a pinned GitHub tag, not the local source), so for any
`@jdd/ui` change the release must land before its tests can pass. Worth remembering for
v1.0.4 to v1.0.7.

**Still owed to the user:** the side-by-side look at the warm ground versus the old pure white,
in the template dev server and the console preview. Deferred to the same place as Phase 1's type
specimen, since both want a real browser on a real page.

## Phase 3, completed 2026-10-06. No `@jdd/ui` tag (no `packages/ui/src` change).

Gap G1 closed. The AI-tell font list is gone; the operator now picks one curated pairing that
moves all six typography fields together.

**Verified the five families before writing anything that depends on them**, against
`node_modules/next/dist/compiled/@next/font/dist/google/font-data.json` on Next 14.2.35. All five
present, and the plan's claim that **Instrument Sans caps at 700** is exactly right: it ships
400/500/600/700 and no 800. That is why a pairing carries its own display weight instead of
inheriting SPEC §3's blanket 800, and asking next/font for a weight a family lacks is a build
error. A new test now asserts every pairing's weights against that same font data, so this class
of error is caught in a second rather than in a two-minute build.

**Built:** `console/src/lib/fonts.ts` replaced (FONT_PAIRINGS, DEFAULT_PAIRING_ID, pairingFor,
typographyFor, pairingIdFromStack); both `fonts.loader.ts` files rekeyed to the five families;
`TypographyPane.tsx`'s two font lists collapsed into one `PairingList` whose specimens render at
each pairing's real display treatment, with the weight pickers and sliders demoted under an
`Overrides` heading; `FontSelect` replaced by `PairingSelect` (the `role` filter axis is gone,
since decision 7 makes display and body the same family); all seven authored
`brand.typography` objects moved to `instrument`.

**No `@jdd/schema` change**, as the plan requires: `pairingIdFromStack` recovers the selected
pairing from the `stack` string already in `brand.typography.fontSans`, so there is no
`pairingId` field and no version bump.

**The two loaders' asymmetry was preserved and is now enforced in both directions.** The template
keeps `preload: false` on every family and keeps `fontVarsFor`'s selectivity; the console
deliberately does not. A new test asserts the console does NOT adopt `preload: false`, so a
future "let us make these consistent" edit fails loudly rather than silently re-introducing the
292KB regression the template loader's header documents.

### An addition the plan's file list omitted

The plan listed seven `brand.typography` objects to update: `console/src/data/site.ts` plus the
six verticals. It did not include **`template/src/data/site.ts`**, the standalone-template seed.
Left alone, that file kept a system stack, so `fontVarsFor` returned an empty string,
`<html class="">` carried no font class, and `cd template && npm run dev` rendered in the OS
font. That would have made the plan's own "look at it" verification meaningless. Updated its
typography to `instrument` and, for the same reason, its palette to the Phase 2 warm set, which
Phase 2 had also skipped for this file while updating `globals.css` for explicitly the same
"standalone-template palette" rationale. An export overwrites this file with the client's own
content, so neither change can reach a client site.

### The plan's woff2 expectation was wrong, and the real behaviour is better than it looks

The plan says `ls .next/static/media/*.woff2 | wc -l` should print **2** (one family, two
weights). It prints **12**, and all five `--font-*` variables appear in the emitted CSS. That is
not a regression and not a misconfiguration: constructing five families in the loader module
makes next/font emit all five families' files at build time, regardless of which one a brand
references. There is no way to avoid that, because the brand is data read at render time while
font emission happens at build time.

What actually matters is what a VISITOR transfers, and that is correct. Verified on the rendered
output:

- `<html lang="en" class="__variable_cc14e6">` carries exactly ONE font-variable class.
- The class that defines `--font-instrument` in the CSS is `__variable_cc14e6`: the same one.
  So only Instrument resolves in `font-sans` / `font-heading`; the other four classes are dead
  CSS that no element carries, and a browser fetches a font file only when a matching family is
  actually needed for rendered text.

So the 12 files are deploy weight, not transfer weight, and the selectivity `fontVarsFor` exists
for is intact. **The plan's verification line should be read as "exactly one font-variable class
reaches the html element", not "two files on disk."**

### A new operational risk worth knowing about

The first clean template build FAILED with
`TypeError: Cannot read properties of null (reading '1')` from `next/font`, at
`google/loader.js:112`, which regexes a font file URL for its extension. I chased it properly
before concluding: confirmed all five families and weights exist in the installed font data,
confirmed the Google CSS2 API returns HTTP 200 and `.woff2` URLs for every one of the five
(including under next/font's exact Chrome/104 User-Agent), and read next/font's URL builder and
CSS parser. Nothing was wrong. A retry passed.

It was a **transient network failure during next/font's build-time fetch**, surfacing as a
null-dereference rather than a network error. Two consequences:

1. The console build had passed moments earlier only because its `.next` was warm; a clean build
   had to fetch. A cached build can hide this.
2. **The export route runs `npm run build` inside the client repo.** Moving off system stacks
   means every client build now depends on a live Google Fonts fetch, so a flaky network can fail
   an export with a cryptic null-dereference. Worth a retry in the export path if it is ever seen
   in practice. This risk did not exist while every preset used a system stack.

### The intended byte trade, recorded

Every client site goes from **zero** font bytes (a system stack ships nothing) to **one**
self-hosted family at two weights, fetched after CSS establishes it is wanted (`preload: false`).
That is the deliberate cost of G1: a system stack is the most average possible answer, and no
combination from the old eight-font list read Tier B.

### Verification, all green

- `console: npm test` **172/172** (was 165; the 7 new font tests)
- `console: npm run build` exit 0; `template: npm run build` exit 0 (`business-site-template`
  confirmed in the log header)
- `grep -rn "FONT_OPTIONS\|FontSelect" src/` finds **zero** live references
- exactly one font-variable class on `<html>`, and it is the Instrument one

**Still owed to the user:** clicking through all five pairings in the Brand drawer and watching
the live preview change family, weight, tracking and line height on each click, plus judging
whether `instrument` carries a 58px `display-1` convincingly at 700. Folded into the same
real-browser review as Phases 1 and 2.

## Phase 4, CLOSED 2026-10-07 (code + tests 2026-10-06, build gate run 2026-10-07). No `@jdd/ui` tag.

The variety rule and the four bans are mechanical now. All edits and tests are in; the one thing
not done is the final `npm run build` on console and template, which was interrupted. **Phase 4
is not closed until those two builds pass.** Nothing below changed `packages/ui/src`, so no tag.

**Built:**
- `console/src/lib/archetypes.ts` (new): the 27-value `ARCHETYPES` vocabulary +
  `COLLISION_EXEMPT_CATEGORIES = ['seo']`. Dependency-free, client-safe.
- `archetype` + `signature` added to all 30 component metas (4b table), via a scripted insert
  before each meta's `} as const;`. `id`/`category`/`consumes`/`skins` untouched. `RecentJobsGrid`
  is declared `card-grid` (what it IS today), not `hero-first-grid`; Phase 7 flips it when it
  recomposes. `AboutFeature` is the one `signature: true`.
- The nine gradient substitutions (4c): `HeroOverlap` and `ServicesPanel` scrims to flat `bg-ink/55`
  and `bg-ink/60`; `ContactCardOverlap` radial glow to flat `var(--ink-panel)`; `FinalCtaSplit`
  `bg-accent-grad`+`text-white` to `bg-accent`+`text-accentFg`; `AboutFeature` panel to `bg-accent`;
  the four image-absent fallbacks (`HeroSplit`, `ServicesAccordion`, `BeforeAfter`,
  `RecentJobsGrid`) to the AUTHORING_CONTRACT §3 hatch.
- Four new catalog-invariants tests (archetype declared+known, collision, three-up 30a, gradient
  30b) plus an icon-weight 30c test and a NEW `text-white` lint. The last one closes a real hole:
  the existing opacity lint only caught `opacity-N` utilities, so slash-opacity like `text-white/85`
  slipped past both it and me. Found and fixed remaining `text-white/85|90|15` in `AboutFeature`
  and `FinalCtaSplit`.
- `console/test/page-rhythm.test.mjs` (new): test 1 (<=1 inverted/page, decision 12) and test 2
  (<=2 signature/page, decision 26) run; **test 3 (uniform-rhythm 30d) ships SKIPPED** for Phase 9
  to un-skip when `SectionRef` gains `rhythm`.
- `DESIGN-LANGUAGE.md`: one paragraph under the archetype table on how the lint enforces it.

**Verified:** `npm test` = **182 tests, 181 pass, 1 skipped, 0 fail** (8 suites). All three lints
were proven to bite by deliberately breaking each (collision, gradient, three-up), confirming the
exact error message, and reverting; a final `npm test` matched 182/181/1 with no residue. The
decision-30a three-clause phrasing passes `ServicesGrid`/`RecentJobsGrid`/`TestimonialsGrid` with
no allowlist, as the plan predicted.

**Build gate, run 2026-10-07, closes Phase 4:**
- `cd console && npm run build` → **EXIT 0** (Compiled successfully, 22 static pages), but only
  after fixing ONE real syntax error the "TS-valid by inspection" claim missed:
  `AboutFeature.tsx`'s image-absent fallback had a JSX comment in `{/* … */}` braces sitting as a
  bare sibling at the head of the ternary's `: ( … )` branch, before `<div>`. A parenthesized JSX
  branch must be a single expression, so the braces made it two adjacent expressions and swc threw
  `Unexpected token \`section\`` (mis-pointed at the `return`'s `<section>`, not the real line).
  Fix was minimal: drop the braces so it is plain comment trivia (`/* … */`). Grepped the whole
  catalog for the same antipattern (`? (` / `) : (` immediately followed by `{/*`): no other
  instance. This is exactly the class of error the build gate exists to catch past inspection.
- `cd template && npm run build` → **EXIT 0** (`business-site-template@0.1.0` confirmed in the log
  header per the Phase 1 lesson; Compiled successfully).
- `cd console && npm test` → **182 tests, 181 pass, 0 fail, 1 skipped**. The one skip is
  `section rhythm is never uniform (decision 30d)`, the intended Phase 9 skip. Count unchanged by
  the lawn-care edit below (bodies edited, no test added/removed).

**Build-environment note (the §0.1 EPERM lesson, recurring):** the first gate run EPERM'd on
`.next/trace`. Root cause again a live `next dev -p 3040` console server (plus a lingering process
from the first failed build) holding `.next`. Stopped all console next processes, confirmed they
stayed down (no auto-restarter), `rm -rf .next`, rebuilt clean. Also note: a background build's
harness-reported "exit code 0" is the WRAPPER's, not the build's — the real code was written into
the log as `EXIT=$?` and read from there. The first run genuinely exited 1 despite a "0" summary.

## lawn-care accent darkened 2026-10-07 (resolves the Phase 2 open AA decision). No `@jdd/ui` tag.

Decision from the user (2026-10-07): resolve the lawn-care WCAG AA defect now rather than defer to
its own vertical cycle. The accent `#3D8E40` could not clear AA 4.5 as a button fill with any
foreground (best 4.43 against warm ink). Darkened to **`#2F7A33`**, chosen by measuring candidates
against the real `@jdd/ui` derivation on the warm base: `--accent-fg` (white, honoured) on the fill
= **5.31**, `--accent-text` on bg = 5.52, on bgSoft = 4.98 — comfortable margins on all three, and
a natural deepening of the same lawn green rather than a hue change.

- `console/src/data/verticals/lawn-care.ts`: `accent` `#3D8E40` → `#2F7A33`. `accentFg` kept
  `#FFFFFF` (now legible at 5.31; every vertical uses white, `assertWarm` does not touch accentFg).
- `console/test/palette-contrast.test.mjs`: the `UNREACHABLE_FG` exception machinery removed
  entirely — the `Set`, the special-case branch in the button-fill test (now a plain `>= AA`
  assert), and the `lawn-care.ts` skip in `every shipped palette clears AA`. The pinning test was
  rewritten from `lawn-care is the ONLY palette with an unreachable accent foreground` to
  **`no shipped palette has an unreachable accent foreground`** (asserts `failing === []`), so a
  future accent regressing below 4.5 still fails loudly. The `ACCENTS` entry updated to `#2F7A33`.
- **`studio/preview/src/data/verticals/lawn-care.ts` deliberately NOT touched.** That tree has no
  `package.json`, is in no workspace or build, is labelled "studio/preview WIP" in git, and carries
  a stale pre-decision-9 palette (pure-white grounds) that was never warm-migrated. Editing only its
  accent would be meaningless against its stale base. Flagged, not changed.

---

# CROSS-SESSION DRIFT discovered 2026-10-07 — RECONCILED 2026-10-07

**RESOLUTION (2026-10-07, at the user's direction, as the first task of this session):** all three
consumers re-pinned and reinstalled at **`github:JuneauDigitalDesigns/jdd-schema#v1.21.0`** and
`npm run check-schema` is now **GREEN**. v1.21.0 is a clean additive superset of v1.20.0 — its only
diff is a standalone `src/ticket.ts` module plus one re-export in `index.ts` (verified
`git diff v1.20.0 v1.21.0`), and it sits directly on top of the v1.20.0 commit in linear history,
so no content field from P4 was lost. Steps taken:
- `console/package.json` and `jdd-ops/package.json` pins `#v1.20.0` → `#v1.21.0`.
- Force-reinstalled with `npm install "github:JuneauDigitalDesigns/jdd-schema#v1.21.0"` in both
  `console/` and the `jdd-ops/` root (a plain install would not re-resolve the locked sha). Done
  with the `JuneauDigitalDesigns` gh account active.
- agency was already correct (`#v1.21.0`, installed 1.21.0) and was left untouched, including its
  `feat/portal-support-tickets` branch / PR #21.
- `check-schema` prints all three `✓` at v1.21.0.

**Phase 13 consequence still stands:** v1.21.0 is now TAKEN by tickets, so Phase 13 must cut
**`v1.22.0`**. Treat every "v1.21.0" in the plan's Phase 13 as v1.22.0.
**SUPERSEDED 2026-10-08:** Phase 11 then took `v1.22.0` (ContentMeta.local_images), so **Phase 13
now cuts `v1.23.0`**. See the Phase 11 entry below.

---

Original drift record (kept for history):

A support-tickets feature landed between sessions and it collides with the plan's schema
versioning. Measured 2026-10-07:

- `@jdd/schema/package.json` is now **v1.21.0** (was v1.20.0 when P4 tagged it). A v1.21.0 tag is
  pushed. Per MEMORY.md's "JDD support tickets" entry: agency site pinned v1.21.0 (PR #21 open),
  console side uncommitted and shimmed.
- **`npm run check-schema` is now RED**, through no fault of the fidelity work: console pin
  `v1.20.0`, jdd-ops root pin `v1.20.0`, agency pin `v1.21.0`. The three no longer agree.
- **The console's installed `@jdd/schema` is v1.21.0 while its pin still says v1.20.0** (a shim:
  node_modules pulled forward to get ticket types, pin not updated).
- `audit.ts` gained `ticket.status | ticket.reply | ticket.delete` (plus the `firewall.apply` I
  added in Phase 0's detour). This is the ticket work, intentional, leave it.

**Consequences for the plan:**
1. **Phase 13's reserved `v1.21.0` is now TAKEN. Phase 13 must cut `v1.22.0`.** The plan says
   v1.21.0 in several places; treat every one as v1.22.0.
2. The next session's first `npm run build` on console is fine (it builds against installed
   v1.21.0, which is a superset), but **`check-schema` will fail** until someone reconciles the
   pins. That reconciliation belongs to whoever owns the tickets feature, not to the fidelity
   plan, but the fidelity executor must not mistake the red check-schema for their own regression.
3. `@jdd/ui` is UNAFFECTED and correct: both consumers pinned and installed at v1.0.3.

---

## Phase 5, APPROVED at the user gate 2026-10-07. No `@jdd/ui` tag, no `.tsx`.

All four deliverables authored directly to the plan spec (the user chose this over running the
interactive design-template skill, because that skill's Q&A would relitigate the settled 56
decisions, and the plan says its own contents win on conflict):

- `VERTICAL-LANGUAGE-hvac.md`: four axes. Proposed HVAC accent `#16556A` (deep petrol teal-blue)
  replacing the saturated Tier A orange `#E05C2A`, per decision 11. Measured on the warm set:
  `--accent-text` 7.73 on bg / 6.97 on bgSoft, white `--accent-fg` 8.26 on the fill, `--urgent`
  unaffected at 6.15 / 5.54 and a clearly different hue (no red collision). `pairingId:instrument`,
  `grade:house`, `ratioBias:wide`, `homeTemplateId:home-standard` (forward ref, Phase 9 creates it),
  `proofSkin:soft`. User APPROVED the accent and this doc.
- `photography.md`: tension stated, 9-shot checklist, 7 schema slots mapped, 5 ratios, two-pass
  grade with the tint dropped (decision 55), subjects. All 7 curated Unsplash ids re-verified 200
  on 2026-10-07. Honest note: the set reuses 4 verified HVAC photos across slots (the current
  working design); did not invent ids that cannot be visually confirmed.
- `mockups-sections.html`: 14 plan specimens plus a grade before/after, dual-width via container
  queries with the token scale pinned to clamp endpoints per frame. The three editorial-index uses
  (2, 8, 14), the two stacked-panels (3, 9) and the two figure specimens (11, 12) are drawn as
  structurally distinct, which is gate question 3.
- `mockups-hvac-subpages.html`: 4 page-header archetypes + the two full-page rhythm specimens
  (service-standard, service-proof), each band tagged with its rh-* class, exactly one inverted
  per page (decision 12).

**ADDENDUM specimen H, HeroFormFocus, added 2026-10-07 at the user's request.** The plan's 14
specimens deliberately omit the heroes because they are already built (Phase 0-4) and omit the home
page because it is Phase 9, so the above-the-fold home hero with its lead-capture form, the single
most important conversion element alongside the sticky call bar, was shown nowhere. Added it to
`mockups-sections.html` as specimen H: phone primary (accent button, digits + assurance, SPEC §4),
capture form secondary (ink-outline), trust in the hero at every breakpoint (SPEC §7), hero image
eager/high (SPEC §10), nothing animating on load (SPEC §9). This is a deviation from the plan's
specimen list, recorded here per the handoff rule.

**onboard.js lead wiring, verified 2026-10-07 against `lib/site-routes/contact.route.ts` (the route
onboard.js writes into every client repo):**
- The route reads `LEAD_DELIVERY_MODE`. `callback` (growth/enterprise) parses `data.phone` to E.164
  and calls Retell `create-phone-call`; `email` (starter) builds a lead email from whatever fields
  are posted and sends via Resend to `LEAD_TO_EMAIL`, with the lead's email as reply-to. Returns 502
  on Resend/Retell failure, never a silent success. Both tiers are supported for the hero form shape.
- **Two constraints the hero form must honor for the wiring to work:** (1) the callback path reads
  `data.phone` literally, so the submitted field MUST be named `phone`; (2) starter email needs
  `RESEND_API_KEY` + `LEAD_TO_EMAIL` set by onboard.js and a VERIFIED Resend FROM domain (the known
  403 pitfall is the API-key account, not DNS; see MEMORY "Resend account binding").
- **Known gap (SPEC "Known gaps"):** the shared `leadMode`-aware `LeadForm` island (starter=email
  field, growth=phone field) is specified but NOT yet built into the hero/contact/finalCta
  components. That is a Phase 6 dependency before a starter client's hero form is correct. The
  callback path a growth client uses works today.

**Verification run 2026-10-07, all green:** `console npm test` 182/181/1; `console npm run build`
EXIT 0 (one transient next/font Google-Fonts fetch failure on the first attempt, the documented
Phase 3 null-deref, cleared on retry); `template npm run build` EXIT 0; all five files present; both
HTML self-contained (only fonts + unsplash); zero em-dashes in the four deliverables; all seven
curated photo URLs 200.

**USER GATE PASSED 2026-10-07.** The user answered the three questions: does it look expensive =
yes (Tier B), does it still convert = yes (architecture intact), is each specimen a different
structure = yes (all distinct). Phase 5 is approved. The shared foundation (Phases 0 to 5) is
settled. Phase 6 may begin.

Fields Phase 13 intake must add, collected from the `[from intake]` brackets used: service city,
license number, year established, years-local, review count, review source, warranty term, named
service-area towns. Review count, review source and warranty term are beyond decision 29's list.

## Phase 6, COMPLETE 2026-10-07. Cut `@jdd/ui` v1.0.4.

Page chrome: the sticky call bar and the smooth-scroll layer. Build gate green.

**Built:**
- `template/src/lib/StickyCallBar.tsx` (new, `'use client'`): mobile-only (`lg:hidden`),
  IntersectionObserver on `#top` (always-visible fallback when absent), digits at
  `text-lead font-extrabold` + assurance at `text-fine`, 56px min tap target, `bg-accent`
  `text-accentFg`, upward shadow, urgent badge only when it reads as availability, a sibling
  spacer reserving its height so it never covers the footer, one CSS transform transition gated on
  prefers-reduced-motion, aria region + `aria-label`. No `stillFor` (no skin). Returns null when
  `phoneHref` is empty.
- `template/src/lib/SmoothScroll.tsx` (new, `'use client'`): Lenis behind all four mandatory
  guards (dynamic `import('lenis')`, `ssr:false` at the layout import site, prefers-reduced-motion
  early return that never constructs Lenis, `window.self !== window.top` iframe check). Renders null.
- `lenis ^1.1.18` added to template and console `package.json` (resolved to 1.3.26).
- `template/src/app/layout.tsx`: `dynamic(() => import('@/lib/SmoothScroll'), { ssr:false })` +
  `StickyCallBar`, rendered after children before `<Analytics/>`. (Next 14.2.35 allows ssr:false
  in a server component, so the plan's code built as written; the Next 15 restriction does not apply.)
- `console/src/app/c/[slug]/build/PageStudio.tsx`: StickyCallBar rendered in the `mode="flow"`
  preview, imported via `@template/lib/StickyCallBar`, fed the console's rich `effective` content.
- `console/tsconfig.json`: added `../template/src/lib/StickyCallBar.tsx` to `include`.
- `packages/ui/src/motion.ts`: `parallaxY` marked `@deprecated` (kept exported so an already-exported
  repo keeps compiling); header rewritten for the per-page motion budget (decision 26). No live
  component used `parallaxY`, cursor glow or `clipReveal` (greped: only an `export.ts` comment), so
  nothing was stripped. §0.3 loop run, tag **v1.0.4** pushed, both consumers re-pinned and verified
  installed at 1.0.4.
- `console/test/catalog-invariants.test.mjs`: new test banning `parallaxY` and `--mx/--my`
  cursor-glow in any catalog component (passes trivially today; guards the future).

**PLAN DEFECT found and resolved.** The plan's layout wiring read `CONTENT.hero.trust` and
`CONTENT.announcement`, but `template/src/data/site.ts` is the FIXED minimal seed schema
(brand/services/faq/testimonials/seo/_meta) with neither field, and its own contract forbids adding
per-client fields. So the template build failed `Property 'hero' does not exist on type
'SiteContent'`. Resolved by passing `assurance={null} badge={null}` in the TEMPLATE layout only
(not inventing a value; a missing field stays null). The console preview still passes the real
`effective.hero?.trust` / `effective.announcement`, so the bar shows the assurance line and
availability badge in the Studio and in console-Studio-built content. **Consequence to surface:**
sites provisioned via the onboard.js template-splice path (minimal schema) will show the call bar
with digits only, no assurance line or badge, because the seed schema has no field to carry them.
Giving every client site the assurance line on the bar would need an additive optional field in the
template schema, which is a separate decision (its contract says the schema is fixed).

**Build gate, 2026-10-07:** `console npm test` 183/182/1 (the ban test is the +1); `console npm run
build` EXIT 0; `template npm run build` EXIT 0; `@jdd/ui` 1.0.4 and `lenis` 1.3.26 confirmed in both
node_modules trees.

**Owed to the user (deferred, not a blocker):** the real-browser look at the sticky bar on a
390px-wide window of the template dev server and the Lenis scroll feel, plus reduced-motion. Folded
into the same real-browser review owed from Phases 1 to 3 and Phase 5.

## Phase 7, COMPLETE 2026-10-07. Cut `@jdd/ui` v1.0.5.

Catalog wave 1: the five components DESIGN-LANGUAGE.md promised, transcribed from the approved
`mockups-sections.html` specimens, plus the RecentJobsGrid recompose. Build gate green.

**Built (console/src/components/catalog/), each on the console convention (E, skinClasses, meta with
archetype+signature, Phase 1 tokens):**
- `services/ServicesShowcase.tsx`: `editorial-index`, skins [DEF, SOFT]. Numbered rows on hairline
  rules, numerals NEUTRAL (decision 10), desktop-only CSS hover image reveal (not content, so §8 is
  satisfied), numbers from `services.items[].n`.
- `services/ServicesSpotlight.tsx`: `stacked-panels`, skins [SOFT, DEF, INV]. One column; hierarchy
  from a tall lead panel (with image on desktop) vs compact panels; NO cursor glow (decision 28).
- `work/WorkSpotlight.tsx`: `feature-rail`, skins [DEF, INV]. `useState` + `AnimatePresence` feature
  swap, rail active cue is INK not accent (decision 10), returns null on `work.hidden` / empty, 390
  collapses the rail to a stacked list above the feature.
- `work/WorkMasonry.tsx`: `horizontal-pin`, **signature:true** (the only one in wave 1), skins
  [DEF, SOFT]. framer `useScroll`/`useTransform` pin (no GSAP), measured track distance; reduced
  motion renders a plain `overflow-x-auto` scroll-snap rail with no transform and no sticky pin.
- `testimonials/TestimonialsMarquee.tsx`: `marquee`, skins [SOFT, DEF]. Drag/scroll rail, NO
  autoplay (SPEC §9 survives decision 21), with a visible scroll-progress affordance.
- `work/RecentJobsGrid.tsx` RECOMPOSED to `hero-first-grid` (first cell spans 2 rows and 2 cols via
  `sm:col-span-2 sm:row-span-2` over `sm:auto-rows`, image flex-fills). File name, `meta.id`,
  `category`, `consumes` all unchanged (CATALOG, SKINS, categories, PAGE_TEMPLATES and the two
  shipped repos key off the name). archetype flipped `card-grid` -> `hero-first-grid`.

Resulting counts: services 5, work 4, testimonials 3, matching Phase 0's reconciled note.

**Registration (§0.5):** `CATALOG` in export.ts (services/work/testimonials arrays extended);
`SKINS` in packages/ui/src/skins.ts (five new entries) via the §0.3 loop, tag **v1.0.5** pushed and
both consumers re-pinned + verified at 1.0.5; `categories.tsx` five imports + five VariantEntry rows.

**DEVIATION: PAGE_TEMPLATES NOT modified in Phase 7.** The plan said to add each new component to at
least one existing template "so the studio shows them." Did not, deliberately: (1) the new variants
are already studio-selectable through the catalog picker (`categories.tsx` variants), which is the
swap mechanism; (2) the build+test gate does not require PAGE_TEMPLATES membership (the
CATALOG/registry/SKINS-agree test does not read templates); (3) Phase 9 is explicitly the phase that
places components into templates and sets `rhythm` (it un-skips page-rhythm test 3), so a makeshift
placement now would be reworked there; (4) adding a second same-category section to an existing
template degrades that template's default output, and adding WorkMasonry (signature) risks the
<=2-signature page-rhythm rule. Flag for the user; Phase 9 will place all five properly.

**A §10a fix made in passing:** WorkSpotlight's rail subtitle initially used `opacity-80` on text.
The opacity lint only fires on bg-accent ancestors so it would not have caught it, but SPEC §10a
bans opacity on text regardless of surface, so it was removed (hierarchy from size/weight).

**Build gate 2026-10-07:** `console npm test` 183/182/1 (0 fail); `console npm run build` EXIT 0;
`template npm run build` EXIT 0; `@jdd/ui` 1.0.5 in both trees.

**Owed to the user (deferred):** the plan's real export test, Launch a template containing each new
component against a scratch slug so the export route runs `npm install` + `npm run build` INSIDE a
client repo, which is the only check that proves copy-paste portability. The components follow the
AUTHORING_CONTRACT import rules (only `@/data/site`, `@/lib/*`, framer-motion, phosphor), and they
compile in the console build, but the standalone-repo export remains the real proof. Plus each new
component viewed in the console picker against HVAC, side by side with its specimen.

## Phase 8, COMPLETE 2026-10-07. Cut `@jdd/ui` v1.0.6.

Catalog wave 2: two new section categories, the three page-header archetypes, and third variants for
about and faq. Ten components, no `@jdd/schema` change (differentiators reads `about.pillars`, stats
reads `about.stats`, both already in the schema and already generated/editable). Build gate green.

**Built (console/src/components/catalog/):**
- `differentiators/DifferentiatorsIndex` (editorial-index, [DEF,SOFT]), `DifferentiatorsPanels`
  (stacked-panels, [SOFT,DEF,INV]), `DifferentiatorsRail` (inline-strip, [DEF,SOFT]). Read
  `about.pillars`, return null empty.
- `stats/StatsBand` (count-up-centerpiece, **signature:true**, [INV,DEF]) and `stats/StatsLedger`
  (numbered-ledger, [DEF,SOFT]). Read `about.stats`, return null empty. StatsBand uses the shared
  `useCountUp` (confirmed console/template copies in sync), gated on `stillFor` so it shows the final
  value immediately when still; it is the only component that counts up (decision 18 amends SPEC §9).
- `pageHeader/PageHeaderEditorial` (editorial-index), `PageHeaderOverlap` (overlap-split),
  `PageHeaderMinimal` (inline-strip). Skinless, exact `{data: PageHeaderContent; editPrefix?}` shape
  matching PageHeaderSimple. PageHeaderOverlap's "overlap" is an ink band + overlapping card, NOT a
  photo: PageHeaderContent has no image field, so nothing is claimed and no gradient is used.
- `about/AboutSticky` (sticky-swap, [DEF,SOFT]) and `faq/FaqIndex` (editorial-index, [DEF,SOFT,INV]).
  Archetypes verified unique within about (Feature=count-up-centerpiece, Story=asymmetric-split,
  Sticky=sticky-swap) and faq (Accordion=accordion, StickyAside=sticky-swap, Index=editorial-index).

All seven declared archetypes confirmed present in `src/lib/archetypes.ts`.

**Registration:** CATALOG gained `differentiators` + `stats` keys and the five new variants on
existing categories; `BODY_SLOTS` gained differentiators (between trust and about) and stats (after
work). `categories.tsx` CategoryEntry id union + iconName union extended (`Lightning`, `ChartBar` —
note `iconName` is vestigial data, read by no resolver, so no resolver cases to add), ten imports,
two new CategoryEntry objects, five new variant rows. `page-order.ts` `CANONICAL_ORDER` replaced
with the researched order `['nav','hero','trust','differentiators','services','work','stats',
'testimonials','faq','finalCta','contact','footer']`. `skins.ts` seven new entries via §0.3 loop,
tag **v1.0.6** pushed, both consumers re-pinned + verified at 1.0.6.

**CANONICAL_ORDER dropped `about`** (per the plan's exact array): about is no longer a default home
body section, which matches Phase 9's home templates (none place an about block; about lives on the
about-* page templates). CAVEAT worth knowing: `reconcileOrder` filters selections through
CANONICAL_ORDER, so an about section selected on a non-home page is no longer ordered by it. No test
covers that and no live client exists yet; Phase 9 reworks page structure and ordering, so verify
about-page ordering there.

**Build gate 2026-10-07:** `console npm test` 183/182/1 (0 fail); `console npm run build` EXIT 0;
`template npm run build` EXIT 0; `@jdd/ui` 1.0.6 in both trees.

**Owed to the user (deferred):** the plan's export test (a scratch client whose home template carries
differentiators + stats, built inside the client repo, to prove the new BODY_SLOTS ids wire through
wirePages), and the picker/side-by-side visual review. Phase 9 places all Phase-7/8 components into
PAGE_TEMPLATES and sets rhythm (un-skips page-rhythm test 3).

## Phase 9, COMPLETE 2026-10-07 (one piece deferred, below). No `@jdd/ui` tag.

Page structure: encoded rhythm, the researched home order, and per-service pages. Build gate green,
and page-rhythm test 3 is now LIVE (183/183, 0 skipped).

**9a, rhythm as a field (decision 24):**
- `pages.ts`: `SectionRhythm = 'bleed'|'tight'|'normal'|'loose'|'text'`, `rhythmClass()`, and
  `rhythm?` on `SectionRef`. `validateComposition` gained two throws: a uniform-rhythm page
  (decision 30d, only once rhythms are set so legacy pages are untouched) and a >1-inverted page
  (decision 12).
- `export.ts` `wirePages` `emit()`: a ref with a rhythm now gets `className="rh-*"` on its wrapper,
  and a ref with a rhythm but no style still gets a wrapper div; byte-identical output when a ref
  has neither (legacy pages unchanged).
- `PageStudio.tsx` `SectionShell`: the inner div carries `rhythmClass(ref.rhythm)` so preview and
  export agree.
- `page-rhythm.test.mjs`: test 3 un-skipped.

**9b, templates:** `S()` helper is now `S(categoryId, name, rhythm?, skin?)`. Three home templates
(standard/bold/quiet) in the researched order, each with one inverted section, <=2 signature, >=3
distinct rhythms and no 3 consecutive repeats. Rhythms added to all nine non-home templates; the
2nd template of each core type swaps the page-header archetype (decision 19); a third template was
added per core type (services-showcase, about-sticky, contact-direct) using wave-1/2 components.
Two `section-styles.test.mjs` tests updated to match: the core-template count is now 3 (was asserted
2), and the "real catalog component" check now DERIVES its name set from the real CATALOG in
export.ts (read, not imported) instead of a hardcoded pre-waves snapshot, so it cannot go stale
again.

**9c, one page per service (decision 20):**
- `pages.ts`: `PageTypeId` gained `'service'`; `isValidRoute` widened to one optional slash
  (`services/ac-repair`) with the reserved check on the first segment; `MAX_PAGES` 7 -> 16;
  `servicePageRoutes(items)` -> `services/<slug(item.t)>`.
- `page-templates.tsx`: two `service` templates (service-standard, service-proof); `servicePageFrom
  (item, route)` (navVisible false, label = item.t); `pageFromType('service')` throws and points at
  it; `PAGE_META.service` added.
- Generation UI: `BuildWizard.generateServicePages` (idempotent, skips existing routes, respects
  MAX_PAGES) wired through `PageStudio` to a new PagesMenu button "Generate a page for each service".

**9d hazard:** confirmed both LaunchDialog and DeployDialog carry `composition`, so the exporter
runs `wirePages` (not the legacy flattening) and an 8-section home page exports as 8, not 5.

**DEFERRED (one 9c piece):** the export route does not enrich `content.subpages[route].header` for
service routes to `{eyebrow: item.tag, title: item.t, sub: item.d, cta: null}`. There is no existing
subpages-fill step in `api/build/export/route.ts` to extend (the plan's line-162 reference is stale),
and a service page already renders a working header via wirePages' `fallbackHeaderLiteral(page.label)`
where label is the service's own title. So service pages build with a correct title header; the
richer eyebrow/sub enrichment is the one outstanding piece. Not a blocker.

**Residual caveat (from Phase 8):** CANONICAL_ORDER dropped `about`; multi-page `about` pages are
managed via addPage/composition (not reconcileOrder), so the home/subpage flows are fine, but a
LEGACY single-page client with an about-category section could order oddly on re-export. No live
client is on that path; verify if one surfaces.

**Build gate 2026-10-07:** `console npm test` 183/183 (0 fail, 0 skipped); `console npm run build`
EXIT 0; `template npm run build` EXIT 0.

**Owed to the user (deferred):** the plan's export test (a scratch client with home-standard +
generated service pages, built inside the client repo, confirming each `services/<slug>/page.tsx`
exists and wraps sections in `rh-*` divs), and the preview look at the three home templates.

## Phase 10, COMPLETE 2026-10-08 (10a 2026-10-08, 10b/10c/10d 2026-10-08). No `@jdd/ui` tag.

Multi-page copy review. Being done in committed sub-increments because it changes the load-bearing
content gate and must not be left half-wired.

**10a DONE (commit 921a235), green (test 186/186, console build EXIT 0):**
- `copy-schema.ts`: `VerdictKey` (= `string`), `verdictKey(section, route?)` -> `section` |
  `route:section`, `parseVerdictKey(k)`. Plain string so no `@jdd/schema` change (tickedSections is
  already `string[]`).
- `copy-brief/mutations.ts`: `normalizeVerdicts(brief)` dedupes and KEEPS bare ids as home/site-wide
  keys (never fans them out to routes — the exact failure decision 51 prevents). Wired into both
  BuildWizard brief-read paths (freshBundle ~121, applyBundle ~404).
- `test/copy-verdict.test.mjs`: round-trip + no-fan-out + dedupe.

**10b/10c/10d REMAIN (precise resume spec; files already read, pointers verified):**
- **10b CopyWireframe.tsx:** replace the flat `WIREFRAME_ORDER.map` with page GROUPS (decision 49
  order: home first, then Services, About, Contact, then one group per `pageType==='service'` route,
  services alpha within). Add a `pages: {route,label,pageType}[]` prop (IntakeStep passes it from the
  same place generate-copy's request gets its subpages array). `HOME_SECTIONS` = the current
  WIREFRAME_ORDER list. Change `verdictFor`'s type from `(section)` to `(key: VerdictKey)`; keep the
  `SectionVerdict` SHAPE. Each group: sticky header (label, route, unreviewed count); its cards keyed
  `verdictKey(section, route || undefined)`. KEEP `SectionBody` cases as-is; pass a `route` down for
  the two new cases. Per-route `<E p=>` paths use the `subpages.${route}.header.<field>` prefix
  (mirror compose-page.tsx:40).
- **10c two new SectionBody cases:** (1) `case 'subpages'` for a non-home group renders
  `content.subpages?.[route]` header (eyebrow/title/sub via Eyebrow/Headline/Prose, each wrapped in
  `<E p={`subpages.${route}.header.${field}`}>`), cta as `CtaChip` only when BOTH label+href present
  (matches apply-generated.ts:176), per-page SEO as two `KV` rows
  (`subpages.<route>.seo.title`/`.description`), `NotSet` for absent fields (never fabricate).
  (2) extend `case 'services'`: under each item's `d`, render `it.detail` via
  `<E p={`services.items.${i}.detail`}>` or an italic "No service detail generated..." fallback
  (detail already in copy-schema.ts:37/107; confirm facts.ts covers it, decision 45). Also render
  detail again in the Services page group with its own `verdictKey('services','services')` row.
- **10d IntakeStep.tsx gate (decision 51, HARD block):** `verdictFor(key)` -> resolve with
  `parseVerdictKey`, keep the preRunGenerated snapshot logic verbatim. Compute `unreviewed:
  VerdictKey[]` = every group/section key that HAS generated copy behind it and is still ticked
  (Accept removes it from tickedSections — existing semantics). Disable the "Approve & continue to
  Studio" button (line ~238) while `unreviewed.length>0` (title + one-line reason beside it), and
  make `approve()` (line ~144) early-return if non-empty. Do NOT gate the Brief/Prompt/Review "Next"
  buttons — only `onDone()`. Add the unreviewed count as a badge on the Review stage pill. Leave the
  JSON escape hatch (openJson/saveJson) UNGATED (operator's own content; a comment must say so).
  Derive the `pages` prop from the live composition (route/label/pageType) and pass to CopyWireframe.
- **Migration test:** already added the no-fan-out case in 10a; add a per-page verdict round-trip
  assertion when 10b lands.
- Gate when done: `console npm test && npm run build`, then the plan's export test.

All wizard files were read this session (CopyWireframe 365L, IntakeStep 337L, copy-primitives 110L,
copy-schema, copy-brief/mutations + types); copy-primitives exports Eyebrow/Headline/Prose/CtaChip/
Card/Group/Chips/KV/Stars/hasText/NotSet.

### 10b/10c/10d, as built 2026-10-08. Gate green (test 189/189, both builds EXIT 0).

**Built / changed:**
- **`console/src/lib/copy-review-groups.ts` (NEW).** A pure, React-free, `@/`-free module holding
  `HOME_SECTIONS`, `ReviewGroup`/`ReviewPage`, `buildReviewGroups(pages)` and `reviewKeys(groups)`.
  Extracted rather than inlined in CopyWireframe (as the plan's §10b phrasing assumed) so the
  renderer AND the gate import ONE grouping definition and can never disagree about "every
  reviewable key" — the same single-definition rationale copy-schema.ts uses for `verdictKey`. Being
  pure + relative-importing `./copy-schema`, it is loadable under the node test runner (the suite
  can't load the `'use client'` .tsx), which is how the new ordering tests run. Group order encodes
  decision 49 (home, Services, About, Contact, optional-5th pages, then `pageType==='service'`
  alphabetically by route) via a `PAGE_TYPE_ORDER` map; the Services page group alone carries
  `['subpages','services']`, every other non-home page `['subpages']`.
- **`CopyWireframe.tsx`:** `WIREFRAME_ORDER.map` replaced by page groups. New props `pages:
  ReviewPage[]` and `unreviewed: Set<VerdictKey>`; `verdictFor` is now `(key: VerdictKey) =>`.
  `SectionVerdict` shape UNCHANGED, as the plan requires. A `ReviewGroupBlock` renders a sticky
  group header (label, `/route`, and an unreviewed count read straight from the gate's own set so
  the count and the block can't drift). `SectionBody`/`SectionWireframeCard` gained an optional
  `route`. Two cases: (10c) a `subpages` case rendering `content.subpages[route]` header
  (eyebrow/title/sub via the about-case pattern, each `<E p="subpages.${route}.header.${field}">`,
  mirroring compose-page.tsx:40), the CTA as a `CtaChip` only when BOTH label+href are present
  (matches apply-generated.ts:176), and per-page SEO as two `KV` rows — every absent field `NotSet`,
  never fabricated; and (10c) the `services` case now renders each item's `detail` under its `d`
  (home card) and, when a `route` is passed (the Services page group), a lean detail-only list,
  both editing the same `services.items.${i}.detail` with independent verdict keys (`services` vs
  `services:services`), exactly the "one to sanity-check the list, one to review the page" split.
- **IntakeStep.tsx (10d gate, decision 51 HARD block):** `verdictFor(key: VerdictKey)` resolves via
  `parseVerdictKey`, keeps the `preRunGenerated` snapshot logic verbatim, and now reads/writes
  `tickedKeys` (the brief's raw `string[]`, i.e. VerdictKey[]) instead of the Section[] narrowing —
  the Section[] `tickedSections` is KEPT untouched for the Brief/Prompt pipeline (resolveBrief,
  PromptStage, RunControls), which must stay home-section-only. `unreviewed` = every review key with
  model-generated copy behind it (home: `generated[section]`; per-route header:
  `generated.subpages[route]`) AND still ticked. The Approve-&-continue button is `disabled` while
  non-empty, with a `title` + an inline "Review flagged copy first" note; `approve()` early-returns
  too (belt and braces). The Review stage pill shows the count as a badge. Only `onDone()` is gated;
  the sub-stage Next stays free. The JSON escape hatch is explicitly left ungated with a comment.
- **BuildWizard.tsx:** derives `intakePages` (non-home pages → `{route,label,pageType}`) from the
  live `siteComposition` and passes it to IntakeStep. (`normalizeVerdicts` on both read paths was
  already wired in 10a.)
- **`test/copy-verdict.test.mjs`:** +3 tests — a per-page verdict round-trip (keeps the slash in
  `services/ac-repair:subpages`), the decision-49 group ordering, and route-prefixing in
  `reviewKeys`. Suite 186 → **189**.

**Deviations / judgment calls (none change a settled decision):**
1. **Extracted `copy-review-groups.ts`** instead of inlining the grouping in CopyWireframe. Reason
   above (one source of truth for renderer + gate; node-testable). The plan's file table did not
   list a new file, but every prior phase added shared helpers when a definition had two consumers.
2. **`pages` is derived from the live composition, not from "the place generate-copy's request gets
   its subpages array."** That place does not exist: see the finding below. BuildWizard →
   IntakeStep → CopyWireframe is the honest source, which is exactly the "pages/composition
   pass-through" the resume package's item-2 line for BuildWizard anticipated.
3. **`facts.ts` needs no change for `detail`.** The plan asked to "confirm `detail` is covered by
   facts.ts and add it if not." `facts.ts` is the list of input fact PATHS sent to the model;
   `detail` is an OUTPUT field. Its grounding (decision 45, never fabricated) is already enforced by
   the prompt guardrails — `compile.ts:81` defines `detail` as the 2–3 sentence expansion and
   `compile.ts:24/37` ("invent no facts beyond the notes/details") binds it. Nothing to add.
4. **Group "unreviewed" count uses the gate's `unreviewed` set, not raw `.ticked`.** A fresh brief
   defaults every home section to ticked, so counting raw ticks would show "12 unreviewed" on a site
   where nothing was generated. Counting the gate set (ticked AND has generated copy) makes the
   badge, the per-group count and the actual block agree. `SectionVerdict`'s shape stays unchanged;
   the set is passed as its own prop.

**FINDING surfaced (NOT fixed — out of Phase 10 scope): subpage copy is never generated by the
current Brief flow.** `RunControls.tsx:86` POSTs `{vertical, base, imported, brief, sections, model}`
with NO `subpages`, so `generate-copy/route.ts:62` always defaults `subpages=[]` and line 68 drops
the `subpages` section from every run. So `SiteContent.subpages` is only ever populated from
`imported`/seed, never from a run, and the plan's premise that "subpage headers reach client sites
unreviewed today" is only true for the OLD pre-rebuild path, not the current one. Consequences, all
benign for Phase 10: the per-page review surface shows `NotSet` for any client with no seeded
subpage copy (honest — decision 47 wanted it VISIBLE, and "nothing here yet" is visible); a per-route
Re-roll ticks a key the generation pipeline ignores (latent until subpage generation is wired); the
gate never blocks on a per-route key (none ever has generated copy), so it enforces exactly the home
copy today, per-key-correct and forward-compatible. **Wiring subpage generation (sending
`body.subpages` from RunControls, derived from the composition) is a separate, out-of-scope change**
— the Phase 10 file table excludes RunControls and the phase goal is the review surface + gate.
Phase 11/12 should wire it before the reference site is meant to carry reviewed subpage copy.

**Build-environment note:** no `next dev` was holding `.next` this time (checked via
`Get-CimInstance Win32_Process`); `rm -rf .next` + clean build on both, exit codes captured to a log
file (not through `tail`), per the standing lesson.

**Gate, 2026-10-08:** `console npm test` **189/189** (0 fail, 0 skipped); `console npm run build`
EXIT 0 (console routes confirmed in the summary); `template npm run build` EXIT 0
(`business-site-template@0.1.0` confirmed in the log header). No `@jdd/ui` and no `@jdd/schema`
change (`tickedSections` is already `string[]`), so no tag and no re-pin.

**Owed to the user / deferred (not a blocker):** the plan's final export test (a scratch client with
home + generated service pages, built INSIDE the client repo). Phase 10 changes only console-side
review UI and edits `content`/`brief` the export path already handles — it adds no new exported code
path — so the in-repo export test proves nothing new specific to this phase; folded into the same
export-test review owed from Phases 7–9. Also owed: a real-browser look at the grouped review, the
gate disabling Approve, and the Review-pill badge, folded into the standing Phase 1–6 browser review.

**Phase 10 is COMPLETE.** The shared foundation plus the full page-structure and copy-review layers
(Phases 0–10) are settled. Next: Phase 11 (img.ts local-asset branch, cuts `@jdd/ui` v1.0.7).

## Phase 11, COMPLETE 2026-10-08. Cut `@jdd/schema` v1.22.0 AND `@jdd/ui` v1.0.7.

The build-time image pipeline: fetch each image once at export, emit WebP (four widths) plus AVIF
(hero only) into the client repo's /public/img, kill the Unsplash hotlink, enforce one ratio + one
grade, and keep placeholder provenance working after the URLs become hashes.

**PLAN DEFECT resolved at the user's direction (the only decision this phase needed).** Phase 11c
reads and writes `_meta.local_images`, but `@jdd/schema` v1.21.0's `ContentMeta` had no such field
and the phase's Out-of-scope forbade a schema change. Shipping 11b without 11c reintroduces the exact
regression 11c prevents, so the two can't be split. Surfaced via AskUserQuestion; the user chose
**add the field and cut the schema release now**. So this phase cut a schema tag the plan did not
anticipate, and **Phase 13's schema tag moves from v1.22.0 to `v1.23.0`** (see the drift note above,
now superseded: tickets took v1.21.0, THIS phase took v1.22.0, Phase 13 is v1.23.0).

**Release 1 — `@jdd/schema` v1.22.0 (commit d088f22):** added `ContentMeta.local_images?:
Record<string,string>` (original URL -> '/img/<hash>' base), additive. `npm run build` + `npm test`
green, tagged, pushed; re-pinned all THREE consumers (console, jdd-ops root, agency) via explicit
tagged install; `npm run check-schema` green at v1.22.0.

**Release 2 — `@jdd/ui` v1.0.7 (commit 7be09a9):** `packages/ui/src/img.ts` gained the local-asset
branch (a `/img/<hash>` value with no extension expands to the pipeline's WebP widths), `WIDTHS`
changed from the six origin-resize widths to the pipeline's four `[640,1024,1536,2048]` (kept in
lockstep with image-pipeline.ts via cross-ref comments), and a new `responsivePicture` adds an AVIF
srcSet for the hero slot only. §0.3a loop run; re-pinned console + template, both at 1.0.7.

**11a — `image-placeholders.ts`:** the seven hvac `alt` strings rewritten against photography.md
section 3 (honest "topical stock, not the client's own crew"). Ids unchanged - they are the four
verified HVAC photos the entry already shipped.

**11b — `console/src/lib/image-pipeline.ts` (NEW, `import 'server-only'`, sharp):** `materializeImages
(repoRoot, slug, content, step)` walks every image slot fillImagePlaceholders writes, fetches each
absolute URL once, sha256s the bytes, and for each of the four WIDTHS emits `<hash>-<w>.webp` (plus
`-<w>.avif` only for the hero ratio key, decision 44). Crop = `fit:'cover', position:'attention'`;
grade = `.modulate({saturation:0.88,brightness:1.02}).linear(1.04,-6)` (two passes, NO tint, decision
55); logos skip crop + grade (fit:'inside', long edge only). Rewrites each slot to `/img/<hash>` and
records `_meta.local_images` MERGED onto any prior mapping. Never throws: a failed fetch leaves the
slot hotlinked, pushes to `failed`, and warns. `sharp ^0.33.5` added to console devDependencies,
`server-only ^0.0.1` to dependencies. `template/public/img/.gitkeep` created.

**Reconciliation of a plan tension:** the plan says "emit widths not exceeding the source width" but
its own verification expects "4 widths x every slot" and img.ts's srcSet lists all four (a missing
width is a 404). Resolved with `withoutEnlargement: true`: every width NAME is emitted (srcSet never
404s) while pixels never exceed the source (a 1200px stock photo's `-2048.webp` is ~1200px content).

**11c — provenance (`image-placeholders.ts`):** `isOwnPlaceholder(v, localizedOwn)` now reads
PROVENANCE, not the URL string (decision 39). `fillImagePlaceholders` builds `localizedOwn` from
`_meta.local_images` filtered to entries whose ORIGINAL url was one of ours, so a localized
`/img/<hash>` is still recognised as stock on re-export and refreshed on a vertical change, while a
localized REAL client photo (original url not ours) is never touched. `needsFill` otherwise
unchanged (keeps the `prior.has(path)` conjunct). `test/image-provenance.test.mjs` (NEW) pins both
halves: a localized placeholder stays refreshable; a real client photo never is.

**Heroes (`HeroSplit`, `HeroOverlap`):** switched to `responsivePicture(slide.url, {avif:true})` and a
`<picture>` with AVIF + WebP `<source>`s when the asset is localized, falling back to the existing
`responsiveImage` `<img>` for a non-local (console preview) URL - so the preview is unchanged and the
exported site gets AVIF/WebP. `HeroFormFocus` renders no hero image, so nothing to wire there. (A
lint caught the literal `<img` token in my new code comments - "every <img> declares width and
height" greps source text; reworded the comments.)

**Export route:** `materialize()` helper runs `materializeImages` AFTER `withPlaceholders` and BEFORE
`writeSiteContent`, both the content and vertical branches; `_meta.local_images` and
`placeholder_images` both survive into the written site.ts, and a step line reports localized/failed.

**Gate, 2026-10-08:** `check-schema` green at v1.22.0; both consumers at `@jdd/ui` 1.0.7; `console npm
test` **191/191** (+2 provenance, +3 nothing else changed — the Phase 10 count 189 plus the two
provenance tests, less a miscount: 191 total, 0 fail, 0 skipped); `console npm run build` EXIT 0;
`template npm run build` EXIT 0 (one transient next/font Google-Fonts null-deref on the first
attempt, the documented Phase 3 flake, cleared on retry). Runtime smoke test of the sharp pipeline
(replicating processOne against three live Unsplash URLs in a scratch dir, then deleted): hero = 4
WebP + 4 AVIF, service + logo = 4 WebP + 0 AVIF, total AVIF = 4 (hero only, the decision-44 check),
all four widths emitted with no 404.

**Owed to the user / deferred (not a blocker):** the FULL export-route round-trip - export a real
onboarded HVAC client through the dev server (runs `npm install` + `npm run build` INSIDE the client
repo), inspect `clients/<slug>/repo/public/img` on disk (4 webp x slots, avif hero-only, zero
`images.unsplash.com` in site.ts, `local_images`/`placeholder_images` present), then re-export with
the vertical changed to confirm the stock imagery actually refreshes. This needs an onboarded client
and the dev server and is the same class of in-repo export proof deferred from Phases 7-9; the novel
logic here is covered by the provenance unit tests, the build typecheck of the whole module graph,
and the sharp runtime smoke test above. Also owed: the real-browser look at the hero AVIF/WebP and
the uniform warm-neutral (not sepia) grade, folded into the standing browser review.

**Phase 11 is COMPLETE.** Next: Phase 12 (the HVAC vertical language `VERTICAL_LANGUAGES`, the
conversion non-negotiables checklist, and the locally-built reference site; no `@jdd/ui` tag).

## Phase 12, 12a + 12b COMPLETE 2026-10-08; 12c is a PENDING USER GATE. No `@jdd/ui` tag, no schema change.

The per-vertical layer made typed, thin and enforced, plus the conversion checklist. 12c (the
locally-built reference site) is decision 31 + 43's human review and is handed to the user.

**12a — `console/src/data/vertical-language.ts` (NEW, client-safe):** `VerticalLanguage` = exactly
four axes (`pairingId`, `palette`, `photography`, `rhythm`), `VERTICAL_LANGUAGES` populated for
**hvac only**, transcribed from `VERTICAL-LANGUAGE-hvac.md`: `pairingId:'instrument'`, the Phase 2
warm set plus the decision-11 HVAC accent `#16556A`/`#FFFFFF`, the six photography subjects,
`grade:'house'`, `ratioBias:'wide'`, `homeTemplateId:'home-standard'`, `proofSkin:'soft'`.
`languageFor(id)` falls back to hvac. Only type-only imports (`SkinId`, `VerticalId`), so it is pure
at runtime and node-testable.
- **`verticals.ts` `presetFor` now COMPOSES the language** onto the preset (new object, preset never
  mutated): `languageFor(id).palette` overrides `brand.palette` (coercing the language's
  `accentFg: string|null` to the schema's `string|undefined`) and `typographyFor(lang.pairingId)`
  replaces `brand.typography`. This is where the `#16556A` accent and the single-pairing typography
  actually land. CAVEAT surfaced: the export route's bare-vertical branch still writes
  `VERTICAL_PRESETS[vertical]` DIRECTLY (not through presetFor), so a no-content export of a raw
  preset would ship the legacy `verticals/hvac.ts` accent `#E05C2A` until that file is updated or the
  branch routes through presetFor. The real path (studio content branch) seeds from presetFor and is
  composed, so the reference site and every studio-built client get `#16556A`. Left as-is: 12a's
  listed scope is verticals.ts + the new file + the test; hvac.ts palette edits are not in scope.
- **`vertical-language.test.mjs` (NEW), the §0.6 enforcement (5 tests):** every pairingId is in
  FONT_PAIRINGS; every homeTemplateId is a real `pageType:'home'` template; no vertical references a
  template outside PAGE_TEMPLATES; every palette clears the Phase 2 warmth + contrast asserts (reuses
  `test/helpers/contrast.mjs`'s real @jdd/ui derivation); and `Object.keys(VERTICAL_LANGUAGES.hvac)`
  is exactly the four axes (a fifth field fails here).
- **`VERTICAL-LANGUAGE-hvac.md`:** added a "Vertical rotation note" recording decision 46's untested
  health bet where the health-cycle runner will read it first.

**12b — `console/design/CONVERSION-NON-NEGOTIABLES.md` (NEW):** the six non-negotiables (tap-to-call,
sticky call bar, named service area, review aggregate above the fold, license displayed, form of six
fields or fewer) each with how to check and the owner file(s). Decision 32 is honoured: it is a
HAND-CHECK with no new build-time enforcement machinery, and the doc says why a green check would be
worse than an honest manual walk. Added a `callout` to `go-live-content.ts`'s Preflight gate step
pointing at the file so it surfaces in the operator's go-live flow.

**Gate (12a/12b), 2026-10-08:** `console npm test` **196/196** (0 fail, +5 vertical-language);
`console npm run build` EXIT 0. (`template npm run build` unaffected and not re-run; no @jdd/ui or
schema change this sub-step.)

**12c — the reference site: a PENDING USER GATE (decisions 31 + 43), NOT a deploy.** The real gate
for the whole upgrade: a person looks at the locally-built `_e2e_test_growth` HVAC site and judges
"does it look expensive, and does it still convert." It cannot be discharged from a terminal. The
runbook handed to the user:
1. `cd console && npm run dev` (port 3040, NOT `--turbo`, §0.2 rule 5).
2. `http://localhost:3040/?fixtures=1` (the query toggle beats `CONSOLE_INCLUDE_FIXTURES=0`; do NOT
   flip that env flag), open `_e2e_test_growth`, select the HVAC vertical, apply `home-standard`,
   "Generate a page for each service", generate + review the copy (Phase 10's gate), then Launch.
3. `cd clients/_e2e_test_growth/repo && npm run build` (this is the plan's build gate) then
   `npm start`, open `http://localhost:3000` in a REAL browser.
4. Hand-walk `CONVERSION-NON-NEGOTIABLES.md` at 390px and 1440px.

**The logged 43-vs-31 tension the user should know before trusting the review:** decision 43 declines
a deploy, so this first fidelity review happens in a DESKTOP browser at a 390px viewport, where
non-negotiables **1 (tap-to-call) and 2 (sticky mobile bar)** cannot be fully verified (touch
targets, the `tel:` handoff, and real scroll/motion only exist on a phone; also §0.4's hidden preview
pane freezes motion). Review against `npm start` at `localhost:3000`, never the console preview pane.
If the local review feels untrustworthy, that is the signal to revisit decision 43 and ask for a
deploy on a real device, which is the user's call. Decision 36 remains absolute: Atlantic and Air
Service are `externalManaged` and untouched.

Phase 12's executor work (12a + 12b) is done and committed; **12c awaits the user.**
