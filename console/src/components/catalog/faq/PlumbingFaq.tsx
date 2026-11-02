'use client';
// ─────────────────────────────────────────────────────────────────────────────
// PlumbingFaq — rounded accordion rows with an accent LEFT-EDGE when open, mirrored 1:1
// (#plumbing .faq). Differs from HvacFaq's uniform-border-glow-on-open treatment: a transparent
// 3px left border turns accent-coloured and the row tints to bg-soft only while expanded. Reads
// faq.{eyebrow,title,items}. Native <details>. Fixed design, no skin.
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
    <section className="bg-bgSoft py-[84px]">
      <div className="mx-auto max-w-[1160px] px-6">
        <div className="mx-auto max-w-[640px] text-center">
          {faq.eyebrow && (
            <div className="text-[12px] font-bold uppercase tracking-[0.15em] text-accent">
              <E p="faq.eyebrow">{faq.eyebrow}</E>
            </div>
          )}
          <h2 className="mt-3 font-heading text-[38px] font-extrabold leading-[1.04] tracking-[-0.02em] text-ink">
            <E p="faq.title">{faq.title}</E>
          </h2>
        </div>

        <div className="mx-auto mt-9 max-w-[800px]">
          {items.map((item, i) => (
            <details
              key={item.q || i}
              open={i === 0}
              className="group mt-[11px] overflow-hidden rounded-[16px] border border-l-[3px] border-rule border-l-transparent bg-bg open:border-l-accent open:bg-bgSoft"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-[16.5px] font-bold leading-[1.1] tracking-[-0.012em] text-ink [&::-webkit-details-marker]:hidden">
                <E p={`faq.items.${i}.q`}>{item.q}</E>
                <CaretDown size={18} weight="bold" className="shrink-0 text-accent transition-transform duration-300 group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="px-6 pb-6 text-[15.5px] leading-[1.72] text-inkSoft">
                <E p={`faq.items.${i}.a`}>{item.a}</E>
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
