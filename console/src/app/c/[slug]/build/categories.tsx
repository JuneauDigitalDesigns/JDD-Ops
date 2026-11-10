import type { ReactNode } from 'react';
import NavMinimal, { meta as navMinimalMeta } from '@/components/catalog/nav/NavMinimal';
import PageHeaderSimple, { meta as pageHeaderSimpleMeta } from '@/components/catalog/pageHeader/PageHeaderSimple';
import HeroSplit, { meta as heroSplitMeta } from '@/components/catalog/hero/HeroSplit';
import HeroFormFocus, { meta as heroFormMeta } from '@/components/catalog/hero/HeroFormFocus';
import HeroOverlap, { meta as heroOverlapMeta } from '@/components/catalog/hero/HeroOverlap';
import AboutFeature, { meta as aboutFeatureMeta } from '@/components/catalog/about/AboutFeature';
import AboutStory, { meta as aboutStoryMeta } from '@/components/catalog/about/AboutStory';
import RecentJobsGrid, { meta as recentJobsGridMeta } from '@/components/catalog/work/RecentJobsGrid';
import BeforeAfter, { meta as beforeAfterMeta } from '@/components/catalog/work/BeforeAfter';
import TrustBadges, { meta as trustBadgesMeta } from '@/components/catalog/trust/TrustBadges';
import FinalCtaBanner, { meta as finalCtaBannerMeta } from '@/components/catalog/finalCta/FinalCtaBanner';
import FinalCtaSimple, { meta as finalCtaSimpleMeta } from '@/components/catalog/finalCta/FinalCtaSimple';
import FinalCtaSplit, { meta as finalCtaSplitMeta } from '@/components/catalog/finalCta/FinalCtaSplit';
import ServicesGrid, { meta as servicesGridMeta } from '@/components/catalog/services/ServicesGrid';
import ServicesAccordion, { meta as servicesAccordionMeta } from '@/components/catalog/services/ServicesAccordion';
import ServicesPanel, { meta as servicesPanelMeta } from '@/components/catalog/services/ServicesPanel';
import FaqAccordion, { meta as faqAccordionMeta } from '@/components/catalog/faq/FaqAccordion';
import FaqStickyAside, { meta as faqStickyAsideMeta } from '@/components/catalog/faq/FaqStickyAside';
import TestimonialsGrid, { meta as testimonialsGridMeta } from '@/components/catalog/testimonials/TestimonialsGrid';
import TestimonialsCarousel from '@/components/catalog/testimonials/TestimonialsCarousel';
import ServicesShowcase, { meta as servicesShowcaseMeta } from '@/components/catalog/services/ServicesShowcase';
import ServicesSpotlight, { meta as servicesSpotlightMeta } from '@/components/catalog/services/ServicesSpotlight';
import WorkSpotlight, { meta as workSpotlightMeta } from '@/components/catalog/work/WorkSpotlight';
import WorkMasonry, { meta as workMasonryMeta } from '@/components/catalog/work/WorkMasonry';
import TestimonialsMarquee, { meta as testimonialsMarqueeMeta } from '@/components/catalog/testimonials/TestimonialsMarquee';
import DifferentiatorsIndex, { meta as differentiatorsIndexMeta } from '@/components/catalog/differentiators/DifferentiatorsIndex';
import DifferentiatorsPanels, { meta as differentiatorsPanelsMeta } from '@/components/catalog/differentiators/DifferentiatorsPanels';
import DifferentiatorsRail, { meta as differentiatorsRailMeta } from '@/components/catalog/differentiators/DifferentiatorsRail';
import StatsBand, { meta as statsBandMeta } from '@/components/catalog/stats/StatsBand';
import StatsLedger, { meta as statsLedgerMeta } from '@/components/catalog/stats/StatsLedger';
import PageHeaderEditorial, { meta as pageHeaderEditorialMeta } from '@/components/catalog/pageHeader/PageHeaderEditorial';
import PageHeaderOverlap, { meta as pageHeaderOverlapMeta } from '@/components/catalog/pageHeader/PageHeaderOverlap';
import PageHeaderMinimal, { meta as pageHeaderMinimalMeta } from '@/components/catalog/pageHeader/PageHeaderMinimal';
import AboutSticky, { meta as aboutStickyMeta } from '@/components/catalog/about/AboutSticky';
import FaqIndex, { meta as faqIndexMeta } from '@/components/catalog/faq/FaqIndex';
import ContactSplit, { meta as contactSplitMeta } from '@/components/catalog/contact/ContactSplit';
import ContactCardOverlap, { meta as contactCardOverlapMeta } from '@/components/catalog/contact/ContactCardOverlap';
import ContactInlineStrip, { meta as contactInlineStripMeta } from '@/components/catalog/contact/ContactInlineStrip';
import FooterColumns, { meta as footerColumnsMeta } from '@/components/catalog/footer/FooterColumns';
import FooterMinimal, { meta as footerMinimalMeta } from '@/components/catalog/footer/FooterMinimal';
// Neither SEO variant has a default export — their only rendered output was code that
// wirePage never imported. SeoPreviewBody shows what each variant actually produces.
import { meta as seoDefaultMeta } from '@/components/catalog/seo/SeoDefault';
import { buildJsonLd } from '@template/lib/structuredData';
import { meta as seoLocalBusinessMeta } from '@/components/catalog/seo/SeoLocalBusiness';
// New trade-specific + motion-flagship variants
import NavEmergencyBar, { meta as navEmergencyMeta } from '@/components/catalog/nav/NavEmergencyBar';
import TrustReviewsAggregate, { meta as trustReviewsMeta } from '@/components/catalog/trust/TrustReviewsAggregate';
import ServiceArea, { meta as serviceAreaMeta } from '@/components/catalog/trust/ServiceArea';
// Bespoke HVAC vertical-template components (fixed designs, no skin). Composed by
// VERTICAL_TEMPLATES, not offered individually — registered here so the Studio preview and
// compose-page can render them. See src/components/CATALOG-LEGACY.md.
import HvacNav, { meta as hvacNavMeta } from '@/components/catalog/nav/HvacNav';
import HvacHero, { meta as hvacHeroMeta } from '@/components/catalog/hero/HvacHero';
import HvacStatBand, { meta as hvacStatBandMeta } from '@/components/catalog/stats/HvacStatBand';
import HvacServices, { meta as hvacServicesMeta } from '@/components/catalog/services/HvacServices';
import HvacServiceArea, { meta as hvacServiceAreaMeta } from '@/components/catalog/trust/HvacServiceArea';
import HvacFaq, { meta as hvacFaqMeta } from '@/components/catalog/faq/HvacFaq';
import HvacReviews, { meta as hvacReviewsMeta } from '@/components/catalog/testimonials/HvacReviews';
import HvacFinalCta, { meta as hvacFinalCtaMeta } from '@/components/catalog/finalCta/HvacFinalCta';
import HvacFooter, { meta as hvacFooterMeta } from '@/components/catalog/footer/HvacFooter';
import HvacPageHeader, { meta as hvacPageHeaderMeta } from '@/components/catalog/pageHeader/HvacPageHeader';
// Per-service pages (service-page-spec.md): the header and body take serviceSlug, which only a
// service page has, so compose-page.tsx renders them on those pages; here they render nothing.
import HvacServiceHeader, { meta as hvacServiceHeaderMeta } from '@/components/catalog/pageHeader/HvacServiceHeader';
import HvacServiceDetail, { meta as hvacServiceDetailMeta } from '@/components/catalog/services/HvacServiceDetail';
import PlumbingServiceHeader, { meta as plumbingServiceHeaderMeta } from '@/components/catalog/pageHeader/PlumbingServiceHeader';
import PlumbingServiceDetail, { meta as plumbingServiceDetailMeta } from '@/components/catalog/services/PlumbingServiceDetail';
import HvacAbout, { meta as hvacAboutMeta } from '@/components/catalog/about/HvacAbout';
import HvacContact, { meta as hvacContactMeta } from '@/components/catalog/contact/HvacContact';
// Bespoke Roofing vertical-template components (vertical-templates-v1 Phase 5). Same contract
// as the Hvac* set above: fixed designs, no skin, composed by VERTICAL_TEMPLATES.
import RoofingNav, { meta as roofingNavMeta } from '@/components/catalog/nav/RoofingNav';
import RoofingHero, { meta as roofingHeroMeta } from '@/components/catalog/hero/RoofingHero';
import RoofingStats, { meta as roofingStatsMeta } from '@/components/catalog/stats/RoofingStats';
import RoofingServices, { meta as roofingServicesMeta } from '@/components/catalog/services/RoofingServices';
import RoofingTrust, { meta as roofingTrustMeta } from '@/components/catalog/trust/RoofingTrust';
import RoofingFaq, { meta as roofingFaqMeta } from '@/components/catalog/faq/RoofingFaq';
import RoofingReviews, { meta as roofingReviewsMeta } from '@/components/catalog/testimonials/RoofingReviews';
import RoofingFinalCta, { meta as roofingFinalCtaMeta } from '@/components/catalog/finalCta/RoofingFinalCta';
import RoofingFooter, { meta as roofingFooterMeta } from '@/components/catalog/footer/RoofingFooter';
import RoofingPageHeader, { meta as roofingPageHeaderMeta } from '@/components/catalog/pageHeader/RoofingPageHeader';
import RoofingAbout, { meta as roofingAboutMeta } from '@/components/catalog/about/RoofingAbout';
import RoofingContact, { meta as roofingContactMeta } from '@/components/catalog/contact/RoofingContact';
// Bespoke Lawn Care vertical-template components (vertical-templates-v1 Phase 6). Same
// contract as Hvac*/Roofing*: fixed designs, no skin, composed by VERTICAL_TEMPLATES.
import LawnNav, { meta as lawnNavMeta } from '@/components/catalog/nav/LawnNav';
import LawnHero, { meta as lawnHeroMeta } from '@/components/catalog/hero/LawnHero';
import LawnStats, { meta as lawnStatsMeta } from '@/components/catalog/stats/LawnStats';
import LawnServices, { meta as lawnServicesMeta } from '@/components/catalog/services/LawnServices';
import LawnTrust, { meta as lawnTrustMeta } from '@/components/catalog/trust/LawnTrust';
import LawnFaq, { meta as lawnFaqMeta } from '@/components/catalog/faq/LawnFaq';
import LawnReviews, { meta as lawnReviewsMeta } from '@/components/catalog/testimonials/LawnReviews';
import LawnFinalCta, { meta as lawnFinalCtaMeta } from '@/components/catalog/finalCta/LawnFinalCta';
import LawnFooter, { meta as lawnFooterMeta } from '@/components/catalog/footer/LawnFooter';
import LawnPageHeader, { meta as lawnPageHeaderMeta } from '@/components/catalog/pageHeader/LawnPageHeader';
import LawnAbout, { meta as lawnAboutMeta } from '@/components/catalog/about/LawnAbout';
import LawnContact, { meta as lawnContactMeta } from '@/components/catalog/contact/LawnContact';
// Bespoke Plumbing vertical-template components (vertical-templates-v1 Phase 8). Same
// contract as Hvac*/Roofing*/Lawn*: fixed designs, no skin, composed by VERTICAL_TEMPLATES.
import PlumbingNav, { meta as plumbingNavMeta } from '@/components/catalog/nav/PlumbingNav';
import PlumbingHero, { meta as plumbingHeroMeta } from '@/components/catalog/hero/PlumbingHero';
import PlumbingStats, { meta as plumbingStatsMeta } from '@/components/catalog/stats/PlumbingStats';
import PlumbingServices, { meta as plumbingServicesMeta } from '@/components/catalog/services/PlumbingServices';
import PlumbingTrust, { meta as plumbingTrustMeta } from '@/components/catalog/trust/PlumbingTrust';
import PlumbingFaq, { meta as plumbingFaqMeta } from '@/components/catalog/faq/PlumbingFaq';
import PlumbingReviews, { meta as plumbingReviewsMeta } from '@/components/catalog/testimonials/PlumbingReviews';
import PlumbingFinalCta, { meta as plumbingFinalCtaMeta } from '@/components/catalog/finalCta/PlumbingFinalCta';
import PlumbingFooter, { meta as plumbingFooterMeta } from '@/components/catalog/footer/PlumbingFooter';
import PlumbingPageHeader, { meta as plumbingPageHeaderMeta } from '@/components/catalog/pageHeader/PlumbingPageHeader';
import PlumbingAbout, { meta as plumbingAboutMeta } from '@/components/catalog/about/PlumbingAbout';
import PlumbingContact, { meta as plumbingContactMeta } from '@/components/catalog/contact/PlumbingContact';
// Bespoke Car Detailing vertical-template components (vertical-templates-v1 Phase 9, last
// vertical). Same contract as Hvac*/Roofing*/Lawn*/Plumbing*: fixed designs, no skin, composed
// by VERTICAL_TEMPLATES.
import DetailNav, { meta as detailNavMeta } from '@/components/catalog/nav/DetailNav';
import DetailHero, { meta as detailHeroMeta } from '@/components/catalog/hero/DetailHero';
import DetailStats, { meta as detailStatsMeta } from '@/components/catalog/stats/DetailStats';
import DetailServices, { meta as detailServicesMeta } from '@/components/catalog/services/DetailServices';
import DetailTrust, { meta as detailTrustMeta } from '@/components/catalog/trust/DetailTrust';
import DetailFaq, { meta as detailFaqMeta } from '@/components/catalog/faq/DetailFaq';
import DetailReviews, { meta as detailReviewsMeta } from '@/components/catalog/testimonials/DetailReviews';
import DetailFinalCta, { meta as detailFinalCtaMeta } from '@/components/catalog/finalCta/DetailFinalCta';
import DetailFooter, { meta as detailFooterMeta } from '@/components/catalog/footer/DetailFooter';
import DetailPageHeader, { meta as detailPageHeaderMeta } from '@/components/catalog/pageHeader/DetailPageHeader';
import DetailAbout, { meta as detailAboutMeta } from '@/components/catalog/about/DetailAbout';
import DetailContact, { meta as detailContactMeta } from '@/components/catalog/contact/DetailContact';

