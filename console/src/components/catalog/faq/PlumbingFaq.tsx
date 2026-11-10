'use client';
// ─────────────────────────────────────────────────────────────────────────────
// PlumbingFaq — rounded accordion rows with an accent LEFT-EDGE when open, premium pass
// (2026-11-09, approved mockup). Differs from HvacFaq's hairline list: each question is its own
// 20px card; a transparent 3px left border turns accent and the row tints to bg-soft only while
// expanded, and the accent caret rotates. Centred head: accent eyebrow on its accent-bar →
// heading. Reads faq.{eyebrow,title,items}. Native <details>, first row open.
// Every colour is a palette token. Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { CaretDown } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'plumbing-faq',
  category: 'faq',
  label: 'Plumbing / Accent-edge FAQ',
  consumes: ['faq.eyebrow', 'faq.title', 'faq.items'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/editable'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

export default function PlumbingFaq({ content = CONTENT }: { content?: SiteContent }) {
  const { faq } = content;
  const items = faq.items.filter((f) => f.q?.trim());
  if (!items.length) return null;

  return (
    <section className="bg-bgSoft py-14 lg:py-[84px]">
      <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
        <div className="mx-auto max-w-[640px] text-center">
          {faq.eyebrow && (
            <div className="flex items-center justify-center gap-2.5 text-[12px] font-bold uppercase tracking-[0.14em] text-accent">
              <span className="accent-bar !h-[3px] !w-7" aria-hidden="true" />
              <E p="faq.eyebrow">{faq.eyebrow}</E>
            </div>
          )}
          <h2 className="mt-4 font-heading text-[30px] font-extrabold leading-[1.04] tracking-[-0.02em] text-ink lg:text-[36px]">
            <E p="faq.title">{faq.title}</E>
          </h2>
        </div>

        <div className="mx-auto mt-9 max-w-[800px]">
          {items.map((item, i) => (
            <details
              key={item.q || i}
              open={i === 0}
              className="group mt-[11px] overflow-hidden rounded-[20px] border border-l-[3px] border-rule border-l-transparent bg-bg transition-colors duration-300 open:border-l-accent open:bg-bgSoft"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-[18px] text-[16px] font-bold leading-[1.25] tracking-[-0.012em] text-ink sm:px-6 sm:py-5 sm:text-[16.5px] [&::-webkit-details-marker]:hidden">
                <E p={`faq.items.${i}.q`}>{item.q}</E>
                <CaretDown size={18} weight="bold" className="shrink-0 text-accent transition-transform duration-300 group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="px-5 pb-6 text-[15.5px] leading-[1.72] text-inkSoft sm:px-6">
                <E p={`faq.items.${i}.a`}>{item.a}</E>
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
