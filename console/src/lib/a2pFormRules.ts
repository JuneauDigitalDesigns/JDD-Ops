/**
 * Small rules for the sales-call SMS registration form. Pure and free of `@jdd/schema`, which
 * the console's test runner can't load from a `.ts` file, so the test runs the real thing.
 */

/** "arthursplumbing.com" gets the scheme the registration checks and Twilio both require. */
export function formWebsite(raw: string): string {
  const v = raw.trim();
  if (!v || /^https?:\/\//i.test(v)) return v;
  return /\S+\.\S+/.test(v) ? `https://${v}` : v;
}

/**
 * Registration test mode: runs the whole form and its real checks, sends nothing to Twilio, and
 * saves nothing. Needs the explicit flag AND no Twilio credentials, so a console that merely lost
 * its credentials can't report a filing that never happened, and one with real credentials can't
 * be switched into pretending.
 */
export function a2pTestMode(env: Record<string, string | undefined>): boolean {
  return env.A2P_TEST_MODE === '1' && !(env.TWILIO_ACCOUNT_SID ?? '').trim() && !(env.TWILIO_AUTH_TOKEN ?? '').trim();
}
