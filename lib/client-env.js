/**
 * lib/client-env.js — the one definition of a client's `.env.local`.
 *
 * ── Why this is its own module ──────────────────────────────────────────────
 *
 * This file holds the plan-tier matrix from CLAUDE.md: which tier emails leads versus calls
 * them back, which clients get the voice stack at all, and — the subtle one — that
 * `CLIENT_FORWARD_PHONE` is the owner's real line and never the Twilio number.
 *
 * It used to live inside onboard.js, which meant the console could not reach it: onboard.js
 * imports dotenv, Anthropic, Octokit, twilio and Clerk, so importing it from a Next server
 * route would drag the whole SDK graph in and run `dotenv.config()` at module load. The
 * console therefore kept its own copy of the template — and the copy had already diverged,
 * writing a 25-second ring window where this writes 15. That is the entire reason the file
 * exists as a separate, dependency-free module: both callers can import it.
 *
 * Consumers:
 *   onboard.js                       → writes the file during provisioning
 *   console/src/lib/clientEnv.ts     → plan upgrades in /manage, via a dynamic import from
 *                                      the ops root (same pattern as reconcile-probes.js)
 *   test/*.test.mjs                  → asserts the matrix directly
 *
 * Pure: `prev` (the existing file) and `env` are arguments. Nothing here reads or writes disk.
 * (`randomUUID` is the one import, from node:crypto — no SDK graph, so the console can still
 * dynamic-import this module.)
 */
import { randomUUID } from 'node:crypto';

/**
 * How long the owner's phone rings before the call falls through to the Retell agent.
 *
 * **This number is load-bearing and has a hard ceiling.** Inbound routing dials
 * `CLIENT_FORWARD_PHONE` with this as the Twilio `<Dial timeout>`. If the forward rings long
 * enough for the owner's carrier voicemail to answer, Twilio scores the call as ANSWERED
 * (`DialCallStatus=completed`), the no-answer branch never fires, and the caller lands in a
 * voicemail box instead of the receptionist the client is paying for. The failure is
 * completely silent: the number looks configured and the agent looks healthy.
 *
 * US carrier voicemail typically answers between 20 and 30 seconds, so 20 is the ceiling and
 * 15 is the default — roughly 2–3 rings at the US cadence of ~6s per ring. Owners whose
 * voicemail picks up earlier than ~15s can still race it; that is the one case no window can
 * cover.
 *
 * Two places keep their own copy of these numbers and CANNOT import them, which is why
 * test/ring-window.test.mjs pins all of them equal:
 *   - console/src/lib/envFields.ts — bundled by Next and imported by client components, so it
 *     cannot dynamic-import from the ops root.
 *   - lib/site-routes/voice.route.ts — written verbatim into each CLIENT repo, which has no
 *     @jdd/schema or jdd-ops dependency. (Same deliberate standalone-copy exception that
 *     @jdd/schema's phone.ts documents for its own inline `toE164`.)
 */
export const RING_SECONDS_DEFAULT = 15;
export const RING_SECONDS_MIN = 5;
export const RING_SECONDS_MAX = 20;

/** Clamp a ring window into the safe band. Returns the default for anything unparseable. */
export function clampRingSeconds(raw) {
  const n = parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(n) || n <= 0) return RING_SECONDS_DEFAULT;
  return Math.min(RING_SECONDS_MAX, Math.max(RING_SECONDS_MIN, n));
}

/**
 * Mint a lead-ingest bearer token: 64 hex chars.
 *
 * `randomUUID` rather than `randomBytes` so this module stays dependency-free and importable from
 * both onboard.js and a Next route — the same constraint that put this file here in the first
 * place. Two UUIDs with the hyphens stripped is 256 bits of entropy, which is plenty for a bearer
 * credential whose only job is to identify one client site.
 *
 * The agency site's `portal-leads.ts#newIngestToken` produces the same shape, and its
 * `resolveIngestToken` rejects anything shorter than 32 chars. Two copies on purpose — the ops
 * side mints, the portal side registers, and neither repo can import the other. Nothing can pin
 * them equal across repos, so the format is asserted on THIS side by
 * `test/checks-env.test.mjs` and enforced on reads by `checkEnvTierMatrix`'s `^[0-9a-f]{64}$`.
 * If you change the shape here, change both of those and the portal's minter.
 */
export function newIngestToken() {
  const hex = () => randomUUID().replace(/-/g, '');
  return hex() + hex();
}

/**
 * The exact `.env.local` body this client should have — computed, not written.
 *
 * A dry run used to return before any of this ran, so the single most consequential
 * computation in a provisioning run was the one thing a dry run could not show you. Now the
 * dry-run checks and the test suite both assert on these lines.
 */
