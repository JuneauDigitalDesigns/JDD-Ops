'use client';
// ─────────────────────────────────────────────────────────────────────────────
// HvacNav — Northstar "Home — Standard" nav, premium pass (2026-11-09, approved mockup).
// Sticky blurred bar: accent-bar logo mark + brand name/subtitle, route links (from content.nav,
// so multi-page export's navLinksFor stays authoritative — no hardcoded section anchors) with an
// accent underline that grows from the left, the phone in the display face, and the accent
// "Book a visit" button to the contact page.
//
// Services menu + phone menu (Xander 2026-11-10, service-pages mockup v6): "Services" stays a link
// to /services; a chevron button beside it opens every service that has its own page, in
// services.items order (a section-only service is linked from nowhere). On a phone the menu button
// opens Home/Services(+ each service page)/About/Contact and a call button. Behaviour (aria,
// focus, Escape) is the shared useDisclosure; every item is a plain link in the server HTML.
//
// Every colour is a palette token: the steel mark reads --accent-bar, the bar reads bg/rule, so
// the Studio's brand pane and the per-section overrides reach all of it. On a phone the number
// becomes an icon button and the CTA a compact pill, so nothing wraps at 390px.
// ─────────────────────────────────────────────────────────────────────────────
import { Phone, List, X, CaretDown } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { useDisclosure } from '@/lib/disclosure';
import { linkedServices } from '@/lib/serviceLinks';

