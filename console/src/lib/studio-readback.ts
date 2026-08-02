import 'server-only';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { clientDir } from './paths';
import { isValidSkin, type SkinId } from './skins';

/**
 * Read a client's page composition back OUT of their exported repo.
 *
 * The studio's composition — which component fills each slot, in what order, with which
 * skin — was only ever held in browser localStorage. That made the console unusable as the
 * primary editor: open a client on another machine, or after a cache clear, and the studio
 * showed an empty page for a site that has been live for months.
 *
 * Rather than introduce a third per-client file to keep in sync with the repo (and to drift
 * from it), we read the repo itself. It already IS the source of truth for what the page
 * contains, and wirePage() writes it in a shape deliberately kept "re-wireable on a later
 * export" — anchored comment markers, one component per line.
 *
 * This parser is the exact inverse of wirePage() in export.ts. If you change the emitted
 * shape there, change it here in the same commit or the studio will silently start showing
 * an empty page again.
 *
 * NOT recoverable, and accepted: the `vertical` preset the client was started from. It only
 * supplies fallbacks for fields site.ts doesn't define, and site.ts is loaded separately as
 * the real content, so the cost is limited to placeholder imagery in the preview.
 */

export interface ReadBackEntry {
  categoryId: string;
  name: string;
  skin?: SkinId;
}

export interface StudioReadBack {
  /** categoryId -> component name. */
  selections: Record<string, string>;
  /**
   * categoryId -> skin id, only where the repo carries an explicit skin prop AND that skin
   * is still valid for that component. A skin that has since been renamed or removed from
   * the catalog is dropped rather than fed back into the studio as an unknown SkinId.
   */
  skins: Record<string, SkinId>;
  /** Body categories in page order (nav first, footer last, as written). */
  order: string[];
  /** Every entry including `seo`, for callers that need the flat list. */
  entries: ReadBackEntry[];
}

/** Absolute path to the wired page for a client's exported repo. */
export function repoPagePath(slug: string): string {
  return resolve(clientDir(slug), 'repo', 'src', 'app', 'page.tsx');
}

/** True when this client has an exported repo whose page we can read. */
export function hasExportedPage(slug: string): boolean {
  return existsSync(repoPagePath(slug));
}

/** `import Hero from '@/components/catalog/hero/HeroCentered';` -> name -> categoryId */
const IMPORT_RE =
  /^import\s+(\w+)\s+from\s+'@\/components\/catalog\/([\w-]+)\/\1';/gm;

/** The body region wirePage() writes between its two anchors. */
const BODY_RE = /\{\/\* @studio:body:start \*\/\}([\s\S]*?)\{\/\* @studio:body:end \*\/\}/;

/** `<HeroCentered skin="warm" />` — skin is optional and only present when supported. */
const ELEMENT_RE = /<(\w+)((?:\s+\w+="[^"]*")*)\s*\/>/g;

/** `export { generateMetadata } from '@/components/catalog/seo/SeoDefault';` */
const SEO_RE =
  /export\s*\{\s*generateMetadata\s*\}\s*from\s*'@\/components\/catalog\/seo\/(\w+)';/;

/**
 * Parse an exported page.tsx into the studio's composition, or null if it isn't one we
 * recognise (no body markers = not a studio-wired page, e.g. a hand-edited repo).
 */
export function parseExportedPage(src: string): StudioReadBack | null {
  const body = BODY_RE.exec(src);
  if (!body) return null;

  // name -> categoryId, from the import block.
  const categoryByName = new Map<string, string>();
  for (const m of src.matchAll(IMPORT_RE)) {
    categoryByName.set(m[1], m[2]);
  }

  const entries: ReadBackEntry[] = [];
  const selections: Record<string, string> = {};
  const skins: Record<string, SkinId> = {};
  const order: string[] = [];

  for (const m of body[1].matchAll(ELEMENT_RE)) {
    const name = m[1];
    const categoryId = categoryByName.get(name);
    // An element with no matching catalog import isn't ours — skip rather than guess.
    if (!categoryId) continue;
    const raw = /\bskin="([^"]*)"/.exec(m[2] ?? '')?.[1];
    const skin = raw && isValidSkin(name, raw) ? (raw as SkinId) : undefined;

    entries.push(skin ? { categoryId, name, skin } : { categoryId, name });
    selections[categoryId] = name;
    if (skin) skins[categoryId] = skin;
    if (!order.includes(categoryId)) order.push(categoryId);
  }

  // SEO isn't in the body — it rides in as a generateMetadata re-export.
  const seo = SEO_RE.exec(src);
  if (seo) {
    entries.push({ categoryId: 'seo', name: seo[1] });
    selections.seo = seo[1];
  }

  return { selections, skins, order, entries };
}

/**
 * Read + parse one client's exported page from the WORKING TREE, or null when there's
 * nothing to read.
 *
 * Right for seeding the studio — you want to edit the newest local state, exported or not.
 * WRONG as a deploy baseline: the working tree holds unshipped output, so diffing against it
 * compares the studio to itself. The deploy diff reads `git show <ref>:src/app/page.tsx`
 * through parseExportedPage instead (see api/build/diff).
 */
export function readStudioComposition(slug: string): StudioReadBack | null {
  const path = repoPagePath(slug);
  if (!existsSync(path)) return null;
  try {
    return parseExportedPage(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}
