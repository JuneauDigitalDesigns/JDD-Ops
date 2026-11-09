import 'server-only';
import { Redis } from '@upstash/redis';
import {
  A2P_STATUSES,
  ORDERS_INDEX_KEY,
  isOrderPaid,
  orderByLeadKey,
  orderKey,
  readinessFor,
  zOperatorOrder,
  type A2pStatus,
  type OperatorOrder,
  type ReadinessLight,
} from '@jdd/schema';
import { loadKvCredentials, loadPortalOpsConfig } from './opsSecrets';
import { loadRegister, loadStore } from './a2pChain';
import { getAccount } from './accountStore';

/**
 * The console's side of "close a client on a sales call".
 *
 * **The console never writes an order, Stripe or Clerk.** Every write goes to the agency's
 * secret-gated `/api/ops/orders/*`, which holds the keys (the console's standing no-Stripe-write
 * rule). What the console may do is READ: the order record lives in the same Upstash instance the
 * console already reads accounts from, so the roster and the wizard's first render read it
 * directly instead of making an HTTP round trip per client.
 *
 * The order's shape, its legal status moves and "which step comes next" are `@jdd/schema`'s, so
 * this file cannot disagree with the agency about any of them.
 */

// ── Agency calls ────────────────────────────────────────────────────────────

export interface AgencyResult {
  status: number;
  body: Record<string, unknown>;
}

/**
 * Call an agency `/api/ops/orders` endpoint. Never throws: a missing secret or an unreachable
 * agency comes back as a status + `{ error }`, so routes can pass it straight through.
 */
export async function agencyOrders(path: string, init: { method?: 'GET' | 'POST'; body?: unknown } = {}): Promise<AgencyResult> {
  const { baseUrl, ordersSecret } = loadPortalOpsConfig();
  if (!ordersSecret) {
    return { status: 500, body: { error: 'No OPS_ORDERS_SECRET in jdd-ops/.env. Set the same value there and in the agency app.' } };
  }
  if (!baseUrl) return { status: 500, body: { error: 'No PORTAL_BASE_URL configured.' } };
  try {
    const res = await fetch(`${baseUrl}/api/ops/orders${path}`, {
      method: init.method ?? 'GET',
      headers: { 'x-ops-secret': ordersSecret, ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}) },
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
      cache: 'no-store',
    });
    const body = (await res.json().catch(() => ({ error: `The agency returned ${res.status}.` }))) as Record<string, unknown>;
    return { status: res.status, body };
  } catch (err) {
    console.error('[salesOrders] agency unreachable', path, err);
    return { status: 502, body: { error: `Couldn't reach the agency app at ${baseUrl}.` } };
  }
}

// ── KV reads ────────────────────────────────────────────────────────────────

let _redis: Redis | null = null;
function getRedis(): Redis | null {
  loadKvCredentials();
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  if (!_redis) _redis = new Redis({ url, token });
  return _redis;
}

export async function readOrder(id: string): Promise<OperatorOrder | null> {
  const redis = getRedis();
  if (!redis) return null;
  const parsed = zOperatorOrder.safeParse(await redis.get<unknown>(orderKey(id)));
  return parsed.success ? parsed.data : null;
}

/** Paid operator orders for one site, newest first. Only a paid agreement is kept for good. */
export async function readPaidOrdersForSite(siteSlug: string): Promise<OperatorOrder[]> {
  const redis = getRedis();
  if (!redis) return [];
  const ids = await redis.zrange<string[]>(ORDERS_INDEX_KEY, 0, -1, { rev: true });
  const orders: OperatorOrder[] = [];
  for (const id of ids) {
    const order = await readOrder(id);
    if (order && order.siteSlug === siteSlug && order.agreementId && isOrderPaid(order.status)) orders.push(order);
  }
  return orders;
}

export async function readOrderByLead(leadId: string): Promise<OperatorOrder | null> {
  const redis = getRedis();
  if (!redis) return null;
  const id = await redis.get<string>(orderByLeadKey(leadId));
  return id ? readOrder(id) : null;
}

// ── A2P status ──────────────────────────────────────────────────────────────

export interface A2pSummary {
  status: A2pStatus | null;
  /** Saved without the business identity (the EIN step): the operator has to finish it. */
  needsEin: boolean;
}

/**
 * Where a client's A2P registration stands, from our own record — never a Twilio call (fresh
 * vendor state is a human's "Refresh", A2P decision 2).
 */
export async function a2pSummary(slug: string): Promise<A2pSummary> {
  try {
    const record = await (await loadStore()).readRegistration({ slug });
    if (!record) return { status: null, needsEin: false };
    const raw = (await loadRegister()).portalStatusFor(record);
    const status = (A2P_STATUSES as readonly string[]).includes(raw) ? (raw as A2pStatus) : null;
    const needsEin =
      record.registrationPath === 'standard' && Boolean(record.profileSid) && !record.businessEndUserSid;
    return { status, needsEin };
  } catch (e) {
    console.error('[salesOrders] could not read the A2P record', slug, e);
    return { status: null, needsEin: false };
  }
}

// ── Readiness ───────────────────────────────────────────────────────────────

/** The four lights for one operator-closed client, from records we already hold. */
export async function readinessForOrder(order: OperatorOrder): Promise<ReadinessLight[]> {
  const [account, a2p] = await Promise.all([
    getAccount(order.client.email).catch(() => null),
    a2pSummary(order.siteSlug),
  ]);
  const site = account?.sites.find((s) => s.slug === order.siteSlug) ?? null;
  return readinessFor({
    order,
    site,
    clientSignedIn: Boolean(account?.clerkUserId),
    plan: order.plan,
    a2pStatus: a2p.status,
    a2pNeedsEin: a2p.needsEin,
  });
}
