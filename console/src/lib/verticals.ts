import type { SiteContent } from '@/data/site';
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
 * The preset SiteContent for a vertical id, falling back to the default when the id is
 * unknown. Now that VerticalId is a plain string, `VERTICAL_PRESETS[id]` alone can return
 * undefined for an id this client bundle has never heard of (a custom vertical, before that
 * UI exists) — this is the guarded version callers should use instead.
 */
export function presetFor(id: VerticalId): SiteContent {
  return VERTICAL_PRESETS[id] ?? VERTICAL_PRESETS[DEFAULT_VERTICAL_ID];
}
