import { NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Stripe from 'stripe';
import { sanitizeProjectName } from '@jdd/schema';
import { listClientContexts } from '@/lib/clients';
import { clientRecordsConfigured, listClientRecords } from '@/lib/clientRecord';
import { loadVercelSync } from '@/lib/vercelSync';
import {
  loadVercelCredentials,
  loadRetellApiKey,
  loadStripeKey,
  loadTeardownCredentials,
} from '@/lib/opsSecrets';

/**
 * Vendor resources with no client behind them.
 *
 * The console's entire model is disk-outwards: it enumerates `clients/` and asks each
 * vendor about the things that folder claims. Nothing has ever asked the opposite question —
 * what does each vendor have that no client accounts for — so a Vercel project, a Retell
 * agent or a Twilio number left behind by a cancelled client, a failed provision or a
 * test run is invisible AND still billing.
 *
 * ── Everything here is a CANDIDATE, never a verdict ─────────────────────────
 *
 * "No client folder claims this" is not the same as "this is safe to delete". The console
 * only sees the clients on THIS machine; a resource belonging to a client provisioned
 * elsewhere would look identical to real rubbish. So the response is a list to review with
 * the reason it's suspected, and there is deliberately no delete action — teardown for a
 * real client is unscripted on purpose, and this must not become a back door to it.
 *
 * Expensive by nature: it lists entire vendor accounts. Explicitly requested, never swept.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface Orphan {
  vendor: 'vercel' | 'retell' | 'twilio' | 'stripe';
  id: string;
  label: string;
  /** Why it looks orphaned, in words — the operator decides, not this route. */
  note: string;
  /** Rough monthly cost where it's knowable, in cents. */
  costCents?: number;
}

export interface OrphansPayload {
  orphans: Orphan[];
  /** Vendors that couldn't be listed. Their orphans are unknown, not absent. */
  unchecked: { vendor: string; reason: string }[];
  /** How many were suppressed by the ignore list, so a silenced list is never invisible. */
  ignored: number;
  knownSlugs: string[];
}

/**
 * Resources that are ours and are never client infrastructure — the agency site, the kanban
 * board, the demo line.
 *
 * Without this every scan reports them forever, and a warning that is always on is
 * wallpaper: you stop reading the list, and the one genuine orphan is lost among the four
 * permanent ones. Edited by hand at `console/.state/orphan-ignore.json`, matched against
 * both the id and the label:
 *
 *   ["juneau-digital-designs", "jdd-kanban", "agent_ad5b87c37b51ba28ed14e6e8d9"]
 *
 * A file rather than a UI button because acknowledging something is not client
 * infrastructure is a rare, considered act, and a one-click "ignore" on this page would
 * make silencing a real orphan as easy as silencing a false one.
 */
function loadIgnoreList(): Set<string> {
  try {
    const path = resolve(process.cwd(), '.state', 'orphan-ignore.json');
    if (!existsSync(path)) return new Set();
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    return new Set(Array.isArray(parsed) ? parsed.map((v) => String(v)) : []);
  } catch {
    // A malformed ignore list must not hide orphans — fail toward showing more, not less.
    return new Set();
  }
}

