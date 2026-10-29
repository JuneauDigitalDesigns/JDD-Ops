'use client';
// ─────────────────────────────────────────────────────────────────────────────
// DetailNav — "finish only reads against black" nav, mirrored 1:1 (design: home-mockups.html
// #detail .nav). Near-black translucent bar (not white like every other vertical) over
// VERTICAL_LANGUAGES.car-detailing's dark palette — bg-bg/text-ink resolve dark automatically.
// CTA reads "Book a detail" per the mockup. Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { Phone } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'detail-nav',
  category: 'nav',
  label: 'Car Detailing / Nav',
  consumes: ['brand.name', 'brand.tagline', 'brand.phone', 'brand.phoneHref', 'nav'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/editable'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

export default function DetailNav({
  content = CONTENT,
  currentPath,
}: {
  content?: SiteContent;
  /** This page's href (`/` or `/services`). wirePages and the studio pass it so the active link matches the page. */
  currentPath?: string;
}) {
  const { brand, nav } = content;

  return (
    <nav className="sticky top-0 z-50 border-b border-rule bg-[rgba(13,14,18,0.86)] backdrop-blur-md">
      <div className="mx-auto flex h-[80px] max-w-[1180px] items-center gap-7 px-6">
        <a href="/" className="flex items-center gap-[11px]">
          <span
            className="grid h-9 w-9 place-items-center rounded-[8px] text-[#0D0E12] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]"
            style={{ background: 'linear-gradient(145deg,#C9A14B,#8A6A26)' }}
            aria-hidden="true"
          />
          <span className="font-heading text-[22px] font-extrabold leading-none tracking-[-0.016em] text-ink">
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
              className="rounded-[8px] px-[13px] py-2 text-[14.5px] font-semibold text-inkSoft transition-colors hover:bg-bgSoft hover:text-ink aria-[current=page]:text-accent"
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
            className="inline-flex items-center rounded-[8px] bg-accent px-[22px] py-[13px] text-[15px] font-extrabold text-accentFg"
          >
            Book a detail
          </a>
        </div>
      </div>
    </nav>
  );
}
