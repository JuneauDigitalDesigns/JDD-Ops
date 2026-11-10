'use client';
// ─────────────────────────────────────────────────────────────────────────────
// PlumbingServices — rounded cards with a circular icon badge, premium pass (2026-11-09, approved
// mockup). A centred section head (accent eyebrow on a short accent-bar → display heading → lede)
// over the three-up grid. Each card still floats its category tag as a pill in the top-right
// corner rather than pinning it to the card's bottom border like Hvac/RoofingServices — this
// vertical's one services-layout deviation. The badge sits on accent2's soft tint and fills with
// the accent on hover while the card lifts; cards arrive in a scroll stagger. Icons come from
// serviceIcon(icon, tag) as before. Content schema-driven.
// Every colour is a palette token. Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { CONTENT, type SiteContent } from '@/data/site';
import { E, Ico } from '@/lib/editable';
import { serviceIcon } from '@/lib/icons';

export const meta = {
  id: 'plumbing-services',
  category: 'services',
  label: 'Plumbing / Circular-badge services',
  consumes: ['services.eyebrow', 'services.title', 'services.sub', 'services.items'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/editable', '@/lib/icons'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

export default function PlumbingServices({ content = CONTENT }: { content?: SiteContent }) {
  const { services } = content;
  const items = services.items.filter((it) => it.t?.trim());
  if (!items.length) return null;

  return (
    <section className="bg-bg py-16 lg:py-[92px]">
      <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
        <div className="mx-auto max-w-[56ch] text-center">
          {services.eyebrow && (
            <div className="flex items-center justify-center gap-2.5 text-[12px] font-bold uppercase tracking-[0.14em] text-accent">
              <span className="accent-bar !h-[3px] !w-7" aria-hidden="true" />
              <E p="services.eyebrow">{services.eyebrow}</E>
            </div>
          )}
          <h2 className="mt-4 font-heading text-[34px] font-extrabold leading-[1.04] tracking-[-0.02em] text-ink lg:text-[46px]">
            <E p="services.title">{services.title}</E>
          </h2>
          <p className="mx-auto mt-3.5 max-w-[52ch] text-[17px] leading-[1.65] text-inkSoft">
            <E p="services.sub">{services.sub}</E>
          </p>
        </div>

        <div className="rv-stagger mt-8 grid gap-4 sm:grid-cols-2 lg:mt-11 lg:grid-cols-3 lg:gap-[22px]">
          {items.map((item, i) => (
            <div
              key={item.n ?? i}
              className="group hover-lift shadow-brand-1 relative flex flex-col rounded-[20px] border border-rule bg-bg p-6 hover:shadow-[0_4px_10px_rgba(16,33,46,0.09),0_26px_50px_-16px_rgba(16,33,46,0.3)] lg:p-7"
            >
              {item.tag && (
                <span className="absolute right-[22px] top-[22px] rounded-full bg-bgSoft px-[11px] py-[6px] text-[11px] font-bold uppercase leading-none tracking-[0.09em] text-accent">
                  <E p={`services.items.${i}.tag`}>{item.tag}</E>
                </span>
              )}
              <span className="mb-[18px] grid h-14 w-14 place-items-center rounded-full bg-[color:var(--accent-2-soft)] text-accent transition-[background-color,color,transform] duration-300 group-hover:scale-[1.06] group-hover:bg-accent group-hover:text-accentFg">
                <Ico p={`services.items.${i}.icon`} icon={serviceIcon(item.icon, item.tag)} size={24} />
              </span>
              <h3 className="pr-[10px] font-heading text-[21px] font-extrabold leading-[1.15] tracking-[-0.02em] text-ink">
                <E p={`services.items.${i}.t`}>{item.t}</E>
              </h3>
              {item.d?.trim() && (
                <p className="mt-2.5 text-[15px] leading-[1.62] text-inkSoft">
                  <E p={`services.items.${i}.d`}>{item.d}</E>
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
