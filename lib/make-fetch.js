/**
 * lib/make-fetch.js — a fetch that waits out Make's rate limit instead of reporting it as an outage.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * Make enforces an API request limit per ORGANIZATION, per minute, and answers over it with:
 *
 *   429  "Requests limit for organization exceeded, please try again later."
 *
 * `resolveMasterResources` treated any non-OK response as "unreachable" and returned null. Its
 * callers then reported "Could not resolve the master scenario (no Make credentials, or
 * unreachable) — not checked." The credentials were fine and Make was reachable; the
 * organization had simply spent its minute. So the diagnosis pointed at the one thing that was
 * not wrong.
 *
 * It surfaced as `npm run fixtures:dry-run:check` reporting "onboard.js's phase output
 * drifted" on unchanged code. The recorder runs four dry runs back to back, each making several
 * Make calls, so the third and fourth shapes (web-only, enterprise) intermittently hit the limit,
 * lost the "✓ No master resources in use" line from stdout, and differed from their recording.
 * A guard CLAUDE.md tells you to run before committing was red about one time in three, for a
 * reason that had nothing to do with the code it guards — which is how a guard gets ignored.
 *
 * The cost was not only a flaky check. `verifyNoMasterResources` is what stops a client being
 * wired into the master Airtable base, and under a rate limit it silently did not run.
 *
 * ── What it does ────────────────────────────────────────────────────────────
 *
 * Retries 429 only, and only a bounded number of times. Honours `Retry-After` when Make sends
 * it; otherwise backs off on a schedule that spans one rate-limit window, so the last attempt
 * lands in a fresh minute. Anything else — 401, 404, 500, a thrown network error — is returned
 * or thrown untouched on the first attempt, because retrying a bad credential or a missing
 * scenario only delays the true answer.
 *
 * Never throws on 429. After the last retry it returns the 429 Response, so the caller can say
 * "rate limited" rather than "unreachable", which is the whole difference.
 *
 * `fetchImpl` and `sleep` are injectable so the test suite drives the real retry loop in
 * milliseconds against a recorded 429 body.
 */

/** Waits that together cover one per-minute window: 5 + 15 + 40 = 60s. */
export const DEFAULT_BACKOFF_MS = [5_000, 15_000, 40_000];

/** Never wait longer than this for a single Retry-After, whatever the server asks for. */
const MAX_SINGLE_WAIT_MS = 60_000;

/**
 * `Retry-After` is either delta-seconds or an HTTP-date. Returns ms, or null if absent/unparseable.
 * @param {string | null} header
 */
export function retryAfterMs(header, now = Date.now()) {
  if (header == null || header === '') return null;
  const secs = Number(header);
  if (Number.isFinite(secs) && secs >= 0) return Math.min(secs * 1000, MAX_SINGLE_WAIT_MS);
  const at = Date.parse(header);
  if (Number.isFinite(at)) return Math.min(Math.max(at - now, 0), MAX_SINGLE_WAIT_MS);
  return null;
}

/**
 * @param {string} url
 * @param {RequestInit} [init]
 * @param {{
 *   fetchImpl?: typeof fetch,
 *   sleep?: (ms: number) => Promise<void>,
 *   backoffMs?: number[],
 *   onRetry?: (info: { attempt: number, waitMs: number, status: number }) => void,
 * }} [opts]
 * @returns {Promise<Response>}
 */
export async function fetchWithRetry(url, init, opts = {}) {
  const {
    fetchImpl = fetch,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    backoffMs = DEFAULT_BACKOFF_MS,
    onRetry,
  } = opts;

  let res = await fetchImpl(url, init);
  for (let attempt = 0; res.status === 429 && attempt < backoffMs.length; attempt++) {
    const waitMs = retryAfterMs(res.headers?.get?.('retry-after') ?? null) ?? backoffMs[attempt];
    onRetry?.({ attempt: attempt + 1, waitMs, status: res.status });
    // Drain the body so the connection is released while we wait.
    await res.arrayBuffer?.().catch(() => {});
    await sleep(waitMs);
    res = await fetchImpl(url, init);
  }
  return res;
}
