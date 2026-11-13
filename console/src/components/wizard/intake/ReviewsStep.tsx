'use client';

/**
 * Step 4, Reviews: real customer reviews only, added whenever the client has them.
 *
 * The copywriter never writes a review (operator decision, 2026-11-10; PR #51). The Studio's
 * reviews section renders only items with text, so it stays hidden until one is saved here, and
 * shows from then on with no other switch.
 *
 * Saving keeps `testimonials.items` non-empty: a new review fills the first blank slot, and
 * removing one blanks its slot instead of shrinking the array to []. An empty array is the
 * trap @jdd/ui's deepMerge reads as "missing", which falls through to the preset.
 *
 * Reviews saved before provenance existed have no `source`. They stay on the site, marked
 * "Source not recorded" for someone to complete, and are never hidden.
 */
import { CheckCircle, PencilSimple, Star, Trash } from '@phosphor-icons/react';
import { REVIEW_SOURCES, serviceSlugs, type ReviewSource } from '@jdd/schema';
import { townChoices } from '@/lib/service-areas';
import type { SiteContent } from '@/data/site';
import type { SetField } from '@/components/fields';
import { realReviews } from '@/lib/intake-todo';
import { sourceOf, type SourceContext } from '@/lib/intake-sources';
import { EMPTY_DRAFT, applyDraft, draftFromReview, draftMissing, type ReviewDraft } from '@/lib/review-draft';
import { Card, Tag, SourceChip, INPUT, FIELD_LABEL } from './ui';

type Review = SiteContent['testimonials']['items'][number];

const SOURCE_LABEL: Record<ReviewSource, string> = {
  google: 'Google review', yelp: 'Yelp review', facebook: 'Facebook review', client: 'From the client', other: 'Other',
};
const NEEDS_LINK = new Set<ReviewSource>(['google', 'yelp', 'facebook']);
const BLANK: Review = { q: '', a: '', r: '', company: null, stars: 5 };

