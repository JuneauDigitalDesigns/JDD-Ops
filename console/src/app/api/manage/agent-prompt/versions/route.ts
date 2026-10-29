import { NextResponse } from 'next/server';
import { loadManageTarget } from '@/lib/manageSites';
import { getPromptVersion, listPromptVersions } from '@/lib/promptVersions';

/**
 * The agent prompt's history.
 *
 * Read-only on purpose. Restoring is not a route: the editor loads a past version into the
 * textarea and the operator saves or pushes it through the normal path, so a revert goes
 * through the same confirmation — and the same audit entry — as any other change to what a
 * live phone agent says. A one-click "restore and push" would make the most destructive
 * action the cheapest one on the screen.
 *
 * Gated on `isWebOnly`, NOT on `plan === 'starter'`. Since the 2026-10-12 reprice every tier
 * includes the receptionist; what gates the voice stack is the receptionist mode.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const target = await loadManageTarget(url.searchParams.get('slug'), url.searchParams.get('site'));
  if (!target.ok) return NextResponse.json({ error: target.error }, { status: target.status });

  const { ctx, resolved } = target;
  if (ctx.isWebOnly) {
    return NextResponse.json({ error: 'This client declined the receptionist — no voice agent.' }, { status: 400 });
  }

  const id = url.searchParams.get('id');
  if (id) {
    const version = getPromptVersion(ctx.slug, resolved.site.slug, id);
    if (!version) return NextResponse.json({ error: 'No such version.' }, { status: 404 });
    return NextResponse.json({ version });
  }

  return NextResponse.json({ versions: listPromptVersions(ctx.slug, resolved.site.slug) });
}
