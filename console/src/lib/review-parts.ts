/**
 * Regenerating parts of a section on the Review step (Xander, 2026-11-12: "I should be able to
 * checkbox certain specific parts of each section and mark those for regeneration so that I don't
 * have to regenerate an entire section"; approved as the canvas's row 7).
 *
 * The parts a section offers are the text the copywriter wrote into the generated layer, at fields
 * the section's output schema names (lib/copy-schema.ts). That keeps #79 / #83's locks: the brand
 * schema offers the tagline only, so no business identity can ever be ticked. Three more are left
 * out on purpose: a service's name and category (renaming one moves its slug and every tag on it),
 * a Work project (a real job's facts), and a page button's link.
 *
 * Regenerating runs the section through the existing copy route, then applyParts takes ONLY the
 * ticked parts from the result. Everything unticked stays byte for byte as it was.
 */
import { getPath, setPath } from '@/lib/merge';
import { serviceSlugs } from '@jdd/schema';
import { buildCopySchema, parseVerdictKey, type Section, type VerdictKey } from './copy-schema';

export type Part = { path: string; label: string };

type Schema = { type?: string; properties?: Record<string, Schema>; items?: Schema };

/** Field paths (relative to a section) never offered, as regexes over the dotted path. */
const NEVER: RegExp[] = [
  /^items\.\d+\.(t|tag)$/, // services: a service's name and category
  /^projects(\.|$)/, // work: real jobs
  /(^|\.)href$/, // a button's link
];

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function sectionSchema(section: Section): Schema | undefined {
  const s = buildCopySchema([section], false) as { properties?: Record<string, Schema> };
  return s.properties?.[section];
}

/** Every non-empty string at or under `value`, following `schema` when there is one. */
function walk(value: unknown, schema: Schema | undefined, rel: string, out: string[]) {
  if (typeof value === 'string') {
    if (value.trim() && !NEVER.some((r) => r.test(rel))) out.push(rel);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => walk(v, schema?.items, rel ? `${rel}.${i}` : String(i), out));
    return;
  }
  if (!isObj(value)) return;
  const keys = schema?.properties ? Object.keys(schema.properties) : Object.keys(value);
  for (const k of keys) {
    if (!(k in value)) continue;
    const childRel = rel ? `${rel}.${k}` : k;
    if (NEVER.some((r) => r.test(childRel))) continue;
    walk(value[k], schema?.properties?.[k], childRel, out);
  }
}

const TEXT: Schema = { type: 'string' };
const TOWN_PAGE_PARTS: Schema = {
  type: 'object',
  properties: { intro: TEXT, captions: { type: 'array', items: { type: 'object', properties: { caption: TEXT } } } },
};
const TOWN_SERVICE_PAGE_PARTS: Schema = {
  type: 'object',
  properties: {
    intro: TEXT,
    expect: { type: 'array', items: TEXT },
    faq: { type: 'array', items: { type: 'object', properties: { q: TEXT, a: TEXT } } },
  },
};

/** Where a review key's generated copy lives, as a content path ('' when it has none). */
function rootFor(key: VerdictKey, content?: unknown): { root: string; schema?: Schema } {
  const { route, section } = parseVerdictKey(key);
  if (section === 'subpages') return route ? { root: `subpages.${route}` } : { root: '' };
  if (section === 'servicePages') {
    const slug = route?.startsWith('services/') ? route.slice('services/'.length) : '';
    const i = slug && content ? serviceSlugs(content).indexOf(slug) : -1;
    return i >= 0 ? { root: `services.items.${i}.page` } : { root: '' };
  }
  // A town page's copy and a town + service page's copy both live in content.townPages
  // (lib/townPages.ts). Only the generated lines are parts: never the town, a photo's image, or
  // (from a town page) its service pages, which are reviewed on their own pages.
  if (section === 'townPages' || section === 'townServicePages') {
    const [areas, town, service] = (route ?? '').split('/');
    if (areas !== 'areas' || !town) return { root: '' };
    if (section === 'townPages') return service ? { root: '' } : { root: `townPages.${town}`, schema: TOWN_PAGE_PARTS };
    return service ? { root: `townPages.${town}.services.${service}`, schema: TOWN_SERVICE_PAGE_PARTS } : { root: '' };
  }
  const schema = sectionSchema(section);
  // The page-copy field is the servicePages section's, not the services card's.
  if (section === 'services' && schema?.properties?.items?.items?.properties) {
    const { page: _page, ...rest } = schema.properties.items.items.properties;
    return { root: section, schema: { ...schema, properties: { ...schema.properties, items: { ...schema.properties.items, items: { ...schema.properties.items.items, properties: rest } } } } };
  }
  return { root: section, schema };
}

