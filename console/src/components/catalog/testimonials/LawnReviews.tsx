'use client';
// ─────────────────────────────────────────────────────────────────────────────
// LawnReviews — "seasonal / organic / airy" proof, mirrored 1:1 (#lawn .rev-head / .qcard).
// Hairline-only cards (no shadow-card like HVAC, no dark panel like roofing), PHOTO avatars
// (images.testimonials.avatars, cycled by index — falls back to an initial-letter circle when
// none are set), sun-gold stars. Reads testimonials.{eyebrow,title,items} + extensions.
// reviewBadge. Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { imageAt } from '@/lib/localImage';

export const meta = {
  id: 'lawn-reviews',
  category: 'testimonials',
  label: 'Lawn / Hairline reviews',
  consumes: ['testimonials.eyebrow', 'testimonials.title', 'testimonials.items', 'extensions.reviewBadge', 'images.testimonials.avatars'],
  sharedDeps: ['@/lib/editable'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

export default function LawnReviews({ content = CONTENT }: { content?: SiteContent }) {
  const { testimonials, extensions, images } = content;
  const items = testimonials.items.filter((t) => t.q?.trim()).slice(0, 3);
  if (!items.length) return null;
  const review = extensions.reviewBadge;
  const avatars = images.testimonials?.avatars ?? [];

  return (
    <section className="bg-bg py-[92px]">
      <div className="mx-auto max-w-[1140px] px-6">
        <div className="mx-auto max-w-[620px] text-center">
          {testimonials.eyebrow && (
            <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-accent">
              <E p="testimonials.eyebrow">{testimonials.eyebrow}</E>
            </div>
          )}
          <h2 className="mt-3 font-heading text-[38px] font-extrabold leading-[1.04] tracking-[-0.02em] text-ink">
            <E p="testimonials.title">{testimonials.title}</E>
          </h2>
          {review && (
            <div className="mt-5 inline-flex items-center gap-3.5 rounded-[18px] border border-rule bg-bg px-6 py-[14px]">
              <span className="font-heading text-[32px] font-extrabold leading-none tracking-[-0.03em] text-accent">{review.rating}</span>
              <span className="flex flex-col items-start gap-0.5">
                <span className="text-[14px] tracking-[2px] text-[#E8B33A]" aria-hidden="true">★★★★★</span>
                <span className="text-[12.5px] font-semibold text-inkSoft">Based on {review.count}+ verified reviews</span>
              </span>
            </div>
          )}
        </div>

        <div className="mt-11 grid gap-[18px] lg:grid-cols-3">
          {items.map((t, i) => {
            const avatar = avatars[i % Math.max(avatars.length, 1)];
            return (
              <figure key={t.a || i} className="flex flex-col rounded-[24px] border border-rule bg-bg p-7">
                <div className="text-[14px] tracking-[2px] text-[#E8B33A]" aria-hidden="true">
                  {'★'.repeat(t.stars || 5)}
                </div>
                <blockquote className="mt-3.5 flex-1 text-[15.5px] leading-[1.65] text-ink">
                  <E p={`testimonials.items.${i}.q`}>{t.q}</E>
                </blockquote>
                <figcaption className="mt-[22px] flex items-center gap-3 border-t border-rule pt-[18px]">
                  {avatar ? (
                    <span
                      className="h-11 w-11 shrink-0 rounded-full bg-cover bg-center"
                      style={{ backgroundImage: `url(${imageAt(avatar, 640)})` }}
                      role="img"
                      aria-label={t.a}
                    />
                  ) : (
                    <span
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-full font-heading text-[18px] font-extrabold text-[#fff]"
                      style={{ background: 'linear-gradient(145deg,#3E9843,#1E4028)' }}
                    >
                      {(t.a || '?').trim().charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span>
                    <b className="block text-[14.5px] text-ink"><E p={`testimonials.items.${i}.a`}>{t.a}</E></b>
                    <small className="text-[13px] text-inkSoft"><E p={`testimonials.items.${i}.r`}>{t.r}</E></small>
                  </span>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}
