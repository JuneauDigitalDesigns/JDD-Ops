/**
 * lib/vercel-sync.js — push env vars to a client's Vercel project.
 *
 * Used by:
 *   - onboard.js (step 9, runs once at the end of provisioning)
 *   - scripts/sync-vercel-env.js (re-run manually after editing
 *     clients/{slug}/.env.local, e.g. to update RETELL_* / TWILIO_NUMBER)
 *   - console /manage → /api/manage/env (edit + sync + redeploy from the UI)
 *
 * Vercel API references:
 *   - GET    /v9/projects/{idOrName}
 *   - POST   /v10/projects
 *   - GET    /v9/projects/{idOrName}/env
 *   - POST   /v10/projects/{idOrName}/env
 *   - PATCH  /v9/projects/{idOrName}/env/{envId}
 *   - GET    /v9/projects/{idOrName}/domains
 *   - POST   /v9/projects/{idOrName}/domains
 *   - POST   /v9/projects/{idOrName}/domains/{domain}/verify
 *   - GET    /v6/domains/{domain}/config          (account-level; works unattached)
 *   - GET    /v6/deployments
 *   - POST   /v13/deployments
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const API = 'https://api.vercel.com';

/**
 * Vercel project names must be lowercase and may contain only a–z, 0–9, '.', '_',
 * '-'; they cannot start with '.', '_', or '-', cannot contain 3+ consecutive
 * hyphens, and are capped at 100 chars. Client slugs (esp. test fixtures like
 * `_e2e-growth`) can violate these rules, so we derive a safe project name while
 * leaving the original slug — and thus the GitHub repo name and clients/{slug}
 * folder — untouched.
 */
export function sanitizeProjectName(slug) {
  let name = String(slug).toLowerCase();
  name = name.replace(/^[._-]+/, '');        // no leading . _ -
  name = name.replace(/[^a-z0-9._-]/g, '-'); // replace illegal chars
  name = name.replace(/-{3,}/g, '--');       // no 3+ consecutive hyphens
  name = name.replace(/[._-]+$/, '');        // no trailing . _ -
  if (!name) name = 'project';
  return name.slice(0, 100);
}

function teamQuery() {
  const id = process.env.VERCEL_TEAM_ID;
  return id ? `?teamId=${encodeURIComponent(id)}` : '';
}

function authHeaders() {
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error('VERCEL_TOKEN is not set');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function vercelFetch(path, init = {}) {
  const sep = path.includes('?') ? '&' : '?';
  const teamId = process.env.VERCEL_TEAM_ID;
  const url = `${API}${path}${teamId ? `${sep}teamId=${encodeURIComponent(teamId)}` : ''}`;
  const res = await fetch(url, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers || {}) },
  });
  return res;
}

function parseEnvLocal(envPath) {
  if (!existsSync(envPath)) return {};
  const out = {};
  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!key) continue;
    out[key] = value;
  }
  return out;
}

async function ensureProject(projectName, repoSlug) {
  const got = await vercelFetch(`/v9/projects/${encodeURIComponent(projectName)}`);
  if (got.ok) return await got.json();
  if (got.status !== 404) {
    throw new Error(`Vercel project lookup failed (${got.status}): ${await got.text()}`);
  }

  const githubOrg = process.env.GITHUB_ORG;
  if (!githubOrg) {
    throw new Error(
      `Vercel project "${projectName}" does not exist and GITHUB_ORG is not set, so we can't auto-create it.`
    );
  }

  console.log(`  Vercel project "${projectName}" not found — creating linked to GitHub repo ${githubOrg}/${repoSlug}`);
  const created = await vercelFetch(`/v10/projects`, {
    method: 'POST',
    body: JSON.stringify({
      name: projectName,
      framework: 'nextjs',
      gitRepository: { type: 'github', repo: `${githubOrg}/${repoSlug}` },
    }),
  });
  if (!created.ok) {
    throw new Error(`Vercel project create failed (${created.status}): ${await created.text()}`);
  }
  return await created.json();
}

