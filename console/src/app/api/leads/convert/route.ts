import { NextResponse } from 'next/server';
import { rmdirSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { getLead, leadQueueConfigured, patchLead } from '@/lib/leadQueue';
import { convertLead } from '@/lib/leadConversion';
import { isValidSlug, resolveRepoRoot, seedClientFolder } from '@/lib/export';
import { VERTICAL_PRESETS } from '@/lib/verticals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PLANS = ['starter', 'growth', 'enterprise'] as const;
type PlanId = (typeof PLANS)[number];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Turn a won lead into a client.
 *
 * Creates the shell only: a real clients/<slug>/site.ts seeded from the vertical preset, and the
 * lead <-> ClientRecord link. It does NOT provision or build. The new client stays locked out of
 * Build and Onboard until the client has onboarded on the agency site (see lib/onboardingGate).
 *
 * Email is required because it is the join key to the client's portal account, which is what
 * unlocks the client later.
 */
export async function POST(req: Request) {
  if (!leadQueueConfigured()) {
    return NextResponse.json({ error: 'Lead queue not configured.' }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof body.id === 'string' ? body.id : '';
  const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
  const plan = body.plan as PlanId;
  const vertical = typeof body.vertical === 'string' ? body.vertical : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';

  if (!id) return NextResponse.json({ error: 'id is required.' }, { status: 400 });
  if (!isValidSlug(slug)) {
    return NextResponse.json({ error: 'Invalid slug, letters, numbers, - and _ only.' }, { status: 400 });
  }
  if (!PLANS.includes(plan)) return NextResponse.json({ error: 'Pick a plan.' }, { status: 400 });
  if (!VERTICAL_PRESETS[vertical]) return NextResponse.json({ error: 'Unknown vertical.' }, { status: 400 });
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'A valid email is required to convert.' }, { status: 400 });
  }

  const lead = await getLead(id);
  if (!lead) return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
  if (lead.clientRecordId || lead.convertedSlug) {
    return NextResponse.json({ error: 'This lead has already been converted.' }, { status: 409 });
  }

  try {
    seedClientFolder({ repoRoot: resolveRepoRoot(), slug, name: lead.businessName, plan, vertical });
  } catch (e) {
    const code = (e as { code?: string }).code;
    const message = e instanceof Error ? e.message : 'Could not create the client folder.';
    if (code === 'EXISTS') return NextResponse.json({ error: message, needsSlug: true }, { status: 409 });
    return NextResponse.json({ error: message }, { status: code === 'BAD_VERTICAL' ? 400 : 500 });
  }

  try {
    let current = lead;
    if (email !== (lead.email ?? '')) {
      const withEmail = await patchLead(id, {
        email,
        activity: { kind: 'field', text: 'Email added at conversion' },
      });
      if (withEmail) current = withEmail;
    }
    const updated = await convertLead({ ...current, email }, slug, { email });
    if (!updated) return NextResponse.json({ error: 'Lead disappeared mid-convert.' }, { status: 500 });
    return NextResponse.json({ ok: true, slug, lead: updated });
  } catch (e) {
    console.error('[/api/leads/convert] link failed', e);
    // Undo the seed. A folder with no client record behind it would be an un-gated shell (the
    // gate keys off the record), and would also make a retry with the same slug 409. Only the
    // file we just wrote is removed, and the directory only if that leaves it empty.
    try {
      const dir = resolve(resolveRepoRoot(), 'clients', slug);
      unlinkSync(resolve(dir, 'site.ts'));
      rmdirSync(dir);
    } catch {
      /* best effort: a non-empty directory just stays */
    }
    return NextResponse.json(
      { error: 'The lead could not be linked to a client record, so nothing was created. Try again.' },
      { status: 500 },
    );
  }
}
