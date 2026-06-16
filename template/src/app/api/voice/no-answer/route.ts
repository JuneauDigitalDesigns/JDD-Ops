import { NextRequest, NextResponse } from 'next/server';

// Twilio action callback after <Dial> completes.
// DialCallStatus: "completed" = client answered; "no-answer"/"busy"/"failed" = route to Retell AI.
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
  if (!agentId) {
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>We are unable to connect your call at this time.</Say></Response>',
      { headers: { 'Content-Type': 'text/xml' } },
    );
  }

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect method="POST">https://api.retellai.com/twilio-voice-webhook/${agentId}</Redirect>
</Response>`;

  return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } });
}
