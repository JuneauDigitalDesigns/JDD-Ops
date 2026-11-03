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
// ── When the submission is recorded, and when it deliberately is not ─────────────────────────
// This route used to either email the owner (Starter, via Resend) or place a Retell callback
// (Growth) — and in the callback case it persisted nothing, so a callback Retell refused lost
// the lead with no trace. Then it recorded every submission, which fixed that and caused the
// opposite: an answered callback reached the portal twice (the form, then the call), and an
// unanswered one sat there as a "new lead" nobody had spoken to.
//
// The rule now (operator decision, 2026-11-03):
//
//   - Callback PLACED (LEAD_CALLBACK=on and Retell accepted it) → not recorded here. If the lead
//     answers, the post-call scenario logs the call and briefs the owner; that is the portal
//     entry. If they don't answer, it's a lost lead, and nothing lands anywhere — the scenario
//     stops at its trigger for no-answer, busy, failed and voicemail.
//   - No callback (Starter, web-only, Retell refused it, no dialable number) → recorded, and the
//     owner is texted at once. A refused callback is a system failure, not a lost lead.
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

/**
 * The name the lead typed, as the agent may say it back to them: letters, spaces, apostrophes
 * and hyphens only, short enough to say in one breath. Anything else means "no name".
 */
function spokenLeadName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[^\p{L}\p{M}' -]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 60).trim();
}

/**
 * The first thing the agent says on a callback: the recording disclosure, then an identity
 * check, word for word as the operator approved them on 2026-11-02.
 *
 * A standalone copy of `outboundOpeningLine()` in jdd-ops/lib/voice-consent.js — this file is
 * written verbatim into client repos, which have no dependency on it. test/voice-consent.test.mjs
 * pins the two equal. Change the wording there, with sign-off, never here.
 *
 * It has to be sent per call: the LLM's own `begin_message` is the INBOUND line, and one
 * begin_message cannot branch on direction. Without this the agent opens a call it placed with
 * "how can I help you today?".
 */
function outboundOpeningLine(businessName: string, name: string): string {
  const question = name ? `Am I speaking with ${name}?` : 'Is now a good time?';
  return `This call is on a recorded line. Hi, this is ${businessName}, calling about the request you sent on our website. ${question}`;
}

/** Place the Retell callback. Returns true when Retell accepted the call. */
async function placeCallback(toNumber: string, leadName: unknown): Promise<boolean> {
  const apiKey = process.env.RETELL_API_KEY;
  const fromNumber = process.env.TWILIO_NUMBER;
  const agentId = process.env.RETELL_AGENT_ID;
  if (!apiKey || !fromNumber || !agentId) {
    console.error('[contact] callback env not set — skipping callback');
    return false;
  }
  // Synced to Vercel by onboard.js step 9. Without it the callback still goes out, opening with
  // the LLM's inbound line — wrong words, but a lead who is called beats one who is not.
  const businessName = process.env.NEXT_PUBLIC_BRAND_NAME?.trim();
  if (!businessName) console.error('[contact] NEXT_PUBLIC_BRAND_NAME not set — callback opens with the inbound line');
  const name = spokenLeadName(leadName);
  try {
    const res = await fetch('https://api.retellai.com/v2/create-phone-call', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from_number: fromNumber,
        to_number: toNumber,
        override_agent_id: agentId,
        ...(businessName
          ? { agent_override: { retell_llm: { begin_message: outboundOpeningLine(businessName, name) } } }
          : {}),
        // So the prompt can use the name after the opening line. Values must be strings.
        retell_llm_dynamic_variables: { lead_name: name },
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

  // Dial first: whether the callback went out decides whether the submission is recorded at all.
  // The caller is waiting on this response, and `create-phone-call` only queues the call, so
  // the added latency is one API round trip rather than the length of a conversation.
  let callbackPlaced = false;
  if (process.env.LEAD_CALLBACK === 'on' && toNumber) {
    callbackPlaced = await placeCallback(toNumber, (data as { name?: unknown }).name);
  }

  // A placed callback is NOT recorded here. Operator rule, 2026-11-03: an unanswered callback is
  // a lost lead and must not land in the portal. The lead reaches the portal only through the
  // completed call — the post-call scenario logs a CONNECTED callback and briefs the owner, and
  // stops at the trigger for no-answer, busy, failed or voicemail. Recording the form here as
  // well put every callback in the portal twice when it was answered, and once, as a stale
  // "new lead", when it was not.
  if (callbackPlaced) return NextResponse.json({ ok: true });

  // No callback went out — Starter / web-only by design, or a Growth callback Retell refused, or
  // no dialable number. Nobody else is going to reach this person, so the submission is recorded
  // and the owner is told now. A refused callback is a system failure, not a lost lead.
  const stored = await recordLead(data as Record<string, unknown>, false);

  // Nothing happened at all: the form must say so and show the phone number as a fallback.
  if (!stored) {
    return NextResponse.json({ ok: false, error: 'Delivery failed' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
