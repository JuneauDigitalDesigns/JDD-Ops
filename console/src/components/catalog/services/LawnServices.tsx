'use client';
// ─────────────────────────────────────────────────────────────────────────────
// LawnServices — "seasonal / organic / airy" services, mirrored 1:1 (#lawn .svc-card). Cards
// with a PHOTO BAND on top and an icon pill overlapping the seam — not HVAC's icon-tile card or
// roofing's ruled row. Content schema-driven. Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { CONTENT, type SiteContent } from '@/data/site';
import { E, Ico } from '@/lib/editable';
import { serviceIcon } from '@/lib/icons';
import { imageAt } from '@/lib/localImage';

export const meta = {
  id: 'lawn-services',
  category: 'services',
  label: 'Lawn / Photo-band services',
  consumes: ['services.eyebrow', 'services.title', 'services.sub', 'services.items'],
  sharedDeps: ['@/lib/editable', '@/lib/icons'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

export default function LawnServices({ content = CONTENT }: { content?: SiteContent }) {
  const { services } = content;
  const items = services.items.filter((it) => it.t?.trim());
  if (!items.length) return null;

  return (
    <section className="bg-bg py-[92px]">
      <div className="mx-auto max-w-[1140px] px-6">
        <div className="max-w-[50ch]">
          {services.eyebrow && (
            <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-accent">
              <E p="services.eyebrow">{services.eyebrow}</E>
            </div>
          )}
          <h2 className="mt-3.5 font-heading text-[40px] font-extrabold leading-[1.04] tracking-[-0.02em] text-ink">
            <E p="services.title">{services.title}</E>
          </h2>
          <p className="mt-3.5 max-w-[52ch] text-[17px] leading-[1.6] text-inkSoft">
            <E p="services.sub">{services.sub}</E>
          </p>
        </div>

        <div className="mt-10 grid gap-[22px] sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => {
            const photo = item.image?.url;
            return (
              <div
                key={item.n ?? i}
                className="flex flex-col overflow-hidden rounded-[24px] border border-rule bg-bg shadow-[0_1px_2px_rgba(22,37,26,0.04)] transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_16px_36px_-14px_rgba(22,37,26,0.26)]"
              >
                <div className="relative h-[132px]">
                  {photo && (
                    <div
                      className="absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url(${imageAt(photo, 1024)})` }}
                      role="img"
                      aria-label={item.image?.alt ?? item.t}
                    />
                  )}
                  <span className="absolute bottom-[-22px] left-[22px] grid h-12 w-12 place-items-center rounded-[15px] border border-rule bg-bg text-accent">
                    <Ico p={`services.items.${i}.icon`} icon={serviceIcon(item.icon, item.tag)} size={22} />
                  </span>
                </div>
                <div className="flex flex-1 flex-col px-6 pb-6 pt-[38px]">
                  <h3 className="font-heading text-[20px] font-extrabold tracking-[-0.018em] text-ink">
                    <E p={`services.items.${i}.t`}>{item.t}</E>
                  </h3>
                  {item.d?.trim() && (
                    <p className="mt-2.5 text-[15px] leading-[1.6] text-inkSoft">
                      <E p={`services.items.${i}.d`}>{item.d}</E>
                    </p>
                  )}
                  {item.tag && (
                    <div className="mt-auto pt-[18px] text-[12.5px] font-bold uppercase tracking-[0.09em] text-accent">
                      <E p={`services.items.${i}.tag`}>{item.tag}</E>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
