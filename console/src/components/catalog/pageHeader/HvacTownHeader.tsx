'use client';
// ─────────────────────────────────────────────────────────────────────────────
// HvacTownHeader — the header of a town page (/areas/<town>), a town + service page
// (/areas/<town>/<service>) and the /areas index, in the approved mockup "HVAC Town Pages" itself. Xander approved the mockups
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
  id: 'hvac-town-header',
  category: 'pageHeader',
  label: 'HVAC / Town page header',
  consumes: ['areaPages', 'areaCopy', 'extensions.serviceArea', 'work.projects', 'services.items', 'servicePages', 'brand.address', 'brand.phone', 'brand.phoneHref'],
  sharedDeps: ['@/lib/TownPage', '@/lib/townLinks', '@/lib/serviceLinks', '@/lib/CoverImage', '@/lib/editable', '@phosphor-icons/react'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

/** What the business does, for "{Trade} in {Town}". The console's TRADE_LABELS (town-pages.test.mjs). */
export const TRADE = 'HVAC';

const LOOK: TownHeaderLook = {
  trade: TRADE,
  section: 'relative isolate overflow-hidden bg-inkPanel text-onInk',
  overlays: (
  <>
    <div className="absolute inset-0 bg-[color:var(--accent-2)] opacity-55 mix-blend-color" aria-hidden="true" />
    <div
      className="absolute inset-0 lg:hidden"
      aria-hidden="true"
      style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--ink-panel) 70%, transparent), color-mix(in srgb, var(--ink-panel) 92%, transparent) 55%)' }}
    />
    <div
      className="absolute inset-0 hidden lg:block"
      aria-hidden="true"
      style={{ background: 'linear-gradient(90deg, color-mix(in srgb, var(--ink-panel) 94%, transparent) 0%, color-mix(in srgb, var(--ink-panel) 78%, transparent) 48%, color-mix(in srgb, var(--ink-panel) 30%, transparent) 100%)' }}
    />
  </>
  ),
  inner: 'relative mx-auto max-w-[1120px] px-5 pb-12 pt-7 sm:px-6 lg:pb-24 lg:pt-14',
  crumbs: 'flex flex-wrap items-center gap-2 text-[13px] font-semibold text-onInkSoft',
  h1: 'mt-4 max-w-[16ch] font-heading text-[40px] font-medium leading-none tracking-[-0.015em] text-onInk [text-shadow:0_3px_18px_rgba(0,0,0,0.35)] sm:text-[clamp(40px,5vw,66px)]',
  intro: 'mt-5 max-w-[50ch] text-[17px] leading-[1.62] text-onInkSoft sm:text-[18px]',
  phone: 'inline-flex w-full items-center justify-center gap-2.5 rounded-[10px] bg-accent px-[22px] py-[14px] font-heading text-[21px] font-semibold tracking-[0.01em] text-accentFg transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-105 sm:w-auto',
  phoneStyle: { boxShadow: '0 10px 24px -8px color-mix(in srgb, var(--accent) 50%, transparent)' },
};

export default function HvacTownHeader({
  content = CONTENT, townSlug, serviceSlug,
}: { content?: SiteContent; townSlug?: string; serviceSlug?: string; data?: unknown }) {
  return <TownHeader content={content} townSlug={townSlug} serviceSlug={serviceSlug} look={LOOK} />;
}
