import { NextResponse } from 'next/server';
import { SLUG_RE } from '@/lib/manageSites';
import { getPendingOnboardRecord, pendingKvConfigured } from '@/lib/pendingKv';
import { getResend } from '@/lib/resend';
import { buildOnboardingReminderEmail } from '@/lib/emails/onboarding-reminder';

export async function POST(
  _req: Request,
  { params }: { params: { slug: string } },
) {
  if (!SLUG_RE.test(params.slug)) {
    return NextResponse.json({ error: 'Invalid slug.' }, { status: 400 });
  }

  if (!pendingKvConfigured()) {
    return NextResponse.json({ error: 'KV not configured.' }, { status: 503 });
  }

  let record;
  try {
    record = await getPendingOnboardRecord(params.slug);
  } catch (e) {
    return NextResponse.json({ error: 'KV lookup failed.' }, { status: 503 });
  }

  if (!record) {
    return NextResponse.json({ error: 'No pending onboarding record found for this client.' }, { status: 404 });
  }

  if (!record.signerEmail) {
    return NextResponse.json({ error: 'No signer email on record — cannot send reminder.' }, { status: 400 });
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Juneau Digital Designs <hello@juneaudigitaldesigns.com>';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://juneaudigitaldesigns.com';

  const { subject, html, text } = buildOnboardingReminderEmail({
    signerName: record.signerName || record.name,
    signerEmail: record.signerEmail,
    sessionId: record.sessionId,
    brandName: record.name,
    plan: record.plan,
    siteUrl,
  });

  try {
    const resend = getResend();
    const result = await resend.emails.send({
      from: fromEmail,
      to: record.signerEmail,
      subject,
      html,
      text,
    });
    if (result.error) {
      console.error('[remind] Resend error', result.error);
      return NextResponse.json({ error: result.error.message ?? 'Email send failed.' }, { status: 502 });
    }
    return NextResponse.json({ ok: true, to: record.signerEmail });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Email send failed.';
    console.error('[remind] exception', e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