export function buildClientEnvLines({ siteSlug, plan, content, webOnly, prev = {}, env = {} }) {
  const keep = (k) => (prev[k] ? prev[k] : '');

  /**
   * Assembled from two parts rather than copy-pasted templates, because the shapes overlap now.
   *
   *  - Lead delivery: Starter (receptionist or web-only) hands web-form leads to the owner by
   *    email; Growth and Enterprise call them back. This matches syncVercelEnv's
   *    `LEAD_DELIVERY_MODE` exactly, which is the only intended runtime difference between a
   *    Starter-with-receptionist and a Growth site.
   *  - Voice: everything except a web-only client gets the number, agent, forwarding and call
   *    log. Starter joined this in the 2026-10-12 reprice; only a declined receptionist opts out.
   */
  const wantsCallback = plan !== 'starter';
  const wantsVoice = !webOnly;
  const lines = ['# Auto-generated by onboard.js — edit via the console /manage tab, which also syncs to Vercel. Values here are preserved on re-run.'];
  lines.push('LEAD_DELIVERY_MODE=portal');
  lines.push(`LEAD_CALLBACK=${wantsCallback ? 'on' : 'off'}`);
  /**
   * The ingest bearer token, minted HERE rather than later in the run.
   *
   * Two reasons it belongs in this template. It needs no vendor call, so there is nothing to wait
   * for. And anything written later in the run that is absent from these lines is silently
   * dropped on the next re-run unless it is in CARRIED_KEYS below — a quiet way to take a
   * client's lead capture offline. It is listed there too, so an existing value is preserved
   * rather than rotated: rotating would orphan the KV token record and 401 every later lead.
   */
  lines.push(`LEAD_INGEST_TOKEN=${keep('LEAD_INGEST_TOKEN') || newIngestToken()}`);
  lines.push(
    `LEAD_INGEST_URL=${keep('LEAD_INGEST_URL') || env.LEAD_INGEST_URL || 'https://www.juneaudigitaldesigns.com/api/ingest/lead'}`,
  );
  if (wantsVoice) {
    lines.push(`RETELL_AGENT_ID=${keep('RETELL_AGENT_ID')}`);
    lines.push(`RETELL_LLM_ID=${keep('RETELL_LLM_ID')}`);
    lines.push(`RETELL_API_KEY=${env.RETELL_API_KEY || ''}`);
    lines.push(`RETELL_SIP_DOMAIN=${env.RETELL_SIP_DOMAIN || 'sip.retellai.com'}`);
    lines.push(`TWILIO_NUMBER=${keep('TWILIO_NUMBER')}`);
    // Human-first routing: the owner's own line rings first, the agent only picks up on
    // no-answer. An existing value is preserved but clamped — see RING_SECONDS_MAX above for
    // why a long window silently sends callers to voicemail instead of the agent.
    //
    // `keep()` first, because this used to be written straight from `content.brand.phone` on
    // every run. The intake number is only ever the INITIAL forward target: once a client is
    // live, the owner's line is operational state an operator may correct — through the
    // console's Environment tab, say, when the business changes numbers. Writing brand.phone
    // unconditionally silently reverted that on the next re-run, pointing hop 1 at a number
    // the owner had already moved off, and the run reported success. Every neighbour here is
    // carried for the same reason; this one was the outlier.
    lines.push(`CLIENT_FORWARD_PHONE=${keep('CLIENT_FORWARD_PHONE') || content.brand.phone}`);
    lines.push(`CLIENT_FORWARD_RING_SECONDS=${clampRingSeconds(keep('CLIENT_FORWARD_RING_SECONDS') || RING_SECONDS_DEFAULT)}`);
    lines.push(`AIRTABLE_BASE_ID=${keep('AIRTABLE_BASE_ID')}`);
    lines.push(`RETELL_POST_CALL_WEBHOOK_URL=${keep('RETELL_POST_CALL_WEBHOOK_URL')}`);
  }
  lines.push(`VERCEL_PROJECT_NAME=${siteSlug}`);

  // Keys onboard.js writes LATER in the run (steps 8–10) and that are absent from the
  // templates above. Without this they are silently dropped on every re-run — and
  // PORTAL_ACCOUNT_EMAIL in particular is what a later `--link-portal --email` reads to know
  // which account to move the sites off.
  const CARRIED_KEYS = [
    'AIRTABLE_SITE_TAG',
    'CLERK_USER_ID',
    'PORTAL_ACCOUNT_EMAIL',
    // Written by the template above, so normally redundant — kept as belt and braces because
    // losing it silently 401s every lead, and because it is the per-client Messaging Service's
    // neighbour below, which genuinely is written later (after A2P verifies).
    'LEAD_INGEST_TOKEN',
    // Per-client Messaging Service, recorded only once the client's own A2P campaign verifies —
    // 13-20 business days after provisioning. Absent on a day-one run by design, so it MUST be
    // carried or the first re-run after verification wipes it. Deliberately NOT named
    // TWILIO_MESSAGING_SERVICE_SID: that is the master, JDD-account-lane value, and two scopes
    // sharing one name would let process.env resolution order decide which campaign a message
    // sends under.
    'CLIENT_MESSAGING_SERVICE_SID',
    // The client's own Make webhook + scenario, recorded by patchEnvLocal partway through
    // step 11 precisely so an interrupted run can adopt them instead of cloning again.
    // `cloneAndWirePostCall` already does the adopting and logs that it has. It just never
    // got the chance: step 5 rebuilds this file before step 11 reads it, and with these two
    // absent here the rebuild erased them every run.
    //
    // The failure was silent and cumulative. Each attempt created a SECOND webhook and a
    // SECOND clone, recorded the new pair over the old, and left the previous scenario
    // running — billing, holding one of the account's capped active-scenario slots, and no
    // longer named by anything in this file, so there was nothing left to find it by.
    'MAKE_POST_CALL_HOOK_ID',
    'MAKE_POST_CALL_SCENARIO_ID',
  ];
  const carried = CARRIED_KEYS.filter((k) => prev[k]);
  // Skip a carried key the templates above already wrote. LEAD_INGEST_TOKEN is deliberately in
  // both, and appending it here wrote the line TWICE on every re-run. The values matched, since
  // `keep()` reads the same `prev`, so nothing broke — but readEnvLocal takes the LAST occurrence
  // of a key, so a hand edit to the first copy would be silently overridden by the second, and a
  // file with one key on two lines reads as corrupt to whoever opens it. One key, one line.
  //
  // `carried` still lists every key preserved from the previous file, because the caller logs it
  // as "preserved"; only the duplicate LINE is dropped.
  const written = new Set(lines.map((l) => l.slice(0, l.indexOf('='))));
  for (const k of carried) {
    if (!written.has(k)) lines.push(`${k}=${prev[k]}`);
  }

  return { lines, carried };
}
