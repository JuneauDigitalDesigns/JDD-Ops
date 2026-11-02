import { NextResponse } from 'next/server';

// Normalize a US phone number to E.164 (+1XXXXXXXXXX). Retell's create-phone-call
// requires E.164. Returns null if it can't be parsed.
function toE164(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^\+\d{8,15}$/.test(trimmed)) return trimmed;
  const d = trimmed.replace(/\D/g, '');
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  return null;
}

// Lead delivery. onboard.js writes these env vars (clients/{slug}/.env.local) and
// syncs them to Vercel:
//   - LEAD_DELIVERY_MODE = "portal"  (every tier)
//   - LEAD_INGEST_URL, LEAD_INGEST_TOKEN  — where the lead is recorded, and the bearer
//     token that identifies this site. The token is per-client; it is NOT a shared secret.
//   - LEAD_CALLBACK = "on" | "off"   — Growth/Enterprise also dial the lead back
//   - callback mode also needs: RETELL_API_KEY, TWILIO_NUMBER, RETELL_AGENT_ID
// Read ONLY these names — never invent new env vars, never expose master secrets.
//
// ── Why the lead is ALWAYS recorded first ───────────────────────────────────────────────────
// This route used to either email the owner (Starter, via Resend) or place a Retell callback
// (Growth) — and in the callback case it persisted nothing. Two ways that lost a paying
// customer's lead with no trace:
//
//   1. `create-phone-call` fails (bad number, Retell error, rate limit) → 502, nothing stored.
//   2. It succeeds but the lead never answers → no `call_analyzed` event → the Make post-call
//      scenario never fires → no Airtable row. The lead simply evaporates.
//
// So the lead is recorded before anything else, on every tier, and the callback becomes an
// additional action rather than the only one. The portal is then the system of record and the
// owner can act on a lead the receptionist never reached.
//
// Resend is gone entirely. It was the whole delivery mechanism for Starter and it failed open:
// `RESEND_API_KEY` seeded empty on a fresh client and `syncVercelEnv` skips empty values, so the
// key never reached Vercel and this route 502'd on every lead until someone noticed by hand.

/** Record the lead in the client's portal. Returns true when it was stored. */
async function recordLead(data: Record<string, unknown>, callbackPlaced: boolean): Promise<boolean> {
  const url = process.env.LEAD_INGEST_URL;
  const token = process.env.LEAD_INGEST_TOKEN;
  if (!url || !token) {
    console.error('[contact] LEAD_INGEST_URL/LEAD_INGEST_TOKEN not set — lead not recorded');
    return false;
  }
  try {
    // The WHOLE body is forwarded, not a whitelist. That is what lets a new form field — or the
    // consent object the lead form captures — arrive without this file changing again.
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ...data, callbackPlaced }),
    });
    if (!res.ok) {
      console.error('[contact] lead ingest failed:', res.status, (await res.text()).slice(0, 300));
      return false;
    }
    return true;
  } catch (e) {
    console.error('[contact] lead ingest threw:', e);
    return false;
  }
}

/** Place the Retell callback. Returns true when Retell accepted the call. */
async function placeCallback(toNumber: string): Promise<boolean> {
  const apiKey = process.env.RETELL_API_KEY;
  const fromNumber = process.env.TWILIO_NUMBER;
  const agentId = process.env.RETELL_AGENT_ID;
  if (!apiKey || !fromNumber || !agentId) {
    console.error('[contact] callback env not set — skipping callback');
    return false;
  }
  try {
    const res = await fetch('https://api.retellai.com/v2/create-phone-call', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from_number: fromNumber,
        to_number: toNumber,
        override_agent_id: agentId,
      }),
    });
    if (!res.ok) {
      console.error('[contact] Retell create-phone-call failed:', res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error('[contact] Retell create-phone-call threw:', e);
    return false;
  }
}

export async function POST(req: Request) {
  const data = await req.json().catch(() => ({}) as Record<string, unknown>);

  const phoneRaw = String((data as { phone?: unknown }).phone ?? '');
  const emailRaw = String((data as { email?: unknown }).email ?? '').trim();
  const toNumber = phoneRaw ? toE164(phoneRaw) : null;

  // A submission with no reachable contact is not a lead. Reject before doing any work.
  if (!toNumber && !emailRaw) {
    return NextResponse.json(
      { ok: false, error: 'A phone number or email address is required' },
      { status: 400 },
    );
  }

  // Order matters: dial first so the lead is recorded knowing whether the callback happened.
  // The caller is waiting on this response, and `create-phone-call` only queues the call, so
  // the added latency is one API round trip rather than the length of a conversation.
  let callbackPlaced = false;
  if (process.env.LEAD_CALLBACK === 'on' && toNumber) {
    callbackPlaced = await placeCallback(toNumber);
  }

  const stored = await recordLead(data as Record<string, unknown>, callbackPlaced);

  // 502 when the lead could not be stored AND no callback went out — nothing happened, so the
  // form must say so and show the phone number as a fallback. If the callback was placed, the
  // client is already being contacted, so this is a success for the visitor even though we owe
  // ourselves a log line about the ingest failure.
  if (!stored && !callbackPlaced) {
    return NextResponse.json({ ok: false, error: 'Delivery failed' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
