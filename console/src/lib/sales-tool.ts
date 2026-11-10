/**
 * The sales tool's words: what the system does, what each plan includes, and the objections a
 * prospect raises with the answer that meets each one.
 *
 * Replaced the branching call script (sales-script.ts) on 2026-11-10. Xander wanted a reference
 * he can glance at mid-call, not a wizard that walks him through one. Pure data + small helpers,
 * client-safe, same split as before: components/leads/SalesTool.tsx owns behaviour, this file owns
 * words.
 *
 * EVERY LINE HERE WAS APPROVED WORD FOR WORD by Xander on 2026-11-10 (the "Sales tool mockup"
 * artifact, copy lines 1 to 108). Don't reword, add or drop a line without a fresh approval. No
 * em-dashes or en-dashes in any of it (house rule for copy); test/sales-tool.test.mjs holds that.
 *
 * Facts come from the agency site and the contract, never from memory:
 *   - prices, setup fees, minutes, overage: Schedule A,
 *     juneau-digital-designs/app/lib/legal/schedules.ts (the 2026-10-12 reprice);
 *   - feature lines: that repo's pricing page (pricingpageclient.tsx) and FAQ (app/data/faq.ts);
 *   - the demo line: that repo's app/data/demo-line.ts.
 * The console can't import the agency repo, so the figures are copied here. When Schedule A moves,
 * this file moves with it. The script this replaced had drifted to the pre-reprice prices
 * (Growth at $297, a thirty day notice period) and was being read out on calls.
 *
 * Deliberately left out (Xander, 2026-11-10): the first-month guarantee (defined in the agency's
 * code but stated in no page or contract text), and the Growth extras Schedule A lists beyond the
 * callback, pipeline and minutes (recordings, AI qualification, urgency extraction), until it is
 * settled which of those really differ from Starter.
 */

import type { PlanInterest } from './leadTypes';

export const TOOL_NAME = 'Sales tool';

export const UI = {
  search: 'Search what they said',
  demo: 'Demo line',
  copy: 'Copy',
  copied: 'Copied',
  none: 'Nothing matches. Try one word, like price or robot.',
  hint: 'Press / to search. Esc closes.',
  say: 'Say',
  answeredBy: 'Answered by',
  addToCalendar: 'Add to calendar',
} as const;

/** The demo receptionist a prospect can ring. Mirrors the agency's app/data/demo-line.ts. */
export const DEMO_LINE = '(930) 222-1343';

export type SalesTab = 'system' | 'plans' | 'objections';
export const TABS: { id: SalesTab; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'plans', label: 'Plans' },
  { id: 'objections', label: 'Objections' },
];

/* ─────────────────────────────  System  ───────────────────────────── */

export type FlowIcon = 'caller' | 'phone' | 'ai' | 'inbox';

/** How a call is handled, in order. The order is real: human first, the AI only on no answer. */
export const FLOW: { icon: FlowIcon; label: string }[] = [
  { icon: 'caller', label: 'A customer calls' },
  { icon: 'phone', label: 'Your phone rings first' },
  { icon: 'ai', label: 'No answer? The AI picks up' },
  { icon: 'inbox', label: 'The lead lands in your portal, and you get a text' },
];

export type KeyPointId = 'k1' | 'k2' | 'k3' | 'k4' | 'k5' | 'k6' | 'k7' | 'k8';

export interface KeyPoint {
  id: KeyPointId;
  title: string;
  line: string;
}

export const KEY_POINT_GROUPS: { label: string; points: KeyPoint[] }[] = [
  {
    label: 'The phone',
    points: [
      { id: 'k1', title: 'It rings you first', line: "If you don't pick up, the AI receptionist answers, 24/7, in English or Spanish." },
      { id: 'k2', title: 'It replaces the voicemail', line: 'The AI never answers before you do.' },
      { id: 'k3', title: 'One inbox for every lead', line: 'Every call and web enquiry lands in your portal, and you get a text the moment a new one arrives.' },
      { id: 'k4', title: "It doesn't make things up", line: "It takes their details, puts the lead in your portal, and texts you that it's there." },
    ],
  },
  {
    label: 'The website',
    points: [
      { id: 'k5', title: 'A custom four-page site', line: 'Home, Services, About and Contact. Hosting, SSL and maintenance included, plus 2 content edits a month.' },
      { id: 'k6', title: 'We write it', line: 'They answer some questions about the business. Most are done in one sitting.' },
    ],
  },
  {
    label: 'Signing up',
    points: [
      { id: 'k7', title: 'Live within a week', line: 'Preview within 72 hours of the onboarding form coming back.' },
      { id: 'k8', title: 'No contract', line: 'Month to month. No minimum term and no cancellation fee.' },
    ],
  },
];

