import type { ReactNode } from 'react';
import NavMinimal, { meta as navMinimalMeta } from '@/components/catalog/nav/NavMinimal';
import NavCentered, { meta as navCenteredMeta } from '@/components/catalog/nav/NavCentered';
import NavAnnouncementBar, { meta as navAnnouncementMeta } from '@/components/catalog/nav/NavAnnouncementBar';
import NavSplitCta, { meta as navSplitCtaMeta } from '@/components/catalog/nav/NavSplitCta';
import HeroSplit, { meta as heroSplitMeta } from '@/components/catalog/hero/HeroSplit';
import HeroCentered, { meta as heroCenteredMeta } from '@/components/catalog/hero/HeroCentered';
import HeroSlideshow, { meta as heroSlideshowMeta } from '@/components/catalog/hero/HeroSlideshow';
import HeroFormFocus, { meta as heroFormMeta } from '@/components/catalog/hero/HeroFormFocus';
import HeroOverlap, { meta as heroOverlapMeta } from '@/components/catalog/hero/HeroOverlap';
import AboutPillars, { meta as aboutPillarsMeta } from '@/components/catalog/about/AboutPillars';
import AboutFeature, { meta as aboutFeatureMeta } from '@/components/catalog/about/AboutFeature';
import AboutStatBand, { meta as aboutStatBandMeta } from '@/components/catalog/about/AboutStatBand';
import AboutStory, { meta as aboutStoryMeta } from '@/components/catalog/about/AboutStory';
import WorkCarousel, { meta as workCarouselMeta } from '@/components/catalog/work/WorkCarousel';
import WorkGrid, { meta as workGridMeta } from '@/components/catalog/work/WorkGrid';
import WorkSpotlight, { meta as workSpotlightMeta } from '@/components/catalog/work/WorkSpotlight';
import WorkMasonry, { meta as workMasonryMeta } from '@/components/catalog/work/WorkMasonry';
import TrustMarquee, { meta as trustMarqueeMeta } from '@/components/catalog/trust/TrustMarquee';
import TrustBadges, { meta as trustBadgesMeta } from '@/components/catalog/trust/TrustBadges';
import TrustLogoGrid, { meta as trustLogoGridMeta } from '@/components/catalog/trust/TrustLogoGrid';
import TrustBar, { meta as trustBarMeta } from '@/components/catalog/trust/TrustBar';
import FinalCtaBanner, { meta as finalCtaBannerMeta } from '@/components/catalog/finalCta/FinalCtaBanner';
import FinalCtaSimple, { meta as finalCtaSimpleMeta } from '@/components/catalog/finalCta/FinalCtaSimple';
import FinalCtaSplit, { meta as finalCtaSplitMeta } from '@/components/catalog/finalCta/FinalCtaSplit';
import FinalCtaGradient, { meta as finalCtaGradientMeta } from '@/components/catalog/finalCta/FinalCtaGradient';
import ServicesGrid, { meta as servicesGridMeta } from '@/components/catalog/services/ServicesGrid';
import ServicesAccordion, { meta as servicesAccordionMeta } from '@/components/catalog/services/ServicesAccordion';
import ServicesPanel, { meta as servicesPanelMeta } from '@/components/catalog/services/ServicesPanel';
import ServicesShowcase, { meta as servicesShowcaseMeta } from '@/components/catalog/services/ServicesShowcase';
import FaqAccordion, { meta as faqAccordionMeta } from '@/components/catalog/faq/FaqAccordion';
import FaqTwoColumn, { meta as faqTwoColumnMeta } from '@/components/catalog/faq/FaqTwoColumn';
import FaqStickyAside, { meta as faqStickyAsideMeta } from '@/components/catalog/faq/FaqStickyAside';
import FaqCentered, { meta as faqCenteredMeta } from '@/components/catalog/faq/FaqCentered';
import TestimonialsGrid, { meta as testimonialsGridMeta } from '@/components/catalog/testimonials/TestimonialsGrid';
import TestimonialsCarousel from '@/components/catalog/testimonials/TestimonialsCarousel';
import TestimonialsRotator, { meta as testimonialsRotatorMeta } from '@/components/catalog/testimonials/TestimonialsRotator';
import TestimonialsMarquee, { meta as testimonialsMarqueeMeta } from '@/components/catalog/testimonials/TestimonialsMarquee';
import ContactSplit, { meta as contactSplitMeta } from '@/components/catalog/contact/ContactSplit';
import CtaBanner from '@/components/catalog/contact/CtaBanner';
import ContactCardOverlap, { meta as contactCardOverlapMeta } from '@/components/catalog/contact/ContactCardOverlap';
import ContactInlineStrip, { meta as contactInlineStripMeta } from '@/components/catalog/contact/ContactInlineStrip';
import ContactSplitStarter, { meta as contactSplitStarterMeta } from '@/components/catalog/contact/ContactSplitStarter';
import ContactOverlapStarter, { meta as contactOverlapStarterMeta } from '@/components/catalog/contact/ContactOverlapStarter';
import ContactBannerStarter, { meta as contactBannerStarterMeta } from '@/components/catalog/contact/ContactBannerStarter';
import FooterColumns, { meta as footerColumnsMeta } from '@/components/catalog/footer/FooterColumns';
import FooterMinimal, { meta as footerMinimalMeta } from '@/components/catalog/footer/FooterMinimal';
import FooterBrandCta, { meta as footerBrandCtaMeta } from '@/components/catalog/footer/FooterBrandCta';
import FooterMega, { meta as footerMegaMeta } from '@/components/catalog/footer/FooterMega';
import SeoDefault, { meta as seoDefaultMeta } from '@/components/catalog/seo/SeoDefault';
import SeoLocalBusiness, { meta as seoLocalBusinessMeta } from '@/components/catalog/seo/SeoLocalBusiness';
// New trade-specific + motion-flagship variants
import NavEmergencyBar, { meta as navEmergencyMeta } from '@/components/catalog/nav/NavEmergencyBar';
import HeroKinetic, { meta as heroKineticMeta } from '@/components/catalog/hero/HeroKinetic';
import TrustLicenseInsurance, { meta as trustLicMeta } from '@/components/catalog/trust/TrustLicenseInsurance';
import TrustReviewsAggregate, { meta as trustReviewsMeta } from '@/components/catalog/trust/TrustReviewsAggregate';
import ServicesSpotlight, { meta as servicesSpotlightMeta } from '@/components/catalog/services/ServicesSpotlight';
import FinalCtaQuote, { meta as finalCtaQuoteMeta } from '@/components/catalog/finalCta/FinalCtaQuote';
import FinalCtaStarter, { meta as finalCtaStarterMeta } from '@/components/catalog/finalCta/FinalCtaStarter';
import FinalCtaStarterCentered, { meta as finalCtaStarterCenteredMeta } from '@/components/catalog/finalCta/FinalCtaStarterCentered';
import FinalCtaStarterBanner, { meta as finalCtaStarterBannerMeta } from '@/components/catalog/finalCta/FinalCtaStarterBanner';
import FinalCtaStarterEditorial, { meta as finalCtaStarterEditorialMeta } from '@/components/catalog/finalCta/FinalCtaStarterEditorial';

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
  id: 'nav' | 'hero' | 'trust' | 'about' | 'services' | 'work' | 'testimonials' | 'faq' | 'finalCta' | 'contact' | 'footer' | 'seo';
  label: string;
  iconName: 'Compass' | 'Sun' | 'SealCheck' | 'Users' | 'ListChecks' | 'Briefcase' | 'Star' | 'Question' | 'Megaphone' | 'Phone' | 'Article' | 'Code';
  variants: VariantEntry[];
};

