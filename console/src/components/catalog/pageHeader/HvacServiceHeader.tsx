'use client';
// ─────────────────────────────────────────────────────────────────────────────
// HvacServiceHeader — the header of one per-service page (/services/<slug>), blocks 1–3 of
// service-page-spec.md §3, in the approved HVAC language (service-pages mockup v6, Xander
// 2026-11-10): the service's own photo under the home hero's navy wash and scrim, a visible
// breadcrumb that matches client-seo's BreadcrumbList, "{service} in {city}" as the page's only
// H1, the generated answer-first intro, the phone button and jump links to the price and the
// questions (each shown only when that block exists below).
//
// No form here: a service page's only form is the closing call to action (Xander 2026-11-10).
// wirePages and the Studio pass `serviceSlug`; an unknown slug renders nothing. Every word below
// that isn't client data was approved word for word on 2026-11-10.
// ─────────────────────────────────────────────────────────────────────────────
import { Phone } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { imageAt } from '@/lib/localImage';
import { primaryCity, serviceBySlug, servicePhoto, serviceQuestions } from '@/lib/serviceLinks';

export const meta = {
  id: 'hvac-service-header',
  category: 'pageHeader',
  label: 'HVAC / Service page header',
  consumes: ['services.items', 'brand.address', 'brand.phone', 'brand.phoneHref', 'extensions.serviceArea', 'work.projects', 'extensions.customerQuestions'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/editable', '@/lib/localImage', '@/lib/serviceLinks'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

/** Approved word for word, 2026-11-10. */
export const SERVICE_HEADER_WORDS = { home: 'Home', services: 'Services', in: 'in', pricing: 'Pricing', questions: 'Questions' } as const;

export default function HvacServiceHeader({ content = CONTENT, serviceSlug }: { content?: SiteContent; serviceSlug?: string }) {
  const s = serviceBySlug(content, serviceSlug);
  if (!s) return null;
  const { brand } = content;
  const W = SERVICE_HEADER_WORDS;
  const city = primaryCity(content);
  const photo = servicePhoto(content, s);
  const intro = typeof (s.item.page as { intro?: unknown } | undefined)?.intro === 'string' ? ((s.item.page as { intro: string }).intro.trim()) : '';
  const hasPrice = typeof s.item.priceFrom === 'string' && s.item.priceFrom.trim() !== '';
  const hasQuestions = serviceQuestions(content, s).length > 0;

  return (
    <section id="top" className="relative isolate overflow-hidden bg-inkPanel text-onInk">
      {photo && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${imageAt(photo.url, 1536)})` }}
          role="img"
          aria-label={photo.alt}
        />
      )}
      <div className="absolute inset-0 bg-[color:var(--accent-2)] opacity-55 mix-blend-color" aria-hidden="true" />
      <div
        className="absolute inset-0 lg:hidden"
        aria-hidden="true"
        style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--ink-panel) 70%, transparent), color-mix(in srgb, var(--ink-panel) 92%, transparent) 55%)' }}
      />
      <div
        className="absolute inset-0 hidden lg:block"
        aria-hidden="true"
        style={{
          background:
            'linear-gradient(90deg, color-mix(in srgb, var(--ink-panel) 94%, transparent) 0%, color-mix(in srgb, var(--ink-panel) 78%, transparent) 48%, color-mix(in srgb, var(--ink-panel) 30%, transparent) 100%)',
        }}
      />

      <div className="relative mx-auto max-w-[1120px] px-5 pb-12 pt-7 sm:px-6 lg:pb-24 lg:pt-14">
        <div className="max-w-[720px]">
          <nav aria-label="Breadcrumb" className="mb-[22px] lg:mb-[34px]">
            <ol className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-onInkSoft">
              <li><a href="/" className="transition-colors hover:text-onInk">{W.home}</a></li>
              <li className="opacity-55" aria-hidden="true">›</li>
              <li><a href="/services" className="transition-colors hover:text-onInk">{W.services}</a></li>
              <li className="opacity-55" aria-hidden="true">›</li>
              <li aria-current="page" className="text-onInk"><E p={`services.items.${s.index}.t`}>{s.t}</E></li>
            </ol>
          </nav>

          {s.tag && (
            <div className="flex items-center gap-2.5 text-[12px] font-bold uppercase tracking-[0.14em] text-[color:color-mix(in_srgb,var(--accent-2)_45%,var(--on-ink))]">
              <span className="accent-bar !h-[3px] !w-7" aria-hidden="true" />
              <E p={`services.items.${s.index}.tag`}>{s.tag}</E>
            </div>
          )}

          <h1 className="mt-4 max-w-[16ch] font-heading text-[40px] font-medium leading-none tracking-[-0.015em] text-onInk [text-shadow:0_3px_18px_rgba(0,0,0,0.35)] sm:text-[clamp(40px,5vw,66px)]">
            <E p={`services.items.${s.index}.t`}>{s.t}</E>
            {city && (
              <>
                {' '}{W.in} <span className="text-accent">{city}</span>
              </>
            )}
          </h1>

          {intro && (
            <p className="mt-5 max-w-[50ch] text-[17px] leading-[1.62] text-onInkSoft sm:text-[18px]">
              <E p={`services.items.${s.index}.page.intro`}>{intro}</E>
            </p>
          )}

          <div className="mt-7">
            <a
              href={brand.phoneHref}
              className="inline-flex w-full items-center justify-center gap-2.5 rounded-[10px] bg-accent px-[22px] py-[14px] font-heading text-[21px] font-semibold tracking-[0.01em] text-accentFg transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-105 sm:w-auto"
              style={{ boxShadow: '0 10px 24px -8px color-mix(in srgb, var(--accent) 50%, transparent)' }}
            >
              <Phone size={20} weight="fill" aria-hidden="true" />
              <E p="brand.phone">{brand.phone}</E>
            </a>
          </div>

          {(hasPrice || hasQuestions) && (
            <ul aria-label="On this page" className="mt-7 flex max-w-[50ch] flex-wrap gap-x-[22px] gap-y-2 border-t border-ruleInk pt-5">
              {hasPrice && (
                <li><a href="#pricing" className="border-b border-ruleInk pb-[3px] text-[14px] font-semibold text-onInk transition-colors hover:border-accent hover:text-accent">{W.pricing}</a></li>
              )}
              {hasQuestions && (
                <li><a href="#questions" className="border-b border-ruleInk pb-[3px] text-[14px] font-semibold text-onInk transition-colors hover:border-accent hover:text-accent">{W.questions}</a></li>
              )}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
