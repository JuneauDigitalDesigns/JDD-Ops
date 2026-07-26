import type { SiteContent } from '@/data/site';
import { getPath } from '@/lib/merge';

// One flat registry of every field the brand drawer edits, keyed by the tab that owns it.
//
// Two features read this and would otherwise drift apart from the UI and from each other:
//   • the Cmd+K palette — searches labels + paths, jumps to the owning tab
//   • the completeness badges — count empty fields per tab
//
// Deliberately NOT derived from _meta.missing_fields. That array holds *intake-form* paths
// (business.industry, branding.palette, social.linkedin, hero.bullets — note the schema
// field is heroBullets), and a real client file can carry a lone "existingWebsiteUrl" that
// maps to nothing here. Counting emptiness against real paths is always correct and always
// actionable; missing_fields is kept as a separate advisory signal (see lib/flags.ts).

export type FieldTab =
  | 'brand' | 'palette' | 'type' | 'images'
  | 'services' | 'faq' | 'reviews' | 'work' | 'nav' | 'seo';

export type FieldEntry = {
  path: string;
  label: string;
  tab: FieldTab;
  /** Extra search terms that aren't in the label or path. */
  keywords?: string;
  /** Lists are "empty" when zero-length; scalars when blank/null. */
  kind?: 'scalar' | 'list';
};

export const FIELD_INDEX: FieldEntry[] = [
  // ── Brand ────────────────────────────────────────────────────────────────
  { path: 'brand.name', label: 'Name', tab: 'brand', keywords: 'business company title' },
  { path: 'brand.short', label: 'Short name', tab: 'brand' },
  { path: 'brand.long', label: 'Legal / long name', tab: 'brand', keywords: 'llc inc legal' },
  { path: 'brand.tagline', label: 'Tagline', tab: 'brand', keywords: 'slogan strapline' },
  { path: 'brand.established', label: 'Established', tab: 'brand', keywords: 'founded year since' },
  { path: 'brand.phone', label: 'Phone (display)', tab: 'brand', keywords: 'telephone number call' },
  { path: 'brand.phoneHref', label: 'Phone href', tab: 'brand', keywords: 'tel link telephone' },
  { path: 'brand.email', label: 'Email', tab: 'brand', keywords: 'mail contact' },
  { path: 'brand.address', label: 'Address', tab: 'brand', keywords: 'location street city' },
  { path: 'brand.license', label: 'License', tab: 'brand', keywords: 'licence number certified' },

  // ── Palette ──────────────────────────────────────────────────────────────
  { path: 'brand.palette.accent', label: 'Accent', tab: 'palette', keywords: 'color colour primary brand' },
  { path: 'brand.palette.accentFg', label: 'Accent text', tab: 'palette', keywords: 'color colour foreground on-accent' },
  { path: 'brand.palette.bg', label: 'Background', tab: 'palette', keywords: 'color colour page' },
  { path: 'brand.palette.bgSoft', label: 'Background soft', tab: 'palette', keywords: 'color colour muted' },
  { path: 'brand.palette.ink', label: 'Ink', tab: 'palette', keywords: 'color colour text body' },
  { path: 'brand.palette.inkSoft', label: 'Ink soft', tab: 'palette', keywords: 'color colour muted text' },
  { path: 'brand.palette.rule', label: 'Rule / border', tab: 'palette', keywords: 'color colour divider line' },

  // ── Type ─────────────────────────────────────────────────────────────────
  { path: 'brand.typography.fontHeading', label: 'Heading font', tab: 'type', keywords: 'typeface display title' },
  { path: 'brand.typography.fontSans', label: 'Body font', tab: 'type', keywords: 'typeface sans paragraph' },
  { path: 'brand.typography.headingWeight', label: 'Heading weight', tab: 'type', keywords: 'bold' },
  { path: 'brand.typography.bodyWeight', label: 'Body weight', tab: 'type', keywords: 'regular' },
  { path: 'brand.typography.headingTracking', label: 'Heading tracking', tab: 'type', keywords: 'letter spacing kerning' },
  { path: 'brand.typography.headingLineHeight', label: 'Heading line-height', tab: 'type', keywords: 'leading' },

  // ── Images ───────────────────────────────────────────────────────────────
  { path: 'images.hero.slides', label: 'Hero slides', tab: 'images', kind: 'list', keywords: 'photo banner carousel' },
  { path: 'images.about.feature', label: 'About image', tab: 'images', keywords: 'photo picture' },
  { path: 'images.footer.logoImage', label: 'Footer logo', tab: 'images', keywords: 'mark brandmark' },

  // ── Content lists ────────────────────────────────────────────────────────
  { path: 'services.items', label: 'Services', tab: 'services', kind: 'list', keywords: 'offerings work types' },
  { path: 'faq.items', label: 'FAQ items', tab: 'faq', kind: 'list', keywords: 'questions answers faqpage' },
  { path: 'testimonials.items', label: 'Testimonials', tab: 'reviews', kind: 'list', keywords: 'reviews ratings quotes' },
  { path: 'work.projects', label: 'Work projects', tab: 'work', kind: 'list', keywords: 'portfolio gallery jobs' },
  { path: 'nav', label: 'Nav links', tab: 'nav', kind: 'list', keywords: 'menu navigation header' },

  // ── SEO ──────────────────────────────────────────────────────────────────
  { path: 'seo.title', label: 'Title', tab: 'seo', keywords: 'meta search page title' },
  { path: 'seo.description', label: 'Description', tab: 'seo', keywords: 'meta search snippet' },
  { path: 'seo.canonical', label: 'Canonical URL', tab: 'seo', keywords: 'domain url address site' },
];

