import 'server-only';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { clientsDir, clientDir } from './paths';
import { loadIntake, readEnvLocal, type RawSite } from './intake';
import type { ClientContext, ClientStatus, Plan, SiteInfo } from './types';

// Slug + dir conventions mirror onboard.js (single site = baseSlug; enterprise = baseSlug-N
// with each site under clients/{baseSlug}/site-N).
function siteSlugFor(baseSlug: string, count: number, i: number): string {
  return count === 1 ? baseSlug : `${baseSlug}-${i + 1}`;
}
function siteDirFor(baseSlug: string, count: number, i: number): string {
  return count === 1 ? clientDir(baseSlug) : resolve(clientDir(baseSlug), `site-${i + 1}`);
}

function missingFor(site: RawSite): string[] {
  return site?._meta?.missing_fields ?? site?._meta?.missingFields ?? [];
}

function buildSiteInfo(baseSlug: string, count: number, i: number, site: RawSite): SiteInfo {
  const slug = siteSlugFor(baseSlug, count, i);
  const dir = siteDirFor(baseSlug, count, i);
  const env = readEnvLocal(dir);
  return {
    slug,
    brandName: site?.brand?.name ?? slug,
    brandShort: site?.brand?.short ?? null,
    canonical: site?.seo?.canonical ?? null,
    repoBuilt: existsSync(resolve(dir, 'repo')),
    env,
    missingFields: missingFor(site),
  };
}

function isProvisioned(plan: Plan, s: SiteInfo): boolean {
  if (plan === 'starter') return Boolean(s.env.VERCEL_PROJECT_NAME);
  return Boolean(s.env.RETELL_AGENT_ID && s.env.TWILIO_NUMBER && s.env.AIRTABLE_BASE_ID);
}

function isCallbackWired(plan: Plan, s: SiteInfo): boolean {
  if (plan === 'starter') return true; // starter has no Make scenario
  return Boolean(s.env.MAKE_WEBHOOK_URL);
}

function deriveStatus(plan: Plan, sites: SiteInfo[]): ClientStatus {
  if (sites.some((s) => !s.repoBuilt)) return 'needs-build';
  if (!sites.every((s) => isProvisioned(plan, s))) return 'ready';
  if (!sites.every((s) => isCallbackWired(plan, s))) return 'provisioned';
  return 'portal-pending';
}

/** Build the full client context for one base slug (or null if no readable intake). */
export async function getClientContext(baseSlug: string): Promise<ClientContext | null> {
  const schemaAbs = resolve(clientDir(baseSlug), 'site.ts');
  const intake = await loadIntake(schemaAbs);
  const hasIntake = Boolean(intake);

  if (!intake) {
    // Folder exists but no readable site.ts — surface it as an unknown/needs-build stub.
    const repoBuilt = existsSync(resolve(clientDir(baseSlug), 'repo'));
    return {
      slug: baseSlug,
      plan: 'growth',
      brandName: baseSlug,
      isEnterprise: false,
      repoBuilt,
      detectedStatus: repoBuilt ? 'ready' : 'needs-build',
      schemaPath: `clients/${baseSlug}/site.ts`,
      hasIntake: false,
      sites: [],
    };
  }

  const plan = intake.plan;
  const count = intake.sites.length;
  const sites = intake.sites.map((site, i) => buildSiteInfo(baseSlug, count, i, site));
  const isEnterprise = plan === 'enterprise' || count > 1;

  return {
    slug: baseSlug,
    plan,
    brandName: sites[0]?.brandName ?? baseSlug,
    isEnterprise,
    repoBuilt: sites.every((s) => s.repoBuilt),
    detectedStatus: deriveStatus(plan, sites),
    schemaPath: `clients/${baseSlug}/site.ts`,
    hasIntake,
    sites,
  };
}

/** List every client folder under clients/ (skipping dotfiles and _e2e fixtures hidden by default). */
export async function listClientContexts(): Promise<ClientContext[]> {
  const dir = clientsDir();
  if (!existsSync(dir)) return [];
  const slugs = readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .map((d) => d.name)
    .sort();

  const out: ClientContext[] = [];
  for (const slug of slugs) {
    const ctx = await getClientContext(slug);
    if (ctx) out.push(ctx);
  }
  return out;
}
