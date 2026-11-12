/**
 * The copywriter prompt compiler — relocated here verbatim from the deleted
 * lib/brand-copywriter-prompt.ts (P3 of the intake rebuild). This move is intentionally a
 * pure relocation with NO behavior change: `brandCopywriterSystem` and `buildCopyUserMessage`
 * produce byte-identical output to the file they replaced (verified against the actual old
 * module before it was deleted — see the git history of this change for the comparison).
 *
 * Deliberately NOT yet wired to @jdd/schema's VerticalDef (role/guardrails/forbidden) or to
 * a CopyBrief's blocks. That integration is the Brief stage's job (P5): once an operator can
 * edit role/guardrails/forbidden/facts/etc. as separate blocks, the assembled prompt is
 * naturally going to read differently from this hardcoded version — at which point "matches
 * the old wording exactly" stops being the right bar. This file is the bridge: it proves the
 * *relocation* didn't change anything, before the *redesign* is allowed to.
 */
import type { SiteContent } from '@/data/site';
import type { VerticalId } from '@/lib/verticals';
import type { Section } from '@/lib/copy-schema';
import { PAGE_CAPS } from '@jdd/schema';
import { pickServicePages, primaryCity, serviceSlugs } from '@/lib/servicePages';

/** The services the copywriter writes page copy for: exactly the ones the gate gives a page
 *  (service-page-spec.md §1), so a thin service never gets copy for a page it will never have. */
export function servicePageIndices(content: unknown): number[] {
  return pickServicePages(content, PAGE_CAPS.service);
}

/**
 * The instruction for the `servicePages` section (service-page-spec.md §3 blocks 3, 6, 10).
 * Carries each qualifying service's own facts inline, because the per-service facts are not in
 * the site-wide facts paragraph. '' when no service earns a page, so the section is never asked
 * for. Wording goes to Xander for word-for-word approval with the PR.
 */
