'use client';
// ─────────────────────────────────────────────────────────────────────────────
// RoofingNav — "structural / weatherproof" nav, mirrored from the approved mockup
// (design/vertical-templates-v1/home-mockups.html #roofing .nav). Plain white bar (no blur,
// unlike HVAC) with a 3px bitumen bottom border — the hard-edge, no-soft-shadow language the
// whole template is built on. Route links from content.nav. "Free inspection" leads to the
// contact page (D7); the nav phone is a tel: link. Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { Phone } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'roofing-nav',
  category: 'nav',
  label: 'Roofing / Nav',
  consumes: ['brand.name', 'brand.tagline', 'brand.phone', 'brand.phoneHref', 'nav'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/editable'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

export default function RoofingNav({
  content = CONTENT,
  currentPath,
}: {
  content?: SiteContent;
  /** This page's href (`/` or `/services`). wirePages and the studio pass it so the active link matches the page. */
  currentPath?: string;
}) {
  const { brand, nav } = content;

  return (
    <nav className="sticky top-0 z-50 border-b-[3px] border-[#241E1B] bg-bg">
      <div className="mx-auto flex h-[78px] max-w-[1160px] items-center gap-7 px-6">
        <a href="/" className="flex items-center gap-[11px]">
          <span className="grid h-9 w-9 place-items-center rounded-[4px] bg-[#241E1B]" aria-hidden="true" />
          <span className="font-heading text-[22px] font-extrabold leading-none tracking-[-0.024em] text-ink">
            <E p="brand.name">{brand.name}</E>
            {brand.tagline && (
              <small className="mt-0.5 block font-sans text-[11px] font-medium tracking-[0.04em] text-inkSoft">
                <E p="brand.tagline">{brand.tagline}</E>
              </small>
            )}
          </span>
        </a>

        <div className="ml-2 hidden items-center gap-1 md:flex">
          {nav.map((item, i) => (
            <a
              key={item.href + i}
              href={item.href}
              aria-current={currentPath && item.href === currentPath ? 'page' : undefined}
              className="rounded-[4px] px-[13px] py-2 text-[14.5px] font-bold text-inkSoft transition-colors hover:bg-bgSoft hover:text-ink aria-[current=page]:text-accent"
            >
              <E p={`nav.${i}.label`}>{item.label}</E>
            </a>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-[18px]">
          <a href={brand.phoneHref} className="hidden items-center gap-2 font-heading text-[19px] font-extrabold text-ink sm:flex">
            <Phone size={18} weight="fill" className="text-accent" aria-hidden="true" />
            <E p="brand.phone">{brand.phone}</E>
          </a>
          <a
            href="/contact"
            className="inline-flex items-center rounded-[4px] bg-accent px-[22px] py-[13px] text-[15px] font-extrabold text-accentFg"
          >
            Free inspection
          </a>
        </div>
      </div>
    </nav>
  );
}
