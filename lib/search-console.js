/**
 * lib/search-console.js — JDD's own Google Search Console access (L11).
 *
 * JDD verifies every client site itself; the client grants nothing. One JDD Google Workspace
 * account does it, through an OAuth Desktop client and a stored refresh token, because the
 * organization enforces `iam.disableServiceAccountKeyCreation` (so no service-account key exists).
 * Proven end to end on e2eteststarter.vercel.app on 2026-11-13: token → verify → sites.add →
 * sitemap → searchAnalytics → add owner → relinquish → unlist.
 *
 * Credentials are two files OUTSIDE every repo, named by the ops `.env`:
 *   GOOGLE_OAUTH_CLIENT_FILE           the Desktop client JSON ({"installed": {...}})
 *   GOOGLE_SEARCH_CONSOLE_TOKEN_FILE   {refresh_token, ...}, written by scripts/google-sign-in.js
 * Nothing here ever logs the refresh token, an access token or the client secret.
 *
 * Facts recorded by the proof, each load-bearing:
 * - The FILE verification token belongs to the ACCOUNT, not the site: the same
 *   `google592bd3dd36f20226.html` came back for three different sites. So the export writes one
 *   fixed file, offline, and `verifySite` checks Google still issues that name.
 * - A URL-prefix property is `https://<host>/`, trailing slash and all. It covers one host only:
 *   a custom domain attached later is a NEW property, not the vercel.app one.
 * - A client added with `webResource.update` shows as "Owner" in Users and permissions, but under
 *   Ownership verification it is a "Delegated owner" with no token of its own. Google: when no
 *   verified owner is left, delegated owners lose access after an unstated grace period.
 * - `webResource.delete` returns 400 while JDD's token is still served ("You cannot unverify your
 *   ownership of this site until your verification token ... has been removed"). So teardown
 *   removes the site first, then relinquishes, then unlists (`sites.delete`), in that order.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export const GSC_SCOPES = Object.freeze([
  'https://www.googleapis.com/auth/webmasters',
  'https://www.googleapis.com/auth/siteverification',
]);

/** The JDD account's FILE token. Public by nature: every verified site serves it. */
export const JDD_GSC_VERIFICATION_FILE = 'google592bd3dd36f20226.html';

const SV = 'https://www.googleapis.com/siteVerification/v1';
const WM = 'https://www.googleapis.com/webmasters/v3';

export function isVerificationFileName(name) {
  return typeof name === 'string' && /^google[0-9a-f]{16}\.html$/.test(name);
}

/** The exact body Google expects in the FILE token. */
export function verificationFileBody(name = JDD_GSC_VERIFICATION_FILE) {
  if (!isVerificationFileName(name)) throw new Error(`not a Google verification file name: ${name}`);
  return `google-site-verification: ${name}`;
}

/**
 * Write the token file into a client repo: `public/<file>`, which Next serves at `/<file>`.
 * The console export calls this on every export, so a site keeps its verification for as long
 * as JDD exports it; Google re-checks the token, and a missing one ends JDD's ownership.
 * Returns the repo-relative path written.
 */
export function writeVerificationFile(repoDir, file = JDD_GSC_VERIFICATION_FILE) {
  const dir = join(repoDir, 'public');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, file), verificationFileBody(file));
  return `public/${file}`;
}

/**
 * The URL-prefix property for a host: `https://<host>/`. Accepts a bare host or an origin and
 * refuses anything with a path, because a property with a path covers only that path.
 */
export function propertyUrl(hostOrOrigin) {
  if (typeof hostOrOrigin !== 'string' || !hostOrOrigin.trim()) throw new Error('propertyUrl needs a host');
  const raw = hostOrOrigin.trim();
  const u = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`);
  if (u.pathname !== '/' || u.search || u.hash) throw new Error(`a property is a whole host, not ${raw}`);
  if (u.port) throw new Error(`a property host has no port: ${raw}`);
  return `https://${u.hostname.toLowerCase()}/`;
}

