'use client';
// ─────────────────────────────────────────────────────────────────────────────
// ServiceArea — the towns a client actually covers.
//
// The one component the catalog rebuild added rather than removed. A local
// service business is chosen partly on "do they come out to me", and that
// question had no answer anywhere on the page.
//
// It reads `extensions.serviceArea`, which already existed in @jdd/schema and is
// already populated by intake (brand-intake splits the operator's free-text list)
// — but was never set by any seed or preset. As a result `areaServed` in the
// JSON-LD has been an empty array on every site shipped so far, which is exactly
// the structured-data field local search uses. Filling it is the larger half of
// this change; this component is the visible half.
//
// Degrades away entirely when the list is empty rather than rendering a heading
// over nothing (SPEC §7).
// ─────────────────────────────────────────────────────────────────────────────
import { MapPin, PhoneCall } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { skinClasses, type SkinId } from '@/lib/skins';

export const meta = {
  id: 'service-area',
  category: 'trust',
  label: 'Trust / Service area',
  consumes: ['extensions.serviceArea', 'brand.phone', 'brand.phoneHref', 'brand.short'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/skins'],
  skins: ['soft', 'default', 'inverted'],
  /** Structural archetype, from src/lib/archetypes.ts. Unique within the category. */
  archetype: 'map-list',
  /** True if this component owns a SIGNATURE motion moment (a scroll-linked transform, a pin,
   *  a count-up). Decision 26 budgets these per PAGE, not per section: at most two on a page,
   *  enforced by console/test/page-rhythm.test.mjs. Micro-reveals are free and do not count. */
  signature: false,
} as const;

export default function ServiceArea({
  content = CONTENT,
  skin = 'soft',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const s = skinClasses(skin);
  const dark = skin === 'inverted' || skin === 'contrast';
  const { extensions, brand } = content;
  const areas = (extensions.serviceArea ?? []).filter((a) => a?.trim());

  if (!areas.length) return null;

  return (
    <section id="areas" className={`relative overflow-hidden ${s.section} py-12 lg:py-16`}>
      {/* Faint region silhouette — a lightweight SVG texture, not a heavy map embed. Coloured
          with the structural accent2 at low opacity so it reads as "coverage" without weight. */}
      <svg
        className="pointer-events-none absolute right-[-40px] top-1/2 w-[560px] max-w-[52%] -translate-y-1/2 text-[color:var(--accent-2)] opacity-[0.08]"
        viewBox="0 0 200 200" fill="currentColor" aria-hidden="true"
      >
        <path d="M40 20l30 6 28-10 34 8 26 18-8 30 10 28-20 24-30 6-26-14-28 4-22-20 6-28-14-26 10-28z" />
      </svg>
      <div className="relative mx-auto max-w-6xl px-5 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:items-center lg:gap-12">
        <div>
          <h2 className={`flex items-center gap-2.5 font-heading text-[26px] font-extrabold leading-tight tracking-[-0.015em] sm:text-[30px] ${s.heading}`}>
            <MapPin size={26} weight="fill" className="shrink-0 text-accent" aria-hidden="true" />
            Where we work
          </h2>
          <span className="accent-bar mt-4" aria-hidden="true" />
          <p className={`mt-4 max-w-[42ch] text-[16px] leading-relaxed ${s.body}`}>
            Not on the list? Call and ask, we travel for bigger jobs.
          </p>
          <a
            href={brand.phoneHref}
            className="mt-4 inline-flex min-h-11 items-center gap-2 text-[17px] font-extrabold text-accent hover:underline"
          >
            <PhoneCall size={18} weight="fill" aria-hidden="true" />
            <E p="brand.phone">{brand.phone}</E>
          </a>
        </div>

        {/* A plain list, not a map embed: a third-party map is the single heaviest thing that
            can land on a page like this, and the towns are what a visitor is scanning for. */}
        <ul className="mt-6 flex flex-wrap gap-2 lg:mt-0">
          {areas.map((area, i) => (
            <li
              key={area}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[15px] font-bold transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 ${
                dark ? 'bg-white/10 text-onInk hover:bg-white/15' : 'bg-bg text-ink shadow-[0_1px_2px_rgba(28,16,9,.06)] hover:shadow-[0_8px_18px_-8px_rgba(28,16,9,.28)]'
              }`}
            >
              <MapPin size={14} weight="fill" className="shrink-0 text-accent" aria-hidden="true" />
              <E p={`extensions.serviceArea.${i}`}>{area}</E>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
