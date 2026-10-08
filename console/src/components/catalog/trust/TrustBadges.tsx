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
  consumes: ['extensions.trustBadges', 'extensions.reviewBadge', 'trust.label', 'trust.logos'],
  sharedDeps: ['@phosphor-icons/react'],
  /** Structural archetype, from src/lib/archetypes.ts. Unique within the category. */
  archetype: 'inline-strip',
  /** True if this component owns a SIGNATURE motion moment (a scroll-linked transform, a pin,
   *  a count-up). Decision 26 budgets these per PAGE, not per section: at most two on a page,
   *  enforced by console/test/page-rhythm.test.mjs. Micro-reveals are free and do not count. */
  signature: false,
} as const;

export default function TrustBadges({ content = CONTENT }: { content?: SiteContent }) {
  const { extensions, trust } = content;
  const badges = extensions.trustBadges;
  const review = extensions.reviewBadge;
  // Brands carried (decision 29) live in trust.logos, fed from the intake's brandsCarried field.
  // Guarded like everything else here: an empty list shows nothing.
  const brands = trust.logos;

  // Degrade away entirely rather than render an empty shell — a client with no
  // credentials on file should not get a band announcing that (SPEC §7).
  if (!badges?.length && !review && !brands?.length) return null;

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

      {/* Brands carried (decision 29): a second row, labelled, so "Brands we install: Carrier,
          Trane" reads as its own trust signal rather than mixing with the certification chips.
          Guarded — renders only when the client supplied brands. */}
      {brands?.length ? (
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-2.5 px-5 pb-7 sm:px-6">
          {trust.label ? (
            <span className="self-center text-xs font-bold uppercase tracking-widest text-onInk">
              <E p="trust.label">{trust.label}</E>
            </span>
          ) : null}
          {brands.map((brand, i) => (
            <span key={brand} className="rounded-lg bg-white/10 px-4 py-2.5 text-[15px] font-bold">
              <E p={`trust.logos.${i}`}>{brand}</E>
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
