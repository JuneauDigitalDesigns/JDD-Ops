import type { ReactNode } from 'react';
import NavMinimal, { meta as navMinimalMeta } from '@/components/catalog/nav/NavMinimal';
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
        { name: 'NavEmergencyBar',    id: navEmergencyMeta.id,    label: navEmergencyMeta.label,    skins: skinsFor('NavEmergencyBar'), render: (skin) => <NavEmergencyBar content={effective} skin={skin} /> },
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
      ],
    },
    {
      id: 'trust',
      label: 'Trust',
      iconName: 'SealCheck',
      variants: [
        { name: 'TrustBadges',   id: trustBadgesMeta.id,   label: trustBadgesMeta.label,   skins: skinsFor('TrustBadges'),   render: () => <TrustBadges content={effective} /> },
        { name: 'TrustReviewsAggregate', id: trustReviewsMeta.id, label: trustReviewsMeta.label, skins: skinsFor('TrustReviewsAggregate'), render: (skin) => <TrustReviewsAggregate content={effective} skin={skin} /> },
      ],
    },
    {
      id: 'about',
      label: 'About',
      iconName: 'Users',
      variants: [
        { name: 'AboutFeature',  id: aboutFeatureMeta.id,  label: aboutFeatureMeta.label,  skins: skinsFor('AboutFeature'),  render: (skin) => <AboutFeature content={effective} skin={skin} /> },
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
      ],
    },
    {
      id: 'work',
      label: 'Work',
      iconName: 'Briefcase',
      variants: [
        { name: 'RecentJobsGrid',      id: recentJobsGridMeta.id,      label: recentJobsGridMeta.label,      skins: skinsFor('RecentJobsGrid'),      render: (skin) => <RecentJobsGrid content={effective} skin={skin} /> },
        { name: 'BeforeAfter', id: beforeAfterMeta.id, label: beforeAfterMeta.label, skins: skinsFor('BeforeAfter'), render: (skin) => <BeforeAfter content={effective} skin={skin} /> },
      ],
    },
    {
      id: 'faq',
      label: 'FAQ',
      iconName: 'Question',
      variants: [
        { name: 'FaqAccordion',   id: faqAccordionMeta.id,   label: faqAccordionMeta.label,   skins: skinsFor('FaqAccordion'),   render: (skin) => <FaqAccordion content={effective} skin={skin} /> },
        { name: 'FaqStickyAside', id: faqStickyAsideMeta.id, label: faqStickyAsideMeta.label, skins: skinsFor('FaqStickyAside'), render: (skin) => <FaqStickyAside content={effective} skin={skin} /> },
      ],
    },
    {
      id: 'testimonials',
      label: 'Testimonials',
      iconName: 'Star',
      variants: [
        { name: 'TestimonialsGrid',     id: testimonialsGridMeta.id,     label: testimonialsGridMeta.label,     skins: skinsFor('TestimonialsGrid'),     render: (skin) => <TestimonialsGrid content={effective} skin={skin} /> },
        { name: 'TestimonialsCarousel', id: 'testimonials-carousel',     label: 'Testimonials / Carousel',      skins: skinsFor('TestimonialsCarousel'), render: () => <TestimonialsCarousel content={effective} /> },
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
      ].filter(forPlan),
    },
    {
      id: 'contact',
      label: 'Contact',
      iconName: 'Phone',
      variants: [
        { name: 'ContactSplit',        id: contactSplitMeta.id,         label: contactSplitMeta.label,           skins: skinsFor('ContactSplit'),        leadMode: contactSplitMeta.leadMode,        render: (skin: SkinId) => <ContactSplit content={effective} skin={skin} /> },
        { name: 'ContactCardOverlap',  id: contactCardOverlapMeta.id,   label: contactCardOverlapMeta.label,     skins: skinsFor('ContactCardOverlap'),  leadMode: contactCardOverlapMeta.leadMode,  render: (skin: SkinId) => <ContactCardOverlap content={effective} skin={skin} /> },
        { name: 'ContactInlineStrip',  id: contactInlineStripMeta.id,   label: contactInlineStripMeta.label,     skins: skinsFor('ContactInlineStrip'),  leadMode: contactInlineStripMeta.leadMode,  render: (skin: SkinId) => <ContactInlineStrip content={effective} skin={skin} /> },
      ].filter(forPlan),
    },
    {
      id: 'footer',
      label: 'Footer',
      iconName: 'Article',
      variants: [
        { name: 'FooterColumns',  id: footerColumnsMeta.id,  label: footerColumnsMeta.label,  skins: skinsFor('FooterColumns'),  render: (skin) => <FooterColumns content={effective} skin={skin} /> },
        { name: 'FooterMinimal',  id: footerMinimalMeta.id,  label: footerMinimalMeta.label,  skins: skinsFor('FooterMinimal'),  render: (skin) => <FooterMinimal content={effective} skin={skin} /> },
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
