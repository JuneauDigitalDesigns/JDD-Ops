import { NextResponse } from 'next/server';
import { severityRank, type Finding, type ReconcileResult, type Severity } from '@jdd/schema';
import { listClientContexts } from '@/lib/clients';
import { reconcileStoreConfigured, getReconcileResults } from '@/lib/reconcileStore';
import { clientRecordsConfigured, listClientRecords } from '@/lib/clientRecord';
import { leadQueueConfigured, listLeads, listDemoCalls } from '@/lib/leadQueue';
import type { SiteMoney } from '@/lib/reconcile';
import { loadStripeKey } from '@/lib/opsSecrets';
import { accountStoreConfigured, getAccount } from '@/lib/accountStore';
import { fixturesIncludedByDefault } from '@/lib/fixtures';
import Stripe from 'stripe';

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
    /**
     * Sum of subscriptions the console could tie to a client. Kept under its honest name —
     * it used to be called `mrrCents`, which is what made a $594 attribution read as
     * $594 of total revenue when Stripe held $17,478.
     */
    attributedMrrCents: number;
    /** Subscriptions renewing in the next 14 days. */
    renewingSoon: { slug: string; brandName: string; at: number; amountCents: number | null }[];
    failing: { slug: string; brandName: string; status: string }[];
    overageBilledCents: number;
  };
  /** Straight from Stripe: the real total, and how much of it is unaccounted for. */
  stripe: StripeFacts;
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
  /**
   * Client records in KV whose folder isn't on this machine — provisioned elsewhere, or
   * torn down and left behind. They used to be silently folded into `stages`, which is why
   * the stage totals didn't match `clientCount`.
   */
  recordsWithoutFolder: string[];
  /**
   * Clients on disk with no record, so no derived stage. With the field above this closes
   * the accounting: clientCount === sum(stages) + foldersWithoutRecord.length.
   */
  foldersWithoutRecord: string[];
  checkedAt: number | null;
  /** Whether this payload's population includes `_`-prefixed fixtures. */
  includingFixtures: boolean;
}

const RENEW_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const DEMO_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Stop paginating eventually; 500 active subscriptions is far past this roster's scale. */
const MAX_SUB_PAGES = 5;

export interface StripeFacts {
  /** Every active subscription. This is the number that matches the Stripe dashboard. */
  totalMrrCents: number;
  /** The subset tied to a client the console knows about. */
  attributedMrrCents: number;
  unattributedCents: number;
  unattributedCount: number;
  activeCount: number;
  /** True when there were more pages than we were willing to fetch. */
  truncated: boolean;
  mode: 'test' | 'live' | 'unknown' | null;
  error: string | null;
}

/**
 * Total MRR, and how much of it the console can actually account for.
 *
 * ONE Stripe call regardless of how many clients exist — O(1), not O(n) — which is what
 * keeps this affordable on the front door. Everything else the briefing reads is cached.
 *
 * The split is the point. Summing only subscriptions attached to a client site record
 * reported $0 while Stripe held $17,478 across 54 active subscriptions, because almost no
 * site record carries a `stripeSubscriptionId`. A figure labelled "MRR" that silently omits
 * most of the revenue is worse than no figure — and the omitted part is the interesting
 * part: in production, revenue attributable to nobody means people paying with nothing
 * provisioned.
 */
async function loadStripeFacts(subscribed: Map<string, string>): Promise<StripeFacts> {
  const empty: StripeFacts = {
    totalMrrCents: 0,
    attributedMrrCents: 0,
    unattributedCents: 0,
    unattributedCount: 0,
    activeCount: 0,
    truncated: false,
    mode: null,
    error: null,
  };

  const { key, mode } = loadStripeKey();
  if (!key) return { ...empty, mode, error: 'No Stripe key in jdd-ops/.env.' };

  const stripe = new Stripe(key, { apiVersion: '2025-10-29.clover' as Stripe.LatestApiVersion });

  let totalMrrCents = 0;
  let attributedMrrCents = 0;
  let unattributedCents = 0;
  let unattributedCount = 0;
  let activeCount = 0;
  let startingAfter: string | undefined;
  let truncated = false;

  try {
    for (let page = 0; page < MAX_SUB_PAGES; page++) {
      const res = await stripe.subscriptions.list({
        status: 'active',
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });

      for (const sub of res.data) {
        const amount = sub.items?.data?.[0]?.price?.unit_amount ?? 0;
        activeCount++;
        totalMrrCents += amount;
        if (subscribed.has(sub.id)) {
          attributedMrrCents += amount;
        } else {
          unattributedCents += amount;
          unattributedCount++;
        }
      }

      if (!res.has_more) return {
        totalMrrCents, attributedMrrCents, unattributedCents, unattributedCount,
        activeCount, truncated: false, mode, error: null,
      };
      startingAfter = res.data[res.data.length - 1]?.id;
      if (!startingAfter) break;
      truncated = true; // provisional: cleared on the loop that sees has_more === false
    }
  } catch (err) {
    // A partial total is worse than an admitted failure — it would read as a real number.
    return { ...empty, mode, error: err instanceof Error ? err.message : String(err) };
  }

  return {
    totalMrrCents, attributedMrrCents, unattributedCents, unattributedCount,
    activeCount, truncated, mode, error: null,
  };
}

