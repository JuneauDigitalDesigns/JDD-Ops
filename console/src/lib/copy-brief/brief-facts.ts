/**
 * briefFactsText: the facts the copywriter was given, as one string, for scorePage's "is this
 * number in the client's facts" check. The brief is where the operator states things the site
 * content has no field for (a promotion, a custom fact), so a check that reads only the content
 * refuses every number the operator supplied (2026-11-11: "$50 off your first service", 11 fields).
 *
 * CLIENT-SAFE: the Studio computes it (BuildWizard) and posts it with the export, so the SEO
 * panel and the export score against the same text.
 */
import { BUILT_IN_VERTICALS, type CopyBrief } from '@jdd/schema';
import type { SiteContent } from '@/data/site';
import { presetFor, type VerticalId } from '@/lib/verticals';
import { resolveBrief } from './resolve';
import { briefFactSegments } from './compile-brief';
import type { BriefContext } from './types';

export function briefFactsText(ctx: BriefContext): string {
  return briefFactSegments(ctx, resolveBrief(ctx)).map((s) => s.text).join('\n\n');
}

/** The same, from the Studio's state. The fact paragraphs don't depend on which sections are
 *  ticked or which pages exist (those shape instructions only), so neither is needed here. */
export function studioBriefFacts(input: {
  vertical: VerticalId;
  effective: SiteContent;
  imported: SiteContent | null;
  edits: Record<string, unknown>;
  brief: CopyBrief;
}): string {
  const vertical = BUILT_IN_VERTICALS.find((v) => v.id === input.vertical) ?? BUILT_IN_VERTICALS[0];
  return briefFactsText({
    vertical,
    effective: input.effective,
    imported: input.imported,
    preset: presetFor(input.vertical),
    edits: input.edits,
    brief: input.brief,
    tickedSections: [],
    subpages: [],
  });
}
