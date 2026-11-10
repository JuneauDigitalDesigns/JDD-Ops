'use client';
// ─────────────────────────────────────────────────────────────────────────────
// RoofingFaq — "structural / weatherproof" FAQ, premium pass (2026-11-09, approved mockup).
// TWO-COLUMN hairline rows, no cards (one column on a phone), first item open. The eyebrow takes
// the accent-bar tick; an open question turns accent and its plus rotates to a cross. Native
// <details> (keyboard-accessible, no JS). Reads faq.{eyebrow,title,items}. Colours are palette
// tokens (ink, ink-soft, rule, accent).
// ─────────────────────────────────────────────────────────────────────────────
import { Plus } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'roofing-faq',
  category: 'faq',
  label: 'Roofing / Two-column hairline FAQ',
  consumes: ['faq.eyebrow', 'faq.title', 'faq.items'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/editable'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

export default function RoofingFaq({ content = CONTENT }: { content?: SiteContent }) {
  const { faq } = content;
  const items = faq.items.filter((f) => f.q?.trim());
  if (!items.length) return null;

  return (
    <section className="bg-bg py-14 lg:py-[88px]">
      <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
        <div className="max-w-[52ch]">
          {faq.eyebrow && (
            <div className="flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-accent">
              <span className="accent-bar !h-[3px] !w-7 !rounded-[2px]" aria-hidden="true" />
              <E p="faq.eyebrow">{faq.eyebrow}</E>
            </div>
          )}
          <h2 className="mt-4 font-heading text-[clamp(30px,3.2vw,36px)] font-extrabold leading-[1.02] tracking-[-0.024em] text-ink">
            <E p="faq.title">{faq.title}</E>
          </h2>
        </div>

        <div className="mt-10 grid gap-x-12 md:grid-cols-2">
          {items.map((item, i) => (
            <details key={item.q || i} open={i === 0} className="group border-b border-rule">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-[16px] font-bold leading-[1.3] tracking-[-0.01em] text-ink transition-colors hover:text-accent group-open:text-accent [&::-webkit-details-marker]:hidden">
                <E p={`faq.items.${i}.q`}>{item.q}</E>
                <Plus size={17} weight="bold" className="shrink-0 text-accent transition-transform duration-300 group-open:rotate-45" aria-hidden="true" />
              </summary>
              <p className="max-w-[46ch] pb-[22px] text-[15px] leading-[1.7] text-inkSoft">
                <E p={`faq.items.${i}.a`}>{item.a}</E>
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
