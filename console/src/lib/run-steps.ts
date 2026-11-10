/**
 * The Prompt step's run box (Xander, 2026-11-10, approved as the "Prompt v2" mockup): a small box
 * above the intake nav that steps through the sections to write, a group at a time, then the
 * model and its estimate, then a summary over the Generate button.
 *
 * Pure data and helpers, so the step list, its headers and the summary are tested without React.
 */
import { ALL_SECTIONS, type Section } from './copy-schema';
import { labelFor } from './section-labels';

export type RunStep =
  | { kind: 'sections'; label: string; sections: Section[] }
  | { kind: 'model'; label: string }
  | { kind: 'summary'; label: string };

/** The approved headers, word for word, and the sections under each. */
export const RUN_STEPS: RunStep[] = [
  { kind: 'sections', label: 'Top of the home page', sections: ['announcement', 'trust', 'hero'] },
  { kind: 'sections', label: 'Middle of the home page', sections: ['about', 'services', 'work', 'testimonials'] },
  { kind: 'sections', label: 'Bottom of the home page', sections: ['faq', 'finalCta', 'footer'] },
  { kind: 'sections', label: 'Other pages', sections: ['seo', 'subpages', 'servicePages'] },
  { kind: 'model', label: 'Model' },
  { kind: 'summary', label: 'Summary' },
];

/** Every section the box can switch: all of them but `brand`, which is never written by a run. */
export const SWITCHABLE: Section[] = ALL_SECTIONS.filter((s) => s !== 'brand');

/** Turns one section on or off, keeping the order the run will write them in. */
export function switchSection(ticked: Section[], s: Section, on: boolean): Section[] {
  const set = new Set(ticked);
  if (on) set.add(s); else set.delete(s);
  return SWITCHABLE.filter((x) => set.has(x));
}

export type RunSummary = { on: number; of: number; off: string[] };

/** The summary step's lines: how many sections are on, out of how many, and which are off. */
export function runSummary(ticked: Section[]): RunSummary {
  const set = new Set(ticked);
  return {
    on: SWITCHABLE.filter((s) => set.has(s)).length,
    of: SWITCHABLE.length,
    off: SWITCHABLE.filter((s) => !set.has(s)).map(labelFor),
  };
}

/** "Generate 10 sections", or "Regenerate 1 section" once copy has been generated. */
export function generateLabel(count: number, hasGenerated: boolean): string {
  return `${hasGenerated ? 'Regenerate' : 'Generate'} ${count} section${count === 1 ? '' : 's'}`;
}