export const KEY_POINTS: KeyPoint[] = KEY_POINT_GROUPS.flatMap((g) => g.points);
export const keyPoint = (id: KeyPointId): KeyPoint => KEY_POINTS.find((k) => k.id === id) as KeyPoint;

/* ─────────────────────────────  Plans  ───────────────────────────── */

export type TierId = PlanInterest;

export interface PlanTier {
  id: TierId;
  name: string;
  line: string;
  /** Schedule A monthly price and annual prepay (ten months of the monthly). */
  monthly: string;
  annual: string;
  setup: string;
}

export const PLAN_UI = {
  monthly: 'Monthly',
  annual: 'Annual',
  monthsFree: '2 months free',
  perMonth: '/mo',
  perYear: '/yr',
  theirPick: 'Their pick',
} as const;

export const TIERS: PlanTier[] = [
  { id: 'starter', name: 'Starter', line: 'Reports every lead', monthly: '$197', annual: '$1,970', setup: '+ $297 setup' },
  { id: 'growth', name: 'Growth', line: 'Works them like a team would', monthly: '$497', annual: '$4,970', setup: '+ $297 setup' },
  { id: 'enterprise', name: 'Enterprise', line: 'For more than one shop', monthly: '$1,097', annual: '$10,970', setup: '+ $697 setup' },
];

/**
 * A cell is a tick, a not-included mark, a plain value, or the carrier-approval tag. Plain values
 * are approved copy like everything else.
 */
export type PlanCell =
  | { kind: 'yes' }
  | { kind: 'no' }
  | { kind: 'text'; text: string }
  | { kind: 'gate'; text: string };

const yes: PlanCell = { kind: 'yes' };
const no: PlanCell = { kind: 'no' };
const text = (t: string): PlanCell => ({ kind: 'text', text: t });
const gate: PlanCell = { kind: 'gate', text: 'After carrier approval' };

export interface PlanRow {
  label: string;
  /** Starter, Growth, Enterprise, in TIERS order. */
  cells: [PlanCell, PlanCell, PlanCell];
}

export const PLAN_ROWS: PlanRow[] = [
  { label: 'Website', cells: [text('1'), text('1'), text('2 to 3')] },
  { label: 'AI receptionist and number', cells: [yes, yes, text('One per site')] },
  { label: 'Leads in the portal, with a text', cells: [yes, yes, yes] },
  { label: 'Web form callback in about a minute', cells: [no, yes, yes] },
  { label: 'Customer pipeline', cells: [no, yes, yes] },
  { label: 'Customer texts and Google reviews', cells: [no, gate, gate] },
  { label: 'AI minutes a month', cells: [text('100'), text('350'), text('1,050 shared')] },
  { label: 'Priority support', cells: [no, no, yes] },
];

export const PLAN_FOOTNOTES = [
  'Extra minutes $0.20 each.',
  'No AI on their line? Website only, same price as Starter.',
] as const;

/* ─────────────────────────────  Objections  ───────────────────────────── */

export type ObjectionCategory = 'ai' | 'cost' | 'site' | 'timing';

export const CATEGORIES: { id: ObjectionCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'ai', label: 'The AI' },
  { id: 'cost', label: 'Cost and terms' },
  { id: 'site', label: 'Website' },
  { id: 'timing', label: 'Timing' },
];

