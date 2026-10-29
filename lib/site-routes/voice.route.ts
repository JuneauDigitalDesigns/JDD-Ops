import { NextRequest, NextResponse } from 'next/server';

// Normalize a US phone number to E.164 (+1XXXXXXXXXX). Twilio's <Dial><Number>
// requires E.164 — raw schema values like "(207) 318-1838" are rejected and the
// dial fails instantly (no ring). Returns null if it can't be parsed.
function toE164(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^\+\d{8,15}$/.test(trimmed)) return trimmed; // already E.164
  const d = trimmed.replace(/\D/g, '');
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  return null;
}

// Twilio inbound voice webhook.
// Dials the client's real phone first; if they don't answer within
// CLIENT_FORWARD_RING_SECONDS (default 15), Twilio POSTs to /api/voice/no-answer
// which connects the Retell AI.
//
// The 15s default is deliberately BELOW typical mobile voicemail pickup (~20-25s). If the
// window is longer, the owner's carrier voicemail answers the forward leg before Twilio times
// out; Twilio scores that as answered (DialCallStatus=completed), the no-answer branch never
// runs, and the caller lands in voicemail instead of the Retell agent. Owners whose voicemail
// answers earlier than ~15s can still race it — that's the one case this can't cover.
export async function POST(req: NextRequest) {
  const forwardPhone = toE164(process.env.CLIENT_FORWARD_PHONE ?? '');
  if (!forwardPhone) {
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>This number is not configured.</Say></Response>',
      { headers: { 'Content-Type': 'text/xml' } },
    );
  }

  // Ring window is env-tunable per client, but CLAMPED to 5–20s rather than applied verbatim.
  //
  // The ceiling is enforced here, at the last possible moment, because the console UI is not
  // the only way a value reaches production: env can be edited straight in the Vercel
  // dashboard, pushed by a script, or carried over from an older client. A number above the
  // ceiling does not fail loudly — it quietly routes callers into the owner's voicemail
  // instead of the receptionist they are paying for, so the safe behaviour has to be the one
  // that cannot be configured away.
  //
  // These literals are a deliberate copy of RING_SECONDS_* in jdd-ops/lib/client-env.js. This
  // file is written verbatim into each CLIENT repo, which has no dependency on jdd-ops or
  // @jdd/schema, so it cannot import them — the same standalone-copy exception that
  // @jdd/schema's phone.ts documents for its own inline toE164. jdd-ops'
  // test/ring-window.test.mjs asserts these numbers still match the shared module.
  const RING_DEFAULT = 15;
  const RING_MIN = 5;
  const RING_MAX = 20;
  const ringSecondsRaw = parseInt(process.env.CLIENT_FORWARD_RING_SECONDS ?? '', 10);
  const ringSeconds =
    Number.isFinite(ringSecondsRaw) && ringSecondsRaw > 0
      ? Math.min(RING_MAX, Math.max(RING_MIN, ringSecondsRaw))
      : RING_DEFAULT;
  if (Number.isFinite(ringSecondsRaw) && ringSecondsRaw > RING_MAX) {
    // Visible in the Vercel function log, so a clamped client is discoverable rather than
    // merely correct.
    console.warn(
      `[voice] CLIENT_FORWARD_RING_SECONDS=${ringSecondsRaw} exceeds the ${RING_MAX}s ceiling; using ${ringSeconds}s. ` +
        'A longer window lets carrier voicemail answer the forward leg, which Twilio scores as answered — ' +
        'the no-answer branch never fires and the caller never reaches the agent.',
    );
  }

  // Originate the forward leg from the JDD-owned Twilio number, not the inbound
  // caller's number. Passing an arbitrary customer caller ID through gets rejected
  // by some carriers / STIR-SHAKEN (Twilio 13224). Falls back to pass-through if
  // TWILIO_NUMBER is unset.
  const callerId = toE164(process.env.TWILIO_NUMBER ?? '');
  const callerIdAttr = callerId ? ` callerId="${callerId}"` : '';

  const baseUrl = req.nextUrl.origin;
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="${ringSeconds}"${callerIdAttr} action="${baseUrl}/api/voice/no-answer" method="POST">
    <Number>${forwardPhone}</Number>
  </Dial>
</Response>`;

  return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } });
}
