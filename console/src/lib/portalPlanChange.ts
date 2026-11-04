import 'server-only';
import { loadPortalOpsConfig } from './opsSecrets';
import { accountStoreConfigured, getAccount, getAccountEmailByUserId } from './accountStore';

/**
 * The console's side of a plan change that the agency app carries out.
 *
 * **No Stripe code here, and none may be added.** The console has no authentication and runs on
 * a read-only Stripe key on purpose. Everything that changes what a client pays goes through the
 * agency's ops routes, which are deployed, gated on `OPS_SHARED_SECRET` and hold the write key:
 *
 *   - `/api/ops/plan-change`: a client-requested downgrade. The agency emails the client the
 *     Starter terms to accept; accepting schedules the change in Stripe for the end of the paid
 *     period (contract v5.3 §15.2 and §15.4). The portal record moves when it lands.
 *   - `/api/ops/plan-sync`: make Stripe bill the plan already on the record, now.
 */

export type OpsCall<T> = { ok: true; status: number; body: T } | { ok: false; status: number; error: string };

/** Same loopback guard as stripe-lookup and the billing route: an assumption isn't a control. */
export function isLoopback(req: Request): boolean {
  const host = (req.headers.get('host') ?? '').toLowerCase();
  const hostname = host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : host.split(':')[0];
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1' ||
    hostname.endsWith('.localhost')
  );
}

/** Call an agency ops route with the shared secret. Never throws. */
export async function callPortalOps<T>(
  path: string,
  init: { method: 'GET' | 'POST' | 'DELETE'; body?: unknown },
): Promise<OpsCall<T>> {
  const { baseUrl, secret } = loadPortalOpsConfig();
  if (!secret) {
    return { ok: false, status: 500, error: 'No OPS_SHARED_SECRET in jdd-ops/.env — set the same value there and in the portal app.' };
  }
  if (!baseUrl) return { ok: false, status: 500, error: 'No PORTAL_BASE_URL configured.' };
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method: init.method,
      headers: { 'x-ops-secret': secret, ...(init.body ? { 'content-type': 'application/json' } : {}) },
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
    });
    const body = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) return { ok: false, status: res.status, error: body.error ?? `Portal app answered ${res.status}.` };
    return { ok: true, status: res.status, body };
  } catch (err) {
    console.error('[portalPlanChange] call failed', path, err);
    return { ok: false, status: 502, error: `Couldn't reach the portal app at ${baseUrl}.` };
  }
}

/** The portal account email for a client site, through the CLERK_USER_ID index. */
export async function portalEmailFor(clerkUserId: string | undefined): Promise<string | null> {
  if (!clerkUserId || !accountStoreConfigured()) return null;
  try {
    return await getAccountEmailByUserId(clerkUserId);
  } catch {
    return null;
  }
}

/** The plan on the portal record for a site, or null when there is no portal account for it. */
export async function portalPlanOf(clerkUserId: string | undefined, siteSlug: string): Promise<string | null> {
  const email = await portalEmailFor(clerkUserId);
  if (!email) return null;
  const account = await getAccount(email);
  return account?.sites.find((s) => s.slug === siteSlug)?.plan ?? null;
}

export interface PlanChangeStatus {
  ok?: boolean;
  recordPlan?: string;
  planChange?: {
    status: 'awaiting-acceptance' | 'scheduled' | 'done' | 'cancelled';
    fromPlan: string;
    toPlan: string;
    effectiveAt: number;
    interval: 'month' | 'year';
  } | null;
  error?: string;
}
