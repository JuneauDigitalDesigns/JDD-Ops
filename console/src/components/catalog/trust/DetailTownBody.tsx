'use client';
// ─────────────────────────────────────────────────────────────────────────────
// DetailTownBody — the body of a town page (/areas/<town>), a town + service page
// (/areas/<town>/<service>) and the /areas index, in DetailServiceHeader / DetailServiceDetail's language (dark first, champagne accent). Xander approved the mockups
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
  id: 'detail-town-body',
  category: 'trust',
  label: 'Car Detailing / Town page body',
  consumes: ['areaPages', 'extensions.serviceArea', 'extensions.townNotes', 'work.projects', 'testimonials.items', 'services.items', 'servicePages', 'brand.address'],
  sharedDeps: ['@/lib/TownPage', '@/lib/townLinks', '@/lib/serviceLinks', '@/lib/CoverImage', '@/lib/editable', '@phosphor-icons/react'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

/** What the business does: the /areas index labels a town page link "{Trade} in {Town}". The same
 *  word as DetailTownHeader's TRADE (town-pages.test.mjs). */
export const TRADE = 'Car Detailing';

const LOOK: TownBodyLook = {
  trade: TRADE,
  cap: <span className="mb-[18px] block h-1 w-11 rounded-full" style={{ background: 'linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 65%, black) 60%, transparent)' }} aria-hidden="true" />,
  h2: 'font-heading text-[30px] font-extrabold leading-[1.04] tracking-[-0.016em] text-ink lg:text-[36px]',
  bands: ['bg-bg', 'bg-bgSoft'],
  card: 'rounded-[12px] border border-[color:color-mix(in_srgb,var(--ink)_9%,transparent)] bg-[color:color-mix(in_srgb,var(--ink)_4%,transparent)]',
  photo: 'rounded-[12px] border border-[color:color-mix(in_srgb,var(--ink)_9%,transparent)] bg-[color:color-mix(in_srgb,var(--ink)_4%,transparent)]',
  muted: 'text-inkSoft',
  link: 'text-accent',
  chip: 'rounded-[8px] border border-[color:color-mix(in_srgb,var(--ink)_9%,transparent)]',
  chipLink: 'rounded-[8px] border border-[color:color-mix(in_srgb,var(--accent)_45%,transparent)] text-ink transition-colors hover:border-accent',
};

export default function DetailTownBody({
  content = CONTENT, townSlug, serviceSlug,
}: { content?: SiteContent; townSlug?: string; serviceSlug?: string }) {
  return <TownBody content={content} townSlug={townSlug} serviceSlug={serviceSlug} look={LOOK} />;
}
