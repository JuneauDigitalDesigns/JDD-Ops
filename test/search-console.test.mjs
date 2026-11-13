// lib/search-console.js against Google's recorded behaviour (test/fixtures/google, the L11 proof).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  JDD_GSC_VERIFICATION_FILE, verificationFileBody, propertyUrl, createSearchConsoleClient,
  setupProperty, leaveProperty, verificationFileServed,
} from '../lib/search-console.js';

const fx = (name) => JSON.parse(readFileSync(new URL(`./fixtures/google/${name}.json`, import.meta.url), 'utf8'));
const PROPERTY = 'https://e2eteststarter.vercel.app/';
const OAUTH = { clientId: 'cid', clientSecret: 'SECRET-xyz', tokenUri: 'https://oauth2.example/token', refreshToken: 'REFRESH-abc' };

/** A fetch that answers from a route table and records every call. */
function fakeFetch(routes) {
  const calls = [];
  const impl = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    calls.push(`${method} ${url}`);
    if (url === OAUTH.tokenUri) return new Response(JSON.stringify({ access_token: 'ya29.x', expires_in: 3599 }), { status: 200 });
    for (const [match, reply] of routes) {
      if (match(method, url)) {
        const r = typeof reply === 'function' ? reply() : reply;
        const body = r.status === 204 ? null : typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
        return new Response(body, { status: r.status });
      }
    }
    throw new Error(`unexpected ${method} ${url}`);
  };
  return { impl, calls };
}
const on = (m, frag) => (method, url) => method === m && url.includes(frag);
const served = { status: 200, body: verificationFileBody() };
const notServed = { status: 404, body: 'Not Found' };

test('the token Google issues is the one the export writes, and it is per account', () => {
  const t = fx('token');
  assert.equal(t.body.token, JDD_GSC_VERIFICATION_FILE);
  // Google accepted exactly this body on 2026-11-13.
  assert.equal(verificationFileBody(), 'google-site-verification: google592bd3dd36f20226.html');
});

test('a property is the whole host with a trailing slash; a custom domain is a different property', () => {
  assert.equal(propertyUrl('e2eteststarter.vercel.app'), PROPERTY);
  assert.equal(propertyUrl('https://E2ETestStarter.vercel.app/'), PROPERTY);
  assert.notEqual(propertyUrl('www.example-plumbing.com'), PROPERTY);
  assert.throws(() => propertyUrl('https://e2eteststarter.vercel.app/areas/'));
});

test('teardown never asks Google to let JDD leave while the token is still served (Google answers 400)', async () => {
  const { impl, calls } = fakeFetch([
    [on('GET', JDD_GSC_VERIFICATION_FILE), served],
    [on('DELETE', '/webResource/'), fx('relinquish-while-token-served')],
  ]);
  const client = createSearchConsoleClient({ oauth: OAUTH, fetchImpl: impl });
  const out = await leaveProperty({ client, property: PROPERTY, fetchImpl: impl });
  assert.equal(out.ok, false);
  assert.match(out.detail, /still served/);
  assert.ok(!calls.some((c) => c.startsWith('DELETE')), 'no DELETE may be sent while the token is live');
});

test('teardown order once the site is gone: relinquish, then unlist', async () => {
  const { impl, calls } = fakeFetch([
    [on('GET', JDD_GSC_VERIFICATION_FILE), notServed],
    [on('DELETE', '/siteVerification/v1/webResource/'), { status: 204, body: '' }],
    [on('GET', '/webmasters/v3/sites/'), fx('sites-get-owner')],
    [on('DELETE', '/webmasters/v3/sites/'), { status: 204, body: '' }],
  ]);
  const client = createSearchConsoleClient({ oauth: OAUTH, fetchImpl: impl });
  const out = await leaveProperty({ client, property: PROPERTY, fetchImpl: impl });
  assert.deepEqual(out, { ok: true, detail: 'relinquished; unlisted' });
  const kind = (c) => (c.includes('/siteVerification/') ? 'sv' : c.includes('/webmasters/') ? 'wm' : 'file');
  assert.deepEqual(calls.filter((c) => !c.includes('oauth2')).map((c) => `${c.split(' ')[0]} ${kind(c)}`),
    ['GET file', 'DELETE sv', 'GET wm', 'DELETE wm']);
});

test('teardown of a property JDD already left is a clean no-op (403 not an owner, 404 not listed)', async () => {
  const { impl } = fakeFetch([
    [on('GET', JDD_GSC_VERIFICATION_FILE), notServed],
    [on('DELETE', '/webResource/'), fx('webresource-after-relinquish')],
    [on('GET', '/webmasters/v3/sites/'), fx('sites-get-after-unlist')],
  ]);
  const client = createSearchConsoleClient({ oauth: OAUTH, fetchImpl: impl });
  assert.deepEqual(await leaveProperty({ client, property: PROPERTY, fetchImpl: impl }), { ok: true, detail: 'not an owner; not listed' });
});

