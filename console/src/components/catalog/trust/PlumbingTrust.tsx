'use client';
// ─────────────────────────────────────────────────────────────────────────────
// PlumbingTrust — centred coverage section, premium pass (2026-11-09, approved mockup). Built
// around one oversized "24/7" promise rather than Hvac/RoofingTrust's map-and-list treatment: the
// accent eyebrow on its accent-bar, "Someone answers, every hour of" running into the giant
// numeral, the lede, then the town chips (pills that tint and lift on hover; a two-column grid on
// a phone). Ground is accent2's soft tint. Reads extensions.serviceArea; hidden when empty.
// Every colour is a palette token. Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'plumbing-trust',
  category: 'trust',
  label: 'Plumbing / Centred coverage',
  consumes: ['extensions.serviceArea'],
  sharedDeps: ['@/lib/editable'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

export default function PlumbingTrust({ content = CONTENT }: { content?: SiteContent }) {
  const towns = content.extensions.serviceArea ?? [];
  if (!towns.length) return null;

  return (
    <section className="bg-[color:var(--accent-2-soft)] py-14 text-center lg:py-[88px]">
      <div className="mx-auto max-w-[800px] px-5 sm:px-6">
        <div className="flex items-center justify-center gap-2.5 text-[12px] font-bold uppercase tracking-[0.14em] text-accent">
          <span className="accent-bar !h-[3px] !w-7" aria-hidden="true" />
          Coverage
        </div>
        <h2 className="mt-3.5 font-heading text-[clamp(30px,3.4vw,40px)] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">
          Someone answers, every hour of
        </h2>
        <div className="mt-1.5 font-heading text-[clamp(56px,8vw,96px)] font-extrabold leading-none tracking-[-0.04em] text-accent">
          24/7
        </div>
        <p className="mx-auto mt-[18px] max-w-[52ch] text-[17px] leading-[1.65] text-inkSoft">
          Not on the list? Call — we&apos;ll tell you straight whether we can get to you.
        </p>
        <div className="mt-[34px] grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-center sm:gap-[10px]">
          {towns.map((town, i) => (
            <span
              key={town}
              className="shadow-brand-1 flex items-center justify-center rounded-full border border-rule bg-bg px-3 py-[10px] text-[14px] font-bold text-ink transition-[background-color,border-color,transform] duration-200 hover:-translate-y-px hover:border-[color:var(--accent-2)] hover:bg-[color:color-mix(in_srgb,var(--accent-2)_10%,var(--bg))] sm:px-[15px] sm:text-[15px]"
            >
              <E p={`extensions.serviceArea.${i}`}>{town}</E>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
