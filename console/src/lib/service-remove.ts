/**
 * Removing a service on the intake's Services step (Xander, 2026-11-12: "Removing services from
 * here should warn with a modal. Especially if the service was provided by a client from their
 * onboarding wizard"; approved as the canvas's row 5).
 *
 * Two things a removal must not break:
 *   - Tags hold a service's SLUG, and slugs are derived in order with "-2" for a repeat
 *     (@jdd/schema serviceSlugs). Removing one service can therefore move another's slug and
 *     re-point its photos, questions and reviews. A remaining service whose slug would move gets
 *     its current slug stored, the same way tagging stores it.
 *   - Photos, customer questions and reviews tagged to the removed service are the client's real
 *     material. They are kept and untagged, never deleted.
 * The service's own page copy lives on the item (services.items[i].page), so it goes with it, and
 * the composition drops the page by itself (BuildWizard's syncServicePages).
 */
import { serviceSlugs } from '@jdd/schema';
import type { SiteContent } from '@/data/site';
import { seededByClose } from './intake-sources';
import { structuralAfterRemove, type StructureContext } from './service-structure';

type Tagged = { service?: string };
type Item = SiteContent['services']['items'][number] & { slug?: string; page?: unknown };

const norm = (s: unknown) => (typeof s === 'string' ? s.trim().toLowerCase() : '');

/** True when the client's onboarding form listed this service (by name). A close-seeded file is
 *  the vertical preset with a name, so its services are not the client's. */
export function serviceFromClient(imported: SiteContent | null | undefined, item: { t?: string } | undefined): boolean {
  if (!imported || !item || seededByClose(imported)) return false;
  const name = norm(item.t);
  return !!name && (imported.services?.items ?? []).some((it) => norm(it.t) === name);
}

export type RemovalPlan = {
  name: string;
  slug: string;
  ownPage: boolean;
  pageCopy: boolean;
  photos: number;
  questions: number;
  reviews: number;
};

const tagged = (list: unknown, slug: string) =>
  (Array.isArray(list) ? (list as Tagged[]) : []).filter((x) => !!slug && x?.service === slug).length;

export function removalPlan(content: SiteContent, index: number, o: { ownPage: boolean }): RemovalPlan {
  const items = (content.services?.items ?? []) as Item[];
  const item = items[index];
  const slug = serviceSlugs(content)[index] ?? '';
  const page = item?.page as Record<string, unknown> | undefined;
  return {
    name: item?.t?.trim() || 'Untitled',
    slug,
    ownPage: o.ownPage,
    pageCopy: !!page && Object.values(page).some((v) => (Array.isArray(v) ? v.length > 0 : !!v)),
    photos: tagged(content.work?.projects, slug),
    questions: tagged(content.extensions?.customerQuestions, slug),
    reviews: tagged(content.testimonials?.items, slug),
  };
}

/** The confirmation's rows, word for word as approved. */
export function removalRows(p: RemovalPlan): [string, string][] {
  const kept = (n: number, where = '') => (n ? `${n} kept${where}, untagged` : 'None');
  return [
    ['Service page', p.ownPage ? `/services/${p.slug}, removed` : 'None'],
    ...(p.pageCopy ? [['Page copy', 'Removed'] as [string, string]] : []),
    ['Photos', kept(p.photos, ' in Work')],
    ['Customer questions', kept(p.questions)],
    ['Reviews', kept(p.reviews)],
  ];
}

const untag = <T extends Tagged>(list: T[], slug: string): T[] | null => {
  if (!slug || !list.some((x) => x?.service === slug)) return null;
  return list.map((x) => {
    if (x?.service !== slug) return x;
    const { service: _drop, ...rest } = x;
    return rest as T;
  });
};

/** The writes that remove service `index`: the list, and each tagged list that changed. */
export function removeService(
  content: SiteContent,
  index: number,
  ctx: StructureContext = { edits: {} },
): Record<string, unknown> {
  const before = serviceSlugs(content);
  const slug = before[index] ?? '';
  // Structure only (lib/service-structure.ts): the remaining services without their card copy, so
  // a later copy run's text still shows; copy the operator typed by hand is kept and still wins.
  const rest = structuralAfterRemove(content, index, ctx) as unknown as Item[];
  const after = serviceSlugs({ ...content, services: { ...content.services, items: rest } } as SiteContent);
  const keep = before.filter((_, i) => i !== index);
  const next = rest.map((it, i) => (after[i] === keep[i] ? it : { ...it, slug: keep[i] }));

  const writes: Record<string, unknown> = { 'services.items': next };
  const projects = untag((content.work?.projects ?? []) as unknown as Tagged[], slug);
  if (projects) writes['work.projects'] = projects;
  const questions = untag((content.extensions?.customerQuestions ?? []) as unknown as Tagged[], slug);
  if (questions) writes['extensions.customerQuestions'] = questions;
  const reviews = untag((content.testimonials?.items ?? []) as unknown as Tagged[], slug);
  if (reviews) writes['testimonials.items'] = reviews;
  return writes;
}
