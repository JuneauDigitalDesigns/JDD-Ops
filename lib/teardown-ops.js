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
// The ONE accountScope implementation, pinned byte-identical to the agency's by
// test/lead-ingest.test.mjs. Imported rather than re-derived: a mismatch hashes to a scope that
// owns nothing, and a purge under it would report success having deleted nothing at all.
import { accountScope as scopeFor, leadIngestTokenKey as ingestTokenKey } from './account-store.js';

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
/**
 * Drop the portal's number→site index for a released number.
 *
 * `portal:number-owner:v1:{e164}` is how the inbound-SMS webhook decides whose thread a
 * reply belongs to (agency `app/lib/portal-crm.ts`). The key carries NO account scope and
 * NO TTL, and **Twilio recycles released numbers** — so a number released from one client
 * and later reassigned to an unrelated business routes that stranger's inbound SMS straight
 * into the former client's conversation. Nothing errors; the webhook finds an owner and
 * believes it.
 *
 * Raw REST rather than `@upstash/redis` because this module's contract is that credentials
 * are arguments: `account-store.js` builds its client from `process.env`, which is populated
 * under the CLI and NOT inside a Next route, and the documented consequence of reading env
 * in here is a delete that silently no-ops and reports success.
 */
async function clearNumberOwnerIndex({ kvUrl, kvToken, phoneNumber }) {
  const base = String(kvUrl).replace(/\/+$/, '');
  const res = await fetch(`${base}/del/portal:number-owner:v1:${encodeURIComponent(phoneNumber)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${kvToken}` },
  });
  if (!res.ok) throw new Error(`KV del returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

export async function releaseTwilioNumber({ accountSid, authToken, phoneNumber, kvUrl, kvToken }) {
  const started = Date.now();
  if (!phoneNumber) return skip('twilio.number', '—', 'No TWILIO_NUMBER recorded');
  if (!accountSid || !authToken) return skip('twilio.number', phoneNumber, 'Twilio credentials not set');

  // The index goes FIRST, and a failure here stops the release.
  //
  // The two failure modes are not equally bad. Keeping a number we meant to release costs
  // about $2/month and is visible on the next invoice. Releasing one whose index survives
  // misroutes a stranger's private messages into a former client's inbox, indefinitely, with
  // nothing to notice — and it cannot be undone, because the number is gone and cannot be
  // re-acquired to find out who holds it now. So when in doubt, keep paying.
  if (!kvUrl || !kvToken) {
    return skip('twilio.number', phoneNumber, 'KV credentials not set — refusing to release without clearing portal:number-owner');
  }
  try {
    await clearNumberOwnerIndex({ kvUrl, kvToken, phoneNumber });
  } catch (err) {
    return step('twilio.number', phoneNumber, 'failed', started, {
      message: `number-owner index not cleared (${err.message}) — number deliberately NOT released`,
    });
  }

  try {
    const { default: twilio } = await import('twilio');
    const client = twilio(accountSid, authToken);
    const matches = await client.incomingPhoneNumbers.list({ phoneNumber, limit: 1 });
    // Not owned by the master account — already released, or never ours. The index is cleared
    // either way, which is the point: a stale index outlives our ownership of the number.
    if (!matches.length) return step('twilio.number', phoneNumber, 'already-gone', started);
    await client.incomingPhoneNumbers(matches[0].sid).remove();
    return step('twilio.number', phoneNumber, 'deleted', started, { message: matches[0].sid });
  } catch (err) {
    return step('twilio.number', phoneNumber, 'failed', started, { message: err.message });
  }
}

/* ── Retell ───────────────────────────────────────────────────────────────── */

/* ── Portal data in KV ───────────────────────────────────────────────────── */

/**
 * Is this KV key one of THIS site's portal records?
 *
 * Every lead and CRM key the agency writes is scoped `…:{acctScope}:{slug}`, either ending
 * there (the index keys) or continuing with `:{id}`. The match has to stop at a boundary,
 * because a slug can be a prefix of another site's slug on the same account — `acme` and
 * `acme-2` under one owner is ordinary for an enterprise client. A purge built on the glob
 * `…:{acct}:{slug}*` would delete the sibling's leads along with this site's, irreversibly.
 *
 * The SCAN in purgePortalSiteData already respects the boundary — one pattern ends at the slug,
 * the other requires `:` after it. This is the same rule stated a second time, as a pure
 * function, so the guarantee does not rest on glob syntax being right: a single `{slug}*` slip in
 * a pattern would silently bring sibling deletion back, and nothing would look wrong until a
 * client noticed their leads were gone. Every key is checked here before it can be deleted.
 *
 * Account-scoped families (`portal:review:sent:v1:{acct}:{e164}`,
 * `portal:crm:v2:owner-email:{acct}`) never match, because no slug follows the account
 * scope. That is deliberate: one portal account can hold several sites — both e2e fixtures
 * share one — so those keys belong to the account, not to the site being torn down.
 */
export function isSiteScopedKey(key, acctScope, slug) {
  const k = String(key ?? '');
  if (!k.startsWith('portal:') || !acctScope || !slug) return false;
  const scope = `:${acctScope}:${slug}`;
  const at = k.indexOf(scope);
  if (at < 0) return false;
  const next = k.charAt(at + scope.length);
  return next === '' || next === ':';
}


/** One Upstash REST command in path form, arguments URL-encoded. Returns `result` or throws. */
async function kv(base, kvToken, args, fetchImpl) {
  const path = args.map((a) => encodeURIComponent(String(a))).join('/');
  // POST for every command, reads included — the same form clearNumberOwnerIndex already uses
  // for its DEL, so there is one request shape to trust rather than two.
  const res = await fetchImpl(`${base}/${path}`, { method: 'POST', headers: { Authorization: `Bearer ${kvToken}` } });
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.error) throw new Error(`KV ${args[0]} returned ${res.status}: ${body?.error ?? ''}`.trim());
  return body?.result;
}

/**
 * Purge one site's portal records from KV: its leads, its CRM data, and its ingest token.
 *
 * Teardown used to leave all of it. The site was gone but its leads and CRM contacts — names,
 * phone numbers, message threads — sat in KV indefinitely with nothing left to find them by,
 * and the ingest token stayed a live credential pointing at a dead client.
 *
 * The scope comes from the ingest token's own record when there is one, because that record is
 * exactly what the agency used to file every lead (`{ acctScope, slug }`). Deriving it from
 * PORTAL_ACCOUNT_EMAIL is the fallback: a `--link-portal --email` move re-points the token, so
 * after a move the email in `.env.local` can name an account the leads no longer live under.
 *
 * Missing credentials or an unidentifiable site is `skipped` — never a quiet success — and
 * unlike releaseTwilioNumber this does not block anything else: leaving data behind is a
 * hygiene failure the operator can re-run, not a leak to a stranger.
 *
 * @param {{ kvUrl?: string, kvToken?: string, siteSlug?: string, accountEmail?: string,
 *           ingestToken?: string, dryRun?: boolean, fetchImpl?: typeof fetch }} args
 *   `accountEmail` is the fallback when there is no token record — PORTAL_ACCOUNT_EMAIL.
 */
export async function purgePortalSiteData({ kvUrl, kvToken, siteSlug, accountEmail, ingestToken, dryRun = false, fetchImpl = fetch }) {
  const started = Date.now();
  const target = siteSlug ?? '—';
  if (!kvUrl || !kvToken) {
    return skip('portal.data', target, "No KV credentials — this site's leads and CRM records were NOT purged.");
  }
  const base = String(kvUrl).replace(/\/+$/, '');

  try {
    let scope = accountEmail ? scopeFor(accountEmail) : null;
    let slug = siteSlug ?? null;
    let source = 'PORTAL_ACCOUNT_EMAIL';
    if (ingestToken) {
      const raw = await kv(base, kvToken, ['get', ingestTokenKey(ingestToken)], fetchImpl);
      const rec = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (rec?.acctScope && rec?.slug) {
        if (slug && rec.slug !== slug) {
          // The token says leads were filed under another slug. Trust the token for the purge —
          // it is what the agency actually wrote under — but say so, because it means this
          // site's .env.local and the portal disagree about what the site is called.
          source = `ingest token (filed as "${rec.slug}", not "${slug}")`;
        } else {
          source = 'ingest token';
        }
        scope = rec.acctScope;
        slug = rec.slug;
      }
    }
    if (!scope || !slug) {
      return skip('portal.data', target, "No portal account or ingest token recorded — nothing identifies which records are this site's, so none were touched.");
    }

    const found = new Set();
    // SCAN narrows; isSiteScopedKey decides. Two patterns cover "ends at the slug" and
    // "continues past it"; the boundary check removes any sibling-slug bleed from either.
    for (const pattern of [`portal:*:${scope}:${slug}`, `portal:*:${scope}:${slug}:*`]) {
      let cursor = '0';
      let pages = 0;
      do {
        const [next, keys] = await kv(base, kvToken, ['scan', cursor, 'match', pattern, 'count', 500], fetchImpl);
        for (const key of keys ?? []) if (isSiteScopedKey(key, scope, slug)) found.add(key);
        cursor = String(next);
        // Bounded: a cursor that never returns to 0 must not hang a teardown.
        if (++pages > 1000) throw new Error('SCAN did not terminate after 1000 pages');
      } while (cursor !== '0');
    }
    if (ingestToken) found.add(ingestTokenKey(ingestToken));

    const keys = [...found].sort();
    if (dryRun) {
      return step('portal.data', slug, 'skipped', started, { message: `Would purge ${keys.length} portal record(s) for "${slug}" (scope from ${source}).`, keys });
    }
    let deleted = 0;
    for (let i = 0; i < keys.length; i += 50) {
      deleted += Number(await kv(base, kvToken, ['del', ...keys.slice(i, i + 50)], fetchImpl)) || 0;
    }
    // Nothing to delete is `already-gone`, like every other primitive here — not a `deleted`
    // carrying a zero, which reads as success at a glance.
    return step('portal.data', slug, deleted > 0 ? 'deleted' : 'already-gone', started, {
      message: `Purged ${deleted} portal record(s) for "${slug}" (scope from ${source}).`,
      keys,
    });
  } catch (err) {
    return step('portal.data', target, 'failed', started, { message: `Portal data NOT fully purged: ${err?.message ?? err}` });
  }
}

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
