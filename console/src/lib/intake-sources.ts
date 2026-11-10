/**
 * Where an intake value came from, for the intake's source chips and its Still to do list.
 *
 * Five answers, plus two kinds of empty:
 *   form     — the client's onboarding form supplied it.
 *   close    — the sales-call close supplied it (a close seeds the business name, plan and
 *              industry onto the vertical preset; nothing else).
 *   console  — typed in the console (an operator edit).
 *   preset   — showing the vertical preset's placeholder. Counts as missing: a placeholder is
 *              not a fact about this client.
 *   notGiven — empty, and `_meta.missing_fields` flags it: the form asked and it was left blank.
 *   notAsked — empty, not flagged: whatever made this client's site.ts never asked (an older
 *              form, a close, a hand-made client).
 *
 * The bug this replaces: the old chip was "from intake" whenever the imported content had any
 * value at the path. A close-seeded client's imported content IS the vertical preset plus a name
 * (lib/export.ts seedClientFolder), so every preset placeholder read "from intake", and the
 * Studio built on sample copy that looked client-confirmed. A value only counts as the client's
 * when it differs from the preset's value at the same path.
 */
import { getPath } from '@/lib/merge';
import { missingFields, isFieldFlagged } from '@/lib/flags';
import type { SiteContent } from '@/data/site';

export type FactSource = 'form' | 'close' | 'console' | 'preset' | 'notGiven' | 'notAsked';

export interface SourceContext {
  /** What was merged and is shown: preset ← imported ← generated ← edits. */
  effective: SiteContent;
  /** The client's own site.ts content (from the form or a close), or null for none. */
  imported: SiteContent | null;
  /** The vertical preset the effective content sits on. */
  preset: SiteContent;
  /** The operator's edits, keyed by dotted path (BuildWizard's `edits`). */
  edits: Record<string, unknown>;
}

/** One definition of "has a value": non-blank string, non-empty array, any number/boolean,
 *  an object with at least one such value. */
export function hasValue(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (typeof v === 'number' || typeof v === 'boolean') return true;
  if (Array.isArray(v)) return v.some(hasValue);
  if (typeof v === 'object') return Object.values(v as Record<string, unknown>).some(hasValue);
  return false;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** An edit at the path itself, beneath it, or a whole-object/array write above it. */
function edited(edits: Record<string, unknown>, path: string): boolean {
  return Object.keys(edits).some((k) => k === path || k.startsWith(`${path}.`) || path.startsWith(`${k}.`));
}

/** True when the imported content came from a close (or by hand) rather than the onboarding
 *  form. The form's mapper always records the brand direction; a close-seeded file is the
 *  preset's own `_meta` with a name, which never carries one. */
export function seededByClose(imported: SiteContent | null): boolean {
  if (!imported) return false;
  return !(imported._meta as { brandDirection?: unknown } | undefined)?.brandDirection;
}

export function sourceOf(ctx: SourceContext, path: string): FactSource {
  const value = getPath(ctx.effective, path);
  if (!hasValue(value)) {
    const flagged = ctx.imported ? isFieldFlagged(missingFields(ctx.imported._meta), path) : false;
    return flagged ? 'notGiven' : 'notAsked';
  }
  if (edited(ctx.edits, path)) return 'console';
  const fromImport = ctx.imported ? getPath(ctx.imported, path) : undefined;
  if (hasValue(fromImport) && !same(fromImport, getPath(ctx.preset, path))) {
    return seededByClose(ctx.imported) ? 'close' : 'form';
  }
  return 'preset';
}

/** Supplied by someone for this client: the form, the close or the console. */
export function isSupplied(source: FactSource): boolean {
  return source === 'form' || source === 'close' || source === 'console';
}

/** Chip text. Neutral labels only (console copy rule). */
export const SOURCE_LABEL: Record<FactSource, string> = {
  form: 'Form',
  close: 'Close',
  console: 'Console',
  preset: 'Preset',
  notGiven: 'Not given',
  notAsked: 'Not asked',
};
