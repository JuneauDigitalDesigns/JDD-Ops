/**
 * Towns on the intake's Area & profiles step (Xander, 2026-11-12, approved as the canvas's row 8,
 * wording word for word): the client's top 3 towns, each town's progress towards a page of its own,
 * and the operator's sourced town notes.
 *
 * Every rule is @jdd/schema's (v1.34.0), never re-counted here: a town is the client's own spelling
 * (canonicalTown), the main city is the home page (isMainCity), and which towns get a page is the
 * gate itself (areaPageFacts, pickAreaPages). A town note counts only with an http(s) source link
 * (L9: local codes, permits and conditions come only from the client or a sourced operator note).
 */
import {
  AREA_FACTS_MIN, AREA_KINDS_MIN, TOP_TOWNS_MAX,
  areaPageFacts, canonicalTown, isMainCity, pickAreaPages,
} from '@jdd/schema';
import { townChoices } from './service-areas';

export type TownNote = { town: string; text: string; sourceUrl: string };

type Row = { town: string; status: 'main' | 'own' | 'short' | 'kind' | 'capped'; label: string };

const serviceArea = (content: unknown): string[] =>
  ((content as { extensions?: { serviceArea?: string[] | null } } | null)?.extensions?.serviceArea ?? []) as string[];

/** One row per town the client serves: where it stands, in the approved words. */
export function townPageRows(content: unknown): Row[] {
  const picked = new Set(pickAreaPages(content));
  return townChoices(serviceArea(content)).map((town): Row => {
    if (isMainCity(content, town)) return { town, status: 'main', label: 'Main city: the home page' };
    if (picked.has(town)) return { town, status: 'own', label: 'Own page' };
    const f = areaPageFacts(content, town);
    if (f.count < AREA_FACTS_MIN) return { town, status: 'short', label: `${f.count} of ${AREA_FACTS_MIN} facts for its own page` };
    if (f.have.length < AREA_KINDS_MIN) return { town, status: 'kind', label: 'Needs a second kind of fact' };
    // Earns a page, but pickAreaPages kept ten others (PAGE_CAPS.area). Wording chosen by Xander,
    // 2026-11-13.
    return { town, status: 'capped', label: 'Over the 10-town limit' };
  });
}

/** Pick or unpick a top town, kept in pick order, in the client's spelling, at most TOP_TOWNS_MAX. */
export function toggleTopTown(content: unknown, current: readonly string[], raw: string): string[] {
  const town = canonicalTown(content, raw);
  if (!town) return [...current];
  if (current.includes(town)) return current.filter((t) => t !== town);
  return current.length >= TOP_TOWNS_MAX ? [...current] : [...current, town];
}

/** True for an http(s) link with a host: the only source a town note may have. */
export function isSourceUrl(raw: string): boolean {
  const v = raw.trim();
  if (!/^https?:\/\//i.test(v)) return false;
  try {
    const u = new URL(v);
    return (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname.includes('.');
  } catch {
    return false;
  }
}

/** The notes with one more, or null when it can't be added: a town the client doesn't cover, no
 *  words, or no valid source link. */
export function addTownNote(content: unknown, notes: readonly TownNote[], n: TownNote): TownNote[] | null {
  const town = canonicalTown(content, n.town);
  const text = n.text.trim();
  const sourceUrl = n.sourceUrl.trim();
  if (!town || !text || !isSourceUrl(sourceUrl)) return null;
  return [...notes, { town, text, sourceUrl }];
}
