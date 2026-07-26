import { NextResponse } from 'next/server';
import { getClientContext, siteDirFor } from '@/lib/clients';
import { readEnvLocal } from '@/lib/intake';
import { applyEnvUpdates } from '@/lib/envFile';
import { loadVercelCredentials } from '@/lib/opsSecrets';
import { loadVercelSync, type ProjectEnv } from '@/lib/vercelSync';
import {
  LOCKED_KEYS,
  SECRET_MASK,
  fieldsForPlan,
  findField,
  isSecretKey,
  maskSecret,
  validateField,
  type EnvField,
} from '@/lib/envFields';
import { accountStoreConfigured, attachSiteToAccount, getAccountEmailByUserId } from '@/lib/accountStore';
import type { ClientContext, Plan, SiteEnv } from '@/lib/types';

/**
 * Read and edit a client's env vars without opening the Vercel dashboard.
 *
 * GET  — the client's .env.local, split into curated fields / advanced keys / locked keys,
 *        plus a drift comparison against what Vercel currently holds.
 * POST — validate, write clients/{slug}/.env.local, then push to Vercel via the same
 *        syncEnvToVercel that onboard.js step 9 and `npm run sync-env` use.
 *
 * Disk is written first and always: onboard.js regenerates .env.local on every run and
 * preserves existing values, so a Vercel-only edit would be reverted by the next
 * re-provision. Applying the change still needs a deployment — see ./redeploy.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SLUG_RE = /^[A-Za-z0-9_-]+$/;
const ENV_KEY_RE = /^[A-Z][A-Z0-9_]*$/;

type DriftState = 'in-sync' | 'differs' | 'missing-remote' | 'remote-only' | 'unknown';

interface FieldView extends EnvField {
  value: string; // masked for secrets
  masked: boolean;
}

interface RawView {
  key: string;
  value: string;
  masked: boolean;
  secret: boolean;
}

interface SiteView {
  slug: string;
  brandName: string;
  envExists: boolean;
  fields: FieldView[];
  advanced: RawView[];
  locked: RawView[];
  vercel: {
    ok: boolean;
    projectName: string;
    reason?: string;
    drift: Array<{ key: string; state: DriftState }>;
  };
}

/** Curated fields for the plan, hydrated with the value on disk (secrets masked). */
function fieldViews(plan: Plan, env: SiteEnv): FieldView[] {
  return fieldsForPlan(plan).map((f) => {
    const raw = env[f.key] ?? '';
    const masked = Boolean(f.secret) && raw.length > 0;
    return { ...f, value: masked ? maskSecret(raw) : raw, masked };
  });
}

