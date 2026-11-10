'use client';
// ─────────────────────────────────────────────────────────────────────────────
// PlumbingReviews — ghost-quote reviews with the aggregate as a pill in the section header,
// premium pass (2026-11-09, approved mockup). Differs from HvacReviews' centred aggregate: the
// head sits left (accent eyebrow on its accent-bar → heading) with the score pill on the right.
// Three identical cards became one FEATURED quote (wide, 22–30px, the giant ghost quotation mark
// in accent2's soft tint) beside two compact cards; on a phone they stack. Cards lift their border
// to accent2 on hover. Same items, same fields, same cap of three. reviewBadge null -> aggregate
// omitted, quote cards still render (D5).
// Every colour is a palette token; the stars are the fixed --star semantic. Fixed design, no skin.
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

type Item = SiteContent['testimonials']['items'][number];

function Quote({ t, i, featured }: { t: Item; i: number; featured: boolean }) {
  return (
    <figure
      className={`shadow-brand-1 relative flex flex-col overflow-hidden rounded-[20px] border border-rule bg-bg transition-[border-color,box-shadow] duration-300 hover:border-[color:var(--accent-2)] hover:shadow-[0_2px_6px_rgba(16,33,46,0.08),0_14px_30px_-12px_rgba(16,33,46,0.24)] ${
        featured ? 'justify-center p-7 lg:p-10' : 'p-6 lg:p-7'
      }`}
    >
      <span
        className={`pointer-events-none absolute font-heading font-extrabold leading-none text-[color:var(--accent-2-soft)] ${
          featured ? 'right-[30px] top-[-2px] text-[140px]' : 'right-[14px] top-[-16px] text-[110px]'
        }`}
        aria-hidden="true"
      >
        &rdquo;
      </span>
      <div className="relative flex" aria-hidden="true">
        {Array.from({ length: 5 }, (_, j) => (
          <Star key={j} size={15} weight="fill" className={`text-[color:var(--star)] ${j < (t.stars || 5) ? '' : 'opacity-25'}`} />
        ))}
      </div>
      <blockquote
        className={`relative text-ink ${
          featured
            ? 'mt-5 max-w-[26ch] text-[19px] font-medium leading-[1.35] tracking-[-0.012em] sm:text-[22px] lg:text-[clamp(22px,2.2vw,30px)]'
            : 'mt-3.5 flex-1 text-[15.5px] leading-[1.6]'
        }`}
      >
        <E p={`testimonials.items.${i}.q`}>{t.q}</E>
      </blockquote>
      <figcaption className={`relative flex items-center gap-3 ${featured ? 'mt-8' : 'mt-[22px] border-t border-rule pt-[18px]'}`}>
        <span
          className={`grid shrink-0 place-items-center rounded-full font-heading font-extrabold text-onInk ${
            featured ? 'h-[52px] w-[52px] text-[21px]' : 'h-[44px] w-[44px] text-[18px]'
          }`}
          style={{ background: 'linear-gradient(145deg, var(--accent), var(--ink-panel-2))' }}
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

export default function PlumbingReviews({ content = CONTENT }: { content?: SiteContent }) {
  const { testimonials, extensions } = content;
  const items = testimonials.items.filter((t) => t.q?.trim());
  if (!items.length) return null;
  const review = extensions.reviewBadge;
  const [first, ...rest] = items.slice(0, 3);

  return (
    <section className="bg-bg py-16 lg:py-[92px]">
      <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-6 lg:gap-8">
          <div>
            {testimonials.eyebrow && (
              <div className="flex items-center gap-2.5 text-[12px] font-bold uppercase tracking-[0.14em] text-accent">
                <span className="accent-bar !h-[3px] !w-7" aria-hidden="true" />
                <E p="testimonials.eyebrow">{testimonials.eyebrow}</E>
              </div>
            )}
            <h2 className="mt-3.5 max-w-[22ch] font-heading text-[30px] font-extrabold leading-[1.04] tracking-[-0.02em] text-ink lg:text-[36px]">
              <E p="testimonials.title">{testimonials.title}</E>
            </h2>
          </div>
          {review && (
            <div className="shadow-brand-1 flex items-center gap-[14px] rounded-full border border-rule bg-bg px-[22px] py-3 sm:px-[26px] sm:py-[14px]">
              <span className="font-heading text-[34px] font-extrabold leading-none tracking-[-0.02em] text-accent">{review.rating}</span>
              <span>
                <span className="block text-[14px] leading-none tracking-[2px] text-[color:var(--star)]" aria-hidden="true">★★★★★</span>
                <span className="mt-1 block text-[12.5px] font-semibold leading-none text-inkSoft">{review.count}+ verified reviews</span>
              </span>
            </div>
          )}
        </div>

        <div className={`mt-8 grid gap-4 lg:mt-11 lg:gap-[22px] ${rest.length ? 'lg:grid-cols-[1.5fr_1fr]' : 'max-w-[760px]'}`}>
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
