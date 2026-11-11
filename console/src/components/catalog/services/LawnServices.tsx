'use client';
// ─────────────────────────────────────────────────────────────────────────────
// LawnServices — "seasonal / organic / airy" services, premium pass (2026-11-09, approved mockup).
// A section head (accent eyebrow with a short accent-bar → display heading → lede) over a
// three-up grid of photo-headed cards: a 16:9 PHOTO header (services.items[].image under a forest
// colour-wash) with the icon tile sitting on the photo's bottom edge — it fills green on hover —
// then the title, the description and the category tag pinned to the card's bottom over a
// hairline. A card whose image slot is empty falls back to the icon-only card (tile in the body).
// Cards lift on hover and arrive one after another (rv-stagger). Photos route through imageAt().
// Every colour is a palette token. Content schema-driven. Fixed design, no skin.
//
// Service pages (Xander 2026-11-10): a service with its own page is a link to it (the whole card),
// with "Details" and an arrow in the tag row; a section-only service is a plain card, linked from
// nowhere. Every card carries id="<slug>". Edit paths use the ORIGINAL services.items index, so a
// blank item ahead of a filled one can't send an edit to the wrong service (the old filtered index
// could).
// ─────────────────────────────────────────────────────────────────────────────
import { ArrowRight } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E, Ico } from '@/lib/editable';
import { serviceIcon } from '@/lib/icons';
import { imageAt } from '@/lib/localImage';
import { serviceRefs } from '@/lib/serviceLinks';

export const meta = {
  id: 'lawn-services',
  category: 'services',
  label: 'Lawn / Photo-band services',
  consumes: ['services.eyebrow', 'services.title', 'services.sub', 'services.items', 'servicePages'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/editable', '@/lib/icons', '@/lib/localImage', '@/lib/serviceLinks'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

export default function LawnServices({ content = CONTENT }: { content?: SiteContent }) {
  const { services } = content;
  const refs = serviceRefs(content);
  if (!refs.length) return null;

  return (
    <section className="bg-bg py-16 lg:py-24">
      <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
        <div className="max-w-[52ch]">
          {services.eyebrow && (
            <div className="flex items-center gap-2.5 text-[12px] font-bold uppercase tracking-[0.14em] text-accent">
              <span className="accent-bar !h-[3px] !w-7" aria-hidden="true" />
              <E p="services.eyebrow">{services.eyebrow}</E>
            </div>
          )}
          <h2 className="mt-4 font-heading text-[34px] font-extrabold leading-[1.04] tracking-[-0.02em] text-ink lg:text-[46px]">
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
                className={`grid h-14 w-14 place-items-center rounded-[15px] border border-rule text-accent transition-colors duration-300 group-hover:border-accent group-hover:bg-accent group-hover:text-accentFg ${
                  photo ? 'shadow-brand-1 absolute bottom-[-24px] left-[22px] z-[1] bg-bg' : 'mb-[18px]'
                }`}
                style={photo ? undefined : { background: 'color-mix(in srgb, var(--accent) 12%, var(--bg))' }}
              >
                <Ico p={`services.items.${i}.icon`} icon={serviceIcon(item.icon, item.tag)} size={26} />
              </span>
            );
            return (
              <Card
                key={ref.slug}
                id={ref.slug}
                {...(ref.href ? { href: ref.href } : {})}
                className="group scroll-mt-24 hover-lift shadow-brand-1 flex flex-col overflow-hidden rounded-[22px] border border-rule bg-bg hover:shadow-brand-3"
              >
                {photo && (
                  <div
                    className="relative aspect-[16/9] bg-cover bg-center"
                    style={{ backgroundImage: `url(${imageAt(photo, 1024)})` }}
                    role="img"
                    aria-label={item.image?.alt ?? item.t}
                  >
                    <div className="absolute inset-0 bg-inkPanel2 opacity-35 mix-blend-color" aria-hidden="true" />
                    {tile}
                  </div>
                )}
                <div className={`flex flex-1 flex-col px-5 pb-5 lg:px-[26px] lg:pb-6 ${photo ? 'pt-10' : 'pt-[26px]'}`}>
                  {!photo && tile}
                  <h3 className="font-heading text-[22px] font-extrabold tracking-[-0.02em] text-ink">
                    <E p={`services.items.${i}.t`}>{item.t}</E>
                  </h3>
                  {item.d?.trim() && (
                    <p className="mt-3 text-[15.5px] leading-[1.6] text-inkSoft">
                      <E p={`services.items.${i}.d`}>{item.d}</E>
                    </p>
                  )}
                  {(item.tag || ref.href) && (
                    <div className="mt-auto pt-[18px]">
                      <div className="flex items-center gap-2 border-t border-rule pt-[18px] text-[13px] font-bold uppercase tracking-[0.04em] text-accent">
                        {item.tag && <E p={`services.items.${i}.tag`}>{item.tag}</E>}
                        {ref.href && (
                          <span className="ml-auto flex items-center gap-1.5 text-[14px] normal-case tracking-normal">
                            Details
                            <ArrowRight size={16} weight="bold" aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-[3px]" />
                          </span>
                        )}
                      </div>
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
