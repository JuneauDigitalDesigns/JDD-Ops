import { NextResponse } from 'next/server';

// Lead delivery. onboard.js writes these env vars (clients/{slug}/.env.local) and
// syncs them to Vercel:
//   - LEAD_DELIVERY_MODE = "email" (starter) | "webhook" (growth/enterprise)
//   - email mode:   LEAD_TO_EMAIL, RESEND_API_KEY, RESEND_FROM_EMAIL
//   - webhook mode: MAKE_WEBHOOK_URL
// Read ONLY these names — never invent new env vars, never expose master secrets.
export async function POST(req: Request) {
  const data = await req.json().catch(() => ({}));
  const mode = process.env.LEAD_DELIVERY_MODE ?? 'email';

  try {
    if (mode === 'webhook') {
      const url = process.env.MAKE_WEBHOOK_URL;
      if (!url) {
        return NextResponse.json({ ok: false, error: 'MAKE_WEBHOOK_URL not set' }, { status: 500 });
      }
      await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      });
    } else {
      const apiKey = process.env.RESEND_API_KEY;
      const to = process.env.LEAD_TO_EMAIL;
      const from = process.env.RESEND_FROM_EMAIL ?? 'leads@juneaudigitaldesigns.com';
      if (!apiKey || !to) {
        return NextResponse.json({ ok: false, error: 'Resend env not set' }, { status: 500 });
      }
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          from,
          to,
          subject: 'New website lead',
          text: JSON.stringify(data, null, 2),
        }),
      });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'Delivery failed' }, { status: 500 });
  }
}
