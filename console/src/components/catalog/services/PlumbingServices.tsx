'use client';
// ─────────────────────────────────────────────────────────────────────────────
// PlumbingServices — rounded cards with a circular icon badge, mirrored 1:1 (#plumbing .svc-grid
// / .svc-card). Each card floats its category tag as a pill in the top-right corner rather than
// pinning it to the card's bottom border like Hvac/RoofingServices — this vertical's one
// services-layout deviation. Content schema-driven. Fixed design, no skin.
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
    <section className="bg-bg py-[88px]">
      <div className="mx-auto max-w-[1160px] px-6">
        <div className="mx-auto max-w-[56ch] text-center">
          {services.eyebrow && (
            <div className="text-[12px] font-bold uppercase tracking-[0.15em] text-accent">
              <E p="services.eyebrow">{services.eyebrow}</E>
            </div>
          )}
          <h2 className="mt-3 font-heading text-[40px] font-extrabold leading-[1.02] tracking-[-0.02em] text-ink">
            <E p="services.title">{services.title}</E>
          </h2>
          <p className="mx-auto mt-3.5 max-w-[56ch] text-[16px] leading-[1.6] text-inkSoft">
            <E p="services.sub">{services.sub}</E>
          </p>
        </div>

        <div className="mt-11 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => (
            <div
              key={item.n ?? i}
              className="relative flex flex-col rounded-[20px] border border-rule bg-bg p-7 shadow-[0_2px_4px_rgba(16,33,46,0.04)] transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_14px_34px_-12px_rgba(16,33,46,0.26)]"
            >
              {item.tag && (
                <span className="absolute right-[22px] top-[22px] rounded-full bg-bgSoft px-[11px] py-[6px] text-[11px] font-bold uppercase tracking-[0.09em] text-accent">
                  <E p={`services.items.${i}.tag`}>{item.tag}</E>
                </span>
              )}
              <span
                className="mb-[18px] grid h-[54px] w-[54px] place-items-center rounded-full text-accent"
                style={{ background: '#DBE9F2' }}
              >
                <Ico p={`services.items.${i}.icon`} icon={serviceIcon(item.icon, item.tag)} size={24} />
              </span>
              <h3 className="pr-[10px] font-heading text-[20.5px] font-extrabold tracking-[-0.018em] text-ink">
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
