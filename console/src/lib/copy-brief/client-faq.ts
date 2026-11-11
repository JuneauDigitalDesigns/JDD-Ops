/**
 * The client's own questions and answers (`extensions.customerQuestions`) are fixed text. The
 * copywriter may add questions after them; it may never reword, merge or drop them.
 *
 * The bug (Tracewell Heating & Air, 2026-11-11). The client tagged two Q&As to their AC service:
 *   "Do you service all brands?"   -> "Yes, every major brand."
 *   "TW: Can you come Saturdays?"  -> "Yes, we can come out to you on Saturday mornings."
 * The prompt sent the questions alone, so the model wrote its own answers: "We carry Carrier and
 * Trane, and new installs we put in are Carrier…" and "Our regular hours are Mon to Fri… We also run
 * 24/7 emergency service…". The service page lists the client's tagged Q&As first and then
 * `page.faq` (serviceLinks.ts serviceQuestions), dropping an exact repeat of a question. The first
 * was an exact repeat and vanished; the second came back without its "TW:" prefix, so the page
 * showed the client's answer AND the model's invented one.
 *
 * Where each pair goes (Xander, 2026-11-11):
 *   - tagged to a service that has its own page: that page, first, in the client's order. The page
 *     already renders them straight from `customerQuestions`, so they are NOT copied into
 *     `page.faq` (the page's JSON-LD concatenates both, and a copy would list them twice);
 *     `page.faq` only loses the model's repeats of them.
 *   - untagged, or tagged to a service without a page: the home FAQ, first, in the client's order,
 *     written into `faq.items` itself, since the home FAQ renders nothing else.
 *
 * Exact text: nothing is trimmed or cleaned up, a prefix like "TW:" included. A question without
 * an answer is not fixed: the model answers it, as before.
 */
import { serviceSlugs } from '@/lib/servicePages';
import { servicePageIndices } from './compile';

export interface FixedQa { q: string; a: string }

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {});

/** The client's answered questions, split by where they belong. `content` decides which services
 *  have a page, so it must be the content the export and the generate route use (`effective`). */
export function clientFaq(content: unknown, questionsFrom: unknown = content): { home: FixedQa[]; bySlug: Map<string, FixedQa[]> } {
  const slugs = serviceSlugs(content);
  const withPage = new Set(servicePageIndices(content).map((i) => slugs[i]));
  const home: FixedQa[] = [];
  const bySlug = new Map<string, FixedQa[]>();
  const questions = obj(obj(questionsFrom).extensions).customerQuestions;
  for (const raw of Array.isArray(questions) ? questions : []) {
    const x = obj(raw);
    if (typeof x.q !== 'string' || typeof x.a !== 'string' || !x.q.trim() || !x.a.trim()) continue;
    const pair = { q: x.q, a: x.a };
    const slug = typeof x.service === 'string' ? x.service : '';
    if (slug && withPage.has(slug)) bySlug.set(slug, [...(bySlug.get(slug) ?? []), pair]);
    else home.push(pair);
  }
  return { home, bySlug };
}

/** Letters and digits only, lowercased: how two phrasings of one question are compared. */
function key(q: string): string {
  return q.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/** The model's question asks one of the client's again: the same words, or the client's with a
 *  label dropped or added ("TW: Can you come Saturdays?" / "Can you come Saturdays?"). */
export function repeatsFixed(q: unknown, fixed: FixedQa[]): boolean {
  if (typeof q !== 'string') return false;
  const k = key(q);
  if (!k) return false;
  return fixed.some((f) => {
    const fk = key(f.q);
    if (fk === k) return true;
    const [short, long] = fk.length < k.length ? [fk, k] : [k, fk];
    return short.length >= 12 && (long.endsWith(short) || long.startsWith(short));
  });
}

/** The model's pairs with every repeat of a fixed question removed. */
export function withoutRepeats<T extends { q?: unknown }>(items: T[], fixed: FixedQa[]): T[] {
  return fixed.length ? items.filter((it) => !repeatsFixed(it.q, fixed)) : items;
}

/** Fixed pairs first, exactly as the client wrote them, then the model's other pairs, up to `cap`
 *  in all. The fixed pairs are never cut: a cap below their number keeps all of them. */
export function pinFixed(fixed: FixedQa[], model: FixedQa[], cap: number): FixedQa[] {
  return [...fixed.map((f) => ({ q: f.q, a: f.a })), ...withoutRepeats(model, fixed)].slice(0, Math.max(cap, fixed.length));
}
