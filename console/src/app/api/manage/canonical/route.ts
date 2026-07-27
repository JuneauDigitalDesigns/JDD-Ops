import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadManageTarget } from '@/lib/manageSites';
import { resolveRepoRoot, rewriteClientSchema } from '@/lib/export';
import { accountStoreConfigured, attachSiteToAccount, getAccountEmailByUserId } from '@/lib/accountStore';
import { appendAudit } from '@/lib/audit';

/**
 * Point `seo.canonical` at the domain that actually serves the site.
 *
 * The canonical lives in TWO places that must not disagree, which is why this is one
 * endpoint rather than two buttons:
 *
 *   1. clients/{slug}/site.ts — read by onboard.js and exported into the client repo,
 *      where it drives the deployed site's metadata, sitemap, robots, JSON-LD and llms.txt.
 *   2. The KV portal account record — its own copy, which is what the CLIENT sees when they
 *      sign into the portal. Leaving this stale means they get a link to a dead domain.
 *
 * Neither change reaches the live site on its own: the client repo holds a third copy at
 * repo/src/data/site.ts, so the SEO output only updates after a re-export from Build and a
 * redeploy. The response says so; the UI must repeat it.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = { slug?: string; site?: string; canonical?: string };

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const target = await loadManageTarget(body.slug ?? null, body.site ?? null);
  if (!target.ok) return NextResponse.json({ error: target.error }, { status: target.status });

  const canonical = (body.canonical ?? '').trim();
  if (!canonical) {
    return NextResponse.json({ error: 'No canonical URL given.' }, { status: 400 });
  }
  let normalized: string;
  try {
    const parsed = new URL(canonical.startsWith('http') ? canonical : `https://${canonical}`);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('bad protocol');
    // Store it bare — no trailing slash. template/src/app/robots.ts strips one anyway, and
    // structuredData uses it as a schema.org @id base where a stray slash shows up.
    normalized = `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/$/, '')}`;
  } catch {
    return NextResponse.json({ error: `"${canonical}" isn't a valid URL.` }, { status: 400 });
  }

  const { ctx, resolved } = target;
  const repoRoot = resolveRepoRoot();
  const file = resolve(repoRoot, 'clients', ctx.slug, 'site.ts');
  if (!existsSync(file)) {
    return NextResponse.json({ error: `No site.ts at clients/${ctx.slug}.` }, { status: 404 });
  }

  // ── 1. clients/{slug}/site.ts ─────────────────────────────────────────────
  // Mirrors api/build/rename-client: loadIntake normalizes every file into
  // { plan, sites }, so writing that shape back into a file that declares
  // `export const CONTENT: SiteContent` would change what the file exports. Detect
  // which declaration is on disk and serialize to match.
  const { loadIntake } = await import('@/lib/intake');
  const intake = await loadIntake(file);
  if (!intake?.sites?.length) {
    return NextResponse.json({ error: 'Could not parse site.ts.' }, { status: 422 });
  }

  const index = ctx.sites.findIndex((s) => s.slug === resolved.site.slug);
  const siteIndex = index === -1 ? 0 : index;
  const previous = (intake.sites[siteIndex]?.seo as { canonical?: string } | undefined)?.canonical ?? null;

  const updatedSite = {
    ...intake.sites[siteIndex],
    seo: { ...(intake.sites[siteIndex]?.seo ?? {}), canonical: normalized },
  };
  const sites = intake.sites.map((s, i) => (i === siteIndex ? updatedSite : s));

  const isIntakeShape = /^export\s+const\s+INTAKE\b/m.test(readFileSync(file, 'utf8'));
  const payload = isIntakeShape ? { ...intake, siteCount: sites.length, sites } : updatedSite;

  if (!rewriteClientSchema(repoRoot, ctx.slug, payload)) {
    return NextResponse.json({ error: 'Unrecognized site.ts shape.' }, { status: 422 });
  }

  appendAudit({
    slug: ctx.slug,
    siteSlug: resolved.site.slug,
    action: 'canonical.set',
    ok: true,
    summary: `Canonical set to ${normalized}${previous ? ` (was ${previous})` : ''}`,
    detail: { canonical: normalized, previous, shape: isIntakeShape ? 'INTAKE' : 'CONTENT' },
  });

  // ── 2. The portal account record ──────────────────────────────────────────
  const kv = await mirrorCanonicalToPortal(resolved.site.slug, resolved.env.CLERK_USER_ID, normalized);

  return NextResponse.json({
    ok: true,
    canonical: normalized,
    previous,
    kv,
    needsRedeploy: true,
    note: 'The live site keeps the old canonical until you re-export this client from Build and redeploy.',
  });
}

/**
 * Push the new canonical onto the client's portal record.
 *
 * Same resolution path as mirrorAirtableBase in api/manage/env: CLERK_USER_ID →
 * jdd:account-by-user: index → email. upsertSite merges only defined fields, so this
 * touches nothing else on the account. A client who hasn't signed into the portal yet
 * simply has no record — a normal state, reported as a note rather than an error.
 */
async function mirrorCanonicalToPortal(
  siteSlug: string,
  clerkUserId: string | undefined,
  canonical: string,
): Promise<{ ok: boolean; email?: string; note?: string }> {
  if (!accountStoreConfigured()) {
    return { ok: false, note: 'KV not configured — portal record not updated.' };
  }
  if (!clerkUserId) {
    return { ok: false, note: 'No CLERK_USER_ID on this site — portal record left alone.' };
  }
  try {
    const email = await getAccountEmailByUserId(clerkUserId);
    if (!email) return { ok: false, note: 'No portal account linked to this client yet.' };
    await attachSiteToAccount(email, { slug: siteSlug, canonical });
    return { ok: true, email };
  } catch (err) {
    return { ok: false, note: err instanceof Error ? err.message : 'Portal record update failed.' };
  }
}
