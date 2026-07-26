import { NextResponse } from 'next/server';
import { loadManageTarget } from '@/lib/manageSites';
import { loadVercelCredentials } from '@/lib/opsSecrets';
import { loadVercelSync } from '@/lib/vercelSync';
import { applyEnvUpdates } from '@/lib/envFile';
import { appendAudit } from '@/lib/audit';

/**
 * Resolve drift on one key, in whichever direction the operator picks.
 *
 * The two directions are deliberately asymmetric, because the underlying module is:
 *
 *   pull — genuinely per-key. listProjectEnv can decrypt a single named key, and we write
 *          just that one line back to .env.local.
 *   push — syncs the WHOLE file. vercel-sync.js keeps upsertEnvVar private and only
 *          exposes syncEnvToVercel, and pushing everything is idempotent anyway. The UI
 *          says "push all of this site's vars" rather than implying a single-key write.
 *
 * Pull writes disk, which is why it is scoped tight: disk is the source of truth that
 * onboard.js regenerates from, so an over-broad pull could quietly clobber local edits.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ENV_KEY_RE = /^[A-Z][A-Z0-9_]*$/;

type Body = { slug?: string; site?: string; key?: string; direction?: 'push' | 'pull' };

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const target = await loadManageTarget(body.slug ?? null, body.site ?? null);
  if (!target.ok) return NextResponse.json({ error: target.error }, { status: target.status });

  const key = (body.key ?? '').trim();
  if (!key || !ENV_KEY_RE.test(key)) {
    return NextResponse.json({ error: 'Invalid or missing env key.' }, { status: 400 });
  }
  const direction = body.direction === 'pull' ? 'pull' : 'push';

  if (!loadVercelCredentials()) {
    return NextResponse.json(
      { error: 'VERCEL_TOKEN is not set in jdd-ops/.env.' },
      { status: 500 },
    );
  }

  const { ctx, resolved } = target;
  const vercel = await loadVercelSync();

  try {
    if (direction === 'pull') {
      const remote = await vercel.listProjectEnv(resolved.site.slug, { resolveKeys: [key] });
      if (!remote.ok) {
        return NextResponse.json({ error: remote.reason ?? 'Vercel lookup failed.' }, { status: 502 });
      }
      const hit = remote.vars[key];
      if (!hit) {
        return NextResponse.json({ error: `${key} is not set on Vercel.` }, { status: 404 });
      }
      if (!hit.decrypted || hit.value === null) {
        return NextResponse.json(
          { error: `Vercel would not return a readable value for ${key}.` },
          { status: 502 },
        );
      }

      const written = applyEnvUpdates(resolved.dir, { [key]: hit.value });
      appendAudit({
        slug: ctx.slug,
        siteSlug: resolved.site.slug,
        action: 'env.pull',
        ok: true,
        summary: `Pulled ${key} from Vercel to .env.local`,
        detail: { key },
      });
      return NextResponse.json({ ok: true, direction, key, written });
    }

    const result = await vercel.syncEnvToVercel({
      slug: resolved.site.slug,
      clientDir: resolved.dir,
      extraEnv: resolved.site.brandName ? { NEXT_PUBLIC_BRAND_NAME: resolved.site.brandName } : {},
      log: () => {},
    });
    appendAudit({
      slug: ctx.slug,
      siteSlug: resolved.site.slug,
      action: 'env.sync',
      ok: true,
      summary: `Pushed local env to Vercel (triggered by ${key}) — ${result.created.length} created, ${result.updated.length} updated`,
      detail: { trigger: key, created: result.created, updated: result.updated },
    });
    return NextResponse.json({ ok: true, direction, key, synced: result, needsRedeploy: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed.';
    appendAudit({
      slug: ctx.slug,
      siteSlug: resolved.site.slug,
      action: direction === 'pull' ? 'env.pull' : 'env.sync',
      ok: false,
      summary: message,
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
