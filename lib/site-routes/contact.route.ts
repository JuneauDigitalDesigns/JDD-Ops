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
// A callback also needs the visitor's consent to an AI call (operator decision, 2026-11-09). The
// form's box is the first gate; this route is the real one. It dials only with a consent it can
// verify, and only after the proof is saved at the agency, because a placed callback is never
// recorded as a lead and would otherwise take the proof with it. A callback site with no valid
// consent, or nowhere to keep it, makes no call: the lead goes to the inbox and the owner is
// texted, the same as a callback Retell refuses.
//
// ── The human check, and what a flood can't do (operator decision, 2026-11-09) ────────────────
// Every submission is first sent to the agency's `/api/ingest/admit` with the form's Cloudflare
// Turnstile token. The agency verifies it (never this route: the secret stays there), applies the
// per-visitor limits, claims the AI callback (one call per number per site per 24 h), and answers
// with a single-use admission that the consent save and the lead record must carry.
//
//   - Refused (403 not-verified, 429 too-many): passed straight back. The form shows the approved
//     words for each. Nothing is called or recorded.
//   - Admitted with the callback held (the number was called today, a cap, Cloudflare down): no
//     call. The lead is recorded like any callback that couldn't go out.
//   - The agency can't be reached: no call (a call we can't count is a call we don't make). The
//     lead is still offered to the ingest, which takes it from a site not yet moved over; if that
//     fails too, the form shows the phone number, as it always has.
//
// Never throttle a genuine lead: every limit at the agency holds back a call or a text, and only
// a failed check or one visitor sending again and again is refused.
//
// Resend is gone entirely. It was the whole delivery mechanism for Starter and it failed open:
// `RESEND_API_KEY` seeded empty on a fresh client and `syncVercelEnv` skips empty values, so the
// key never reached Vercel and this route 502'd on every lead until someone noticed by hand.

/** The visitor's address as Vercel reports it. Vercel overwrites `x-forwarded-for` at its edge. */
function clientIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for');
  return (forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip')) || null;
}

/** The form's own fields for the human check. Never forwarded with the lead. */
const HONEYPOT_FIELD = 'jdd_hp';
const NOT_FORWARDED = new Set(['turnstileToken', 'turnstileStatus', HONEYPOT_FIELD, 'admissionId', 'callbackPlaced']);

/**
 * What the agency should make of a submission with no token. "off": this site has no key, so the
 * form rendered no widget. "widget-error": the form (@jdd/ui v1.6.0+) says its widget couldn't run,
 * most often because this host isn't on the site's widget. Either way the agency keeps the lead and
 * places no call (operator decision, 2026-11-09: never lose a lead). A token always wins: then the
 * check runs.
 */
function humanCheckFor(turnstileToken: unknown, turnstileStatus: unknown): 'on' | 'off' | 'widget-error' {
  if (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim()) return 'off';
  if (!shortString(turnstileToken, 2048) && turnstileStatus === 'error') return 'widget-error';
  return 'on';
}

type Admission =
  | { kind: 'admitted'; admissionId: string; callback: boolean }
  | { kind: 'refused'; status: 403 | 429; error: 'not-verified' | 'too-many' }
  | { kind: 'unreachable' };

/**
 * Ask the agency whether this submission may proceed, and whether it may place the AI call.
 * Four seconds at most: the visitor is waiting on this response.
 */
