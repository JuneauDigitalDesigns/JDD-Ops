'use client';
// ─────────────────────────────────────────────────────────────────────────────
// LawnServiceHeader — the header of one per-service page (/services/<slug>), blocks 1–3 of
// service-page-spec.md §3, in the approved Lawn language (service-pages mockup, `lw-hero vs-hero`,
// Xander 2026-11-10): the service's own photo under the home hero's forest wash and forest scrim
// (heavy left, light right on desktop; climbing from the bottom on a phone), a visible breadcrumb
// that matches client-seo's BreadcrumbList, the service tag as the sun-gold pill (the home hero's
// review pill), "{service} in {city}" as the page's only H1 with the city in sun gold, the
// generated answer-first intro, the phone button and a jump link to the questions (shown only when
// that block exists below). Since 2026-11-11 (Xander, "be upfront with pricing") the starting price
// sits here, beside the heading, in a frosted forest card with Lawn's "/ visit", with "Ask for a
// quote" taking the visitor to the closing form already filled with the service.
//
// No form here: a service page's only form is the closing call to action (Xander 2026-11-10).
// No plan picker either: that is LawnHero's, and a service page quotes its own price here.
// wirePages and the Studio pass `serviceSlug`; an unknown slug renders nothing. Every word below
// that isn't client data was approved word for word on 2026-11-10. Every colour is a palette
// token: forest = ink-panel-2, sun gold = the editable accent2 slot. Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { Phone } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { CoverImage } from '@/lib/CoverImage';
import { primaryCity, serviceBySlug, servicePhoto, serviceQuestions } from '@/lib/serviceLinks';
import { SERVICE_UPGRADE_WORDS, goToQuoteForm, servicePrice } from '@/lib/servicePage';

