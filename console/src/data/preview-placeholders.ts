// Preview-only image placeholders for the studio build catalog.
//
// Several catalog components render nothing (Work) or fall back to gray numeral
// tiles (services/testimonials) when the effective content carries no imagery —
// and the vertical presets intentionally ship empty work/service/avatar images.
// To make the *builder preview* look real, `injectImagePlaceholders` fills those
// empty (or preset-picsum) image slots with per-vertical curated topical stock.
//
// IMPORTANT: this is preview-only. The transform is applied to a copy that is fed
// solely to `buildCategories` (see BuildWizard). Export continues to serialize the
// untouched `effective`, so none of these placeholder URLs ever reach a client
// site. A slot becomes "real" only when the user sets an image in the BrandDrawer
// (a present, non-picsum value), which this transform then leaves untouched.
//
// All URLs below were fetched from Unsplash's public search API and verified to
// return HTTP 200. They are free `images.unsplash.com` photos (no Unsplash+),
// hotlinked like the presets' existing picsum images. To swap in different photos,
// just edit the id in `img()` / `avatar()` — the shape is a plain table.

import type { SiteContent, Project } from '@/data/site';
import type { VerticalId } from '@/lib/verticals';
import { isPresent } from '@/lib/merge';

type Img = { url: string; alt: string };

/** Build a stable, cropped Unsplash CDN URL for a content image. */
const img = (id: string, alt: string): Img => ({
  url: `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`,
  alt,
});

