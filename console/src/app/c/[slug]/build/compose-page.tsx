/**
 * composePage — turn a PageInstance + site chrome into the ordered React nodes that make up
 * that page: nav, the page's body sections, footer. This is the single source of truth for
 * "render a page in the Studio", shared by the active-page preview and the tabbed all-pages
 * preview.
 *
 * Every section except `pageHeader` renders through the existing catalog (categories.tsx's
 * `render(skin)`, which reads the shared `effective` content). `pageHeader` is special: its copy
 * is per-route (SiteContent.subpages[route].header), so it's rendered directly with that slice,
 * and made inline-editable via an `editPrefix` so header text can be edited in the Studio.
 */
import type { ReactNode } from 'react';
import type { PageHeaderContent } from '@jdd/schema';
import type { SiteContent } from '@/data/site';
import { defaultSkin } from '@/lib/skins';
import PageHeaderSimple from '@/components/catalog/pageHeader/PageHeaderSimple';
import HvacPageHeader from '@/components/catalog/pageHeader/HvacPageHeader';
import HvacNav from '@/components/catalog/nav/HvacNav';
import HvacServiceHeader from '@/components/catalog/pageHeader/HvacServiceHeader';
import HvacServiceDetail from '@/components/catalog/services/HvacServiceDetail';
import HvacFinalCta from '@/components/catalog/finalCta/HvacFinalCta';
import DetailServiceHeader from '@/components/catalog/pageHeader/DetailServiceHeader';
import DetailServiceDetail from '@/components/catalog/services/DetailServiceDetail';
import DetailFinalCta from '@/components/catalog/finalCta/DetailFinalCta';
import PlumbingServiceHeader from '@/components/catalog/pageHeader/PlumbingServiceHeader';
import PlumbingServiceDetail from '@/components/catalog/services/PlumbingServiceDetail';
import PlumbingFinalCta from '@/components/catalog/finalCta/PlumbingFinalCta';
import RoofingServiceHeader from '@/components/catalog/pageHeader/RoofingServiceHeader';
import RoofingServiceDetail from '@/components/catalog/services/RoofingServiceDetail';
import RoofingFinalCta from '@/components/catalog/finalCta/RoofingFinalCta';
import { SERVICE_PAGE_SECTIONS } from '@/lib/servicePageSections';
import type { CategoryEntry } from './categories';
import { navHref, type PageInstance, type SectionRef, type SiteComposition } from '@/lib/pages';

export type ComposedNode = { key: string; node: ReactNode };

/** The sections that take `serviceSlug` on a per-service page, by name. Kept in step with
 *  SERVICE_PAGE_SECTIONS (lib/servicePageSections.ts), which the export uses for the same job. */
const SERVICE_RENDER: Record<string, (p: { content: SiteContent; serviceSlug: string }) => ReactNode> = {
  HvacServiceHeader: (p) => <HvacServiceHeader {...p} />,
  HvacServiceDetail: (p) => <HvacServiceDetail {...p} />,
  HvacFinalCta: (p) => <HvacFinalCta {...p} />,
  DetailServiceHeader: (p) => <DetailServiceHeader {...p} />,
  DetailServiceDetail: (p) => <DetailServiceDetail {...p} />,
  DetailFinalCta: (p) => <DetailFinalCta {...p} />,
  PlumbingServiceHeader: (p) => <PlumbingServiceHeader {...p} />,
  PlumbingServiceDetail: (p) => <PlumbingServiceDetail {...p} />,
  PlumbingFinalCta: (p) => <PlumbingFinalCta {...p} />,
  RoofingServiceHeader: (p) => <RoofingServiceHeader {...p} />,
  RoofingServiceDetail: (p) => <RoofingServiceDetail {...p} />,
  RoofingFinalCta: (p) => <RoofingFinalCta {...p} />,
};

/** A neutral header used when a subpage has no generated header copy yet. */
function placeholderHeader(label: string): PageHeaderContent {
  return { eyebrow: '', title: label, sub: '', cta: null };
}

/**
 * Render one section ref for one page. Exported (not just used internally) so callers that need
 * to wrap individual sections — PageStudio's editable live preview, for hover-to-change-skin
 * chrome — can build their own node list from the same rendering logic instead of duplicating it.
 */
export function renderSection(
  ref: SectionRef,
  page: PageInstance,
  categories: CategoryEntry[],
  effective: SiteContent,
): ReactNode {
  if (ref.name === 'HvacNav') {
    return <HvacNav content={effective} currentPath={navHref(page.route)} />;
  }
  // A per-service page: its service sections render that one service (the export passes the same
  // slug), so the Studio previews exactly the page that ships.
  if (page.pageType === 'service' && SERVICE_PAGE_SECTIONS.has(ref.name) && SERVICE_RENDER[ref.name]) {
    return SERVICE_RENDER[ref.name]({ content: effective, serviceSlug: page.route.slice('services/'.length) });
  }
  if (ref.categoryId === 'pageHeader') {
    const data = effective.subpages?.[page.route]?.header ?? placeholderHeader(page.label);
    const editPrefix = `subpages.${page.route}.header`;
    if (ref.name === 'HvacPageHeader') {
      return <HvacPageHeader data={data} editPrefix={editPrefix} />;
    }
    return <PageHeaderSimple data={data} editPrefix={editPrefix} />;
  }
  const variant = categories
    .find((c) => c.id === ref.categoryId)
    ?.variants.find((v) => v.name === ref.name);
  return variant ? variant.render(ref.skin ?? defaultSkin(ref.name)) : null;
}

/** The full page as ordered nodes: [nav, ...body sections, footer]. */
export function composePage(
  page: PageInstance,
  chrome: SiteComposition['chrome'],
  categories: CategoryEntry[],
  effective: SiteContent,
): ComposedNode[] {
  return [
    { key: 'nav', node: renderSection(chrome.nav, page, categories, effective) },
    ...page.sections.map((ref, i) => ({
      key: `${ref.categoryId}-${i}`,
      node: renderSection(ref, page, categories, effective),
    })),
    { key: 'footer', node: renderSection(chrome.footer, page, categories, effective) },
  ];
}
