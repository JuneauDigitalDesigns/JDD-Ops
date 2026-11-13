/**
 * The guided Services step (Xander, 2026-11-10: "each [field] explained a little bit better with
 * its headers ... walk you through each step ... even if that means there are more steps").
 *
 * One service at a time, one part per screen, ending in a summary. The part names ARE the
 * explanation: no help text is added. Approved in the Services v2 mockup ("Build it").
 */
import type { SiteContent } from '@/data/site';

export type ServicePartId = 'basics' | 'included' | 'problems' | 'price' | 'visit' | 'towns' | 'photos' | 'questions' | 'summary';

/** The parts in order, with their screen headers. */
export const SERVICE_PARTS: ReadonlyArray<{ id: ServicePartId; label: string }> = [
  { id: 'basics', label: 'Basics' },
  { id: 'included', label: 'Included in the job' },
  { id: 'problems', label: 'Problems it fixes' },
  // Local SEO (Xander, 2026-11-12, approved word for word): Q5, the client's own answer from the
  // onboarding form, and Q6, which only the operator fills in. Both are facts, never generated.
  { id: 'price', label: 'What affects the price' },
  { id: 'visit', label: 'What happens on a typical visit' },
  { id: 'towns', label: 'Towns & brands' },
  { id: 'photos', label: 'Photos' },
  { id: 'questions', label: 'Customer questions' },
  { id: 'summary', label: 'Summary' },
];

/** The Basics screen's field headers (replacing "Tag", "From" and "Takes"). */
export const BASICS_LABEL = {
  name: 'Service name',
  tag: 'Category on the card',
  priceFrom: 'Starting price',
  duration: 'Usual job length',
} as const;

/** Job-length answers, the same four the onboarding form offers. */
export const DURATION_CHOICES = ['Under an hour', 'Half a day', 'A full day', 'A few days'] as const;

const filled = (v: unknown) => (Array.isArray(v) ? v.some((x) => String(x ?? '').trim()) : String(v ?? '').trim() !== '');

/**
 * Which parts of a service have something in them (the summary excluded). `slug` is the
 * service's slug, which photos and questions are tagged with.
 */
export function partsDone(content: SiteContent, index: number, slug: string): Record<Exclude<ServicePartId, 'summary'>, boolean> {
  const it = content.services?.items?.[index];
  const tagged = (list: Array<{ service?: string }> | null | undefined) => (list ?? []).some((x) => x?.service === slug && slug !== '');
  return {
    basics: filled(it?.t),
    included: filled(it?.included),
    problems: filled(it?.typicalJobs),
    price: filled(it?.priceFactors),
    visit: filled(it?.typicalVisit),
    towns: filled(it?.areas) || filled(it?.brands),
    photos: tagged(content.work?.projects),
    questions: tagged(content.extensions?.customerQuestions as Array<{ service?: string }> | null | undefined),
  };
}

/** "4 of 8": parts with something in them, out of the eight content parts. */
export function partsProgress(done: Record<string, boolean>): { done: number; of: number } {
  const vals = Object.values(done);
  return { done: vals.filter(Boolean).length, of: vals.length };
}

/** The part after this one, or null at the summary. */
export function nextPart(id: ServicePartId): ServicePartId | null {
  const i = SERVICE_PARTS.findIndex((p) => p.id === id);
  return SERVICE_PARTS[i + 1]?.id ?? null;
}

export function prevPart(id: ServicePartId): ServicePartId | null {
  const i = SERVICE_PARTS.findIndex((p) => p.id === id);
  return i > 0 ? SERVICE_PARTS[i - 1].id : null;
}

/** Category suggestions: the industry's own service categories, then any this client already uses. */
export function categorySuggestions(menuTags: string[], content: SiteContent, current: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of [...menuTags, ...(content.services?.items ?? []).map((s) => s.tag)]) {
    const v = String(t ?? '').trim();
    if (!v || v.toLowerCase() === current.trim().toLowerCase() || seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase());
    out.push(v);
  }
  return out.slice(0, 6);
}
