'use client';
// ─────────────────────────────────────────────────────────────────────────────
// PlumbingServiceHeader — the header of one per-service page (/services/<slug>), blocks 1–3 of
// service-page-spec.md §3, in the approved Plumbing language (service-pages mockup, `pl-hero
// vs-hero`, Xander 2026-11-10): the home hero's SPLIT PANEL, the deep-navy left holding the copy
// and the service's own photo on the right under the blue wash, with the seam gradient running
// the panel into it. A visible breadcrumb that matches client-seo's BreadcrumbList, the tag as the
// translucent pill, "{service} in {city}" as the page's only H1 (the city in the editable accent2
// light blue, as the home headline's emphasis), the generated answer-first intro, the pill phone
// button and a jump link to the questions (shown only when that block exists below). Since
// 2026-11-11 (Xander, "be upfront with pricing") the starting price sits here as the Plumbing price
// card, with "Ask for a quote" taking the visitor to the closing form already filled with the
// service: over the foot of the photo column on desktop (beside the heading), after the copy on a
// phone; with no photo, a column beside the copy.
//
// No form here: a service page's only form is the closing call to action (Xander 2026-11-10), so
// the photo column carries no intake card. On a phone the photo follows the copy as a band.
// wirePages and the Studio pass `serviceSlug`; an unknown slug renders nothing. Every word below
// that isn't client data was approved word for word on 2026-11-10.
// ─────────────────────────────────────────────────────────────────────────────
import { Phone } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { CoverImage } from '@/lib/CoverImage';
import { primaryCity, serviceBySlug, servicePhoto, serviceQuestions } from '@/lib/serviceLinks';
import { SERVICE_UPGRADE_WORDS, goToQuoteForm, servicePrice } from '@/lib/servicePage';