/**
 * Resolve a client slug to its Vercel project id (prj_…), which the client
 * portal needs to query Web Analytics. Returns null if VERCEL_TOKEN is unset or
 * the project doesn't exist yet, so callers can degrade gracefully.
 *
 * @param {string} slug  Client slug (== GitHub repo name; sanitized internally).
 * @returns {Promise<string|null>}
 */
export async function getVercelProjectId(slug) {
  const meta = await getProjectAnalytics(slug);
  return meta.projectId;
}

/**
 * Project id plus whether Web Analytics is actually collecting.
 *
 * Enabling Web Analytics is a dashboard-only action — `PATCH /v9/projects/{id}` returns an
 * `analytics` object but accepts no field to set it. Without a check, a missed toggle during
 * onboarding surfaces months later as an empty portal Traffic tab with nothing naming the
 * cause.
 *
 * **Do not read `project.analytics` for this.** That field reports the legacy Audiences
 * product and is `undefined` even on projects actively collecting Web Analytics — verified
 * against `e2e_test_growth`, which returned real deviceType/browserName rows while the field
 * was absent. Using it marks healthy clients as broken.
 *
 * So the state is probed from the Web Analytics query API itself: a 200 is proof it is on,
 * and it exercises the exact call the portal depends on. Cheapest possible query — a
 * one-day `visits/count`.
 *
 * `analyticsEnabled` is `null`, never `false`, when we could not check. A missing token or a
 * rejected one says nothing about the project, and reporting that as "off" would send an
 * operator to fix something that isn't broken.
 *
 * @param {string} slug  Client slug (== GitHub repo name; sanitized internally).
 * @param {string} [projectId]  Preferred over the slug when the caller has it stored.
 * @returns {Promise<{ projectId: string|null; analyticsEnabled: boolean|null; reason: string|null }>}
 */
export async function getProjectAnalytics(slug, projectId) {
  const miss = (reason, id = null) => ({ projectId: id, analyticsEnabled: null, reason });

  if (!slug && !projectId) return miss('no slug or project id');
  if (!process.env.VERCEL_TOKEN) return miss('VERCEL_TOKEN is not set');

  // Resolve the id when the caller didn't supply one. The account record stores it, so
  // prefer that over the sanitized slug — a renamed project would otherwise 404.
  let id = projectId ?? null;
  if (!id) {
    try {
      const res = await vercelFetch(`/v9/projects/${encodeURIComponent(sanitizeProjectName(slug))}`);
      if (!res.ok) return miss(`project lookup returned ${res.status}`);
      id = (await res.json())?.id ?? null;
    } catch (e) {
      return miss(`project lookup failed: ${e.message}`);
    }
  }
  if (!id) return miss('could not resolve project id');

  const since = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const qs = new URLSearchParams({ projectId: id, since, until: new Date().toISOString().slice(0, 10) });

  let res;
  try {
    res = await vercelFetch(`/v1/query/web-analytics/visits/count?${qs}`);
  } catch (e) {
    return miss(`analytics probe failed: ${e.message}`, id);
  }

  if (res.ok) return { projectId: id, analyticsEnabled: true, reason: null };

  // 401/429 are about our credential and our rate, not the project's configuration.
  if (res.status === 401 || res.status === 429) {
    return miss(`analytics probe returned ${res.status}`, id);
  }
  if (res.status >= 400 && res.status < 500) {
    return { projectId: id, analyticsEnabled: false, reason: `probe returned ${res.status}` };
  }
  return miss(`analytics probe returned ${res.status}`, id);
}

/**
 * Read a project's env vars back out of Vercel, so callers can show drift against
 * clients/{slug}/.env.local.
 *
 * The list endpoint never returns usable plaintext for `type: 'encrypted'` vars — it
 * hands back a ~1000-char blob whether or not `decrypt=true` is passed, and the blob is
 * a plain string, so there's no way to detect it from the value alone. The *single*-var
 * endpoint does decrypt. So: one list call for the inventory, then one call per key the
 * caller actually wants to compare. Keys left unresolved report `decrypted: false`,
 * meaning "present on Vercel, value unknown" — never treat that as a mismatch.
 *
 * @param {string} slug                       Client slug (sanitized to a project name internally).
 * @param {object} [opts]
 * @param {string[]} [opts.resolveKeys]       Keys to fetch decrypted values for. Keep this to
 *                                            what you'll compare — each key is a request, and
 *                                            master credentials are best left unfetched.
 * @returns {Promise<{ ok: boolean; projectName: string; reason?: string;
 *   vars: Record<string, { id: string; value: string|null; decrypted: boolean; target: string[] }> }>}
 */