export async function GET() {
  /**
   * ONE client list, resolved once, and everything below derives from it.
   *
   * The payload used to mix three populations: `clientCount` counted non-fixture disk
   * folders, `stages` counted every record in KV (including ones with no folder), and
   * `issues`/`money` covered the disk clients. One screen, three denominators, and no way
   * to tell which question any number was answering.
   */
  const includingFixtures = fixturesIncludedByDefault();
  const clients = await listClientContexts({ includeFixtures: includingFixtures }).catch(() => []);
  const knownSlugs = new Set(clients.map((c) => c.slug));

  const results: Record<string, ReconcileResult> = reconcileStoreConfigured()
    ? await getReconcileResults(clients.map((c) => c.slug)).catch(() => ({}))
    : {};

  const issues: BriefingFinding[] = [];
  const counts: Record<Severity, number> = { red: 0, amber: 0, grey: 0, unknown: 0 };
  const money: BriefingPayload['money'] = {
    attributedMrrCents: 0,
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
      if (m.amountCents) money.attributedMrrCents += m.amountCents;
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
  //
  // Scoped to the SAME client list as everything else. Counting every record in KV made the
  // stage totals disagree with clientCount, and the extra ones weren't noise — they are
  // records whose folder isn't on this machine, which is its own situation and now gets
  // named instead of quietly inflating a total.
  const stages: Record<string, number> = {};
  const recordsWithoutFolder: string[] = [];
  const withRecord = new Set<string>();
  const subscribedSlugs = new Map<string, string>(); // subscriptionId → slug
  if (clientRecordsConfigured()) {
    for (const rec of await listClientRecords().catch(() => [])) {
      if (!rec.slug || !knownSlugs.has(rec.slug)) {
        if (rec.slug) recordsWithoutFolder.push(rec.slug);
        continue;
      }
      withRecord.add(rec.slug);
      stages[rec.stage] = (stages[rec.stage] ?? 0) + 1;
      for (const o of rec.ledger?.overages ?? []) money.overageBilledCents += o.billedCents;
    }
  }

  /**
   * Clients on disk with no record, so no derived stage.
   *
   * The counterpart to `recordsWithoutFolder`, and together they close the accounting:
   *
   *   clientCount === (sum of stages) + foldersWithoutRecord.length
   *
   * Without this the totals silently didn't add up — 6 clients, 4 stages, nothing stale —
   * and the two missing ones were invisible rather than merely uncounted. In practice they
   * are clients with no portal account, which `npm run link-portal` fixes.
   */
  const foldersWithoutRecord = clients
    .map((c) => c.slug)
    .filter((slug) => !withRecord.has(slug));

  // Every subscription id the console can tie to a client, for the attribution split below.
  // Sourced from the portal account records rather than the sweep cache, so a client that
  // has never been swept still counts as attributed.
  if (accountStoreConfigured()) {
    for (const ctx of clients) {
      const email = ctx.sites[0]?.env.PORTAL_ACCOUNT_EMAIL ?? null;
      const account = email ? await getAccount(email).catch(() => null) : null;
      for (const s of account?.sites ?? []) {
        if (s.stripeSubscriptionId && knownSlugs.has(ctx.slug)) {
          subscribedSlugs.set(s.stripeSubscriptionId, ctx.slug);
        }
      }
    }
  }

  const stripeFacts = await loadStripeFacts(subscribedSlugs);

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
    recordsWithoutFolder,
    foldersWithoutRecord,
    checkedAt: newestCheck,
    includingFixtures,
    stripe: stripeFacts,
  };

  return NextResponse.json(payload);
}
