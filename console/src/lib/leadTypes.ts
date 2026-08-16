/**
 * The lead/demo-call wire shapes, and the stage list.
 *
 * Split out of leadQueue.ts deliberately: that file is `server-only` because it holds the
 * Redis client, and LEAD_STAGES is a runtime VALUE the board and modal both need. Importing
 * it from there dragged `server-only` into the client bundle and the whole route 500'd. Types
 * alone would have been fine — they erase — but the array does not.
 *
 * So: shapes and constants here (client-safe), I/O in leadQueue.ts (server-only).
 *
 * This is a deliberate local copy of the producer's shapes in the agency site, NOT an import
 * from @jdd/schema. That package currently has uncommitted v1.6.0 work while its last released
 * tag — and all three consumers' pins — are v1.4.0, so promoting these would mean untangling
 * that first.
 *
 * The copies have deliberately diverged in one place: 'manual' is a console-only LeadSource with
 * no producer counterpart, because only this app can create a lead by hand. Nothing needs to
 * change on the site side — the only lead it ever reads back is via jdd:lead:by-call:{callId},
 * and a manual lead has no callId.
 */

export type LeadStage = 'new' | 'qualified' | 'quoted' | 'won' | 'lost';
export type LeadSource = 'form' | 'call' | 'manual';
export type PlanInterest = 'starter' | 'growth' | 'enterprise';

export const LEAD_STAGES: LeadStage[] = ['new', 'qualified', 'quoted', 'won', 'lost'];

/** One entry in a lead's history. Written by both the agency site and this console. */
export interface LeadActivity {
  at: number;
  kind: string;
  text: string;
}

export interface QueuedLead {
  id: string;
  /** Epoch ms — doubles as the sorted-set score. */
  receivedAt: number;
  source: LeadSource;
  stage: LeadStage;
  /** Fractional sort position within its column; absent = never dragged. */
  order?: number;
  name: string;
  businessName: string;
  phone: string;
  email?: string | null;
  planInterest: PlanInterest | null;
  note?: string;
  trade?: string | null;
  /** → jdd:democall:item:{callId}, for source: 'call'. */
  callId?: string;
  notes?: string;
  activity: LeadActivity[];
  lostReason?: string;
  updatedAt?: number;
  convertedSlug?: string;
}

/**
 * One call to the demo number. EVERY call gets one, including the anonymous ones that never
 * become leads — that's the point of keeping it separate from the funnel.
 */
export interface DemoCall {
  callId: string;
  at: number;
  fromNumber: string | null;
  durationMs: number | null;
  outcome: string | null;
  disconnectionReason: string | null;
  summary: string | null;
  recordingUrl: string | null;
  /** Set when this call also produced a card, so the Calls tab can mark it. */
  leadId?: string;
}
