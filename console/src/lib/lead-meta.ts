// One source for how a LeadStage is named and coloured.
//
// Same shape and same reasoning as status-meta.ts: these maps are imported by the board,
// the card, and the modal, and two copies of a label map is how a stage ends up meaning
// something subtly different in two places.

import type { LeadSource, LeadStage } from './leadTypes';

export const LEAD_LABEL: Record<LeadStage, string> = {
  new: 'New',
  qualified: 'Qualified',
  quoted: 'Quoted',
  won: 'Won',
  lost: 'Lost',
};

export const LEAD_COLOR: Record<LeadStage, string> = {
  new: 'var(--accent)',
  qualified: 'var(--accent)',
  quoted: 'var(--warn)',
  won: 'var(--ok)',
  lost: 'var(--fg-3)',
};

/**
 * How each lead got here. Same one-source-of-truth reasoning as LEAD_LABEL above.
 *
 * The icons stay in the components rather than living here — this module is imported by the
 * board, the card, and the modal, and putting Phosphor components in it would drag JSX into a
 * plain lib file for the sake of two call sites.
 */
export const LEAD_SOURCE_LABEL: Record<LeadSource, string> = {
  form: 'Filled the interest form',
  call: 'Called the demo agent',
  manual: 'Added by hand',
};

/** Short form, for the modal's header line where the badge sits inline with the name. */
export const LEAD_SOURCE_SHORT: Record<LeadSource, string> = {
  form: 'Interest form',
  call: 'Called the demo',
  manual: 'Added by hand',
};

/** The next action implied by each stage — what moves a lead out of the column. */
export const LEAD_NEXT: Record<LeadStage, string> = {
  new: '→ Qualify',
  qualified: '→ Quote',
  quoted: '→ Close',
  won: 'Won',
  lost: '',
};

/**
 * How long a lead may sit untouched before its card starts showing it.
 *
 * Deliberately shorter than the 14-day STALL_DAYS in attention.ts. That number is about
 * delivery, where a fortnight of quiet is merely suspicious; this one is about sales,
 * where a week of silence is usually the whole ballgame.
 */
export const LEAD_STALE_DAYS = 7;
export const LEAD_STALE_MS = LEAD_STALE_DAYS * 24 * 60 * 60 * 1000;

/** Stages where going quiet is a problem. A won or lost lead SHOULD sit still. */
export function stageCanGoStale(stage: LeadStage): boolean {
  return stage === 'new' || stage === 'qualified' || stage === 'quoted';
}

export function isStale(lead: { stage: LeadStage; updatedAt?: number; receivedAt: number }): boolean {
  if (!stageCanGoStale(lead.stage)) return false;
  return Date.now() - (lead.updatedAt ?? lead.receivedAt) > LEAD_STALE_MS;
}

/** localStorage key holding the epoch-ms of the last time the board was viewed. */
export const LEADS_LAST_SEEN_KEY = 'jdd:leads:lastSeenAt';

/**
 * A lead that arrived after the operator last looked at the board.
 *
 * Exists because a lead from a call enters at `qualified`, not `new` — so the one place you
 * would think to look for it is the one place it never appears. Without an arrival marker the
 * only way to spot a new card is to already know which column it lands in.
 *
 * Deliberately keyed off `receivedAt`, not `updatedAt`: this marks ARRIVAL, not activity. A
 * lead you dragged to Quoted yesterday is not news today.
 *
 * A null `lastSeenAt` is a first-ever visit and marks NOTHING, rather than flagging the whole
 * board as new.
 */
export function isUnseen(lead: { receivedAt: number }, lastSeenAt: number | null): boolean {
  return lastSeenAt !== null && lead.receivedAt > lastSeenAt;
}
