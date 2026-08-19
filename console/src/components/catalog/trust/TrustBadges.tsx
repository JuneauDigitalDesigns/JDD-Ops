'use client';
// ─────────────────────────────────────────────────────────────────────────────
// TrustBadges — recomposed 2026-08-19 against design/catalog-v2/SPEC.md.
//
// Credentials as solid chips rather than pill outlines, on the inverted surface
// so the band reads as a deliberate break in the page rhythm instead of another
// faint strip. Separation by mass, not by hairlines (SPEC §1).
//
// The per-chip stagger is gone. It was a framer-motion reveal on a row of four
// short strings — motion that cost a client bundle and a hydration boundary to
// animate something the reader takes in at a glance.
// ─────────────────────────────────────────────────────────────────────────────
import { SealCheck, Star } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'trust-badges',
  category: 'trust',
  label: 'Trust / Badges',
  consumes: ['extensions.trustBadges', 'extensions.reviewBadge'],
  sharedDeps: ['@phosphor-icons/react'],
} as const;

export default function TrustBadges({ content = CONTENT }: { content?: SiteContent }) {
  const { extensions } = content;
  const badges = extensions.trustBadges;
  const review = extensions.reviewBadge;

  // Degrade away entirely rather than render an empty shell — a client with no
  // credentials on file should not get a band announcing that (SPEC §7).
  if (!badges?.length && !review) return null;

  return (
    <section className="bg-inkPanel text-onInk">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-2.5 px-5 py-7 sm:px-6">
        {badges?.map((badge, i) => (
          <span
            key={badge}
            className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2.5 text-[15px] font-bold"
          >
            <SealCheck size={18} weight="fill" className="text-accent" aria-hidden="true" />
            <E p={`extensions.trustBadges.${i}`}>{badge}</E>
          </span>
        ))}

        {review && (
          <a
            href={review.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-[15px] font-extrabold text-accentFg transition-[filter] hover:brightness-105"
          >
            <Star size={18} weight="fill" aria-hidden="true" />
            {review.rating} / 5
            {/* No opacity: this sits on the accent, where legibility comes from the measured
                --accent-fg and an opacity multiplier would discard it. See HeroSplit. */}
            <span className="font-semibold">({review.count} reviews)</span>
          </a>
        )}
      </div>
    </section>
  );
}
