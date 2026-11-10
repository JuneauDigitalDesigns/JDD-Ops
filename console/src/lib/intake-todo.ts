/**
 * The intake's "Still to do" list: everything the onboarding form, the close and the console
 * left empty or on a preset placeholder, grouped by the step that fixes it. The same list
 * drives the step rail's counts, so a badge and the summary can never disagree.
 *
 * Only `optional: false` items count toward a badge. Optional items (notable clients, profiles,
 * a service's areas…) are listed, so nothing is forgotten, but never nag.
 *
 * Which services earn their own page is NOT decided here: it is @jdd/schema's
 * qualifiesForServicePage / servicePageFacts (client-seo's gate, service-page-spec.md §1), the
 * same function the export and the onboarding form use.
 */
import type { ServiceFact } from '@jdd/schema';
import { getPath } from '@/lib/merge';
import type { SiteContent } from '@/data/site';
import { sourceOf, isSupplied, hasValue, type FactSource, type SourceContext } from './intake-sources';

/**
 * The service-page gate, passed in rather than imported: it is @jdd/schema's, and the package's
 * ESM-only exports can't be loaded from console .ts under the node test runner (the same
 * ERR_PACKAGE_PATH_NOT_EXPORTED d5-degradation.test.mjs documents). The UI passes
 * lib/service-gate.ts's SERVICE_GATE; the tests import the same functions from the package.
 */
export interface ServiceGate {
  servicePageFacts: (content: unknown, index: number) => { count: number; core: boolean; have: ServiceFact[]; missing: ServiceFact[] };
  qualifiesForServicePage: (content: unknown, index: number) => boolean;
  FACTS_MIN: number;
  INCLUDED_MIN: number;
  TYPICAL_JOBS_MIN: number;
}

export type TodoStep = 'business' | 'services' | 'area' | 'reviews' | 'words' | 'review';

export interface TodoItem {
  step: TodoStep;
  /** Stable key for React and for tests. */
  key: string;
  label: string;
  detail: string;
  /** The chip: a FactSource for a field, or a status for the rest. */
  status: FactSource | 'short' | 'page' | 'none' | 'unsourced' | 'unreviewed';
  optional: boolean;
  /** Where Go lands: a field path to focus, or a service to open. */
  path?: string;
  serviceIndex?: number;
}

export interface BusinessField {
  path: string;
  label: string;
  hint: string;
  optional?: boolean;
  list?: boolean;
}

/** The Business step's three cards, in order. The ONE list of business facts: the step renders
 *  exactly these and Still to do checks exactly these. */
export const BUSINESS_GROUPS: ReadonlyArray<{ id: string; title: string; fields: BusinessField[] }> = [
  {
    id: 'identity', title: 'Identity', fields: [
      { path: 'brand.name', label: 'Business name', hint: 'As customers know it' },
      { path: 'brand.long', label: 'Legal name', hint: 'Full registered name', optional: true },
      { path: 'brand.tagline', label: 'Tagline', hint: "The client's own line", optional: true },
      { path: 'brand.established', label: 'Established', hint: 'Year the business started' },
      { path: 'extensions.ownerName', label: 'Owner', hint: 'Named on the About page' },
    ],
  },
  {
    id: 'contact', title: 'Contact & hours', fields: [
      { path: 'brand.phone', label: 'Phone', hint: "The owner's line; the site shows the JDD number" },
      { path: 'brand.email', label: 'Email', hint: 'Where enquiries go' },
      { path: 'brand.address', label: 'Address', hint: 'Street, city, state, ZIP' },
      { path: 'brand.license', label: 'License', hint: 'License number' },
      { path: 'extensions.hours.all', label: 'Hours', hint: 'Opening hours' },
      { path: 'extensions.responseTime', label: 'Response time', hint: "The client's own words" },
    ],
  },
  {
    id: 'proof', title: 'Proof', fields: [
      { path: 'extensions.trustBadges', label: 'Certifications', hint: 'Certifications held', list: true },
      { path: 'extensions.brandsCarried', label: 'Brands carried', hint: 'Equipment brands installed or serviced', list: true },
      { path: 'trust.logos', label: 'Trust strip', hint: 'Notable clients and brands named in the trust strip; hidden while empty', list: true, optional: true },
    ],
  },
];

const FACT_LABEL: Record<ServiceFact, string> = {
  included: "what's included",
  typicalJobs: 'typical jobs',
  priceFrom: 'starting price',
  brands: 'brands',
  areas: 'areas',
  review: 'a review',
  photo: 'a job photo',
  question: 'a customer question',
};

/** How many more facts a service needs for its own page, by the gate's own rule: a core fact
 *  (included 3+ or typical jobs 2+) plus FACTS_MIN in all. */
export function factsShort(gate: ServiceGate, content: SiteContent, index: number): number {
  const f = gate.servicePageFacts(content, index);
  if (f.core) return Math.max(0, gate.FACTS_MIN - f.count);
  return 1 + Math.max(0, gate.FACTS_MIN - 1 - f.count);
}

/** The hint for one service, in neutral labels. */
export function servicePageHint(
  gate: ServiceGate, content: SiteContent, index: number,
): { page: boolean; short: number; text: string } {
  const page = gate.qualifiesForServicePage(content, index);
  if (page) return { page, short: 0, text: 'Own page' };
  const short = factsShort(gate, content, index);
  const f = gate.servicePageFacts(content, index);
  const core = f.core ? '' : ` Needs ${gate.INCLUDED_MIN}+ included items or ${gate.TYPICAL_JOBS_MIN}+ typical jobs.`;
  return { page, short, text: `Section only, ${short} fact${short === 1 ? '' : 's'} short.${core}` };
}