export interface Objection {
  id: string;
  category: ObjectionCategory;
  /** What the prospect says. */
  says: string;
  /** What you say back. */
  answer: string;
  /** A second, quieter line under the answer. */
  followUp?: string;
  /** The key point that backs the answer, shown as an "Answered by" link. */
  answeredBy?: KeyPointId;
  /** Offer the demo line. */
  demo?: boolean;
  /** Offer the missed-calls calculator. */
  calculator?: boolean;
  /** Offer Add to calendar. */
  calendar?: boolean;
  tag?: string;
  /** Extra words a search should find this by. Never shown. */
  keywords: string;
}

export const OBJECTIONS: Objection[] = [
  {
    id: 'robot-answering',
    category: 'ai',
    says: "I don't want a robot answering my phone",
    answer: "The AI never answers before you do. Your phone rings first, and it only steps in if nobody picks up. It's replacing your voicemail, not you.",
    answeredBy: 'k2',
    keywords: 'ai robot machine customers instead of me human',
  },
  {
    id: 'sound-like-robot',
    category: 'ai',
    says: "It'll sound like a robot",
    answer: "Call our demo line and decide for yourself. We'd rather you hear it than take our word for it.",
    demo: true,
    keywords: 'sound robot fake voice demo hear listen',
  },
  {
    id: 'too-expensive',
    category: 'cost',
    says: "That's too expensive",
    answer: "Here's the math though. Even one missed job a week, at a few hundred bucks, is more than the plan costs.",
    followUp: 'Starter is $197 a month and still has the receptionist.',
    calculator: true,
    keywords: 'price expensive cost money afford budget cheap much',
  },
  {
    id: 'locked-in',
    category: 'cost',
    says: "I don't want to be locked in",
    answer: "No minimum term, no commitment period, and no cancellation fee. It's month to month.",
    answeredBy: 'k8',
    keywords: 'contract locked commitment cancel term',
  },
  {
    id: 'have-a-site',
    category: 'site',
    says: 'I already have a website',
    answer: "We build you a new one and bring over the content worth keeping. You won't have to start from scratch.",
    answeredBy: 'k5',
    keywords: 'website site already have',
  },
  {
    id: 'no-time',
    category: 'timing',
    says: "I don't have time for this",
    answer: 'You answer some questions about your business and we write it. Most people are done in one sitting.',
    answeredBy: 'k6',
    keywords: 'time busy write content effort work',
  },
  {
    id: 'cant-answer',
    category: 'ai',
    says: "What if it can't answer something?",
    answer: "It takes their details, puts the lead in your portal, and texts you that it's there. It doesn't guess.",
    answeredBy: 'k4',
    keywords: 'cant answer question wrong mistake make up',
  },
  {
    id: 'change-number',
    category: 'ai',
    says: "I don't want to change my number",
    answer: "You don't have to. Forward your line to the number we give you, or publish ours. Either works.",
    answeredBy: 'k1',
    keywords: 'number change forward forwarding phone line',
  },
  {
    id: 'google',
    category: 'site',
    says: 'Will I show up on Google?',
    answer: "We do the technical side properly: page speed, titles, structured data, sitemaps. We won't promise a ranking. Nobody controls Google's results.",
    keywords: 'google seo ranking search found',
  },
  {
    id: 'someone-answering',
    category: 'ai',
    says: 'I already have someone answering',
    answer: 'This is what catches the calls after they go home.',
    answeredBy: 'k1',
    keywords: 'receptionist staff someone answering office',
  },
  {
    id: 'own-site',
    category: 'cost',
    says: 'Do I own the site?',
    answer: 'Your content is always yours. If you leave, ask within 30 days and we hand over a full export.',
    keywords: 'own ownership leave export',
  },
  {
    id: 'keep-number',
    category: 'cost',
    says: 'Can I keep the number if I leave?',
    answer: 'Yes. Tell us within 30 days and we port it to your carrier for a one-time $50.',
    keywords: 'keep number port leave',
  },
  {
    id: 'busy',
    category: 'timing',
    says: "I'm busy",
    answer: "No problem, I'll be quick or I'll get out of your hair. Is now just bad timing, or should I catch you after five?",
    calendar: true,
    keywords: 'busy not interested later callback',
  },
  {
    id: 'think-about-it',
    category: 'timing',
    says: 'I need to think about it',
    answer: "Call the demo line tonight and hear it for yourself. Then let's talk tomorrow.",
    demo: true,
    keywords: 'think about it later maybe',
  },
  {
    id: 'no-ai',
    category: 'ai',
    says: "I don't want AI on my line at all",
    answer: "We'll build and host the same site at the same price and leave your phone alone.",
    tag: 'Starter only',
    keywords: 'no ai website only without receptionist',
  },
];

