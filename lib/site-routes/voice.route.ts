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
// CLIENT_FORWARD_RING_SECONDS (default 25), Twilio POSTs to /api/voice/no-answer
// which connects the Retell AI.
export async function POST(req: NextRequest) {
  const forwardPhone = toE164(process.env.CLIENT_FORWARD_PHONE ?? '');
  if (!forwardPhone) {
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>This number is not configured.</Say></Response>',
      { headers: { 'Content-Type': 'text/xml' } },
    );
  }

  // Ring window is env-tunable per client; fall back to 25s if unset/invalid.
  const ringSecondsRaw = parseInt(process.env.CLIENT_FORWARD_RING_SECONDS ?? '', 10);
  const ringSeconds = Number.isFinite(ringSecondsRaw) && ringSecondsRaw > 0 ? ringSecondsRaw : 25;

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
