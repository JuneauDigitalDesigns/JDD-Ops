'use client';
// ─────────────────────────────────────────────────────────────────────────────
// TrustReviewsAggregate — trust band that NEVER fabricates.
//
// A numeric star aggregate is shown ONLY when the client actually supplied a real
// rating + count (extensions.reviewBadge). When they didn't, this does not invent a
// score (the old code defaulted to 4.9 / testimonials.length — a false claim on a
// live site). Instead it falls back to the client's real certifications, and if
// there are none of those either, it omits the whole band.
// ─────────────────────────────────────────────────────────────────────────────
import { Star, SealCheck } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { skinClasses, type SkinId } from '@/lib/skins';

export const meta = {
  id: 'trust-reviews-aggregate',
  category: 'trust',
  label: 'Trust / Reviews Aggregate',
  consumes: ['extensions.reviewBadge', 'extensions.trustBadges', 'trust.label', 'trust.logos'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/skins'],
  skins: ['default', 'inverted'],
  /** Structural archetype, from src/lib/archetypes.ts. Unique within the category. */
  archetype: 'aggregate-badge',
  /** True if this component owns a SIGNATURE motion moment (a scroll-linked transform, a pin,
   *  a count-up). Decision 26 budgets these per PAGE, not per section: at most two on a page,
   *  enforced by console/test/page-rhythm.test.mjs. Micro-reveals are free and do not count. */
  signature: false,
} as const;

export default function TrustReviewsAggregate({
  content = CONTENT,
  skin = 'default',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const s = skinClasses(skin);
  const { extensions, trust } = content;
  const review = extensions?.reviewBadge ?? null;
  // Real certifications only — trustBadges first, then the notable-clients logos.
  const certs = (extensions?.trustBadges?.length ? extensions.trustBadges : trust?.logos) ?? [];

  // No real rating AND no real certifications → nothing true to show.
  if (!review && certs.length === 0) return null;

  return (
    <section className={`px-6 py-14 ${s.section}`}>
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-3 text-center">
        {review ? (
          <>
            <div className="flex items-center gap-1 text-accent" aria-hidden="true">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={30} weight={i < Math.round(review.rating) ? 'fill' : 'regular'} />
              ))}
            </div>
            <p className={`font-heading text-4xl font-bold ${s.heading}`}>{review.rating.toFixed(1)} out of 5</p>
            <p className={s.body}>
              Rated by <span className={`font-semibold ${s.heading}`}>{review.count}+</span>{' '}
              <E p="trust.label">{trust?.label ?? 'verified customers'}</E>
            </p>
          </>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              <E p="trust.label">{trust?.label ?? 'Certified & accredited'}</E>
            </p>
            {/* Cert chips render as plain mirrors — they're edited in their canonical component
                (TrustBadges / brand drawer), so wrapping them again here would double the <E> path. */}
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2.5">
              {certs.map((c) => (
                <span
                  key={c}
                  className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-[15px] font-bold ${s.cardRule} ${s.card} ${s.heading}`}
                >
                  <SealCheck size={18} weight="fill" className="text-accent" aria-hidden="true" />
                  {c}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
