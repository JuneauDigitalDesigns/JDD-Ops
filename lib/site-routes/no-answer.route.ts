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
