'use client';
// ─────────────────────────────────────────────────────────────────────────────
// LawnFaq — "seasonal / organic / airy" FAQ, mirrored 1:1 (#lawn .faq). Big soft rounded rows
// (20px radius, tinted background when open) — not HVAC's tighter card or roofing's two-column
// hairline. Native <details> (keyboard-accessible, no JS). Reads faq.{eyebrow,title,items}.
// Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { Plus } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'lawn-faq',
  category: 'faq',
  label: 'Lawn / Soft-row FAQ',
  consumes: ['faq.eyebrow', 'faq.title', 'faq.items'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/editable'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

export default function LawnFaq({ content = CONTENT }: { content?: SiteContent }) {
  const { faq } = content;
  const items = faq.items.filter((f) => f.q?.trim());
  if (!items.length) return null;

  return (
    <section className="bg-bgSoft py-[92px]">
      <div className="mx-auto max-w-[1140px] px-6">
        <div className="mx-auto max-w-[620px] text-center">
          {faq.eyebrow && (
            <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-accent">
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
              className="group mt-3 overflow-hidden rounded-[20px] border border-rule bg-bg open:border-[rgba(47,122,51,0.3)] open:bg-bgSoft"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-[25px] py-[21px] text-[16.5px] font-bold leading-[1.3] tracking-[-0.012em] text-ink [&::-webkit-details-marker]:hidden">
                <E p={`faq.items.${i}.q`}>{item.q}</E>
                <Plus size={18} weight="bold" className="shrink-0 text-accent transition-transform duration-300 group-open:rotate-45" aria-hidden="true" />
              </summary>
              <p className="px-[25px] pb-[25px] text-[15.5px] leading-[1.72] text-inkSoft">
                <E p={`faq.items.${i}.a`}>{item.a}</E>
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
