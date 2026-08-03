/**
 * lib/teardown-ops.js — the primitives for destroying a client's provisioned resources.
 *
 * Used by:
 *   - scripts/teardown.js (CLI, test clients only — keeps its own `_e2e-` gate)
 *   - console /manage → Danger (real clients, with a preview + typed confirmation)
 *
 * Extracted from scripts/teardown.js so the console can orchestrate the same code the CLI
 * runs, rather than shelling out to a script that prompts on stdin and prints unstructured
 * text. Lives in lib/ because that is what the console bridges into — see vercel-sync.js
 * and account-store.js — and because a module with no main() cannot be imported into
 * accidentally destroying something.
 *
 * Two deliberate differences from the original bodies:
 *
 *   1. Every function RETURNS a step result instead of logging. The console needs to know
 *      which of eight resources failed in order to write a receipt and offer a resume; the
 *      CLI formats these back into the exact `✓ / · / ✗` lines it always printed.
 *
 *   2. Credentials are ARGUMENTS, not process.env reads. Under the CLI `dotenv/config` has
 *      populated process.env; inside a Next route it has not, and opsSecrets.ts only copies
 *      a whitelist. Reading env in here is how you get a delete that silently no-ops in the
 *      console and reports success — which is precisely how deleteAirtableBase behaved.
 *
 * Nothing here throws. A teardown touches eight systems and one being down must not strand
 * the other seven, so every failure comes back as `outcome: 'failed'` for the caller to
 * record and move past.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { sanitizeProjectName } from './vercel-sync.js';

const RETELL_API = 'https://api.retellai.com';
const VERCEL_API = 'https://api.vercel.com';
const AIRTABLE_API = 'https://api.airtable.com';

/**
 * @typedef {'deleted'|'already-gone'|'skipped'|'failed'} Outcome
 * @typedef {object} StepResult
 * @property {string} resource   Stable id, e.g. 'vercel.project'
 * @property {string} target     What it acted on, e.g. 'arthur-s-plumbing'
 * @property {Outcome} outcome
 * @property {number} [httpStatus]
 * @property {string} [message]  Human-readable; the reason when skipped or failed
 * @property {number} durationMs
 */

/** Build a StepResult, timing from `started`. */
function step(resource, target, outcome, started, extra = {}) {
  return { resource, target, outcome, durationMs: Date.now() - started, ...extra };
}

const skip = (resource, target, message) =>
  step(resource, target, 'skipped', Date.now(), { message });

/* ── Disk ─────────────────────────────────────────────────────────────────── */

