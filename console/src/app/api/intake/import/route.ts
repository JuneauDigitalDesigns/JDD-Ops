import { NextResponse } from 'next/server';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { getIntake, markIntakeImported } from '@/lib/intakeQueue';
import { resolveRepoRoot, isValidSlug, writeClientIntake, type IntakeEnvelope } from '@/lib/export';

// Claim a queued intake: write clients/<slug>/site.ts (the INTAKE envelope onboard.js reads)
// and mark the queue item imported so it drops out of the Step 1 grid.
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { id?: unknown; slug?: unknown; overwrite?: unknown };
    const id = typeof body.id === 'string' ? body.id : '';
    const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
    const overwrite = body.overwrite === true;

    if (!id) return NextResponse.json({ error: 'Missing intake id.' }, { status: 400 });
    if (!isValidSlug(slug)) {
      return NextResponse.json({ error: 'Invalid slug (use letters, numbers, - or _).' }, { status: 400 });
    }

    const item = await getIntake(id);
    if (!item) return NextResponse.json({ error: 'Intake not found or expired.' }, { status: 404 });

    const repoRoot = resolveRepoRoot();
    const siteTsPath = resolve(repoRoot, 'clients', slug, 'site.ts');
    if (existsSync(siteTsPath) && !overwrite) {
      return NextResponse.json(
        { error: `clients/${slug}/site.ts already exists.`, needsOverwrite: true },
        { status: 409 },
      );
    }

    writeClientIntake(repoRoot, slug, item.intake as IntakeEnvelope);
    await markIntakeImported(id);
    return NextResponse.json({ ok: true, slug, plan: item.plan });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to import intake.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
