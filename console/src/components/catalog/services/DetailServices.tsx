'use client';
// ─────────────────────────────────────────────────────────────────────────────
// DetailServices — glass package cards with a visible price-from line, mirrored 1:1 (#detail
// .svc-card/.svc-foot/.svc-price). The only vertical that prices on the home page. A card whose
// item has no `priceFrom` shows its tag alone in the footer — never "$0" or "Call" (PLAN D5/D15):
// a missing price is the client's fact to supply, not ours to paper over with a fake number or a
// vague prompt to phone. Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { CONTENT, type SiteContent } from '@/data/site';
import { E, Ico } from '@/lib/editable';
import { serviceIcon } from '@/lib/icons';

export const meta = {
  id: 'detail-services',
  category: 'services',
  label: 'Car Detailing / Priced package cards',
  consumes: ['services.eyebrow', 'services.title', 'services.sub', 'services.items'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/editable', '@/lib/icons'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

export default function DetailServices({ content = CONTENT }: { content?: SiteContent }) {
  const { services } = content;
  const items = services.items.filter((it) => it.t?.trim());
  if (!items.length) return null;

  return (
    <section className="bg-bg py-[92px]">
      <div className="mx-auto max-w-[1180px] px-6">
        <div className="mx-auto max-w-[56ch] text-center">
          {services.eyebrow && (
            <div className="text-[11.5px] font-bold uppercase tracking-[0.26em] text-accent">
              <E p="services.eyebrow">{services.eyebrow}</E>
            </div>
          )}
          <h2 className="mt-3.5 font-heading text-[40px] font-extrabold leading-[1.0] tracking-[-0.018em] text-ink">
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
              className="flex flex-col rounded-[12px] p-7 transition-colors"
              style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.085)' }}
            >
              <span
                className="mb-5 grid h-[44px] w-[44px] place-items-center rounded-[10px] text-accent"
                style={{ border: '1px solid rgba(201,161,75,0.4)' }}
              >
                <Ico p={`services.items.${i}.icon`} icon={serviceIcon(item.icon, item.tag)} size={21} />
              </span>
              <h3 className="font-heading text-[20px] font-extrabold tracking-[-0.016em] text-ink">
                <E p={`services.items.${i}.t`}>{item.t}</E>
              </h3>
              {item.d?.trim() && (
                <p className="mt-2.5 text-[14.5px] leading-[1.65] text-inkSoft">
                  <E p={`services.items.${i}.d`}>{item.d}</E>
                </p>
              )}
              <div className="mt-auto flex items-baseline justify-between gap-3 pt-5" style={{ borderTop: '1px solid rgba(255,255,255,0.09)' }}>
                {item.priceFrom?.trim() ? (
                  <div className="font-heading text-[19px] font-extrabold tracking-[-0.02em] text-ink">
                    <E p={`services.items.${i}.priceFrom`}>{item.priceFrom}</E>
                    <small className="mt-0.5 block text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: '#6C7686' }}>
                      starting at
                    </small>
                  </div>
                ) : (
                  <span />
                )}
                {item.tag && (
                  <span className="text-[10.5px] font-bold uppercase tracking-[0.17em] text-accent">
                    <E p={`services.items.${i}.tag`}>{item.tag}</E>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
