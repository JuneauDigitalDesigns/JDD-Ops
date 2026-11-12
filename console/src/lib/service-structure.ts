/**
 * Adding or removing a service records the STRUCTURE only (Xander, 2026-11-12, the #93 follow-up).
 *
 * Both write the whole services.items list as an edit, since an array item can't be added or
 * removed any other way. They used to write each service as it appeared, card copy included, and
 * edits outrank the generated layer, so every later copy run's card text (d, detail, page) sat
 * hidden under that snapshot. Now the list carries which services exist, in what order, their
 * slugs, the client's names and tags and their facts, and no copy, except copy the operator typed
 * by hand, which still wins.
 *
 * At merge time hydrateServiceItems fills each listed service's missing copy from the layers below
 * the edits (preset <- imported <- generated), matched by slug, then by name. A run's new copy
 * therefore shows, a removed service's copy is simply never matched, and a new service gets copy on
 * the next run.
 *
 * No React here: effectiveContent (client and tests) and the Services step both import it.
 */
import { serviceSlugs } from '@jdd/schema';

/** The fields a copy run writes on a service card. Everything else on an item is structure or fact. */
export const SERVICE_COPY_FIELDS = ['d', 'detail', 'page'] as const;
type CopyField = (typeof SERVICE_COPY_FIELDS)[number];

type Item = Record<string, unknown> & { t?: unknown; slug?: unknown };
const EDIT = 'services.items';

const itemsOf = (content: unknown): Item[] => {
  const items = (content as { services?: { items?: unknown } } | null | undefined)?.services?.items;
  return Array.isArray(items) ? (items as Item[]) : [];
};
const norm = (s: unknown) => (typeof s === 'string' ? s.trim().toLowerCase() : '');
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const slugsOf = (items: Item[]) => serviceSlugs({ services: { items } });

/** The item in `pool` that is the same service as `items[i]`: by slug, then by name. */
function matchIn(items: Item[], i: number, pool: Item[], poolSlugs = slugsOf(pool)): Item | undefined {
  const slug = slugsOf(items)[i];
  const bySlug = slug ? poolSlugs.indexOf(slug) : -1;
  if (bySlug >= 0) return pool[bySlug];
  const name = norm(items[i]?.t);
  return name ? pool.find((p) => norm(p.t) === name) : undefined;
}

/** Where the layers below the edits could have supplied a card's copy. */
export type StructureContext = {
  edits: Record<string, unknown>;
  generated?: unknown;
  imported?: unknown;
  preset?: unknown;
};

/**
 * True when the copy shown on effective item `j` for field `f` is the operator's own: a hand edit at
 * that leaf, or a value the existing list edit carries that no layer below supplies. A list written
 * before this change carries every card's copy; whatever still equals the generated, imported or
 * preset copy for that service is theirs, not the operator's, and is dropped.
 */
function handCopy(effective: Item[], j: number, f: CopyField, ctx: StructureContext): boolean {
  const leaf = `${EDIT}.${j}.${f}`;
  if (Object.keys(ctx.edits).some((k) => k === leaf || k.startsWith(`${leaf}.`))) return true;
  const list = ctx.edits[EDIT];
  if (!Array.isArray(list) || !list[j] || !(f in (list[j] as Item))) return false;
  const value = (list[j] as Item)[f];
  for (const layer of [ctx.generated, ctx.imported, ctx.preset]) {
    const m = matchIn(effective, j, itemsOf(layer));
    if (m && same(m[f], value)) return false;
  }
  return true;
}

/** One effective item as structure: copy dropped, unless it is the operator's own. */
function structural(effective: Item[], j: number, ctx: StructureContext): Item {
  const out: Item = { ...effective[j] };
  for (const f of SERVICE_COPY_FIELDS) {
    if (f in out && !handCopy(effective, j, f, ctx)) delete out[f];
  }
  return out;
}

/** The list to store after removing service `index`, as structure (old index kept per item). */
export function structuralAfterRemove(content: unknown, index: number, ctx: StructureContext): Item[] {
  const effective = itemsOf(content);
  return effective.map((_, j) => j).filter((j) => j !== index).map((j) => structural(effective, j, ctx));
}

/** The list to store after adding a service at the end, as structure. */
export function addServiceItems(content: unknown, ctx: StructureContext): Item[] {
  const effective = itemsOf(content);
  // No card copy, not even an empty one: an empty `d` would be a value, and hide the next run's.
  const next: Item = { n: String(effective.length + 1).padStart(2, '0'), t: 'New service', tag: '' };
  return [...effective.map((_, j) => structural(effective, j, ctx)), next];
}

/**
 * Fill each service in a structural list edit with the copy it lacks, from the content beneath the
 * edits. Returns `edits` itself when there is no list edit, so nothing else changes.
 */
export function hydrateServiceItems(edits: Record<string, unknown>, base: unknown): Record<string, unknown> {
  const list = edits[EDIT];
  if (!Array.isArray(list)) return edits;
  const pool = itemsOf(base);
  if (!pool.length) return edits;
  const poolSlugs = slugsOf(pool);
  const items = list as Item[];
  let changed = false;
  const filled = items.map((it, i) => {
    if (!it || typeof it !== 'object') return it;
    const missing = SERVICE_COPY_FIELDS.filter((f) => !(f in it));
    if (!missing.length) return it;
    const m = matchIn(items, i, pool, poolSlugs);
    if (!m) return it;
    const add: Item = {};
    for (const f of missing) if (m[f] !== undefined) add[f] = m[f];
    if (!Object.keys(add).length) return it;
    changed = true;
    return { ...it, ...add };
  });
  return changed ? { ...edits, [EDIT]: filled } : edits;
}
