/**
 * scorePage for the Studio (SEO plan D13): the findings the export would report, computed from the
 * Studio's content before Export or Deploy is pressed. Same pages and same preset as the export
 * route's passesSeo, so the panel and the export never disagree. Hard findings block the export;
 * soft ones are listed only. Pure, so it is unit-tested (test/studio-seo-findings.test.mjs).
 */
import { buildPageSeo, type SeoPageRef } from '@/lib/pageSeo';
import { scoreSite, type SiteScore } from '@/lib/scorePage';
import { presetFor, type VerticalId } from '@/lib/verticals';
import type { SiteComposition } from '@/lib/pages';
import type { ServicePicks } from '@/lib/copyRisks';

/** `briefFacts` is copy-brief/brief-facts.ts's text, the same string the export is posted;
 *  `servicePicks` the intake's service names and tags (copyRisks.ts intakeServicePicks), likewise. */
export function seoFindings(content: unknown, composition: SiteComposition | undefined, vertical: string | null, briefFacts = '', servicePicks?: ServicePicks): SiteScore {
  const pages: SeoPageRef[] = composition
    ? composition.pages.map((p) => ({ route: p.route, pageType: p.pageType, label: p.label, sections: p.sections }))
    : [{ route: '', pageType: 'home', label: 'Home', sections: [] }];
  const preset = vertical ? presetFor(vertical as VerticalId) : {};
  return scoreSite(content, pages, buildPageSeo(content, pages, vertical), { preset, briefFacts, servicePicks });
}