/** Real reviews with their ORIGINAL index (a blank slot ahead of one must not shift it). */
export const realReviews = (c: SiteContent) =>
  (c.testimonials?.items ?? []).map((t, i) => ({ t, i })).filter(({ t }) => hasValue(t?.q));

export function intakeTodo(gate: ServiceGate, ctx: SourceContext & { unreviewed?: string[] }): TodoItem[] {
  const servicePageFacts = gate.servicePageFacts;
  const c = ctx.effective;
  const out: TodoItem[] = [];

  // ── Business ──
  for (const g of BUSINESS_GROUPS) {
    for (const f of g.fields) {
      const src = sourceOf(ctx, f.path);
      if (isSupplied(src)) continue;
      out.push({
        step: 'business', key: f.path, label: f.label,
        detail: src === 'preset' ? `Showing the preset's "${String(getPath(c, f.path))}"` : f.hint,
        status: src, optional: Boolean(f.optional), path: f.path,
      });
    }
  }

  // ── Services ──
  const items = c.services?.items ?? [];
  if (items.length === 0) {
    out.push({ step: 'services', key: 'services', label: 'Services', detail: 'No services listed', status: 'none', optional: false, path: 'services.items' });
  }
  items.forEach((it, i) => {
    const name = it?.t?.trim() || `Service ${i + 1}`;
    const facts = servicePageFacts(c, i);
    const hint = servicePageHint(gate, c, i);
    const noAreas = !(it?.areas ?? []).some(hasValue);
    if (!hint.page) {
      out.push({
        step: 'services', key: `service.${i}`, label: name,
        detail: hint.text, status: 'short', optional: false, serviceIndex: i,
      });
      return;
    }
    // Own page. Anything still missing is optional; areas say what they add.
    const extras = facts.missing
      .filter((m) => m === 'included' || m === 'typicalJobs' || m === 'question' || m === 'photo')
      .map((m) => FACT_LABEL[m]);
    const parts = [...extras];
    if (noAreas) parts.push('areas (adds an areas block on its page)');
    if (parts.length) {
      out.push({
        step: 'services', key: `service.${i}`, label: name,
        detail: `Own page. Not given: ${parts.join(', ')}.`,
        status: 'page', optional: true, serviceIndex: i,
      });
    }
  });

  // ── Area & profiles ──
  const ext = c.extensions ?? ({} as SiteContent['extensions']);
  const areaSrc = sourceOf(ctx, 'extensions.serviceArea');
  if (!isSupplied(areaSrc)) {
    out.push({ step: 'area', key: 'extensions.serviceArea', label: 'Service area', detail: 'Towns the business serves', status: areaSrc, optional: false, path: 'extensions.serviceArea' });
  }
  if (typeof ext.serviceAreaBusiness !== 'boolean') {
    out.push({ step: 'area', key: 'extensions.serviceAreaBusiness', label: 'Street address on the site', detail: 'Shown, or hidden for a service-area business', status: sourceOf(ctx, 'extensions.serviceAreaBusiness'), optional: false, path: 'extensions.serviceAreaBusiness' });
  }
  if (!(ext.profiles ?? []).some((p) => hasValue(p?.url))) {
    out.push({ step: 'area', key: 'extensions.profiles', label: 'Profiles', detail: 'Google, Facebook, Yelp… only if they exist', status: sourceOf(ctx, 'extensions.profiles'), optional: true, path: 'extensions.profiles' });
  }

  // ── Reviews ──
  const reviews = realReviews(c);
  if (reviews.length === 0) {
    out.push({ step: 'reviews', key: 'reviews.none', label: 'No reviews saved', detail: 'Reviews section hidden in the Studio and on the site', status: 'none', optional: false });
  }
  // The rating on record. A preset's figures are an invented rating on a real business's site,
  // so a preset value is required to fix; an empty one is optional (the slot hides).
  const ratingSrc = sourceOf(ctx, 'extensions.reviewBadge');
  if (!isSupplied(ratingSrc)) {
    const b = ext.reviewBadge;
    out.push({
      step: 'reviews', key: 'extensions.reviewBadge', label: 'Rating on record',
      detail: ratingSrc === 'preset' && b ? `Showing the preset's ${b.rating} from ${b.count}` : 'Star rating and review count from the Google profile',
      status: ratingSrc, optional: ratingSrc !== 'preset', path: 'extensions.reviewBadge',
    });
  }
  const unsourced = reviews.filter(({ t }) => !t.source).length;
  if (unsourced > 0) {
    out.push({ step: 'reviews', key: 'reviews.unsourced', label: `${unsourced} review${unsourced === 1 ? '' : 's'} without a source`, detail: 'Shown on the site; source not recorded', status: 'unsourced', optional: false });
  }

  // ── Their words ──
  if (!(ext.customerQuestions ?? []).some((q) => hasValue(q?.q))) {
    out.push({ step: 'words', key: 'extensions.customerQuestions', label: 'Customer questions', detail: 'Questions customers really ask; used first in the FAQ', status: sourceOf(ctx, 'extensions.customerQuestions'), optional: true, path: 'extensions.customerQuestions' });
  }

  // ── Copy review ──
  for (const label of ctx.unreviewed ?? []) {
    out.push({ step: 'review', key: `review.${label}`, label, detail: 'Generated, not yet accepted', status: 'unreviewed', optional: false });
  }

  return out;
}

/** Badge counts per step: required items only. */
export function attentionByStep(items: TodoItem[]): Record<TodoStep, number> {
  const out: Record<TodoStep, number> = { business: 0, services: 0, area: 0, reviews: 0, words: 0, review: 0 };
  for (const it of items) if (!it.optional) out[it.step] += 1;
  return out;
}
