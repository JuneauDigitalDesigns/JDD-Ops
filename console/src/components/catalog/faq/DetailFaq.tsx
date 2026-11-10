'use client';
// ─────────────────────────────────────────────────────────────────────────────
// DetailFaq — pure hairline rows on the slate band, premium pass (2026-11-09, approved mockup).
// No cards at all — a bordered stack with a top rule and a bottom rule per row; the open row's
// question turns the accent and its plus rotates 45° (a plain cross, not a chevron). Champagne
// eyebrow with a short gold bar. Reads faq.{eyebrow,title,items}. Native <details>, first open.
//
// Every colour is a palette token. The band is bg mixed toward ink (the mockup's #1B1E26 slate):
// this palette's derived --ink-panel-2 is accent-tinted olive, on which the rule hairlines that
// ARE this section's design all but disappear.
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

const GOLD_BAR = 'linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 65%, black) 60%, transparent)';

export default function DetailFaq({ content = CONTENT }: { content?: SiteContent }) {
  const { faq } = content;
  const items = faq.items.filter((f) => f.q?.trim());
  if (!items.length) return null;

  return (
    <section className="py-14 sm:py-[92px]" style={{ background: 'color-mix(in srgb, var(--bg) 93%, var(--ink))' }}>
      <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
        <div className="mx-auto max-w-[620px] text-center">
          {faq.eyebrow && (
            <div className="flex items-center justify-center gap-2.5 text-[11.5px] font-semibold uppercase leading-none tracking-[0.26em] text-accent">
              <span className="h-[3px] w-7 shrink-0 rounded-sm" style={{ background: GOLD_BAR }} aria-hidden="true" />
              <E p="faq.eyebrow">{faq.eyebrow}</E>
            </div>
          )}
          <h2 className="mt-4 font-heading text-[clamp(30px,3.2vw,36px)] font-extrabold leading-[1.04] tracking-[-0.016em] text-ink">
            <E p="faq.title">{faq.title}</E>
          </h2>
        </div>

        <div className="mx-auto mt-10 max-w-[820px] border-t border-rule">
          {items.map((item, i) => (
            <details key={item.q || i} open={i === 0} className="group border-b border-rule">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-[18px] px-1 py-6 text-[16.5px] font-bold leading-[1.2] text-ink transition-colors duration-200 hover:text-accent group-open:text-accent [&::-webkit-details-marker]:hidden">
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
