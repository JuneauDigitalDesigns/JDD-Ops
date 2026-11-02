'use client';
// ─────────────────────────────────────────────────────────────────────────────
// RoofingReviews — "structural / weatherproof" proof, mirrored 1:1 (#roofing .rev-grid / .agg /
// .rq). A dark bitumen aggregate panel beside TWO large left-border pull-quotes — not HVAC's
// three-card grid. Reads testimonials.{eyebrow,title,items} + extensions.reviewBadge.
//
// The mockup's aggregate panel also shows a per-source breakdown (Google/Facebook/Angi). That
// is NOT rendered here: extensions.reviewBadge has no field for a per-source split, and
// inventing one would be exactly the kind of fabricated number this programme forbids (PLAN
// D4) — only score/count/url are real, client-supplied data. reviewBadge null -> the whole
// aggregate panel is omitted and quotes run full width; quotes still render regardless.
// Fixed design, no skin.
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
    <section className="bg-[#EDE6DF] py-[88px]">
      <div className="mx-auto max-w-[1160px] px-6">
        <div className={review ? 'grid gap-10 lg:grid-cols-[0.8fr_1.2fr]' : ''}>
          {review && (
            <div className="bg-[#241E1B] p-9 text-[#fff]">
              <div className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#E8A33D]">Reviews</div>
              <div className="mt-4 font-heading text-[72px] font-extrabold leading-[0.9] tracking-[-0.04em] text-[#E8A33D]">
                {review.rating}
              </div>
              <div className="mt-3 text-[21px] tracking-[2px] text-[#E8A33D]" aria-hidden="true">★★★★★</div>
              <div className="mt-2 text-[13.5px] text-[#AFA096]">Based on {review.count}+ verified reviews</div>
            </div>
          )}

          <div className={review ? '' : 'mx-auto max-w-[760px]'}>
            {items.map((t, i) => (
              <div key={t.a || i} className="mb-7 border-l-[3px] border-accent py-1 pl-[26px] last:mb-0">
                <div className="text-[14px] tracking-[2px] text-[#E8A33D]" aria-hidden="true">
                  {'★'.repeat(t.stars || 5)}
                </div>
                <p className="mt-3 font-heading text-[19.5px] font-medium leading-[1.5] tracking-[-0.012em] text-ink">
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
