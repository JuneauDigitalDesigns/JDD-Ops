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
import type { CategoryEntry } from './categories';
import type { PageInstance, SectionRef, SiteComposition } from '@/lib/pages';

export type ComposedNode = { key: string; node: ReactNode };

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
  if (ref.categoryId === 'pageHeader') {
    const data = effective.subpages?.[page.route]?.header ?? placeholderHeader(page.label);
    return <PageHeaderSimple data={data} editPrefix={`subpages.${page.route}.header`} />;
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