/** Everything else on disk: free-text in the advanced drawer, or read-only if locked. */
function rawViews(env: SiteEnv, locked: boolean): RawView[] {
  return Object.entries(env)
    .filter(([key]) => LOCKED_KEYS.has(key) === locked)
    .filter(([key]) => locked || !findField(key))
    .map(([key, value]) => {
      const secret = isSecretKey(key);
      const v = value ?? '';
      return { key, value: secret && v ? maskSecret(v) : v, masked: secret && Boolean(v), secret };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Compare disk against Vercel. Only keys whose plaintext we asked for come back
 * readable; the rest report 'unknown' ("set on Vercel") rather than a misleading
 * 'differs'. Master credentials are deliberately in that second group.
 */
function driftFor(env: SiteEnv, remote: ProjectEnv): Array<{ key: string; state: DriftState }> {
  const out: Array<{ key: string; state: DriftState }> = [];
  if (!remote.ok) return out;

  for (const [key, value] of Object.entries(env)) {
    if (!value) continue;
    const hit = remote.vars[key];
    if (!hit) {
      out.push({ key, state: 'missing-remote' });
    } else if (!hit.decrypted || hit.value === null) {
      out.push({ key, state: 'unknown' });
    } else {
      out.push({ key, state: hit.value === value ? 'in-sync' : 'differs' });
    }
  }
  for (const key of Object.keys(remote.vars)) {
    // NEXT_PUBLIC_BRAND_NAME is injected at sync time, never stored on disk.
    if (!(key in env) && key !== 'NEXT_PUBLIC_BRAND_NAME') out.push({ key, state: 'remote-only' });
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

/** clients/{slug} or clients/{slug}/site-N, matching onboard.js's layout. */
function dirForSite(ctx: ClientContext, siteSlug: string): string | null {
  const i = ctx.sites.findIndex((s) => s.slug === siteSlug);
  if (i === -1) return null;
  return siteDirFor(ctx.slug, ctx.sites.length, i);
}

export async function GET(req: Request) {
  const slug = (new URL(req.url).searchParams.get('slug') ?? '').trim();
  if (!slug || !SLUG_RE.test(slug)) {
    return NextResponse.json({ error: 'Invalid or missing client slug.' }, { status: 400 });
  }

  const ctx = await getClientContext(slug);
  if (!ctx || !ctx.hasIntake) {
    return NextResponse.json({ error: `No intake at clients/${slug}/site.ts` }, { status: 404 });
  }

  const hasVercel = loadVercelCredentials();
  const vercel = hasVercel ? await loadVercelSync() : null;

  const sites: SiteView[] = [];
  for (let i = 0; i < ctx.sites.length; i++) {
    const site = ctx.sites[i];
    const env = readEnvLocal(siteDirFor(ctx.slug, ctx.sites.length, i));

    let remote: ProjectEnv = {
      ok: false,
      projectName: site.slug,
      reason: 'VERCEL_TOKEN is not set in jdd-ops/.env',
      vars: {},
    };
    if (vercel) {
      try {
        // One extra request per key, so resolve only what we can meaningfully compare:
        // non-secret keys that exist on disk. Master credentials stay unfetched.
        const resolveKeys = Object.keys(env).filter((k) => env[k] && !isSecretKey(k));
        remote = await vercel.listProjectEnv(site.slug, { resolveKeys });
      } catch (err) {
        remote = {
          ok: false,
          projectName: site.slug,
          reason: err instanceof Error ? err.message : 'Vercel lookup failed',
          vars: {},
        };
      }
    }

    sites.push({
      slug: site.slug,
      brandName: site.brandName,
      envExists: Object.keys(env).length > 0,
      fields: fieldViews(ctx.plan, env),
      advanced: rawViews(env, false),
      locked: rawViews(env, true),
      vercel: {
        ok: remote.ok,
        projectName: remote.projectName,
        reason: remote.reason,
        drift: driftFor(env, remote),
      },
    });
  }

  return NextResponse.json({
    slug: ctx.slug,
    plan: ctx.plan,
    brandName: ctx.brandName,
    vercelConfigured: hasVercel,
    sites,
  });
}

type PostBody = {
  slug?: string;
  siteSlug?: string;
  updates?: Record<string, string>;
  sync?: boolean;
};

/**
 * Validate one submitted key. Curated keys go through their field rules; advanced keys
 * only have to be a plausible env name with a single-line value. Returns null to mean
 * "skip this key" (an untouched secret mask).
 */
function resolveUpdate(
  key: string,
  raw: string,
  env: SiteEnv,
): { value: string } | { error: string } | null {
  if (LOCKED_KEYS.has(key)) {
    return { error: `${key} is managed by onboard.js and can’t be edited here.` };
  }

  const field = findField(key);
  if (field?.secret && raw.startsWith(SECRET_MASK)) return null;
  if (isSecretKey(key) && raw.startsWith(SECRET_MASK)) return null;

  if (field) {
    const result = validateField(field, raw);
    return result.ok ? { value: result.value } : { error: result.error };
  }

  if (!ENV_KEY_RE.test(key)) {
    return { error: `“${key}” isn’t a valid env var name.` };
  }
  const value = raw.trim();
  if (/[\r\n]/.test(value)) return { error: `${key} can’t contain a line break.` };
  if (value === (env[key] ?? '')) return null;
  return { value };
}

export async function POST(req: Request) {
  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const slug = (body.slug ?? '').trim();
  const siteSlug = (body.siteSlug ?? '').trim() || slug;
  const updates = body.updates ?? {};
  const sync = body.sync !== false;

  if (!SLUG_RE.test(slug) || !SLUG_RE.test(siteSlug)) {
    return NextResponse.json({ error: 'Invalid client slug.' }, { status: 400 });
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No changes submitted.' }, { status: 400 });
  }

  const ctx = await getClientContext(slug);
  if (!ctx || !ctx.hasIntake) {
    return NextResponse.json({ error: `No intake at clients/${slug}/site.ts` }, { status: 404 });
  }
  const dir = dirForSite(ctx, siteSlug);
  if (!dir) {
    return NextResponse.json({ error: `${siteSlug} is not a site of ${slug}.` }, { status: 400 });
  }

  // Validate everything before touching disk, so a bad field can't leave a half-write.
  const env = readEnvLocal(dir);
  const resolved: Record<string, string> = {};
  const errors: Array<{ key: string; error: string }> = [];
  for (const [key, raw] of Object.entries(updates)) {
    const result = resolveUpdate(key, String(raw ?? ''), env);
    if (result === null) continue;
    if ('error' in result) errors.push({ key, error: result.error });
    else resolved[key] = result.value;
  }
  if (errors.length) {
    return NextResponse.json({ error: errors[0].error, errors }, { status: 400 });
  }
  if (Object.keys(resolved).length === 0) {
    return NextResponse.json({ ok: true, written: { updated: [], added: [] }, noop: true });
  }

  const written = applyEnvUpdates(dir, resolved);
  const changed = [...written.updated, ...written.added];

  // Mirror AIRTABLE_BASE_ID onto the portal account record. The portal reads
  // PortalSite.airtableBaseId, not .env.local — changing only one side points the
  // client's call log at a base that no longer receives their calls.
  let kv: { ok: boolean; email?: string; note?: string } | undefined;
  if (changed.includes('AIRTABLE_BASE_ID')) {
    kv = await mirrorAirtableBase(ctx, siteSlug, env, resolved.AIRTABLE_BASE_ID);
  }

  if (!sync) {
    return NextResponse.json({ ok: true, written, kv, synced: null, needsRedeploy: false });
  }

  if (!loadVercelCredentials()) {
    return NextResponse.json({
      ok: true,
      written,
      kv,
      synced: null,
      syncError: 'VERCEL_TOKEN is not set in jdd-ops/.env — wrote to disk only.',
      needsRedeploy: false,
    });
  }

  try {
    const { syncEnvToVercel } = await loadVercelSync();
    const site = ctx.sites.find((s) => s.slug === siteSlug);
    const result = await syncEnvToVercel({
      slug: siteSlug,
      clientDir: dir,
      // Matches scripts/sync-vercel-env.js, which also injects the brand name.
      extraEnv: site?.brandName ? { NEXT_PUBLIC_BRAND_NAME: site.brandName } : {},
      log: () => {},
    });
    return NextResponse.json({
      ok: true,
      written,
      kv,
      synced: result,
      needsRedeploy: result.created.length > 0 || result.updated.length > 0,
    });
  } catch (err) {
    return NextResponse.json({
      ok: true, // disk write succeeded; only the push failed
      written,
      kv,
      synced: null,
      syncError: err instanceof Error ? err.message : 'Vercel sync failed.',
      needsRedeploy: false,
    });
  }
}

/**
 * Push a new Airtable base id onto the client's portal account record. The account is
 * found through the CLERK_USER_ID in .env.local → `jdd:account-by-user:` index; if the
 * client hasn't signed into the portal yet there's nothing to update, which is fine.
 */
async function mirrorAirtableBase(
  ctx: ClientContext,
  siteSlug: string,
  env: SiteEnv,
  baseId: string,
): Promise<{ ok: boolean; email?: string; note?: string }> {
  if (!accountStoreConfigured()) {
    return { ok: false, note: 'KV not configured — portal account record not updated.' };
  }
  const clerkUserId = env.CLERK_USER_ID;
  if (!clerkUserId) {
    return { ok: false, note: 'No CLERK_USER_ID on this client — portal record left alone.' };
  }
  try {
    const email = await getAccountEmailByUserId(clerkUserId);
    if (!email) {
      return { ok: false, note: 'No portal account linked to this client yet.' };
    }
    await attachSiteToAccount(email, { slug: siteSlug, airtableBaseId: baseId || null });
    return { ok: true, email };
  } catch (err) {
    return { ok: false, note: err instanceof Error ? err.message : 'Portal record update failed.' };
  }
}
