import { NextResponse } from 'next/server';
import { isValidSlug, repoDirFor, repoExists, resolveRepoRoot } from '@/lib/export';
import { planSharedLibUpgrade } from '@/lib/sharedLibs';
import { loadUiPinRules } from '@/lib/uiPinRules';

/**
 * What an export would change in a client repo's shared libraries, before it runs.
 *
 * Read-only. The Launch/Re-export and Deploy dialogs call it when they open so the operator sees
 * the whole update — pin, lockfile, refreshed template files, rewritten routes — before choosing
 * to confirm it. The export route computes the same plan again at run time and refuses unless the
 * confirmation names exactly that change.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const slug = (new URL(req.url).searchParams.get('slug') ?? '').trim();
  if (!slug || !isValidSlug(slug)) {
    return NextResponse.json({ error: 'A valid client slug is required.' }, { status: 400 });
  }
  try {
    const root = resolveRepoRoot();
    if (!repoExists(root, slug)) return NextResponse.json({ uiUpgrade: null });
    const uiUpgrade = planSharedLibUpgrade({
      opsRoot: root,
      repoDir: repoDirFor(root, slug),
      rules: await loadUiPinRules(),
    });
    return NextResponse.json({ uiUpgrade });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not read the repo’s shared libraries.' },
      { status: 500 },
    );
  }
}
