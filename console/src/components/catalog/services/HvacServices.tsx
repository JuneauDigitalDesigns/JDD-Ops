'use client';
// ─────────────────────────────────────────────────────────────────────────────
// HvacServices — Northstar "Home — Standard" services grid, premium pass (2026-11-09, approved
// mockup). A section head (steel eyebrow with a short accent-bar → 46px condensed heading → lede)
// over a three-up card grid. Each card: a 3:2 PHOTO header from services.items[].image under the
// navy wash with the icon tile sitting on the photo's bottom edge, the title, an accent-bar that
// grows on hover, the description, and the accent category tag pinned to the card's bottom. A
// card whose image slot is empty falls back to the icon-only card (tile in the body).
//
// The eyebrow is back (operator decision 2026-11-09: one steel eyebrow on every section head).
// Photos route through imageAt() so the export pipeline's localized base resolves to a file.
// Every colour is a palette token: steel = --accent-2 and its ramp, tag = accent.
//
// Service pages (Xander 2026-11-10): a service with its own page is a link to it, with "Details"
// and an arrow in the footer row; a section-only service is a plain card, linked from nowhere.
// Every card carries id="<slug>". Edit paths use the ORIGINAL services.items index, so a blank
// item ahead of a filled one can't send an edit to the wrong service.
// ─────────────────────────────────────────────────────────────────────────────
import { CONTENT, type SiteContent } from '@/data/site';
import { ArrowRight } from '@phosphor-icons/react';
import { E, Ico } from '@/lib/editable';
import { serviceIcon } from '@/lib/icons';
import { imageAt } from '@/lib/localImage';
import { serviceRefs } from '@/lib/serviceLinks';

export const meta = {
  id: 'hvac-services',
  category: 'services',
  label: 'HVAC / Standard services grid',
  consumes: ['services.eyebrow', 'services.title', 'services.sub', 'services.items', 'servicePages'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/editable', '@/lib/icons', '@/lib/localImage', '@/lib/serviceLinks'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

export default function HvacServices({ content = CONTENT }: { content?: SiteContent }) {
  const { services } = content;
  const refs = serviceRefs(content);
  if (!refs.length) return null;

  return (
    <section id="services" className="bg-bg py-16 lg:py-24">
      <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
        <div className="max-w-[52ch]">
          {services.eyebrow && (
            <div className="flex items-center gap-2.5 text-[12px] font-bold uppercase tracking-[0.14em] text-[color:var(--accent-2)]">
              <span className="accent-bar !h-[3px] !w-7" aria-hidden="true" />
              <E p="services.eyebrow">{services.eyebrow}</E>
            </div>
          )}
          <h2 className="mt-4 font-heading text-[34px] font-semibold leading-[1.04] tracking-[-0.01em] text-ink lg:text-[46px]">
            <E p="services.title">{services.title}</E>
          </h2>
          <p className="mt-3.5 max-w-[52ch] text-[17px] leading-[1.65] text-inkSoft">
            <E p="services.sub">{services.sub}</E>
          </p>
        </div>

        <div className="rv-stagger mt-8 grid gap-4 sm:grid-cols-2 lg:mt-11 lg:grid-cols-3 lg:gap-[22px]">
          {refs.map((ref) => {
            const i = ref.index;
            const item = services.items[i];
            const photo = item.image?.url;
            const Card = ref.href ? 'a' : 'div';
            const tile = (
              <span
                className={`grid h-[56px] w-[56px] place-items-center rounded-[14px] text-[color:var(--accent-2)] transition-colors duration-300 group-hover:bg-[color:var(--accent-2)] group-hover:text-[color:var(--accent-2-fg)] ${
                  photo
                    ? 'shadow-brand-2 absolute bottom-[-24px] left-[22px] z-[1] bg-bg'
                    : 'mb-[18px] bg-[color:var(--accent-2-soft)]'
                }`}
                style={{ boxShadow: photo ? undefined : 'inset 0 0 0 1px color-mix(in srgb, var(--accent-2) 10%, transparent)' }}
              >
                <Ico p={`services.items.${i}.icon`} icon={serviceIcon(item.icon, item.tag)} size={26} />
              </span>
            );
            return (
              <Card
                key={ref.slug}
                id={ref.slug}
                {...(ref.href ? { href: ref.href } : {})}
                className="group hover-lift shadow-brand-1 flex flex-col overflow-hidden rounded-[16px] border border-rule bg-bg hover:shadow-brand-3"
              >
                {photo && (
                  <div
                    className="relative aspect-[16/9] bg-cover bg-center lg:aspect-[3/2]"
                    style={{ backgroundImage: `url(${imageAt(photo, 1024)})` }}
                    role="img"
                    aria-label={item.image?.alt ?? item.t}
                  >
                    <div className="absolute inset-0 bg-[color:var(--accent-2)] opacity-35 mix-blend-color" aria-hidden="true" />
                    {tile}
                  </div>
                )}
                <div className={`flex flex-1 flex-col px-5 pb-5 lg:px-[26px] lg:pb-6 ${photo ? 'pt-9 lg:pt-10' : 'pt-[26px]'}`}>
                  {!photo && tile}
                  <h3 className="font-heading text-[22px] font-semibold text-ink">
                    <E p={`services.items.${i}.t`}>{item.t}</E>
                  </h3>
                  <span className="accent-bar mt-3 !h-[3px] !w-7 transition-[width] duration-300 group-hover:!w-[68px]" aria-hidden="true" />
                  {item.d?.trim() && (
                    <p className="mt-3 text-[15.5px] leading-[1.6] text-inkSoft">
                      <E p={`services.items.${i}.d`}>{item.d}</E>
                    </p>
                  )}
                  {item.tag && (
                    <div className="mt-auto flex items-center gap-2 border-t border-rule pt-[18px] text-[13px] font-bold uppercase tracking-[0.04em] text-accent">
                      <span className="h-0.5 w-[18px] rounded-sm bg-accent" aria-hidden="true" />
                      <E p={`services.items.${i}.tag`}>{item.tag}</E>
                      {ref.href && (
                        <span className="ml-auto flex items-center gap-1.5 text-[14px] normal-case tracking-normal text-[color:var(--accent-2)]">
                          Details
                          <ArrowRight size={16} weight="bold" aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-[3px]" />
                        </span>
                      )}
                    </div>
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
