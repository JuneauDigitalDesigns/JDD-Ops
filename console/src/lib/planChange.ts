import 'server-only';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveRepoRoot, rewriteClientSchema } from './export';
import { withPlan, type RawIntake, type RawSite } from './intake';
import { accountStoreConfigured, attachSiteToAccount, getAccountEmailByUserId } from './accountStore';
import { loadVercelCredentials } from './opsSecrets';
import { loadVercelSync, type Deployment, type SyncResult } from './vercelSync';
import type { ClientContext, Plan } from './types';

/**
 * The shared half of changing a client's plan tier — everything both the upgrade and the
 * downgrade route do identically, so the two can't drift into disagreeing about where a
 * plan is stored.
 *
 * A plan lives in FOUR places, and all four have to move together:
 *   1. clients/{slug}/site.ts — the envelope's `plan`, read by onboard.js.
 *   2. …and each site's `_meta.selectedPlan`, which is what the Build studio's
 *      buildCategories() reads to pick email- vs phone-capture components. Writing only
 *      the envelope leaves the studio showing the old tier's catalog.
 *   3. clients/{slug}/.env.local — LEAD_DELIVERY_MODE and the keys that mode needs.
 *   4. The KV portal account record's PortalSite.plan, which is what the CLIENT sees.
 *
 * Only (1) and (2) are handled here as one operation because they're one file write;
 * (3) is the caller's, since the two directions need different key sets; (4) and the
 * Vercel push are the two helpers below.
 */

/** Where a client's schema lives, and whether it's there at all. */
export function schemaPathFor(slug: string): { repoRoot: string; file: string; exists: boolean } {
  const repoRoot = resolveRepoRoot();
  const file = resolve(repoRoot, 'clients', slug, 'site.ts');
  return { repoRoot, file, exists: existsSync(file) };
}

/**
 * Write a new plan into clients/{slug}/site.ts, preserving the file's declaration shape.
 *
 * Same two-shape problem canonical/route.ts solves: loadIntake normalizes every file into
 * `{ plan, sites }`, but writing that shape back into a file that declares
 * `export const CONTENT: SiteContent` would change what the file exports. Detect which
 * declaration is on disk and serialize to match.
 *
 * Returns the shape written, or null if the file has no recognized export.
 */
export function writePlanToSchema(
  repoRoot: string,
  file: string,
  slug: string,
  intake: RawIntake,
  plan: Plan,
): 'INTAKE' | 'CONTENT' | null {
  // withPlan() stamps _meta.selectedPlan; it's the same helper the Build load route uses,
  // so the value lands in exactly the field the studio reads.
  const sites = intake.sites.map((s) => withPlan(s, plan) as RawSite);
  const isIntakeShape = /^export\s+const\s+INTAKE\b/m.test(readFileSync(file, 'utf8'));
  const payload = isIntakeShape ? { ...intake, plan, siteCount: sites.length, sites } : sites[0];
  if (!rewriteClientSchema(repoRoot, slug, payload)) return null;
  return isIntakeShape ? 'INTAKE' : 'CONTENT';
}

/**
 * Push the new plan onto the client's portal account record.
 *
 * Same resolution path as mirrorAirtableBase in api/manage/env and mirrorCanonicalToPortal
 * in api/manage/canonical: CLERK_USER_ID → jdd:account-by-user: index → email. upsertSite
 * merges only the fields we pass, so `airtableBaseId` and everything else on the record are
 * left alone — which is what keeps a downgrade from also unlinking the client's call log.
 * A client who hasn't signed into the portal yet simply has no record: a normal state,
 * reported as a note rather than an error.
 */
export async function mirrorPlanToPortal(
  siteSlug: string,
  clerkUserId: string | undefined,
  plan: Plan,
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
    await attachSiteToAccount(email, { slug: siteSlug, plan });
    return { ok: true, email };
  } catch (err) {
    return { ok: false, note: err instanceof Error ? err.message : 'Portal record update failed.' };
  }
}

export interface EnvPushResult {
  synced: SyncResult | null;
  syncError?: string;
  redeploy: { ok: boolean; deployment?: Deployment; error?: string };
}

