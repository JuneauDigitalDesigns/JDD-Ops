/**
 * Non-secret environment signals shared by the production guardrails (opsConfig.envMode,
 * go-live kv-reset guard). Hosts and key PREFIXES only, never values.
 */

/** Upstash host fragment of the production KV instance. */
export const PROD_KV_HOST_MARKER = 'tolerant-pug';
/** Upstash host fragment of the old test KV instance. */
export const TEST_KV_HOST_MARKER = 'rich-eel';

export type EnvSignal = 'production' | 'test' | 'unknown';

export function kvHostSignal(urlOrHost: string | null | undefined): EnvSignal {
  if (!urlOrHost) return 'unknown';
  if (urlOrHost.includes(PROD_KV_HOST_MARKER)) return 'production';
  if (urlOrHost.includes(TEST_KV_HOST_MARKER)) return 'test';
  return 'unknown';
}

export function isProductionKvHost(urlOrHost: string | null | undefined): boolean {
  return kvHostSignal(urlOrHost) === 'production';
}

/** Clerk / Stripe style key prefix: `sk_live_`, `rk_test_`, `pk_live_` ... */
export function keyPrefixSignal(key: string | null | undefined): EnvSignal {
  if (!key) return 'unknown';
  if (/^(sk|rk|pk)_live_/.test(key)) return 'production';
  if (/^(sk|rk|pk)_test_/.test(key)) return 'test';
  return 'unknown';
}
