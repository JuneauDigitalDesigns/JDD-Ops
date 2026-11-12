/**
 * The gate's side of per-service pages (service-page-spec.md §1, §2): which services get a page,
 * and the slugs the export stores. Pure, and free of the catalog, so it is unit-testable.
 *
 * The Studio feeds chosenServicePages into template-visual-upgrade's syncServicePages
 * (vertical-templates.tsx), which adds, keeps and removes the PageInstances. The export then
 * writes servicePageSlugs(composition) into content.servicePages and stores each paged service's
 * slug with withStoredSlugs, so a later rename of the service keeps its published URL.
 */
import { type SiteComposition } from '@/lib/pages';
import { PAGE_CAPS } from '@jdd/schema';
import { pickServicePages, serviceSlugs } from '@/lib/servicePages';

type Json = Record<string, unknown>;

/** The services that earn a page, within the service-page cap, as { slug, label } in service
 *  order. Since L14 (Xander, 2026-11-12) service pages have a cap of their own, PAGE_CAPS.service
 *  (11), and no longer share one with the site's other pages, so `comp` no longer changes the
 *  answer; the parameter stays for the callers. */
export function chosenServicePages(content: unknown, _comp?: Pick<SiteComposition, 'pages'>): { slug: string; label: string }[] {
  const items = ((content as { services?: { items?: Json[] } })?.services?.items ?? []) as Json[];
  const slugs = serviceSlugs(content);
  return pickServicePages(content, PAGE_CAPS.service).map((i) => ({
    slug: slugs[i],
    label: typeof items[i]?.t === 'string' ? (items[i].t as string) : slugs[i],
  }));
}

/** The content with ServiceItem.slug stored for every service that has a page (§2: set at first
 *  export, never re-derived). A service without a page, or with a slug already, is left alone. */
export function withStoredSlugs<T>(content: T, pagedSlugs: string[]): T {
  const c = content as unknown as { services?: { items?: Json[] } };
  const items = c?.services?.items;
  if (!Array.isArray(items) || pagedSlugs.length === 0) return content;
  const paged = new Set(pagedSlugs);
  const slugs = serviceSlugs(content);
  let changed = false;
  const next = items.map((it, i) => {
    if ((typeof it.slug === 'string' && it.slug.trim()) || !paged.has(slugs[i])) return it;
    changed = true;
    return { ...it, slug: slugs[i] };
  });
  return changed ? ({ ...(content as object), services: { ...c.services, items: next } } as T) : content;
}