/** The objection the tool opens on before anything is chosen: price comes up on most calls. */
export const DEFAULT_OBJECTION = 'too-expensive';

/* ─────────────────────────────  Calculator  ───────────────────────────── */

export const CALC_UI = {
  open: 'Put their number on it',
  calls: 'Missed calls a week',
  job: 'Average job ($)',
  catchPct: '% they catch today',
  lost: 'Lost a year',
  won: 'Won back a year',
  note: 'Same math as the website. Illustrative.',
} as const;

/**
 * The missed-calls calculator's constants.
 *
 * Mirrors juneau-digital-designs/app/components/home/homepageclient.tsx (LEAD_RATE, CLOSE_RATE,
 * AI_RECOVERY_RATE). Keep them in sync: the number read out on a call is the number the prospect
 * can reproduce on the website.
 */
export const CALC = {
  LEAD_RATE: 0.37,
  CLOSE_RATE: 0.46,
  AI_RECOVERY_RATE: 0.5,
} as const;

export function fmtDollars(n: number): string {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2) + 'M';
  if (n >= 1000) return '$' + (n / 1000).toFixed(n >= 100_000 ? 0 : 1) + 'K';
  return '$' + Math.round(n).toLocaleString();
}

/** Yearly revenue lost to missed calls, and the share a receptionist wins back. */
export function calcOutcome(callsPerWeek: number, jobValue: number, catchPct: number) {
  const rec = Math.max(0, Math.min(100, Number.isFinite(catchPct) ? catchPct : 0));
  const annualLeadCalls = callsPerWeek * 52 * CALC.LEAD_RATE;
  const unrecovered = annualLeadCalls * (1 - rec / 100);
  const lost = unrecovered * CALC.CLOSE_RATE * jobValue;
  return { lost, won: lost * CALC.AI_RECOVERY_RATE };
}

/* ─────────────────────────────  Search  ───────────────────────────── */

export interface SearchResults {
  objections: Objection[];
  keyPoints: KeyPoint[];
  planRows: PlanRow[];
}

/** One case-insensitive substring match across all three tabs. Empty query matches nothing. */
export function searchSalesTool(query: string): SearchResults {
  const q = query.trim().toLowerCase();
  if (!q) return { objections: [], keyPoints: [], planRows: [] };
  const has = (s: string) => s.toLowerCase().includes(q);
  return {
    objections: OBJECTIONS.filter((o) => has(`${o.says} ${o.answer} ${o.followUp ?? ''} ${o.keywords}`)),
    keyPoints: KEY_POINTS.filter((k) => has(`${k.title} ${k.line}`)),
    planRows: PLAN_ROWS.filter((r) => has(r.label)),
  };
}

/** Every string this file shows, for the house-rule test (no em-dashes or en-dashes in copy). */
export function allVisibleCopy(): string[] {
  const cells = PLAN_ROWS.flatMap((r) => r.cells.flatMap((c) => (c.kind === 'text' || c.kind === 'gate' ? [c.text] : [])));
  return [
    TOOL_NAME,
    ...Object.values(UI),
    DEMO_LINE,
    ...TABS.map((t) => t.label),
    ...FLOW.map((f) => f.label),
    ...KEY_POINT_GROUPS.flatMap((g) => [g.label, ...g.points.flatMap((p) => [p.title, p.line])]),
    ...Object.values(PLAN_UI),
    ...TIERS.flatMap((t) => [t.name, t.line, t.monthly, t.annual, t.setup]),
    ...PLAN_ROWS.map((r) => r.label),
    ...cells,
    ...PLAN_FOOTNOTES,
    ...CATEGORIES.map((c) => c.label),
    ...OBJECTIONS.flatMap((o) => [o.says, o.answer, o.followUp ?? '', o.tag ?? '']),
    ...Object.values(CALC_UI),
  ].filter(Boolean);
}
