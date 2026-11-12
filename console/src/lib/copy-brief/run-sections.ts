/**
 * What a copy run is asked for, and what it reports back about anything it did not write.
 *
 * The bug this fixes (Tracewell Heating & Air, 2026-11-11, finding 5 of the front-to-back
 * onboarding test). The run box lists "Page headers" under "Other pages", so the operator believed
 * the Services, About and Contact headers and their SEO were written. They never were: the Generate
 * button posted no page list, and /api/build/generate-copy drops `subpages` when it gets none. The
 * drop was silent, the section's status stayed blank, and the Launch dialog's SEO check found every
 * subpage described by the 32-character tagline, the same on all three.
 *
 * So: the request carries the page list (copyRequestBody, used by both Generate and the estimate),
 * and every section the route will not write is named with a reason (planRunSections), so a dropped
 * section can never look done.
 *
 * Pure, no React, so the request body and the plan are tested without a browser or a model.
 */
import type { CopyBrief } from '@jdd/schema';
import type { SiteContent } from '@/data/site';
import type { Section } from '@/lib/copy-schema';

/** A page of the live composition, as the copy run needs it. */
export type CopyPage = { route: string; pageType: string; label: string };

/** A section the run did not write (or did not write in full), and why, in the operator's words. */
export type SkippedSection = { section: Section; reason: string };

/**
 * The pages the `subpages` section writes a header and SEO for: every page but Home and the
 * per-service pages. A service page's header renders that service (export.ts passes the slug, not
 * `subpages[route].header`), and its body copy is the `servicePages` section.
 */
export function copyPages(pages: CopyPage[]): CopyPage[] {
  return pages
    .filter((p) => p.route !== '' && p.pageType !== 'home' && p.pageType !== 'service')
    .map((p) => ({ route: p.route, pageType: p.pageType, label: p.label }));
}

/** The body Generate and the estimate post. One builder, so the two can never send different runs. */
export function copyRequestBody(input: {
  vertical: string;
  base: SiteContent;
  imported: SiteContent | null;
  edits: Record<string, unknown>;
  brief: CopyBrief;
  sections: Section[];
  model: string;
  pages: CopyPage[];
}) {
  const { vertical, base, imported, edits, brief, sections, model, pages } = input;
  return { vertical, base, imported, edits, brief, sections, model, subpages: copyPages(pages) };
}

/** The reasons shown in the run box. Wording pending Xander's approval (PR description). */
export const SKIP_REASONS = {
  noPages: 'Not written: this site has no pages besides Home.',
  noServicePages: 'Not written: no service has its own page.',
  // The two town reasons are PR #101 items 12 and 13, approved word for word by Xander on 2026-11-12.
  noTownPages: 'Not written: no town has enough of its own facts for a page.',
  noTownServicePages: 'Not written: no town and service page is approved with enough facts.',
  unreported: 'Not written: the copy service skipped it.',
  nothingToWrite: 'Nothing was written: no section switched on can be written for this site.',
  missingRoutes: (routes: string[]) => `Not written for ${routes.map((r) => `/${r}`).join(', ')}: missing from the reply.`,
} as const;

/**
 * Which of the requested sections the route will write, and which it drops and why. `requested`
 * empty means every section (the route's long-standing default).
 */
export function planRunSections(input: {
  requested: Section[];
  all: Section[];
  subpages: CopyPage[];
  hasServicePages: boolean;
  /** lib/townPages.ts: a town earns /areas/<town>; an approved town + service page passes. */
  hasTownPages?: boolean;
  hasTownServicePages?: boolean;
}): { sections: Section[]; skipped: SkippedSection[] } {
  const explicit = input.requested.length > 0;
  const asked = explicit ? input.requested : input.all.filter((s) => s !== 'brand');
  const sections: Section[] = [];
  const skipped: SkippedSection[] = [];
  for (const s of asked) {
    if (s === 'subpages' && input.subpages.length === 0) {
      // Only reported when the operator switched it on; the all-sections default isn't a request.
      if (explicit) skipped.push({ section: s, reason: SKIP_REASONS.noPages });
    } else if (s === 'servicePages' && !input.hasServicePages) {
      if (explicit) skipped.push({ section: s, reason: SKIP_REASONS.noServicePages });
    } else if (s === 'townPages' && !input.hasTownPages) {
      if (explicit) skipped.push({ section: s, reason: SKIP_REASONS.noTownPages });
    } else if (s === 'townServicePages' && !input.hasTownServicePages) {
      if (explicit) skipped.push({ section: s, reason: SKIP_REASONS.noTownServicePages });
    } else {
      sections.push(s);
    }
  }
  return { sections, skipped };
}

/** "services", "/services/" and " services " are one route. */
export const normalizeRoute = (route: string) => route.trim().replace(/^\/+|\/+$/g, '');

/** The requested pages the model's `subpages` reply has no usable item for. */
export function missingSubpageRoutes(
  subpages: CopyPage[],
  reply: { items?: { route?: string; title?: string }[] } | undefined,
): string[] {
  const got = new Set(
    (reply?.items ?? []).filter((it) => it?.route && it.title?.trim()).map((it) => normalizeRoute(String(it.route))),
  );
  return subpages.map((p) => p.route).filter((r) => !got.has(normalizeRoute(r)));
}

/**
 * The switched-on sections a finished run said nothing about. The route reports every section it
 * writes, fails or drops, so this is empty today; it is what keeps a section the route drops in some
 * future way from sitting in the box with no status, which reads as written.
 */
export function unreportedSections(ticked: Section[], statuses: Record<string, string>, switchable: Section[]): Section[] {
  const on = new Set(ticked);
  return switchable.filter((s) => on.has(s) && (statuses[s] === undefined || statuses[s] === 'idle'));
}
