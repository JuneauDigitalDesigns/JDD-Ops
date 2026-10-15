import 'server-only';
import { Redis } from '@upstash/redis';
import { TY2026_SETTINGS, type FinanceSettings } from './financeTypes';

/**
 * The tax settings document — one KV key, read on every page load, edited from the Settings tab.
 *
 * These are in storage rather than in code because every one of them changes annually, and a
 * number that decides what the owner sends the IRS should be correctable in thirty seconds
 * without a code change. The seeded defaults are the TY2026 figures verified against Rev. Proc.
 * 2025-32 and the SSA fact sheet (cited in financeTypes.ts).
 *
 * Reads MERGE over the defaults rather than returning the stored document as-is. A settings doc
 * written before a field existed would otherwise come back missing that field, and the tax math
 * would quietly compute with `undefined` — NaN all the way to the headline. Merging means a new
 * constant added later arrives with a sane value for an existing install.
 */

const SETTINGS_KEY = 'jdd:finances:settings';

let _redis: Redis | null = null;

export function financeSettingsConfigured(): boolean {
  return Boolean(
    (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) &&
      (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN),
  );
}

function getRedis(): Redis {
  if (!_redis) {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) throw new Error('Finance settings not configured — KV creds missing.');
    _redis = new Redis({ url, token });
  }
  return _redis;
}

/** Defaults merged under whatever is stored. Brackets and categories replace wholesale. */
function withDefaults(stored: Partial<FinanceSettings> | null): FinanceSettings {
  if (!stored) return { ...TY2026_SETTINGS, categories: [...TY2026_SETTINGS.categories] };
  return {
    ...TY2026_SETTINGS,
    ...stored,
    brackets:
      Array.isArray(stored.brackets) && stored.brackets.length
        ? stored.brackets
        : TY2026_SETTINGS.brackets,
    categories:
      Array.isArray(stored.categories) && stored.categories.length
        ? stored.categories
        : [...TY2026_SETTINGS.categories],
  };
}

/**
 * Current settings. Never throws on a missing document — an install that has never opened the
 * Settings tab gets the verified TY2026 defaults, which is the correct starting state.
 */
export async function getFinanceSettings(): Promise<FinanceSettings> {
  const stored = await getRedis().get<Partial<FinanceSettings>>(SETTINGS_KEY);
  return withDefaults(stored);
}

/**
 * Save a partial update, merged over what is stored.
 *
 * Validation lives in the route rather than here, but one invariant is enforced at the storage
 * boundary because violating it corrupts every figure on the page: brackets must be sorted by
 * their lower edge. `applyBrackets` walks the rows in order and stops at the first one the income
 * does not clear, so an out-of-order table silently taxes at the wrong rate rather than failing.
 */
export async function saveFinanceSettings(
  patch: Partial<FinanceSettings>,
): Promise<FinanceSettings> {
  const current = await getFinanceSettings();
  const next: FinanceSettings = { ...current, ...patch };

  if (patch.brackets) {
    next.brackets = [...patch.brackets].sort((a, b) => a.overCents - b.overCents);
  }
  if (patch.categories) {
    // Trim, drop blanks, de-duplicate case-insensitively, preserve the operator's order.
    const seen = new Set<string>();
    next.categories = patch.categories
      .map((c) => c.trim())
      .filter((c) => {
        if (!c) return false;
        const k = c.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
  }

  await getRedis().set(SETTINGS_KEY, next);
  return next;
}

/** Restore the verified defaults for the current tax year. */
export async function resetFinanceSettings(): Promise<FinanceSettings> {
  const fresh: FinanceSettings = {
    ...TY2026_SETTINGS,
    categories: [...TY2026_SETTINGS.categories],
  };
  await getRedis().set(SETTINGS_KEY, fresh);
  return fresh;
}