export async function GET() {
  const clients = await listClientContexts({ includeFixtures: true }).catch(() => []);
  const ignore = loadIgnoreList();

  // Every name a resource might legitimately carry: base slugs, per-site slugs, and the
  // sanitized project names Vercel actually stores. Fixtures are INCLUDED — they are real
  // resources costing real money, and excluding them would report them as orphans forever.
  const known = new Set<string>();
  const numbers = new Set<string>();
  const agents = new Set<string>();
  for (const ctx of clients) {
    known.add(ctx.slug);
    known.add(sanitizeProjectName(ctx.slug));
    for (const s of ctx.sites) {
      known.add(s.slug);
      known.add(sanitizeProjectName(s.slug));
      if (s.env.TWILIO_NUMBER) numbers.add(s.env.TWILIO_NUMBER);
      if (s.env.RETELL_AGENT_ID) agents.add(s.env.RETELL_AGENT_ID);
    }
  }

  const orphans: Orphan[] = [];
  const unchecked: { vendor: string; reason: string }[] = [];

  // ── Vercel ───────────────────────────────────────────────────────────────
  if (loadVercelCredentials()) {
    try {
      const teamId = process.env.VERCEL_TEAM_ID;
      const q = new URLSearchParams({ limit: '100' });
      if (teamId) q.set('teamId', teamId);
      const res = await fetch(`https://api.vercel.com/v9/projects?${q}`, {
        headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` },
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`projects list returned ${res.status}`);
      const body = (await res.json()) as { projects?: { id: string; name: string }[] };
      for (const p of body.projects ?? []) {
        if (known.has(p.name)) continue;
        orphans.push({
          vendor: 'vercel',
          id: p.id,
          label: p.name,
          note: 'Vercel project with no matching client folder.',
        });
      }
    } catch (err) {
      unchecked.push({ vendor: 'vercel', reason: err instanceof Error ? err.message : String(err) });
    }
  } else {
    unchecked.push({ vendor: 'vercel', reason: 'No VERCEL_TOKEN in jdd-ops/.env.' });
  }

  // ── Twilio ───────────────────────────────────────────────────────────────
  const { twilioAccountSid, twilioAuthToken } = loadTeardownCredentials();
  if (twilioAccountSid && twilioAuthToken) {
    try {
      const { default: twilio } = await import('twilio');
      const client = twilio(twilioAccountSid, twilioAuthToken);
      for (const n of await client.incomingPhoneNumbers.list({ limit: 200 })) {
        if (numbers.has(n.phoneNumber)) continue;
        orphans.push({
          vendor: 'twilio',
          id: n.sid,
          label: n.phoneNumber,
          note: `Number on the master account that no client's .env.local claims${
            n.friendlyName && n.friendlyName !== n.phoneNumber ? ` (“${n.friendlyName}”)` : ''
          }.`,
          // Twilio's standard US local number rental. Enough to make the total meaningful
          // without pretending to read a real price book.
          costCents: 115,
        });
      }
    } catch (err) {
      unchecked.push({ vendor: 'twilio', reason: err instanceof Error ? err.message : String(err) });
    }
  } else {
    unchecked.push({ vendor: 'twilio', reason: 'No Twilio credentials in jdd-ops/.env.' });
  }

  // ── Retell ───────────────────────────────────────────────────────────────
  const retellKey = loadRetellApiKey();
  if (retellKey) {
    try {
      const res = await fetch('https://api.retellai.com/list-agents', {
        headers: { Authorization: `Bearer ${retellKey}` },
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`list-agents returned ${res.status}`);
      const body = (await res.json()) as { agent_id?: string; agent_name?: string }[];
      // list-agents returns one row PER VERSION, so the same agent appears repeatedly.
      // Deduping by id is required or a three-version agent reports as three orphans.
      const seen = new Set<string>();
      for (const a of Array.isArray(body) ? body : []) {
        const id = a.agent_id;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        if (agents.has(id)) continue;
        orphans.push({
          vendor: 'retell',
          id,
          label: a.agent_name ?? id,
          note: 'Retell agent no client’s .env.local references.',
        });
      }
    } catch (err) {
      unchecked.push({ vendor: 'retell', reason: err instanceof Error ? err.message : String(err) });
    }
  } else {
    unchecked.push({ vendor: 'retell', reason: 'No RETELL_API_KEY in jdd-ops/.env.' });
  }

  // ── Stripe ───────────────────────────────────────────────────────────────
  // An active subscription with no client is the most expensive orphan there is: it is
  // someone paying for something that may not exist, which is a refund conversation, not
  // a cleanup task.
  const { key: stripeKey } = loadStripeKey();
  if (stripeKey) {
    try {
      const stripe = new Stripe(stripeKey, {
        apiVersion: '2025-10-29.clover' as Stripe.LatestApiVersion,
      });
      // `expand` is required. Without it `sub.customer` is a bare id string, every email
      // resolves to null, and every single subscription reports as an orphan — which is
      // how the first version of this produced eleven false positives on a two-client
      // roster.
      const subs = await stripe.subscriptions.list({
        status: 'active',
        limit: 100,
        expand: ['data.customer'],
      });

      // Client emails come from the client RECORDS, not from PORTAL_ACCOUNT_EMAIL on disk.
      // That env var only exists for clients provisioned since it was introduced, so
      // matching on it alone marked long-standing clients as unclaimed.
      const emails = new Set<string>(
        clients.flatMap((c) =>
          c.sites.map((s) => s.env.PORTAL_ACCOUNT_EMAIL?.toLowerCase()).filter(Boolean) as string[],
        ),
      );
      if (clientRecordsConfigured()) {
        for (const rec of await listClientRecords().catch(() => [])) {
          if (rec.email) emails.add(rec.email.toLowerCase());
        }
      }

      for (const sub of subs.data) {
        const email =
          typeof sub.customer === 'object' && !('deleted' in sub.customer)
            ? (sub.customer.email?.toLowerCase() ?? null)
            : null;
        if (email && emails.has(email)) continue;
        orphans.push({
          vendor: 'stripe',
          id: sub.id,
          // An unresolvable email is worth saying out loud rather than silently showing
          // the subscription id — it changes what the operator should go and check.
          label: email ?? `${sub.id} (no customer email)`,
          note: email
            ? `Active subscription for ${email}, which matches no client on this machine.`
            : 'Active subscription whose customer has no email — cannot be matched to a client.',
          costCents: sub.items.data[0]?.price?.unit_amount ?? undefined,
        });
      }
    } catch (err) {
      unchecked.push({ vendor: 'stripe', reason: err instanceof Error ? err.message : String(err) });
    }
  } else {
    unchecked.push({ vendor: 'stripe', reason: 'No Stripe key in jdd-ops/.env.' });
  }

  // Filtered at the end rather than inside each vendor block: one place to reason about,
  // and `ignored` can be reported so a silenced list never becomes invisible.
  const kept = orphans.filter((o) => !ignore.has(o.id) && !ignore.has(o.label));

  const payload: OrphansPayload = {
    orphans: kept,
    unchecked,
    ignored: orphans.length - kept.length,
    knownSlugs: [...known].sort(),
  };
  return NextResponse.json(payload);
}
