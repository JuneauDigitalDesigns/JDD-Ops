// Prop-driven visual skins for catalog variants. Pure data + a class resolver;
// safe to import from both client components and the server-side export helpers.
export type SkinId = 'editorial' | 'contrast' | 'quiet';
export type SkinDef = { id: SkinId; label: string };

const ED: SkinDef = { id: 'editorial', label: 'Editorial' };
const CT: SkinDef = { id: 'contrast', label: 'Contrast' };
const QT: SkinDef = { id: 'quiet', label: 'Quiet' };

// Skins offered per component (by component name). A single-entry list hides the toggle.
// Mirrored by the export validation (isValidSkin).
export const SKINS: Record<string, SkinDef[]> = {
  // hero
  HeroSplit: [ED, CT, QT], HeroCentered: [ED, CT], HeroFormFocus: [ED, QT],
  // nav
  NavMinimal: [ED, CT, QT], NavSplitCta: [ED, CT], NavEmergencyBar: [CT, ED],
  // trust
  TrustMarquee: [ED, CT, QT], TrustReviewsAggregate: [ED, CT], TrustLicenseInsurance: [ED, CT],
  // about
  AboutFeature: [ED, CT, QT], AboutStory: [ED, QT], AboutStatBand: [CT, ED],
  // services
  ServicesShowcase: [ED, CT, QT], ServicesGrid: [ED, CT], ServicesSpotlight: [ED, CT, QT],
  // work
  WorkSpotlight: [ED, CT, QT], WorkGrid: [ED, CT], WorkCarousel: [ED, QT],
  // testimonials
  TestimonialsRotator: [ED, CT, QT], TestimonialsGrid: [ED, CT], TestimonialsMarquee: [ED, QT],
  // faq
  FaqAccordion: [ED, CT, QT], FaqTwoColumn: [ED, CT], FaqStickyAside: [ED, QT],
  // finalCta
  FinalCtaSplit: [ED, CT], FinalCtaGradient: [CT, ED], FinalCtaQuote: [CT, ED, QT],
  // contact
  ContactSplit: [ED, CT, QT], ContactCardOverlap: [ED, CT], ContactInlineStrip: [ED, CT],
  // footer
  FooterColumns: [ED, CT], FooterBrandCta: [CT, ED], FooterMinimal: [ED, CT, QT],
  // seo has no skins
};

export function skinsFor(name: string): SkinDef[] {
  return SKINS[name] ?? [ED];
}
export function defaultSkin(name: string): SkinId {
  return skinsFor(name)[0].id;
}
export function isValidSkin(name: string, skin: string): boolean {
  return skinsFor(name).some((s) => s.id === skin);
}

/**
 * True only for components that actually declare a `skin` prop (i.e. listed in SKINS).
 * `skinsFor` falls back to a synthetic single-entry list for every other component so the
 * UI has a safe default to reason about — but that fallback must never be baked into an
 * export as a literal `skin="..."` JSX attribute, since those components don't accept one
 * and the client repo's TypeScript build would fail on the excess prop.
 */
export function supportsSkin(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(SKINS, name);
}

export type SkinClasses = {
  section: string;
  heading: string;
  body: string;
  eyebrow: string;
  rule: string;
  card: string;
  cardRule: string;
};

/** Shared surface + typography treatment per skin; components compose these with their own layout. */
export function skinClasses(skin: SkinId): SkinClasses {
  switch (skin) {
    case 'contrast':
      return {
        section: 'bg-inkPanel text-onInk',
        heading: 'text-onInk',
        body: 'text-onInkSoft',
        eyebrow: 'text-accent200',
        rule: 'border-ruleInk',
        card: 'bg-inkPanel2',
        cardRule: 'border-ruleInk',
      };
    case 'quiet':
      return {
        section: 'bg-bg text-ink',
        heading: 'text-ink',
        body: 'text-inkSoft',
        eyebrow: 'text-inkSoft',
        rule: 'border-rule',
        card: 'bg-bgSoft',
        cardRule: 'border-rule',
      };
    case 'editorial':
    default:
      return {
        section: 'bg-bg text-ink',
        heading: 'text-ink',
        body: 'text-inkSoft',
        eyebrow: 'text-accent',
        rule: 'border-rule',
        card: 'bg-bgSoft',
        cardRule: 'border-rule',
      };
  }
}
