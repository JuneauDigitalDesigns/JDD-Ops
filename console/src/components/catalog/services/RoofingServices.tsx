'use client';
// ─────────────────────────────────────────────────────────────────────────────
// RoofingServices — "structural / weatherproof" services, mirrored 1:1 (#roofing .svc-rows /
// .svc-row). RULED ROWS, not cards — a roofer's offer is a scope list: a two-column head
// (eyebrow + heading / lede), then a hairline-bordered row per service with an outlined index
// numeral, title + uppercase tag, description, and a chevron. On hover, the row tints and the
// numeral fills with the accent colour. Content schema-driven. Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'roofing-services',
  category: 'services',
  label: 'Roofing / Ruled-row services',
  consumes: ['services.eyebrow', 'services.title', 'services.sub', 'services.items'],
  sharedDeps: ['@/lib/editable'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

export default function RoofingServices({ content = CONTENT }: { content?: SiteContent }) {
  const { services } = content;
  const items = services.items.filter((it) => it.t?.trim());
  if (!items.length) return null;

  return (
    <section className="bg-bg py-[88px]">
      <div className="mx-auto max-w-[1160px] px-6">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-end">
          <div>
            {services.eyebrow && (
              <div className="text-[12px] font-bold uppercase tracking-[0.2em] text-accent">
                <E p="services.eyebrow">{services.eyebrow}</E>
              </div>
            )}
            <h2 className="mt-3.5 font-heading text-[42px] font-extrabold leading-[0.98] tracking-[-0.024em] text-ink">
              <E p="services.title">{services.title}</E>
            </h2>
          </div>
          <p className="text-[16px] leading-[1.6] text-inkSoft">
            <E p="services.sub">{services.sub}</E>
          </p>
        </div>

        <div className="mt-12 border-t border-rule">
          {items.map((item, i) => (
            <div
              key={item.n ?? i}
              className="grid grid-cols-[60px_1fr] items-start gap-4 border-b border-rule py-[30px] transition-colors hover:bg-bgSoft md:grid-cols-[96px_1fr_1.25fr_40px] md:gap-6"
            >
              <div
                className="font-heading text-[40px] font-extrabold leading-[0.9] tracking-[-0.04em] text-transparent"
                style={{ WebkitTextStroke: '1.5px #93847C' }}
                aria-hidden="true"
              >
                {item.n ?? String(i + 1).padStart(2, '0')}
              </div>
              <div>
                <h3 className="font-heading text-[23px] font-extrabold tracking-[-0.022em] text-ink">
                  <E p={`services.items.${i}.t`}>{item.t}</E>
                </h3>
                {item.tag && (
                  <span className="mt-2 block text-[11.5px] font-bold uppercase tracking-[0.12em] text-accent">
                    <E p={`services.items.${i}.tag`}>{item.tag}</E>
                  </span>
                )}
              </div>
              {item.d?.trim() && (
                <p className="hidden pt-1 text-[15.5px] leading-[1.62] text-inkSoft md:block">
                  <E p={`services.items.${i}.d`}>{item.d}</E>
                </p>
              )}
              <svg
                className="hidden shrink-0 justify-self-end pt-2 text-[#93847C] md:block"
                width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                aria-hidden="true"
              >
                <path d="M9 6l6 6-6 6" />
              </svg>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
