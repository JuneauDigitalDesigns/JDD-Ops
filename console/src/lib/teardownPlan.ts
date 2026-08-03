import 'server-only';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { clientDir } from './paths';
import { getClientContext, listClientContexts, siteDirFor } from './clients';
import { loadVercelCredentials, loadRetellApiKey, loadGithubToken, loadMakeApiKey, loadTeardownCredentials } from './opsSecrets';
import { loadVercelSync } from './vercelSync';
import { loadTeardownOps } from './teardownOps';
import { accountStoreConfigured, getAccount, getAccountEmailByUserId } from './accountStore';
import type { ArchiveOrphan, ArchiveSiteIdentifiers } from './archive';
import type { ClientContext, Plan } from './types';

/**
 * The teardown preview — what actually exists, verified rather than assumed, and what
 * that verification means for the three buckets the Danger section shows: what will be
 * destroyed, what will be left behind, and what's irreversible.
 *
 * Every probe is a real request. That is deliberate and costs real API calls, but it is
 * what makes the preview trustworthy — a list of "should exist because onboard.js records
 * say so" is not the same claim as "exists right now", and the gap between those two is
 * exactly the kind of surprise a destructive-action preview exists to prevent.
 */

const MAKE_ZONE = 'https://us2.make.com/api/v2';

export interface TeardownPlanSite {
  siteSlug: string;
  brandName: string;
  github: { repo: string; exists: boolean | null };
  vercel: {
    projectName: string;
    exists: boolean | null;
    domains: Array<{ name: string; verified: boolean; redirect: string | null; apexName: string | null }>;
    lastDeployState: string | null;
    lastDeployAt: number | null;
  };
  twilio: { number: string | null; owned: boolean | null };
  retell: { agentId: string | null; agentExists: boolean | null; llmId: string | null };
  make: {
    scenarioId: string | null;
    resolvedBy: 'env' | 'name' | 'webhook' | null;
    webhookUrl: string | null;
  };
}

export interface TeardownPlan {
  slug: string;
  brandName: string;
  plan: Plan;
  isEnterprise: boolean;
  capturedAt: string;
  /** sha256 over the resolved resource identifiers — the destroy call must echo this. */
  previewHash: string;
  sites: TeardownPlanSite[];

  airtable: {
    baseId: string | null;
    baseName: string | null;
    exists: boolean | null;
    /** Other client slugs whose .env.local points at the same base id — deletion is blocked when non-empty. */
    sharedWith: string[];
  };

  portal: {
    configured: boolean;
    email: string | null;
    clerkUserId: string | null;
    clerkResolvedBy: 'env' | 'email' | null;
    /** Sites that would remain on the account after detaching this client's — 0 means the Clerk user is deleted too. */
    remainingSitesOnAccount: number | null;
  };

  localFolder: { path: string; approxBytes: number | null };

  /** Custom domains attached and verified — these gate a second typed confirmation, not a block. */
  hasVerifiedCustomDomain: boolean;

  /** What will remain after a full teardown, with what to do about each. */
  leftBehind: ArchiveOrphan[];

  /** Missing credentials or other reasons a bucket couldn't be fully verified. */
  warnings: string[];
}

function dirSize(dir: string): number | null {
  try {
    let total = 0;
    const walk = (d: string) => {
      for (const entry of readdirSync(d, { withFileTypes: true })) {
        const p = resolve(d, entry.name);
        if (entry.isDirectory()) walk(p);
        else total += statSync(p).size;
      }
    };
    walk(dir);
    return total;
  } catch {
    return null;
  }
}

/** Stable hash over resolved identifiers only — never timestamps, so re-running the same plan against unchanged resources reproduces the same hash. */
function hashPlan(input: unknown): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

