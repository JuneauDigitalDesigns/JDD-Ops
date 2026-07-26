import { NextResponse } from 'next/server';
import { resolve } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { resolveRepoRoot, isValidSlug, rewriteClientSchema } from '@/lib/export';

// Rename a client's *display name* (brand.name) in clients/<slug>/site.ts.
//
// The slug itself is deliberately immutable: it is simultaneously the clients/<slug>
// folder, the GitHub repo name, the Vercel project name, and the source of the Twilio
// voiceUrl host, so renaming it post-provisioning would orphan all four.
//
// This writes straight to disk — unlike the rest of the wizard, which stages edits in
// localStorage until export — because Step 1's card list reads from disk. It does NOT
// touch an already-exported clients/<slug>/repo; re-export from Step 4 does that.
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { slug?: string; name?: string };
    const slug = (body.slug ?? '').trim();
    const name = (body.name ?? '').trim();

    if (!isValidSlug(slug)) return NextResponse.json({ error: 'Invalid slug.' }, { status: 400 });
    if (!name) return NextResponse.json({ error: 'Name cannot be empty.' }, { status: 400 });

    const repoRoot = resolveRepoRoot();
    const file = resolve(repoRoot, 'clients', slug, 'site.ts');
    if (!existsSync(file)) {
      return NextResponse.json({ error: 'No site.ts for this client.' }, { status: 404 });
    }

    // Re-read through loadIntake's parser so we mutate the same normalized object it
    // produces, then write back in whichever shape the file already uses.
    const { loadIntake } = await import('@/lib/intake');
    const intake = await loadIntake(file);
    if (!intake || !intake.sites?.length) {
      return NextResponse.json({ error: 'Could not parse site.ts.' }, { status: 422 });
    }

    // Which export is on disk decides what we serialize back: the whole INTAKE envelope,
    // or just the single site object as CONTENT.
    const isIntakeShape = /^export\s+const\s+INTAKE\b/m.test(readFileSync(file, 'utf8'));

    const site = { ...intake.sites[0], brand: { ...(intake.sites[0].brand ?? {}), name } };
    const payload = isIntakeShape
      ? { ...intake, siteCount: intake.sites.length, sites: [site, ...intake.sites.slice(1)] }
      : site;

    if (!rewriteClientSchema(repoRoot, slug, payload)) {
      return NextResponse.json({ error: 'Unrecognized site.ts shape.' }, { status: 422 });
    }
    return NextResponse.json({ ok: true, slug, name });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Rename failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