/** Reads the two credential files named by the env. Returns null when either is unset. */
export function loadGoogleOAuth(env = process.env) {
  const clientFile = env.GOOGLE_OAUTH_CLIENT_FILE;
  const tokenFile = env.GOOGLE_SEARCH_CONSOLE_TOKEN_FILE;
  if (!clientFile || !tokenFile) return null;
  const client = JSON.parse(readFileSync(clientFile, 'utf8')).installed;
  if (!client?.client_id || !client?.client_secret) throw new Error('GOOGLE_OAUTH_CLIENT_FILE is not a Desktop-app client');
  const { refresh_token: refreshToken } = JSON.parse(readFileSync(tokenFile, 'utf8'));
  if (!refreshToken) throw new Error('GOOGLE_SEARCH_CONSOLE_TOKEN_FILE holds no refresh token');
  return { clientId: client.client_id, clientSecret: client.client_secret, tokenUri: client.token_uri || 'https://oauth2.googleapis.com/token', refreshToken };
}

export class GoogleApiError extends Error {
  constructor(method, url, status, body) {
    const msg = body?.error?.message ?? (typeof body === 'string' ? body : '');
    super(`${method} ${url.replace(/\?.*$/, '')} → ${status}${msg ? `: ${msg}` : ''}`);
    this.status = status;
    this.body = body;
  }
}

/**
 * A small client over the two APIs. `fetchImpl` is injectable so tests replay recorded
 * responses; production passes nothing.
 */
