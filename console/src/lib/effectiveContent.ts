/**
 * The Studio's effective content: vertical preset <- imported <- generated <- user edits (top).
 *
 * Lifted out of BuildWizard.tsx unchanged (2026-11-11) so a test can run the exact merge the
 * Studio previews and sends to the export, rather than a copy of it.
 *
 * CLIENT-SAFE: BuildWizard is a 'use client' component.
 */
import type { SiteContent } from '@/data/site';
import { presetFor, type VerticalId } from '@/lib/verticals';
import { deepMerge, applyEdits } from '@/lib/merge';
import { stripSampleReviews } from '@/lib/sampleReviews';
import { stripSampleProjects } from '@/lib/sampleProjects';
import { stripPlaceholderCanonical } from '@/lib/placeholderCanonical';
import { stripPresetIdentity } from '@/lib/presetIdentity';
import { withCopywriterBrandOnly } from '@/lib/copy-schema';
import { withDisplayPhone } from '@/lib/displayPhone';
import { hydrateServiceItems } from '@/lib/service-structure';

export function effectiveContent(
  vertical: VerticalId,
  imported: SiteContent | null,
  generated: Partial<SiteContent> | null,
  edits: Record<string, unknown>,
): SiteContent {
  // Sample reviews, placeholder canonicals and sample business identity (name, legal line,
  // phone, email, address, license, tagline, SEO title and description) fill every gap the client
  // left, and an old run can have baked them into imported or generated content. Strip them AFTER
  // the merge (so the emptied value can't fall through to a preset), here so the preview shows
  // what the export will ship and the copy run's base carries none of them
  // (lib/sampleReviews.ts, lib/placeholderCanonical.ts, lib/presetIdentity.ts).
  // withDisplayPhone, outermost: the phone as the site shows it, (407) 555-0177 with an E.164 tel:,
  // the same as the export writes (lib/displayPhone.ts). Content imported before @jdd/schema
  // 1.33.3 holds bare digits, and an operator may type them.
  // Sample jobs the same way (lib/sampleProjects.ts): an old preset's Clermont, Winter Garden and
  // Groveland jobs sit in imported, generated and edited content alike.
  // The generated layer's brand is cut to the tagline, the one brand field the copywriter
  // writes: a draft generated before 2026-11-11 holds a copy of the whole brand there, which
  // would hide every later correction to the client's name, phone or address (copy-schema.ts).
  const beneath = deepMerge(deepMerge(presetFor(vertical), imported ?? {}), withCopywriterBrandOnly(generated ?? {}));
  const merged = withDisplayPhone(stripPresetIdentity(stripPlaceholderCanonical(
    stripSampleProjects(stripSampleReviews(applyEdits(
      beneath,
      // A services list saved by add or remove holds structure, not card copy: each service's copy
      // comes from the layers beneath, so a later run's text shows (lib/service-structure.ts).
      hydrateServiceItems(edits, beneath),
    )).content).content,
  ).content).content);
  // Work ships hidden+empty in every preset. Once it has projects (added via the Brand
  // drawer, AI copy, or a seed) the section must show — in the preview AND the exported
  // content. Left hidden while empty, so an untouched Work section stays off (and the
  // preview still injects sample projects via fillImagePlaceholders's includeWork).
  if (merged.work?.projects?.length && merged.work.hidden) {
    return { ...merged, work: { ...merged.work, hidden: false } };
  }
  return merged;
}