async function admitSubmission(
  req: Request,
  input: { turnstileToken: unknown; turnstileStatus: unknown; phone: string | null; email: string; wantsCallback: boolean },
): Promise<Admission> {
  const token = process.env.LEAD_INGEST_TOKEN;
  if (!process.env.LEAD_INGEST_URL || !token) {
    console.error('[contact] LEAD_INGEST_URL/LEAD_INGEST_TOKEN not set — nothing can be admitted');
    return { kind: 'unreachable' };
  }
  try {
    const res = await fetch(new URL('/api/ingest/admit', process.env.LEAD_INGEST_URL), {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        turnstileToken: shortString(input.turnstileToken, 2048),
        ip: clientIp(req),
        phone: input.phone,
        email: input.email || null,
        wantsCallback: input.wantsCallback,
        // The token must have been solved on the host the form was posted to, and only the
        // production deployment's first ask moves this site over to admissions at the agency.
        host: req.headers.get('x-forwarded-host') || req.headers.get('host'),
        deployment: process.env.VERCEL_ENV ?? null,
        humanCheck: humanCheckFor(input.turnstileToken, input.turnstileStatus),
        // Which widget the form rendered: client sites share a pool, each with its own secret.
        siteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null,
      }),
      signal: AbortSignal.timeout(4000),
    });
    const body = (await res.json().catch(() => null)) as
      | { admissionId?: unknown; callback?: unknown; error?: unknown }
      | null;
    if (res.ok && typeof body?.admissionId === 'string') {
      return { kind: 'admitted', admissionId: body.admissionId, callback: body.callback === 'allowed' };
    }
    if (res.status === 403 && body?.error === 'not-verified') return { kind: 'refused', status: 403, error: 'not-verified' };
    if (res.status === 429 && body?.error === 'too-many') return { kind: 'refused', status: 429, error: 'too-many' };
    console.error('[contact] admit answered', res.status);
  } catch (e) {
    console.error('[contact] admit unreachable:', e);
  }
  return { kind: 'unreachable' };
}

/** Record the lead in the client's portal. Returns its id, or null when it wasn't stored. */
async function recordLead(
  data: Record<string, unknown>,
  callbackPlaced: boolean,
  admissionId: string | null,
): Promise<{ leadId: string | null } | null> {
  const url = process.env.LEAD_INGEST_URL;
  const token = process.env.LEAD_INGEST_TOKEN;
  if (!url || !token) {
    console.error('[contact] LEAD_INGEST_URL/LEAD_INGEST_TOKEN not set — lead not recorded');
    return null;
  }
  try {
    // The WHOLE body is forwarded, not a whitelist. That is what lets a new form field — or the
    // consent object the lead form captures — arrive without this file changing again. The one
    // exception is the human check's plumbing, which is no part of the lead.
    const forwarded = Object.fromEntries(Object.entries(data).filter(([k]) => !NOT_FORWARDED.has(k)));
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ...forwarded, callbackPlaced, ...(admissionId ? { admissionId } : {}) }),
    });
    if (!res.ok) {
      console.error('[contact] lead ingest failed:', res.status, (await res.text()).slice(0, 300));
      return null;
    }
    const body = (await res.json().catch(() => null)) as { leadId?: unknown } | null;
    return { leadId: typeof body?.leadId === 'string' ? body.leadId : null };
  } catch (e) {
    console.error('[contact] lead ingest threw:', e);
    return null;
  }
}

/**
 * Add the visitor's message to a lead this route already recorded, after the AI call couldn't go
 * out. It updates that lead rather than creating another, so the owner gets one lead and one text.
 */
