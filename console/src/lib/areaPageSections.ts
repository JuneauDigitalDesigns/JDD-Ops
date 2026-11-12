import { SERVICE_PAGE_SECTIONS } from '@/lib/servicePageSections';

/**
 * The catalog sections of a town page (/areas/<town>) and a town + service spoke
 * (/areas/<town>/<service>) that render ONE town (local SEO, Xander 2026-11-12). wirePages and the
 * Studio hand each of them `townSlug`, and on a spoke `serviceSlug` too, the way service pages hand
 * SERVICE_PAGE_SECTIONS their `serviceSlug`.
 *
 * Empty until Templates builds the town pages, which wait on Xander's approval of the mockups.
 * Templates adds each component's name here when it adds it to the catalog.
 */
export const AREA_PAGE_SECTIONS: ReadonlySet<string> = new Set<string>([]);

/**
 * The slug props a section gets on its page, as JSX attribute text (' serviceSlug="ac-repair"'),
 * or '' when it gets none. One function for wirePages, so a page file can never hand a section a
 * slug its page doesn't have:
 *   /services/<s>          -> SERVICE_PAGE_SECTIONS get serviceSlug
 *   /areas/<t>             -> AREA_PAGE_SECTIONS get townSlug
 *   /areas/<t>/<s> (spoke) -> AREA_PAGE_SECTIONS get townSlug and serviceSlug; SERVICE_PAGE_SECTIONS
 *                             (the vertical's final CTA) get serviceSlug, so the form opens with
 *                             the service already chosen.
 */
export function sectionSlugAttrs(page: { pageType: string; route: string }, sectionName: string): string {
  const parts = page.route.split('/');
  const attr = (k: string, v: string) => ` ${k}=${JSON.stringify(v)}`;
  if (page.pageType === 'service' && parts[0] === 'services' && parts.length === 2) {
    return SERVICE_PAGE_SECTIONS.has(sectionName) ? attr('serviceSlug', parts[1]) : '';
  }
  if (page.pageType === 'area' && parts[0] === 'areas' && parts.length === 2) {
    return AREA_PAGE_SECTIONS.has(sectionName) ? attr('townSlug', parts[1]) : '';
  }
  if (page.pageType === 'spoke' && parts[0] === 'areas' && parts.length === 3) {
    if (AREA_PAGE_SECTIONS.has(sectionName)) return attr('townSlug', parts[1]) + attr('serviceSlug', parts[2]);
    if (SERVICE_PAGE_SECTIONS.has(sectionName)) return attr('serviceSlug', parts[2]);
  }
  return '';
}
