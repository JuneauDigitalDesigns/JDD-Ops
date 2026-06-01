import type { CSSProperties } from 'react';
import type { Brand } from '@/data/site';

// Maps the brand palette + typography onto CSS custom properties. layout.tsx
// spreads these onto <body> so every component inherits them via Tailwind tokens
// (bg-accent, text-ink, border-rule, …) and the font-sans / font-heading families.
export function paletteVars(brand: Brand): CSSProperties {
  const p = brand.palette;
  return {
    '--accent': p.accent,
    '--bg': p.bg,
    '--bg-soft': p.bgSoft,
    '--ink': p.ink,
    '--ink-soft': p.inkSoft,
    '--rule': p.rule,
  } as CSSProperties;
}

export function typographyVars(brand: Brand): CSSProperties {
  const t = brand.typography;
  return {
    '--font-sans': t.fontSans,
    '--font-heading': t.fontHeading,
    '--heading-weight': String(t.headingWeight),
    '--body-weight': String(t.bodyWeight),
  } as CSSProperties;
}
