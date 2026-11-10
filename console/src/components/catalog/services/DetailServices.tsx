'use client';
// ─────────────────────────────────────────────────────────────────────────────
// DetailServices — glass package cards with a visible price-from line, premium pass (2026-11-09,
// approved mockup). A centred head (champagne eyebrow with a short gold bar → heading → lede) over
// a three-up grid of glass cards: gold-bordered icon tile (fills gold on hover), title,
// description, and a foot carrying the price-from line and the tag. On hover the card lifts and
// its border turns the accent. The only vertical that prices on the home page.
//
// A card whose item has no `priceFrom` shows its tag alone in the footer — never "$0" or "Call"
// (PLAN D5/D15): a missing price is the client's fact to supply, not ours to paper over with a
// fake number or a vague prompt to phone.
//
// Every colour is a palette token: glass is ink at 4% / 9% over the ground, the gold bar is the
// accent pulled toward black, "starting at" is ink-soft pulled toward bg.
//
// Service pages (Xander 2026-11-10): a service with its own page is a link to it (the whole card),
// with "Details" and an arrow under the tag in the foot; a section-only service is a plain card,
// linked from nowhere. Every card carries id="<slug>". Edit paths use the ORIGINAL services.items
// index, so a blank item ahead of a filled one can't send an edit to the wrong service.
// ─────────────────────────────────────────────────────────────────────────────
import { ArrowRight } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E, Ico } from '@/lib/editable';
import { serviceIcon } from '@/lib/icons';
import { serviceRefs } from '@/lib/serviceLinks';

export const meta = {
  id: 'detail-services',
  category: 'services',
  label: 'Car Detailing / Priced package cards',
  consumes: ['services.eyebrow', 'services.title', 'services.sub', 'services.items', 'servicePages'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/editable', '@/lib/icons', '@/lib/serviceLinks'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

const GOLD_BAR = 'linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 65%, black) 60%, transparent)';

export default function DetailServices({ content = CONTENT }: { content?: SiteContent }) {
  const { services } = content;
  const refs = serviceRefs(content);
  if (!refs.length) return null;

  return (
    <section className="bg-bg py-16 sm:py-24">
      <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
        <div className="mx-auto max-w-[56ch] text-center">
          {services.eyebrow && (
            <div className="flex items-center justify-center gap-2.5 text-[11.5px] font-semibold uppercase leading-none tracking-[0.26em] text-accent">
              <span className="h-[3px] w-7 shrink-0 rounded-sm" style={{ background: GOLD_BAR }} aria-hidden="true" />
              <E p="services.eyebrow">{services.eyebrow}</E>
            </div>
          )}
          <h2 className="mt-4 font-heading text-[clamp(34px,4vw,46px)] font-extrabold leading-[1.04] tracking-[-0.016em] text-ink">
            <E p="services.title">{services.title}</E>
          </h2>
          <p className="mx-auto mt-3.5 max-w-[52ch] text-[17px] leading-[1.65] text-inkSoft">
            <E p="services.sub">{services.sub}</E>
          </p>
        </div>

        <div className="rv-stagger mt-8 grid gap-4 sm:mt-11 sm:grid-cols-2 lg:grid-cols-3 lg:gap-[22px]">
          {refs.map((ref) => {
            const i = ref.index;
            const item = services.items[i];
            const Card = ref.href ? 'a' : 'div';
            return (
              <Card
                key={ref.slug}
                id={ref.slug}
                {...(ref.href ? { href: ref.href } : {})}
                className="group flex scroll-mt-24 flex-col rounded-[12px] border border-[color:color-mix(in_srgb,var(--ink)_9%,transparent)] bg-[color:color-mix(in_srgb,var(--ink)_4%,transparent)] p-6 transition-[border-color,background-color,transform] duration-300 hover:-translate-y-[3px] hover:border-[color:color-mix(in_srgb,var(--accent)_45%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--ink)_6%,transparent)] sm:p-7"
              >
                <span className="mb-5 grid h-[44px] w-[44px] place-items-center rounded-[10px] border border-[color:color-mix(in_srgb,var(--accent)_40%,transparent)] text-accent transition-colors duration-300 group-hover:bg-accent group-hover:text-accentFg">
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
                <div className="mt-auto flex items-baseline justify-between gap-3 border-t border-[color:color-mix(in_srgb,var(--ink)_9%,transparent)] pt-5">
                  {item.priceFrom?.trim() ? (
                    <div className="font-heading text-[20px] font-extrabold leading-none tracking-[-0.02em] text-ink">
                      <E p={`services.items.${i}.priceFrom`}>{item.priceFrom}</E>
                      <small
                        className="mt-1 block font-sans text-[11px] font-semibold uppercase leading-none tracking-[0.14em]"
                        style={{ color: 'color-mix(in srgb, var(--ink-soft) 70%, var(--bg))' }}
                      >
                        starting at
                      </small>
                    </div>
                  ) : (
                    <span />
                  )}
                  {(item.tag || ref.href) && (
                    <span className="flex flex-col items-end gap-2.5">
                      {item.tag && (
                        <span className="text-[10.5px] font-bold uppercase leading-none tracking-[0.17em] text-accent">
                          <E p={`services.items.${i}.tag`}>{item.tag}</E>
                        </span>
                      )}
                      {ref.href && (
                        <span className="flex items-center gap-1.5 text-[13.5px] font-semibold leading-none text-ink transition-colors group-hover:text-accent">
                          Details
                          <ArrowRight size={15} weight="bold" aria-hidden="true" className="text-accent transition-transform duration-300 group-hover:translate-x-[3px]" />
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