export function servicePagesInstruction(content: unknown, factsFrom: unknown = content): string {
  // `content` decides WHICH services get a page and their slugs, exactly as the export does.
  // `factsFrom` is where each service's facts, the customer questions and the city are read:
  // the brief passes its grounded content (grounded.ts), so the preset's "123 Main St, Your
  // City" never becomes the city a service page names (Tracewell, 2026-11-11).
  const picked = servicePageIndices(content);
  if (!picked.length) return '';
  const c = (content ?? {}) as Record<string, any>;
  const f = (factsFrom ?? {}) as Record<string, any>;
  const items: Record<string, any>[] = Array.isArray(c.services?.items) ? c.services.items : [];
  const factItems: Record<string, any>[] = Array.isArray(f.services?.items) ? f.services.items : [];
  const slugs = serviceSlugs(content);
  const questions: Record<string, any>[] = Array.isArray(f.extensions?.customerQuestions) ? f.extensions.customerQuestions : [];
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()) : []);
  const facts = picked.map((i) => {
    const s: Record<string, any> = { ...(factItems[i] ?? {}), t: factItems[i]?.t ?? items[i]?.t };
    // A question the client answered is fixed (client-faq.ts): the page shows it first, word for
    // word, so the model gets it with its answer, as context and as something not to rewrite. A
    // question without an answer is the model's to answer, as before.
    const tagged = questions.filter((q) => q && q.service === slugs[i] && typeof q.q === 'string' && q.q.trim());
    const answered = (q: Record<string, any>) => typeof q.a === 'string' && q.a.trim() !== '';
    const fixed = tagged.filter(answered).map((q) => ({ q: q.q, a: q.a }));
    const own = tagged.filter((q) => !answered(q)).map((q) => q.q.trim());
    const out: Record<string, unknown> = { slug: slugs[i], name: s.t };
    if (list(s.included).length) out.included = list(s.included);
    if (list(s.typicalJobs).length) out.typicalJobs = list(s.typicalJobs);
    if (list(s.areas).length) out.towns = list(s.areas);
    if (list(s.brands).length) out.brands = list(s.brands);
    if (typeof s.priceFrom === 'string' && s.priceFrom.trim()) out.startingPrice = s.priceFrom.trim();
    if (typeof s.duration === 'string' && s.duration.trim()) out.howLong = s.duration.trim();
    if (fixed.length) out.fixedQuestions = fixed;
    if (own.length) out.customerQuestions = own;
    return out;
  });
  const city = primaryCity(factsFrom);
  const where = city ? ` in ${city}` : '';
  return [
    `- servicePages: one item per service below, each { slug, intro, body, includedNotes, signNotes, expect, faq }, for that service's own page.`,
    `intro: 2 to 3 sentences; the first says plainly that the business does this service${where} and how to book it${city ? `, and names ${city} once` : ''}.`,
    // body, includedNotes, signNotes and the general trade knowledge rule (service page upgrade):
    // the layout, the rule and these three lines word for word (S5), plus the facts line below,
    // approved by Xander on 2026-11-11. Don't reword them without his sign-off.
    'body: 2 to 3 short paragraphs that explain this service to a homeowner, the plain answer first, without repeating the intro. Anything about this business comes only from the facts below. You may add general trade knowledge any technician in this trade would agree with, such as what a problem usually means or why a step matters, but never as this business\'s promise, and never a price, time, warranty, guarantee, licence or brand the facts do not give. No town lists. Fewer facts means fewer paragraphs; an empty list when there is nothing to add to the intro.',
    'includedNotes: one line for each item in included, in the same order, saying plainly what the customer gets from it; an empty string for an item you cannot explain from its name and general trade knowledge.',
    'signNotes: one line for each item in typicalJobs, in the same order, saying what it usually means and what to do; an empty string when you cannot tell.',
    'expect: up to 4 short lines on booking, timing and estimates, only what the facts below state; an empty list when they state nothing.',
    'faq: questions about this service only, phrased the way a customer asks, so that together with the service\'s fixedQuestions the page has 3 to 5 in all. The fixedQuestions are the client\'s own questions and answers and the page shows them first, word for word: never repeat, reword or merge them, and write none of them into faq. Use the customer\'s own questions listed under customerQuestions first, as they were asked. Answer each in at most 2 sentences, the plain answer first, only from the facts. Never repeat a question from the site\'s main FAQ or from another service.',
    `Use only these facts for anything about each service and this business, and write for no service that is not listed:\n${JSON.stringify(facts, null, 2)}`,
  ].join(' ');
}

const HOME_SERVICE_SYSTEM = `You are the JDD Brand Copywriter, a senior conversion copywriter for local home-service businesses.

Write real, specific, benefit-led marketing copy grounded in the business facts and the industry vertical you are given. Rules:
- Specific over vague; benefits over features; active voice; plain language a homeowner uses.
- Ground every claim in the provided facts. Never invent licenses, awards, prices, phone numbers, addresses, or named companies.
- Only include a business name, phone, email, address, or license/credential when it appears in the provided website notes or operator details; otherwise omit those fields entirely.
- No placeholder text and no clichés (e.g. "top-notch", "one-stop shop", "we go the extra mile", "unmatched quality", "your satisfaction is our priority").
- Match the exact section counts you are asked for.
- SEO: title <= 60 chars (include the business name and city when known), description <= 155 chars.

Return ONLY a JSON object that conforms to the provided output schema. No prose, no markdown, no code fences.`;

const HEALTH_SYSTEM = `You are the JDD Brand Copywriter, a senior conversion copywriter for local health & wellness practices.

Write warm, reassuring, benefit-led marketing copy grounded in the business facts you are given. Rules:
- Patient/client-centered and welcoming; plain, calm language; active voice.
- Ground every claim in the provided facts. Never invent licenses, credentials, awards, prices, phone numbers, addresses, or named companies.
- Only include a business name, phone, email, address, or license/credential when it appears in the provided website notes or operator details; otherwise omit those fields entirely.
- HEALTH GUARDRAILS: make NO medical claims and NO promises of specific health outcomes or results. Do not imply diagnosis, cure, or treatment of any condition. Do not reference insurance coverage, pricing, or reimbursement. Avoid absolute or superlative health promises (e.g. "cure", "guaranteed results", "pain-free", "best care"). Keep everything supportive and non-committal about outcomes.
- No placeholder text and no clichés (e.g. "top-notch", "world-class", "we go the extra mile", "your satisfaction is our priority").
- Match the exact section counts you are asked for.
- SEO: title <= 60 chars (include the business name and city when known), description <= 155 chars.

Return ONLY a JSON object that conforms to the provided output schema. No prose, no markdown, no code fences.`;

