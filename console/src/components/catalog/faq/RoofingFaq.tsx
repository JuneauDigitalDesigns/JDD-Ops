'use client';
// ─────────────────────────────────────────────────────────────────────────────
// RoofingFaq — "structural / weatherproof" FAQ, mirrored 1:1 (#roofing .faq2). TWO-COLUMN
// hairline rows, no cards — the opposite treatment from HVAC's single-column bordered-card
// accordion. Native <details> (keyboard-accessible, no JS). Reads faq.{eyebrow,title,items}.
// Fixed design, no skin.
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
    <section className="bg-bg py-[88px]">
      <div className="mx-auto max-w-[1160px] px-6">
        <div className="max-w-[52ch]">
          {faq.eyebrow && (
            <div className="text-[12px] font-bold uppercase tracking-[0.2em] text-accent">
              <E p="faq.eyebrow">{faq.eyebrow}</E>
            </div>
          )}
          <h2 className="mt-3.5 font-heading text-[38px] font-extrabold leading-[0.98] tracking-[-0.024em] text-ink">
            <E p="faq.title">{faq.title}</E>
          </h2>
        </div>

        <div className="mt-10 grid gap-x-12 md:grid-cols-2">
          {items.map((item, i) => (
            <details key={item.q || i} open={i === 0} className="group border-b border-rule">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-[16px] font-bold leading-[1.3] tracking-[-0.01em] text-ink [&::-webkit-details-marker]:hidden">
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
