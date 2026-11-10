'use client';
// ─────────────────────────────────────────────────────────────────────────────
// RoofingReviews — "structural / weatherproof" proof, premium pass (2026-11-09, approved
// mockup). A dark aggregate panel (6px corners) beside TWO large left-rule pull-quotes — not
// HVAC's three-card grid. Reads testimonials.items + extensions.reviewBadge; the quotes arrive
// one after another (rv-stagger). On a phone the panel stacks above the quotes.
//
// The mockup v1 aggregate panel also showed a per-source breakdown (Google/Facebook/Angi). That
// is NOT rendered here: extensions.reviewBadge has no field for a per-source split, and
// inventing one would be exactly the kind of fabricated number this programme forbids (PLAN
// D4) — only score/count/url are real, client-supplied data. reviewBadge null -> the whole
// aggregate panel is omitted and quotes run full width; quotes still render regardless.
//
// Colours are palette tokens: the band is a bgSoft/rule mix, the panel ink-panel-2, the label
// and rating var(--accent-2) (the editable accent2 slot that replaced the hardcoded amber),
// stars the fixed --star semantic, greys on dark on-ink-soft.
// ─────────────────────────────────────────────────────────────────────────────
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'roofing-reviews',
  category: 'testimonials',
  label: 'Roofing / Dark aggregate + pull-quotes',
  consumes: ['testimonials.eyebrow', 'testimonials.title', 'testimonials.items', 'extensions.reviewBadge'],
  sharedDeps: ['@/lib/editable'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

export default function RoofingReviews({ content = CONTENT }: { content?: SiteContent }) {
  const { testimonials, extensions } = content;
  const items = testimonials.items.filter((t) => t.q?.trim()).slice(0, 2);
  if (!items.length) return null;
  const review = extensions.reviewBadge;

  return (
    <section className="py-14 lg:py-[88px]" style={{ background: 'color-mix(in srgb, var(--bg-soft) 70%, var(--rule))' }}>
      <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
        <div className={review ? 'grid gap-10 lg:grid-cols-[0.8fr_1.2fr]' : ''}>
          {review && (
            <div className="rounded-[6px] bg-inkPanel2 p-7 text-onInk sm:p-9">
              <div className="flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[color:var(--accent-2)]">
                <span className="accent-bar !h-[3px] !w-7 !rounded-[2px]" aria-hidden="true" />
                Reviews
              </div>
              <div className="mt-4 font-heading text-[64px] font-extrabold leading-[0.9] tracking-[-0.04em] text-[color:var(--accent-2)] tabular-nums lg:text-[80px]">
                {review.rating}
              </div>
              <div className="mt-3 text-[21px] tracking-[2px] text-[color:var(--star)]" aria-hidden="true">★★★★★</div>
              <div className="mt-2 text-[13.5px] text-onInkSoft">Based on {review.count}+ verified reviews</div>
            </div>
          )}

          <div className={`rv-stagger ${review ? '' : 'mx-auto max-w-[760px]'}`}>
            {items.map((t, i) => (
              <div key={t.a || i} className="mb-7 border-l-[3px] border-accent py-1 pl-5 last:mb-0 sm:pl-[26px]">
                <div className="text-[14px] tracking-[2px] text-[color:var(--star)]" aria-hidden="true">
                  {'★'.repeat(t.stars || 5)}
                </div>
                <p className="mt-3 font-heading text-[clamp(19px,1.8vw,22px)] font-medium leading-[1.5] tracking-[-0.012em] text-ink">
                  &ldquo;<E p={`testimonials.items.${i}.q`}>{t.q}</E>&rdquo;
                </p>
                <div className="mt-3.5 text-[13.5px] font-semibold text-inkSoft">
                  <b className="text-ink"><E p={`testimonials.items.${i}.a`}>{t.a}</E></b>
                  {' · '}
                  <E p={`testimonials.items.${i}.r`}>{t.r}</E>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