export const meta = {
  id: 'hvac-nav',
  category: 'nav',
  label: 'HVAC / Nav',
  consumes: ['brand.name', 'brand.tagline', 'brand.phone', 'brand.phoneHref', 'nav', 'services.items', 'servicePages'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/editable', '@/lib/disclosure', '@/lib/serviceLinks'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

const isServices = (href: string) => href === '/services';

export default function HvacNav({
  content = CONTENT,
  currentPath,
}: {
  content?: SiteContent;
  /** This page's href (`/` or `/services`). wirePages and the studio pass it so the active link matches the page. */
  currentPath?: string;
}) {
  const { brand, nav } = content;
  const pages = linkedServices(content);
  const dd = useDisclosure({ hover: true });
  const mm = useDisclosure();
  const linkCls =
    'group relative px-[13px] py-2 text-[14.5px] font-semibold text-inkSoft transition-colors hover:text-ink aria-[current=page]:text-ink';
  const underline = (
    <span
      className="absolute bottom-1 left-[13px] right-[13px] h-0.5 origin-left scale-x-0 bg-accent transition-transform duration-300 group-hover:scale-x-100 group-aria-[current=page]:scale-x-100"
      aria-hidden="true"
    />
  );
  const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

  return (
    <nav
      className="sticky top-0 z-50 border-b border-rule backdrop-blur-md"
      style={{ background: 'color-mix(in srgb, var(--bg) 92%, transparent)' }}
      {...mm.root}
    >
      <div className="mx-auto flex h-[64px] max-w-[1120px] items-center gap-3 px-5 sm:gap-7 sm:px-6 md:h-[74px]">
        <a href="/" className="flex min-w-0 items-center gap-[11px]">
          <span
            className="accent-bar !h-9 !w-9 shrink-0 !rounded-[10px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]"
            aria-hidden="true"
          />
          <span className="min-w-0 font-heading text-[18px] font-semibold leading-none tracking-[-0.01em] text-ink md:text-[22px]">
            <E p="brand.name">{brand.name}</E>
            {brand.tagline && (
              <small className="mt-0.5 hidden font-sans text-[11px] font-medium tracking-[0.04em] text-inkSoft lg:block">
                <E p="brand.tagline">{brand.tagline}</E>
              </small>
            )}
          </span>
        </a>

        <div className="ml-2 hidden items-center gap-1 lg:flex">
          {nav.map((item, i) => {
            const link = (
              <a
                key={item.href + i}
                href={item.href}
                aria-current={currentPath && item.href === currentPath ? 'page' : undefined}
                className={linkCls}
              >
                <E p={`nav.${i}.label`}>{item.label}</E>
                {underline}
              </a>
            );
            if (!isServices(item.href) || pages.length === 0) return link;
            return (
              <span key={item.href + i} className="relative flex items-center" {...dd.root}>
                {link}
                <button
                  {...dd.button}
                  aria-label="Services menu"
                  className={`-ml-2.5 grid h-8 w-[26px] place-items-center rounded-md text-inkSoft transition-colors hover:text-accent aria-expanded:text-accent ${focusRing}`}
                >
                  <CaretDown size={14} weight="bold" aria-hidden="true" className={`transition-transform duration-200 ${dd.open ? 'rotate-180' : ''}`} />
                </button>
                <div
                  {...dd.panel}
                  className="shadow-brand-3 absolute left-0 top-[calc(100%+12px)] z-40 min-w-[280px] rounded-[14px] border border-rule bg-bg p-2 before:absolute before:inset-x-0 before:-top-3.5 before:h-3.5 before:content-['']"
                >
                  <ul>
                    {pages.map((s) => (
                      <li key={s.slug}>
                        <a
                          href={s.href!}
                          aria-current={currentPath === s.href ? 'page' : undefined}
                          className={`block whitespace-nowrap rounded-[8px] px-3 py-[11px] text-[14.5px] font-semibold text-ink transition-colors hover:bg-bgSoft hover:text-accent aria-[current=page]:text-accent ${focusRing}`}
                        >
                          <E p={`services.items.${s.index}.t`}>{s.t}</E>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </span>
            );
          })}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2.5 sm:gap-[18px]">
          <a href={brand.phoneHref} className="hidden items-center gap-2 font-heading text-[19px] font-semibold text-ink lg:flex">
            <Phone size={18} weight="fill" className="text-accent" aria-hidden="true" />
            <E p="brand.phone">{brand.phone}</E>
          </a>
          <a
            href={brand.phoneHref}
            aria-label={`Call ${brand.phone}`}
            className="grid h-[42px] w-[42px] place-items-center rounded-[10px] border border-rule text-accent lg:hidden"
          >
            <Phone size={18} weight="fill" aria-hidden="true" />
          </a>
          <a
            href="/contact"
            className="inline-flex items-center whitespace-nowrap rounded-full bg-accent px-[14px] py-[11px] text-[14px] font-bold text-accentFg transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.98] md:rounded-[10px] md:px-[22px] md:py-[13px] md:text-[15px]"
            style={{ boxShadow: '0 10px 24px -8px color-mix(in srgb, var(--accent) 50%, transparent)' }}
          >
            Book a visit
          </a>
          <button
            {...mm.button}
            aria-label={mm.open ? 'Close menu' : 'Open menu'}
            className={`grid h-[42px] w-[42px] place-items-center rounded-[10px] text-ink lg:hidden ${focusRing}`}
          >
            {mm.open ? <X size={20} weight="bold" aria-hidden="true" /> : <List size={20} weight="bold" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Phone menu: the same links, in the server HTML, shown when the menu button opens it. */}
      <div
        {...mm.panel}
        className="shadow-brand-3 absolute inset-x-0 top-full max-h-[calc(100vh-80px)] overflow-auto border-b border-rule bg-bg px-5 pb-[22px] pt-2 lg:hidden"
      >
        <ul>
          {nav.map((item, i) => (
            <li key={item.href + i}>
              <a
                href={item.href}
                aria-current={currentPath && item.href === currentPath ? 'page' : undefined}
                className={`block border-b border-rule px-1 py-[15px] font-heading text-[18px] font-semibold text-ink aria-[current=page]:text-accent ${focusRing}`}
              >
                <E p={`nav.${i}.label`}>{item.label}</E>
              </a>
              {isServices(item.href) && pages.length > 0 && (
                <ul className="border-b border-rule py-1.5 pl-4">
                  {pages.map((s) => (
                    <li key={s.slug}>
                      <a
                        href={s.href!}
                        aria-current={currentPath === s.href ? 'page' : undefined}
                        className={`block border-l-2 border-rule py-[9px] pl-3 text-[15px] font-semibold text-inkSoft transition-colors hover:border-accent hover:text-accent aria-[current=page]:border-accent aria-[current=page]:text-accent ${focusRing}`}
                      >
                        <E p={`services.items.${s.index}.t`}>{s.t}</E>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
        <a
          href={brand.phoneHref}
          className="mt-[18px] flex w-full items-center justify-center gap-2.5 rounded-[10px] bg-accent px-5 py-3.5 font-heading text-[17px] font-semibold text-accentFg"
        >
          <Phone size={18} weight="fill" aria-hidden="true" />
          Call <E p="brand.phone">{brand.phone}</E>
        </a>
      </div>
    </nav>
  );
}