export async function listProjectEnv(slug, { resolveKeys = [] } = {}) {
  const projectName = sanitizeProjectName(slug);
  if (!process.env.VERCEL_TOKEN) {
    return { ok: false, projectName, reason: 'VERCEL_TOKEN is not set', vars: {} };
  }

  const res = await vercelFetch(`/v9/projects/${encodeURIComponent(projectName)}/env`);
  if (res.status === 404) {
    return { ok: false, projectName, reason: 'Vercel project does not exist yet', vars: {} };
  }
  if (!res.ok) {
    return { ok: false, projectName, reason: `Vercel env list failed (${res.status})`, vars: {} };
  }

  const body = await res.json();
  const envs = Array.isArray(body) ? body : body.envs || [];
  const vars = {};
  for (const e of envs) {
    if (!e?.key) continue;
    vars[e.key] = {
      id: e.id ?? null,
      value: null,
      decrypted: false,
      target: Array.isArray(e.target) ? e.target : [],
      // Free — the list response already carries it. Lets a caller answer "has the env
      // changed since the last deploy?" without any additional request.
      updatedAt: e.updatedAt ?? e.createdAt ?? null,
    };
  }

  const wanted = resolveKeys.filter((k) => vars[k]?.id);
  await Promise.all(
    wanted.map(async (key) => {
      try {
        const one = await vercelFetch(
          `/v9/projects/${encodeURIComponent(projectName)}/env/${vars[key].id}`
        );
        if (!one.ok) return;
        const value = (await one.json())?.value;
        if (typeof value === 'string') {
          vars[key].value = value;
          vars[key].decrypted = true;
        }
      } catch {
        // Leave it as "present, value unknown" — drift just isn't shown for this key.
      }
    })
  );

  return { ok: true, projectName, vars };
}

/**
 * List a project's recent deployments, newest first, so the console can answer
 * "did my env change actually land?" without opening the Vercel dashboard.
 *
 * Follows listProjectEnv's contract, NOT triggerRedeploy's: this never throws. A
 * missing token, missing project, or API error comes back as { ok: false, reason }
 * because the caller renders it as one tile in a health readout — one unreachable
 * project must not take down the page.
 *
 * @param {string} slug                              Client slug (sanitized internally).
 * @param {object} [opts]
 * @param {number} [opts.limit=10]                   Max deployments to return.
 * @param {string|null} [opts.target='production']   null = all targets.
 * @returns {Promise<{ ok: boolean; projectName: string; reason?: string;
 *   deployments: Array<{ id: string; url: string|null; inspectorUrl: string|null;
 *     state: string; target: string|null; createdAt: number|null; readyAt: number|null;
 *     commitSha: string|null; commitMessage: string|null; creator: string|null }> }>}
 */
