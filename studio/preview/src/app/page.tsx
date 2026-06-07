'use client';

import NavMinimal, { meta as navMinimalMeta } from '@/components/catalog/nav/NavMinimal';
import NavCentered, { meta as navCenteredMeta } from '@/components/catalog/nav/NavCentered';
import NavAnnouncementBar, { meta as navAnnouncementMeta } from '@/components/catalog/nav/NavAnnouncementBar';
import NavSplitCta, { meta as navSplitCtaMeta } from '@/components/catalog/nav/NavSplitCta';
import HeroSplit, { meta as heroSplitMeta } from '@/components/catalog/hero/HeroSplit';
import HeroCentered, { meta as heroCenteredMeta } from '@/components/catalog/hero/HeroCentered';
import HeroSlideshow, { meta as heroSlideshowMeta } from '@/components/catalog/hero/HeroSlideshow';
import HeroFormFocus, { meta as heroFormMeta } from '@/components/catalog/hero/HeroFormFocus';
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
import ContactSplit from '@/components/catalog/contact/ContactSplit';
import CtaBanner from '@/components/catalog/contact/CtaBanner';
import ContactCardOverlap, { meta as contactCardOverlapMeta } from '@/components/catalog/contact/ContactCardOverlap';
import ContactInlineStrip, { meta as contactInlineStripMeta } from '@/components/catalog/contact/ContactInlineStrip';
import FooterColumns, { meta as footerColumnsMeta } from '@/components/catalog/footer/FooterColumns';
import FooterMinimal, { meta as footerMinimalMeta } from '@/components/catalog/footer/FooterMinimal';
import FooterBrandCta, { meta as footerBrandCtaMeta } from '@/components/catalog/footer/FooterBrandCta';
import FooterMega, { meta as footerMegaMeta } from '@/components/catalog/footer/FooterMega';
import SeoDefault, { meta as seoDefaultMeta, generateMetadata as seoDefaultGenerate } from '@/components/catalog/seo/SeoDefault';
import SeoLocalBusiness, { meta as seoLocalBusinessMeta, generateMetadata as seoLocalBusinessGenerate } from '@/components/catalog/seo/SeoLocalBusiness';

import StudioApp from './StudioApp';
import SeoPreviewBody from './SeoPreviewBody';
import { CONTENT } from '@/data/site';

export type VariantEntry = {
  name: string;
  id: string;
  label: string;
  node: React.ReactNode;
};

export type CategoryEntry = {
  id: 'nav' | 'hero' | 'trust' | 'about' | 'services' | 'work' | 'testimonials' | 'faq' | 'finalCta' | 'contact' | 'footer' | 'seo';
  label: string;
  iconName: 'Compass' | 'Sun' | 'SealCheck' | 'Users' | 'ListChecks' | 'Briefcase' | 'Star' | 'Question' | 'Megaphone' | 'Phone' | 'Article' | 'Code';
  variants: VariantEntry[];
};

