'use client';
// ─────────────────────────────────────────────────────────────────────────────
// HvacServices — Northstar "Home — Standard" services grid, mirrored 1:1 (`.svc-grid`).
// A section head (accent eyebrow → steel accent-bar → condensed display heading → lede) over a
// three-up card grid. Each card: a steel-gradient icon tile, an Oswald title, a description, and
// an accent category tag with a short bar, pinned to the card's bottom. Content schema-driven.
// Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { CONTENT, type SiteContent } from '@/data/site';
import { E, Ico } from '@/lib/editable';
import { serviceIcon } from '@/lib/icons';

export const meta = {
  id: 'hvac-services',
  category: 'services',
  label: 'HVAC / Standard services grid',
  consumes: ['services.eyebrow', 'services.title', 'services.sub', 'services.items'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/editable', '@/lib/icons'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

/** The steel accent-bar (`.bar`): a 68×4 gradient rule under the eyebrow. */
const STEEL_BAR = 'linear-gradient(90deg,#8FB2D9,#4A6D96 55%,#1E3A5F)';

export default function HvacServices({ content = CONTENT }: { content?: SiteContent }) {
  const { services } = content;
  const items = services.items.filter((it) => it.t?.trim());
  if (!items.length) return null;

  return (
    <section id="services" className="bg-bg py-[84px]">
      <div className="mx-auto max-w-[1120px] px-6">
        <div className="max-w-[48ch]">
          {/* No eyebrow (owner decision): the accent lives only on each card's tag. The steel
              bar opens the section. */}
          <div className="h-1 w-[68px] rounded-full" style={{ background: STEEL_BAR }} aria-hidden="true" />
          <h2 className="mt-4 font-heading text-[40px] font-semibold leading-[1.04] tracking-[-0.01em] text-ink">
            <E p="services.title">{services.title}</E>
          </h2>
          <p className="mt-3.5 max-w-[52ch] text-[17px] leading-[1.65] text-inkSoft">
            <E p="services.sub">{services.sub}</E>
          </p>
        </div>

        <div className="mt-10 grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => (
            <div
              key={item.n ?? i}
              className="flex flex-col rounded-[16px] border border-rule bg-bg p-[26px] shadow-[0_1px_2px_rgba(19,41,63,0.06)] transition-[transform,box-shadow] duration-200 hover:-translate-y-[3px] hover:shadow-[0_4px_10px_rgba(19,41,63,0.08),0_26px_50px_-16px_rgba(19,41,63,0.30)]"
            >
              <span
                className="mb-[18px] flex h-[56px] w-[56px] items-center justify-center rounded-[14px] text-accent2 shadow-[inset_0_0_0_1px_rgba(30,58,95,0.08)]"
                style={{ background: 'linear-gradient(145deg,#EAF1F8,#DCE8F3)' }}
              >
                <Ico p={`services.items.${i}.icon`} icon={serviceIcon(item.icon, item.tag)} size={26} />
              </span>
              <h3 className="font-heading text-[22px] font-semibold text-ink">
                <E p={`services.items.${i}.t`}>{item.t}</E>
              </h3>
              {item.d?.trim() && (
                <p className="mt-2.5 text-[15.5px] leading-[1.6] text-inkSoft">
                  <E p={`services.items.${i}.d`}>{item.d}</E>
                </p>
              )}
              {item.tag && (
                <div className="mt-auto flex items-center gap-2 border-t border-rule pt-[18px] text-[13px] font-bold uppercase tracking-[0.04em] text-accent">
                  <span className="h-0.5 w-[18px] rounded-sm bg-accent" aria-hidden="true" />
                  <E p={`services.items.${i}.tag`}>{item.tag}</E>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
