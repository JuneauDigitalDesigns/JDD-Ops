/**
 * The pure half of the page read-back: turning an exported `page.tsx` SOURCE STRING back into
 * the studio's legacy single-page composition.
 *
 * Split out of `studio-readback.ts` so it can be tested. That module imports `server-only`
 * (correctly — it reads the filesystem), and `server-only` throws under the tsx test loader,
 * which is why `console/test/` has a standing convention of never importing it. The parser is
 * the part with the bug history, so it is the part that needs to be reachable from a test.
 * Nothing here touches disk or imports anything that does.
 */
import { isValidSkin, type SkinId } from './skins';

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

/** `import Hero from '@/components/catalog/hero/HeroSplit';` -> name -> categoryId */
const IMPORT_RE =
  /^import\s+(\w+)\s+from\s+'@\/components\/catalog\/([\w-]+)\/\1';/gm;

/** The body region wirePage() writes between its two anchors. */
const BODY_RE = /\{\/\* @studio:body:start \*\/\}([\s\S]*?)\{\/\* @studio:body:end \*\/\}/;

/** `<HeroSplit skin="contrast" />` — skin is optional and only present when supported. */
const ELEMENT_RE = /<(\w+)((?:\s+\w+="[^"]*")*)\s*\/>/g;

/** `export { generateMetadata } from '@/components/catalog/seo/SeoDefault';` */
const SEO_RE =
  /export\s*\{\s*generateMetadata\s*\}\s*from\s*'@\/components\/catalog\/seo\/(\w+)';/;

/**
 * Parse an exported page.tsx into the studio's composition, or null if it isn't one we
 * recognise — either no body markers at all (a hand-edited repo), or markers around a body
 * that contains no catalog components (a repo scaffolded from template/ but never wired).
 *
 * That second case is not hypothetical and it shipped a broken client site. `template/`'s
 * own page.tsx CARRIES the markers — they are the anchors the export writes into — and its
 * placeholder body is plain `<header>`/`<section>` markup with no catalog imports, so
 * ELEMENT_RE (which only matches self-closing elements) finds nothing. This function used to
 * return a perfectly well-formed `{selections:{}, order:[]}` for it, which is non-null, which
 * sent BuildWizard down its "already exported: DISK WINS" branch and made it DISCARD the
 * operator's saved composition in favour of nothing at all. The export then wrote a home page
 * holding chrome and no sections, pruned every subpage route, and pushed it.
 *
 * A repo in that state has nothing to read back, and saying so is what lets the caller fall
 * through to the localStorage bundle / server draft that still has the real composition.
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

  // No catalog component in the body region => this is not a wired page. Checked BEFORE the
  // seo re-export is folded in, because seo alone is chrome metadata and would otherwise make
  // an unwired page look like a composition of one.
  if (entries.length === 0) return null;

  // SEO isn't in the body — it rides in as a generateMetadata re-export.
  const seo = SEO_RE.exec(src);
  if (seo) {
    entries.push({ categoryId: 'seo', name: seo[1] });
    selections.seo = seo[1];
  }

  return { selections, skins, order, entries };
}
