'use client';
// ─────────────────────────────────────────────────────────────────────────────
// HvacTownBody — the body of a town page (/areas/<town>), a town + service page
// (/areas/<town>/<service>) and the /areas index, in the approved mockup "HVAC Town Pages" itself. Xander approved the mockups
// "HVAC Town Pages" on 2026-11-12; the blocks, their order and their wording are lib/TownPage.tsx's:
//   town page:  Our services in {Town} · Recent jobs in {Town} · What our {Town} customers say ·
//               Working in {Town}
//   spoke:      the jobs and reviews tagged to both, then "More of our work in {Town}" and
//               "About our {service} service"
//   /areas:     every town served; the main city links home, a town page is linked, the rest are text
// Each block is hidden when it has no data and carries `data-src` for the local SEO checks. Each
// block has its own `rv` reveal, so this component is in SELF_ANIMATED (revealPolicy.ts).
// ─────────────────────────────────────────────────────────────────────────────
import { CONTENT, type SiteContent } from '@/data/site';
import { TownBody, type TownBodyLook } from '@/lib/TownPage';

export const meta = {
  id: 'hvac-town-body',
  category: 'trust',
  label: 'HVAC / Town page body',
  consumes: ['areaPages', 'extensions.serviceArea', 'extensions.townNotes', 'work.projects', 'testimonials.items', 'services.items', 'servicePages', 'brand.address'],
  sharedDeps: ['@/lib/TownPage', '@/lib/townLinks', '@/lib/serviceLinks', '@/lib/CoverImage', '@/lib/editable', '@phosphor-icons/react'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

/** What the business does: the /areas index labels a town page link "{Trade} in {Town}". The same
 *  word as HvacTownHeader's TRADE (town-pages.test.mjs). */
export const TRADE = 'HVAC';

const LOOK: TownBodyLook = {
  trade: TRADE,
  cap: <span className="accent-bar mb-[18px] !h-1 !w-11" aria-hidden="true" />,
  h2: 'font-heading text-[30px] font-semibold leading-[1.04] text-ink lg:text-[36px]',
  bands: ['bg-bg', 'bg-bgSoft'],
  card: 'shadow-brand-1 rounded-[14px] border border-rule bg-bg',
  photo: 'shadow-brand-2 rounded-[16px] bg-bg',
  muted: 'text-inkSoft',
  link: 'text-[color:var(--accent-2)]',
  chip: 'shadow-brand-1 rounded-[10px] border border-rule bg-bg',
  chipLink: 'shadow-brand-1 rounded-[10px] border border-[color:var(--accent-2)] bg-bg text-[color:var(--accent-2)] transition-colors hover:bg-[color:var(--accent-2-soft)]',
};

export default function HvacTownBody({
  content = CONTENT, townSlug, serviceSlug,
}: { content?: SiteContent; townSlug?: string; serviceSlug?: string }) {
  return <TownBody content={content} townSlug={townSlug} serviceSlug={serviceSlug} look={LOOK} />;
}
