'use client';
// ─────────────────────────────────────────────────────────────────────────────
// LawnTownHeader — the header of a town page (/areas/<town>), a town + service page
// (/areas/<town>/<service>) and the /areas index, in LawnServiceHeader / LawnServiceDetail's language. Xander approved the mockups
// "HVAC Town Pages" on 2026-11-12 ("Build as shown", T1 to T5 word for word); what it says, and
// when, is lib/TownPage.tsx's, shared by every trade.
//   town page:  "Home › Areas › {Town}", H1 "{Trade} in {Town}", the generated intro, the phone
//   spoke:      "Home › Areas › {Town} › {Service}", H1 "{Service} in {Town}", the intro, the phone
//   /areas:     "Home › Areas", H1 "Areas we serve" (no townSlug; the page's generated header data
//               is ignored, since the heading is the approved one)
// wirePages and the Studio pass `townSlug` (and a spoke's `serviceSlug`); a page the site doesn't
// have renders nothing. No form here: the page's only form is its closing call to action.
// ─────────────────────────────────────────────────────────────────────────────
import { CONTENT, type SiteContent } from '@/data/site';
import { TownHeader, type TownHeaderLook } from '@/lib/TownPage';

export const meta = {
  id: 'lawn-town-header',
  category: 'pageHeader',
  label: 'Lawn / Town page header',
  consumes: ['areaPages', 'areaCopy', 'extensions.serviceArea', 'work.projects', 'services.items', 'servicePages', 'brand.address', 'brand.phone', 'brand.phoneHref'],
  sharedDeps: ['@/lib/TownPage', '@/lib/townLinks', '@/lib/serviceLinks', '@/lib/CoverImage', '@/lib/editable', '@phosphor-icons/react'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

/** What the business does, for "{Trade} in {Town}". The console's TRADE_LABELS (town-pages.test.mjs). */
export const TRADE = 'Lawn Care';

const LOOK: TownHeaderLook = {
  trade: TRADE,
  section: 'relative isolate flex items-center overflow-hidden bg-inkPanel2 text-onInk lg:min-h-[560px]',
  overlays: (
  <>
    <div className="absolute inset-0 bg-inkPanel2 opacity-35 mix-blend-color" aria-hidden="true" />
    <div
      className="absolute inset-0 lg:hidden"
      aria-hidden="true"
      style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--ink-panel-2) 70%, transparent), color-mix(in srgb, var(--ink-panel-2) 92%, transparent) 60%)' }}
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
  </>
  ),
  inner: 'relative mx-auto w-full max-w-[1120px] px-5 pb-12 pt-8 sm:px-6 lg:py-[88px]',
  crumbs: 'flex flex-wrap items-center gap-2 text-[13px] font-semibold text-onInkSoft',
  h1: 'mt-5 max-w-[18ch] font-heading text-[42px] font-extrabold leading-none tracking-[-0.02em] text-onInk sm:text-[clamp(44px,5.6vw,68px)]',
  intro: 'mt-[18px] max-w-[46ch] text-[17px] leading-[1.6] text-onInkSoft sm:text-[18.5px]',
  phone: 'inline-flex w-full items-center justify-center gap-2.5 rounded-[14px] bg-accent px-[22px] py-[14px] font-heading text-[21px] font-bold tracking-[-0.01em] text-accentFg transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.98] sm:w-auto',
  phoneStyle: { boxShadow: '0 10px 24px -8px color-mix(in srgb, var(--accent) 55%, transparent)' },
};

export default function LawnTownHeader({
  content = CONTENT, townSlug, serviceSlug,
}: { content?: SiteContent; townSlug?: string; serviceSlug?: string; data?: unknown }) {
  return <TownHeader content={content} townSlug={townSlug} serviceSlug={serviceSlug} look={LOOK} />;
}
