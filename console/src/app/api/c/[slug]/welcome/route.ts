import { NextResponse } from 'next/server';
import { SLUG_RE } from '@/lib/manageSites';
import { getClientContext } from '@/lib/clients';
import { clientRecordsConfigured, getClientRecordBySlug } from '@/lib/clientRecord';
import { getResend } from '@/lib/resend';
import { appendAudit } from '@/lib/audit';
import { buildWelcomeEmail } from '@/lib/emails/welcome-onboarding';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Send a converted lead their welcome email: a branded note whose one link goes to the portal
 * sign-up, the gate in front of agency-site onboarding.
 *
 * Sibling of /remind, which targets clients who already paid and are mid-wizard and reads the
 * pending-onboarding record. This one is for a client with no payment yet, so the recipient
 * comes from their ClientRecord (the email captured at Convert).
 *
 * Only ever fired by the operator pressing Send in Manage. It is never sent automatically.
 */
export async function POST(_req: Request, { params }: { params: { slug: string } }) {
  if (!SLUG_RE.test(params.slug)) {
    return NextResponse.json({ error: 'Invalid slug.' }, { status: 400 });
  }
  if (!clientRecordsConfigured()) {
    return NextResponse.json({ error: 'KV not configured.' }, { status: 503 });
  }

  const ctx = await getClientContext(params.slug);
  if (!ctx) return NextResponse.json({ error: 'Client not found.' }, { status: 404 });

  let email: string | null = null;
  try {
    email = (await getClientRecordBySlug(params.slug))?.email ?? null;
  } catch {
    return NextResponse.json({ error: 'KV lookup failed.' }, { status: 503 });
  }
  if (!email) {
    return NextResponse.json({ error: 'No email on file for this client.' }, { status: 400 });
  }

  const fromEmail =
    process.env.RESEND_FROM_EMAIL || 'Juneau Digital Designs <hello@juneaudigitaldesigns.com>';
  const { subject, html, text } = buildWelcomeEmail({ clientName: ctx.brandName, plan: ctx.plan });

  try {
    const result = await getResend().emails.send({ from: fromEmail, to: email, subject, html, text });
    if (result.error) {
      console.error('[welcome] Resend error', result.error);
      appendAudit({
        slug: params.slug,
        action: 'client.welcome',
        ok: false,
        summary: 'Welcome email failed to send',
      });
      return NextResponse.json({ error: result.error.message ?? 'Email send failed.' }, { status: 502 });
    }
  } catch (e) {
    console.error('[welcome] exception', e);
    appendAudit({
      slug: params.slug,
      action: 'client.welcome',
      ok: false,
      summary: 'Welcome email failed to send',
    });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Email send failed.' },
      { status: 502 },
    );
  }

  // The recipient is left out of the log on purpose: it is plaintext on disk, and an address
  // is exactly the kind of value the audit file's key-names-only rule exists to keep out.
  appendAudit({
    slug: params.slug,
    action: 'client.welcome',
    ok: true,
    summary: 'Sent the welcome email',
    detail: { plan: ctx.plan },
  });
  return NextResponse.json({ ok: true, to: email });
}
