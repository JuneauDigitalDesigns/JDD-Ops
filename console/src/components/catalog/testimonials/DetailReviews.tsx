'use client';
// ─────────────────────────────────────────────────────────────────────────────
// DetailReviews — two large quotes on dark with a centred aggregate, mirrored 1:1 (#detail
// .rev-head/.q2/.qcard). ONE big gold numeral + stars + source line centred above a 2-up grid of
// full-bleed quote cards (not three small cards like every other vertical). reviewBadge null ->
// aggregate omitted, quote cards still render (D5). Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { Star } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { imageAt } from '@/lib/localImage';

export const meta = {
  id: 'detail-reviews',
  category: 'testimonials',
  label: 'Car Detailing / Two large quotes',
  consumes: ['testimonials.eyebrow', 'testimonials.items', 'extensions.reviewBadge', 'images.testimonials.avatars'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/editable'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

export default function DetailReviews({ content = CONTENT }: { content?: SiteContent }) {
  const { testimonials, extensions, images } = content;
  const items = testimonials.items.filter((t) => t.q?.trim());
  if (!items.length) return null;
  const review = extensions.reviewBadge;
  const avatars = images.testimonials?.avatars ?? [];

  return (
    <section className="bg-bg py-[92px]">
      <div className="mx-auto max-w-[1180px] px-6">
        <div className="mx-auto max-w-[660px] text-center">
          {testimonials.eyebrow && (
            <div className="text-[11.5px] font-bold uppercase tracking-[0.26em] text-accent">
              <E p="testimonials.eyebrow">{testimonials.eyebrow}</E>
            </div>
          )}
          {review && (
            <>
              <div className="mt-[18px] font-heading text-[68px] font-extrabold leading-none tracking-[-0.04em] text-accent">
                {review.rating}
              </div>
              <div className="mt-1.5 text-[19px] tracking-[4px] text-accent" aria-hidden="true">★★★★★</div>
              <div className="mt-3 text-[12px] font-bold uppercase tracking-[0.18em]" style={{ color: '#6C7686' }}>
                {review.count}+ verified reviews
              </div>
            </>
          )}
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          {items.slice(0, 2).map((t, i) => (
            <figure
              key={t.a || i}
              className="flex flex-col rounded-[12px] p-8"
              style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.085)' }}
            >
              <div className="flex text-[14px] tracking-[2px] text-accent" aria-hidden="true">
                {Array.from({ length: 5 }, (_, j) => (
                  <Star key={j} size={15} weight="fill" className={j < (t.stars || 5) ? '' : 'opacity-25'} />
                ))}
              </div>
              <blockquote className="mt-4 flex-1 font-heading text-[19px] font-medium leading-[1.55] tracking-[-0.012em] text-[#E8ECF2]">
                <E p={`testimonials.items.${i}.q`}>{t.q}</E>
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-[13px] pt-5" style={{ borderTop: '1px solid rgba(255,255,255,0.09)' }}>
                {avatars[i] ? (
                  <span className="h-[42px] w-[42px] shrink-0 rounded-full bg-cover bg-center" style={{ backgroundImage: `url(${imageAt(avatars[i], 640)})` }} />
                ) : (
                  <span
                    className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full font-heading text-[16px] font-extrabold text-[#0D0E12]"
                    style={{ background: 'linear-gradient(145deg,#C9A14B,#8A6A26)' }}
                  >
                    {(t.a || '?').trim().charAt(0).toUpperCase()}
                  </span>
                )}
                <span>
                  <b className="block text-[14.5px] text-ink"><E p={`testimonials.items.${i}.a`}>{t.a}</E></b>
                  <small className="text-[12.5px]" style={{ color: '#6C7686' }}><E p={`testimonials.items.${i}.r`}>{t.r}</E></small>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