/** The parts of one review key's section that can be ticked, in the order they read. */
export function sectionParts(key: VerdictKey, generated: unknown, content?: unknown): Part[] {
  const { root, schema } = rootFor(key, content);
  if (!root) return [];
  const out: string[] = [];
  walk(getPath(generated, root), schema, '', out);
  return out.map((rel) => {
    const path = `${root}.${rel}`;
    return { path, label: partLabel(path) };
  });
}

const KEY_LABEL: Record<string, string> = {
  eyebrow: 'Eyebrow', headline: 'Headline', headlineEmphasis: 'Headline emphasis', sub: 'Subhead',
  cta: 'Button', secondaryCta: 'Second button', secondary: 'Second button', formLabel: 'Form label',
  trust: 'Trust line', badge: 'Badge', frictionReducers: 'Reassurance', heroBullets: 'Bullet',
  title: 'Title', body: 'Body', story: 'Story', pillars: 'Pillar', items: 'Item', d: 'Description',
  t: 'Title', detail: 'Detail', q: 'Question', a: 'Answer', text: 'Text', label: 'Label', value: 'Value',
  blurb: 'Blurb', description: 'Description', tagline: 'Tagline', intro: 'Intro', includedNotes: 'Included',
  signNotes: 'Signs', expect: 'What to expect', faq: 'Question', logos: 'Logo', header: 'Header', seo: 'SEO',
  captions: 'Photo', caption: 'Caption',
};

const humanize = (k: string) => KEY_LABEL[k] ?? k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());

/** A part's label from its field: "Headline", "Bullet 1 · Value", "SEO · Title". */
export function partLabel(path: string): string {
  let segs = path.split('.');
  if (segs[0] === 'subpages') segs = segs.slice(2);
  else if (segs[0] === 'townPages') segs = segs.slice(segs[2] === 'services' ? 4 : 2);
  else if (segs.includes('page') && segs[0] === 'services') segs = segs.slice(segs.indexOf('page') + 1);
  else segs = segs.slice(1);
  const words: string[] = [];
  for (const s of segs) {
    if (/^\d+$/.test(s) && words.length) words[words.length - 1] = `${words[words.length - 1]} ${Number(s) + 1}`;
    else words.push(humanize(s));
  }
  return words.join(' · ');
}

export const partsWord = (n: number) => `${n} part${n === 1 ? '' : 's'}`;

/**
 * Take only the ticked parts from a fresh run. A part the operator had edited takes the new text as
 * an edit (edits outrank the generated layer, so it would not show otherwise); every other part is
 * written into the generated layer's top-level section. Returns what to write, and the parts the
 * run did not return.
 */
export function applyParts(
  generated: unknown,
  fresh: unknown,
  paths: string[],
  edits: Record<string, unknown>,
): { sections: Record<string, unknown>; edits: Record<string, unknown>; missing: string[] } {
  const sections: Record<string, unknown> = {};
  const editWrites: Record<string, unknown> = {};
  const missing: string[] = [];
  for (const p of paths) {
    const v = getPath(fresh, p);
    if (typeof v !== 'string' || !v.trim()) { missing.push(p); continue; }
    // Edited means an edit actually holds this part: a whole services list saved by add or remove
    // sits above every card but carries no card copy (lib/service-structure.ts).
    const editedHere = Object.keys(edits).some((k) =>
      k === p || (p.startsWith(`${k}.`) && getPath(edits[k], p.slice(k.length + 1)) !== undefined));
    if (editedHere) { editWrites[p] = v; continue; }
    const [top, ...rest] = p.split('.');
    const current = top in sections ? sections[top] : getPath(generated, top);
    sections[top] = setPath(current ?? {}, rest.join('.'), v);
  }
  return { sections, edits: editWrites, missing };
}
