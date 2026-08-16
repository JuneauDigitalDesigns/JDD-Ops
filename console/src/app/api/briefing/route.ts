import { NextResponse } from 'next/server';
import { severityRank, type Finding, type ReconcileResult, type Severity } from '@jdd/schema';
import { listClientContexts } from '@/lib/clients';
import { reconcileStoreConfigured, getReconcileResults } from '@/lib/reconcileStore';
import { clientRecordsConfigured, listClientRecords } from '@/lib/clientRecord';
import { leadQueueConfigured, listLeads, listDemoCalls } from '@/lib/leadQueue';
import type { SiteMoney } from '@/lib/reconcile';
import { loadStripeKey } from '@/lib/opsSecrets';

/**
 * The briefing: everything worth knowing across the whole roster, in one read.
 *
 * READ-ONLY, and cheap on purpose. It reads cached sweep results, client records and the
 * lead queue — no vendor APIs at all. This is the console's front door, so it has to open
 * instantly and cost nothing; a front door that spends six vendor calls per client would
 * make starting work expensive in a way nothing on screen would explain.
 *
 * The consequence is that everything here is as fresh as the last sweep, and the payload
 * says so per client. `staleSlugs` names the ones never swept, because a roster showing
 * zero problems is ambiguous otherwise — it could mean "all healthy" or "never looked".
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** A finding plus which client it belongs to, for a cross-roster list. */
export interface BriefingFinding extends Finding {
  slug: string;
  brandName: string;
}

export interface BriefingPayload {
  /** Red and amber across every client, worst first. Grey and unknown are counted, not listed. */
  issues: BriefingFinding[];
  counts: Record<Severity, number>;
  money: {
    mrrCents: number;
    /** Subscriptions renewing in the next 14 days. */
    renewingSoon: { slug: string; brandName: string; at: number; amountCents: number | null }[];
    failing: { slug: string; brandName: string; status: string }[];
    overageBilledCents: number;
  };
  funnel: {
    leadsTotal: number;
    leadsNew: number;
    demoCalls7d: number;
    wonAllTime: number;
    /** call → lead conversion, as a percentage of demo calls that produced a lead. */
    callToLeadPct: number | null;
  };
  stages: Record<string, number>;
  clientCount: number;
  /** Clients with no cached sweep — their state is unknown, not healthy. */
  staleSlugs: string[];
  checkedAt: number | null;
  /**
   * Which Stripe every money figure above came from. Surfaced because a test-mode MRR is
   * indistinguishable from revenue once it's rendered as a dollar amount.
   */
  stripeMode: 'test' | 'live' | 'unknown' | null;
}

const RENEW_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const DEMO_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET() {
  const clients = await listClientContexts({ includeFixtures: false }).catch(() => []);
  const byslug = new Map(clients.map((c) => [c.slug, c.brandName]));

  const results: Record<string, ReconcileResult> = reconcileStoreConfigured()
    ? await getReconcileResults(clients.map((c) => c.slug)).catch(() => ({}))
    : {};

  const issues: BriefingFinding[] = [];
  const counts: Record<Severity, number> = { red: 0, amber: 0, grey: 0, unknown: 0 };
  const money: BriefingPayload['money'] = {
    mrrCents: 0,
    renewingSoon: [],
    failing: [],
    overageBilledCents: 0,
  };
  const staleSlugs: string[] = [];
  let newestCheck: number | null = null;

  for (const ctx of clients) {
    const result = results[ctx.slug];
    if (!result) {
      staleSlugs.push(ctx.slug);
      continue;
    }
    newestCheck = Math.max(newestCheck ?? 0, result.checkedAt);

    for (const f of result.findings) {
      counts[f.severity]++;
      // Only red and amber are listed. Grey is by definition not worth acting on today,
      // and a roster-wide list of unknowns would be dominated by whichever credential is
      // missing — useful as a count, useless as rows.
      if (f.severity === 'red' || f.severity === 'amber') {
        issues.push({ ...f, slug: ctx.slug, brandName: ctx.brandName });
      }
    }

    for (const m of ((result as { money?: SiteMoney[] }).money ?? []) as SiteMoney[]) {
      if (m.amountCents) money.mrrCents += m.amountCents;
      if (m.status && m.status !== 'active') {
        money.failing.push({ slug: ctx.slug, brandName: ctx.brandName, status: m.status });
      }
      if (m.currentPeriodEnd && m.currentPeriodEnd - Date.now() < RENEW_WINDOW_MS) {
        money.renewingSoon.push({
          slug: ctx.slug,
          brandName: ctx.brandName,
          at: m.currentPeriodEnd,
          amountCents: m.amountCents,
        });
      }
    }
  }

  issues.sort(
    (a, b) => severityRank(a.severity) - severityRank(b.severity) || a.brandName.localeCompare(b.brandName),
  );
  money.renewingSoon.sort((a, b) => a.at - b.at);

  // ── Stages + overage history, from the client records ────────────────────
  const stages: Record<string, number> = {};
  if (clientRecordsConfigured()) {
    for (const rec of await listClientRecords().catch(() => [])) {
      stages[rec.stage] = (stages[rec.stage] ?? 0) + 1;
      for (const o of rec.ledger?.overages ?? []) money.overageBilledCents += o.billedCents;
    }
  }

  // ── Funnel ───────────────────────────────────────────────────────────────
  const funnel: BriefingPayload['funnel'] = {
    leadsTotal: 0,
    leadsNew: 0,
    demoCalls7d: 0,
    wonAllTime: 0,
    callToLeadPct: null,
  };

  if (leadQueueConfigured()) {
    const [leads, calls] = await Promise.all([
      listLeads().catch(() => []),
      listDemoCalls(200).catch(() => []),
    ]);
    funnel.leadsTotal = leads.length;
    funnel.leadsNew = leads.filter((l) => l.stage === 'new').length;
    funnel.wonAllTime = leads.filter((l) => l.stage === 'won').length;

    const since = Date.now() - DEMO_WINDOW_MS;
    const recent = calls.filter((c) => c.at >= since);
    funnel.demoCalls7d = recent.length;

    // Of the calls in the window, how many produced a lead card. Null rather than 0 when
    // there were no calls — "0% of nothing" reads as a collapse in conversion.
    funnel.callToLeadPct = recent.length
      ? Math.round((recent.filter((c) => c.leadId).length / recent.length) * 100)
      : null;
  }

  const payload: BriefingPayload = {
    issues,
    counts,
    money,
    funnel,
    stages,
    clientCount: clients.length,
    staleSlugs,
    checkedAt: newestCheck,
    stripeMode: loadStripeKey().mode,
  };

  return NextResponse.json(payload);
}
