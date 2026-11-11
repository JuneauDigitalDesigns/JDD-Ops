'use client';
// ─────────────────────────────────────────────────────────────────────────────
// DetailServiceHeader — the header of one per-service page (/services/<slug>), blocks 1–3 of
// service-page-spec.md §3, in the approved Car Detailing language (service-pages mockup,
// `.dt-hero.vs-hero`, Xander 2026-11-10): the home hero's CENTRED vignette over the service's own
// desaturated photo, with a darker central scrim than the home hero's so the intro reads over a
// busy photo; a centred breadcrumb that matches client-seo's BreadcrumbList; the tag as a
// champagne eyebrow over the thin gold rule; "{service} in {city}" as the page's only H1 (city in
// the accent); the generated answer-first intro; the phone button; and centred jump links to the
// price and the questions (each shown only when that block exists below).
//
// No form here: a service page's only form is the closing call to action (Xander 2026-11-10).
// wirePages and the Studio pass `serviceSlug`; an unknown slug renders nothing. Every word below
// that isn't client data was approved word for word on 2026-11-10. The H1 never animates (LCP).
// Every colour is a palette token (ink-panel, on-ink, accent); the gold rule is the accent pulled
// toward black, as everywhere else in this template.
// ─────────────────────────────────────────────────────────────────────────────
import { Phone } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { CoverImage } from '@/lib/CoverImage';
import { primaryCity, serviceBySlug, servicePhoto, serviceQuestions } from '@/lib/serviceLinks';

export const meta = {
  id: 'detail-service-header',
  category: 'pageHeader',
  label: 'Car Detailing / Service page header',
  consumes: ['services.items', 'brand.address', 'brand.phone', 'brand.phoneHref', 'extensions.serviceArea', 'work.projects', 'extensions.customerQuestions'],
  sharedDeps: ['@/lib/CoverImage', '@phosphor-icons/react', '@/lib/editable', '@/lib/serviceLinks'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

/** Approved word for word, 2026-11-10. */
export const SERVICE_HEADER_WORDS = { home: 'Home', services: 'Services', in: 'in', pricing: 'Pricing', questions: 'Questions' } as const;

const GOLD_RULE = 'linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 65%, black) 60%, transparent)';
/** The near-black panel at a given opacity, for the vignette scrim. */
const panel = (pct: number) => `color-mix(in srgb, var(--ink-panel) ${pct}%, transparent)`;

export default function DetailServiceHeader({ content = CONTENT, serviceSlug }: { content?: SiteContent; serviceSlug?: string }) {
  const s = serviceBySlug(content, serviceSlug);
  if (!s) return null;
  const { brand } = content;
  const W = SERVICE_HEADER_WORDS;
  const city = primaryCity(content);
  const photo = servicePhoto(content, s);
  const intro = typeof (s.item.page as { intro?: unknown } | undefined)?.intro === 'string' ? ((s.item.page as { intro: string }).intro.trim()) : '';
  const hasPrice = typeof s.item.priceFrom === 'string' && s.item.priceFrom.trim() !== '';
  const hasQuestions = serviceQuestions(content, s).length > 0;
  const jump = 'border-b border-[color:color-mix(in_srgb,var(--on-ink)_30%,transparent)] pb-[3px] text-[14px] font-semibold text-onInk transition-colors hover:border-accent hover:text-accent';

  return (
    <section id="top" className="relative isolate flex items-center overflow-hidden bg-inkPanel text-center text-onInk sm:min-h-[600px]">
      {photo && (
        <div
          className="absolute inset-0 isolate overflow-hidden"
          style={{ filter: 'saturate(.82) contrast(1.06)' }}
        >
          <CoverImage url={photo.url} alt={photo.alt} sizes="100vw" priority />
        </div>
      )}
      {/* Darker in the middle than the home hero's vignette: the intro sits on the busiest part of the photo. */}
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{ background: `radial-gradient(70% 60% at 50% 50%, ${panel(80)}, ${panel(55)} 70%, ${panel(90)} 100%)` }}
      />

      <div className="relative mx-auto w-full max-w-[860px] px-5 pb-12 pt-10 sm:px-6 sm:py-[96px]">
        <nav aria-label="Breadcrumb" className="mb-5 sm:mb-[22px]">
          <ol className="flex flex-wrap items-center justify-center gap-2 text-[13px] font-semibold text-onInkSoft">
            <li><a href="/" className="transition-colors hover:text-onInk">{W.home}</a></li>
            <li className="opacity-55" aria-hidden="true">›</li>
            <li><a href="/services" className="transition-colors hover:text-onInk">{W.services}</a></li>
            <li className="opacity-55" aria-hidden="true">›</li>
            <li aria-current="page" className="text-onInk"><E p={`services.items.${s.index}.t`}>{s.t}</E></li>
          </ol>
        </nav>

        {s.tag && (
          <div className="mb-[18px] text-[11.5px] font-semibold uppercase leading-none tracking-[0.26em] text-accent">
            <E p={`services.items.${s.index}.tag`}>{s.tag}</E>
          </div>
        )}
        <div className="mx-auto h-px w-[72px]" style={{ background: GOLD_RULE }} aria-hidden="true" />

        <h1 className="mt-[22px] font-heading text-[40px] font-extrabold leading-[0.98] tracking-[-0.016em] text-onInk [text-shadow:0_3px_18px_rgba(0,0,0,0.35)] sm:text-[clamp(44px,6vw,74px)]">
          <E p={`services.items.${s.index}.t`}>{s.t}</E>
          {city && (
            <>
              {' '}{W.in} <span className="text-accent">{city}</span>
            </>
          )}
        </h1>

        {intro && (
          <p className="mx-auto mt-5 max-w-[52ch] text-[17px] leading-[1.62] text-onInkSoft sm:text-[18.5px]">
            <E p={`services.items.${s.index}.page.intro`}>{intro}</E>
          </p>
        )}

        <div className="mt-7 flex justify-center">
          <a
            href={brand.phoneHref}
            className="inline-flex w-full items-center justify-center gap-[10px] rounded-[8px] bg-accent px-[22px] py-[14px] font-heading text-[20px] font-extrabold tracking-[-0.01em] text-accentFg transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.98] sm:w-auto"
            style={{ boxShadow: '0 10px 24px -8px color-mix(in srgb, var(--accent) 55%, transparent)' }}
          >
            <Phone size={19} weight="fill" aria-hidden="true" />
            <E p="brand.phone">{brand.phone}</E>
          </a>
        </div>

        {(hasPrice || hasQuestions) && (
          <ul
            aria-label="On this page"
            className="mx-auto mt-[26px] flex max-w-[50ch] flex-wrap justify-center gap-x-[22px] gap-y-2 border-t border-[color:color-mix(in_srgb,var(--on-ink)_16%,transparent)] pt-5"
          >
            {hasPrice && <li><a href="#pricing" className={jump}>{W.pricing}</a></li>}
            {hasQuestions && <li><a href="#questions" className={jump}>{W.questions}</a></li>}
          </ul>
        )}
      </div>
    </section>
  );
}
