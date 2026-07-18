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

// Turn a form field key ("firstName", "phone_number") into a readable label.
function labelForKey(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Escape a value for safe interpolation into the HTML email body.
function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Build the owner-facing lead email (subject + text + html) from arbitrary form
// fields. Empty/blank values are skipped. brandName is optional.
function buildLeadEmail(data: Record<string, unknown>, brandName: string) {
  const entries = Object.entries(data).filter(
    ([, v]) => v !== null && v !== undefined && String(v).trim() !== '',
  );
  const submittedAt = new Date().toLocaleString('en-US', { timeZoneName: 'short' });

  const leadName = typeof data.name === 'string' ? data.name.trim() : '';
  const subject = `New lead${brandName ? ` — ${brandName}` : ''}${leadName ? `: ${leadName}` : ''}`;

  const textLines = entries.map(([k, v]) => `${labelForKey(k)}: ${String(v).trim()}`);
  textLines.push('', `Submitted: ${submittedAt}`);
  const text = textLines.join('\n');

  const rows = entries
    .map(
      ([k, v]) =>
        `<tr>` +
        `<td style="padding:6px 12px;color:#6b7280;font-size:13px;vertical-align:top;white-space:nowrap;">${escapeHtml(labelForKey(k))}</td>` +
        `<td style="padding:6px 12px;color:#111827;font-size:14px;font-weight:600;">${escapeHtml(String(v).trim())}</td>` +
        `</tr>`,
    )
    .join('');
  const html =
    `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;">` +
    `<h2 style="font-size:18px;color:#111827;margin:0 0 4px;">New website lead${brandName ? ` — ${escapeHtml(brandName)}` : ''}</h2>` +
    `<p style="font-size:13px;color:#6b7280;margin:0 0 16px;">Submitted ${escapeHtml(submittedAt)}</p>` +
    `<table style="border-collapse:collapse;width:100%;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">${rows}</table>` +
    `</div>`;

  return { subject, text, html };
}

// Lead delivery. onboard.js writes these env vars (clients/{slug}/.env.local) and
// syncs them to Vercel:
//   - LEAD_DELIVERY_MODE = "email" (starter) | "callback" (growth/enterprise)
//   - email mode:    LEAD_TO_EMAIL, RESEND_API_KEY, RESEND_FROM_EMAIL, LEAD_BRAND_NAME
//   - callback mode: RETELL_API_KEY, TWILIO_NUMBER, RETELL_AGENT_ID
// Read ONLY these names — never invent new env vars, never expose master secrets.
//
// The callback branch does the Retell outbound call and nothing else (no email /
// notification). The email branch is the starter lead-delivery path, unchanged.
export async function POST(req: Request) {
  const data = await req.json().catch(() => ({} as Record<string, unknown>));
  const mode = process.env.LEAD_DELIVERY_MODE ?? 'email';

  try {
    if (mode === 'callback') {
      const apiKey = process.env.RETELL_API_KEY;
      const fromNumber = process.env.TWILIO_NUMBER;
      const agentId = process.env.RETELL_AGENT_ID;
      const toNumber = toE164(String((data as { phone?: unknown }).phone ?? ''));
      if (!apiKey || !fromNumber || !agentId) {
        return NextResponse.json({ ok: false, error: 'Callback env not set' }, { status: 500 });
      }
      if (!toNumber) {
        return NextResponse.json({ ok: false, error: 'Invalid phone number' }, { status: 400 });
      }
      const res = await fetch('https://api.retellai.com/v2/create-phone-call', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from_number: fromNumber, to_number: toNumber, override_agent_id: agentId }),
      });
      if (!res.ok) {
        console.error('[contact] Retell create-phone-call failed:', res.status, await res.text());
        return NextResponse.json({ ok: false, error: 'Callback failed' }, { status: 502 });
      }
    } else {
      const apiKey = process.env.RESEND_API_KEY;
      const to = process.env.LEAD_TO_EMAIL;
      const from = process.env.RESEND_FROM_EMAIL ?? 'leads@juneaudigitaldesigns.com';
      const brandName = process.env.LEAD_BRAND_NAME ?? '';
      if (!apiKey || !to) {
        return NextResponse.json({ ok: false, error: 'Resend env not set' }, { status: 500 });
      }
      const { subject, text, html } = buildLeadEmail(data as Record<string, unknown>, brandName);
      // If the lead left an email, let the owner reply straight to them.
      const leadEmail = String((data as { email?: unknown }).email ?? '').trim();
      const replyTo = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(leadEmail) ? leadEmail : undefined;
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          from,
          to,
          subject,
          text,
          html,
          ...(replyTo ? { reply_to: replyTo } : {}),
        }),
      });
      if (!res.ok) {
        console.error('[contact] Resend send failed:', res.status, await res.text());
        return NextResponse.json({ ok: false, error: 'Email delivery failed' }, { status: 502 });
      }
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'Delivery failed' }, { status: 500 });
  }
}
