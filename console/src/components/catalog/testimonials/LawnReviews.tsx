'use client';
// ─────────────────────────────────────────────────────────────────────────────
// LawnReviews — "seasonal / organic / airy" proof, premium pass (2026-11-09, approved mockup).
// Centred accent eyebrow + heading, the rating PILL (score + gold stars + verified count, only
// from extensions.reviewBadge), then THREE identical cards became one FEATURED quote (wide,
// 22–30px, a large green quote mark) beside two compact cards. Same items, same fields, same cap
// of three. PHOTO avatars (images.testimonials.avatars, cycled by index — an initial on the
// accent-bar when none are set). Reads testimonials.{eyebrow,title,items} + extensions.
// reviewBadge; returns null with no items and drops only the pill when reviewBadge is null.
// Every colour is a palette token; the stars are the fixed --star semantic. Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { CoverImage } from '@/lib/CoverImage';

export const meta = {
  id: 'lawn-reviews',
  category: 'testimonials',
  label: 'Lawn / Hairline reviews',
  consumes: ['testimonials.eyebrow', 'testimonials.title', 'testimonials.items', 'extensions.reviewBadge', 'images.testimonials.avatars'],
  sharedDeps: ['@/lib/CoverImage', '@/lib/editable'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

type Item = SiteContent['testimonials']['items'][number];

function Quote({ t, i, avatar, featured }: { t: Item; i: number; avatar: string | undefined; featured: boolean }) {
  const size = featured ? 'h-[52px] w-[52px] text-[21px]' : 'h-11 w-11 text-[18px]';
  return (
    <figure
      className={`shadow-brand-1 relative flex flex-col rounded-[22px] border border-rule bg-bg transition-[border-color,box-shadow] duration-300 hover:border-[color:color-mix(in_srgb,var(--accent)_35%,var(--rule))] hover:shadow-brand-2 ${
        featured ? 'justify-center p-7 lg:p-10' : 'p-6 lg:p-7'
      }`}
    >
      {featured && (
        <span
          className="pointer-events-none absolute right-7 top-4 font-heading text-[140px] font-extrabold leading-[0.8]"
          style={{ color: 'color-mix(in srgb, var(--accent) 12%, var(--bg))' }}
          aria-hidden="true"
        >
          &ldquo;
        </span>
      )}
      <div className="relative text-[15px] tracking-[2px] text-[color:var(--star)]" aria-hidden="true">
        {'★'.repeat(t.stars || 5)}
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
        {avatar ? (
          <span
            className={`relative shrink-0 rounded-full ${size} isolate overflow-hidden`}
          >
            <CoverImage url={avatar} alt={t.a} sizes="96px" />
          </span>
        ) : (
          <span
            className={`grid shrink-0 place-items-center rounded-full font-heading font-extrabold text-[color:var(--accent-2-fg)] ${size}`}
            style={{ background: 'var(--accent-bar)' }}
          >
            {(t.a || '?').trim().charAt(0).toUpperCase()}
          </span>
        )}
        <span>
          <b className="block text-[15px] text-ink"><E p={`testimonials.items.${i}.a`}>{t.a}</E></b>
          <small className="text-[13px] text-inkSoft"><E p={`testimonials.items.${i}.r`}>{t.r}</E></small>
        </span>
      </figcaption>
    </figure>
  );
}

export default function LawnReviews({ content = CONTENT }: { content?: SiteContent }) {
  const { testimonials, extensions, images } = content;
  const items = testimonials.items.filter((t) => t.q?.trim()).slice(0, 3);
  if (!items.length) return null;
  const review = extensions.reviewBadge;
  const avatars = images.testimonials?.avatars ?? [];
  const avatarAt = (i: number) => avatars[i % Math.max(avatars.length, 1)];
  const [first, ...rest] = items;

  return (
    <section className="bg-bg py-16 lg:py-[92px]">
      <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
        <div className="mx-auto max-w-[640px] text-center">
          {testimonials.eyebrow && (
            <div className="flex items-center justify-center gap-2.5 text-[12px] font-bold uppercase tracking-[0.14em] text-accent">
              <span className="accent-bar !h-[3px] !w-7" aria-hidden="true" />
              <E p="testimonials.eyebrow">{testimonials.eyebrow}</E>
            </div>
          )}
          <h2 className="mt-4 font-heading text-[30px] font-extrabold leading-[1.04] tracking-[-0.02em] text-ink lg:text-[36px]">
            <E p="testimonials.title">{testimonials.title}</E>
          </h2>
          {review && (
            <div className="shadow-brand-1 mt-[22px] inline-flex items-center gap-3.5 rounded-[18px] border border-rule bg-bg px-[26px] py-[14px]">
              <span className="font-heading text-[34px] font-extrabold leading-none tracking-[-0.02em] text-accent">{review.rating}</span>
              <span className="flex flex-col items-start gap-0.5">
                <span className="text-[14px] tracking-[2px] text-[color:var(--star)]" aria-hidden="true">★★★★★</span>
                <span className="text-[12.5px] font-semibold text-inkSoft">Based on {review.count}+ verified reviews</span>
              </span>
            </div>
          )}
        </div>

        <div className={`mt-8 grid gap-4 lg:mt-11 lg:gap-[22px] ${rest.length ? 'lg:grid-cols-[1.5fr_1fr]' : 'mx-auto max-w-[720px]'}`}>
          <Quote key={first.a || 0} t={first} i={0} avatar={avatarAt(0)} featured />
          {rest.length > 0 && (
            <div className="rv-stagger grid gap-4 lg:gap-[22px]">
              {rest.map((t, k) => (
                <Quote key={t.a || k + 1} t={t} i={k + 1} avatar={avatarAt(k + 1)} featured={false} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
