/**
 * What would change if I deployed right now?
 *
 * Pure — no fs, no React — so the rules can be read on their own and reused by the API route
 * that computes a diff and the dialog that renders it. Nothing here talks to a client repo;
 * callers hand it the two sides.
 *
 * The console is now the primary way a client's live website gets edited, which means a
 * deploy button reshapes a page real customers are looking at. That only stays safe if what
 * you're about to change is legible BEFORE you confirm — hence field-level content changes
 * (with colour and copy called out separately) rather than a summary like "content updated".
 */

import { getPath } from './merge';
import { defaultSkin } from './skins';

export type ChangeKind = 'color' | 'copy' | 'image' | 'number' | 'flag' | 'other';

export interface ContentChange {
  /**
   * Dotted path into SiteContent, e.g. `hero.headline`, `brand.palette.accent`, or
   * `services.items.0.t` — numeric segments for array indices.
   *
   * The notation deliberately matches the studio's `edits` keys and getPath/setPath in
   * @/lib/merge, so a change row can be fed straight back into setField to revert it. It used
   * to use bracket notation (`services.items[0].t`), which looks nicer and is incompatible with
   * every other path in the codebase.
   */
  path: string;
  kind: ChangeKind;
  before: string | null;
  after: string | null;
}

export type CompositionChangeKind = 'added' | 'removed' | 'variant' | 'skin' | 'reordered';

export interface CompositionChange {
  kind: CompositionChangeKind;
  /** The slot this affects, e.g. `hero`. */
  categoryId: string;
  before?: string;
  after?: string;
}

export interface DeployDiff {
  composition: CompositionChange[];
  content: ContentChange[];
  /** True when nothing at all would change — the deploy button should say so and stop. */
  clean: boolean;
}

const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const IMAGE_HINT = /(image|photo|logo|avatar|icon|src|cover|thumb)/i;
const IMAGE_VALUE = /\.(png|jpe?g|webp|avif|svg|gif)(\?|$)|^\/images\/|^upload:\/\//i;

