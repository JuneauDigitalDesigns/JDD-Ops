/**
 * The link a not-yet-onboarded client is sent to. Client-safe: the welcome email builds it on
 * the server and the Manage card's "Copy signup link" builds it in the browser, and the two
 * must be byte-identical.
 *
 * It lands on the portal sign-up, which is the gate in front of onboarding. `redirect_url`
 * carries them on to /start with their plan preselected once they have an account. The value is
 * already percent-encoded (`/start?plan=x`), so it must not be encoded a second time.
 */
export const SIGNUP_BASE = 'https://www.juneaudigitaldesigns.com';

export function welcomeSignupUrl(plan: 'starter' | 'growth' | 'enterprise'): string {
  return `${SIGNUP_BASE}/portal/sign-up?redirect_url=%2Fstart%3Fplan%3D${plan}`;
}