test('setup refuses before verifying when the token file is not live', async () => {
  const { impl, calls } = fakeFetch([
    [on('POST', '/siteVerification/v1/token'), fx('token')],
    [on('GET', JDD_GSC_VERIFICATION_FILE), notServed],
  ]);
  const client = createSearchConsoleClient({ oauth: OAUTH, fetchImpl: impl });
  await assert.rejects(setupProperty({ client, property: PROPERTY, fetchImpl: impl }), (e) => {
    assert.deepEqual(e.steps.map((s) => [s.name, s.ok]), [['token', true], ['file', false]]);
    return true;
  });
  assert.ok(!calls.some((c) => c.includes('/webResource?')), 'verify must not be attempted');
});

test('setup refuses when Google issues a different token than the export writes (the JDD account changed)', async () => {
  const { impl } = fakeFetch([[on('POST', '/token'), { status: 200, body: { method: 'FILE', token: 'google0000000000000000.html' } }]]);
  const client = createSearchConsoleClient({ oauth: OAUTH, fetchImpl: impl });
  await assert.rejects(setupProperty({ client, property: PROPERTY, fetchImpl: impl }), /re-export every site/);
});

test('setup runs token, file, verify, list, sitemap, owner in order', async () => {
  const { impl } = fakeFetch([
    [on('POST', '/siteVerification/v1/token'), fx('token')],
    [on('GET', JDD_GSC_VERIFICATION_FILE), served],
    [on('POST', '/webResource?verificationMethod=FILE'), fx('verify')],
    [on('PUT', '/sitemaps/'), { status: 204, body: '' }],
    [on('PUT', '/webmasters/v3/sites/'), { status: 204, body: '' }],
    [on('GET', '/siteVerification/v1/webResource/'), fx('verify')],
    [on('PUT', '/siteVerification/v1/webResource/'), { status: 200, body: { ...fx('verify').body, owners: ['owner-1@example.com', 'owner-2@example.com'] } }],
  ]);
  const client = createSearchConsoleClient({ oauth: OAUTH, fetchImpl: impl });
  const steps = await setupProperty({ client, property: PROPERTY, sitemapUrl: `${PROPERTY}sitemap.xml`, ownerEmails: ['owner-2@example.com'], fetchImpl: impl });
  assert.deepEqual(steps.map((s) => s.name), ['token', 'file', 'verify', 'list', 'sitemap', 'owner']);
  assert.equal(steps.at(-1).detail, '2 owners');
});

test('a failed refresh never echoes the refresh token or client secret', async () => {
  const impl = async () => new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'Token has been expired or revoked.' }), { status: 400 });
  const client = createSearchConsoleClient({ oauth: OAUTH, fetchImpl: impl });
  await assert.rejects(client.fileToken(PROPERTY), (e) => {
    assert.ok(!e.message.includes(OAUTH.refreshToken) && !e.message.includes(OAUTH.clientSecret));
    assert.match(e.message, /invalid_grant/);
    return true;
  });
});

test('the token file counts as served only with Google\'s exact body', async () => {
  const wrong = async () => new Response('<html>soft 404</html>', { status: 200 });
  assert.equal(await verificationFileServed(PROPERTY, { fetchImpl: wrong }), false);
  const right = async () => new Response(`${verificationFileBody()}\n`, { status: 200 });
  assert.equal(await verificationFileServed(PROPERTY, { fetchImpl: right }), true);
});

// ── The export writes the token file into every client repo (L11) ─────────────────────────────
import { mkdtempSync, rmSync, existsSync as exists } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as sc from '../lib/search-console.js';

test('writeVerificationFile puts Google\'s exact body at public/<file> and is idempotent', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gsc-'));
  try {
    assert.equal(typeof sc.writeVerificationFile, 'function');
    assert.equal(sc.writeVerificationFile(dir), `public/${JDD_GSC_VERIFICATION_FILE}`);
    assert.equal(sc.writeVerificationFile(dir), `public/${JDD_GSC_VERIFICATION_FILE}`);
    assert.equal(readFileSync(join(dir, 'public', JDD_GSC_VERIFICATION_FILE), 'utf8'), verificationFileBody());
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the console export writes the token file on every export, inside the staged repo, before the build', () => {
  const src = readFileSync(new URL('../console/src/app/api/build/export/route.ts', import.meta.url), 'utf8');
  const at = src.indexOf('.writeVerificationFile(repoDirFor(repoRoot, slug))');
  assert.ok(at > 0, 'the export must call writeVerificationFile on the staged repo');
  assert.ok(at > src.indexOf('beginStagedExport('), 'after staging begins, so it lands in the staged copy');
  assert.ok(at < src.indexOf("runNpm('run build'"), 'before the build');
  assert.ok(at < src.indexOf('staging.commit()'), 'before the staged copy replaces the repo');
});