export default function ReviewsStep({
  content, sources, setField, reviewDraft, onReviewDraftChange,
}: {
  content: SiteContent;
  sources: SourceContext;
  setField: SetField;
  reviewDraft: ReviewDraft | null;
  onReviewDraftChange: (d: ReviewDraft | null) => void;
}) {
  const items = content.testimonials?.items ?? [];
  const saved = realReviews(content);
  const services = content.services?.items ?? [];
  const slugs = serviceSlugs(content);
  // A review's town is one of the client's own (local SEO, 2026-11-12): that is what puts it on
  // the town's page, and on the town + service page when its service matches too.
  const towns = townChoices(content.extensions?.serviceArea);
  const badge = content.extensions?.reviewBadge ?? null;
  const ratingSource = sourceOf(sources, 'extensions.reviewBadge');

  /** Writes the whole badge. Numbers parse as typed; a cleared rating AND count clears it. */
  function setBadge(patch: { rating?: string; count?: string; url?: string }) {
    const rating = patch.rating !== undefined ? parseFloat(patch.rating) : badge?.rating;
    const count = patch.count !== undefined ? parseInt(patch.count, 10) : badge?.count;
    const url = patch.url !== undefined ? patch.url : badge?.url ?? '';
    const r = Number.isFinite(rating) ? Number(rating) : 0;
    const c = Number.isFinite(count) ? Number(count) : 0;
    setField('extensions.reviewBadge', !r && !c && !url ? null : { rating: r, count: c, url });
  }

  // The draft is the wizard's (saved in its bundle), not this component's: it survives a step
  // change, a reload and a closed tab. It becomes a review by itself once complete.
  const draft = reviewDraft ?? EMPTY_DRAFT;
  const editing = draft.index;
  const missing = draftMissing(draft);
  const linkNeeded = draft.source !== '' && NEEDS_LINK.has(draft.source);

  function set(patch: Partial<ReviewDraft>) {
    const next = { ...draft, ...patch };
    const applied = applyDraft(items, next);
    if (applied) {
      setField('testimonials.items', applied.items);
      next.index = applied.index;
      // Tagging a review to a service stores that service's slug the first time (spec §2).
      if (next.service) {
        const k = slugs.indexOf(next.service);
        if (k >= 0 && !services[k]?.slug) setField(`services.items.${k}.slug`, next.service);
      }
    }
    onReviewDraftChange(next);
  }

  function edit(i: number) {
    onReviewDraftChange(draftFromReview(items[i], i, content));
  }

  function remove(i: number) {
    setField('testimonials.items', items.map((t, j) => (j === i ? BLANK : t)));
    if (editing === i) onReviewDraftChange(null);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3.5 px-6 py-4">
      <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1">
        <h2 className="font-display text-[28px] font-bold leading-none text-uiInk">Reviews</h2>
        <span className="text-xs text-uiFg3">Real customer reviews only. Never written by the copywriter.</span>
        {saved.length === 0
          ? <Tag tone="warn">Reviews section hidden</Tag>
          : <Tag tone="ok">Reviews section shown · {saved.length}</Tag>}
      </div>

      <div className="grid min-h-0 flex-1 gap-3.5 lg:grid-cols-[minmax(0,.95fr)_minmax(0,1.25fr)] 2xl:grid-cols-[minmax(0,.9fr)_minmax(0,1.25fr)_minmax(0,.85fr)]">
        <Card title="Saved" right={<span className="font-chromeMono text-2xs text-uiFg3">{saved.length}</span>} bodyClassName="flex flex-col">
          {saved.length === 0 ? (
            <div className="m-3.5 rounded-lg border border-dashed border-uiCardRule bg-uiSurface/50 p-3.5">
              <p className="text-[13.5px] font-semibold text-uiInk">Reviews section hidden</p>
              <p className="mt-0.5 text-xs text-uiFg3">In the Studio and on the live site, until one review is saved.</p>
            </div>
          ) : (
            <ul className="divide-y divide-uiCardRule/40">
              {saved.map(({ t, i }) => (
                <li key={i} className={`px-3.5 py-3 ${editing === i ? 'bg-uiSurface' : ''}`}>
                  <div className="flex items-center gap-2">
                    <Stars n={t.stars || 5} />
                    {t.source
                      ? <Tag tone="teal">{SOURCE_LABEL[t.source as ReviewSource] ?? t.source}</Tag>
                      : <Tag tone="warn">Source not recorded</Tag>}
                    <span className="ml-auto flex gap-1">
                      <button type="button" aria-label="Edit review" onClick={() => edit(i)} className="rounded p-1 text-uiFg3 hover:text-uiInk"><PencilSimple size={13} /></button>
                      <button type="button" aria-label="Remove review" onClick={() => remove(i)} className="rounded p-1 text-uiFg3 hover:text-uiInk"><Trash size={13} /></button>
                    </span>
                  </div>
                  <p className="mt-1.5 line-clamp-3 text-[13px] leading-relaxed text-uiFg2">{t.q}</p>
                  <p className="mt-1 text-xs text-uiFg3"><b className="text-uiFg2">{t.a}</b>{t.town ? ` · ${t.town}` : t.company ? ` · ${t.company}` : ''}{t.date ? ` · ${t.date}` : ''}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-auto border-t border-uiCardRule/50 px-3.5 py-3">
            <p className={FIELD_LABEL}>Rating on record <SourceChip source={ratingSource} /></p>
            <div className="grid grid-cols-[70px_90px_minmax(0,1fr)] items-end gap-2">
              <label>
                <span className="mb-1 block text-2xs text-uiFg3">Stars</span>
                <input value={badge?.rating ?? ''} inputMode="decimal" onChange={(e) => setBadge({ rating: e.target.value })} className={`${INPUT} h-7`} />
              </label>
              <label>
                <span className="mb-1 block text-2xs text-uiFg3">Reviews</span>
                <input value={badge?.count ?? ''} inputMode="numeric" onChange={(e) => setBadge({ count: e.target.value })} className={`${INPUT} h-7`} />
              </label>
              <label>
                <span className="mb-1 block text-2xs text-uiFg3">Profile link</span>
                <input value={badge?.url ?? ''} onChange={(e) => setBadge({ url: e.target.value })} className={`${INPUT} h-7`} />
              </label>
            </div>
            {ratingSource === 'preset' && (
              <p className="mt-1.5 text-2xs leading-relaxed" style={{ color: '#7d500f' }}>The vertical preset&apos;s figures, not this client&apos;s.</p>
            )}
          </div>
        </Card>

        <Card title={editing !== null ? 'Edit review' : 'New review'} bodyClassName="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <label>
              <span className={FIELD_LABEL}>Source</span>
              <select value={draft.source} onChange={(e) => set({ source: e.target.value as ReviewSource })} className={`${INPUT} w-44`}>
                {draft.source === '' && <option value="">Not recorded</option>}
                {REVIEW_SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
              </select>
            </label>
            <label className="min-w-[200px] flex-1">
              <span className={FIELD_LABEL}>Review link {linkNeeded ? '' : <Tag>Optional</Tag>}</span>
              <input value={draft.sourceUrl} onChange={(e) => set({ sourceUrl: e.target.value })} className={INPUT} />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1.2fr)_auto_minmax(0,.8fr)]">
            <label>
              <span className={FIELD_LABEL}>Name as shown</span>
              <input value={draft.a} onChange={(e) => set({ a: e.target.value })} className={INPUT} />
            </label>
            <fieldset>
              <legend className={FIELD_LABEL}>Stars</legend>
              <div className="flex">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" aria-label={`${n} star${n === 1 ? '' : 's'}`} aria-pressed={draft.stars === n} onClick={() => set({ stars: n })} className="p-0.5">
                    <Star size={20} weight="fill" style={{ color: n <= draft.stars ? 'var(--warn)' : 'var(--ui-rule-strong)' }} />
                  </button>
                ))}
              </div>
            </fieldset>
            <label>
              <span className={FIELD_LABEL}>Date</span>
              <input type="date" value={draft.date} onChange={(e) => set({ date: e.target.value })} className={INPUT} />
            </label>
          </div>
          <label className="flex min-h-0 flex-1 flex-col">
            <span className={FIELD_LABEL}>Review text</span>
            <textarea
              value={draft.q}
              onChange={(e) => set({ q: e.target.value })}
              className={`${INPUT} min-h-[84px] flex-1 resize-none py-2 leading-relaxed`}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className={FIELD_LABEL}>Service <Tag>Optional</Tag></span>
              <select value={draft.service} onChange={(e) => set({ service: e.target.value })} className={INPUT}>
                <option value="">None</option>
                {services.map((s, k) => <option key={k} value={slugs[k]}>{s.t}</option>)}
              </select>
            </label>
            <label>
              <span className={FIELD_LABEL}>Town <Tag>Optional</Tag></span>
              <select value={draft.town ?? ''} onChange={(e) => set({ town: e.target.value })} className={INPUT}>
                <option value="">None</option>
                {towns.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          </div>
          <label className="flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-[13.5px]" style={{ borderColor: 'rgba(31,111,120,.45)', background: 'rgba(31,111,120,.06)' }}>
            <input type="checkbox" checked={draft.verbatim} onChange={(e) => set({ verbatim: e.target.checked })} className="mt-0.5 h-4 w-4" style={{ accentColor: 'var(--accent)' }} />
            <span>Copied word for word from the review. Not edited, not combined.</span>
          </label>
          {/* No Save button (autosave, 2026-11-10): the draft is kept as typed, and is the review
              once complete. The line says which of the two it is. */}
          <div className="flex items-center gap-3">
            <p className="min-w-0 flex-1 text-xs leading-snug" role="status" style={{ color: missing.length ? 'var(--ui-fg-3)' : 'var(--ok)' }}>
              {missing.length === 0 ? (
                <span className="inline-flex items-center gap-1.5 font-semibold"><CheckCircle size={14} weight="fill" /> Saved as a review.</span>
              ) : editing !== null ? (
                <>Changes kept as a draft. The saved review updates once it has: {missing.join(', ')}.</>
              ) : (
                <>Draft, kept here. Becomes a review once it has: {missing.join(', ')}.</>
              )}
            </p>
            <button type="button" onClick={() => onReviewDraftChange(null)} className="btn btn-sm shrink-0">New review</button>
          </div>
        </Card>

        <Card title="As it will read" className="hidden 2xl:flex" bodyClassName="space-y-3 p-3.5">
          <div className="space-y-2 rounded-xl border border-uiCardRule/70 bg-panel p-4">
            <Stars n={draft.stars} />
            <p className="text-sm leading-relaxed text-uiFg2">{draft.q.trim() || <span className="italic text-uiFg3">Review text</span>}</p>
            <p className="text-[13px]">
              <b>{draft.a.trim() || 'Name'}</b>
              <span className="text-uiFg3">{draft.town ? ` · ${draft.town}` : draft.company.trim() ? ` · ${draft.company.trim()}` : ''}{draft.source ? ` · ${SOURCE_LABEL[draft.source]}` : ''}</span>
            </p>
          </div>
          <p className="text-2xs leading-relaxed text-uiFg3">
            Stored with its source, link and date. Added later the same way: Intake › Reviews.
          </p>
        </Card>
      </div>
    </div>
  );
}

function Stars({ n }: { n: number }) {
  return (
    <span className="flex" aria-label={`${n} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((k) => (
        <Star key={k} size={13} weight="fill" style={{ color: k <= n ? 'var(--warn)' : 'var(--ui-rule-strong)' }} />
      ))}
    </span>
  );
}