export function brandCopywriterSystem(vertical: VerticalId): string {
  return vertical === 'health' ? HEALTH_SYSTEM : HOME_SERVICE_SYSTEM;
}

export interface SectionCounts {
  pillars: number;
  // NO `stats` — PLAN D4: a statistic is client-supplied only, never something the copywriter
  // is told a count for (counting implies "write N of these").
  services: number;
  // NO `testimonials` (operator decision, 2026-11-10), for the same reason as stats: a count
  // sent to the model ("keep these exact counts") reads as "write this many".
  faq: number;
  heroBullets: number;
  heroFriction: number;
  ctaFriction: number;
}

/**
 * The per-section instruction line buildCopyUserMessage sends the copywriter, extracted so
 * the Brief stage's `sections` block (copy-brief/resolve.ts) can show the SAME text as a
 * default — rather than a second hand-copied set of these strings that could silently drift
 * from what the model is actually told. Returns null for a section with no line (there is
 * none today; every ALL_SECTIONS member has one).
 */
export function sectionInstructionLine(section: Section, counts: SectionCounts): string | null {
  switch (section) {
    // ── Per-section lines (SEO plan, 2026-11-10). Rewritten for D1 (answer first, facts only),
    // D5/D6 (no em- or en-dash, ranges as "to"), D7 (title patterns) and D8 (the city in the home
    // headline). Wording sent to Xander for word-for-word approval with the PR; don't reword
    // without sign-off. The facts-only contact rule and exact counts the old role carried live
    // here now, next to the fields they govern.
    case 'brand':
      return '- brand.tagline: short, memorable.';
    case 'announcement':
      return '- announcement.text: one short promotional or seasonal line taken from the facts, or a general welcome if the facts give none.';
    case 'trust':
      return '- trust: a short label, plus logos[] ONLY for real certifications or affiliations found in the notes or details. Leave logos out if none are grounded.';
    case 'hero':
      return `- hero: eyebrow (2 to 4 words), headline (6 to 10 words: the single strongest promise on the site, naming the trade and the city from the facts; leave the city out only when the facts give none), headlineEmphasis (the ONE word or phrase WITHIN the headline that earns the accent colour; it must be a verbatim substring of the headline and must be supported by the facts; omit it if no phrase stands out), sub (ONE sentence, at most 25 words, answering what the business does and where), cta (action + outcome, at most 4 words), secondaryCta, formLabel, trust (one credibility sentence, grounded in the facts), badge (at most 3 words, from the facts, or omit it), frictionReducers (exactly ${counts.heroFriction} bullets, at most 5 words each, each removing a different objection, each true according to the facts), heroBullets (up to ${counts.heroBullets} of {value = a number or figure stated in the facts, label = what it measures}; return an empty list when the facts state no figures).`;
    case 'about':
      // Deliberately says nothing about stats (PLAN D4): they are not in the output schema
      // at all, so there is nothing to instruct the model about.
      return `- about: eyebrow, title, body (2 to 3 sentences, the plain answer to "who are you and where do you work" first), exactly ${counts.pillars} pillars {t = short title, d = one sentence}. Also write story: 3 to 4 paragraphs of real company background for the dedicated About page. Ground every sentence in the facts. Do NOT invent founding dates, family history, employee counts, awards, or milestones that are not given to you. If the facts are thin, write shorter paragraphs about the work itself rather than filling space with invented history.`;
    case 'services':
      return `- services: eyebrow, title, sub, and exactly ${counts.services} items {t = service name, d at most 120 chars stating what the CUSTOMER gets (an outcome, not a list of features or equipment), tag = short category, detail = 2 to 3 sentence expansion shown when the card opens on the Services page}. Each item's d must be distinct: no two services may share a description shape or opening phrase.`;
    case 'work':
      return '- work: eyebrow, title, sub; include projects ONLY if real projects/case studies are grounded in the notes.';
    case 'testimonials':
      // Heading only, whatever is in the slots (operator decision, 2026-11-10). The old line asked
      // for "exactly N items" against the scaffold's three blank slots, so every generated site
      // shipped three invented five-star quotes.
      return "- testimonials: eyebrow and title only, the heading of the reviews section. Never write review quotes, reviewer names or star ratings: reviews are real customers' words that the client supplies, and the section stays hidden until they do.";
    case 'faq':
      return `- faq: eyebrow, title, sub, and exactly ${counts.faq} question/answer pairs. When the facts include the customer's own questions, use those first, as they were asked. Otherwise write the questions a real customer asks before buying, phrased the way they would phrase them. Answer each in at most 2 sentences, the plain answer first, grounded strictly in the facts. If a question cannot be answered from the facts, ask a different question rather than speculating. Never state a price, a warranty length, or a response time that is not given to you.`;
    case 'finalCta':
      return `- finalCta: eyebrow, headline, headlineEmphasis (a verbatim substring of the finalCta headline to render in the accent colour: the phrase that captures the key offer, supported by the facts; omit it if no phrase clearly stands out), sub, cta, secondary (short "or call" style line), frictionReducers (exactly ${counts.ctaFriction} short bullets, each true according to the facts).`;
    case 'footer':
      return '- footer.blurb: a 1 to 2 sentence company blurb saying what the business does and where.';
    case 'seo':
      return '- seo: title in the form "{trade} in {city} | {business name}", where {trade} names what the business does in 2 to 4 words and {city} is the city from the facts (drop " in {city}" when the facts give no city), at most 60 chars; description (at most 155 chars; one sentence naming the service and the area served, ending in a reason to act).';
    default:
      return null;
  }
}

