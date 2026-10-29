'use client';
// ─────────────────────────────────────────────────────────────────────────────
// HvacFaq — Northstar "Home — Standard" FAQ accordion, mirrored 1:1 (`.faq`).
// A centered head (accent eyebrow → display heading) over a stack of bordered, rounded
// accordion rows; each summary carries an accent "+" that rotates open. Reads faq.{eyebrow,
// title,items}. Native <details> (keyboard-accessible, no JS). Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { Plus } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'hvac-faq',
  category: 'faq',
  label: 'HVAC / FAQ accordion',
  consumes: ['faq.eyebrow', 'faq.title', 'faq.items'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/editable'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

export default function HvacFaq({ content = CONTENT }: { content?: SiteContent }) {
  const { faq } = content;
  const items = faq.items.filter((f) => f.q?.trim());
  if (!items.length) return null;

  return (
    <section id="faq" className="bg-bg py-[84px]">
      <div className="mx-auto max-w-[1120px] px-6">
        <div className="mx-auto max-w-[620px] text-center">
          {faq.eyebrow && (
            <div className="text-[12.5px] font-bold uppercase tracking-[0.17em] text-accent">
              <E p="faq.eyebrow">{faq.eyebrow}</E>
            </div>
          )}
          <h2 className="mt-3 font-heading text-[38px] font-semibold leading-[1.04] text-ink">
            <E p="faq.title">{faq.title}</E>
          </h2>
        </div>

        <div className="mx-auto mt-9 max-w-[760px]">
          {items.map((item, i) => (
            <details
              key={item.q || i}
              open={i === 0}
              className="group mt-3 overflow-hidden rounded-[16px] border border-rule bg-bg shadow-[0_1px_2px_rgba(19,41,63,0.06)] open:border-[rgba(224,96,44,0.35)] open:shadow-[0_2px_6px_rgba(19,41,63,0.07),0_14px_30px_-12px_rgba(19,41,63,0.22)]"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-[22px] text-[16.5px] font-bold text-ink [&::-webkit-details-marker]:hidden">
                <E p={`faq.items.${i}.q`}>{item.q}</E>
                <Plus size={18} weight="bold" className="shrink-0 text-accent transition-transform duration-300 group-open:rotate-45" aria-hidden="true" />
              </summary>
              <p className="px-6 pb-[28px] pt-1.5 text-[15.5px] leading-[1.72] text-inkSoft">
                <E p={`faq.items.${i}.a`}>{item.a}</E>
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