export const meta = {
  id: 'lawn-service-header',
  category: 'pageHeader',
  label: 'Lawn / Service page header',
  consumes: ['services.items', 'brand.address', 'brand.phone', 'brand.phoneHref', 'extensions.serviceArea', 'work.projects', 'extensions.customerQuestions'],
  sharedDeps: ['@/lib/CoverImage', '@phosphor-icons/react', '@/lib/editable', '@/lib/serviceLinks', '@/lib/servicePage'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

/** Approved word for word, 2026-11-10. "/ visit" is the Lawn template's own price suffix, moved up with the price. */
export const SERVICE_HEADER_WORDS = { home: 'Home', services: 'Services', in: 'in', pricing: 'Pricing', questions: 'Questions', perVisit: '/ visit' } as const;

export default function LawnServiceHeader({ content = CONTENT, serviceSlug }: { content?: SiteContent; serviceSlug?: string }) {
  const s = serviceBySlug(content, serviceSlug);
  if (!s) return null;
  const { brand } = content;
  const W = SERVICE_HEADER_WORDS;
  const city = primaryCity(content);
  const photo = servicePhoto(content, s);
  const intro = typeof (s.item.page as { intro?: unknown } | undefined)?.intro === 'string' ? ((s.item.page as { intro: string }).intro.trim()) : '';
  const U = SERVICE_UPGRADE_WORDS;
  const price = servicePrice(s);
  const hasQuestions = serviceQuestions(content, s).length > 0;
  const jumpCls =
    'inline-flex border-b border-[color:color-mix(in_srgb,var(--on-ink)_30%,transparent)] pb-[3px] text-[14px] font-semibold text-onInk transition-colors hover:border-accent hover:text-accent';

  return (
    <section id="top" className="relative isolate flex items-center overflow-hidden bg-inkPanel2 text-onInk lg:min-h-[560px]">
      {photo && (
        <div
          className="absolute inset-0 isolate overflow-hidden"
        >
          <CoverImage url={photo.url} alt={photo.alt} sizes="100vw" priority />
        </div>
      )}
      {/* Forest wash: one grade for any client photo (colour blend of the forest panel). */}
      <div className="absolute inset-0 bg-inkPanel2 opacity-35 mix-blend-color" aria-hidden="true" />
      {/* Scrim: on a phone it climbs from the bottom; on desktop heavy over the copy, light over the photo. */}
      <div
        className="absolute inset-0 lg:hidden"
        aria-hidden="true"
        style={{
          background:
            'linear-gradient(180deg, color-mix(in srgb, var(--ink-panel-2) 70%, transparent), color-mix(in srgb, var(--ink-panel-2) 92%, transparent) 60%)',
        }}
      />
      <div
        className="absolute inset-0 hidden lg:block"
        aria-hidden="true"
        style={{
          background:
            'linear-gradient(95deg, color-mix(in srgb, var(--ink-panel-2) 90%, transparent) 0%, color-mix(in srgb, var(--ink-panel-2) 62%, transparent) 46%, color-mix(in srgb, var(--ink-panel-2) 14%, transparent) 100%),' +
            'linear-gradient(180deg, color-mix(in srgb, var(--ink-panel-2) 10%, transparent), color-mix(in srgb, var(--ink-panel-2) 50%, transparent))',
        }}
      />

      <div className={`relative mx-auto w-full max-w-[1120px] px-5 pb-12 pt-8 sm:px-6 lg:py-[88px] ${price ? 'lg:grid lg:grid-cols-[1fr_280px] lg:items-end lg:gap-12' : ''}`}>
        <div className="min-w-0 max-w-[720px]">
          <nav aria-label="Breadcrumb" className="mb-5 lg:mb-[26px]">
            <ol className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-onInkSoft">
              <li><a href="/" className="transition-colors hover:text-onInk">{W.home}</a></li>
              <li className="opacity-55" aria-hidden="true">›</li>
              <li><a href="/services" className="transition-colors hover:text-onInk">{W.services}</a></li>
              <li className="opacity-55" aria-hidden="true">›</li>
              <li aria-current="page" className="text-onInk"><E p={`services.items.${s.index}.t`}>{s.t}</E></li>
            </ol>
          </nav>

          {s.tag && (
            <span
              className="inline-flex items-center gap-2 rounded-full border px-[15px] py-[7px] text-[13px] font-bold text-[color:var(--accent-2)]"
              style={{
                borderColor: 'color-mix(in srgb, var(--accent-2) 42%, transparent)',
                background: 'color-mix(in srgb, var(--accent-2) 18%, transparent)',
              }}
            >
              <E p={`services.items.${s.index}.tag`}>{s.tag}</E>
            </span>
          )}

          <h1 className="mt-5 max-w-[18ch] font-heading text-[42px] font-extrabold leading-none tracking-[-0.02em] text-onInk sm:text-[clamp(44px,5.6vw,68px)]">
            <E p={`services.items.${s.index}.t`}>{s.t}</E>
            {city && (
              <>
                {' '}{W.in} <span className="text-[color:var(--accent-2)]">{city}</span>
              </>
            )}
          </h1>

          {intro && (
            <p className="mt-[18px] max-w-[46ch] text-[17px] leading-[1.6] text-onInkSoft sm:text-[18.5px]">
              <E p={`services.items.${s.index}.page.intro`}>{intro}</E>
            </p>
          )}

          <div className="mt-7">
            <a
              href={brand.phoneHref}
              className="inline-flex w-full items-center justify-center gap-2.5 rounded-[14px] bg-accent px-[22px] py-[14px] font-heading text-[21px] font-bold tracking-[-0.01em] text-accentFg transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.98] sm:w-auto"
              style={{ boxShadow: '0 10px 24px -8px color-mix(in srgb, var(--accent) 55%, transparent)' }}
            >
              <Phone size={20} weight="fill" aria-hidden="true" />
              <E p="brand.phone">{brand.phone}</E>
            </a>
          </div>

          {hasQuestions && (
            <ul
              aria-label="On this page"
              className="mt-[26px] flex max-w-[50ch] flex-wrap gap-x-[22px] gap-y-2 border-t border-[color:color-mix(in_srgb,var(--on-ink)_16%,transparent)] pt-5"
            >
              <li><a href="#questions" className={jumpCls}>{W.questions}</a></li>
            </ul>
          )}
        </div>

        {/* Upfront pricing (Xander 2026-11-11): the price the client gave, in view from the start.
            No price given: no box, and nothing about price anywhere on the page. */}
        {price && (
          <aside
            className="shadow-brand-3 relative mt-8 overflow-hidden rounded-[22px] border border-[color:color-mix(in_srgb,var(--on-ink)_16%,transparent)] bg-[color:color-mix(in_srgb,var(--ink-panel-2)_84%,transparent)] p-6 backdrop-blur-sm lg:mt-0 lg:p-7"
          >
            <span className="accent-bar absolute inset-x-0 top-0 !h-1 !w-auto !rounded-none" aria-hidden="true" />
            <span className="block text-[12px] font-bold uppercase tracking-[0.14em] text-[color:var(--accent-2)]">{U.startingAt}</span>
            <b className="mt-2.5 flex flex-wrap items-baseline gap-2 font-heading text-[44px] font-extrabold leading-none tracking-[-0.03em] text-onInk lg:text-[52px]">
              <E p={`services.items.${s.index}.priceFrom`}>{price}</E>
              <small className="font-sans text-[15px] font-semibold tracking-normal text-onInkSoft">{W.perVisit}</small>
            </b>
            <a
              href="#cta"
              onClick={goToQuoteForm}
              className="mt-5 flex w-full items-center justify-center rounded-[14px] bg-accent px-[22px] py-[14px] text-[16px] font-bold text-accentFg transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.98]"
              style={{ boxShadow: '0 10px 24px -8px color-mix(in srgb, var(--accent) 55%, transparent)' }}
            >
              {U.askForQuote}
            </a>
          </aside>
        )}
      </div>
    </section>
  );
}
