'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
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
import ContactSplit from '@/components/catalog/contact/ContactSplit';
import CtaBanner from '@/components/catalog/contact/CtaBanner';
import ContactCardOverlap, { meta as contactCardOverlapMeta } from '@/components/catalog/contact/ContactCardOverlap';
import ContactInlineStrip, { meta as contactInlineStripMeta } from '@/components/catalog/contact/ContactInlineStrip';
import FooterColumns, { meta as footerColumnsMeta } from '@/components/catalog/footer/FooterColumns';
import FooterMinimal, { meta as footerMinimalMeta } from '@/components/catalog/footer/FooterMinimal';
import FooterBrandCta, { meta as footerBrandCtaMeta } from '@/components/catalog/footer/FooterBrandCta';
import FooterMega, { meta as footerMegaMeta } from '@/components/catalog/footer/FooterMega';
import SeoDefault, { meta as seoDefaultMeta } from '@/components/catalog/seo/SeoDefault';
import SeoLocalBusiness, { meta as seoLocalBusinessMeta } from '@/components/catalog/seo/SeoLocalBusiness';

import StudioApp from './StudioApp';
import SeoPreviewBody from './SeoPreviewBody';
import type { SiteContent } from '@/data/site';
import { VERTICAL_PRESETS, VERTICALS, type VerticalId } from '@/lib/verticals';
import { deepMerge, applyEdits } from '@/lib/merge';

