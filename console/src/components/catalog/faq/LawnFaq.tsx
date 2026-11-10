'use client';
// ─────────────────────────────────────────────────────────────────────────────
// LawnFaq — "seasonal / organic / airy" FAQ, premium pass (2026-11-09, approved mockup). A
// centred head (accent eyebrow with a short accent-bar → display heading) over an 800px stack of
// big soft rounded rows (20px radius) on the soft band; the open row tints and takes a green
// border, and its accent "+" turns to ×. Native <details> (keyboard-accessible, no JS), first row
// open. Reads faq.{eyebrow,title,items}. Every colour is a palette token. Fixed design, no skin.
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
    <section className="bg-bgSoft py-14 lg:py-[92px]">
      <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
        <div className="mx-auto max-w-[620px] text-center">
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
              className="group mt-[11px] overflow-hidden rounded-[20px] border border-rule bg-bg transition-colors duration-300 open:border-[color:color-mix(in_srgb,var(--accent)_30%,var(--rule))] open:bg-bgSoft"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 text-[16.5px] font-bold leading-[1.3] tracking-[-0.012em] text-ink sm:px-6 [&::-webkit-details-marker]:hidden">
                <E p={`faq.items.${i}.q`}>{item.q}</E>
                <Plus size={18} weight="bold" className="shrink-0 text-accent transition-transform duration-300 group-open:rotate-45" aria-hidden="true" />
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
