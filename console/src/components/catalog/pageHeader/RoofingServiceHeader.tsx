'use client';
// ─────────────────────────────────────────────────────────────────────────────
// RoofingServiceHeader — the header of one per-service page (/services/<slug>), blocks 1–3 of
// service-page-spec.md §3, in the approved Roofing language (service-pages mockup, `roofing`,
// Xander 2026-11-10): the home hero's full-bleed photograph, here the service's own photo, with
// the copy bottom-left. Unlike the home hero's bottom-climbing scrim, the scrim darkens left to
// right behind the copy (with a light floor at the bottom), so the photo still reads on the right.
// On a phone it is one top-to-bottom wash. A visible breadcrumb that matches client-seo's
// BreadcrumbList, the service's tag as the amber kicker (the frosted panel with the emphasis-colour
// bar), "{service} in {city}" as the page's only H1 with the city in the emphasis colour, the
// generated answer-first intro, the square accent phone button and jump links to the price and
// the questions (each shown only when that block exists below).
//
// No form here: a service page's only form is the closing call to action (Xander 2026-11-10).
// wirePages and the Studio pass `serviceSlug`; an unknown slug renders nothing. Every word below
// that isn't client data was approved word for word on 2026-11-10.
//
// Colours are palette tokens: the ground is ink-panel-2, the scrim mixes ink-panel, the emphasis
// colour is var(--accent-2) (the editable accent2 slot that replaced the hardcoded amber).
// ─────────────────────────────────────────────────────────────────────────────
import { Phone } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { CoverImage } from '@/lib/CoverImage';
import { primaryCity, serviceBySlug, servicePhoto, serviceQuestions } from '@/lib/serviceLinks';

export const meta = {
  id: 'roofing-service-header',
  category: 'pageHeader',
  label: 'Roofing / Service page header',
  consumes: ['services.items', 'brand.address', 'brand.phone', 'brand.phoneHref', 'extensions.serviceArea', 'work.projects', 'extensions.customerQuestions'],
  sharedDeps: ['@/lib/CoverImage', '@phosphor-icons/react', '@/lib/editable', '@/lib/serviceLinks'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

/** Approved word for word, 2026-11-10. */
export const SERVICE_HEADER_WORDS = { home: 'Home', services: 'Services', in: 'in', pricing: 'Pricing', questions: 'Questions' } as const;

export default function RoofingServiceHeader({ content = CONTENT, serviceSlug }: { content?: SiteContent; serviceSlug?: string }) {
  const s = serviceBySlug(content, serviceSlug);
  if (!s) return null;
  const { brand } = content;
  const W = SERVICE_HEADER_WORDS;
  const city = primaryCity(content);
  const photo = servicePhoto(content, s);
  const intro = typeof (s.item.page as { intro?: unknown } | undefined)?.intro === 'string' ? ((s.item.page as { intro: string }).intro.trim()) : '';
  const hasPrice = typeof s.item.priceFrom === 'string' && s.item.priceFrom.trim() !== '';
  const hasQuestions = serviceQuestions(content, s).length > 0;
  const jumpCls =
    'border-b border-ruleInk pb-[3px] text-[14px] font-semibold text-onInk transition-colors hover:border-accent hover:text-accent';

  return (
    <section id="top" className="relative isolate flex items-end overflow-hidden bg-inkPanel2 text-onInk lg:min-h-[600px]">
      {photo && (
        <div
          className="absolute inset-0 isolate overflow-hidden"
        >
          <CoverImage url={photo.url} alt={photo.alt} sizes="100vw" priority position="object-[center_30%]" />
        </div>
      )}
      {/* Phone: one top-to-bottom wash, the copy runs the full width. */}
      <div
        className="absolute inset-0 lg:hidden"
        aria-hidden="true"
        style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--ink-panel) 78%, transparent), color-mix(in srgb, var(--ink-panel) 94%, transparent))' }}
      />
      {/* Desktop: darkest behind the copy on the left, the photo opening up to the right. */}
      <div
        className="absolute inset-0 hidden lg:block"
        aria-hidden="true"
        style={{
          background:
            'linear-gradient(90deg, color-mix(in srgb, var(--ink-panel) 92%, transparent) 0%, color-mix(in srgb, var(--ink-panel) 74%, transparent) 50%, color-mix(in srgb, var(--ink-panel) 25%, transparent) 100%),' +
            'linear-gradient(180deg, transparent 55%, color-mix(in srgb, var(--ink-panel) 70%, transparent))',
        }}
      />

      <div className="relative mx-auto w-full max-w-[1120px] px-5 pb-12 pt-10 sm:px-6 lg:pb-[72px] lg:pt-[112px]">
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
              className="inline-flex items-center border-l-[3px] border-[color:var(--accent-2)] py-2 pl-[11px] pr-3 text-[12px] font-bold uppercase tracking-[0.2em] text-[color:var(--accent-2)] backdrop-blur-[6px]"
              style={{ background: 'color-mix(in srgb, var(--ink-panel) 55%, transparent)' }}
            >
              <E p={`services.items.${s.index}.tag`}>{s.tag}</E>
            </span>
          )}

          <h1 className="mt-[22px] max-w-[18ch] text-balance font-heading text-[40px] font-extrabold leading-[0.98] tracking-[-0.024em] text-onInk sm:text-[clamp(44px,5.6vw,72px)] sm:leading-[0.95]">
            <E p={`services.items.${s.index}.t`}>{s.t}</E>
            {city && (
              <>
                {' '}{W.in} <span className="text-[color:var(--accent-2)]">{city}</span>
              </>
            )}
          </h1>

          {intro && (
            <p className="mt-5 max-w-[50ch] text-[17px] leading-[1.6] text-onInkSoft sm:text-[19px]">
              <E p={`services.items.${s.index}.page.intro`}>{intro}</E>
            </p>
          )}

          <div className="mt-[30px]">
            <a
              href={brand.phoneHref}
              className="inline-flex w-full items-center justify-center gap-[10px] rounded-[4px] bg-accent px-[22px] py-[14px] font-heading text-[18px] font-extrabold tracking-[-0.01em] text-accentFg transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.98] sm:w-auto"
              style={{ boxShadow: '0 10px 24px -8px color-mix(in srgb, var(--accent) 55%, transparent)' }}
            >
              <Phone size={20} weight="fill" aria-hidden="true" />
              <E p="brand.phone">{brand.phone}</E>
            </a>
          </div>

          {(hasPrice || hasQuestions) && (
            <ul aria-label="On this page" className="mt-[26px] flex max-w-[50ch] flex-wrap gap-x-[22px] gap-y-2 border-t border-ruleInk pt-5">
              {hasPrice && <li><a href="#pricing" className={jumpCls}>{W.pricing}</a></li>}
              {hasQuestions && <li><a href="#questions" className={jumpCls}>{W.questions}</a></li>}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