async function saveFollowUpMessage(raw: unknown): Promise<NextResponse> {
  const { leadId, message } = (raw && typeof raw === 'object' ? raw : {}) as {
    leadId?: unknown;
    message?: unknown;
  };
  const text = shortString(message, 2000);
  if (typeof leadId !== 'string' || !/^[0-9a-f-]{36}$/i.test(leadId) || !text) {
    return NextResponse.json({ ok: false, error: 'A message is required' }, { status: 400 });
  }
  try {
    const res = await fetch(new URL('/api/ingest/lead/message', process.env.LEAD_INGEST_URL), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.LEAD_INGEST_TOKEN}`,
      },
      body: JSON.stringify({ leadId, message: text }),
    });
    if (res.ok) return NextResponse.json({ ok: true });
    console.error('[contact] follow-up message not saved:', res.status);
  } catch (e) {
    console.error('[contact] saving the follow-up message threw:', e);
  }
  return NextResponse.json({ ok: false, error: 'Delivery failed' }, { status: 502 });
}

/**
 * The wording each consent version showed, so a hash can be checked against the words.
 *
 * A standalone copy of LEAD_CALL_CONSENT_TEMPLATE in @jdd/ui: this file is written verbatim into
 * client repos. Approved word for word by the operator on 2026-11-09. A new wording in @jdd/ui
 * adds a row here; never edit one. console/test/contact-route-callback.test.mjs pins the words.
 */
const CALL_CONSENT_WORDING: Record<string, string> = {
  'lead-call-consent-v1':
    "I agree that {business} may call me back at the number I entered, about this request, using an automated system and an AI-generated voice. The call may be recorded. I don't have to agree in order to buy anything, and I can phone instead.",
};

const canonicalText = (text: string) => text.replace(/\s+/g, ' ').trim();

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

const shortString = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

interface CallConsentProof {
  textVersion: string;
  textHash: string;
  text: string;
  businessName: string;
  capturedAt: string;
  pageUrl: string;
}

/**
 * The visitor's consent to the AI callback, or null if it isn't one we can stand behind.
 *
 * The hash is re-derived from this site's own business name, so a form on an old build, one that
 * showed other words, or a hand-written POST can't reach the dialer. A site with no business name
 * fails here on purpose: the approved wording names the business.
 */
async function verifiedCallConsent(raw: unknown): Promise<CallConsentProof | null> {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  const businessName = canonicalText(process.env.NEXT_PUBLIC_BRAND_NAME ?? '');
  const textVersion = typeof c.textVersion === 'string' ? c.textVersion : '';
  if (c.basis !== 'web-form-checkbox' || !businessName) return null;
  if (!Object.hasOwn(CALL_CONSENT_WORDING, textVersion)) return null;

  const text = canonicalText(CALL_CONSENT_WORDING[textVersion].replace('{business}', () => businessName));
  const textHash = await sha256Hex(text);
  if (c.textHash !== textHash) return null;

  return {
    textVersion,
    textHash,
    text,
    businessName,
    capturedAt: shortString(c.capturedAt, 40),
    pageUrl: shortString(c.pageUrl, 500),
  };
}

/**
 * Save the proof at the agency. True only once it is stored.
 *
 * Its own endpoint, not the lead ingest: this record must exist for a callback that goes
 * unanswered, and nothing about that callback may appear in the client's inbox.
 */
async function saveCallConsentProof(
  req: Request,
  proof: CallConsentProof,
  phone: string,
  name: unknown,
  admissionId: string,
): Promise<boolean> {
  const token = process.env.LEAD_INGEST_TOKEN;
  if (!process.env.LEAD_INGEST_URL || !token) {
    console.error('[contact] LEAD_INGEST_URL/LEAD_INGEST_TOKEN not set — call consent not saved');
    return false;
  }
  try {
    const url = new URL('/api/ingest/call-consent', process.env.LEAD_INGEST_URL);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        ...proof,
        phone,
        admissionId,
        name: shortString(name, 200),
        ip: clientIp(req) || 'unknown',
        userAgent: shortString(req.headers.get('user-agent'), 500) || 'unknown',
      }),
    });
    if (!res.ok) {
      console.error('[contact] call consent not saved:', res.status);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[contact] saving call consent threw:', e);
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
/**
 * The callback number in words for the agent to repeat: "+12073181838" → "two zero seven, three one
 * eight, one eight three eight". The model misread raw digits on live calls (207 → "four oh seven",
 * then "seven oh seven"). "" when not a ten-digit US number, so the prompt falls back to
 * {{user_number}}. A standalone copy of spokenPhoneDigits in lib/voice-consent.js (client repos
 * have no @jdd dependency); test/agent-call-flow.test.mjs runs both and pins them equal.
 */
function spokenPhoneDigits(raw: unknown): string {
  const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  const d = String(raw ?? '').replace(/\D/g, '');
  const ten = d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
  if (ten.length !== 10) return '';
  const say = (s: string) => [...s].map((c) => words[Number(c)]).join(' ');
  return `${say(ten.slice(0, 3))}, ${say(ten.slice(3, 6))}, ${say(ten.slice(6))}`;
}

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
        retell_llm_dynamic_variables: { lead_name: name, callback_number_spoken: spokenPhoneDigits(toNumber) },
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

/** Larger than any form this catalog renders, by a distance. */
const MAX_BODY_BYTES = 16 * 1024;

export async function POST(req: Request) {
  // A browser marks a same-origin fetch. Anything it marks otherwise was posted from another
  // site's page, which no form of ours does. A non-browser sends no mark and meets the human check.
  const fetchSite = req.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin') {
    return NextResponse.json({ ok: false, error: 'not-verified' }, { status: 403 });
  }
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: 'Payload too large' }, { status: 413 });
  }
  const raw = await req.text().catch(() => '');
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: 'Payload too large' }, { status: 413 });
  }
  let data: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw);
    data = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    data = {};
  }

  // The second step of a callback site's form, only ever reached after a call that didn't go out.
  const followUp = (data as { followUp?: unknown }).followUp;
  if (followUp !== undefined && process.env.LEAD_CALLBACK === 'on') {
    return saveFollowUpMessage(followUp);
  }

  const phoneRaw = String((data as { phone?: unknown }).phone ?? '');
  const emailRaw = String((data as { email?: unknown }).email ?? '').trim();
  const toNumber = phoneRaw ? toE164(phoneRaw) : null;

  // The honeypot: an input no person can see or reach was filled. Answered like a success, so a
  // script learns nothing, and nothing is admitted, called, recorded or texted.
  const honeypot = data[HONEYPOT_FIELD];
  if (typeof honeypot === 'string' && honeypot.trim()) return NextResponse.json({ ok: true });

  // A submission with no reachable contact is not a lead. Reject before doing any work.
  if (!toNumber && !emailRaw) {
    return NextResponse.json(
      { ok: false, error: 'A phone number or email address is required' },
      { status: 400 },
    );
  }

  // Consent is checked here, before asking the agency, so a callback is only claimed for a
  // submission that could actually be dialed.
  const callbackSite = process.env.LEAD_CALLBACK === 'on';
  const { name, callConsent } = data as { name?: unknown; callConsent?: unknown };
  const proof = callbackSite && toNumber ? await verifiedCallConsent(callConsent) : null;
  if (callbackSite && toNumber && !proof) {
    console.warn('[contact] no valid call consent — not dialing, recording the lead instead');
  }

  const admission = await admitSubmission(req, {
    turnstileToken: data.turnstileToken,
    turnstileStatus: data.turnstileStatus,
    phone: toNumber,
    email: emailRaw,
    wantsCallback: Boolean(proof),
  });
  if (admission.kind === 'refused') {
    return NextResponse.json({ ok: false, error: admission.error }, { status: admission.status });
  }
  const admissionId = admission.kind === 'admitted' ? admission.admissionId : null;

  // Dial first: whether the callback went out decides whether the submission is recorded at all.
  // The caller is waiting on this response, and `create-phone-call` only queues the call, so
  // the added latency is one API round trip rather than the length of a conversation.
  let callbackPlaced = false;
  if (proof && toNumber && admission.kind === 'admitted' && admission.callback) {
    if (await saveCallConsentProof(req, proof, toNumber, name, admission.admissionId)) {
      callbackPlaced = await placeCallback(toNumber, name);
    }
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
  const stored = await recordLead(data, false, admissionId);

  // Nothing happened at all: the form must say so and show the phone number as a fallback.
  if (!stored) {
    return NextResponse.json({ ok: false, error: 'Delivery failed' }, { status: 502 });
  }

  // A visitor on a callback site was told to expect a call that isn't coming. Saying so lets the
  // form offer a message box instead. Starter's response stays exactly as it was.
  if (process.env.LEAD_CALLBACK === 'on' && phoneRaw) {
    return NextResponse.json({ ok: true, callback: 'unavailable', followUpId: stored.leadId });
  }

  return NextResponse.json({ ok: true });
}