export function createSearchConsoleClient({ oauth, fetchImpl = fetch }) {
  if (!oauth) throw new Error('Google Search Console is not configured (GOOGLE_OAUTH_CLIENT_FILE / GOOGLE_SEARCH_CONSOLE_TOKEN_FILE)');
  let cached = null;

  async function accessToken() {
    if (cached && cached.exp > Date.now() + 60_000) return cached.token;
    const r = await fetchImpl(oauth.tokenUri, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: oauth.refreshToken, client_id: oauth.clientId, client_secret: oauth.clientSecret }),
    });
    const j = await r.json().catch(() => ({}));
    // Only the error code is surfaced: Google's descriptions never carry the token, but the
    // request body did, so nothing from it is echoed.
    if (!r.ok || !j.access_token) throw new Error(`Google sign-in refresh failed (${r.status}${j.error ? `: ${j.error}` : ''}). Re-run the one-time sign-in.`);
    cached = { token: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
    return cached.token;
  }

  async function call(method, url, body) {
    const r = await fetchImpl(url, {
      method,
      headers: { authorization: `Bearer ${await accessToken()}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    if (!r.ok) throw new GoogleApiError(method, url, r.status, json);
    return json;
  }

  const site = (url) => ({ site: { type: 'SITE', identifier: url } });
  const id = (url) => encodeURIComponent(url);

  return {
    /** The account's FILE token name for this property. */
    async fileToken(property) {
      const j = await call('POST', `${SV}/token`, { ...site(property), verificationMethod: 'FILE' });
      return j.token;
    },
    /** Verify with the FILE method. Google fetches `${property}${file}` itself. */
    async verify(property) {
      return call('POST', `${SV}/webResource?verificationMethod=FILE`, site(property));
    },
    async webResource(property) {
      return call('GET', `${SV}/webResource/${id(property)}`);
    },
    /** Adds owners, keeping every existing one. Returns the resulting owner list. */
    async addOwners(property, emails) {
      const cur = await call('GET', `${SV}/webResource/${id(property)}`);
      const owners = [...new Set([...(cur.owners ?? []), ...emails])];
      const out = await call('PUT', `${SV}/webResource/${id(property)}`, { ...cur, owners });
      return out.owners ?? [];
    },
    /** JDD gives up its own ownership. Google refuses (400) while JDD's token is still served. */
    async relinquish(property) {
      await call('DELETE', `${SV}/webResource/${id(property)}`);
    },
    async addSite(property) {
      await call('PUT', `${WM}/sites/${id(property)}`);
    },
    /** `{siteUrl, permissionLevel}`, or null when the property isn't in JDD's list. */
    async getSite(property) {
      try {
        return await call('GET', `${WM}/sites/${id(property)}`);
      } catch (e) {
        if (e instanceof GoogleApiError && e.status === 404) return null;
        throw e;
      }
    },
    /** Removes the property from JDD's own Search Console list. Other owners keep it. */
    async unlistSite(property) {
      await call('DELETE', `${WM}/sites/${id(property)}`);
    },
    async submitSitemap(property, sitemapUrl) {
      await call('PUT', `${WM}/sites/${id(property)}/sitemaps/${id(sitemapUrl)}`);
    },
    async searchAnalytics(property, query) {
      return call('POST', `${WM}/sites/${id(property)}/searchAnalytics/query`, query);
    },
  };
}

/** Is JDD's token file live on the property right now? Google's own check fetches the same URL. */
export async function verificationFileServed(property, { fetchImpl = fetch, file = JDD_GSC_VERIFICATION_FILE } = {}) {
  try {
    const r = await fetchImpl(`${property}${file}`, { redirect: 'manual', cache: 'no-store' });
    if (r.status !== 200) return false;
    return (await r.text()).trim() === verificationFileBody(file);
  } catch {
    return false;
  }
}

/**
 * Setup for one property: verify, list it, submit its sitemap, add the client as owner.
 * Idempotent: every step is safe to repeat. Returns a step log; throws on the first hard failure
 * with the log attached as `err.steps`.
 */
export async function setupProperty({ client, property, sitemapUrl, ownerEmails = [], fetchImpl = fetch }) {
  const steps = [];
  const step = async (name, fn) => {
    try {
      const detail = await fn();
      steps.push({ name, ok: true, ...(detail ? { detail } : {}) });
    } catch (err) {
      steps.push({ name, ok: false, detail: err.message });
      err.steps = steps;
      throw err;
    }
  };
  await step('token', async () => {
    const t = await client.fileToken(property);
    if (t !== JDD_GSC_VERIFICATION_FILE) {
      throw new Error(`Google now issues ${t} for this account, but the export writes ${JDD_GSC_VERIFICATION_FILE}. Update JDD_GSC_VERIFICATION_FILE and re-export every site first.`);
    }
  });
  await step('file', async () => {
    if (!(await verificationFileServed(property, { fetchImpl }))) {
      throw new Error(`${property}${JDD_GSC_VERIFICATION_FILE} isn't live yet. Export and deploy the site, then try again.`);
    }
  });
  await step('verify', async () => { await client.verify(property); });
  await step('list', async () => { await client.addSite(property); });
  if (sitemapUrl) await step('sitemap', async () => { await client.submitSitemap(property, sitemapUrl); });
  if (ownerEmails.length) await step('owner', async () => `${(await client.addOwners(property, ownerEmails)).length} owners`);
  return steps;
}

/**
 * Teardown for one property, in the order Google requires: the token must already be gone
 * (teardown deletes the repo and Vercel project before this runs), then JDD relinquishes, then
 * the property comes off JDD's list. A property JDD never had, or already left, is a no-op.
 */
export async function leaveProperty({ client, property, fetchImpl = fetch }) {
  if (await verificationFileServed(property, { fetchImpl })) {
    return { ok: false, detail: `${property}${JDD_GSC_VERIFICATION_FILE} is still served, and Google refuses to let JDD leave until it's gone.` };
  }
  let relinquished = 'not an owner';
  try {
    await client.relinquish(property);
    relinquished = 'relinquished';
  } catch (e) {
    // 403 "You are not an owner of this site." — already left, or never verified.
    if (!(e instanceof GoogleApiError && (e.status === 403 || e.status === 404))) return { ok: false, detail: e.message };
  }
  const listed = await client.getSite(property).catch(() => null);
  if (listed) {
    try { await client.unlistSite(property); } catch (e) { return { ok: false, detail: e.message }; }
  }
  return { ok: true, detail: `${relinquished}; ${listed ? 'unlisted' : 'not listed'}` };
}
