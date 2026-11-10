/**
 * The post-generation dash guard (SEO plan D5 layer 2, approved by Xander 2026-11-10).
 *
 * The prompts carry no dashes and tell the model never to write one, but a model still does
 * sometimes, and one client's home page shipped 17. So every chunk the copywriter returns is
 * scanned: a field with an em- or en-dash goes back to the model ONCE, named by path, to be
 * rewritten. If a dash survives that, the section is rejected and the Studio shows it as needing
 * review. The guard never edits text itself: "x — y" becoming "x, y" can read wrong, and a
 * silent fix is how bad copy reaches a live site unnoticed.
 *
 * Pure apart from the `rewrite` callback, so test/dash-guard.test.mjs drives it directly; the
 * route passes a callback that asks the real model.
 */

const DASH = /[–—]/;

/** Dotted paths of every string in `value` that carries an em- or en-dash. */
export function findDashes(value: unknown, prefix = ''): string[] {
  if (typeof value === 'string') return DASH.test(value) ? [prefix] : [];
  if (Array.isArray(value)) return value.flatMap((v, i) => findDashes(v, prefix ? `${prefix}.${i}` : String(i)));
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => findDashes(v, prefix ? `${prefix}.${k}` : k));
  }
  return [];
}

/** The follow-up instruction for one rewrite. Wording is part of the prompt Xander approves. */
export function dashRewriteMessage(paths: string[]): string {
  return [
    `These fields contain an em-dash or en-dash: ${paths.join(', ')}.`,
    'Rewrite only those fields without any em-dash or en-dash. Use a full stop or a comma instead, and write ranges as "1 to 2".',
    'Keep every other field exactly as it was, and return the whole JSON object again.',
  ].join(' ');
}

export interface DashGuardResult<T> {
  result: T;
  /** True when the model was asked for a rewrite. */
  rewritten: boolean;
  /** Fields that still carry a dash after the one rewrite. Non-empty means: reject the section. */
  stillDashed: string[];
}

export async function guardDashes<T>(
  result: T,
  rewrite: (paths: string[]) => Promise<T>,
): Promise<DashGuardResult<T>> {
  const first = findDashes(result);
  if (first.length === 0) return { result, rewritten: false, stillDashed: [] };
  const second = await rewrite(first);
  return { result: second, rewritten: true, stillDashed: findDashes(second) };
}
