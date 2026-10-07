// Re-export shim. The implementation lives in @jdd/ui so the console, the template and
// every exported client repo share one copy. Kept at this path so catalog components can go
// on importing '@/lib/…' unchanged — and so verifyCatalogImports still finds it.
export * from '@jdd/ui/palette';

import { paletteVars as _paletteVars, type BrandLike } from '@jdd/ui/palette';
import type { CSSProperties } from 'react';

/**
 * Per-section style, declared STRUCTURALLY (mirrors @jdd/schema's SectionStyle). Lives here rather
 * than in @jdd/ui because @jdd/ui is a pinned GitHub dependency; defining it in this template-owned
 * lib means an `overwrite` export refreshes it into client repos without republishing @jdd/ui.
 * Keep byte-identical to the twin in console/src/lib/palette.ts.
 */
export type SectionStyleLike = {
  accent?: string;
  bg?: string;
  bgSoft?: string;
  headingWeight?: number;
  scale?: number;
};

/**
 * CSS custom properties to scope onto ONE section's wrapper element, so that section renders with
 * its own palette/typography as an OVERRIDE LAYER over the global brand. The exported page.tsx wraps
 * styled sections in `<div style={sectionVars(CONTENT.brand, CONTENT.sectionStyles?.["<id>"])}>`.
 *
 * Returns `{}` for a falsy/empty style. When any palette slot is overridden, the slots are merged
 * into the brand palette and run back through paletteVars(), so derived tokens (--accent-fg,
 * --accent-text, tint ramp, dark contrast surface) recompute and stay AA-correct against the
 * section's own background.
 */
export function sectionVars(brand: BrandLike, style?: SectionStyleLike | null): CSSProperties {
  if (!style || Object.keys(style).length === 0) return {};
  const out: Record<string, string | number> = {};
  if (style.accent || style.bg || style.bgSoft) {
    const merged: BrandLike = {
      ...brand,
      palette: {
        ...brand.palette,
        ...(style.accent ? { accent: style.accent } : {}),
        ...(style.bg ? { bg: style.bg } : {}),
        ...(style.bgSoft ? { bgSoft: style.bgSoft } : {}),
      },
    };
    Object.assign(out, _paletteVars(merged));
  }
  if (style.headingWeight) out['--heading-weight'] = String(style.headingWeight);
  if (style.scale && style.scale !== 1) out.zoom = style.scale;
  return out as CSSProperties;
}
