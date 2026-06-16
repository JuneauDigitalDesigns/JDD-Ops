import { NextRequest, NextResponse } from 'next/server';

// Twilio inbound voice webhook.
// Dials the client's real phone first; if they don't answer within 20 seconds,
// Twilio POSTs to /api/voice/no-answer which redirects to the Retell AI.
export async function POST(req: NextRequest) {
  const forwardPhone = process.env.CLIENT_FORWARD_PHONE;
  if (!forwardPhone) {
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>This number is not configured.</Say></Response>',
      { headers: { 'Content-Type': 'text/xml' } },
    );
  }

  const baseUrl = req.nextUrl.origin;
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="20" action="${baseUrl}/api/voice/no-answer" method="POST">
    <Number>${forwardPhone}</Number>
  </Dial>
</Response>`;

  return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } });
}
