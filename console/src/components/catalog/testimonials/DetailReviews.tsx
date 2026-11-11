'use client';
// ─────────────────────────────────────────────────────────────────────────────
// DetailReviews — two large quotes on dark with a centred aggregate, premium pass (2026-11-09,
// approved mockup). Champagne eyebrow with a short gold bar, then ONE big gold numeral + stars +
// count line centred above a 2-up grid of glass quote cards (one column on a phone); a card lifts
// and its border turns the accent on hover. The stars stay the accent: gold IS this template's
// accent, by design. reviewBadge null -> aggregate omitted, quote cards still render (D5).
// Avatar photo when one is supplied, else the initial on the gold mark.
//
// Every colour is a palette token: glass is ink at 4% / 9%, the quote is ink, the count line is
// ink-soft pulled toward bg, the initial's gold is the accent pulled toward black.
// ─────────────────────────────────────────────────────────────────────────────
import { Star } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { CoverImage } from '@/lib/CoverImage';

export const meta = {
  id: 'detail-reviews',
  category: 'testimonials',
  label: 'Car Detailing / Two large quotes',
  consumes: ['testimonials.eyebrow', 'testimonials.items', 'extensions.reviewBadge', 'images.testimonials.avatars'],
  sharedDeps: ['@/lib/CoverImage', '@phosphor-icons/react', '@/lib/editable'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

const GOLD_BAR = 'linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 65%, black) 60%, transparent)';
const GOLD_MARK = 'linear-gradient(145deg, var(--accent), color-mix(in srgb, var(--accent) 65%, black))';

export default function DetailReviews({ content = CONTENT }: { content?: SiteContent }) {
  const { testimonials, extensions, images } = content;
  const items = testimonials.items.filter((t) => t.q?.trim());
  if (!items.length) return null;
  const review = extensions.reviewBadge;
  const avatars = images.testimonials?.avatars ?? [];

  return (
    <section className="bg-bg py-16 sm:py-[92px]">
      <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
        <div className="mx-auto max-w-[660px] text-center">
          {testimonials.eyebrow && (
            <div className="flex items-center justify-center gap-2.5 text-[11.5px] font-semibold uppercase leading-none tracking-[0.26em] text-accent">
              <span className="h-[3px] w-7 shrink-0 rounded-sm" style={{ background: GOLD_BAR }} aria-hidden="true" />
              <E p="testimonials.eyebrow">{testimonials.eyebrow}</E>
            </div>
          )}
          {review && (
            <>
              <div className="mt-[18px] font-heading text-[60px] font-extrabold leading-none tracking-[-0.016em] text-accent sm:text-[72px]">
                {review.rating}
              </div>
              <div className="mt-1.5 text-[19px] tracking-[4px] text-accent" aria-hidden="true">★★★★★</div>
              <div
                className="mt-3 text-[12px] font-bold uppercase leading-none tracking-[0.18em]"
                style={{ color: 'color-mix(in srgb, var(--ink-soft) 70%, var(--bg))' }}
              >
                {review.count}+ verified reviews
              </div>
            </>
          )}
        </div>

        <div className="rv-stagger mt-10 grid gap-4 sm:mt-12 md:grid-cols-2 md:gap-5">
          {items.slice(0, 2).map((t, i) => (
            <figure
              key={t.a || i}
              className="flex flex-col rounded-[12px] border border-[color:color-mix(in_srgb,var(--ink)_9%,transparent)] bg-[color:color-mix(in_srgb,var(--ink)_4%,transparent)] p-6 transition-[border-color,background-color,transform] duration-300 hover:-translate-y-[3px] hover:border-[color:color-mix(in_srgb,var(--accent)_45%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--ink)_6%,transparent)] sm:p-7"
            >
              <div className="flex gap-0.5 text-accent" aria-hidden="true">
                {Array.from({ length: 5 }, (_, j) => (
                  <Star key={j} size={15} weight="fill" className={j < (t.stars || 5) ? '' : 'opacity-25'} />
                ))}
              </div>
              <blockquote className="mt-4 flex-1 font-heading text-[18px] font-medium leading-[1.55] tracking-[-0.012em] text-ink sm:text-[19px]">
                <E p={`testimonials.items.${i}.q`}>{t.q}</E>
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-[13px] border-t border-[color:color-mix(in_srgb,var(--ink)_9%,transparent)] pt-5">
                {avatars[i] ? (
                  <span className="relative h-11 w-11 shrink-0 rounded-full isolate overflow-hidden">
                    <CoverImage url={avatars[i]} alt="" sizes="96px" />
                  </span>
                ) : (
                  <span
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full font-heading text-[18px] font-extrabold text-accentFg"
                    style={{ background: GOLD_MARK }}
                  >
                    {(t.a || '?').trim().charAt(0).toUpperCase()}
                  </span>
                )}
                <span>
                  <b className="block text-[14.5px] font-semibold leading-[1.2] text-ink"><E p={`testimonials.items.${i}.a`}>{t.a}</E></b>
                  <small className="text-[12.5px] text-inkSoft"><E p={`testimonials.items.${i}.r`}>{t.r}</E></small>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