/** A field counts as incomplete when it has no usable value. */
export function isEmpty(content: SiteContent, entry: FieldEntry): boolean {
  const v = getPath(content, entry.path);
  if (v === null || v === undefined) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'string') return v.trim() === '';
  return false;
}

/** Empty-field count per tab, for the rail badges. */
export function emptyCountsByTab(content: SiteContent): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of FIELD_INDEX) {
    if (isEmpty(content, e)) out[e.tab] = (out[e.tab] ?? 0) + 1;
  }
  return out;
}

/** The empty entries for one tab, for the pane header. */
export function emptyFieldsFor(content: SiteContent, tab: FieldTab): FieldEntry[] {
  return FIELD_INDEX.filter((e) => e.tab === tab && isEmpty(content, e));
}

/**
 * Subsequence match — "phn" matches "Phone", "bgsoft" matches "Background soft". Returns a
 * score (lower is better) or -1 for no match, so exact/prefix hits sort above scattered ones.
 */
function fuzzyScore(haystack: string, needle: string): number {
  if (!needle) return 0;
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  const direct = h.indexOf(n);
  if (direct !== -1) return direct; // contiguous match — best, earlier is better
  let hi = 0;
  let gaps = 0;
  for (let ni = 0; ni < n.length; ni++) {
    const found = h.indexOf(n[ni], hi);
    if (found === -1) return -1;
    gaps += found - hi;
    hi = found + 1;
  }
  return 100 + gaps; // scattered match — always ranks below any contiguous one
}

export function searchFields(query: string, limit = 8): FieldEntry[] {
  const q = query.trim();
  if (!q) return [];
  const scored: Array<{ e: FieldEntry; s: number }> = [];
  for (const e of FIELD_INDEX) {
    const candidates = [e.label, e.path, e.keywords ?? ''];
    let best = -1;
    for (const c of candidates) {
      const s = fuzzyScore(c, q);
      if (s !== -1 && (best === -1 || s < best)) best = s;
    }
    if (best !== -1) scored.push({ e, s: best });
  }
  return scored.sort((a, b) => a.s - b.s).slice(0, limit).map((x) => x.e);
}
