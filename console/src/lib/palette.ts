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
    /* The schema's accentFg is a REQUEST, not an instruction — honoured only when it actually
       passes AA against the accent it sits on. Measured 2026-08-18: the e2e HVAC client sets
       accentFg "#FFFFFF" over accent "#e08b29" = 2.66:1, failing AA for normal AND large
       text. The old `p.accentFg ?? readableOn(...)` let an explicit value skip the fallback,
       so a hand-entered failing color overrode the correct computed one (brand ink, ~7:1).
       Keep this in step with template/src/lib/palette.ts. */
    '--accent-fg': passesAA(p.accentFg, accent) ? (p.accentFg as string) : readableOn(accent, ink),
    /* Accent darkened until it clears AA as TEXT on the page background. `--accent` stays the
       authored brand color for fills, borders and icons; anything rendering accent-colored
       TYPE must use this token. Tailwind's `textColor.accent` maps here. */
    '--accent-text': accentText(accent, bg, p.bgSoft),
    /* Availability and emergency cues only ("24/7", "same-day"), never decoration. Pulled
       toward a canonical alert red so it reads as urgency rather than more brand colour,
       then put through the same AA loop as --accent-text. Keep in step with template. */
    '--urgent': urgentTone(bg, p.bgSoft),
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
    '--heading-tracking': t.headingTracking ?? 'normal',
    '--heading-line-height': String(t.headingLineHeight ?? 1.15),
    // Actually APPLY the body font to the preview subtree.
    //
    // globals.css gives headings `font-family: var(--font-heading)` inside .studio-chrome,
    // but nothing claimed body text — so it inherited the console's own chrome font from
    // <body> and picking a body font in the drawer did nothing visible. Setting it here
    // scopes it exactly to the elements that receive these vars (the finalize <main>, the
    // build-step preview cards) instead of leaking into the wizard/drawer chrome.
    //
    // Headings are unaffected: the .studio-chrome :where(h1..h6) rule matches those
    // elements directly, which beats an inherited value from this ancestor.
    fontFamily: 'var(--font-sans)',
    fontWeight: 'var(--body-weight)',
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

/**
 * WCAG contrast ratio between two hex colors (1–21). Wraps the private helpers above so
 * the brand drawer's palette pane can show an AA readout without duplicating the math.
 * Returns 1 (worst case, so the UI flags it) on an unparseable color.
 */
export function contrast(a: string, b: string): number {
  try {
    return contrastRatio(relLuminance(a), relLuminance(b));
  } catch {
    return 1;
  }
}

/** WCAG AA for normal text. Large text only needs 3.0, but these tokens are used at every
 *  size, so the stricter bar is the only safe one to hold. */
const AA_NORMAL = 4.5;

/** True when `fg` is set AND legible on `bg`. Unset or failing returns false, so the caller
 *  falls back to a computed foreground. */
function passesAA(fg: string | null | undefined, bg: string): boolean {
  if (!fg) return false;
  try {
    return contrastRatio(relLuminance(fg), relLuminance(bg)) >= AA_NORMAL;
  } catch {
    return false;
  }
}

/**
 * The brand accent pushed toward legibility as text on `bg`, stopping at the first passing
 * shade so the result stays recognisably the client's color.
 *
 * `mix(a,b,t)` is `a + (b-a)*t`, so the step is deliberately small — a coarse t would blacken
 * the accent in one pass. Bounded at 24 iterations: a pathological accent (mid-grey on a
 * mid-grey page) can never reach 4.5, and the loop must not hang.
 *
 * Keep in step with template/src/lib/palette.ts.
 */
function accentText(accent: string, ...bgs: string[]): string {
  try {
    const [primary] = bgs;
    // Direction comes from the primary background; a page is light or dark as a whole, and
    // `--bg-soft` is by definition a near neighbour of `--bg`. (The template twin has an
    // `isDarkHex` helper for this; this file inlines the same 0.18 threshold.)
    const toward = relLuminance(primary) < 0.18 ? '#ffffff' : '#000000';
    let candidate = accent;
    for (let i = 0; i < 24; i++) {
      // Must clear AA on EVERY surface it can land on, not just --bg. This token is used by
      // `text-accent`, and a section can be `default` or `soft`, so deriving against --bg
      // alone left the soft surface untested: it passed by 0.03 on one client palette and
      // 0.08 on another, which is luck rather than a guarantee.
      if (bgs.every((b) => contrastRatio(relLuminance(candidate), relLuminance(b)) >= AA_NORMAL)) {
        return candidate;
      }
      // 8% per step, not a big jump: `mix(a,b,t)` is `a + (b-a)*t`, so a coarse t would
      // blacken the brand color in one pass. Small steps stop at the first passing shade,
      // which keeps the result recognisably the client's accent.
      candidate = mix(candidate, toward, 0.08);
    }
    return readableOn(primary);
  } catch {
    return readableOn(bgs[0]);
  }
}

/** The red every urgency tone is pulled toward. Fixed on purpose: "emergency" should look
 *  broadly the same across clients, or it stops reading as a signal. */
const ALERT_RED = '#B3251A';

/**
 * The urgency tone: a fixed alert red, adjusted only until it is legible on this client's
 * background.
 *
 * Deliberately NOT derived from the brand accent. An earlier version mixed 65% of the accent
 * in, which made "emergency" a different colour on every site and went muddy for hue-distant
 * brands (a teal accent produced #7f3f3b, a dull brick). Urgency is a signal, like a stop
 * sign, and a signal only works if it is the same signal everywhere. The brand colour already
 * owns the rest of the page.
 */
function urgentTone(...bgs: string[]): string {
  return accentText(ALERT_RED, ...bgs);
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
