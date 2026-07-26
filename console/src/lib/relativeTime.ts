/**
 * Compact relative time for the roster and the deployments list — "4h", "2d", "just now".
 *
 * Terse on purpose: these sit in table cells where "about 4 hours ago" would either wrap
 * or force the column wider than the data deserves.
 */
export function relativeTime(input: number | string | null | undefined): string {
  if (input === null || input === undefined) return '—';
  const ms = typeof input === 'number' ? input : Date.parse(input);
  if (!Number.isFinite(ms)) return '—';

  const seconds = Math.round((Date.now() - ms) / 1000);
  if (seconds < 0) return 'just now'; // clock skew — don't render "in 3m"
  if (seconds < 45) return 'just now';
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h`;
  if (seconds < 2_592_000) return `${Math.round(seconds / 86_400)}d`;
  if (seconds < 31_536_000) return `${Math.round(seconds / 2_592_000)}mo`;
  return `${Math.round(seconds / 31_536_000)}y`;
}

/** Full timestamp for a title attribute, so the terse form stays hoverable. */
export function absoluteTime(input: number | string | null | undefined): string | undefined {
  if (input === null || input === undefined) return undefined;
  const ms = typeof input === 'number' ? input : Date.parse(input);
  return Number.isFinite(ms) ? new Date(ms).toLocaleString() : undefined;
}
