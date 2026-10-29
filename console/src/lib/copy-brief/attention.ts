/**
 * Per-block "needs your attention" counts for the Brief stepper.
 *
 * Deliberately NOT derived from `_meta.missing_fields`. That list holds *intake-form* paths
 * which only partly overlap SiteContent paths, and every vertical preset hardcodes an
 * identical five-entry list (see lib/flags.ts's own caveat) — so a badge built from it would
 * show the same number for every client regardless of what the client actually supplied.
 *
 * What IS honest is a real empty-value count, and only one block has a well-defined notion of
 * it: Facts, whose paths are exactly the facts the copywriter reads (COPY_FACT_PATHS). Every
 * other block is either prose with a vertical default (never "missing"), a chip picker where
 * zero selections is a legitimate answer, or a count table that always has counts. Those
 * return 0 rather than a fabricated number — the stepper shows them a status dot only.
 */
import { getPath } from '@/lib/merge';
import type { SiteContent } from '@/data/site';
import { COPY_FACT_PATHS } from './facts';

/** Matches resolveFacts's own "filled" test, inverted — one definition of empty, not two. */
function isEmptyValue(v: unknown): boolean {
  if (Array.isArray(v)) return v.length === 0;
  return String(v ?? '').trim().length === 0;
}

/** The fact paths the copywriter reads that currently have no value. */
export function emptyFactPaths(content: SiteContent): string[] {
  return COPY_FACT_PATHS.filter((p) => isEmptyValue(getPath(content, p)));
}

/** True when this path carried a value in the client's own intake, as opposed to arriving
 *  from the vertical preset or being typed by the operator. Drives the Facts block's
 *  from-intake / preset source chips. */
export function cameFromIntake(imported: SiteContent | null, path: string): boolean {
  if (!imported) return false;
  return !isEmptyValue(getPath(imported, path));
}

/** The set of fact paths the client's intake supplied — computed once per render by IntakeStep
 *  and threaded down, so the Facts editor doesn't re-walk `imported` for every field. */
export function intakeFactPaths(imported: SiteContent | null): Set<string> {
  const s = new Set<string>();
  if (!imported) return s;
  for (const p of COPY_FACT_PATHS) if (cameFromIntake(imported, p)) s.add(p);
  return s;
}

/**
 * How many fact paths the Client intake step still wants filled.
 *
 * This replaced a `blockAttention(block, content)` that switched on block kind and returned a
 * real count for `facts` and 0 for everything else. Once `facts` stopped being a rendered
 * block that function could only ever return 0 — a helper that always returns zero is a trap
 * for whoever reads it next, so the count is now named for the one step that carries it.
 */
export function intakeAttention(content: SiteContent): number {
  return emptyFactPaths(content).length;
}