const CONTENT_KEY = 'jdd-studio-content';

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
  const [vertical, setVertical] = useState<VerticalId>(VERTICALS[0].id);
  const [imported, setImported] = useState<SiteContent | null>(null);
  const [edits, setEdits] = useState<Record<string, unknown>>({});
  const [hydrated, setHydrated] = useState(false);

  // Effective content = vertical preset (floor) ← imported JSON ← user edits (top).
  // Missing/empty fields fall through to the vertical so the site is never half-empty.
  const effective = useMemo(
    () => applyEdits(deepMerge(VERTICAL_PRESETS[vertical], imported ?? {}), edits),
    [vertical, imported, edits],
  );

  // Hydrate the builder state from localStorage once on mount.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CONTENT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          vertical?: VerticalId;
          imported?: SiteContent | null;
          edits?: Record<string, unknown>;
        };
        if (parsed.vertical && VERTICALS.some((v) => v.id === parsed.vertical)) setVertical(parsed.vertical);
        if (parsed.imported) setImported(parsed.imported);
        if (parsed.edits && typeof parsed.edits === 'object') setEdits(parsed.edits);
      }
    } catch {
      // ignore malformed storage
    }
    setHydrated(true);
  }, []);

  // Persist whenever the builder state changes (after hydration).
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(CONTENT_KEY, JSON.stringify({ vertical, imported, edits }));
    } catch {
      // storage full or unavailable
    }
  }, [vertical, imported, edits, hydrated]);

  const setField = useCallback((path: string, value: unknown) => {
    setEdits((e) => ({ ...e, [path]: value }));
  }, []);
  const importSite = useCallback((site: SiteContent) => setImported(site), []);
  const clearImport = useCallback(() => setImported(null), []);
  const resetEdits = useCallback(() => setEdits({}), []);

  const categories: CategoryEntry[] = useMemo(() => [
    {
      id: 'nav',
      label: 'Nav',
      iconName: 'Compass',
      variants: [
        { name: 'NavMinimal',         id: navMinimalMeta.id,      label: navMinimalMeta.label,      node: <NavMinimal content={effective} /> },
        { name: 'NavCentered',        id: navCenteredMeta.id,     label: navCenteredMeta.label,     node: <NavCentered content={effective} /> },
        { name: 'NavAnnouncementBar', id: navAnnouncementMeta.id, label: navAnnouncementMeta.label, node: <NavAnnouncementBar content={effective} /> },
        { name: 'NavSplitCta',        id: navSplitCtaMeta.id,     label: navSplitCtaMeta.label,     node: <NavSplitCta content={effective} /> },
      ],
    },
    {
      id: 'hero',
      label: 'Hero',
      iconName: 'Sun',
      variants: [
        { name: 'HeroSplit',     id: heroSplitMeta.id,     label: heroSplitMeta.label,     node: <HeroSplit content={effective} /> },
        { name: 'HeroCentered',  id: heroCenteredMeta.id,  label: heroCenteredMeta.label,  node: <HeroCentered content={effective} /> },
        { name: 'HeroSlideshow', id: heroSlideshowMeta.id, label: heroSlideshowMeta.label, node: <HeroSlideshow content={effective} /> },
        { name: 'HeroFormFocus', id: heroFormMeta.id,      label: heroFormMeta.label,      node: <HeroFormFocus content={effective} /> },
        { name: 'HeroOverlap',   id: heroOverlapMeta.id,   label: heroOverlapMeta.label,   node: <HeroOverlap content={effective} /> },
      ],
    },
    {
      id: 'trust',
      label: 'Trust',
      iconName: 'SealCheck',
      variants: [
        { name: 'TrustMarquee',  id: trustMarqueeMeta.id,  label: trustMarqueeMeta.label,  node: <TrustMarquee content={effective} /> },
        { name: 'TrustBadges',   id: trustBadgesMeta.id,   label: trustBadgesMeta.label,   node: <TrustBadges content={effective} /> },
        { name: 'TrustLogoGrid', id: trustLogoGridMeta.id, label: trustLogoGridMeta.label, node: <TrustLogoGrid content={effective} /> },
        { name: 'TrustBar',      id: trustBarMeta.id,      label: trustBarMeta.label,      node: <TrustBar content={effective} /> },
      ],
    },
    {
      id: 'about',
      label: 'About',
      iconName: 'Users',
      variants: [
        { name: 'AboutPillars',  id: aboutPillarsMeta.id,  label: aboutPillarsMeta.label,  node: <AboutPillars content={effective} /> },
        { name: 'AboutFeature',  id: aboutFeatureMeta.id,  label: aboutFeatureMeta.label,  node: <AboutFeature content={effective} /> },
        { name: 'AboutStatBand', id: aboutStatBandMeta.id, label: aboutStatBandMeta.label, node: <AboutStatBand content={effective} /> },
        { name: 'AboutStory',    id: aboutStoryMeta.id,    label: aboutStoryMeta.label,    node: <AboutStory content={effective} /> },
      ],
    },
    {
      id: 'services',
      label: 'Services',
      iconName: 'ListChecks',
      variants: [
        { name: 'ServicesGrid',      id: servicesGridMeta.id,      label: servicesGridMeta.label,      node: <ServicesGrid content={effective} /> },
        { name: 'ServicesAccordion', id: servicesAccordionMeta.id, label: servicesAccordionMeta.label, node: <ServicesAccordion content={effective} /> },
        { name: 'ServicesPanel',     id: servicesPanelMeta.id,     label: servicesPanelMeta.label,     node: <ServicesPanel content={effective} /> },
        { name: 'ServicesShowcase',  id: servicesShowcaseMeta.id,  label: servicesShowcaseMeta.label,  node: <ServicesShowcase content={effective} /> },
      ],
    },
    {
      id: 'work',
      label: 'Work',
      iconName: 'Briefcase',
      variants: [
        { name: 'WorkCarousel',  id: workCarouselMeta.id,  label: workCarouselMeta.label,  node: <WorkCarousel content={effective} /> },
        { name: 'WorkGrid',      id: workGridMeta.id,      label: workGridMeta.label,      node: <WorkGrid content={effective} /> },
        { name: 'WorkSpotlight', id: workSpotlightMeta.id, label: workSpotlightMeta.label, node: <WorkSpotlight content={effective} /> },
        { name: 'WorkMasonry',   id: workMasonryMeta.id,   label: workMasonryMeta.label,   node: <WorkMasonry content={effective} /> },
      ],
    },
    {
      id: 'faq',
      label: 'FAQ',
      iconName: 'Question',
      variants: [
        { name: 'FaqAccordion',   id: faqAccordionMeta.id,   label: faqAccordionMeta.label,   node: <FaqAccordion content={effective} /> },
        { name: 'FaqTwoColumn',   id: faqTwoColumnMeta.id,   label: faqTwoColumnMeta.label,   node: <FaqTwoColumn content={effective} /> },
        { name: 'FaqStickyAside', id: faqStickyAsideMeta.id, label: faqStickyAsideMeta.label, node: <FaqStickyAside content={effective} /> },
        { name: 'FaqCentered',    id: faqCenteredMeta.id,    label: faqCenteredMeta.label,    node: <FaqCentered content={effective} /> },
      ],
    },
    {
      id: 'testimonials',
      label: 'Testimonials',
      iconName: 'Star',
      variants: [
        { name: 'TestimonialsGrid',     id: testimonialsGridMeta.id,     label: testimonialsGridMeta.label,     node: <TestimonialsGrid content={effective} /> },
        { name: 'TestimonialsCarousel', id: 'testimonials-carousel',     label: 'Testimonials / Carousel',      node: <TestimonialsCarousel content={effective} /> },
        { name: 'TestimonialsRotator',  id: testimonialsRotatorMeta.id,  label: testimonialsRotatorMeta.label,  node: <TestimonialsRotator content={effective} /> },
        { name: 'TestimonialsMarquee',  id: testimonialsMarqueeMeta.id,  label: testimonialsMarqueeMeta.label,  node: <TestimonialsMarquee content={effective} /> },
      ],
    },
    {
      id: 'finalCta',
      label: 'Final CTA',
      iconName: 'Megaphone',
      variants: [
        { name: 'FinalCtaBanner',   id: finalCtaBannerMeta.id,   label: finalCtaBannerMeta.label,   node: <FinalCtaBanner content={effective} /> },
        { name: 'FinalCtaSimple',   id: finalCtaSimpleMeta.id,   label: finalCtaSimpleMeta.label,   node: <FinalCtaSimple content={effective} /> },
        { name: 'FinalCtaSplit',    id: finalCtaSplitMeta.id,    label: finalCtaSplitMeta.label,    node: <FinalCtaSplit content={effective} /> },
        { name: 'FinalCtaGradient', id: finalCtaGradientMeta.id, label: finalCtaGradientMeta.label, node: <FinalCtaGradient content={effective} /> },
      ],
    },
    {
      id: 'contact',
      label: 'Contact',
      iconName: 'Phone',
      variants: [
        { name: 'ContactSplit',        id: 'contact-split',             label: 'Contact / Split form + details', node: <ContactSplit content={effective} /> },
        { name: 'CtaBanner',           id: 'cta-banner',                label: 'CTA / Banner with quick form',   node: <CtaBanner content={effective} /> },
        { name: 'ContactCardOverlap',  id: contactCardOverlapMeta.id,   label: contactCardOverlapMeta.label,     node: <ContactCardOverlap content={effective} /> },
        { name: 'ContactInlineStrip',  id: contactInlineStripMeta.id,   label: contactInlineStripMeta.label,     node: <ContactInlineStrip content={effective} /> },
      ],
    },
    {
      id: 'footer',
      label: 'Footer',
      iconName: 'Article',
      variants: [
        { name: 'FooterColumns',  id: footerColumnsMeta.id,  label: footerColumnsMeta.label,  node: <FooterColumns content={effective} /> },
        { name: 'FooterMinimal',  id: footerMinimalMeta.id,  label: footerMinimalMeta.label,  node: <FooterMinimal content={effective} /> },
        { name: 'FooterBrandCta', id: footerBrandCtaMeta.id, label: footerBrandCtaMeta.label, node: <FooterBrandCta content={effective} /> },
        { name: 'FooterMega',     id: footerMegaMeta.id,     label: footerMegaMeta.label,     node: <FooterMega content={effective} /> },
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
          node: (
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
  ], [effective]);

  return (
    <StudioApp
      categories={categories}
      vertical={vertical}
      onVerticalChange={setVertical}
      effective={effective}
      setField={setField}
      imported={imported}
      onImport={importSite}
      onClearImport={clearImport}
      onResetEdits={resetEdits}
    />
  );
}
