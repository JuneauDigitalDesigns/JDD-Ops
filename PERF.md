# Lighthouse: measured baseline and what actually moved it

Target: **100** Accessibility / Best Practices / SEO, **≥95** Performance, Lighthouse mobile preset.

Measured 2026-08-18 against `_e2e_test_growth` ("Your HVAC Co."). Baseline is the deployed
site; later columns are `next start` locally on the same build pipeline. Raw reports are
written to `.perf/` (gitignored — they are ~600KB each).

| | baseline (deployed) | fonts + a11y | + static hero | + image sizes |
|---|---|---|---|---|
| Performance | 84 | 97 | 90 | **100** |
| Accessibility | 96 | 100 | 96 | **100** |
| Best Practices | 96 | 96 | 93 | **96** \* |
| SEO | 100 | 100 | 100 | **100** |
| LCP | 4.2s | 2.5s | 2.0s | **1.5s** |
| CLS | 0 | 0 | 0.193 | **0** |
| TBT | 10ms | 10ms | 0ms | 10ms |
| Speed Index | 3.5s | 1.3s | 0.9s | **0.9s** |

\* The only remaining console error is a 404 on `/_vercel/insights/script.js`, which exists
because the run is on localhost. It resolves on a Vercel deploy. Re-measure deployed to
confirm 100.

## What actually caused the low score

**1. 292KB of fonts that no glyph used.** `template/src/lib/fonts.loader.ts` instantiated
eight Google families and `layout.tsx` attached all eight to `<html>`. `next/font` preloads by
default, so every client shipped **12 `<link rel=preload as=font>`** — the largest single
category of bytes on the page, ahead of the hero image (153KB) and the largest script (92KB).
The HVAC client's `brand.typography` is a plain system stack, so none of it was used. Being
preloads, they were high priority and starved the render path on throttled mobile.

Fixed by `preload: false` plus `fontVarsFor()`, which attaches only the families a brand's
stacks actually name. A system-stack client now ships **zero** font bytes.

**2. An accent color that could not legally be used.** `#e08b29` on `#ffffff` is **2.66:1**;
AA needs 4.5. It failed in three places: the eyebrow, the `tel:` link, and the primary CTA
(whose `accentFg` was `#FFFFFF` over the accent — also 2.66:1). The CTA case was a bug in
`palette.ts`: `p.accentFg ?? readableOn(...)` meant an explicitly-set failing value skipped
the correct computed fallback (brand ink, ~7:1).

Fixed by validating `accentFg` against measured contrast rather than trusting it, and adding
`--accent-text` (accent darkened until it clears AA). Tailwind's `theme.textColor.accent`
maps `text-accent` to it, so all ~159 call sites were corrected without editing a component.
`bg-accent` / `border-accent` still paint the authored brand hex.

**3. A missing favicon.** No `public/` dir and no icon, so every site 404'd `/favicon.ico`.
That single 404 was the entire Best Practices gap. Fixed with `app/icon.tsx`, generated from
the client's own palette.

**4. An animated LCP element.** The hero's sub-paragraph is the LCP node, and it sat in a
`motion.div` with `initial={{opacity:0}}` and `delay: 0.35`. It could not paint until the
bundle downloaded, hydrated, the observer fired, 350ms elapsed and a 600ms tween ran —
**84% of a 4.2s LCP was Render Delay**, on plain text.

## Two things the baseline made look fine that were not

**Total Blocking Time was 10ms.** Hydration cost is not the problem on these sites. Removing
framer-motion or migrating components to the server buys ~nothing on Performance. Any future
argument for those changes has to stand on code quality, not on this score.

**CLS read 0 only because animations were hiding it.** Removing the hero entrance took CLS
from 0 to 0.193: `<img class="h-full w-full object-cover">` with no `width`/`height` measured
**1200×892 on a 396px viewport** and shifted `#services` by 1400px. The clip/fade entrances
had been masking a real unsized-image bug by keeping content hidden until after load — buying
0 CLS at a cost of ~2s of LCP.

Note `width`/`height` are load-bearing here even though CSS sets the rendered size: they are
the only thing giving the element an intrinsic ratio before the bytes arrive. Every in-flow
catalog `<img>` now carries them, matching its wrapper's ratio.

## Known remaining

- `FooterBrandCta`'s logo (`h-8 w-auto`) is still unsized and in flow. A fixed ratio would
  distort client logos of unknown proportion; it needs a reserved-height wrapper instead.
  Deferred to the component recomposition.
- Remaining opportunities, all small: `uses-responsive-images` (~101KB), `legacy-javascript`
  (~160ms), `render-blocking-resources` (one 2KB stylesheet).
- Images marked `absolute inset-0` (HeroOverlap, HeroSlideshow, ServicesPanel, AboutFeature)
  are out of flow and cannot shift layout, so they were deliberately left unsized.
