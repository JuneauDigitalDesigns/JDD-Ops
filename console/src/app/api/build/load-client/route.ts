import { NextResponse } from 'next/server';
import { resolve } from 'node:path';
import { resolveRepoRoot, isValidSlug } from '@/lib/export';
import { loadIntake } from '@/lib/intake';

// Load an existing client's clients/<slug>/site.ts into the wizard (Step 1 → existing client).
// Reuses loadIntake (same reader onboard.js uses) and returns the first site's content.
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const slug = (new URL(req.url).searchParams.get('slug') ?? '').trim();
  if (!isValidSlug(slug)) return NextResponse.json({ error: 'Invalid slug.' }, { status: 400 });
  try {
    const repoRoot = resolveRepoRoot();
    const schemaPath = resolve(repoRoot, 'clients', slug, 'site.ts');
    const intake = await loadIntake(schemaPath);
    if (!intake || !intake.sites?.length) {
      return NextResponse.json({ error: 'No readable site.ts for this client.' }, { status: 404 });
    }
    return NextResponse.json({ plan: intake.plan, site: intake.sites[0] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load client.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
