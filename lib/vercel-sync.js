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
  if (!slug || !process.env.VERCEL_TOKEN) return null;
  const projectName = sanitizeProjectName(slug);
  const res = await vercelFetch(`/v9/projects/${encodeURIComponent(projectName)}`);
  if (!res.ok) return null;
  const project = await res.json();
  return project?.id ?? null;
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