/** Minimal .env parser — same rules onboard.js and the console use. */
export function parseEnvLocal(envPath) {
  if (!existsSync(envPath)) return {};
  const out = {};
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

/**
 * The provisionable sites under a client folder.
 *
 * Single-site (starter/growth): clientDir holds .env.local directly.
 * Enterprise: clientDir holds site-1/, site-2/, … each with its own .env.local.
 */
export function discoverSites(clientDir, baseSlug) {
  if (existsSync(resolve(clientDir, '.env.local'))) {
    return [{ slug: baseSlug, dir: clientDir, env: parseEnvLocal(resolve(clientDir, '.env.local')) }];
  }
  const sites = [];
  for (const entry of readdirSync(clientDir)) {
    const sub = resolve(clientDir, entry);
    if (!statSync(sub).isDirectory()) continue;
    if (!/^site-\d+$/.test(entry)) continue;
    const i = parseInt(entry.replace('site-', ''), 10);
    sites.push({ slug: `${baseSlug}-${i}`, dir: sub, env: parseEnvLocal(resolve(sub, '.env.local')) });
  }
  return sites;
}

/* ── GitHub ───────────────────────────────────────────────────────────────── */

/**
 * Builds its own Octokit client from a token string rather than accepting one, so every
 * exported function in this module takes plain credentials — never a pre-built instance
 * from a package the CONSOLE doesn't depend on. @octokit/rest resolves from jdd-ops's own
 * node_modules (this file only ever runs there, whether invoked by the CLI directly or
 * bridged in from the console).
 */
export async function deleteGitHubRepo({ token, org, repo }) {
  const target = `${org ?? '<org>'}/${repo}`;
  const started = Date.now();
  if (!token || !org) return skip('github.repo', target, 'GITHUB_TOKEN or GITHUB_ORG not set');
  try {
    const { Octokit } = await import('@octokit/rest');
    const octokit = new Octokit({ auth: token });
    await octokit.repos.delete({ owner: org, repo });
    return step('github.repo', target, 'deleted', started);
  } catch (err) {
    if (err.status === 404) return step('github.repo', target, 'already-gone', started, { httpStatus: 404 });
    return step('github.repo', target, 'failed', started, {
      httpStatus: err.status,
      message: `${err.status ?? ''} ${err.message}`.trim(),
    });
  }
}

/* ── Twilio ───────────────────────────────────────────────────────────────── */

/** Same reasoning as deleteGitHubRepo: builds the Twilio client from plain credentials. */
export async function releaseTwilioNumber({ accountSid, authToken, phoneNumber }) {
  const started = Date.now();
  if (!phoneNumber) return skip('twilio.number', '—', 'No TWILIO_NUMBER recorded');
  if (!accountSid || !authToken) return skip('twilio.number', phoneNumber, 'Twilio credentials not set');
  try {
    const { default: twilio } = await import('twilio');
    const client = twilio(accountSid, authToken);
    const matches = await client.incomingPhoneNumbers.list({ phoneNumber, limit: 1 });
    // Not owned by the master account — already released, or never ours.
    if (!matches.length) return step('twilio.number', phoneNumber, 'already-gone', started);
    await client.incomingPhoneNumbers(matches[0].sid).remove();
    return step('twilio.number', phoneNumber, 'deleted', started, { message: matches[0].sid });
  } catch (err) {
    return step('twilio.number', phoneNumber, 'failed', started, { message: err.message });
  }
}

/* ── Retell ───────────────────────────────────────────────────────────────── */

/**
 * The LLM id an agent is bound to.
 *
 * Must be called BEFORE deleting the agent. The id is only in .env.local for clients
 * provisioned after it started being written there — _e2e_test_growth, for one, has no
 * RETELL_LLM_ID — and once the agent is gone there is no way back to it. An LLM orphaned
 * this way is invisible and permanent.
 */
export async function resolveRetellLlmId({ apiKey, agentId }) {
  if (!apiKey || !agentId) return null;
  try {
    const res = await fetch(`${RETELL_API}/get-agent/${agentId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return null;
    return (await res.json())?.response_engine?.llm_id ?? null;
  } catch {
    return null;
  }
}

export async function deleteRetellAgent({ apiKey, agentId }) {
  return retellDelete('retell.agent', `delete-agent`, apiKey, agentId, 'No RETELL_AGENT_ID recorded');
}

export async function deleteRetellLlm({ apiKey, llmId }) {
  return retellDelete('retell.llm', `delete-retell-llm`, apiKey, llmId, 'No LLM bound to this agent');
}

async function retellDelete(resource, path, apiKey, id, missingMessage) {
  const started = Date.now();
  if (!id) return skip(resource, '—', missingMessage);
  if (!apiKey) return skip(resource, id, 'RETELL_API_KEY not set');
  try {
    const res = await fetch(`${RETELL_API}/${path}/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.status === 404) return step(resource, id, 'already-gone', started, { httpStatus: 404 });
    if (res.ok) return step(resource, id, 'deleted', started, { httpStatus: res.status });
    return step(resource, id, 'failed', started, {
      httpStatus: res.status,
      message: (await res.text().catch(() => '')).slice(0, 200),
    });
  } catch (err) {
    return step(resource, id, 'failed', started, { message: err.message });
  }
}

/* ── Vercel ───────────────────────────────────────────────────────────────── */

/**
 * `slug` is the folder/provisioning slug (e.g. `_e2e_test_growth`) — NOT necessarily the
 * Vercel project name. onboard.js creates the project as `sanitizeProjectName(slug)`
 * because Vercel forbids leading underscores and other characters folder slugs allow, and
 * this must apply the identical transform before it deletes or the target and the real
 * project silently diverge.
 *
 * That divergence was a real, previously-shipped bug: the original script's
 * deleteVercelProject took the raw slug, so for `_e2e_test_growth` it issued
 * DELETE /v9/projects/_e2e_test_growth — a project that never existed — got a 404, and
 * logged "not found (skipping)" as if the real project (`e2e_test_growth`, still live) had
 * been removed. Confirmed against the live API before fixing this.
 */
export async function deleteVercelProject({ token, teamId, slug }) {
  const started = Date.now();
  const projectName = sanitizeProjectName(slug);
  if (!token) return skip('vercel.project', projectName, 'VERCEL_TOKEN not set');
  const q = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
  try {
    const res = await fetch(`${VERCEL_API}/v9/projects/${encodeURIComponent(projectName)}${q}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 404) return step('vercel.project', projectName, 'already-gone', started, { httpStatus: 404 });
    if (res.ok) return step('vercel.project', projectName, 'deleted', started, { httpStatus: res.status });
    return step('vercel.project', projectName, 'failed', started, {
      httpStatus: res.status,
      message: (await res.text().catch(() => '')).slice(0, 200),
    });
  } catch (err) {
    return step('vercel.project', projectName, 'failed', started, { message: err.message });
  }
}

/* ── Airtable ─────────────────────────────────────────────────────────────── */

/**
 * Delete a base — and with it the client's entire Call Log. Irreversible, and the highest
 * blast radius in a teardown: the caller MUST have checked that no other client's
 * .env.local points at the same base id before calling this.
 */
export async function deleteAirtableBase({ apiKey, baseId }) {
  const started = Date.now();
  if (!baseId) return skip('airtable.base', '—', 'No AIRTABLE_BASE_ID recorded');
  if (!apiKey) return skip('airtable.base', baseId, 'AIRTABLE_API_KEY not set');
  try {
    const res = await fetch(`${AIRTABLE_API}/v0/meta/bases/${baseId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.status === 404) return step('airtable.base', baseId, 'already-gone', started, { httpStatus: 404 });
    if (res.ok) return step('airtable.base', baseId, 'deleted', started, { httpStatus: res.status });
    return step('airtable.base', baseId, 'failed', started, {
      httpStatus: res.status,
      message: (await res.text().catch(() => '')).slice(0, 200),
    });
  } catch (err) {
    return step('airtable.base', baseId, 'failed', started, { message: err.message });
  }
}

/* ── Make.com ─────────────────────────────────────────────────────────────── */

/**
 * Find the per-client scenario clone.
 *
 * onboard.js clones the master scenario and names it `Post-call: {brand.name}`, but only
 * ever persisted the webhook URL — never the scenario id. So this resolves, in order:
 *   1. MAKE_SCENARIO_ID from .env.local (clients provisioned after that was fixed)
 *   2. exact name match
 *   3. walking each scenario's hooks for the stored webhook URL
 *
 * Returns null rather than guessing. Deleting the wrong Make scenario breaks another
 * client's call logging, so a fuzzy match is never worth it — an unresolved scenario is
 * reported as an orphan for manual cleanup instead.
 */
export async function resolveMakeScenarioId({ apiKey, zone, envScenarioId, brandName, webhookUrl }) {
  if (envScenarioId) return { id: envScenarioId, resolvedBy: 'env' };
  if (!apiKey || !zone) return null;
  const headers = { Authorization: `Token ${apiKey}` };

  try {
    const res = await fetch(`${zone}/scenarios`, { headers });
    if (!res.ok) return null;
    const scenarios = (await res.json())?.scenarios ?? [];

    if (brandName) {
      const byName = scenarios.find((s) => s.name === `Post-call: ${brandName}`);
      if (byName?.id) return { id: byName.id, resolvedBy: 'name' };
    }

    if (webhookUrl) {
      for (const s of scenarios) {
        try {
          const hooks = await fetch(`${zone}/scenarios/${s.id}/hooks`, { headers });
          if (!hooks.ok) continue;
          if (((await hooks.json())?.hooks ?? []).some((h) => h.url === webhookUrl)) {
            return { id: s.id, resolvedBy: 'webhook' };
          }
        } catch {
          // One unreadable scenario shouldn't abandon the search.
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Stop the scenario before deleting it — a running scenario can refuse deletion. */
export async function stopAndDeleteMakeScenario({ apiKey, zone, scenarioId }) {
  const started = Date.now();
  if (!scenarioId) return skip('make.scenario', '—', 'Scenario id could not be resolved');
  if (!apiKey || !zone) return skip('make.scenario', String(scenarioId), 'MAKE_API_KEY not set');
  const headers = { Authorization: `Token ${apiKey}` };
  try {
    await fetch(`${zone}/scenarios/${scenarioId}/stop`, { method: 'POST', headers }).catch(() => {});
    const res = await fetch(`${zone}/scenarios/${scenarioId}`, { method: 'DELETE', headers });
    if (res.status === 404) {
      return step('make.scenario', String(scenarioId), 'already-gone', started, { httpStatus: 404 });
    }
    if (res.ok) return step('make.scenario', String(scenarioId), 'deleted', started, { httpStatus: res.status });
    return step('make.scenario', String(scenarioId), 'failed', started, {
      httpStatus: res.status,
      message: (await res.text().catch(() => '')).slice(0, 200),
    });
  } catch (err) {
    return step('make.scenario', String(scenarioId), 'failed', started, { message: err.message });
  }
}

/* ── Probes — preview only, never mutate ──────────────────────────────────── */

/**
 * Does this resource still exist?
 *
 * The preview verifies rather than assumes, so the UI can distinguish "will be deleted"
 * from "already gone" and the operator sees an honest count. `null` means unknown (no
 * credential, or the check itself failed) — deliberately distinct from `false`.
 */
/** Same sanitizeProjectName transform as deleteVercelProject — see the note there. */
export async function probeVercelProject({ token, teamId, slug }) {
  if (!token) return null;
  const q = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
  try {
    const res = await fetch(`${VERCEL_API}/v9/projects/${encodeURIComponent(sanitizeProjectName(slug))}${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return null;
  }
}

export async function probeGitHubRepo({ token, org, repo }) {
  if (!token || !org) return null;
  try {
    const { Octokit } = await import('@octokit/rest');
    await new Octokit({ auth: token }).repos.get({ owner: org, repo });
    return true;
  } catch (err) {
    return err.status === 404 ? false : null;
  }
}

export async function probeRetellAgent({ apiKey, agentId }) {
  if (!apiKey || !agentId) return null;
  try {
    const res = await fetch(`${RETELL_API}/get-agent/${agentId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return res.ok;
  } catch {
    return null;
  }
}

export async function probeTwilioNumber({ accountSid, authToken, phoneNumber }) {
  if (!accountSid || !authToken || !phoneNumber) return null;
  try {
    const { default: twilio } = await import('twilio');
    const client = twilio(accountSid, authToken);
    return (await client.incomingPhoneNumbers.list({ phoneNumber, limit: 1 })).length > 0;
  } catch {
    return null;
  }
}

/** Also returns the base NAME, so the preview can say what is about to be deleted. */
export async function probeAirtableBase({ apiKey, baseId }) {
  if (!apiKey || !baseId) return { exists: null, name: null };
  try {
    const res = await fetch(`${AIRTABLE_API}/v0/meta/bases`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return { exists: null, name: null };
    const hit = ((await res.json())?.bases ?? []).find((b) => b.id === baseId);
    return { exists: Boolean(hit), name: hit?.name ?? null };
  } catch {
    return { exists: null, name: null };
  }
}

/* ── Clerk ────────────────────────────────────────────────────────────────── */

/**
 * Find the Clerk user for a client, when there is one to find.
 *
 * `CLERK_USER_ID` is only written to .env.local for TEST clients — onboard.js documents
 * that real clients self-serve at /portal/sign-up and are deliberately never pre-created
 * in Clerk. So for a real client the id is usually absent, and the only way to find the
 * account is by the email on the portal record. That lookup identifies a user by string-
 * matching an email rather than an id, which is why the caller marks it `resolvedBy:
 * 'email'` — the console gates that path behind its own confirmation.
 *
 * Returns `{ userId, resolvedBy } | null`. Never throws; a lookup failure is indistinguishable
 * from "no such user" to the caller, which is the safe direction to fail in.
 */
export async function resolveClerkUser({ secretKey, envUserId, email }) {
  if (envUserId) return { userId: envUserId, resolvedBy: 'env' };
  if (!secretKey || !email) return null;
  try {
    const { createClerkClient } = await import('@clerk/backend');
    const clerk = createClerkClient({ secretKey });
    const list = await clerk.users.getUserList({ emailAddress: [email] });
    const hit = list?.data?.[0];
    return hit ? { userId: hit.id, resolvedBy: 'email' } : null;
  } catch {
    return null;
  }
}

/**
 * Delete a Clerk user.
 *
 * The caller decides WHETHER to call this — it must only run once the portal account has
 * been re-read after detaching this client's site(s) and confirmed to hold zero remaining
 * sites. A user with another live site on the same account must never reach here; this
 * function has no way to know that on its own.
 */
export async function deleteClerkUser({ secretKey, userId }) {
  const started = Date.now();
  if (!userId) return skip('clerk.user', '—', 'No Clerk user resolved');
  if (!secretKey) return skip('clerk.user', userId, 'CLERK_SECRET_KEY not set');
  try {
    const { createClerkClient } = await import('@clerk/backend');
    const clerk = createClerkClient({ secretKey });
    await clerk.users.deleteUser(userId);
    return step('clerk.user', userId, 'deleted', started);
  } catch (err) {
    if (err?.status === 404) return step('clerk.user', userId, 'already-gone', started, { httpStatus: 404 });
    return step('clerk.user', userId, 'failed', started, { message: err?.message ?? String(err) });
  }
}