import SeoPreviewBody from './SeoPreviewBody';
import type { SiteContent } from '@/data/site';
import { skinsFor, type SkinId } from '@/lib/skins';

export type VariantEntry = {
  name: string;
  id: string;
  label: string;
  skins: { id: SkinId; label: string }[];
  render: (skin: SkinId) => ReactNode;
  /** Lead-capture mode, used to gate finalCta/contact variants by plan tier. */
  leadMode?: 'phone' | 'email';
};

export type CategoryEntry = {
  id: 'nav' | 'pageHeader' | 'hero' | 'trust' | 'differentiators' | 'about' | 'services' | 'work' | 'stats' | 'testimonials' | 'faq' | 'finalCta' | 'contact' | 'footer' | 'seo';
  label: string;
  iconName: 'Compass' | 'Sun' | 'SealCheck' | 'Users' | 'ListChecks' | 'Briefcase' | 'Star' | 'Question' | 'Megaphone' | 'Phone' | 'Article' | 'Code' | 'Lightning' | 'ChartBar';
  variants: VariantEntry[];
};

/** Build the studio's component catalog bound to the current effective content. */
export function buildCategories(effective: SiteContent): CategoryEntry[] {
  // Starter clients capture leads by email; growth/enterprise by phone callback.
  //
  // A variant with NO `leadMode` adapts to either — it reads `_meta.selectedPlan` itself and
  // hands the mode to <LeadForm>. Those are always shown. Only a variant that hard-codes one
  // mode gets filtered by plan.
  //
  // This used to be `(v.leadMode ?? 'phone') === …`, which defaulted an absent leadMode to
  // 'phone' and so hid every adapting variant from starter clients. Combined with the
  // `*Starter` duplicates being the only email-mode variants — and none of them appearing in
  // the export allowlist — a starter client could not be built at all. Both halves of that
  // are now fixed; see the note in lib/export.ts CATALOG.
  const isStarter = effective._meta?.selectedPlan === 'starter';
  const forPlan = (v: VariantEntry) =>
    v.leadMode === undefined || v.leadMode === (isStarter ? 'email' : 'phone');

  return [
    {
      id: 'nav',
      label: 'Nav',
      iconName: 'Compass',
      variants: [
        { name: 'NavMinimal',         id: navMinimalMeta.id,      label: navMinimalMeta.label,      skins: skinsFor('NavMinimal'),      render: (skin) => <NavMinimal content={effective} skin={skin} /> },
        { name: 'NavEmergencyBar',    id: navEmergencyMeta.id,    label: navEmergencyMeta.label,    skins: skinsFor('NavEmergencyBar'), render: (skin) => <NavEmergencyBar content={effective} skin={skin} /> },
        { name: 'HvacNav',            id: hvacNavMeta.id,         label: hvacNavMeta.label,         skins: skinsFor('HvacNav'),         render: () => <HvacNav content={effective} /> },
        { name: 'RoofingNav',         id: roofingNavMeta.id,      label: roofingNavMeta.label,      skins: skinsFor('RoofingNav'),      render: () => <RoofingNav content={effective} /> },
        { name: 'LawnNav',            id: lawnNavMeta.id,         label: lawnNavMeta.label,         skins: skinsFor('LawnNav'),         render: () => <LawnNav content={effective} /> },
        { name: 'PlumbingNav',        id: plumbingNavMeta.id,     label: plumbingNavMeta.label,     skins: skinsFor('PlumbingNav'),     render: () => <PlumbingNav content={effective} /> },
        { name: 'DetailNav',          id: detailNavMeta.id,       label: detailNavMeta.label,       skins: skinsFor('DetailNav'),       render: () => <DetailNav content={effective} /> },
      ],
    },
    {
      id: 'pageHeader',
      label: 'Page header',
      iconName: 'Article',
      // The catalog browser renders a placeholder header; the real per-route copy
      // (SiteContent.subpages[route].header) is supplied by compose-page.ts at render time.
      variants: [
        {
          name: 'PageHeaderSimple',
          id: pageHeaderSimpleMeta.id,
          label: pageHeaderSimpleMeta.label,
          skins: skinsFor('PageHeaderSimple'),
          render: () => (
            <PageHeaderSimple
              data={{ eyebrow: 'Page', title: 'Page title', sub: 'A lightweight header that opens a page.', cta: null }}
            />
          ),
        },
        { name: 'PageHeaderEditorial', id: pageHeaderEditorialMeta.id, label: pageHeaderEditorialMeta.label, skins: skinsFor('PageHeaderEditorial'), render: () => <PageHeaderEditorial data={{ eyebrow: 'Page', title: 'Page title', sub: 'A lightweight header that opens a page.', cta: null }} /> },
        { name: 'PageHeaderOverlap',  id: pageHeaderOverlapMeta.id,  label: pageHeaderOverlapMeta.label,  skins: skinsFor('PageHeaderOverlap'),  render: () => <PageHeaderOverlap data={{ eyebrow: 'Page', title: 'Page title', sub: 'A lightweight header that opens a page.', cta: null }} /> },
        { name: 'PageHeaderMinimal',  id: pageHeaderMinimalMeta.id,  label: pageHeaderMinimalMeta.label,  skins: skinsFor('PageHeaderMinimal'),  render: () => <PageHeaderMinimal data={{ eyebrow: 'Page', title: 'Page title', sub: 'A lightweight header that opens a page.', cta: null }} /> },
        { name: 'HvacPageHeader', id: hvacPageHeaderMeta.id, label: hvacPageHeaderMeta.label, skins: skinsFor('HvacPageHeader'), render: () => <HvacPageHeader data={{ eyebrow: 'Page', title: 'Page title', sub: 'A lightweight header that opens a page.', cta: null }} /> },
        { name: 'HvacServiceHeader', id: hvacServiceHeaderMeta.id, label: hvacServiceHeaderMeta.label, skins: skinsFor('HvacServiceHeader'), render: () => <HvacServiceHeader content={effective} /> },
        { name: 'PlumbingServiceHeader', id: plumbingServiceHeaderMeta.id, label: plumbingServiceHeaderMeta.label, skins: skinsFor('PlumbingServiceHeader'), render: () => <PlumbingServiceHeader content={effective} /> },
        { name: 'RoofingPageHeader', id: roofingPageHeaderMeta.id, label: roofingPageHeaderMeta.label, skins: skinsFor('RoofingPageHeader'), render: () => <RoofingPageHeader data={{ eyebrow: 'Page', title: 'Page title', sub: 'A lightweight header that opens a page.', cta: null }} /> },
        { name: 'LawnPageHeader', id: lawnPageHeaderMeta.id, label: lawnPageHeaderMeta.label, skins: skinsFor('LawnPageHeader'), render: () => <LawnPageHeader data={{ eyebrow: 'Page', title: 'Page title', sub: 'A lightweight header that opens a page.', cta: null }} /> },
        { name: 'PlumbingPageHeader', id: plumbingPageHeaderMeta.id, label: plumbingPageHeaderMeta.label, skins: skinsFor('PlumbingPageHeader'), render: () => <PlumbingPageHeader data={{ eyebrow: 'Page', title: 'Page title', sub: 'A lightweight header that opens a page.', cta: null }} /> },
        { name: 'DetailPageHeader', id: detailPageHeaderMeta.id, label: detailPageHeaderMeta.label, skins: skinsFor('DetailPageHeader'), render: () => <DetailPageHeader data={{ eyebrow: 'Page', title: 'Page title', sub: 'A lightweight header that opens a page.', cta: null }} /> },
      ],
    },
    {
      id: 'hero',
      label: 'Hero',
      iconName: 'Sun',
      variants: [
        { name: 'HeroSplit',     id: heroSplitMeta.id,     label: heroSplitMeta.label,     skins: skinsFor('HeroSplit'),     render: (skin) => <HeroSplit content={effective} skin={skin} /> },
        { name: 'HeroFormFocus', id: heroFormMeta.id,      label: heroFormMeta.label,      skins: skinsFor('HeroFormFocus'), render: (skin) => <HeroFormFocus content={effective} skin={skin} /> },
        { name: 'HeroOverlap',   id: heroOverlapMeta.id,   label: heroOverlapMeta.label,   skins: skinsFor('HeroOverlap'),   render: () => <HeroOverlap content={effective} /> },
        { name: 'HvacHero',      id: hvacHeroMeta.id,      label: hvacHeroMeta.label,      skins: skinsFor('HvacHero'),      render: () => <HvacHero content={effective} /> },
        { name: 'RoofingHero',   id: roofingHeroMeta.id,   label: roofingHeroMeta.label,   skins: skinsFor('RoofingHero'),   render: () => <RoofingHero content={effective} /> },
        { name: 'LawnHero',      id: lawnHeroMeta.id,      label: lawnHeroMeta.label,      skins: skinsFor('LawnHero'),      render: () => <LawnHero content={effective} /> },
        { name: 'PlumbingHero',  id: plumbingHeroMeta.id,  label: plumbingHeroMeta.label,  skins: skinsFor('PlumbingHero'),  render: () => <PlumbingHero content={effective} /> },
        { name: 'DetailHero',    id: detailHeroMeta.id,    label: detailHeroMeta.label,    skins: skinsFor('DetailHero'),    render: () => <DetailHero content={effective} /> },
      ],
    },
    {
      id: 'trust',
      label: 'Trust',
      iconName: 'SealCheck',
      variants: [
        { name: 'TrustBadges',   id: trustBadgesMeta.id,   label: trustBadgesMeta.label,   skins: skinsFor('TrustBadges'),   render: () => <TrustBadges content={effective} /> },
        { name: 'TrustReviewsAggregate', id: trustReviewsMeta.id, label: trustReviewsMeta.label, skins: skinsFor('TrustReviewsAggregate'), render: (skin) => <TrustReviewsAggregate content={effective} skin={skin} /> },
        { name: 'ServiceArea', id: serviceAreaMeta.id, label: serviceAreaMeta.label, skins: skinsFor('ServiceArea'), render: (skin: SkinId) => <ServiceArea content={effective} skin={skin} /> },
        { name: 'HvacServiceArea', id: hvacServiceAreaMeta.id, label: hvacServiceAreaMeta.label, skins: skinsFor('HvacServiceArea'), render: () => <HvacServiceArea content={effective} /> },
        { name: 'RoofingTrust', id: roofingTrustMeta.id, label: roofingTrustMeta.label, skins: skinsFor('RoofingTrust'), render: () => <RoofingTrust content={effective} /> },
        { name: 'LawnTrust', id: lawnTrustMeta.id, label: lawnTrustMeta.label, skins: skinsFor('LawnTrust'), render: () => <LawnTrust content={effective} /> },
        { name: 'PlumbingTrust', id: plumbingTrustMeta.id, label: plumbingTrustMeta.label, skins: skinsFor('PlumbingTrust'), render: () => <PlumbingTrust content={effective} /> },
        { name: 'DetailTrust', id: detailTrustMeta.id, label: detailTrustMeta.label, skins: skinsFor('DetailTrust'), render: () => <DetailTrust content={effective} /> },
      ],
    },
    {
      id: 'differentiators',
      label: 'Differentiators',
      iconName: 'Lightning',
      variants: [
        { name: 'DifferentiatorsIndex',  id: differentiatorsIndexMeta.id,  label: differentiatorsIndexMeta.label,  skins: skinsFor('DifferentiatorsIndex'),  render: (skin) => <DifferentiatorsIndex content={effective} skin={skin} /> },
        { name: 'DifferentiatorsPanels', id: differentiatorsPanelsMeta.id, label: differentiatorsPanelsMeta.label, skins: skinsFor('DifferentiatorsPanels'), render: (skin) => <DifferentiatorsPanels content={effective} skin={skin} /> },
        { name: 'DifferentiatorsRail',   id: differentiatorsRailMeta.id,   label: differentiatorsRailMeta.label,   skins: skinsFor('DifferentiatorsRail'),   render: (skin) => <DifferentiatorsRail content={effective} skin={skin} /> },
      ],
    },
    {
      id: 'about',
      label: 'About',
      iconName: 'Users',
      variants: [
        { name: 'AboutFeature',  id: aboutFeatureMeta.id,  label: aboutFeatureMeta.label,  skins: skinsFor('AboutFeature'),  render: (skin) => <AboutFeature content={effective} skin={skin} /> },
        { name: 'AboutStory',    id: aboutStoryMeta.id,    label: aboutStoryMeta.label,    skins: skinsFor('AboutStory'),    render: (skin) => <AboutStory content={effective} skin={skin} /> },
        { name: 'AboutSticky',   id: aboutStickyMeta.id,   label: aboutStickyMeta.label,   skins: skinsFor('AboutSticky'),   render: (skin) => <AboutSticky content={effective} skin={skin} /> },
        { name: 'HvacAbout',     id: hvacAboutMeta.id,     label: hvacAboutMeta.label,     skins: skinsFor('HvacAbout'),     render: () => <HvacAbout content={effective} /> },
        { name: 'RoofingAbout',  id: roofingAboutMeta.id,  label: roofingAboutMeta.label,  skins: skinsFor('RoofingAbout'),  render: () => <RoofingAbout content={effective} /> },
        { name: 'LawnAbout',     id: lawnAboutMeta.id,     label: lawnAboutMeta.label,     skins: skinsFor('LawnAbout'),     render: () => <LawnAbout content={effective} /> },
        { name: 'PlumbingAbout', id: plumbingAboutMeta.id, label: plumbingAboutMeta.label, skins: skinsFor('PlumbingAbout'), render: () => <PlumbingAbout content={effective} /> },
        { name: 'DetailAbout', id: detailAboutMeta.id, label: detailAboutMeta.label, skins: skinsFor('DetailAbout'), render: () => <DetailAbout content={effective} /> },
      ],
    },
    {
      id: 'services',
      label: 'Services',
      iconName: 'ListChecks',
      variants: [
        { name: 'ServicesGrid',      id: servicesGridMeta.id,      label: servicesGridMeta.label,      skins: skinsFor('ServicesGrid'),      render: (skin) => <ServicesGrid content={effective} skin={skin} /> },
        { name: 'ServicesAccordion', id: servicesAccordionMeta.id, label: servicesAccordionMeta.label, skins: skinsFor('ServicesAccordion'), render: () => <ServicesAccordion content={effective} /> },
        { name: 'ServicesPanel',     id: servicesPanelMeta.id,     label: servicesPanelMeta.label,     skins: skinsFor('ServicesPanel'),     render: () => <ServicesPanel content={effective} /> },
        { name: 'ServicesShowcase',  id: servicesShowcaseMeta.id,  label: servicesShowcaseMeta.label,  skins: skinsFor('ServicesShowcase'),  render: (skin) => <ServicesShowcase content={effective} skin={skin} /> },
        { name: 'ServicesSpotlight', id: servicesSpotlightMeta.id, label: servicesSpotlightMeta.label, skins: skinsFor('ServicesSpotlight'), render: (skin) => <ServicesSpotlight content={effective} skin={skin} /> },
        { name: 'HvacServices',      id: hvacServicesMeta.id,      label: hvacServicesMeta.label,      skins: skinsFor('HvacServices'),      render: () => <HvacServices content={effective} /> },
        { name: 'HvacServiceDetail', id: hvacServiceDetailMeta.id, label: hvacServiceDetailMeta.label, skins: skinsFor('HvacServiceDetail'), render: () => <HvacServiceDetail content={effective} /> },
        { name: 'PlumbingServiceDetail', id: plumbingServiceDetailMeta.id, label: plumbingServiceDetailMeta.label, skins: skinsFor('PlumbingServiceDetail'), render: () => <PlumbingServiceDetail content={effective} /> },
        { name: 'RoofingServices',   id: roofingServicesMeta.id,   label: roofingServicesMeta.label,   skins: skinsFor('RoofingServices'),   render: () => <RoofingServices content={effective} /> },
        { name: 'LawnServices',      id: lawnServicesMeta.id,      label: lawnServicesMeta.label,      skins: skinsFor('LawnServices'),      render: () => <LawnServices content={effective} /> },
        { name: 'PlumbingServices',  id: plumbingServicesMeta.id,  label: plumbingServicesMeta.label,  skins: skinsFor('PlumbingServices'),  render: () => <PlumbingServices content={effective} /> },
        { name: 'DetailServices',    id: detailServicesMeta.id,    label: detailServicesMeta.label,    skins: skinsFor('DetailServices'),    render: () => <DetailServices content={effective} /> },
      ],
    },
    {
      id: 'work',
      label: 'Work',
      iconName: 'Briefcase',
      variants: [
        { name: 'RecentJobsGrid',      id: recentJobsGridMeta.id,      label: recentJobsGridMeta.label,      skins: skinsFor('RecentJobsGrid'),      render: (skin) => <RecentJobsGrid content={effective} skin={skin} /> },
        { name: 'BeforeAfter', id: beforeAfterMeta.id, label: beforeAfterMeta.label, skins: skinsFor('BeforeAfter'), render: (skin) => <BeforeAfter content={effective} skin={skin} /> },
        { name: 'WorkSpotlight', id: workSpotlightMeta.id, label: workSpotlightMeta.label, skins: skinsFor('WorkSpotlight'), render: (skin) => <WorkSpotlight content={effective} skin={skin} /> },
        { name: 'WorkMasonry', id: workMasonryMeta.id, label: workMasonryMeta.label, skins: skinsFor('WorkMasonry'), render: (skin) => <WorkMasonry content={effective} skin={skin} /> },
      ],
    },
    {
      id: 'stats',
      label: 'Stats',
      iconName: 'ChartBar',
      variants: [
        { name: 'StatsBand',   id: statsBandMeta.id,   label: statsBandMeta.label,   skins: skinsFor('StatsBand'),   render: (skin) => <StatsBand content={effective} skin={skin} /> },
        { name: 'StatsLedger', id: statsLedgerMeta.id, label: statsLedgerMeta.label, skins: skinsFor('StatsLedger'), render: (skin) => <StatsLedger content={effective} skin={skin} /> },
        { name: 'HvacStatBand', id: hvacStatBandMeta.id, label: hvacStatBandMeta.label, skins: skinsFor('HvacStatBand'), render: () => <HvacStatBand content={effective} /> },
        { name: 'RoofingStats', id: roofingStatsMeta.id, label: roofingStatsMeta.label, skins: skinsFor('RoofingStats'), render: () => <RoofingStats content={effective} /> },
        { name: 'LawnStats', id: lawnStatsMeta.id, label: lawnStatsMeta.label, skins: skinsFor('LawnStats'), render: () => <LawnStats content={effective} /> },
        { name: 'PlumbingStats', id: plumbingStatsMeta.id, label: plumbingStatsMeta.label, skins: skinsFor('PlumbingStats'), render: () => <PlumbingStats content={effective} /> },
        { name: 'DetailStats', id: detailStatsMeta.id, label: detailStatsMeta.label, skins: skinsFor('DetailStats'), render: () => <DetailStats content={effective} /> },
      ],
    },
    {
      id: 'faq',
      label: 'FAQ',
      iconName: 'Question',
      variants: [
        { name: 'FaqAccordion',   id: faqAccordionMeta.id,   label: faqAccordionMeta.label,   skins: skinsFor('FaqAccordion'),   render: (skin) => <FaqAccordion content={effective} skin={skin} /> },
        { name: 'FaqStickyAside', id: faqStickyAsideMeta.id, label: faqStickyAsideMeta.label, skins: skinsFor('FaqStickyAside'), render: (skin) => <FaqStickyAside content={effective} skin={skin} /> },
        { name: 'FaqIndex',       id: faqIndexMeta.id,       label: faqIndexMeta.label,       skins: skinsFor('FaqIndex'),       render: (skin) => <FaqIndex content={effective} skin={skin} /> },
        { name: 'HvacFaq',        id: hvacFaqMeta.id,        label: hvacFaqMeta.label,        skins: skinsFor('HvacFaq'),        render: () => <HvacFaq content={effective} /> },
        { name: 'RoofingFaq',     id: roofingFaqMeta.id,     label: roofingFaqMeta.label,     skins: skinsFor('RoofingFaq'),     render: () => <RoofingFaq content={effective} /> },
        { name: 'LawnFaq',        id: lawnFaqMeta.id,        label: lawnFaqMeta.label,        skins: skinsFor('LawnFaq'),        render: () => <LawnFaq content={effective} /> },
        { name: 'PlumbingFaq',    id: plumbingFaqMeta.id,    label: plumbingFaqMeta.label,    skins: skinsFor('PlumbingFaq'),    render: () => <PlumbingFaq content={effective} /> },
        { name: 'DetailFaq',      id: detailFaqMeta.id,      label: detailFaqMeta.label,      skins: skinsFor('DetailFaq'),      render: () => <DetailFaq content={effective} /> },
      ],
    },
    {
      id: 'testimonials',
      label: 'Testimonials',
      iconName: 'Star',
      variants: [
        { name: 'TestimonialsGrid',     id: testimonialsGridMeta.id,     label: testimonialsGridMeta.label,     skins: skinsFor('TestimonialsGrid'),     render: (skin) => <TestimonialsGrid content={effective} skin={skin} /> },
        { name: 'TestimonialsCarousel', id: 'testimonials-carousel',     label: 'Testimonials / Carousel',      skins: skinsFor('TestimonialsCarousel'), render: () => <TestimonialsCarousel content={effective} /> },
        { name: 'TestimonialsMarquee',  id: testimonialsMarqueeMeta.id,  label: testimonialsMarqueeMeta.label,  skins: skinsFor('TestimonialsMarquee'), render: (skin) => <TestimonialsMarquee content={effective} skin={skin} /> },
        { name: 'HvacReviews',          id: hvacReviewsMeta.id,          label: hvacReviewsMeta.label,          skins: skinsFor('HvacReviews'),         render: () => <HvacReviews content={effective} /> },
        { name: 'RoofingReviews',       id: roofingReviewsMeta.id,       label: roofingReviewsMeta.label,       skins: skinsFor('RoofingReviews'),      render: () => <RoofingReviews content={effective} /> },
        { name: 'LawnReviews',          id: lawnReviewsMeta.id,          label: lawnReviewsMeta.label,          skins: skinsFor('LawnReviews'),         render: () => <LawnReviews content={effective} /> },
        { name: 'PlumbingReviews',      id: plumbingReviewsMeta.id,      label: plumbingReviewsMeta.label,      skins: skinsFor('PlumbingReviews'),     render: () => <PlumbingReviews content={effective} /> },
        { name: 'DetailReviews',        id: detailReviewsMeta.id,        label: detailReviewsMeta.label,        skins: skinsFor('DetailReviews'),       render: () => <DetailReviews content={effective} /> },
      ],
    },
    {
      id: 'finalCta',
      label: 'Final CTA',
      iconName: 'Megaphone',
      variants: [
        { name: 'FinalCtaBanner',   id: finalCtaBannerMeta.id,   label: finalCtaBannerMeta.label,   skins: skinsFor('FinalCtaBanner'),     render: () => <FinalCtaBanner content={effective} /> },
        { name: 'FinalCtaSimple',   id: finalCtaSimpleMeta.id,   label: finalCtaSimpleMeta.label,   skins: skinsFor('FinalCtaSimple'),   leadMode: finalCtaSimpleMeta.leadMode,   render: () => <FinalCtaSimple content={effective} /> },
        { name: 'FinalCtaSplit',    id: finalCtaSplitMeta.id,    label: finalCtaSplitMeta.label,    skins: skinsFor('FinalCtaSplit'),       render: (skin: SkinId) => <FinalCtaSplit content={effective} skin={skin} /> },
        { name: 'HvacFinalCta',     id: hvacFinalCtaMeta.id,     label: hvacFinalCtaMeta.label,     skins: skinsFor('HvacFinalCta'),        render: () => <HvacFinalCta content={effective} /> },
        { name: 'RoofingFinalCta',  id: roofingFinalCtaMeta.id,  label: roofingFinalCtaMeta.label,  skins: skinsFor('RoofingFinalCta'),     render: () => <RoofingFinalCta content={effective} /> },
        { name: 'LawnFinalCta',     id: lawnFinalCtaMeta.id,     label: lawnFinalCtaMeta.label,     skins: skinsFor('LawnFinalCta'),        render: () => <LawnFinalCta content={effective} /> },
        { name: 'PlumbingFinalCta', id: plumbingFinalCtaMeta.id, label: plumbingFinalCtaMeta.label, skins: skinsFor('PlumbingFinalCta'),    render: () => <PlumbingFinalCta content={effective} /> },
        { name: 'DetailFinalCta',   id: detailFinalCtaMeta.id,   label: detailFinalCtaMeta.label,   skins: skinsFor('DetailFinalCta'),      render: () => <DetailFinalCta content={effective} /> },
      ].filter(forPlan),
    },
    {
      id: 'contact',
      label: 'Contact',
      iconName: 'Phone',
      variants: [
        { name: 'ContactSplit',        id: contactSplitMeta.id,         label: contactSplitMeta.label,           skins: skinsFor('ContactSplit'),               render: (skin: SkinId) => <ContactSplit content={effective} skin={skin} /> },
        { name: 'ContactCardOverlap',  id: contactCardOverlapMeta.id,   label: contactCardOverlapMeta.label,     skins: skinsFor('ContactCardOverlap'),   render: (skin: SkinId) => <ContactCardOverlap content={effective} skin={skin} /> },
        { name: 'ContactInlineStrip',  id: contactInlineStripMeta.id,   label: contactInlineStripMeta.label,     skins: skinsFor('ContactInlineStrip'),   render: (skin: SkinId) => <ContactInlineStrip content={effective} skin={skin} /> },
        { name: 'HvacContact',         id: hvacContactMeta.id,          label: hvacContactMeta.label,            skins: skinsFor('HvacContact'),            render: () => <HvacContact content={effective} /> },
        { name: 'RoofingContact',      id: roofingContactMeta.id,       label: roofingContactMeta.label,         skins: skinsFor('RoofingContact'),         render: () => <RoofingContact content={effective} /> },
        { name: 'LawnContact',         id: lawnContactMeta.id,          label: lawnContactMeta.label,            skins: skinsFor('LawnContact'),            render: () => <LawnContact content={effective} /> },
        { name: 'PlumbingContact',     id: plumbingContactMeta.id,      label: plumbingContactMeta.label,        skins: skinsFor('PlumbingContact'),        render: () => <PlumbingContact content={effective} /> },
        { name: 'DetailContact',       id: detailContactMeta.id,        label: detailContactMeta.label,          skins: skinsFor('DetailContact'),          render: () => <DetailContact content={effective} /> },
      ].filter(forPlan),
    },
    {
      id: 'footer',
      label: 'Footer',
      iconName: 'Article',
      variants: [
        { name: 'FooterColumns',  id: footerColumnsMeta.id,  label: footerColumnsMeta.label,  skins: skinsFor('FooterColumns'),  render: (skin) => <FooterColumns content={effective} skin={skin} /> },
        { name: 'FooterMinimal',  id: footerMinimalMeta.id,  label: footerMinimalMeta.label,  skins: skinsFor('FooterMinimal'),  render: (skin) => <FooterMinimal content={effective} skin={skin} /> },
        { name: 'HvacFooter',     id: hvacFooterMeta.id,     label: hvacFooterMeta.label,     skins: skinsFor('HvacFooter'),     render: () => <HvacFooter content={effective} /> },
        { name: 'RoofingFooter',  id: roofingFooterMeta.id,  label: roofingFooterMeta.label,  skins: skinsFor('RoofingFooter'),  render: () => <RoofingFooter content={effective} /> },
        { name: 'LawnFooter',     id: lawnFooterMeta.id,     label: lawnFooterMeta.label,     skins: skinsFor('LawnFooter'),     render: () => <LawnFooter content={effective} /> },
        { name: 'PlumbingFooter', id: plumbingFooterMeta.id, label: plumbingFooterMeta.label, skins: skinsFor('PlumbingFooter'), render: () => <PlumbingFooter content={effective} /> },
        { name: 'DetailFooter', id: detailFooterMeta.id, label: detailFooterMeta.label, skins: skinsFor('DetailFooter'), render: () => <DetailFooter content={effective} /> },
      ],
    },
    {
      id: 'seo',
      label: 'SEO',
      iconName: 'Code',
      variants: [
        {
          name: 'SeoDefault',
          id: seoDefaultMeta.id,
          label: seoDefaultMeta.label,
          skins: skinsFor('SeoDefault'),
          render: () => (
            <SeoPreviewBody
              metadata={{
                title: effective.seo.title,
                description: effective.seo.description,
                alternates: { canonical: effective.seo.canonical },
              }}
              jsonLd={null}
            />
          ),
        },
        {
          name: 'SeoLocalBusiness',
          id: seoLocalBusinessMeta.id,
          label: seoLocalBusinessMeta.label,
          skins: skinsFor('SeoLocalBusiness'),
          render: () => (
            <SeoPreviewBody
              metadata={{
                title: effective.seo.title || effective.brand.name,
                description: effective.seo.description || effective.brand.tagline,
                alternates: { canonical: effective.seo.canonical },
              }}
              // The real builder the template ships, not a hand-copy. The previous inline
              // object had already drifted from the component it mirrored — it was missing
              // aggregateRating and openingHoursSpecification entirely, so the preview
              // disagreed with the (non-)output in both directions.
              jsonLd={buildJsonLd(effective)}
            />
          ),
        },
      ],
    },
  ];
}
