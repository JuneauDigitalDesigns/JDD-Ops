/**
 * A chip list whose add box saves as you type (autosave, Xander 2026-11-10).
 *
 * The text being typed is already the last item of the saved list (the "live" item), so it is
 * never waiting on Add: a step change, a reload or a closed tab keeps it. Enter, Add or leaving
 * the box only settles it: the box clears and the next item starts. A blank box removes the live
 * item; settling drops it if another item already says the same.
 */

export interface LiveChip { values: string[]; live: number | null }

export function typeLiveChip(values: string[], live: number | null, text: string): LiveChip {
  const t = text.trim();
  if (live === null || live >= values.length) {
    return t ? { values: [...values, t], live: values.length } : { values, live: null };
  }
  const next = [...values];
  if (t) {
    next[live] = t;
    return { values: next, live };
  }
  next.splice(live, 1);
  return { values: next, live: null };
}

export function settleLiveChip(values: string[], live: number | null): string[] {
  if (live === null || live >= values.length) return values;
  const v = values[live].toLowerCase();
  const dup = values.some((x, j) => j !== live && x.toLowerCase() === v);
  return dup ? values.filter((_, j) => j !== live) : values;
}
