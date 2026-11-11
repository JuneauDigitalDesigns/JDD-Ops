/**
 * What the copy brief may tell the model about THIS client: what the client gave (`imported`)
 * plus what the operator typed (`edits`), with every vertical-preset value taken out.
 *
 * The bug this replaces (Tracewell Heating & Air, 2026-11-11). The brief read its facts, its
 * "current promotion", its proof points and its reference hero from `ctx.effective`, which is
 * preset <- imported <- generated <- edits. Wherever the client gave nothing, the preset's sample
 * text filled the gap, and the brief handed it to the model as the client's. A client whose hours
 * were Mon to Fri, 8am to 5pm got a site claiming 24/7 emergency service in nine places, because
 * the HVAC preset's announcement, hero eyebrow and trust badges all say so.
 *
 * The rule: a preset value is never sent. Where the client gave nothing, the brief says nothing.
 *
 *   - `generated` is never read. A previous run's copy sent back as a "reference" launders
 *     whatever that run invented into the next run's input, so it is left out on purpose.
 *   - A value equal to the preset's at the same path counts as the preset's, whoever supplied it.
 *     A close-seeded client's imported content IS the preset plus a name (see intake-sources.ts),
 *     and a whole-object edit can carry the preset's siblings along with the one field typed.
 *   - A list of strings is compared as a whole, the way the intake's source chips judge it
 *     (intake-sources.ts). Not item by item: the HVAC preset's sample towns are real Orlando-area
 *     towns, and filtering by item dropped Tracewell's own "Maitland" and "Oviedo". The cost is
 *     that an operator who deletes one sample badge from the preset's list and keeps the rest has
 *     chosen the rest, and they are sent.
 *
 * Counts (how many FAQ items, pillars, bullets) still come from `effective`: those are layout,
 * not claims. See compile-brief.ts's structureSegment.
 */
import { applyEdits, getPath } from '@/lib/merge';
import type { SiteContent } from '@/data/site';
import type { BriefContext } from './types';

type Json = Record<string, unknown>;

function isPlainObject(x: unknown): x is Json {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

/** `value` with everything that is blank or equal to the preset's value removed. Undefined when
 *  nothing is left. Objects are compared key by key; a record in a list is dropped only when it is
 *  the preset's record at that index; a list of strings is dropped when, blanks aside, it is the
 *  preset's list at the same path. */
export function withoutPreset(value: unknown, preset: unknown): unknown {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') {
    if (!value.trim()) return undefined;
    return typeof preset === 'string' && norm(preset) === norm(value) ? undefined : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value === preset ? undefined : value;
  }
  if (Array.isArray(value)) {
    const presetList = Array.isArray(preset) ? preset : [];
    if (value.every((v) => v === null || typeof v !== 'object')) {
      const kept = value.filter((v) => v !== null && v !== undefined && !(typeof v === 'string' && !v.trim()));
      const key = (list: unknown[]) => JSON.stringify(list.map((v) => (typeof v === 'string' ? norm(v) : v)));
      const presetKept = presetList.filter((v) => v !== null && v !== undefined && !(typeof v === 'string' && !v.trim()));
      if (!kept.length || key(kept) === key(presetKept)) return undefined;
      return kept;
    }
    // Lists of records (services.items, about.stats): positional, so compare index by index and
    // keep the positions, which other code (servicePageIndices) indexes into. A record is the
    // preset's only when nothing in it differs; otherwise it is kept whole, blanks aside, so a
    // client's own stat { n: "24/7", l: "Emergency line" } keeps its "24/7" although the preset's
    // stat at that index says "24/7" too.
    const kept = value.map((v, i) => {
      if (!isPlainObject(v)) return withoutPreset(v, presetList[i]);
      return withoutPreset(v, presetList[i]) === undefined ? undefined : withoutPreset(v, undefined);
    });
    return kept.some((v) => v !== undefined) ? kept : undefined;
  }
  if (isPlainObject(value)) {
    const p = isPlainObject(preset) ? preset : {};
    const out: Json = {};
    for (const [k, v] of Object.entries(value)) {
      const kept = withoutPreset(v, p[k]);
      if (kept !== undefined) out[k] = kept;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return undefined;
}

export interface GroundSource {
  imported: SiteContent | null;
  preset?: SiteContent | null;
  edits?: Record<string, unknown> | null;
}

/** The client's content plus the operator's edits, minus anything the preset says. Never reads
 *  the generated layer and never reads `effective`. */
export function groundedContent(src: GroundSource): Json {
  const own = applyEdits<Json>((src.imported ?? {}) as unknown as Json, src.edits ?? {});
  return (withoutPreset(own, src.preset ?? {}) as Json | undefined) ?? {};
}

const cache = new WeakMap<object, Json>();

/** groundedContent for one brief render, computed once per context object. */
export function groundedFor(ctx: Pick<BriefContext, 'imported' | 'preset' | 'edits'>): Json {
  const hit = cache.get(ctx);
  if (hit) return hit;
  const g = groundedContent(ctx);
  cache.set(ctx, g);
  return g;
}

/** One path of the grounded content, or undefined when the client and the operator gave none. */
export function groundedAt(ctx: Pick<BriefContext, 'imported' | 'preset' | 'edits'>, path: string): unknown {
  return getPath(groundedFor(ctx), path);
}

/** A grounded list of non-blank strings at `path`, [] when there is none. */
export function groundedStrings(ctx: Pick<BriefContext, 'imported' | 'preset' | 'edits'>, path: string): string[] {
  const v = groundedAt(ctx, path);
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : [];
}

/** A grounded string at `path`, '' when there is none. */
export function groundedString(ctx: Pick<BriefContext, 'imported' | 'preset' | 'edits'>, path: string): string {
  const v = groundedAt(ctx, path);
  return typeof v === 'string' ? v.trim() : '';
}

/** The `edits` a route was posted, or {} for anything that isn't a plain path map. A request
 *  without them sends no operator edits, never the merged content in their place. */
export function editsFrom(v: unknown): Record<string, unknown> {
  return isPlainObject(v) ? v : {};
}
