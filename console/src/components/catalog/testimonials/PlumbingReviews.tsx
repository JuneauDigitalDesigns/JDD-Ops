'use client';
// ─────────────────────────────────────────────────────────────────────────────
// PlumbingReviews — quote-mark cards with the aggregate as a pill in the section header,
// mirrored 1:1 (#plumbing .rev-head/.aggbox/.qcard). Differs from Hvac/HvacReviews' centred
// aggregate-above-grid layout: the score sits beside the heading as a rounded pill, and each
// card carries a giant ghost quotation mark behind the text. reviewBadge null -> aggregate
// omitted, quote cards still render (D5). Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { Star } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'plumbing-reviews',
  category: 'testimonials',
  label: 'Plumbing / Ghost-quote reviews',
  consumes: ['testimonials.eyebrow', 'testimonials.title', 'testimonials.items', 'extensions.reviewBadge'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/editable'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

export default function PlumbingReviews({ content = CONTENT }: { content?: SiteContent }) {
  const { testimonials, extensions } = content;
  const items = testimonials.items.filter((t) => t.q?.trim());
  if (!items.length) return null;
  const review = extensions.reviewBadge;

  return (
    <section className="bg-bg py-[88px]">
      <div className="mx-auto max-w-[1160px] px-6">
        <div className="flex flex-wrap items-end justify-between gap-10">
          <div>
            {testimonials.eyebrow && (
              <div className="text-[12px] font-bold uppercase tracking-[0.15em] text-accent">
                <E p="testimonials.eyebrow">{testimonials.eyebrow}</E>
              </div>
            )}
            <h2 className="mt-3 max-w-[22ch] font-heading text-[38px] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">
              <E p="testimonials.title">{testimonials.title}</E>
            </h2>
          </div>
          {review && (
            <div className="flex items-center gap-4 rounded-full border border-rule bg-bg px-[26px] py-[14px] shadow-[0_2px_4px_rgba(16,33,46,0.04)]">
              <span className="font-heading text-[34px] font-extrabold leading-none tracking-[-0.03em] text-accent">{review.rating}</span>
              <span>
                <span className="block text-[14px] tracking-[2px] text-[#F0A830]" aria-hidden="true">★★★★★</span>
                <span className="mt-0.5 block text-[12.5px] font-semibold text-inkSoft">{review.count}+ verified reviews</span>
              </span>
            </div>
          )}
        </div>

        <div className="mt-11 grid gap-5 lg:grid-cols-3">
          {items.slice(0, 3).map((t, i) => (
            <figure
              key={t.a || i}
              className="relative flex flex-col overflow-hidden rounded-[20px] border border-rule bg-bg p-7 pb-[26px] pt-[30px]"
            >
              <span
                className="pointer-events-none absolute right-[14px] top-[-16px] font-heading text-[110px] font-extrabold leading-none"
                style={{ color: '#DBE9F2' }}
                aria-hidden="true"
              >
                &rdquo;
              </span>
              <div className="relative flex text-[14px] tracking-[2px] text-[#F0A830]" aria-hidden="true">
                {Array.from({ length: 5 }, (_, j) => (
                  <Star key={j} size={15} weight="fill" className={j < (t.stars || 5) ? '' : 'opacity-25'} />
                ))}
              </div>
              <blockquote className="relative mt-3.5 flex-1 text-[16px] leading-[1.65] text-ink">
                <E p={`testimonials.items.${i}.q`}>{t.q}</E>
              </blockquote>
              <figcaption className="relative mt-[22px] flex items-center gap-3 border-t border-rule pt-[18px]">
                <span
                  className="grid h-[42px] w-[42px] place-items-center rounded-full font-heading text-[16px] font-extrabold text-[#fff]"
                  style={{ background: 'linear-gradient(145deg,#2E8AC6,#0E2A3D)' }}
                >
                  {(t.a || '?').trim().charAt(0).toUpperCase()}
                </span>
                <span>
                  <b className="block text-[14.5px] text-ink"><E p={`testimonials.items.${i}.a`}>{t.a}</E></b>
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
