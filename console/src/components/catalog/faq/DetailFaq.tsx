'use client';
// ─────────────────────────────────────────────────────────────────────────────
// DetailFaq — pure hairline rows, mirrored 1:1 (#detail .faqrows). No cards at all — a bordered
// stack with a top rule and a bottom rule per row, the plus icon rotating 45° on open (not 90°,
// since the mockup's icon is a plain cross, not a chevron). Reads faq.{eyebrow,title,items}.
// Native <details>. Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { Plus } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'detail-faq',
  category: 'faq',
  label: 'Car Detailing / Hairline-row FAQ',
  consumes: ['faq.eyebrow', 'faq.title', 'faq.items'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/editable'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

export default function DetailFaq({ content = CONTENT }: { content?: SiteContent }) {
  const { faq } = content;
  const items = faq.items.filter((f) => f.q?.trim());
  if (!items.length) return null;

  return (
    <section className="py-[92px]" style={{ background: '#1B1E26' }}>
      <div className="mx-auto max-w-[1180px] px-6">
        <div className="mx-auto max-w-[620px] text-center">
          {faq.eyebrow && (
            <div className="text-[11.5px] font-bold uppercase tracking-[0.26em] text-accent">
              <E p="faq.eyebrow">{faq.eyebrow}</E>
            </div>
          )}
          <h2 className="mt-3.5 font-heading text-[36px] font-extrabold leading-[1.04] text-ink">
            <E p="faq.title">{faq.title}</E>
          </h2>
        </div>

        <div className="mx-auto mt-10 max-w-[820px] border-t border-rule">
          {items.map((item, i) => (
            <details key={item.q || i} open={i === 0} className="group border-b border-rule">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-[18px] px-1 py-6 text-[16.5px] font-bold leading-[1.1] tracking-[-0.012em] text-ink [&::-webkit-details-marker]:hidden">
                <E p={`faq.items.${i}.q`}>{item.q}</E>
                <Plus size={18} weight="bold" className="shrink-0 text-accent transition-transform duration-300 group-open:rotate-45" aria-hidden="true" />
              </summary>
              <p className="max-w-[62ch] px-1 pb-[26px] text-[15.5px] leading-[1.75] text-inkSoft">
                <E p={`faq.items.${i}.a`}>{item.a}</E>
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
