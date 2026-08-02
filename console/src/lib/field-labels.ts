/**
 * Human labels for intake field paths.
 *
 * Extracted from MissingFieldQueue when the intake grew a review rail: the rail and the
 * field list both name the same paths, and two copies of this table would drift the moment
 * someone renamed a label in one of them.
 *
 * The keys double as the curated "fields that matter" set. They are the ones worth showing
 * in the intake at all — everything else is edited in the Studio, on the live page, where it
 * has context.
 */
export const LABELS: Record<string, string> = {
  'brand.name': 'Business name',
  'brand.short': 'Short name',
  'brand.phone': 'Phone number',
  'brand.email': 'Email address',
  'brand.address': 'Street address',
  'brand.hours': 'Business hours',
  'brand.tagline': 'Tagline',
  'hero.headline': 'Hero headline',
  'hero.subhead': 'Hero subheadline',
  'about.body': 'About copy',
  'seo.title': 'SEO title',
  'seo.description': 'SEO description',
  'seo.canonical': 'Canonical URL',
};

/** Every curated path, in table order — the "All fields" group. */
export const KEY_FIELDS: string[] = Object.keys(LABELS);

/** Long-form paths get a textarea; everything else a single-line input. */
export const LONG = /(body|description|subhead|blurb|bio|summary|answer|tagline)$/i;

export function sectionOf(path: string): string {
  const head = path.split('.')[0];
  return head.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

/**
 * A readable label for a path. Falls back to a humanized tail so a schema field added later
 * degrades to something legible instead of a raw dotted path.
 */
export function labelOf(path: string): string {
  if (LABELS[path]) return LABELS[path];
  const tail = path.split('.').pop() ?? path;
  return tail.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

/** DOM id for a field row, so the rail can scroll the main column to it. */
export const fieldAnchorId = (path: string) => `field-${path.replace(/[^\w-]/g, '-')}`;