/**
 * Sync .env.local to Vercel and immediately redeploy.
 *
 * Everywhere else in /manage these are two buttons on purpose — env edits are cheap, and
 * rebuilding a live client site is not. A plan change is the one case where they belong
 * together: LEAD_DELIVERY_MODE decides which branch of /api/contact runs, so a plan that
 * reaches disk but not the deployment leaves the live site capturing leads the wrong way
 * with nothing in the UI to say so.
 *
 * Never throws. Each failure mode comes back as a field, because the disk write and the
 * schema rewrite have already happened by the time this runs and the caller still needs to
 * report those as successful — same tolerance api/manage/env has for a failed push.
 *
 * ⚠ Keys cleared to '' on disk are NOT removed from Vercel: syncEnvToVercel skips empty
 * values and vercel-sync.js exposes no delete. Callers that clear keys must say so.
 */
export async function pushEnvAndRedeploy(opts: {
  siteSlug: string;
  dir: string;
  brandName?: string;
}): Promise<EnvPushResult> {
  const { siteSlug, dir, brandName } = opts;

  if (!loadVercelCredentials()) {
    return {
      synced: null,
      syncError: 'VERCEL_TOKEN is not set in jdd-ops/.env — wrote to disk only.',
      redeploy: { ok: false, error: 'Skipped — no Vercel credentials.' },
    };
  }

  let synced: SyncResult;
  try {
    const { syncEnvToVercel } = await loadVercelSync();
    synced = await syncEnvToVercel({
      slug: siteSlug,
      clientDir: dir,
      // Matches scripts/sync-vercel-env.js and api/manage/env, which also inject the brand.
      extraEnv: brandName ? { NEXT_PUBLIC_BRAND_NAME: brandName } : {},
      log: () => {},
    });
  } catch (err) {
    return {
      synced: null,
      syncError: err instanceof Error ? err.message : 'Vercel sync failed.',
      // Deliberately not attempted: redeploying with the old env would bake in the old plan.
      redeploy: { ok: false, error: 'Skipped — the env sync failed, so a deploy would ship the old plan.' },
    };
  }

  try {
    const { triggerRedeploy } = await loadVercelSync();
    const deployment = await triggerRedeploy({ slug: siteSlug, log: () => {} });
    return { synced, redeploy: { ok: true, deployment } };
  } catch (err) {
    return {
      synced,
      redeploy: { ok: false, error: err instanceof Error ? err.message : 'Redeploy failed.' },
    };
  }
}

/** brand fields the env templates need. RawSite types `brand` loosely, so read it narrowly. */
export function brandContact(site: RawSite | undefined): { name?: string; email?: string; phone?: string } {
  const brand = site?.brand as { name?: string; email?: string; phone?: string } | undefined;
  return {
    name: brand?.name,
    email: brand?.email,
    phone: brand?.phone,
  };
}

/**
 * Shared guard: is this client's plan editable from the console at all?
 *
 * Only starter ↔ growth. onboard.js enforces `plan === 'enterprise'` ⟺ 2–3 sites, so
 * crossing into or out of enterprise means adding or removing whole client sites — a
 * provisioning operation, not a field edit. The stub context getClientContext returns for
 * a folder with no readable site.ts also reports `plan: 'growth'`, which must not be
 * mistaken for a real growth client.
 */
export function planEditError(ctx: ClientContext, target: Plan): string | null {
  if (!ctx.hasIntake) return `No readable site.ts at clients/${ctx.slug} — nothing to edit.`;
  if (ctx.isEnterprise || ctx.plan === 'enterprise') {
    return 'Enterprise plans are not editable here — the tier is tied to how many sites the client has.';
  }
  if (target === 'enterprise') {
    return 'Upgrading to enterprise means provisioning additional sites — run onboard.js instead.';
  }
  if (ctx.sites.length !== 1) {
    return `Expected exactly 1 site for a ${ctx.plan} client, found ${ctx.sites.length}.`;
  }
  if (ctx.plan === target) return `${ctx.slug} is already on the ${target} plan.`;
  return null;
}