export async function listDeployments(slug, { limit = 10, target = 'production' } = {}) {
  const projectName = sanitizeProjectName(slug);
  if (!process.env.VERCEL_TOKEN) {
    return { ok: false, projectName, reason: 'VERCEL_TOKEN is not set', deployments: [] };
  }

  try {
    // /v6/deployments filters by projectId, not by name — resolve it first.
    const projectId = await getVercelProjectId(slug);
    if (!projectId) {
      return { ok: false, projectName, reason: 'Vercel project does not exist yet', deployments: [] };
    }

    const q = new URLSearchParams({ projectId, limit: String(limit) });
    if (target) q.set('target', target);
    const res = await vercelFetch(`/v6/deployments?${q.toString()}`);
    if (!res.ok) {
      return {
        ok: false,
        projectName,
        reason: `Vercel deployment list failed (${res.status})`,
        deployments: [],
      };
    }

    const body = await res.json();
    const raw = Array.isArray(body?.deployments) ? body.deployments : [];
    // v6 speaks uid/created/ready; normalize here so callers never see v6 field names.
    const deployments = raw.map((d) => ({
      id: d.uid ?? d.id ?? '',
      url: d.url ? `https://${d.url}` : null,
      inspectorUrl: d.inspectorUrl ?? null,
      state: d.state ?? d.readyState ?? 'UNKNOWN',
      target: d.target ?? null,
      createdAt: d.created ?? d.createdAt ?? null,
      readyAt: d.ready ?? d.readyAt ?? null,
      commitSha: d.meta?.githubCommitSha ?? null,
      commitMessage: d.meta?.githubCommitMessage ?? null,
      creator: d.creator?.username ?? null,
    }));

    return { ok: true, projectName, deployments };
  } catch (err) {
    return {
      ok: false,
      projectName,
      reason: err instanceof Error ? err.message : 'Vercel deployment list failed',
      deployments: [],
    };
  }
}

/**
 * List the custom domains attached to a project, with their verification state, so
 * the console can show "domain attached AND verified" rather than just echoing the
 * canonical that site.ts claims.
 *
 * Same non-throwing contract as listProjectEnv.
 *
 * Deliberately does NOT call the per-domain /config endpoint — that is one extra
 * request per domain for a "misconfigured" flag the health readout doesn't use.
 *
 * @param {string} slug
 * @returns {Promise<{ ok: boolean; projectName: string; reason?: string;
 *   domains: Array<{ name: string; apexName: string|null; verified: boolean;
 *     redirect: string|null; gitBranch: string|null; createdAt: number|null }> }>}
 */
export async function listProjectDomains(slug) {
  const projectName = sanitizeProjectName(slug);
  if (!process.env.VERCEL_TOKEN) {
    return { ok: false, projectName, reason: 'VERCEL_TOKEN is not set', domains: [] };
  }

  try {
    const res = await vercelFetch(`/v9/projects/${encodeURIComponent(projectName)}/domains`);
    if (res.status === 404) {
      return { ok: false, projectName, reason: 'Vercel project does not exist yet', domains: [] };
    }
    if (!res.ok) {
      return {
        ok: false,
        projectName,
        reason: `Vercel domain list failed (${res.status})`,
        domains: [],
      };
    }

    const body = await res.json();
    const raw = Array.isArray(body) ? body : body.domains || [];
    const domains = raw.map(mapDomain);

    return { ok: true, projectName, domains };
  } catch (err) {
    return {
      ok: false,
      projectName,
      reason: err instanceof Error ? err.message : 'Vercel domain list failed',
      domains: [],
    };
  }
}

/**
 * Normalize one project-domain record.
 *
 * `verification` only appears while a domain is UNVERIFIED — it carries the challenge
 * records (usually a TXT) the registrar needs before Vercel will serve the domain. Once
 * verified, Vercel drops the field entirely, so an empty array here means "nothing left
 * to prove", not "we failed to read it".
 */
function mapDomain(d) {
  return {
    name: d.name ?? '',
    apexName: d.apexName ?? null,
    verified: Boolean(d.verified),
    redirect: d.redirect ?? null,
    gitBranch: d.gitBranch ?? null,
    createdAt: d.createdAt ?? null,
    verification: Array.isArray(d.verification)
      ? d.verification.map((v) => ({
          type: v.type ?? '',
          domain: v.domain ?? '',
          value: v.value ?? '',
          reason: v.reason ?? null,
        }))
      : [],
  };
}

/**
 * Pull a human-usable message out of a Vercel error response.
 *
 * Vercel answers failures with `{ error: { code, message } }`, and its messages are
 * genuinely informative ("Domain is already in use by another project"). Surfacing them
 * verbatim beats a generic "request failed (409)" the operator can't act on.
 */
async function vercelReason(res, fallback) {
  try {
    const body = await res.json();
    const message = body?.error?.message ?? body?.message;
    if (message) return `${message} (${res.status})`;
  } catch {
    // Non-JSON body — fall through.
  }
  return `${fallback} (${res.status})`;
}

