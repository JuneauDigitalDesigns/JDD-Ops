/**
 * lib/vercel-sync.js — push env vars to a client's Vercel project.
 *
 * Used by:
 *   - onboard.js (step 9, runs once at the end of provisioning)
 *   - scripts/sync-vercel-env.js (re-runs after the user pastes MAKE_WEBHOOK_URL
 *     into clients/{slug}/.env.local at Checkpoint 3)
 *
 * Vercel API references:
 *   - GET    /v9/projects/{idOrName}
 *   - POST   /v10/projects
 *   - GET    /v9/projects/{idOrName}/env
 *   - POST   /v10/projects/{idOrName}/env
 *   - PATCH  /v9/projects/{idOrName}/env/{envId}
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

  if (!merged.MAKE_WEBHOOK_URL) {
    warnings.push(
      `MAKE_WEBHOOK_URL is empty. The deployed /api/contact will 500 on submissions until you clone the Make scenario and re-run: npm run sync-env -- --slug ${slug}`
    );
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
