import type { CSSProperties } from 'react';
import type { Brand } from '@/data/site';
import { tint, shade, mix, withAlpha } from '@/lib/color';

// Maps the brand palette + typography onto CSS custom properties. layout.tsx
// spreads these onto <body> so every component inherits them via Tailwind tokens
// (bg-accent, text-ink, border-rule, …) and the font-sans / font-heading families.
//
// Beyond the 7 authored brand tokens, we derive a richer set at runtime (tint ramp,
// gradient, and an on-brand dark "contrast" surface) so catalog components can reach
// for premium tones without any change to the brand schema or vertical presets.
export function paletteVars(brand: Brand): CSSProperties {
  const p = brand.palette;
  const { accent, ink, bg } = p;
  const accentStrong = shade(accent, 0.2);
  const inkPanel = shade(ink, 0.08);
  const onInk = readableOn(inkPanel); // '#ffffff' for dark panels
  return {
    // ── authored tokens (unchanged) ──
    '--accent': accent,
    '--accent-fg': p.accentFg ?? readableOn(accent, ink),
    '--bg': bg,
    '--bg-soft': p.bgSoft,
    '--ink': ink,
    '--ink-soft': p.inkSoft,
    '--rule': p.rule,
    // ── derived accent tones ──
    '--accent-050': tint(accent, 0.92),
    '--accent-100': tint(accent, 0.84),
    '--accent-200': tint(accent, 0.68),
    '--accent-strong': accentStrong,
    '--accent-glow': withAlpha(accent, 0.32),
    '--accent-grad': `linear-gradient(135deg, ${accent} 0%, ${accentStrong} 100%)`,
    // ── on-brand dark ("contrast" skin) section tones ──
    '--ink-panel': inkPanel,
    '--ink-panel-2': mix(inkPanel, accent, 0.16),
    '--on-ink': onInk,
    '--on-ink-soft': withAlpha(onInk, 0.7),
    '--rule-ink': withAlpha(onInk, 0.16),
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

// ── Contrast helper ───────────────────────────────────────────────────────────
// Picks the more readable foreground (white or the brand ink) for text on the accent
// background, so accent CTAs stay legible whatever accent a client chooses. Used when
// brand.palette.accentFg is not explicitly set.
function relLuminance(hex: string): number {
  const h = hex.replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(a: number, b: number): number {
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

/** White or `dark` (brand ink), whichever contrasts better against `bg`. */
export function readableOn(bg: string, dark = '#0f1b2d'): string {
  try {
    const lb = relLuminance(bg);
    const whiteC = contrastRatio(1, lb);
    const darkC = contrastRatio(relLuminance(dark), lb);
    return darkC > whiteC ? dark : '#ffffff';
  } catch {
    return '#ffffff';
  }
}