export async function buildTeardownPlan(slug: string): Promise<TeardownPlan> {
  const ctx = await getClientContext(slug);
  if (!ctx || ctx.sites.length === 0) {
    throw new Error(`No client at clients/${slug} with a readable site.ts.`);
  }

  const warnings: string[] = [];
  const hasVercel = loadVercelCredentials();
  if (!hasVercel) warnings.push('VERCEL_TOKEN not set — Vercel projects/domains could not be verified.');
  const githubToken = loadGithubToken();
  if (!githubToken) warnings.push('GITHUB_TOKEN not set — GitHub repos could not be verified.');
  const retellKey = loadRetellApiKey();
  if (!retellKey) warnings.push('RETELL_API_KEY not set — Retell agents/LLMs could not be verified.');
  const makeKey = loadMakeApiKey();
  if (!makeKey) warnings.push('MAKE_API_KEY not set — the Make.com scenario could not be resolved.');
  const { twilioAccountSid, twilioAuthToken, airtableApiKey, clerkSecretKey } = loadTeardownCredentials();
  if (!twilioAccountSid || !twilioAuthToken) warnings.push('Twilio credentials not set — numbers could not be verified.');
  if (!airtableApiKey) warnings.push('AIRTABLE_API_KEY not set — the Airtable base could not be verified.');
  if (!clerkSecretKey) warnings.push('CLERK_SECRET_KEY not set — the portal login could not be resolved.');

  const [ops, vercel] = await Promise.all([loadTeardownOps(), hasVercel ? loadVercelSync() : null]);

  const sites: TeardownPlanSite[] = [];
  let hasVerifiedCustomDomain = false;

  for (const site of ctx.sites) {
    const env = site.env;
    const org = process.env.GITHUB_ORG;

    const [githubExists, vercelExists, domains, deployments, twilioOwned, llmId] = await Promise.all([
      ops.probeGitHubRepo({ token: githubToken ?? undefined, org, repo: site.slug }),
      ops.probeVercelProject({ token: process.env.VERCEL_TOKEN, teamId: process.env.VERCEL_TEAM_ID, slug: site.slug }),
      vercel ? vercel.listProjectDomains(site.slug) : Promise.resolve(null),
      vercel ? vercel.listDeployments(site.slug, { limit: 1 }) : Promise.resolve(null),
      ops.probeTwilioNumber({
        accountSid: twilioAccountSid ?? undefined,
        authToken: twilioAuthToken ?? undefined,
        phoneNumber: env.TWILIO_NUMBER,
      }),
      ops.resolveRetellLlmId({ apiKey: retellKey ?? undefined, agentId: env.RETELL_AGENT_ID }),
    ]);

    const agentExists = env.RETELL_AGENT_ID
      ? await ops.probeRetellAgent({ apiKey: retellKey ?? undefined, agentId: env.RETELL_AGENT_ID })
      : null;

    const webhookUrl = env.MAKE_WEBHOOK_URL || env.RETELL_POST_CALL_WEBHOOK_URL || undefined;
    const makeScenario = await ops.resolveMakeScenarioId({
      apiKey: makeKey ?? undefined,
      zone: MAKE_ZONE,
      envScenarioId: env.MAKE_SCENARIO_ID,
      brandName: site.brandName,
      webhookUrl,
    });

    const verifiedCustom = (domains?.domains ?? []).some(
      (d) => d.verified && !d.redirect && !d.name.endsWith('.vercel.app'),
    );
    if (verifiedCustom) hasVerifiedCustomDomain = true;

    sites.push({
      siteSlug: site.slug,
      brandName: site.brandName,
      github: { repo: `${org ?? '<org>'}/${site.slug}`, exists: githubExists },
      vercel: {
        projectName: vercel ? vercel.sanitizeProjectName(site.slug) : site.slug,
        exists: vercelExists,
        domains: (domains?.domains ?? []).map((d) => ({
          name: d.name,
          verified: d.verified,
          redirect: d.redirect,
          apexName: d.apexName,
        })),
        lastDeployState: deployments?.deployments?.[0]?.state ?? null,
        lastDeployAt: deployments?.deployments?.[0]?.createdAt ?? null,
      },
      twilio: { number: env.TWILIO_NUMBER ?? null, owned: twilioOwned },
      retell: { agentId: env.RETELL_AGENT_ID ?? null, agentExists, llmId },
      make: {
        scenarioId: makeScenario?.id ?? null,
        resolvedBy: makeScenario?.resolvedBy ?? null,
        webhookUrl: webhookUrl ?? null,
      },
    });
  }

  // ── Shared Airtable base — hard block, not a warning ──────────────────────
  const baseId = ctx.sites.map((s) => s.env.AIRTABLE_BASE_ID).find(Boolean) ?? null;
  let baseExists: boolean | null = null;
  let baseName: string | null = null;
  const sharedWith: string[] = [];
  if (baseId) {
    const probe = await ops.probeAirtableBase({ apiKey: airtableApiKey ?? undefined, baseId });
    baseExists = probe.exists;
    baseName = probe.name;

    const others = await listClientContexts({ includeFixtures: true });
    for (const other of others) {
      if (other.slug === slug) continue;
      if (other.sites.some((s) => s.env.AIRTABLE_BASE_ID === baseId)) sharedWith.push(other.slug);
    }
  }

  // ── Portal / Clerk ─────────────────────────────────────────────────────────
  const configured = accountStoreConfigured();
  let portalEmail: string | null = null;
  let remainingSitesOnAccount: number | null = null;
  let clerkUserId: string | null = null;
  let clerkResolvedBy: 'env' | 'email' | null = null;

  if (configured) {
    const envUserId = ctx.sites.map((s) => s.env.CLERK_USER_ID).find(Boolean);
    portalEmail = envUserId ? await getAccountEmailByUserId(envUserId) : null;
    // Some clients only ever get a portal email written, no per-site CLERK_USER_ID lookup index hit.
    if (!portalEmail) {
      portalEmail = ctx.sites.map((s) => s.env.PORTAL_ACCOUNT_EMAIL).find(Boolean) ?? null;
    }

    if (portalEmail) {
      try {
        const account = await getAccount(portalEmail);
        const mySlugs = new Set(ctx.sites.map((s) => s.slug));
        remainingSitesOnAccount = account ? account.sites.filter((s) => !mySlugs.has(s.slug)).length : 0;
      } catch {
        remainingSitesOnAccount = null; // unknown, NOT zero — see Clerk deletion guard in the run route
      }
    }

    const clerk = await ops.resolveClerkUser({
      secretKey: clerkSecretKey ?? undefined,
      envUserId,
      email: portalEmail,
    });
    clerkUserId = clerk?.userId ?? null;
    clerkResolvedBy = clerk?.resolvedBy ?? null;
  } else {
    warnings.push('KV not configured — the portal record could not be checked.');
  }

  // ── Local folder ───────────────────────────────────────────────────────────
  const dir = clientDir(slug);
  const approxBytes = existsSync(dir) ? dirSize(dir) : null;

  // ── What's left behind, regardless of how the run above goes ───────────────
  const leftBehind: ArchiveOrphan[] = [];
  for (const site of sites) {
    if (site.vercel.domains.some((d) => !d.name.endsWith('.vercel.app'))) {
      for (const d of site.vercel.domains.filter((x) => !x.name.endsWith('.vercel.app'))) {
        leftBehind.push({
          kind: 'dns',
          detail: `${d.name} may still point at Vercel after the project is deleted`,
          action: 'Remove or repoint the DNS record at the registrar',
        });
      }
    }
    if (!site.make.scenarioId) {
      leftBehind.push({
        kind: 'make.scenario',
        detail: `Could not resolve a Make.com scenario for ${site.siteSlug} (searched "Post-call: ${site.brandName}" and the webhook hooks list)`,
        action: 'Find and delete it by hand in Make.com',
      });
    }
  }
  leftBehind.push(
    { kind: 'ga4', detail: 'Google Analytics 4 property, if one was created — never provisioned by ops' },
    { kind: 'twilio.logs', detail: 'Call logs and recordings under the master Twilio account are retained after the number is released' },
    { kind: 'audit', detail: 'This teardown itself remains in console/.state/audit.ndjson — kept deliberately' },
  );
  if (baseId && sharedWith.length) {
    leftBehind.push({
      kind: 'airtable.shared',
      detail: `Airtable base ${baseId} is also referenced by ${sharedWith.join(', ')} — not deleted`,
      action: 'Split the shared base manually if these clients should not share call data',
    });
  }

  const identifiersForHash: ArchiveSiteIdentifiers[] = sites.map((s) => ({
    siteSlug: s.siteSlug,
    vercelProjectId: null,
    vercelProjectName: s.vercel.projectName,
    githubRepo: s.github.repo,
    liveUrl: null,
    domains: s.vercel.domains,
    twilioNumber: s.twilio.number,
    twilioSid: null,
    retellAgentId: s.retell.agentId,
    retellLlmId: s.retell.llmId,
    makeScenarioId: s.make.scenarioId,
    makeWebhookUrl: s.make.webhookUrl,
    airtableSiteTag: null,
  }));

  const previewHash = hashPlan({
    slug,
    sites: identifiersForHash,
    airtableBaseId: baseId,
    portalEmail,
    clerkUserId,
  });

  return {
    slug,
    brandName: ctx.brandName,
    plan: ctx.plan,
    isEnterprise: ctx.isEnterprise,
    capturedAt: new Date().toISOString(),
    previewHash,
    sites,
    airtable: { baseId, baseName, exists: baseExists, sharedWith },
    portal: { configured, email: portalEmail, clerkUserId, clerkResolvedBy, remainingSitesOnAccount },
    localFolder: { path: dir, approxBytes },
    hasVerifiedCustomDomain,
    leftBehind,
    warnings,
  };
}

/**
 * Read every .env.local under a client (all sites) verbatim, for the archive snapshot.
 *
 * Uses siteDirFor rather than re-deriving the path from ctx.isEnterprise: that flag is
 * `plan === 'enterprise' || count > 1`, so an enterprise-PLAN client with exactly one site
 * is still laid out flat (clients/{slug}/.env.local, no site-1/ subfolder) — the same
 * distinction getClientContext already encodes correctly via the site count.
 */
export function readAllEnvLocalVerbatim(ctx: ClientContext): Record<string, string> {
  const out: Record<string, string> = {};
  ctx.sites.forEach((site, i) => {
    const dir = siteDirFor(ctx.slug, ctx.sites.length, i);
    const path = resolve(dir, '.env.local');
    out[site.slug] = existsSync(path) ? readFileSync(path, 'utf8') : '';
  });
  return out;
}
