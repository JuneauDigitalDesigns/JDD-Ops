import type { SiteContent } from '@/data/site';
import { languageFor } from '@/data/vertical-language';
import { typographyFor } from '@/lib/fonts';
import { CONTENT as hvacContent } from '@/data/verticals/hvac';
import { CONTENT as roofingContent } from '@/data/verticals/roofing';
import { CONTENT as plumbingContent } from '@/data/verticals/plumbing';
import { CONTENT as lawnCareContent } from '@/data/verticals/lawn-care';
import { CONTENT as carDetailingContent } from '@/data/verticals/car-detailing';
import { CONTENT as healthContent } from '@/data/verticals/health';

/**
 * A plain string, not a closed union, so a custom vertical id (created via the vertical
 * editor, resolved server-side from console/.state/verticals.json — see
 * lib/verticals-registry.ts) can flow through the same type without a cast. Client
 * components only ever see the six built-in ids below until the custom-vertical UI ships;
 * this widening just stops that day from being a breaking type change.
 */
export type VerticalId = string;

export interface Vertical {
  id: VerticalId;
  label: string;
}

/**
 * Client-safe. This module is imported by 'use client' components (VerticalPicker.tsx,
 * BuildWizard.tsx) and must never pull in node:fs or `server-only` — for the full registry
 * (built-ins + operator overrides + custom verticals), see lib/verticals-registry.ts, which
 * is server-only and used by API routes.
 */
export const VERTICALS: Vertical[] = [
  { id: 'hvac',          label: 'HVAC' },
  { id: 'roofing',       label: 'Roofing' },
  { id: 'plumbing',      label: 'Plumbing' },
  { id: 'lawn-care',     label: 'Lawn Care' },
  { id: 'car-detailing', label: 'Car Detailing' },
  { id: 'health',        label: 'Health & Wellness' },
];

export const DEFAULT_VERTICAL_ID: VerticalId = VERTICALS[0].id;

export const VERTICAL_PRESETS: Record<string, SiteContent> = {
  'hvac':          hvacContent,
  'roofing':       roofingContent,
  'plumbing':      plumbingContent,
  'lawn-care':     lawnCareContent,
  'car-detailing': carDetailingContent,
  'health':        healthContent,
};

/**
 * The preset SiteContent for a vertical id, falling back to the default when the id is unknown.
 *
 * COMPOSES the vertical's design language (decision 35) onto the preset so the two can never
 * disagree: `languageFor(id).palette` overrides the preset's brand.palette and
 * `typographyFor(language.pairingId)` replaces brand.typography. A new object is returned (the
 * imported preset modules are never mutated). This is where the HVAC accent decision (#16556A) and
 * the single-pairing typography actually land; the raw verticals/<id>.ts files carry the legacy
 * values until their own cycle. Guarded for a custom vertical id the bundle has never heard of, and
 * client-safe (both imports are node:fs-free).
 */
export function presetFor(id: VerticalId): SiteContent {
  const preset = VERTICAL_PRESETS[id] ?? VERTICAL_PRESETS[DEFAULT_VERTICAL_ID];
  const lang = languageFor(id);
  return {
    ...preset,
    brand: {
      ...preset.brand,
      palette: { ...preset.brand.palette, ...lang.palette, accentFg: lang.palette.accentFg ?? undefined },
      typography: typographyFor(lang.pairingId),
    },
  };
}
