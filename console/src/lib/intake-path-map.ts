/**
 * intake-form path → SiteContent path, for `_meta.missing_fields`.
 *
 * `missing_fields` is populated at intake time (mapBrandIntakeToIntake /
 * mapPayloadToSchema, @jdd/schema) with paths from the ONBOARDING FORM's own shape —
 * "business.industry", "branding.logo" — which is not the same tree as SiteContent. A path
 * like "brand.phone" happens to be spelled the same in both and needs no translation; a path
 * like "business.industry" has no SiteContent equivalent worth editing as a text field at all
 * (the real answer lives on the vertical picker, not a form field). See lib/flags.ts for the
 * companion "is this path flagged" helpers — this module only does path translation.
 *
 * Kept deliberately separate from field-labels.ts: that file's KEY_FIELDS are already
 * correct, hand-picked SiteContent paths for the curated "All fields" section. This module
 * exists for the OTHER list — whatever the intake actually flagged — which may contain paths
 * that were never SiteContent paths to begin with.
 */

export interface IntakeFieldMapping {
  /** The flagged intake-form path, verbatim from _meta.missing_fields. */
  formPath: string;
  /** The equivalent SiteContent path, or null when there isn't a single-field equivalent. */
  contentPath: string | null;
  /** Shown when contentPath is null, so the row still says something useful. */
  note?: string;
}

/**
 * Every intake-form path @jdd/schema's mappers are known to emit into `missing_fields`
 * (brand-intake.ts buildScaffold flags list, plus the legacy map.ts basic-mode dump). Paths
 * not listed here are assumed to already be valid SiteContent paths (most are — the two
 * trees share names for plain brand facts like "brand.phone").
 */
const FORM_PATH_MAP: Record<string, string | null> = {
  'business.industry': null,
  'branding.logo': 'images.footer.logoImage',
  'images.hero': null,
  'services.items': null,
  'existingWebsiteUrl': null,
  'social.linkedin': null,
  'hero.bullets': 'hero.heroBullets',
};

const UNMAPPABLE_NOTES: Record<string, string> = {
  'business.industry': "Set on the vertical picker, not as a text field.",
  'images.hero': 'Add hero photos from the Studio image picker.',
  'services.items': 'Edit the service list from the Studio, not as a single field.',
  'existingWebsiteUrl': "The client didn't provide an existing site to scan.",
  'social.linkedin': 'No LinkedIn field exists on the built site yet.',
};

/**
 * Resolve one flagged path to a SiteContent path, or to null with an explanatory note.
 *
 * A path not in FORM_PATH_MAP is passed through unchanged — most flagged paths (brand.phone,
 * brand.email, brand.address, brand.license, brand.established, seo.canonical) are already
 * spelled identically in both trees and need no translation.
 */
export function mapIntakePath(formPath: string): IntakeFieldMapping {
  if (!(formPath in FORM_PATH_MAP)) {
    return { formPath, contentPath: formPath };
  }
  const contentPath = FORM_PATH_MAP[formPath];
  return {
    formPath,
    contentPath,
    note: contentPath === null ? UNMAPPABLE_NOTES[formPath] : undefined,
  };
}

/** Map a whole `_meta.missing_fields` array, in order, de-duplicating on contentPath. */
export function mapIntakePaths(formPaths: string[]): IntakeFieldMapping[] {
  const seen = new Set<string>();
  const out: IntakeFieldMapping[] = [];
  for (const p of formPaths) {
    const mapping = mapIntakePath(p);
    const key = mapping.contentPath ?? `unmappable:${mapping.formPath}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(mapping);
  }
  return out;
}
