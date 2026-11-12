/**
 * Copy risks, shaped for the intake's Still to do step (SEO plan D2, Xander 2026-11-10:
 * "Warn loudly at the end of the intake wizard before we move onto the build wizard").
 *
 * The detector is client-seo's lib/copyRisks.ts. This only groups its findings (claims by claim,
 * preset copy by section) and says where each one is fixed. It never blocks: Approve stays
 * available, and the export never refuses on these alone.
 */
import type { CopyRisks } from './copyRisks';

export interface RiskTarget {
  /** Intake step that fixes it. */
  step: 'services' | 'review';
  serviceIndex?: number;
  /** For the Review step: the section, and the page route for a subpage header. */
  section?: string;
  route?: string;
}

export interface RiskRow { path: string; text: string; target: RiskTarget }
export interface RiskGroup { key: string; label: string; rows: RiskRow[] }

/** Where a copy path is fixed. Service copy (a card line, a detail) is the copywriter's output
 *  from that service's facts, so it opens the service; everything else opens its section in
 *  Review, where the copy is edited in place. */
export function riskTarget(path: string): RiskTarget {
  const seg = path.split('.');
  if (seg[0] === 'services' && seg[1] === 'items' && /^\d+$/.test(seg[2] ?? '')) {
    return { step: 'services', serviceIndex: Number(seg[2]) };
  }
  if (seg[0] === 'subpages' && seg[1]) return { step: 'review', section: 'subpages', route: seg[1] };
  return { step: 'review', section: seg[0] };
}

const SECTION_LABEL: Record<string, string> = {
  announcement: 'Announcement', trust: 'Trust', hero: 'Hero', about: 'About', services: 'Services',
  work: 'Work', testimonials: 'Reviews', faq: 'FAQ', finalCta: 'Final CTA', footer: 'Footer', subpages: 'Page headers',
  // copyRisks scans seo.title / seo.description since 2026-11-11.
  seo: 'SEO',
};

/** Claims, one group per claim, biggest first. */
export function claimGroups(risks: CopyRisks): RiskGroup[] {
  const by = new Map<string, RiskRow[]>();
  for (const r of risks.unsupportedClaims) {
    const rows = by.get(r.claim) ?? [];
    rows.push({ path: r.path, text: r.text, target: riskTarget(r.path) });
    by.set(r.claim, rows);
  }
  return [...by.entries()]
    .map(([key, rows]) => ({ key, label: key, rows }))
    .sort((a, b) => b.rows.length - a.rows.length || a.key.localeCompare(b.key));
}

/** Preset sample copy, one group per section, in page order. */
export function presetGroups(risks: CopyRisks): RiskGroup[] {
  const order = Object.keys(SECTION_LABEL);
  const by = new Map<string, RiskRow[]>();
  for (const r of risks.presetCopy) {
    const root = r.path.split('.')[0];
    const rows = by.get(root) ?? [];
    rows.push({ path: r.path, text: r.text, target: riskTarget(r.path) });
    by.set(root, rows);
  }
  return [...by.entries()]
    .map(([key, rows]) => ({ key, label: SECTION_LABEL[key] ?? key, rows }))
    .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
}

/** A path as a short readable location: "hero · headline", "FAQ 2 · answer". */
export function pathLabel(path: string): string {
  const seg = path.split('.');
  const root = SECTION_LABEL[seg[0]] ?? seg[0];
  const rest = seg.slice(1).filter((s) => s !== 'items').map((s) => (/^\d+$/.test(s) ? String(Number(s) + 1) : s));
  return [root, rest.join(' ')].filter(Boolean).join(' · ');
}
