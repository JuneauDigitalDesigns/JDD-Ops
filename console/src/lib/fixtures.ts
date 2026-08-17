/**
 * Whether `_`-prefixed clients count as real, decided in ONE place.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * The fixture concept was built to keep `_e2e-*` test data off the roster, and it was right
 * to. But during the phase where the six-vendor stack is still being stood up, the fixtures
 * ARE the working clients — `_e2e_test_growth` ("Your HVAC Co.") has a live site, a Twilio
 * number, a Retell agent, an Airtable base, a subscription and a featured opt-in, and is the
 * only client with anything to report.
 *
 * The briefing hardcoded `includeFixtures: false`, so the console's front door said "nothing
 * wrong" about a population it could not see. That is the precise failure its own docstring
 * claims to prevent, and a dashboard that reports calm because it never looked is worse than
 * no dashboard.
 *
 * ── The contract ────────────────────────────────────────────────────────────
 *
 *   explicit request param  >  CONSOLE_INCLUDE_FIXTURES  >  false
 *
 * The explicit param wins so the roster's existing UI toggle (localStorage
 * `console:fixtures` → `?fixtures=1`, see IndexControls.tsx) keeps working unchanged in both
 * directions — including turning fixtures OFF while the env flag is on.
 *
 * At go-live: unset the flag and run `npm run backfill-client-records -- --purge-fixtures
 * --apply`. Those two steps are the whole cleanup, and RUNBOOK.md says so.
 */

/** Test-phase switch. Set `CONSOLE_INCLUDE_FIXTURES=1` in `console/.env.local`. */
export function fixturesIncludedByDefault(): boolean {
  return process.env.CONSOLE_INCLUDE_FIXTURES === '1';
}

/**
 * Resolve the policy for one request.
 *
 * `undefined`/`null` means the caller had no opinion and the env default applies. A caller
 * that genuinely means "exclude" must pass `false` — which is why this takes a nullable
 * boolean rather than defaulting an absent param to `false` at the call site.
 */
export function resolveIncludeFixtures(explicit?: boolean | null): boolean {
  return explicit ?? fixturesIncludedByDefault();
}

/**
 * Read the `?fixtures=` param the roster already sends, as a tri-state.
 *
 * `?fixtures=1` → true, `?fixtures=0` → false, absent → null (defer to the env flag).
 * The roster only ever sends it when ON today, but honouring an explicit `0` means the
 * toggle can still turn fixtures off during the test phase.
 */
export function fixturesParam(url: URL): boolean | null {
  const raw = url.searchParams.get('fixtures');
  if (raw === null) return null;
  return raw === '1' || raw === 'true';
}
