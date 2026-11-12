/**
 * Sample jobs that must never reach a client site as the client's work (operator decision,
 * 2026-11-12). The work-section twin of lib/sampleReviews.ts.
 *
 * The HVAC preset carried three sample jobs in Clermont, Winter Garden and Groveland, FL, and the
 * default seed three in Juneau, AK. `effective = preset <- imported <- generated <- edits` let them
 * through wherever a client had no jobs of its own, and a copy run or an operator edit bakes them
 * into the draft: clients/_e2e_test_growth (Orlando) holds the HVAC three in its imported content,
 * its generated copy, and an edit of work.projects that added four real photo jobs after them.
 *
 * So this lists every sample job any preset or seed has shipped, plus the preview-only sets
 * fillImagePlaceholders injects into an empty work section (data/image-placeholders.ts), and
 * stripSampleProjects removes any project matching one. It runs on the Studio's effective content
 * (so the preview, the copy run's base and the export all agree) and again in the export route
 * before site.ts is written. Add to this list, never remove from it. Guarded by
 * test/no-sample-projects.test.mjs.
 */
import { PREVIEW_PLACEHOLDERS } from '@/data/image-placeholders';

export interface RetiredSampleProject {
  t: string;
  loc: string;
  scope: string;
  /** Where it shipped from, for the reader. */
  from: string;
}

export const RETIRED_SAMPLE_PROJECTS: readonly RetiredSampleProject[] = [
  { from: 'data/verticals/hvac.ts', t: 'Full system replacement', loc: 'Clermont, FL', scope: '3-ton high-efficiency heat pump, one day turnaround.' },
  { from: 'data/verticals/hvac.ts', t: 'Ductless mini-split install', loc: 'Winter Garden, FL', scope: 'Two-zone system for a converted garage suite.' },
  { from: 'data/verticals/hvac.ts', t: 'Emergency AC repair', loc: 'Groveland, FL', scope: 'Same-night compressor fix, family cooling again by 9 p.m.' },
  { from: 'data/site.ts', t: 'Bergmann Apartment Complex: Full HVAC Retrofit', loc: 'Downtown Juneau, AK', scope: 'Commercial retrofit' },
  { from: 'data/site.ts', t: 'Single-Family Plumbing Repipe', loc: 'Mendenhall Valley, AK', scope: 'Residential plumbing' },
  { from: 'data/site.ts', t: 'Juneau School District: Boiler Replacement', loc: 'Juneau, AK', scope: 'Commercial mechanical' },
  ...Object.entries(PREVIEW_PLACEHOLDERS).flatMap(([vertical, set]) =>
    set.workProjects.map((p) => ({ from: `data/image-placeholders.ts (${vertical}, preview only)`, t: p.t, loc: p.loc, scope: p.scope }))),
];

/** Letters and digits only, lowercased, as sampleReviews.ts compares quotes. */
function normalize(v: unknown): string {
  return typeof v === 'string' ? v.toLowerCase().replace(/[^a-z0-9]+/g, '') : '';
}

const RETIRED = RETIRED_SAMPLE_PROJECTS.map((p) => [normalize(p.t), normalize(p.loc), normalize(p.scope)] as const);

/**
 * A project is a sample when two of its title, place and description equal the same sample's.
 * Two, not three: the copywriter rewords a field it was handed, and a reworded sample is still an
 * invented job in an invented place. Not one: a real job may share a sample's title
 * ("Emergency AC repair") or town.
 */
export function isSampleProject(p: unknown): boolean {
  if (!p || typeof p !== 'object') return false;
  const o = p as { t?: unknown; loc?: unknown; scope?: unknown };
  const mine = [normalize(o.t), normalize(o.loc), normalize(o.scope)];
  return RETIRED.some((r) => r.filter((v, i) => v !== '' && v === mine[i]).length >= 2);
}

/**
 * Returns the content with every sample job removed, and how many were. Never mutates the input.
 * Content with no matching project comes back as the same object. A work section left with no
 * projects is hidden, the state every preset ships it in: an empty one shown would be a heading
 * over nothing.
 */
export function stripSampleProjects<T>(content: T): { content: T; removed: number } {
  const c = content as unknown as { work?: { hidden?: boolean; projects?: unknown[] } };
  const projects = c?.work?.projects;
  if (!Array.isArray(projects)) return { content, removed: 0 };
  const kept = projects.filter((p) => !isSampleProject(p));
  const removed = projects.length - kept.length;
  if (removed === 0) return { content, removed: 0 };
  return {
    content: { ...(content as object), work: { ...c.work, projects: kept, ...(kept.length ? {} : { hidden: true }) } } as T,
    removed,
  };
}
