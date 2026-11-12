'use client';
// ─────────────────────────────────────────────────────────────────────────────
// DetailTownHeader — the header of a town page (/areas/<town>), a town + service page
// (/areas/<town>/<service>) and the /areas index, in DetailServiceHeader / DetailServiceDetail's language (dark first, champagne accent). Xander approved the mockups
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
  id: 'detail-town-header',
  category: 'pageHeader',
  label: 'Car Detailing / Town page header',
  consumes: ['areaPages', 'areaCopy', 'extensions.serviceArea', 'work.projects', 'services.items', 'servicePages', 'brand.address', 'brand.phone', 'brand.phoneHref'],
  sharedDeps: ['@/lib/TownPage', '@/lib/townLinks', '@/lib/serviceLinks', '@/lib/CoverImage', '@/lib/editable', '@phosphor-icons/react'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

/** What the business does, for "{Trade} in {Town}". The console's TRADE_LABELS (town-pages.test.mjs). */
export const TRADE = 'Car Detailing';

const LOOK: TownHeaderLook = {
  trade: TRADE,
  section: 'relative isolate flex items-center overflow-hidden bg-inkPanel text-center text-onInk sm:min-h-[600px]',
  overlays: (
  <div
    className="absolute inset-0"
    aria-hidden="true"
    style={{ background: 'radial-gradient(70% 60% at 50% 50%, color-mix(in srgb, var(--ink-panel) 80%, transparent), color-mix(in srgb, var(--ink-panel) 55%, transparent) 70%, color-mix(in srgb, var(--ink-panel) 90%, transparent) 100%)' }}
  />
  ),
  photoStyle: { filter: 'saturate(.82) contrast(1.06)' },
  inner: 'relative mx-auto w-full max-w-[860px] px-5 pb-12 pt-10 sm:px-6 sm:py-[96px]',
  crumbs: 'flex flex-wrap items-center justify-center gap-2 text-[13px] font-semibold text-onInkSoft',
  h1: 'mt-[22px] font-heading text-[40px] font-extrabold leading-[0.98] tracking-[-0.016em] text-onInk [text-shadow:0_3px_18px_rgba(0,0,0,0.35)] sm:text-[clamp(44px,6vw,74px)]',
  intro: 'mx-auto mt-5 max-w-[52ch] text-[17px] leading-[1.62] text-onInkSoft sm:text-[18.5px]',
  phone: 'inline-flex w-full items-center justify-center gap-[10px] rounded-[8px] bg-accent px-[22px] py-[14px] font-heading text-[20px] font-extrabold tracking-[-0.01em] text-accentFg transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.98] sm:w-auto',
  phoneStyle: { boxShadow: '0 10px 24px -8px color-mix(in srgb, var(--accent) 55%, transparent)' },
};

export default function DetailTownHeader({
  content = CONTENT, townSlug, serviceSlug,
}: { content?: SiteContent; townSlug?: string; serviceSlug?: string; data?: unknown }) {
  return <TownHeader content={content} townSlug={townSlug} serviceSlug={serviceSlug} look={LOOK} />;
}
