/**
 * The first lines of a section the copywriter just wrote, for the Prompt step's menu to show as
 * each section lands (Xander, 2026-11-12: "we can see each step streaming in and its progress as
 * it goes"). Read from the model's own output for that section, before anything is applied.
 *
 * A short sentence, not the section: the headline or the one line where a section has one, else
 * the first question, else the first piece of text found. Service names are joined, since a list of
 * names says more than the first card's line. No imports: the route and the tests load it directly.
 */
const MAX = 140;

const PREFERRED = ['headline', 'text', 'tagline', 'title', 'q', 'intro', 'story', 'blurb', 'sub', 'body', 'd'];

function firstText(v: unknown, depth = 0): string | undefined {
  if (depth > 5 || v === null || v === undefined) return undefined;
  if (typeof v === 'string') return v.trim() || undefined;
  if (Array.isArray(v)) {
    for (const x of v) {
      const t = firstText(x, depth + 1);
      if (t) return t;
    }
    return undefined;
  }
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    for (const k of PREFERRED) {
      const t = typeof o[k] === 'string' ? (o[k] as string).trim() : undefined;
      if (t) return t;
    }
    for (const x of Object.values(o)) {
      const t = firstText(x, depth + 1);
      if (t) return t;
    }
  }
  return undefined;
}

const clip = (s: string) => (s.length > MAX ? `${s.slice(0, MAX).trimEnd()}…` : s);

export function sectionPreview(section: string, result: unknown): string | undefined {
  const out = (result as Record<string, unknown> | null | undefined)?.[section];
  if (section === 'services') {
    const items = (out as { items?: { t?: unknown }[] } | undefined)?.items ?? [];
    const names = items.map((it) => (typeof it?.t === 'string' ? it.t.trim() : '')).filter(Boolean);
    if (names.length) return clip(names.join(' · '));
  }
  const t = firstText(out);
  return t ? clip(t.replace(/\s+/g, ' ')) : undefined;
}
