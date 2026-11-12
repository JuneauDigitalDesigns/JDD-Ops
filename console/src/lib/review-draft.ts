/**
 * A review being typed on the intake's Reviews step (autosave, Xander 2026-11-10: no Save button,
 * whatever is typed is saved).
 *
 * A review is a real customer's words, so a half-typed one must never reach the site. The draft
 * therefore lives in the wizard's saved bundle (it survives a step change, a reload and a closed
 * tab) and becomes a review by itself the moment it is complete: text, name, source, the link
 * for a public review, and the word-for-word tick. From then on it is that review (`index`), and
 * each further edit writes straight to it while it stays complete.
 */
import { canonicalTown, type SiteContent, type ReviewSource } from '@jdd/schema';

type Review = SiteContent['testimonials']['items'][number];

export interface ReviewDraft {
  source: ReviewSource | '';
  sourceUrl: string;
  a: string;
  stars: number;
  date: string;
  q: string;
  service: string;
  /** The town the review is from: one of the client's towns, or '' (local SEO, 2026-11-12). */
  town: string;
  /** Kept as saved: before `town` existed, the Town box wrote here, and it can hold a company name. */
  company: string;
  verbatim: boolean;
  /** The saved review this draft is, once it has been saved. */
  index: number | null;
}

export const EMPTY_DRAFT: ReviewDraft = {
  source: 'google', sourceUrl: '', a: '', stars: 5, date: '', q: '', service: '', town: '', company: '', verbatim: false, index: null,
};

const NEEDS_LINK = new Set<string>(['google', 'yelp', 'facebook']);

/** What the draft still needs before it is a review, as short neutral labels. Empty = complete. */
export function draftMissing(d: ReviewDraft): string[] {
  const out: string[] = [];
  if (!d.q.trim()) out.push('review text');
  if (!d.a.trim()) out.push('name');
  if (!d.source) out.push('source');
  if (d.source && NEEDS_LINK.has(d.source) && !d.sourceUrl.trim()) out.push('review link');
  if (!d.verbatim) out.push('the word-for-word tick');
  return out;
}

export function draftToReview(d: ReviewDraft, role = ''): Review {
  return {
    q: d.q.trim(),
    a: d.a.trim(),
    r: role,
    company: d.company.trim() || null,
    stars: d.stars,
    ...(d.source ? { source: d.source } : {}),
    ...(d.sourceUrl.trim() ? { sourceUrl: d.sourceUrl.trim() } : {}),
    ...(d.date.trim() ? { date: d.date.trim() } : {}),
    ...(d.service ? { service: d.service } : {}),
    // A town tag puts the review on that town's page, and on its town + service page when the
    // service matches too. Saved as exactly `town`.
    ...(d.town?.trim() ? { town: d.town.trim() } : {}),
  };
}

/** A saved review opened for editing. A review saved with a source was ticked when saved; one
 *  from before provenance existed must be ticked again before an edit is saved. */
export function draftFromReview(t: Review, index: number, content?: unknown): ReviewDraft {
  // A review saved before `town` existed may hold its town in `company` (the old Town box). It
  // becomes the town only when it IS one of the client's towns: `company` also holds company names.
  const fromCompany = !t.town && content ? canonicalTown(content, t.company ?? '') : '';
  return {
    source: (t.source as ReviewSource | undefined) ?? '',
    sourceUrl: t.sourceUrl ?? '',
    a: t.a ?? '',
    stars: t.stars || 5,
    date: t.date ?? '',
    q: t.q ?? '',
    service: t.service ?? '',
    town: t.town ?? fromCompany,
    company: fromCompany ? '' : (t.company ?? ''),
    verbatim: Boolean(t.source),
    index,
  };
}

const blank = (t: Review | undefined) => !t || !String(t.q ?? '').trim();

/**
 * Apply a draft to the review list. Returns the new list and the draft's index, or null when the
 * draft is incomplete (nothing is written; the draft alone holds the typing).
 *
 * A new review fills the first blank slot, else appends. The list never becomes [], which
 * deepMerge reads as missing and fills from the vertical preset.
 */
export function applyDraft(items: Review[], d: ReviewDraft): { items: Review[]; index: number } | null {
  if (draftMissing(d).length > 0) return null;
  const next = [...items];
  if (d.index !== null && d.index < next.length) {
    next[d.index] = draftToReview(d, next[d.index]?.r ?? '');
    return { items: next, index: d.index };
  }
  const slot = next.findIndex(blank);
  const index = slot >= 0 ? slot : next.length;
  next[index] = draftToReview(d);
  return { items: next, index };
}