/** Build the studio's component catalog bound to the current effective content. */
export function buildCategories(effective: SiteContent): CategoryEntry[] {
  // Starter clients capture leads by email; growth/enterprise by phone callback.
  // Show only the lead-capture variants that match the loaded client's plan.
  const isStarter = effective._meta?.selectedPlan === 'starter';
  const forPlan = (v: VariantEntry) => (v.leadMode ?? 'phone') === (isStarter ? 'email' : 'phone');

  return [
    {
      id: 'nav',
      label: 'Nav',
      iconName: 'Compass',
      variants: [
        { name: 'NavMinimal',         id: navMinimalMeta.id,      label: navMinimalMeta.label,      skins: skinsFor('NavMinimal'),      render: (skin) => <NavMinimal content={effective} skin={skin} /> },
        { name: 'NavCentered',        id: navCenteredMeta.id,     label: navCenteredMeta.label,     skins: skinsFor('NavCentered'),     render: () => <NavCentered content={effective} /> },
        { name: 'NavAnnouncementBar', id: navAnnouncementMeta.id, label: navAnnouncementMeta.label, skins: skinsFor('NavAnnouncementBar'), render: () => <NavAnnouncementBar content={effective} /> },
        { name: 'NavSplitCta',        id: navSplitCtaMeta.id,     label: navSplitCtaMeta.label,     skins: skinsFor('NavSplitCta'),     render: (skin) => <NavSplitCta content={effective} skin={skin} /> },
        { name: 'NavEmergencyBar',    id: navEmergencyMeta.id,    label: navEmergencyMeta.label,    skins: skinsFor('NavEmergencyBar'), render: (skin) => <NavEmergencyBar content={effective} skin={skin} /> },
      ],
    },
    {
      id: 'hero',
      label: 'Hero',
      iconName: 'Sun',
      variants: [
        { name: 'HeroSplit',     id: heroSplitMeta.id,     label: heroSplitMeta.label,     skins: skinsFor('HeroSplit'),     render: (skin) => <HeroSplit content={effective} skin={skin} /> },
        { name: 'HeroCentered',  id: heroCenteredMeta.id,  label: heroCenteredMeta.label,  skins: skinsFor('HeroCentered'),  render: (skin) => <HeroCentered content={effective} skin={skin} /> },
        { name: 'HeroSlideshow', id: heroSlideshowMeta.id, label: heroSlideshowMeta.label, skins: skinsFor('HeroSlideshow'), render: () => <HeroSlideshow content={effective} /> },
        { name: 'HeroFormFocus', id: heroFormMeta.id,      label: heroFormMeta.label,      skins: skinsFor('HeroFormFocus'), render: (skin) => <HeroFormFocus content={effective} skin={skin} /> },
        { name: 'HeroOverlap',   id: heroOverlapMeta.id,   label: heroOverlapMeta.label,   skins: skinsFor('HeroOverlap'),   render: () => <HeroOverlap content={effective} /> },
        { name: 'HeroKinetic',   id: heroKineticMeta.id,   label: heroKineticMeta.label,   skins: skinsFor('HeroKinetic'),   render: () => <HeroKinetic content={effective} /> },
      ],
    },
    {
      id: 'trust',
      label: 'Trust',
      iconName: 'SealCheck',
      variants: [
        { name: 'TrustMarquee',  id: trustMarqueeMeta.id,  label: trustMarqueeMeta.label,  skins: skinsFor('TrustMarquee'),  render: (skin) => <TrustMarquee content={effective} skin={skin} /> },
        { name: 'TrustBadges',   id: trustBadgesMeta.id,   label: trustBadgesMeta.label,   skins: skinsFor('TrustBadges'),   render: () => <TrustBadges content={effective} /> },
        { name: 'TrustLogoGrid', id: trustLogoGridMeta.id, label: trustLogoGridMeta.label, skins: skinsFor('TrustLogoGrid'), render: () => <TrustLogoGrid content={effective} /> },
        { name: 'TrustBar',      id: trustBarMeta.id,      label: trustBarMeta.label,      skins: skinsFor('TrustBar'),      render: () => <TrustBar content={effective} /> },
        { name: 'TrustLicenseInsurance', id: trustLicMeta.id,     label: trustLicMeta.label,     skins: skinsFor('TrustLicenseInsurance'), render: (skin) => <TrustLicenseInsurance content={effective} skin={skin} /> },
        { name: 'TrustReviewsAggregate', id: trustReviewsMeta.id, label: trustReviewsMeta.label, skins: skinsFor('TrustReviewsAggregate'), render: (skin) => <TrustReviewsAggregate content={effective} skin={skin} /> },
      ],
    },
    {
      id: 'about',
      label: 'About',
      iconName: 'Users',
      variants: [
        { name: 'AboutPillars',  id: aboutPillarsMeta.id,  label: aboutPillarsMeta.label,  skins: skinsFor('AboutPillars'),  render: () => <AboutPillars content={effective} /> },
        { name: 'AboutFeature',  id: aboutFeatureMeta.id,  label: aboutFeatureMeta.label,  skins: skinsFor('AboutFeature'),  render: (skin) => <AboutFeature content={effective} skin={skin} /> },
        { name: 'AboutStatBand', id: aboutStatBandMeta.id, label: aboutStatBandMeta.label, skins: skinsFor('AboutStatBand'), render: (skin) => <AboutStatBand content={effective} skin={skin} /> },
        { name: 'AboutStory',    id: aboutStoryMeta.id,    label: aboutStoryMeta.label,    skins: skinsFor('AboutStory'),    render: (skin) => <AboutStory content={effective} skin={skin} /> },
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
      ],
    },
    {
      id: 'work',
      label: 'Work',
      iconName: 'Briefcase',
      variants: [
        { name: 'WorkCarousel',  id: workCarouselMeta.id,  label: workCarouselMeta.label,  skins: skinsFor('WorkCarousel'),  render: (skin) => <WorkCarousel content={effective} skin={skin} /> },
        { name: 'WorkGrid',      id: workGridMeta.id,      label: workGridMeta.label,      skins: skinsFor('WorkGrid'),      render: (skin) => <WorkGrid content={effective} skin={skin} /> },
        { name: 'WorkSpotlight', id: workSpotlightMeta.id, label: workSpotlightMeta.label, skins: skinsFor('WorkSpotlight'), render: (skin) => <WorkSpotlight content={effective} skin={skin} /> },
        { name: 'WorkMasonry',   id: workMasonryMeta.id,   label: workMasonryMeta.label,   skins: skinsFor('WorkMasonry'),   render: () => <WorkMasonry content={effective} previewMode /> },
      ],
    },
    {
      id: 'faq',
      label: 'FAQ',
      iconName: 'Question',
      variants: [
        { name: 'FaqAccordion',   id: faqAccordionMeta.id,   label: faqAccordionMeta.label,   skins: skinsFor('FaqAccordion'),   render: (skin) => <FaqAccordion content={effective} skin={skin} /> },
        { name: 'FaqTwoColumn',   id: faqTwoColumnMeta.id,   label: faqTwoColumnMeta.label,   skins: skinsFor('FaqTwoColumn'),   render: (skin) => <FaqTwoColumn content={effective} skin={skin} /> },
        { name: 'FaqStickyAside', id: faqStickyAsideMeta.id, label: faqStickyAsideMeta.label, skins: skinsFor('FaqStickyAside'), render: (skin) => <FaqStickyAside content={effective} skin={skin} /> },
        { name: 'FaqCentered',    id: faqCenteredMeta.id,    label: faqCenteredMeta.label,    skins: skinsFor('FaqCentered'),    render: () => <FaqCentered content={effective} /> },
      ],
    },
    {
      id: 'testimonials',
      label: 'Testimonials',
      iconName: 'Star',
      variants: [
        { name: 'TestimonialsGrid',     id: testimonialsGridMeta.id,     label: testimonialsGridMeta.label,     skins: skinsFor('TestimonialsGrid'),     render: (skin) => <TestimonialsGrid content={effective} skin={skin} /> },
        { name: 'TestimonialsCarousel', id: 'testimonials-carousel',     label: 'Testimonials / Carousel',      skins: skinsFor('TestimonialsCarousel'), render: () => <TestimonialsCarousel content={effective} /> },
        { name: 'TestimonialsRotator',  id: testimonialsRotatorMeta.id,  label: testimonialsRotatorMeta.label,  skins: skinsFor('TestimonialsRotator'),  render: (skin) => <TestimonialsRotator content={effective} skin={skin} /> },
        { name: 'TestimonialsMarquee',  id: testimonialsMarqueeMeta.id,  label: testimonialsMarqueeMeta.label,  skins: skinsFor('TestimonialsMarquee'),  render: (skin) => <TestimonialsMarquee content={effective} skin={skin} /> },
      ],
    },
    {
      id: 'finalCta',
      label: 'Final CTA',
      iconName: 'Megaphone',
      variants: [
        { name: 'FinalCtaBanner',   id: finalCtaBannerMeta.id,   label: finalCtaBannerMeta.label,   skins: skinsFor('FinalCtaBanner'),   leadMode: finalCtaBannerMeta.leadMode,   render: () => <FinalCtaBanner content={effective} /> },
        { name: 'FinalCtaSimple',   id: finalCtaSimpleMeta.id,   label: finalCtaSimpleMeta.label,   skins: skinsFor('FinalCtaSimple'),   leadMode: finalCtaSimpleMeta.leadMode,   render: () => <FinalCtaSimple content={effective} /> },
        { name: 'FinalCtaSplit',    id: finalCtaSplitMeta.id,    label: finalCtaSplitMeta.label,    skins: skinsFor('FinalCtaSplit'),    leadMode: finalCtaSplitMeta.leadMode,    render: (skin: SkinId) => <FinalCtaSplit content={effective} skin={skin} /> },
        { name: 'FinalCtaGradient', id: finalCtaGradientMeta.id, label: finalCtaGradientMeta.label, skins: skinsFor('FinalCtaGradient'), leadMode: finalCtaGradientMeta.leadMode, render: (skin: SkinId) => <FinalCtaGradient content={effective} skin={skin} /> },
        { name: 'FinalCtaQuote',    id: finalCtaQuoteMeta.id,    label: finalCtaQuoteMeta.label,    skins: skinsFor('FinalCtaQuote'),    leadMode: finalCtaQuoteMeta.leadMode,    render: (skin: SkinId) => <FinalCtaQuote content={effective} skin={skin} /> },
        { name: 'FinalCtaStarter',         id: finalCtaStarterMeta.id,         label: finalCtaStarterMeta.label,         skins: skinsFor('FinalCtaStarter'),         leadMode: finalCtaStarterMeta.leadMode,         render: (skin: SkinId) => <FinalCtaStarter content={effective} skin={skin} /> },
        { name: 'FinalCtaStarterCentered', id: finalCtaStarterCenteredMeta.id, label: finalCtaStarterCenteredMeta.label, skins: skinsFor('FinalCtaStarterCentered'), leadMode: finalCtaStarterCenteredMeta.leadMode, render: (skin: SkinId) => <FinalCtaStarterCentered content={effective} skin={skin} /> },
        { name: 'FinalCtaStarterBanner',   id: finalCtaStarterBannerMeta.id,   label: finalCtaStarterBannerMeta.label,   skins: skinsFor('FinalCtaStarterBanner'),   leadMode: finalCtaStarterBannerMeta.leadMode,   render: () => <FinalCtaStarterBanner content={effective} /> },
        { name: 'FinalCtaStarterEditorial', id: finalCtaStarterEditorialMeta.id, label: finalCtaStarterEditorialMeta.label, skins: skinsFor('FinalCtaStarterEditorial'), leadMode: finalCtaStarterEditorialMeta.leadMode, render: (skin: SkinId) => <FinalCtaStarterEditorial content={effective} skin={skin} /> },
      ].filter(forPlan),
    },
    {
      id: 'contact',
      label: 'Contact',
      iconName: 'Phone',
      variants: [
        { name: 'ContactSplit',        id: contactSplitMeta.id,         label: contactSplitMeta.label,           skins: skinsFor('ContactSplit'),        leadMode: contactSplitMeta.leadMode,        render: (skin: SkinId) => <ContactSplit content={effective} skin={skin} /> },
        { name: 'CtaBanner',           id: 'cta-banner',                label: 'CTA / Banner with quick form',   skins: skinsFor('CtaBanner'),           leadMode: 'phone' as const,                 render: () => <CtaBanner content={effective} /> },
        { name: 'ContactCardOverlap',  id: contactCardOverlapMeta.id,   label: contactCardOverlapMeta.label,     skins: skinsFor('ContactCardOverlap'),  leadMode: contactCardOverlapMeta.leadMode,  render: (skin: SkinId) => <ContactCardOverlap content={effective} skin={skin} /> },
        { name: 'ContactInlineStrip',  id: contactInlineStripMeta.id,   label: contactInlineStripMeta.label,     skins: skinsFor('ContactInlineStrip'),  leadMode: contactInlineStripMeta.leadMode,  render: (skin: SkinId) => <ContactInlineStrip content={effective} skin={skin} /> },
        { name: 'ContactSplitStarter', id: contactSplitStarterMeta.id,  label: contactSplitStarterMeta.label,    skins: skinsFor('ContactSplitStarter'), leadMode: contactSplitStarterMeta.leadMode, render: (skin: SkinId) => <ContactSplitStarter content={effective} skin={skin} /> },
        { name: 'ContactOverlapStarter', id: contactOverlapStarterMeta.id, label: contactOverlapStarterMeta.label, skins: skinsFor('ContactOverlapStarter'), leadMode: contactOverlapStarterMeta.leadMode, render: (skin: SkinId) => <ContactOverlapStarter content={effective} skin={skin} /> },
        { name: 'ContactBannerStarter', id: contactBannerStarterMeta.id, label: contactBannerStarterMeta.label,  skins: skinsFor('ContactBannerStarter'), leadMode: contactBannerStarterMeta.leadMode, render: () => <ContactBannerStarter content={effective} /> },
      ].filter(forPlan),
    },
    {
      id: 'footer',
      label: 'Footer',
      iconName: 'Article',
      variants: [
        { name: 'FooterColumns',  id: footerColumnsMeta.id,  label: footerColumnsMeta.label,  skins: skinsFor('FooterColumns'),  render: (skin) => <FooterColumns content={effective} skin={skin} /> },
        { name: 'FooterMinimal',  id: footerMinimalMeta.id,  label: footerMinimalMeta.label,  skins: skinsFor('FooterMinimal'),  render: (skin) => <FooterMinimal content={effective} skin={skin} /> },
        { name: 'FooterBrandCta', id: footerBrandCtaMeta.id, label: footerBrandCtaMeta.label, skins: skinsFor('FooterBrandCta'), render: (skin) => <FooterBrandCta content={effective} skin={skin} /> },
        { name: 'FooterMega',     id: footerMegaMeta.id,     label: footerMegaMeta.label,     skins: skinsFor('FooterMega'),     render: () => <FooterMega content={effective} /> },
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
            <>
              <SeoDefault />
              <SeoPreviewBody
                metadata={{
                  title: effective.seo.title,
                  description: effective.seo.description,
                  alternates: { canonical: effective.seo.canonical },
                }}
                jsonLd={null}
              />
            </>
          ),
        },
        {
          name: 'SeoLocalBusiness',
          id: seoLocalBusinessMeta.id,
          label: seoLocalBusinessMeta.label,
          skins: skinsFor('SeoLocalBusiness'),
          render: () => (
            <>
              <SeoLocalBusiness />
              <SeoPreviewBody
                metadata={{
                  title: effective.seo.title || effective.brand.name,
                  description: effective.seo.description || effective.brand.tagline,
                  alternates: { canonical: effective.seo.canonical },
                }}
                jsonLd={{
                  '@context': 'https://schema.org',
                  '@type': 'LocalBusiness',
                  name: effective.brand.long || effective.brand.name,
                  description: effective.seo.description || effective.brand.tagline,
                  telephone: effective.brand.phone,
                  email: effective.brand.email,
                  address: effective.brand.address,
                  ...(effective.seo.canonical ? { url: effective.seo.canonical } : {}),
                  ...(effective.brand.established ? { foundingDate: effective.brand.established } : {}),
                }}
              />
            </>
          ),
        },
      ],
    },
  ];
}
