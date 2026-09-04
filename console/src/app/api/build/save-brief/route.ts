import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NextResponse, type NextRequest } from 'next/server';
import { clientDir } from '@/lib/paths';
import { loadIntake } from '@/lib/intake';
import { resolveRepoRoot, rewriteClientSchema } from '@/lib/export';

/**
 * Persist the Intake Brief stage's inputs to `_meta.copyBrief` on `clients/{slug}/site.ts`.
 *
 * Unlike save-draft (which writes the whole wizard bundle to `.draft.json`, deleted on a
 * successful export), the brief has to survive past launch — an operator revisiting a live
 * client's Build route to regenerate one section should see the brief they built the first
 * time, not a blank one. So this writes into the durable file, not the draft.
 *
 * Mirrors api/manage/canonical exactly for the "which export shape is this file" problem:
 * loadIntake() normalizes both `export const INTAKE = {...}` and `export const CONTENT = {...}`
 * files into `{ plan, sites }`, so writing that normalized shape back into a CONTENT file
 * would change what it exports. Detect the declaration on disk and serialize to match.
 *
 * Scoped to `sites[0]`, matching the Build route's own existing scope — `build/page.tsx` reads
 * `intake?.sites?.[0]` unconditionally today, with no per-site selection for enterprise
 * clusters. This route doesn't newly narrow anything; it just doesn't widen past what the
 * route it serves already handles.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { slug?: unknown; brief?: unknown };
  const { slug, brief } = body;

  if (!slug || typeof slug !== 'string' || !brief || typeof brief !== 'object') {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }
  // Guard: only write for clients whose directory already exists — never create dirs here.
  if (!existsSync(clientDir(slug))) {
    return NextResponse.json({ error: 'client not found' }, { status: 404 });
  }

  const repoRoot = resolveRepoRoot();
  const file = resolve(clientDir(slug), 'site.ts');
  if (!existsSync(file)) {
    return NextResponse.json({ error: 'no site.ts for this client' }, { status: 404 });
  }

  const intake = await loadIntake(file);
  if (!intake?.sites?.length) {
    return NextResponse.json({ error: 'could not parse site.ts' }, { status: 422 });
  }

  const updatedSite = {
    ...intake.sites[0],
    _meta: { ...intake.sites[0]._meta, copyBrief: brief },
  };
  const sites = intake.sites.map((s, i) => (i === 0 ? updatedSite : s));

  const isIntakeShape = /^export\s+const\s+INTAKE\b/m.test(readFileSync(file, 'utf8'));
  const payload = isIntakeShape ? { ...intake, siteCount: sites.length, sites } : updatedSite;

  if (!rewriteClientSchema(repoRoot, slug, payload)) {
    return NextResponse.json({ error: 'unrecognized site.ts shape' }, { status: 422 });
  }

  return NextResponse.json({ ok: true });
}
