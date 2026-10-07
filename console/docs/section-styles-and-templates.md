# Per-section styling & page templates

How the Studio lets an operator style individual sections, and how to add new page templates.
Both features reuse the existing catalog — no new section components.

## Per-section styling (`sectionStyles`)

Palette and typography are global by default (one `BrandPalette` applied as CSS variables on the
site root). Per-section styling is an **override layer** on top of that global, stored on
`SiteContent.sectionStyles` and keyed by section.

### The data

`@jdd/schema` (`src/site.ts` + the inlined `src/site-types-source.ts`):

```ts
interface SectionStyle {
  accent?: string;        // hex — per-section accent
  bg?: string;            // hex — per-section background
  bgSoft?: string;        // hex — per-section soft/alt background
  headingWeight?: number; // 300–800
  scale?: number;         // section zoom, 0.85–1.2 (1 = unchanged)
}
interface SiteContent {
  // …
  sectionStyles?: Record<string, SectionStyle>;
}
```

Both declarations must stay in `site.ts` AND `site-types-source.ts` (a drift test asserts interface
names match, and the inlined source is what ships into client repos). After editing, rebuild:
`npm run build` in `ops/jdd-schema`.

### The key: stable section ids

Body sections carry a stable `id` (`SectionRef.id`), minted by `newSectionId()` when the section is
placed (`applyTemplate` / `pageFromType`). `styleKeyFor(ref)` returns that id for body sections and
the slot name (`'nav'` / `'footer'`) for chrome — chrome is site-wide, one each. `ensureSectionIds()`
backfills ids on any composition lifted from a legacy bundle or read back from a repo.

Re-applying a template mints fresh ids, so a template swap is a structural reset — per-section styles
on the replaced sections are intentionally dropped.

### How it renders

`sectionVars(brand, style)` (in `console/src/lib/palette.ts` and its byte-identical twin in
`template/src/lib/palette.ts`) maps a `SectionStyle` to scoped CSS variables:

- Palette-slot overrides (`accent`/`bg`/`bgSoft`) are merged into the brand palette and run back
  through `paletteVars()`, so derived tokens (`--accent-fg`, `--accent-text`, tint ramp, dark
  contrast surface) recompute and stay AA-correct against the section's own background. This is the
  "auto-guard + derive" behaviour — text/ink stay global, contrast is preserved automatically.
- `headingWeight` → `--heading-weight` (same var the global heading rule consumes; reaches the same
  headings the global control does).
- `scale` → CSS `zoom` on the section wrapper (scales the whole section's rhythm proportionally).

Returns `{}` for an empty/absent style, so an unstyled — or reset — section is never wrapped.

- **Preview:** `PageStudio`'s `SectionShell` wraps each section's content in
  `<div style={sectionVars(effective.brand, effective.sectionStyles?.[key])}>` (the `zoom`/vars sit on
  an inner div so the control panel itself isn't scaled).
- **Export:** `wirePages` emits the same wrapper in the generated client `page.tsx` **only** for
  sections whose `sectionStyles[key]` is non-empty, plus a single `import { sectionVars }` per styled
  page. Unstyled pages are byte-identical to before, and the read-back parser is unaffected (the inner
  `<Component />` still matches; the wrapping `<div>` is ignored).

> Because `sectionVars` lives in the template-owned `src/lib/palette.ts`, a client that adopts
> per-section styles for the first time should be exported with **overwrite** enabled so its repo
> picks up the updated lib. (`@jdd/ui` is a pinned GitHub dependency, so the helper is defined in the
> local libs rather than in `@jdd/ui` to avoid a republish; keep the console + template copies in
> sync, and mirror into `packages/ui/src/palette.ts` for a future consolidated publish.)

### The control panel

A ~3s hover-dwell over a section in the live preview opens `SectionControlPanel` — the section's full
control center: palette swatches (preset + freeform), heading weight, section scale, surface skin,
variant swap, and resets. It closes on pointer-leave after a ~1.5s grace (re-entering the section or
panel cancels the close). All changes go through the existing `setField` → Studio undo stack.

**Write discipline:** the panel always writes the WHOLE `sectionStyles.<key>` object, never a leaf
path. `setField` only strips descendant edits for array writes, so a leaf write could be resurrected
by a stale key after a reset; a whole-object write also cleanly overrides an `imported` value on a
re-opened client. Per-slot reset writes the object minus that slot; "Reset section" writes `{}`. The
toolbar's global "Reset styles" strips both `overrides.` and `sectionStyles.` edits.

## Adding a page template

Templates live in `console/src/app/c/[slug]/build/page-templates.tsx` as ordered `SectionRef[]`.
`templatesFor(pageType)` returns every template for a page type, and the Studio picker shows them all,
so adding an entry is all that's needed.

Guidelines:

- **Reuse the catalog only** (`CATALOG` in `export.ts`). Differentiate by **order + variants**, not
  decoration. Use any catalog category that strengthens the page.
- **Skins:** only components listed in `SKINS` (`packages/ui/src/skins.ts`) accept a `skin` — e.g.
  `AboutStory`, `ServiceArea`, `FaqStickyAside`, `FinalCtaSplit`, `ContactCardOverlap`. Skinless
  components (`ServicesPanel`, `TrustBadges`, `TestimonialsCarousel`, `FinalCtaBanner`,
  `FinalCtaSimple`, `PageHeaderSimple`, …) must NOT carry a `skin` literal. Skin-capable components
  render at their `defaultSkin(name)` with no literal, so tasteful banding is mostly automatic; pass
  `S(cat, name, skin)` only to deviate, and only with a valid skin.
- Non-home templates must open with a `pageHeader`; home must not (validated by
  `validateComposition`). Ids are minted per instance on apply, so template literals stay id-less.
- Keep it appropriate for local service businesses: no blog, pricing tables, team bios, or heavy
  motion/galleries.

Current second templates: `services-panel`, `about-proof`, `contact-overlap`.

## Verify

- `npm test` in `console` (covers ids, `styleKeyFor`, `ensureSectionIds`, the new templates).
- `npm run build` + `npm test` in `ops/jdd-schema` (schema + drift test).
- `npx tsc --noEmit` in `console`, filtered to touched files.
- End-to-end: export a throwaway client with one styled section and confirm its generated
  `page.tsx` wraps only that section and the repo builds; an unstyled export stays byte-identical.