/**
 * Attach a custom domain to a client's Vercel project.
 *
 * Attaching does NOT make the domain live: Vercel accepts it in an unverified state and
 * serves it only once DNS points at Vercel. The returned record carries the challenge
 * records when there are any — pair it with getDomainConfig() to tell the operator what
 * their registrar actually needs.
 *
 * Non-throwing, like the list* functions: a 409 ("already in use by another project") is
 * an answer the UI should render, not an exception.
 *
 * @param {string} slug
 * @param {string} domain              Bare hostname, e.g. "arthursplumbing.com".
 * @returns {Promise<{ ok: boolean; projectName: string; reason?: string; domain?: object }>}
 */
export async function addProjectDomain(slug, domain) {
  const projectName = sanitizeProjectName(slug);
  if (!process.env.VERCEL_TOKEN) {
    return { ok: false, projectName, reason: 'VERCEL_TOKEN is not set' };
  }
  const name = String(domain ?? '').trim().toLowerCase();
  if (!name) return { ok: false, projectName, reason: 'No domain given' };

  try {
    const res = await vercelFetch(`/v9/projects/${encodeURIComponent(projectName)}/domains`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    if (res.status === 404) {
      return { ok: false, projectName, reason: 'Vercel project does not exist yet' };
    }
    if (!res.ok) {
      return { ok: false, projectName, reason: await vercelReason(res, 'Add domain failed') };
    }
    return { ok: true, projectName, domain: mapDomain(await res.json()) };
  } catch (err) {
    return {
      ok: false,
      projectName,
      reason: err instanceof Error ? err.message : 'Add domain failed',
    };
  }
}

/**
 * Ask Vercel to re-check a pending domain, after the operator has updated DNS.
 *
 * Verification is not automatic on a useful timescale, so this is the "I've added the
 * record, look again" button.
 *
 * @param {string} slug
 * @param {string} domain
 * @returns {Promise<{ ok: boolean; projectName: string; verified: boolean; reason?: string;
 *   domain?: object }>}
 */
export async function verifyProjectDomain(slug, domain) {
  const projectName = sanitizeProjectName(slug);
  if (!process.env.VERCEL_TOKEN) {
    return { ok: false, projectName, verified: false, reason: 'VERCEL_TOKEN is not set' };
  }
  const name = String(domain ?? '').trim().toLowerCase();
  if (!name) return { ok: false, projectName, verified: false, reason: 'No domain given' };

  try {
    const res = await vercelFetch(
      `/v9/projects/${encodeURIComponent(projectName)}/domains/${encodeURIComponent(name)}/verify`,
      { method: 'POST' }
    );
    if (!res.ok) {
      // A refusal here usually means DNS isn't in place yet — expected, not exceptional.
      return {
        ok: false,
        projectName,
        verified: false,
        reason: await vercelReason(res, 'Verification failed'),
      };
    }
    const mapped = mapDomain(await res.json());
    return { ok: true, projectName, verified: mapped.verified, domain: mapped };
  } catch (err) {
    return {
      ok: false,
      projectName,
      verified: false,
      reason: err instanceof Error ? err.message : 'Verification failed',
    };
  }
}

/**
 * Where a domain's DNS currently points — for ANY domain, attached to a project or not.
 *
 * This is the pre-flight check: `configuredBy: null` means the domain isn't pointed at
 * Vercel yet, while "A"/"CNAME"/"http" means it is. Because it is account-level rather
 * than project-scoped, it can be called before attaching anything, which is exactly when
 * the operator wants to know whether a registrar change has propagated.
 *
 * Takes a bare domain, NOT a slug — unlike everything else in this module.
 *
 * @param {string} domain
 * @returns {Promise<{ ok: boolean; domain: string; reason?: string;
 *   configuredBy: string|null; misconfigured: boolean; nameservers: string[];
 *   aValues: string[]; cnames: string[]; conflicts: object[];
 *   acceptedChallenges: string[] }>}
 */
export async function getDomainConfig(domain) {
  const name = String(domain ?? '').trim().toLowerCase();
  const empty = {
    domain: name,
    configuredBy: null,
    misconfigured: false,
    nameservers: [],
    aValues: [],
    cnames: [],
    conflicts: [],
    acceptedChallenges: [],
  };
  if (!process.env.VERCEL_TOKEN) {
    return { ok: false, ...empty, reason: 'VERCEL_TOKEN is not set' };
  }
  if (!name) return { ok: false, ...empty, reason: 'No domain given' };

  try {
    const res = await vercelFetch(`/v6/domains/${encodeURIComponent(name)}/config`);
    if (!res.ok) {
      return { ok: false, ...empty, reason: await vercelReason(res, 'Domain config lookup failed') };
    }
    const body = await res.json();
    return {
      ok: true,
      domain: name,
      configuredBy: body.configuredBy ?? null,
      misconfigured: Boolean(body.misconfigured),
      nameservers: Array.isArray(body.nameservers) ? body.nameservers : [],
      aValues: Array.isArray(body.aValues) ? body.aValues : [],
      cnames: Array.isArray(body.cnames) ? body.cnames : [],
      conflicts: Array.isArray(body.conflicts) ? body.conflicts : [],
      acceptedChallenges: Array.isArray(body.acceptedChallenges) ? body.acceptedChallenges : [],
    };
  } catch (err) {
    return {
      ok: false,
      ...empty,
      reason: err instanceof Error ? err.message : 'Domain config lookup failed',
    };
  }
}

/**
 * Trigger a fresh production deployment so newly-synced env vars take effect.
 * Env changes are inert until the project redeploys — this is the step
 * `npm run sync-env` only ever printed a reminder about.
 *
 * Prefers redeploying the most recent production deployment (Vercel rebuilds it
 * with the current env). Falls back to deploying `main` from GitHub when the
 * project has never deployed.
 *
 * @param {object} opts
 * @param {string} opts.slug                   Client slug (== GitHub repo name).
 * @param {(line: string) => void} [opts.log]
 * @returns {Promise<{ id: string; url: string|null; inspectorUrl: string|null; source: 'redeploy'|'git' }>}
 */
export async function triggerRedeploy({ slug, log = (l) => console.log(l) }) {
  if (!slug) throw new Error('slug is required');
  if (!process.env.VERCEL_TOKEN) throw new Error('VERCEL_TOKEN is not set');

  const projectName = sanitizeProjectName(slug);
  const projectRes = await vercelFetch(`/v9/projects/${encodeURIComponent(projectName)}`);
  if (!projectRes.ok) {
    throw new Error(`Vercel project "${projectName}" not found (${projectRes.status})`);
  }
  const project = await projectRes.json();

  const listRes = await vercelFetch(
    `/v6/deployments?projectId=${encodeURIComponent(project.id)}&target=production&limit=1`
  );
  const latest = listRes.ok ? (await listRes.json())?.deployments?.[0] : null;

  let body;
  let source;
  if (latest?.uid || latest?.id) {
    source = 'redeploy';
    body = { name: projectName, deploymentId: latest.uid ?? latest.id, target: 'production' };
    log(`  Redeploying ${projectName} from ${latest.uid ?? latest.id}`);
  } else {
    const githubOrg = process.env.GITHUB_ORG;
    if (!githubOrg) {
      throw new Error(
        `${projectName} has no previous production deployment and GITHUB_ORG is not set, so we can't deploy from git.`
      );
    }
    source = 'git';
    body = {
      name: projectName,
      target: 'production',
      gitSource: { type: 'github', repo: `${githubOrg}/${slug}`, ref: 'main' },
    };
    log(`  No previous deployment — deploying ${githubOrg}/${slug}@main`);
  }

  const res = await vercelFetch('/v13/deployments', { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) {
    throw new Error(`Redeploy failed (${res.status}): ${await res.text()}`);
  }
  const deployment = await res.json();
  return {
    id: deployment.id ?? deployment.uid ?? '',
    url: deployment.url ? `https://${deployment.url}` : null,
    inspectorUrl: deployment.inspectorUrl ?? null,
    source,
  };
}

async function listExistingEnv(projectName) {
  const res = await vercelFetch(`/v9/projects/${encodeURIComponent(projectName)}/env`);
  if (!res.ok) {
    throw new Error(`Vercel env list failed (${res.status}): ${await res.text()}`);
  }
  const body = await res.json();
  // Vercel returns { envs: [...] } or sometimes [...] depending on API version
  const envs = Array.isArray(body) ? body : body.envs || [];
  const byKey = new Map();
  for (const e of envs) {
    if (e.key && e.id) byKey.set(e.key, e.id);
  }
  return byKey;
}

async function upsertEnvVar(projectName, existingByKey, key, value) {
  const target = ['production', 'preview', 'development'];
  const body = JSON.stringify({ key, value, type: 'encrypted', target });

  if (existingByKey.has(key)) {
    const envId = existingByKey.get(key);
    const res = await vercelFetch(`/v9/projects/${encodeURIComponent(projectName)}/env/${envId}`, {
      method: 'PATCH',
      body,
    });
    if (!res.ok) {
      throw new Error(`PATCH env ${key} failed (${res.status}): ${await res.text()}`);
    }
    return 'updated';
  }

  const res = await vercelFetch(`/v10/projects/${encodeURIComponent(projectName)}/env`, {
    method: 'POST',
    body,
  });
  if (res.status === 409) {
    // Race / drift — refresh and try PATCH
    const refreshed = await listExistingEnv(projectName);
    if (refreshed.has(key)) {
      return upsertEnvVar(projectName, refreshed, key, value);
    }
  }
  if (!res.ok) {
    throw new Error(`POST env ${key} failed (${res.status}): ${await res.text()}`);
  }
  return 'created';
}

/**
 * Push env vars to a client's Vercel project.
 *
 * @param {object} opts
 * @param {string} opts.slug              Vercel project name (== GitHub repo name).
 * @param {object} [opts.extraEnv]        Extra key/value pairs to push (merged on top of .env.local).
 * @param {string} [opts.clientDir]       Override clients/{slug} path (defaults to resolve('clients', slug)).
 * @param {(line: string) => void} [opts.log]  Custom logger; defaults to console.log.
 * @returns {Promise<{ created: string[]; updated: string[]; skipped: string[]; warnings: string[] }>}
 */
export async function syncEnvToVercel({ slug, extraEnv = {}, clientDir, log = (l) => console.log(l) }) {
  if (!slug) throw new Error('slug is required');
  if (!process.env.VERCEL_TOKEN) throw new Error('VERCEL_TOKEN is not set in .env');

  const projectName = sanitizeProjectName(slug);
  if (projectName !== slug) {
    log(`  Vercel project name sanitized: "${slug}" → "${projectName}" (GitHub repo + folder keep "${slug}")`);
  }

  const dir = clientDir || resolve('clients', slug);
  const envPath = resolve(dir, '.env.local');
  const fileEnv = parseEnvLocal(envPath);
  const merged = { ...fileEnv, ...extraEnv };

  const created = [];
  const updated = [];
  const skipped = [];
  const warnings = [];

  if (merged.LEAD_DELIVERY_MODE === 'callback') {
    const missing = ['RETELL_API_KEY', 'TWILIO_NUMBER', 'RETELL_AGENT_ID'].filter((k) => !merged[k]);
    if (missing.length) {
      warnings.push(
        `Callback client is missing ${missing.join(', ')} — the deployed /api/contact cannot place the Retell callback until these are set and synced: npm run sync-env -- --slug ${slug}`
      );
    }
  }

  await ensureProject(projectName, slug);
  const existingByKey = await listExistingEnv(projectName);

  for (const [key, value] of Object.entries(merged)) {
    if (!value) {
      skipped.push(key);
      continue;
    }
    const action = await upsertEnvVar(projectName, existingByKey, key, value);
    if (action === 'created') {
      created.push(key);
      log(`  + ${key} (created)`);
    } else {
      updated.push(key);
      log(`  ~ ${key} (updated)`);
    }
  }

  for (const w of warnings) log(`  ⚠ ${w}`);
  if (skipped.length) log(`  · skipped (empty values): ${skipped.join(', ')}`);

  return { created, updated, skipped, warnings };
}
