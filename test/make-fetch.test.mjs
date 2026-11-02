/**
 * Make's rate limit must read as "wait", never as "unreachable".
 *
 * The bug this encodes shipped and was live. `resolveMasterResources` treated any non-OK
 * response from Make as an outage and returned null. Make answers a spent per-organization
 * minute with a 429, so whenever the org was over its budget every caller reported "Could not
 * resolve the master scenario (no Make credentials, or unreachable)" — blaming the two things
 * that were fine.
 *
 * Two visible symptoms, one cause:
 *   - `npm run fixtures:dry-run:check` reported "phase output drifted" on unchanged code about
 *     one run in three, always on the 3rd and 4th shapes, because the recorder's four back-to-
 *     back dry runs spent the minute and the later ones lost a stdout line.
 *   - `verifyNoMasterResources` — the check that stops a client being wired into the master
 *     Airtable base — silently did not run whenever that happened.
 *
 * The 429 below is the recorded response, not an invented one: plain text, not JSON, which is
 * itself the kind of detail a hand-written fixture gets wrong.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { fetchWithRetry, retryAfterMs, DEFAULT_BACKOFF_MS } from '../lib/make-fetch.js';

const RATE_LIMIT = JSON.parse(
  readFileSync(new URL('./fixtures/make/rate-limit-429.json', import.meta.url), 'utf8'),
);

const limited = (headers = {}) => new Response(RATE_LIMIT.body, { status: RATE_LIMIT.status, headers });
const okJson = () => new Response(JSON.stringify({ response: { blueprint: { flow: [] } } }), { status: 200 });

/** A fetch that serves the given responses in order, and records how it was called. */
function scripted(...responses) {
  const calls = [];
  const impl = async (url) => {
    calls.push(String(url));
    const next = responses.shift();
    if (!next) throw new Error('scripted fetch ran out of responses');
    return typeof next === 'function' ? next() : next;
  };
  return { impl, calls };
}

/** A sleep that records instead of waiting, so the real loop runs in microseconds. */
function recordingSleep() {
  const waits = [];
  return { sleep: async (ms) => { waits.push(ms); }, waits };
}

test('the recorded 429 is plain text, not JSON', () => {
  // Pins the premise. A caller that did `await res.json()` on this would throw, and the throw
  // would land in a catch that reports "unreachable" — the same wrong diagnosis by another route.
  assert.equal(RATE_LIMIT.status, 429);
  assert.throws(() => JSON.parse(RATE_LIMIT.body));
  assert.match(RATE_LIMIT.body, /limit for organization/i);
});

test('THE REGRESSION: a 429 is waited out, and the real answer comes back', async () => {
  const { impl, calls } = scripted(limited, okJson);
  const { sleep, waits } = recordingSleep();
  const res = await fetchWithRetry('https://us2.make.com/api/v2/scenarios/1/blueprint', {}, { fetchImpl: impl, sleep });
  assert.equal(res.status, 200, 'a single 429 must not end the resolution');
  assert.equal(calls.length, 2);
  assert.deepEqual(waits, [DEFAULT_BACKOFF_MS[0]]);
});

test('the default backoff spans a full rate-limit window', () => {
  // Make's limit is per minute. If the waits summed to less, the last retry could land inside
  // the same exhausted minute and fail for the same reason the first one did.
  const total = DEFAULT_BACKOFF_MS.reduce((a, b) => a + b, 0);
  assert.ok(total >= 60_000, `backoff totals ${total}ms, less than one minute`);
});

test('giving up returns the 429 — it never throws, and never pretends to be a 200', async () => {
  // Returning the 429 is what lets the caller say "rate limited" instead of "unreachable".
  const { impl, calls } = scripted(limited, limited, limited, limited);
  const { sleep, waits } = recordingSleep();
  const res = await fetchWithRetry('u', {}, { fetchImpl: impl, sleep });
  assert.equal(res.status, 429);
  assert.equal(calls.length, 1 + DEFAULT_BACKOFF_MS.length, 'one try plus one per backoff step');
  assert.deepEqual(waits, DEFAULT_BACKOFF_MS);
});

test('Retry-After is honoured over the default schedule', async () => {
  const { impl } = scripted(() => limited({ 'retry-after': '7' }), okJson);
  const { sleep, waits } = recordingSleep();
  await fetchWithRetry('u', {}, { fetchImpl: impl, sleep });
  assert.deepEqual(waits, [7_000]);
});

test('a non-429 failure is returned at once, not retried', async () => {
  // Retrying a bad credential or a missing scenario only delays the true answer, and makes a
  // 401 look like a slow network.
  for (const status of [401, 403, 404, 500]) {
    const { impl, calls } = scripted(new Response('nope', { status }));
    const { sleep, waits } = recordingSleep();
    const res = await fetchWithRetry('u', {}, { fetchImpl: impl, sleep });
    assert.equal(res.status, status);
    assert.equal(calls.length, 1, `${status} must not be retried`);
    assert.deepEqual(waits, []);
  }
});

test('Retry-After parsing: seconds, HTTP-date, junk, and a ceiling', () => {
  const now = Date.parse('2026-11-02T12:00:00Z');
  assert.equal(retryAfterMs('12', now), 12_000);
  assert.equal(retryAfterMs('Mon, 02 Nov 2026 12:00:30 GMT', now), 30_000);
  assert.equal(retryAfterMs('soon', now), null, 'unparseable falls back to the schedule');
  assert.equal(retryAfterMs(null, now), null);
  assert.equal(retryAfterMs('86400', now), 60_000, 'a day-long Retry-After must not hang a dry run');
});

// ─── and that the resolver actually USES it ───────────────────────────────────
//
// Everything above drives fetchWithRetry directly. Revert resolveMasterResources to bare
// `fetch` and all of it still passes — the same blind spot as the account-lane wiring. These
// read the source so a revert is caught in CI with no Make credentials.

function resolverSource() {
  const src = readFileSync(new URL('../onboard.js', import.meta.url), 'utf8');
  const start = src.indexOf('async function resolveMasterResources(');
  assert.ok(start >= 0, 'resolveMasterResources not found');
  const end = src.indexOf('\n}', start);
  return src.slice(start, end);
}

test('resolveMasterResources routes its GETs through the retry', () => {
  const body = resolverSource();
  assert.match(body, /fetchWithRetry\(/, 'the resolver must use fetchWithRetry');
  assert.doesNotMatch(body, /await fetch\(/, 'no GET in the resolver may bypass the retry');
});

test('the unresolved warning names a reason instead of guessing one', () => {
  const src = readFileSync(new URL('../onboard.js', import.meta.url), 'utf8');
  assert.doesNotMatch(
    src,
    /no Make credentials, or unreachable/,
    'the old fixed text blamed credentials for a rate limit',
  );
  assert.match(src, /MASTER_RESOURCES_REASON/);
  assert.match(resolverSource(), /429[\s\S]*rate limit/i, 'a 429 must be reported as a rate limit');
});
