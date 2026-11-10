'use client';
// ─────────────────────────────────────────────────────────────────────────────
// DetailNav — "finish only reads against black" nav, premium pass (2026-11-09, approved mockup).
// A sticky blurred near-black bar over VERTICAL_LANGUAGES.car-detailing's dark palette: champagne
// gradient logo mark + brand name/tagline, route links from content.nav (multi-page export's
// navLinksFor stays authoritative) with an accent underline that grows from the left, the phone
// in the display face, and the accent "Book a detail" button to the contact page.
//
// Every colour is a palette token: the bar is bg at 92%, the mark is the accent toward black (the
// gold the mockup's --accent-bar draws; this palette's own --accent-bar is the steel accent2), so
// the Studio's brand pane and per-section overrides reach all of it. On a phone the number becomes
// an icon button and the CTA a compact nowrap pill, so nothing overflows at 375px.
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

/** The champagne mark: accent → accent pulled toward black, as the mockup's gold --accent-bar. */
const GOLD_MARK = 'linear-gradient(145deg, var(--accent), color-mix(in srgb, var(--accent) 65%, black))';

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
    <nav
      className="sticky top-0 z-50 border-b border-rule backdrop-blur-md"
      style={{ background: 'color-mix(in srgb, var(--bg) 92%, transparent)' }}
    >
      <div className="mx-auto flex h-[64px] max-w-[1120px] items-center gap-2.5 px-5 sm:gap-7 sm:px-6 md:h-[74px]">
        <a href="/" className="flex min-w-0 items-center gap-[11px]">
          <span
            className="h-9 w-9 shrink-0 rounded-[8px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]"
            style={{ background: GOLD_MARK }}
            aria-hidden="true"
          />
          <span className="min-w-0 lg:whitespace-nowrap font-heading text-[17px] font-extrabold leading-none tracking-[-0.016em] text-ink sm:text-[19px] md:text-[22px]">
            <E p="brand.name">{brand.name}</E>
            {brand.tagline && (
              <small className="mt-1 hidden font-sans text-[11px] font-medium tracking-[0.04em] text-inkSoft md:block">
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
              className="group relative px-[13px] py-2 text-[14.5px] font-semibold text-inkSoft transition-colors hover:text-ink aria-[current=page]:text-ink"
            >
              <E p={`nav.${i}.label`}>{item.label}</E>
              <span
                className="absolute bottom-1 left-[13px] right-[13px] h-0.5 origin-left scale-x-0 bg-accent transition-transform duration-300 group-hover:scale-x-100 group-aria-[current=page]:scale-x-100"
                aria-hidden="true"
              />
            </a>
          ))}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2.5 sm:gap-[18px]">
          <a href={brand.phoneHref} className="hidden items-center gap-2 font-heading text-[19px] font-extrabold text-ink md:flex">
            <Phone size={18} weight="fill" className="text-accent" aria-hidden="true" />
            <E p="brand.phone">{brand.phone}</E>
          </a>
          <a
            href={brand.phoneHref}
            aria-label={`Call ${brand.phone}`}
            className="grid h-[42px] w-[42px] place-items-center rounded-[10px] border border-rule text-accent md:hidden"
          >
            <Phone size={18} weight="fill" aria-hidden="true" />
          </a>
          <a
            href="/contact"
            className="inline-flex items-center whitespace-nowrap rounded-full bg-accent px-[14px] py-[11px] text-[14px] font-bold text-accentFg transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.98] md:rounded-[8px] md:px-[22px] md:py-[13px] md:text-[15px]"
            style={{ boxShadow: '0 10px 24px -8px color-mix(in srgb, var(--accent) 55%, transparent)' }}
          >
            Book a detail
          </a>
        </div>
      </div>
    </nav>
  );
}
