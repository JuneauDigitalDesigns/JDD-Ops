'use client';
// ─────────────────────────────────────────────────────────────────────────────
// PlumbingServiceHeader — the header of one per-service page (/services/<slug>), blocks 1–3 of
// service-page-spec.md §3, in the approved Plumbing language (service-pages mockup, `pl-hero
// vs-hero`, Xander 2026-11-10): the home hero's SPLIT PANEL, the deep-navy left holding the copy
// and the service's own photo on the right under the blue wash, with the seam gradient running
// the panel into it. A visible breadcrumb that matches client-seo's BreadcrumbList, the tag as the
// translucent pill, "{service} in {city}" as the page's only H1 (the city in the editable accent2
// light blue, as the home headline's emphasis), the generated answer-first intro, the pill phone
// button and jump links to the price and the questions (each shown only when that block exists).
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

export const meta = {
  id: 'plumbing-service-header',
  category: 'pageHeader',
  label: 'Plumbing / Service page header',
  consumes: ['services.items', 'brand.address', 'brand.phone', 'brand.phoneHref', 'extensions.serviceArea', 'work.projects', 'extensions.customerQuestions'],
  sharedDeps: ['@/lib/CoverImage', '@phosphor-icons/react', '@/lib/editable', '@/lib/serviceLinks'],
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
  const hasPrice = typeof s.item.priceFrom === 'string' && s.item.priceFrom.trim() !== '';
  const hasQuestions = serviceQuestions(content, s).length > 0;
  const jump = 'border-b pb-[3px] text-[14px] font-semibold text-onInk transition-colors hover:border-accent hover:text-[color:var(--accent-2)]';

  return (
    <section
      id="top"
      className={`grid grid-cols-1 bg-inkPanel2 text-onInk ${photo ? 'lg:min-h-[540px] lg:grid-cols-[1.02fr_0.98fr]' : ''}`}
    >
      <div className={`flex items-center px-5 pb-10 pt-7 sm:px-6 lg:py-[80px] ${photo ? 'lg:pl-0 lg:pr-14' : ''}`}>
        <div className={`w-full ${photo ? 'max-w-[560px] lg:ml-auto lg:pl-6' : 'mx-auto max-w-[1120px]'}`}>
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

          {(hasPrice || hasQuestions) && (
            <ul
              aria-label="On this page"
              className="mt-[26px] flex max-w-[50ch] flex-wrap gap-x-[22px] gap-y-2 border-t pt-5"
              style={{ borderColor: 'color-mix(in srgb, var(--on-ink) 16%, transparent)' }}
            >
              {hasPrice && (
                <li>
                  <a href="#pricing" className={jump} style={{ borderColor: 'color-mix(in srgb, var(--on-ink) 30%, transparent)' }}>{W.pricing}</a>
                </li>
              )}
              {hasQuestions && (
                <li>
                  <a href="#questions" className={jump} style={{ borderColor: 'color-mix(in srgb, var(--on-ink) 30%, transparent)' }}>{W.questions}</a>
                </li>
              )}
            </ul>
          )}
        </div>
      </div>

      {/* Photo column: the service's own photo, graded like the home hero's. A band after the copy on a phone. */}
      {photo && (
        <div className="relative min-h-[240px] overflow-hidden sm:min-h-[300px] lg:min-h-0">
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
