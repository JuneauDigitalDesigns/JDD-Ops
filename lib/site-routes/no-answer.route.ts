import { NextRequest, NextResponse } from 'next/server';

// Twilio action callback after <Dial> completes.
// DialCallStatus: "completed" = client answered; "no-answer"/"busy"/"failed" = connect Retell AI.
//
// Retell custom-telephony (bring-your-own-Twilio) flow:
//   1. POST https://api.retellai.com/v2/register-phone-call  → returns call_id
//   2. Return <Dial><Sip>sip:{call_id}@{RETELL_SIP_DOMAIN}</Sip></Dial>
//      (RETELL_SIP_DOMAIN defaults to sip.retellai.com)
//   3. Twilio connects the call to the Retell agent over SIP (no bridge needed).
//      Must dial within 5 min of register-phone-call.
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

export async function POST(req: NextRequest) {
  const formData   = await req.formData();
  const dialStatus = formData.get('DialCallStatus') as string | null;

  if (dialStatus === 'completed') {
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { 'Content-Type': 'text/xml' } },
    );
  }

  const agentId = process.env.RETELL_AGENT_ID;
  const apiKey  = process.env.RETELL_API_KEY;

  if (!agentId || !apiKey) {
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>We are unable to connect your call at this time.</Say></Response>',
      { headers: { 'Content-Type': 'text/xml' } },
    );
  }

  const fromNumber = (formData.get('From') as string | null) ?? undefined;
  const toNumber   = (formData.get('To') as string | null) ?? undefined;

  let callId: string;
  try {
    const res = await fetch('https://api.retellai.com/v2/register-phone-call', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agent_id: agentId,
        direction: 'inbound',
        ...(fromNumber ? { from_number: fromNumber } : {}),
        ...(toNumber ? { to_number: toNumber } : {}),
        // So the agent repeats the caller's number in words instead of reading digits. Strings only.
        retell_llm_dynamic_variables: { callback_number_spoken: spokenPhoneDigits(fromNumber) },
      }),
    });
    if (!res.ok) throw new Error(`register-phone-call ${res.status}: ${await res.text()}`);
    const data = await res.json();
    callId = data.call_id;
    if (!callId) throw new Error('No call_id in Retell response: ' + JSON.stringify(data));
  } catch (err) {
    console.error('[no-answer] Retell register-phone-call failed:', err);
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>We are unable to connect your call at this time.</Say></Response>',
      { headers: { 'Content-Type': 'text/xml' } },
    );
  }

  const sipDomain = process.env.RETELL_SIP_DOMAIN || 'sip.retellai.com';
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Sip>sip:${callId}@${sipDomain}</Sip>
  </Dial>
</Response>`;

  return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } });
}