/** Classify a change so the dialog can group and format it. Colour and copy matter most. */
function classify(path: string, value: unknown): ChangeKind {
  if (typeof value === 'string' && HEX.test(value.trim())) return 'color';
  if (/palette|color|colour/i.test(path)) return 'color';
  if (IMAGE_HINT.test(path) || (typeof value === 'string' && IMAGE_VALUE.test(value))) {
    return 'image';
  }
  if (typeof value === 'boolean') return 'flag';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') return 'copy';
  return 'other';
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Render a leaf for display. Objects/arrays collapse to a shape hint, not a JSON dump. */
function show(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return `${v.length} item${v.length === 1 ? '' : 's'}`;
  return '{…}';
}

/**
 * Deep-diff two content trees into a flat, dotted-path change list.
 *
 * `_meta` is skipped: it carries generated_at and bookkeeping that changes on every write and
 * would bury the changes a human actually made.
 */
export function diffContent(before: unknown, after: unknown, base = ''): ContentChange[] {
  const out: ContentChange[] = [];

  if (isObject(before) && isObject(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      if (key === '_meta') continue;
      const path = base ? `${base}.${key}` : key;
      out.push(...diffContent(before[key], after[key], path));
    }
    return out;
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    const len = Math.max(before.length, after.length);
    for (let i = 0; i < len; i++) {
      out.push(...diffContent(before[i], after[i], base ? `${base}.${i}` : String(i)));
    }
    return out;
  }

  // Leaf (or a type change between the two sides).
  //
  // null and undefined are treated as the SAME empty. A schema that omits a key and one that
  // sets it to null describe an identical page, and JSON.stringify disagrees (`undefined` vs
  // `"null"`) — which surfaced rows reading `brand.established: null → null` in the deploy
  // dialog. A change nobody can see is worse than no row at all: it teaches you to skim.
  const bothEmpty = before == null && after == null;
  if (!bothEmpty && JSON.stringify(before) !== JSON.stringify(after)) {
    out.push({
      path: base,
      kind: classify(base, after ?? before),
      before: show(before),
      after: show(after),
    });
  }
  return out;
}

/**
 * Which path to write, and what value, to put one change row back to its shipped state.
 *
 * Resolves against the raw baseline rather than the change row, because ContentChange.before is
 * a display string from show(): an array reads "3 items", an object "{…}". You cannot restore a
 * value from a label.
 *
 * The trap this exists to avoid: writing `edits[path] = null` for a leaf the shipped site does
 * not have makes setPath CREATE the containers on the way down. Inside an array that leaves a
 * null hole — `projects: [a, b, null]` — which writeSiteContent serialises verbatim and the
 * client component then crashes mapping over. So whenever the leaf is absent from the baseline,
 * climb to the nearest array ancestor and restore that array wholesale instead. `widened` says
 * that happened, so the UI can warn that reverting this row also drops its siblings.
 */
export function resolveRevert(
  baseline: unknown,
  effective: unknown,
  changePath: string,
): { path: string; value: unknown; widened: boolean } {
  const shipped = getPath(baseline, changePath);
  if (shipped !== undefined) return { path: changePath, value: shipped, widened: false };

  const segs = changePath.split('.');
  for (let i = segs.length - 1; i > 0; i--) {
    const ancestor = segs.slice(0, i).join('.');
    const base = getPath(baseline, ancestor);
    if (Array.isArray(base) || Array.isArray(getPath(effective, ancestor))) {
      return { path: ancestor, value: Array.isArray(base) ? base : [], widened: true };
    }
  }

  // No array in the way: an absent object key is expressible as null, and diffContent's
  // bothEmpty check below then drops the row entirely.
  return { path: changePath, value: null, widened: false };
}

/** Diff the page composition: which slots gained, lost, or changed component/skin/position. */
export function diffComposition(
  before: { selections: Record<string, string>; skins: Record<string, string>; order: string[] },
  after: { selections: Record<string, string>; skins: Record<string, string>; order: string[] },
): CompositionChange[] {
  const out: CompositionChange[] = [];
  const cats = new Set([...Object.keys(before.selections), ...Object.keys(after.selections)]);

  for (const categoryId of cats) {
    const b = before.selections[categoryId];
    const a = after.selections[categoryId];
    if (!b && a) out.push({ kind: 'added', categoryId, after: a });
    else if (b && !a) out.push({ kind: 'removed', categoryId, before: b });
    else if (b !== a) out.push({ kind: 'variant', categoryId, before: b, after: a });
    else {
      /**
       * An ABSENT skin is not a distinct value — it means the component's own default.
       *
       * The shipped page.tsx only carries a `skin=` prop when one was chosen, so the baseline
       * read back from it has no key at all; the studio always sets one, via defaultSkin().
       * Comparing raw, every such section reported "Restyled x: default → editorial" — seven
       * phantom rows on the reference client for a page that renders identically, and their
       * revert button was a no-op because it wrote back the very value being compared against.
       *
       * There is also no 'default' skin: SkinId is editorial | contrast | quiet. That string
       * was a display label leaking into a value position.
       */
      const bSkin = before.skins[categoryId] ?? (b ? defaultSkin(b) : undefined);
      const aSkin = after.skins[categoryId] ?? (a ? defaultSkin(a) : undefined);
      if (bSkin !== aSkin) {
        out.push({ kind: 'skin', categoryId, before: bSkin, after: aSkin });
      }
    }
  }

  // Report reordering only for slots that exist on BOTH sides — otherwise adding one section
  // marks everything below it as "moved", which is technically true and completely useless.
  const common = before.order.filter((id) => after.order.includes(id));
  const commonAfter = after.order.filter((id) => before.order.includes(id));
  if (common.join('>') !== commonAfter.join('>')) {
    for (const categoryId of common) {
      if (common.indexOf(categoryId) !== commonAfter.indexOf(categoryId)) {
        out.push({ kind: 'reordered', categoryId });
      }
    }
  }

  return out;
}

/** Human summary line for one composition change. */
export function describeComposition(c: CompositionChange): string {
  switch (c.kind) {
    case 'added':
      return `Added ${c.categoryId} · ${c.after}`;
    case 'removed':
      return `Removed ${c.categoryId} · ${c.before}`;
    case 'variant':
      return `Changed ${c.categoryId}: ${c.before} → ${c.after}`;
    case 'skin':
      return `Restyled ${c.categoryId}: ${c.before} → ${c.after}`;
    case 'reordered':
      return `Moved ${c.categoryId}`;
  }
}

/**
 * The git commit message for a deploy.
 *
 * Deliberately detailed: this repo's history is the only record of what the console changed
 * on a live client site and why, and "update site" tells a future reader nothing. Subject
 * line summarises, body enumerates — capped so a large content edit doesn't produce a
 * thousand-line message.
 */
export function buildCommitMessage(diff: DeployDiff, brandName: string, cap = 40): string {
  const parts: string[] = [];
  if (diff.composition.length) parts.push(`${diff.composition.length} layout`);
  const colors = diff.content.filter((c) => c.kind === 'color').length;
  const copy = diff.content.filter((c) => c.kind === 'copy').length;
  if (copy) parts.push(`${copy} copy`);
  if (colors) parts.push(`${colors} colour`);
  const others = diff.content.length - colors - copy;
  if (others > 0) parts.push(`${others} other`);

  const subject = `studio: update ${brandName} (${parts.join(', ') || 'no changes'})`;

  const lines: string[] = [subject, ''];

  if (diff.composition.length) {
    lines.push('Layout:');
    for (const c of diff.composition) lines.push(`  - ${describeComposition(c)}`);
    lines.push('');
  }

  if (diff.content.length) {
    lines.push('Content:');
    for (const c of diff.content.slice(0, cap)) {
      const from = c.before === null ? '(empty)' : truncate(c.before);
      const to = c.after === null ? '(empty)' : truncate(c.after);
      lines.push(`  - ${c.path}: "${from}" → "${to}"`);
    }
    if (diff.content.length > cap) {
      lines.push(`  … and ${diff.content.length - cap} more field(s)`);
    }
    lines.push('');
  }

  lines.push('Deployed from the JDD console studio.');
  return lines.join('\n');
}

function truncate(s: string, max = 70): string {
  const flat = s.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
