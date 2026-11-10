'use client';
// ─────────────────────────────────────────────────────────────────────────────
// HvacFaq — Northstar "Home — Standard" FAQ, premium pass (2026-11-09, approved mockup).
// A centred head (steel eyebrow → display heading) over a 760px HAIRLINE list: bordered boxes
// became rows separated by rules; the open question turns steel and its accent "+" rotates to ×.
// Reads faq.{eyebrow,title,items}. Native <details> (keyboard-accessible, no JS), first row open,
// as before. Every colour is a palette token.
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
    <section id="faq" className="bg-bg py-14 lg:py-20">
      <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
        <div className="mx-auto max-w-[620px] text-center">
          {faq.eyebrow && (
            <div className="flex items-center justify-center gap-2.5 text-[12px] font-bold uppercase tracking-[0.14em] text-[color:var(--accent-2)]">
              <span className="accent-bar !h-[3px] !w-7" aria-hidden="true" />
              <E p="faq.eyebrow">{faq.eyebrow}</E>
            </div>
          )}
          <h2 className="mt-4 font-heading text-[30px] font-semibold leading-[1.04] text-ink lg:text-[36px]">
            <E p="faq.title">{faq.title}</E>
          </h2>
        </div>

        <div className="mx-auto mt-9 max-w-[760px] border-t border-rule">
          {items.map((item, i) => (
            <details key={item.q || i} open={i === 0} className="group border-b border-rule">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-1 py-[22px] text-[16.5px] font-bold leading-[1.35] text-ink transition-colors group-open:text-[color:var(--accent-2)] [&::-webkit-details-marker]:hidden">
                <E p={`faq.items.${i}.q`}>{item.q}</E>
                <Plus size={18} weight="bold" className="shrink-0 text-accent transition-transform duration-300 group-open:rotate-45" aria-hidden="true" />
              </summary>
              <p className="max-w-[62ch] px-1 pb-[26px] text-[15.5px] leading-[1.72] text-inkSoft">
                <E p={`faq.items.${i}.a`}>{item.a}</E>
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
