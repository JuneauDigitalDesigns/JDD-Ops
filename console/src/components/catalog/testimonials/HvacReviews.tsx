'use client';
// ─────────────────────────────────────────────────────────────────────────────
// HvacReviews — Northstar "Home — Standard" reviews, premium pass (2026-11-09, approved mockup).
// A soft band: centred steel eyebrow + heading, the aggregate (56px score + gold stars + verified
// count, only from extensions.reviewBadge), then THREE identical cards became one FEATURED quote
// (wide, 26–30px, a large steel quote mark) beside two compact cards. Same three items, same
// fields, same cap of three. Reads testimonials.{eyebrow,title,items}; returns null with no items
// and drops only the aggregate when reviewBadge is null (d5-degradation).
// Every colour is a palette token; the stars are the fixed --star semantic.
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

type Item = SiteContent['testimonials']['items'][number];

function Stars({ count, size }: { count: number; size: number }) {
  return (
    <span className="flex text-[color:var(--star)]" aria-hidden="true">
      {Array.from({ length: 5 }, (_, j) => (
        <Star key={j} size={size} weight="fill" className={j < count ? '' : 'opacity-25'} />
      ))}
    </span>
  );
}

function Quote({ t, i, featured }: { t: Item; i: number; featured: boolean }) {
  return (
    <figure
      className={`shadow-brand-1 relative flex flex-col rounded-[16px] border border-rule bg-bg transition-[border-color,box-shadow] duration-300 hover:border-[color:var(--accent-2-strong)] hover:shadow-brand-2 ${
        featured ? 'justify-center p-7 lg:p-10' : 'p-6 lg:p-7'
      }`}
    >
      {featured && (
        <span
          className="pointer-events-none absolute right-7 top-4 font-heading text-[140px] font-semibold leading-[0.8] text-[color:var(--accent-2-soft)]"
          aria-hidden="true"
        >
          &ldquo;
        </span>
      )}
      <div className="relative">
        <Stars count={t.stars || 5} size={15} />
      </div>
      <blockquote
        className={`relative text-ink ${
          featured
            ? 'mt-5 max-w-[26ch] text-[22px] font-medium leading-[1.35] tracking-[-0.012em] lg:text-[clamp(22px,2.2vw,30px)]'
            : 'mt-3.5 flex-1 text-[15.5px] leading-[1.6]'
        }`}
      >
        <E p={`testimonials.items.${i}.q`}>{t.q}</E>
      </blockquote>
      <figcaption className={`flex items-center gap-3 ${featured ? 'mt-8' : 'mt-[22px] border-t border-rule pt-[18px]'}`}>
        <span
          style={{ background: 'var(--accent-bar)' }}
          className={`grid shrink-0 place-items-center rounded-full font-heading font-semibold text-onInk ${
            featured ? 'h-[52px] w-[52px] text-[21px]' : 'h-[44px] w-[44px] text-[18px]'
          }`}
        >
          {(t.a || '?').trim().charAt(0).toUpperCase()}
        </span>
        <span>
          <b className="block text-[15px] text-ink"><E p={`testimonials.items.${i}.a`}>{t.a}</E></b>
          <small className="text-[13px] text-inkSoft"><E p={`testimonials.items.${i}.r`}>{t.r}</E></small>
        </span>
      </figcaption>
    </figure>
  );
}

export default function HvacReviews({ content = CONTENT }: { content?: SiteContent }) {
  const { testimonials, extensions } = content;
  const items = testimonials.items.filter((t) => t.q?.trim()).slice(0, 3);
  if (!items.length) return null;
  const review = extensions.reviewBadge;
  const [first, ...rest] = items;

  return (
    <section id="reviews" className="bg-bgSoft py-16 lg:py-24">
      <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
        <div className="mx-auto max-w-[640px] text-center">
          {testimonials.eyebrow && (
            <div className="flex items-center justify-center gap-2.5 text-[12px] font-bold uppercase tracking-[0.14em] text-[color:var(--accent-2)]">
              <span className="accent-bar !h-[3px] !w-7" aria-hidden="true" />
              <E p="testimonials.eyebrow">{testimonials.eyebrow}</E>
            </div>
          )}
          <h2 className="mt-4 font-heading text-[34px] font-semibold leading-[1.04] text-ink lg:text-[46px]">
            <E p="testimonials.title">{testimonials.title}</E>
          </h2>
          {review && (
            <div className="mt-6 flex items-center justify-center gap-4">
              <span className="font-heading text-[56px] font-semibold leading-none text-ink">{review.rating}</span>
              <span className="flex flex-col items-start gap-1">
                <Stars count={Math.round(review.rating)} size={22} />
                <span className="text-[13.5px] font-semibold text-inkSoft">Based on {review.count}+ verified reviews</span>
              </span>
            </div>
          )}
        </div>

        <div className={`mt-8 grid gap-4 lg:mt-11 lg:gap-[22px] ${rest.length ? 'lg:grid-cols-[1.5fr_1fr]' : 'mx-auto max-w-[720px]'}`}>
          <Quote t={first} i={0} featured />
          {rest.length > 0 && (
            <div className="rv-stagger grid gap-4 lg:gap-[22px]">
              {rest.map((t, k) => (
                <Quote key={t.a || k} t={t} i={k + 1} featured={false} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
