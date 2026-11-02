'use client';
// ─────────────────────────────────────────────────────────────────────────────
// HvacReviews — Northstar "Home — Standard" reviews, from the approved mockup.
// A soft band: centered steel eyebrow + heading, an aggregate (big score + gold stars +
// verified-review count), then a 3-up grid of quote cards (gold stars, quote, steel avatar
// initial, name/role). Reads testimonials.{eyebrow,title,items} + extensions.reviewBadge.
// Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { Star } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'hvac-reviews',
  category: 'testimonials',
  label: 'HVAC / Reviews',
  consumes: ['testimonials.eyebrow', 'testimonials.title', 'testimonials.items', 'extensions.reviewBadge'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/editable'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

export default function HvacReviews({ content = CONTENT }: { content?: SiteContent }) {
  const { testimonials, extensions } = content;
  const items = testimonials.items.filter((t) => t.q?.trim());
  if (!items.length) return null;
  const review = extensions.reviewBadge;

  return (
    <section id="reviews" className="bg-[#F4F6F8] py-[84px]">
      <div className="mx-auto max-w-[1120px] px-6">
        <div className="mx-auto max-w-[640px] text-center">
          {testimonials.eyebrow && (
            <div className="text-[12.5px] font-bold uppercase tracking-[0.17em] text-[#4A6D96]">
              <E p="testimonials.eyebrow">{testimonials.eyebrow}</E>
            </div>
          )}
          <h2 className="mt-3 font-heading text-[40px] font-semibold leading-[1.04] text-ink">
            <E p="testimonials.title">{testimonials.title}</E>
          </h2>
          {review && (
            <div className="mt-6 flex items-center justify-center gap-4">
              <span className="font-heading text-[52px] font-bold leading-none text-ink">{review.rating}</span>
              <span className="flex flex-col items-start gap-1">
                <span className="flex text-[#F6B54A]" aria-hidden="true">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} size={22} weight="fill" className={i < Math.round(review.rating) ? '' : 'opacity-25'} />
                  ))}
                </span>
                <span className="text-[13.5px] font-semibold text-inkSoft">Based on {review.count}+ verified reviews</span>
              </span>
            </div>
          )}
        </div>

        <div className="mt-11 grid gap-[18px] lg:grid-cols-3">
          {items.slice(0, 3).map((t, i) => (
            <figure key={t.a || i} className="flex flex-col rounded-[16px] border border-rule bg-bg p-[28px] shadow-[0_1px_2px_rgba(19,41,63,0.06)]">
              <div className="flex text-[#F6B54A]" aria-hidden="true">
                {Array.from({ length: 5 }, (_, j) => (
                  <Star key={j} size={15} weight="fill" className={j < (t.stars || 5) ? '' : 'opacity-25'} />
                ))}
              </div>
              <blockquote className="mt-3.5 flex-1 text-[15.5px] leading-[1.6] text-ink">
                <E p={`testimonials.items.${i}.q`}>{t.q}</E>
              </blockquote>
              <figcaption className="mt-[22px] flex items-center gap-3 border-t border-rule pt-[18px]">
                <span
                  className="grid h-[44px] w-[44px] place-items-center rounded-full font-heading text-[18px] font-semibold text-[#fff]"
                  style={{ background: 'linear-gradient(145deg,#8FB2D9,#1E3A5F)' }}
                >
                  {(t.a || '?').trim().charAt(0).toUpperCase()}
                </span>
                <span>
                  <b className="block text-[15px] text-ink"><E p={`testimonials.items.${i}.a`}>{t.a}</E></b>
                  <small className="text-[13px] text-inkSoft"><E p={`testimonials.items.${i}.r`}>{t.r}</E></small>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
