import { NextResponse } from 'next/server';
import { getClientContext, listClientContexts } from '@/lib/clients';
import { reconcileClient } from '@/lib/reconcile';
import {
  reconcileStoreConfigured,
  saveReconcileResult,
  getReconcileResult,
  getReconcileResults,
  acquireSweepLock,
  releaseSweepLock,
} from '@/lib/reconcileStore';

/**
 * Run or read a reconcile sweep.
 *
 *   GET  /api/manage/reconcile?slug=x        cached result for one client
 *   GET  /api/manage/reconcile               cached results for the whole roster
 *   POST /api/manage/reconcile { slug }      sweep one client and cache it
 *   POST /api/manage/reconcile { all: true } sweep everyone
 *
 * GET never sweeps. Reading is what the roster and the client shell do on every render, and
 * a read path that could spend six vendor API calls per client would make opening a screen
 * expensive in a way nobody would predict. Sweeping is always an explicit POST — on console
 * launch, or from "Check now".
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The console has no auth; every write path is localhost-only, same as env/reveal. */
function isLoopback(req: Request): boolean {
  const host = (req.headers.get('host') ?? '').toLowerCase();
  const hostname = host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : host.split(':')[0];
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1' ||
    hostname.endsWith('.localhost')
  );
}

export async function GET(req: Request) {
  if (!reconcileStoreConfigured()) {
    return NextResponse.json({ configured: false, results: {} });
  }

  const slug = new URL(req.url).searchParams.get('slug');
  if (slug) {
    return NextResponse.json({ configured: true, result: await getReconcileResult(slug) });
  }

  const clients = await listClientContexts({ includeFixtures: false }).catch(() => []);
  const results = await getReconcileResults(clients.map((c) => c.slug));
  return NextResponse.json({ configured: true, results });
}

export async function POST(req: Request) {
  if (!isLoopback(req)) {
    return NextResponse.json({ error: 'Available on localhost only.' }, { status: 403 });
  }
  if (!reconcileStoreConfigured()) {
    return NextResponse.json(
      { error: 'KV not configured — set KV_REST_API_URL / KV_REST_API_TOKEN in console/.env.local.' },
      { status: 500 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const slug: string | undefined = body?.slug;
  const all = body?.all === true;
  const includeFixtures = body?.fixtures === true;

  if (!slug && !all) {
    return NextResponse.json({ error: 'Pass a slug, or all: true.' }, { status: 400 });
  }

  // One lock for the whole sweep rather than one per client: the point is to stop the
  // launch sweep and a "Check now" press from running together, and they overlap at the
  // level of the run, not the client.
  const scope = all ? 'all' : `client:${slug}`;
  if (!(await acquireSweepLock(scope))) {
    return NextResponse.json(
      { error: 'A sweep is already running. Try again in a moment.', busy: true },
      { status: 409 },
    );
  }

  try {
    const targets = all
      ? await listClientContexts({ includeFixtures })
      : [await getClientContext(slug!)].filter((c): c is NonNullable<typeof c> => Boolean(c));

    if (!targets.length) {
      return NextResponse.json({ error: `No such client: ${slug}` }, { status: 404 });
    }

    const swept = [];
    for (const ctx of targets) {
      // Sequential, not Promise.all. A roster-wide sweep is already 6–10 vendor calls per
      // client; firing them all at once is the reliable way to get rate-limited by Retell
      // and Twilio at the same moment, which would turn a healthy roster into a screen full
      // of `unknown`.
      const result = await reconcileClient(ctx);
      const transitions = await saveReconcileResult(result);
      swept.push({
        slug: ctx.slug,
        checkedAt: result.checkedAt,
        findings: result.findings.length,
        unreachable: result.unreachable,
        opened: transitions.filter((t) => t.event === 'opened').length,
        closed: transitions.filter((t) => t.event === 'closed').length,
      });
    }

    return NextResponse.json({ ok: true, swept });
  } catch (err) {
    console.error('[reconcile] sweep failed', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  } finally {
    await releaseSweepLock(scope);
  }
}