export default function Page() {
  const categories: CategoryEntry[] = [
    {
      id: 'nav',
      label: 'Nav',
      iconName: 'Compass',
      variants: [
        { name: 'NavMinimal',         id: navMinimalMeta.id,      label: navMinimalMeta.label,      node: <NavMinimal /> },
        { name: 'NavCentered',        id: navCenteredMeta.id,     label: navCenteredMeta.label,     node: <NavCentered /> },
        { name: 'NavAnnouncementBar', id: navAnnouncementMeta.id, label: navAnnouncementMeta.label, node: <NavAnnouncementBar /> },
        { name: 'NavSplitCta',        id: navSplitCtaMeta.id,     label: navSplitCtaMeta.label,     node: <NavSplitCta /> },
      ],
    },
    {
      id: 'hero',
      label: 'Hero',
      iconName: 'Sun',
      variants: [
        { name: 'HeroSplit',     id: heroSplitMeta.id,     label: heroSplitMeta.label,     node: <HeroSplit /> },
        { name: 'HeroCentered',  id: heroCenteredMeta.id,  label: heroCenteredMeta.label,  node: <HeroCentered /> },
        { name: 'HeroSlideshow', id: heroSlideshowMeta.id, label: heroSlideshowMeta.label, node: <HeroSlideshow /> },
        { name: 'HeroFormFocus', id: heroFormMeta.id,      label: heroFormMeta.label,      node: <HeroFormFocus /> },
      ],
    },
    {
      id: 'trust',
      label: 'Trust',
      iconName: 'SealCheck',
      variants: [
        { name: 'TrustMarquee',  id: trustMarqueeMeta.id,  label: trustMarqueeMeta.label,  node: <TrustMarquee /> },
        { name: 'TrustBadges',   id: trustBadgesMeta.id,   label: trustBadgesMeta.label,   node: <TrustBadges /> },
        { name: 'TrustLogoGrid', id: trustLogoGridMeta.id, label: trustLogoGridMeta.label, node: <TrustLogoGrid /> },
        { name: 'TrustBar',      id: trustBarMeta.id,      label: trustBarMeta.label,      node: <TrustBar /> },
      ],
    },
    {
      id: 'about',
      label: 'About',
      iconName: 'Users',
      variants: [
        { name: 'AboutPillars',  id: aboutPillarsMeta.id,  label: aboutPillarsMeta.label,  node: <AboutPillars /> },
        { name: 'AboutFeature',  id: aboutFeatureMeta.id,  label: aboutFeatureMeta.label,  node: <AboutFeature /> },
        { name: 'AboutStatBand', id: aboutStatBandMeta.id, label: aboutStatBandMeta.label, node: <AboutStatBand /> },
        { name: 'AboutStory',    id: aboutStoryMeta.id,    label: aboutStoryMeta.label,    node: <AboutStory /> },
      ],
    },
    {
      id: 'services',
      label: 'Services',
      iconName: 'ListChecks',
      variants: [
        { name: 'ServicesGrid',      id: servicesGridMeta.id,      label: servicesGridMeta.label,      node: <ServicesGrid /> },
        { name: 'ServicesAccordion', id: servicesAccordionMeta.id, label: servicesAccordionMeta.label, node: <ServicesAccordion /> },
        { name: 'ServicesPanel',     id: servicesPanelMeta.id,     label: servicesPanelMeta.label,     node: <ServicesPanel /> },
        { name: 'ServicesShowcase',  id: servicesShowcaseMeta.id,  label: servicesShowcaseMeta.label,  node: <ServicesShowcase /> },
      ],
    },
    {
      id: 'work',
      label: 'Work',
      iconName: 'Briefcase',
      variants: [
        { name: 'WorkCarousel',  id: workCarouselMeta.id,  label: workCarouselMeta.label,  node: <WorkCarousel /> },
        { name: 'WorkGrid',      id: workGridMeta.id,      label: workGridMeta.label,      node: <WorkGrid /> },
        { name: 'WorkSpotlight', id: workSpotlightMeta.id, label: workSpotlightMeta.label, node: <WorkSpotlight /> },
        { name: 'WorkMasonry',   id: workMasonryMeta.id,   label: workMasonryMeta.label,   node: <WorkMasonry /> },
      ],
    },
    {
      id: 'faq',
      label: 'FAQ',
      iconName: 'Question',
      variants: [
        { name: 'FaqAccordion',   id: faqAccordionMeta.id,   label: faqAccordionMeta.label,   node: <FaqAccordion /> },
        { name: 'FaqTwoColumn',   id: faqTwoColumnMeta.id,   label: faqTwoColumnMeta.label,   node: <FaqTwoColumn /> },
        { name: 'FaqStickyAside', id: faqStickyAsideMeta.id, label: faqStickyAsideMeta.label, node: <FaqStickyAside /> },
        { name: 'FaqCentered',    id: faqCenteredMeta.id,    label: faqCenteredMeta.label,    node: <FaqCentered /> },
      ],
    },
    {
      id: 'testimonials',
      label: 'Testimonials',
      iconName: 'Star',
      variants: [
        { name: 'TestimonialsGrid',     id: testimonialsGridMeta.id,     label: testimonialsGridMeta.label,     node: <TestimonialsGrid /> },
        { name: 'TestimonialsCarousel', id: 'testimonials-carousel',     label: 'Testimonials / Carousel',      node: <TestimonialsCarousel /> },
        { name: 'TestimonialsRotator',  id: testimonialsRotatorMeta.id,  label: testimonialsRotatorMeta.label,  node: <TestimonialsRotator /> },
        { name: 'TestimonialsMarquee',  id: testimonialsMarqueeMeta.id,  label: testimonialsMarqueeMeta.label,  node: <TestimonialsMarquee /> },
      ],
    },
    {
      id: 'finalCta',
      label: 'Final CTA',
      iconName: 'Megaphone',
      variants: [
        { name: 'FinalCtaBanner',   id: finalCtaBannerMeta.id,   label: finalCtaBannerMeta.label,   node: <FinalCtaBanner /> },
        { name: 'FinalCtaSimple',   id: finalCtaSimpleMeta.id,   label: finalCtaSimpleMeta.label,   node: <FinalCtaSimple /> },
        { name: 'FinalCtaSplit',    id: finalCtaSplitMeta.id,    label: finalCtaSplitMeta.label,    node: <FinalCtaSplit /> },
        { name: 'FinalCtaGradient', id: finalCtaGradientMeta.id, label: finalCtaGradientMeta.label, node: <FinalCtaGradient /> },
      ],
    },
    {
      id: 'contact',
      label: 'Contact',
      iconName: 'Phone',
      variants: [
        { name: 'ContactSplit',        id: 'contact-split',             label: 'Contact / Split form + details', node: <ContactSplit /> },
        { name: 'CtaBanner',           id: 'cta-banner',                label: 'CTA / Banner with quick form',   node: <CtaBanner /> },
        { name: 'ContactCardOverlap',  id: contactCardOverlapMeta.id,   label: contactCardOverlapMeta.label,     node: <ContactCardOverlap /> },
        { name: 'ContactInlineStrip',  id: contactInlineStripMeta.id,   label: contactInlineStripMeta.label,     node: <ContactInlineStrip /> },
      ],
    },
    {
      id: 'footer',
      label: 'Footer',
      iconName: 'Article',
      variants: [
        { name: 'FooterColumns',  id: footerColumnsMeta.id,  label: footerColumnsMeta.label,  node: <FooterColumns /> },
        { name: 'FooterMinimal',  id: footerMinimalMeta.id,  label: footerMinimalMeta.label,  node: <FooterMinimal /> },
        { name: 'FooterBrandCta', id: footerBrandCtaMeta.id, label: footerBrandCtaMeta.label, node: <FooterBrandCta /> },
        { name: 'FooterMega',     id: footerMegaMeta.id,     label: footerMegaMeta.label,     node: <FooterMega /> },
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
          node: (
            <>
              <SeoDefault />
              <SeoPreviewBody metadata={seoDefaultGenerate()} jsonLd={null} />
            </>
          ),
        },
        {
          name: 'SeoLocalBusiness',
          id: seoLocalBusinessMeta.id,
          label: seoLocalBusinessMeta.label,
          node: (
            <>
              <SeoLocalBusiness />
              <SeoPreviewBody
                metadata={seoLocalBusinessGenerate()}
                jsonLd={{
                  '@context': 'https://schema.org',
                  '@type': 'LocalBusiness',
                  name: CONTENT.brand.long || CONTENT.brand.name,
                  description: CONTENT.seo.description || CONTENT.brand.tagline,
                  telephone: CONTENT.brand.phone,
                  email: CONTENT.brand.email,
                  address: CONTENT.brand.address,
                  ...(CONTENT.seo.canonical ? { url: CONTENT.seo.canonical } : {}),
                  ...(CONTENT.brand.established ? { foundingDate: CONTENT.brand.established } : {}),
                }}
              />
            </>
          ),
        },
      ],
    },
  ];

  return <StudioApp categories={categories} />;
}
