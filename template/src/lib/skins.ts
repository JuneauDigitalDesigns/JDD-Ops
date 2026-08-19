// Prop-driven visual skins for catalog variants. Pure data + a class resolver;
// safe to import from both client components and the server-side export helpers.
/* SURFACE ROLES (`default` | `soft` | `inverted`) are replacing the old design-attitude
   names (`editorial` | `contrast` | `quiet`). A role says where a section sits in the page
   rhythm; an attitude said what it should feel like, which stopped being useful once the
   catalog stopped being editorial. See design/catalog-v2/SPEC.md §1.

   Both sets are live ON PURPOSE, and this is temporary. Components are being recomposed a
   few at a time, so the 19 that still expect `editorial` must keep working while the
   recomposed ones use roles. Delete the old three once nothing references them — and expect
   every existing client to fall back to the default surface when you do, because
   `isValidSkin` drops values it no longer recognises (studio-readback.ts:99). That reset is
   accepted; it is not a bug to chase. */
export type SkinId = 'editorial' | 'contrast' | 'quiet' | 'default' | 'soft' | 'inverted';
export type SkinDef = { id: SkinId; label: string };

const ED: SkinDef = { id: 'editorial', label: 'Editorial' };
const CT: SkinDef = { id: 'contrast', label: 'Contrast' };
const QT: SkinDef = { id: 'quiet', label: 'Quiet' };

const DEF: SkinDef = { id: 'default', label: 'Default' };
const SOFT: SkinDef = { id: 'soft', label: 'Soft' };
const INV: SkinDef = { id: 'inverted', label: 'Inverted' };

// Skins offered per component (by component name). A single-entry list hides the toggle.
// Mirrored by the export validation (isValidSkin).
export const SKINS: Record<string, SkinDef[]> = {
  // hero
  HeroSplit: [DEF, INV], HeroFormFocus: [ED, QT],
  // nav
  NavMinimal: [DEF, INV], NavEmergencyBar: [CT, ED],
  // trust
  TrustReviewsAggregate: [ED, CT],
  // about
  AboutFeature: [ED, CT, QT], AboutStory: [ED, QT],
  // services
  ServicesGrid: [ED, CT],
  // work (reframed as recent jobs)
  BeforeAfter: [ED, CT, QT], RecentJobsGrid: [ED, CT],
  // testimonials
  TestimonialsGrid: [ED, CT],
  // faq
  FaqAccordion: [ED, CT, QT], FaqStickyAside: [ED, QT],
  // finalCta
  FinalCtaSplit: [ED, CT],
  // contact
  ContactSplit: [ED, CT, QT], ContactCardOverlap: [ED, CT], ContactInlineStrip: [SOFT, INV],
  // footer
  FooterColumns: [ED, CT], FooterMinimal: [ED, CT, QT],
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
    /* ── surface roles ────────────────────────────────────────────────────────
       `soft` is the alternating band. It has no old-name equivalent: the old set
       had no way to say "same colours, one step back" so sections were separated
       by hairline rules instead, which is what the recomposition removes. */
    case 'soft':
      return {
        section: 'bg-bgSoft text-ink',
        heading: 'text-ink',
        body: 'text-inkSoft',
        eyebrow: 'text-accent',
        rule: 'border-rule',
        card: 'bg-bg',
        cardRule: 'border-rule',
      };
    case 'inverted':
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