/** Build a square Unsplash CDN URL for a testimonial avatar. */
const avatar = (id: string): string =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=200&h=200&q=80`;

export type PreviewImageSet = {
  heroSlides: Img[];        // fills images.hero.slides
  aboutFeature: Img;        // fills images.about.feature
  serviceImages: Img[];     // cycled across services.items[].image
  workProjects: Project[];  // injected wholesale when work.projects is empty
};

// Shared, vertical-agnostic headshots for testimonial avatars.
export const PLACEHOLDER_AVATARS: string[] = [
  avatar('1580489944761-15a19d654956'),
  avatar('1506863530036-1efeddceb993'),
  avatar('1438761681033-6461ffad8d80'),
];

// Each vertical draws from four verified topical photos (A–D), reused across
// hero / about / services / work so a section shows distinct images.
export const PREVIEW_PLACEHOLDERS: Record<VerticalId, PreviewImageSet> = {
  hvac: {
    heroSlides: [
      img('1615309662243-70f6df917b59', 'HVAC technician servicing a system'),
      img('1718203862467-c33159fdc504', 'Air conditioning unit installation'),
    ],
    aboutFeature: img('1698479603408-1a66a6d9e80f', 'HVAC team on the job'),
    serviceImages: [
      img('1615309662243-70f6df917b59', 'Heating and cooling service'),
      img('1718203862467-c33159fdc504', 'AC installation'),
      img('1698479603408-1a66a6d9e80f', 'System maintenance'),
      img('1614447413576-b346c641c128', 'Ductwork and air quality'),
    ],
    workProjects: [
      { t: 'Full System Replacement', loc: 'Riverside, CA', yr: '2024', scope: 'Install', size: '3-ton heat pump', caption: 'Complete HVAC changeout', image: img('1614447413576-b346c641c128', 'New HVAC system installed') },
      { t: 'Emergency Furnace Repair', loc: 'Fontana, CA', yr: '2024', scope: 'Repair', size: 'Same-day service', caption: 'Winter no-heat call', image: img('1615309662243-70f6df917b59', 'Furnace repair in progress') },
      { t: 'Ductwork Overhaul', loc: 'Ontario, CA', yr: '2023', scope: 'Ductwork', size: '2,400 sq ft home', caption: 'Full duct replacement & sealing', image: img('1718203862467-c33159fdc504', 'Ductwork replacement') },
      { t: 'Heat Pump Upgrade', loc: 'Rancho Cucamonga, CA', yr: '2023', scope: 'Install', size: 'Dual-zone', caption: 'High-efficiency heat pump', image: img('1698479603408-1a66a6d9e80f', 'Heat pump upgrade') },
      { t: 'Seasonal Maintenance Plan', loc: 'Chino, CA', yr: '2023', scope: 'Maintenance', size: 'Annual contract', caption: 'Pre-season tune-up', image: img('1614447413576-b346c641c128', 'HVAC maintenance visit') },
    ],
  },
  roofing: {
    heroSlides: [
      img('1635424824849-1b09bdcc55b1', 'Roofers installing shingles'),
      img('1643225523483-e2c434191bba', 'New roof on a home'),
    ],
    aboutFeature: img('1635424709845-3a85ad5e1f5e', 'Roofing crew at work'),
    serviceImages: [
      img('1635424824849-1b09bdcc55b1', 'Roof replacement'),
      img('1643225523483-e2c434191bba', 'Shingle installation'),
      img('1635424709845-3a85ad5e1f5e', 'Roof repair'),
      img('1726589004565-bedfba94d3a2', 'Roof inspection'),
    ],
    workProjects: [
      { t: 'Complete Roof Replacement', loc: 'Austin, TX', yr: '2024', scope: 'Re-roof', size: '2,800 sq ft', caption: 'Architectural shingle tear-off & install', image: img('1726589004565-bedfba94d3a2', 'Completed roof replacement') },
      { t: 'Storm Damage Restoration', loc: 'Round Rock, TX', yr: '2024', scope: 'Repair', size: 'Insurance claim', caption: 'Hail impact restoration', image: img('1635424824849-1b09bdcc55b1', 'Storm damage roof repair') },
      { t: 'Metal Roof Install', loc: 'Cedar Park, TX', yr: '2023', scope: 'Install', size: 'Standing seam', caption: '40-year standing-seam system', image: img('1643225523483-e2c434191bba', 'Metal roof installation') },
      { t: 'Gutter & Fascia Replacement', loc: 'Pflugerville, TX', yr: '2023', scope: 'Exterior', size: 'Full perimeter', caption: 'Seamless gutter system', image: img('1635424709845-3a85ad5e1f5e', 'Gutter replacement') },
      { t: 'Flat Roof Recoat', loc: 'Georgetown, TX', yr: '2022', scope: 'Commercial', size: '6,000 sq ft', caption: 'TPO membrane recoat', image: img('1726589004565-bedfba94d3a2', 'Flat roof recoat') },
    ],
  },
  plumbing: {
    heroSlides: [
      img('1676210134188-4c05dd172f89', 'Plumber working on pipes'),
      img('1542013936693-884638332954', 'Plumbing repair under sink'),
    ],
    aboutFeature: img('1558618666-fcd25c85cd64', 'Plumbing service call'),
    serviceImages: [
      img('1676210134188-4c05dd172f89', 'Pipe repair'),
      img('1542013936693-884638332954', 'Fixture installation'),
      img('1558618666-fcd25c85cd64', 'Bathroom plumbing'),
      img('1676210133055-eab6ef033ce3', 'Water heater service'),
    ],
    workProjects: [
      { t: 'Whole-Home Repipe', loc: 'Denver, CO', yr: '2024', scope: 'Repipe', size: 'PEX, 3 bath', caption: 'Copper-to-PEX conversion', image: img('1676210133055-eab6ef033ce3', 'Whole-home repipe') },
      { t: 'Tankless Water Heater Swap', loc: 'Aurora, CO', yr: '2024', scope: 'Install', size: 'On-demand unit', caption: 'Tankless upgrade', image: img('1676210134188-4c05dd172f89', 'Tankless water heater install') },
      { t: 'Sewer Line Replacement', loc: 'Lakewood, CO', yr: '2023', scope: 'Excavation', size: '60 ft run', caption: 'Trenchless sewer repair', image: img('1542013936693-884638332954', 'Sewer line replacement') },
      { t: 'Bathroom Remodel Rough-In', loc: 'Littleton, CO', yr: '2023', scope: 'Remodel', size: 'Full bath', caption: 'New supply & drain lines', image: img('1558618666-fcd25c85cd64', 'Bathroom plumbing rough-in') },
      { t: 'Slab Leak Repair', loc: 'Centennial, CO', yr: '2022', scope: 'Repair', size: 'Emergency', caption: 'Located & repaired slab leak', image: img('1676210133055-eab6ef033ce3', 'Slab leak repair') },
    ],
  },
  'lawn-care': {
    heroSlides: [
      img('1558904541-efa843a96f01', 'Freshly mowed green lawn'),
      img('1458245201577-fc8a130b8829', 'Landscaped garden beds'),
    ],
    aboutFeature: img('1734303023491-db8037a21f09', 'Lawn care crew at work'),
    serviceImages: [
      img('1558904541-efa843a96f01', 'Lawn mowing'),
      img('1458245201577-fc8a130b8829', 'Garden landscaping'),
      img('1734303023491-db8037a21f09', 'Seasonal maintenance'),
      img('1605117882932-f9e32b03fea9', 'Irrigation and sod'),
    ],
    workProjects: [
      { t: 'Full Yard Renovation', loc: 'Raleigh, NC', yr: '2024', scope: 'Landscape', size: 'Quarter acre', caption: 'Sod, beds & irrigation', image: img('1605117882932-f9e32b03fea9', 'Renovated yard') },
      { t: 'Seasonal Maintenance Program', loc: 'Cary, NC', yr: '2024', scope: 'Maintenance', size: 'Weekly service', caption: 'Year-round lawn health', image: img('1558904541-efa843a96f01', 'Maintained lawn') },
      { t: 'Irrigation System Install', loc: 'Durham, NC', yr: '2023', scope: 'Irrigation', size: '6-zone system', caption: 'Smart controller setup', image: img('1458245201577-fc8a130b8829', 'Irrigation install') },
      { t: 'Hardscape & Patio Build', loc: 'Apex, NC', yr: '2023', scope: 'Hardscape', size: '400 sq ft paver patio', caption: 'Paver patio & retaining wall', image: img('1734303023491-db8037a21f09', 'Paver patio build') },
      { t: 'Tree & Shrub Care Program', loc: 'Morrisville, NC', yr: '2022', scope: 'Maintenance', size: 'Full property', caption: 'Seasonal pruning & feeding', image: img('1605117882932-f9e32b03fea9', 'Tree and shrub care') },
    ],
  },
  'car-detailing': {
    heroSlides: [
      img('1567808291548-fc3ee04dbcf0', 'Car being detailed'),
      img('1508974239320-0a029497e820', 'Glossy detailed car exterior'),
    ],
    aboutFeature: img('1485291571150-772bcfc10da5', 'Detailer polishing a car'),
    serviceImages: [
      img('1567808291548-fc3ee04dbcf0', 'Exterior detail'),
      img('1508974239320-0a029497e820', 'Paint correction'),
      img('1485291571150-772bcfc10da5', 'Interior detail'),
      img('1633014041037-f5446fb4ce99', 'Ceramic coating'),
    ],
    workProjects: [
      { t: 'Full Ceramic Coating', loc: 'Scottsdale, AZ', yr: '2024', scope: 'Coating', size: '9H, 5-year', caption: 'Paint correction + ceramic', image: img('1633014041037-f5446fb4ce99', 'Ceramic-coated car') },
      { t: 'Interior Deep Detail', loc: 'Tempe, AZ', yr: '2024', scope: 'Interior', size: 'Full restoration', caption: 'Steam & leather recondition', image: img('1567808291548-fc3ee04dbcf0', 'Interior detailing') },
      { t: 'Two-Stage Paint Correction', loc: 'Mesa, AZ', yr: '2023', scope: 'Correction', size: 'Full exterior', caption: 'Swirl & scratch removal', image: img('1508974239320-0a029497e820', 'Corrected paint finish') },
      { t: 'Show Car Prep Detail', loc: 'Chandler, AZ', yr: '2023', scope: 'Detail', size: 'Concours-level', caption: 'Full show-ready detail', image: img('1485291571150-772bcfc10da5', 'Show car detail') },
      { t: 'Fleet Wash Program', loc: 'Gilbert, AZ', yr: '2022', scope: 'Fleet', size: '12-vehicle fleet', caption: 'Recurring fleet maintenance', image: img('1567808291548-fc3ee04dbcf0', 'Fleet vehicle wash') },
    ],
  },
  health: {
    heroSlides: [
      img('1600334089648-b0d9d3028eb2', 'Calm spa and wellness space'),
      img('1544843776-7c98a52e08a4', 'Wellness treatment room'),
    ],
    aboutFeature: img('1488345979593-09db0f85545f', 'Wellness and relaxation'),
    serviceImages: [
      img('1600334089648-b0d9d3028eb2', 'Wellness treatment'),
      img('1544843776-7c98a52e08a4', 'Spa services'),
      img('1488345979593-09db0f85545f', 'Relaxation therapy'),
      img('1583417267826-aebc4d1542e1', 'Health & wellness care'),
    ],
    workProjects: [
      { t: 'Signature Wellness Program', loc: 'Portland, OR', yr: '2024', scope: 'Program', size: '12-week plan', caption: 'Personalized care plan', image: img('1583417267826-aebc4d1542e1', 'Wellness program session') },
      { t: 'Treatment Suite Launch', loc: 'Beaverton, OR', yr: '2024', scope: 'Facility', size: 'New suite', caption: 'Relaxation-first redesign', image: img('1600334089648-b0d9d3028eb2', 'New treatment suite') },
      { t: 'Group Wellness Retreat', loc: 'Lake Oswego, OR', yr: '2023', scope: 'Event', size: '20 guests', caption: 'Restorative weekend', image: img('1544843776-7c98a52e08a4', 'Wellness retreat') },
      { t: 'Corporate Wellness Series', loc: 'Hillsboro, OR', yr: '2023', scope: 'Program', size: '8-week series', caption: 'On-site workplace wellness', image: img('1488345979593-09db0f85545f', 'Corporate wellness session') },
      { t: 'Therapeutic Massage Package', loc: 'Tigard, OR', yr: '2022', scope: 'Treatment', size: 'Monthly plan', caption: 'Recovery-focused bodywork', image: img('1600334089648-b0d9d3028eb2', 'Therapeutic massage') },
    ],
  },
};

/** A slot needs a placeholder if it's empty or still holds a preset picsum seed. */
function needsPlaceholder(v: unknown): boolean {
  if (typeof v === 'string' && v.includes('picsum.photos')) return true;
  return !isPresent(v);
}

/**
 * Return a deep copy of `effective` with empty/preset-picsum image slots filled
 * from the vertical's curated set. Preview-only: never merge this into the
 * content that gets exported. Genuine client images (present, non-picsum) are
 * always preserved.
 */
export function injectImagePlaceholders(effective: SiteContent, vertical: VerticalId): SiteContent {
  const set = PREVIEW_PLACEHOLDERS[vertical] ?? PREVIEW_PLACEHOLDERS.hvac;
  const c: SiteContent =
    typeof structuredClone === 'function'
      ? structuredClone(effective)
      : (JSON.parse(JSON.stringify(effective)) as SiteContent);

  // Ensure the images container exists (schema guarantees it, but be defensive).
  c.images = c.images ?? { hero: {}, about: {}, testimonials: {}, footer: {} };
  c.images.hero = c.images.hero ?? {};
  c.images.about = c.images.about ?? {};
  c.images.testimonials = c.images.testimonials ?? {};
  c.images.footer = c.images.footer ?? {};

  // Hero slides — fill each slot that's empty or picsum, keeping any real alt.
  const slides = [...(c.images.hero.slides ?? [])];
  set.heroSlides.forEach((ph, i) => {
    if (needsPlaceholder(slides[i]?.url)) {
      slides[i] = { url: ph.url, alt: slides[i]?.alt || ph.alt };
    }
  });
  c.images.hero.slides = slides;

  // About feature image.
  if (needsPlaceholder(c.images.about.feature)) {
    c.images.about.feature = set.aboutFeature.url;
  }

  // Service item images — cycle the curated set across items lacking an image.
  if (Array.isArray(c.services?.items)) {
    c.services.items = c.services.items.map((it, i) => {
      if (needsPlaceholder(it.image?.url)) {
        const ph = set.serviceImages[i % set.serviceImages.length];
        return { ...it, image: { url: ph.url, alt: it.image?.alt || ph.alt } };
      }
      return it;
    });
  }

  // Work projects — only when there are none. Reveal the section for preview and
  // inject the vertical's full sample projects so all four Work variants render.
  if (!c.work?.projects?.length) {
    c.work = { ...c.work, hidden: false, projects: set.workProjects.map((p) => ({ ...p })) };
  }

  // Testimonial avatars — only when none are set.
  if (!isPresent(c.images.testimonials.avatars)) {
    c.images.testimonials.avatars = [...PLACEHOLDER_AVATARS];
  }

  return c;
}