/**
 * The instruction for the `subpages` generation section — one header + per-page SEO for each
 * non-home route. Built where the routes are known (resolve.ts's resolveSections), since
 * sectionInstructionLine has no route context. Returns '' when there are no subpages, so a
 * single-page build contributes no subpages line.
 */
export function subpagesInstruction(subpages: { route: string; pageType: string; label: string }[]): string {
  if (!subpages.length) return '';
  const routes = subpages.map((p) => p.route).join(', ');
  return `- subpages: exactly one item per route (${routes}), each { route, eyebrow, title, sub, ctaLabel + ctaHref (optional), seoTitle at most 60 chars, seoDescription at most 155 chars }. Every page's header and SEO must be DISTINCT and specific to that page, never a copy of the hero or of another page. About introduces the company; Services frames the offering; Contact invites the visitor to get in touch. seoTitle forms: Services "{trade} Services in {city} | {business name}", About "About {business name} | {trade} in {city}", Contact "Contact {business name} | {city} {trade}", a service page "{service} in {city} | {business name}"; drop the city parts when the facts give no city.`;
}

/** Build the SectionCounts a base SiteContent implies — shared by the structure block and
 *  the sections block resolver so "how many of each" is computed in exactly one place. */
export function countsFor(base: SiteContent): SectionCounts {
  return {
    pillars: base.about.pillars.length,
    services: base.services.items.length,
    faq: base.faq.items.length,
    heroBullets: base.hero.heroBullets.length,
    heroFriction: base.hero.frictionReducers.length,
    ctaFriction: base.finalCta.frictionReducers.length,
  };
}

// buildCopyUserMessage and compilePrompt, the pre-Brief prompt builders, were removed on 2026-11-11.
// Nothing called them, and they still read their facts and hero reference from the merged content,
// preset included: the leak compile-brief.ts no longer has. Re-wiring them would bring it back.