export const meta = {
  id: 'plumbing-service-header',
  category: 'pageHeader',
  label: 'Plumbing / Service page header',
  consumes: ['services.items', 'brand.address', 'brand.phone', 'brand.phoneHref', 'extensions.serviceArea', 'work.projects', 'extensions.customerQuestions'],
  sharedDeps: ['@/lib/CoverImage', '@phosphor-icons/react', '@/lib/editable', '@/lib/serviceLinks', '@/lib/servicePage'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

/** Approved word for word, 2026-11-10. */
export const SERVICE_HEADER_WORDS = { home: 'Home', services: 'Services', in: 'in', pricing: 'Pricing', questions: 'Questions' } as const;

export default function PlumbingServiceHeader({ content = CONTENT, serviceSlug }: { content?: SiteContent; serviceSlug?: string }) {
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
  const jump = 'border-b pb-[3px] text-[14px] font-semibold text-onInk transition-colors hover:border-accent hover:text-[color:var(--accent-2)]';

  // Upfront pricing (Xander 2026-11-11): the price the client gave, in view from the start, as the
  // Plumbing price card (accent into the dark panel). No price given: no card, and nothing about
  // price anywhere on the page. Rendered in exactly one place, chosen by whether there is a photo.
  const priceCard = price ? (
    <aside
      className={`relative overflow-hidden rounded-[20px] p-7 text-onInk ${
        photo
          ? 'z-10 mx-5 mb-10 sm:mx-6 sm:max-w-[340px] lg:col-start-2 lg:row-start-1 lg:m-10 lg:w-[280px] lg:self-end lg:justify-self-start'
          : 'mt-8 sm:max-w-[340px] lg:mt-0 lg:max-w-none'
      }`}
      style={{
        background: 'linear-gradient(135deg, var(--accent), var(--ink-panel-2))',
        boxShadow:
          'inset 0 0 0 1px color-mix(in srgb, var(--on-ink) 14%, transparent), 0 10px 24px color-mix(in srgb, var(--ink-panel) 14%, transparent), 0 40px 70px -30px color-mix(in srgb, var(--ink-panel) 50%, transparent)',
      }}
    >
      <span className="accent-bar absolute inset-x-0 top-0 !h-1 !w-auto !rounded-none" aria-hidden="true" />
      <span className="block text-[12px] font-bold uppercase tracking-[0.14em] text-[color:var(--accent-2)]">{U.startingAt}</span>
      <b className="mt-2 block font-heading text-[44px] font-extrabold leading-none tracking-[-0.03em] lg:text-[50px]">
        <E p={`services.items.${s.index}.priceFrom`}>{price}</E>
      </b>
      <a
        href="#cta"
        onClick={goToQuoteForm}
        className="mt-5 flex w-full items-center justify-center rounded-full bg-accent px-[22px] py-[14px] text-[16px] font-bold text-accentFg shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--on-ink)_22%,transparent)] transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.98]"
      >
        {U.askForQuote}
      </a>
    </aside>
  ) : null;

  return (
    <section
      id="top"
      className={`grid grid-cols-1 bg-inkPanel2 text-onInk ${photo ? 'lg:min-h-[540px] lg:grid-cols-[1.02fr_0.98fr]' : ''}`}
    >
      <div className={`flex items-center px-5 pb-10 pt-7 sm:px-6 lg:py-[80px] ${photo ? 'lg:col-start-1 lg:row-start-1 lg:pl-0 lg:pr-14' : ''}`}>
        <div
          className={`w-full ${photo ? 'max-w-[560px] lg:ml-auto lg:pl-6' : 'mx-auto max-w-[1120px]'} ${
            price && !photo ? 'lg:grid lg:grid-cols-[1fr_280px] lg:items-end lg:gap-12' : ''
          }`}
        >
          <div className="min-w-0">
            <nav aria-label="Breadcrumb" className="mb-[22px] lg:mb-[26px]">
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
                className="inline-flex items-center rounded-full border px-[15px] py-[7px] text-[13px] font-bold leading-none text-onInkSoft"
                style={{
                  borderColor: 'color-mix(in srgb, var(--on-ink) 22%, transparent)',
                  background: 'color-mix(in srgb, var(--on-ink) 12%, transparent)',
                }}
              >
                <E p={`services.items.${s.index}.tag`}>{s.tag}</E>
              </span>
            )}

            <h1 className="mt-[22px] max-w-[16ch] font-heading text-[40px] font-extrabold leading-none tracking-[-0.02em] text-onInk sm:text-[clamp(42px,5vw,60px)]">
              <E p={`services.items.${s.index}.t`}>{s.t}</E>
              {city && (
                <>
                  {' '}{W.in} <span className="text-[color:var(--accent-2)]">{city}</span>
                </>
              )}
            </h1>

            {intro && (
              <p className="mt-[18px] max-w-[46ch] text-[17px] leading-[1.6] text-onInkSoft sm:text-[18px]">
                <E p={`services.items.${s.index}.page.intro`}>{intro}</E>
              </p>
            )}

            <div className="mt-7">
              <a
                href={brand.phoneHref}
                className="inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-accent px-[26px] py-[14px] font-heading text-[20px] font-extrabold tracking-[-0.01em] text-accentFg transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.98] sm:w-auto"
                style={{ boxShadow: '0 10px 24px -8px color-mix(in srgb, var(--accent) 50%, transparent)' }}
              >
                <Phone size={20} weight="fill" aria-hidden="true" />
                <E p="brand.phone">{brand.phone}</E>
              </a>
            </div>

            {hasQuestions && (
              <ul
                aria-label="On this page"
                className="mt-[26px] flex max-w-[50ch] flex-wrap gap-x-[22px] gap-y-2 border-t pt-5"
                style={{ borderColor: 'color-mix(in srgb, var(--on-ink) 16%, transparent)' }}
              >
                <li>
                  <a href="#questions" className={jump} style={{ borderColor: 'color-mix(in srgb, var(--on-ink) 30%, transparent)' }}>{W.questions}</a>
                </li>
              </ul>
            )}
          </div>

          {!photo && priceCard}
        </div>
      </div>

      {/* With a photo, the price card is a grid item of its own: after the copy on a phone (before
          the photo band), over the foot of the photo column on desktop. */}
      {photo && priceCard}

      {/* Photo column: the service's own photo, graded like the home hero's. A band after the copy on a phone. */}
      {photo && (
        <div className="relative min-h-[240px] overflow-hidden sm:min-h-[300px] lg:col-start-2 lg:row-start-1 lg:min-h-0">
          <div
            className="absolute inset-0 isolate overflow-hidden"
          >
            <CoverImage url={photo.url} alt={photo.alt} sizes="100vw" priority />
          </div>
          {/* Blue wash: one grade for any client photo. */}
          <div className="absolute inset-0 bg-accent opacity-40 mix-blend-color" aria-hidden="true" />
          {/* Seam: the panel runs into the photo. Top-down on a phone, left-to-right on desktop. */}
          <div
            className="absolute inset-0 lg:hidden"
            aria-hidden="true"
            style={{ background: 'linear-gradient(180deg, var(--ink-panel-2), transparent 45%, color-mix(in srgb, var(--ink-panel-2) 70%, transparent))' }}
          />
          <div
            className="absolute inset-0 hidden lg:block"
            aria-hidden="true"
            style={{ background: 'linear-gradient(90deg, var(--ink-panel-2), transparent 42%)' }}
          />
        </div>
      )}
    </section>
  );
}
