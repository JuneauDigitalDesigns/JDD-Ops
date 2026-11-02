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
import { VERTICALS, type VerticalId } from '@/lib/verticals';
import { ALL_SECTIONS, type Section } from '@/lib/copy-schema';

const HOME_SERVICE_SYSTEM = `You are the JDD Brand Copywriter — a senior conversion copywriter for local home-service businesses.

Write real, specific, benefit-led marketing copy grounded in the business facts and the industry vertical you are given. Rules:
- Specific over vague; benefits over features; active voice; plain language a homeowner uses.
- Ground every claim in the provided facts. Never invent licenses, awards, prices, phone numbers, addresses, or named companies.
- Only include a business name, phone, email, address, or license/credential when it appears in the provided website notes or operator details — otherwise omit those fields entirely.
- No placeholder text and no clichés (e.g. "top-notch", "one-stop shop", "we go the extra mile", "unmatched quality", "your satisfaction is our priority").
- Match the exact section counts you are asked for.
- Testimonials must read like real first-person homeowner quotes; use a first name + last initial and a plausible role, never a fabricated named company.
- SEO: title <= 60 chars (include the business name and city when known), description <= 155 chars.

Return ONLY a JSON object that conforms to the provided output schema. No prose, no markdown, no code fences.`;

const HEALTH_SYSTEM = `You are the JDD Brand Copywriter — a senior conversion copywriter for local health & wellness practices.

Write warm, reassuring, benefit-led marketing copy grounded in the business facts you are given. Rules:
- Patient/client-centered and welcoming; plain, calm language; active voice.
- Ground every claim in the provided facts. Never invent licenses, credentials, awards, prices, phone numbers, addresses, or named companies.
- Only include a business name, phone, email, address, or license/credential when it appears in the provided website notes or operator details — otherwise omit those fields entirely.
- HEALTH GUARDRAILS: make NO medical claims and NO promises of specific health outcomes or results. Do not imply diagnosis, cure, or treatment of any condition. Do not reference insurance coverage, pricing, or reimbursement. Avoid absolute or superlative health promises (e.g. "cure", "guaranteed results", "pain-free", "best care"). Keep everything supportive and non-committal about outcomes.
- No placeholder text and no clichés (e.g. "top-notch", "world-class", "we go the extra mile", "your satisfaction is our priority").
- Match the exact section counts you are asked for.
- Testimonials must read like real first-person client quotes about experience and feeling supported (never about medical outcomes); use a first name + last initial and a plausible role.
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
  testimonials: number;
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
    case 'brand':
      return '- brand.tagline: short, memorable. Populate brand name/phone/email/address/license ONLY when grounded (see rules); otherwise omit them.';
    case 'announcement':
      return '- announcement.text: one short promotional/seasonal line (or a general welcome if nothing specific is known).';
    case 'trust':
      return '- trust: a short label, plus logos[] ONLY for real certifications/affiliations found in the notes or details — omit logos if none are grounded.';
    case 'hero':
      return `- hero: eyebrow (2–4 words), headline (6–10 words, the single strongest promise on the site), headlineEmphasis (the ONE number, time indicator, or bold differentiator WITHIN the headline that earns gold/accent treatment — must be a verbatim substring of headline, e.g. "24/7" or "same day"; pick the word or phrase that would make someone stop scrolling; omit only if the headline has no single standout hook), sub (ONE sentence, ≤ 25 words), cta (action + outcome, ≤ 4 words), secondaryCta, formLabel, trust (one credibility sentence, grounded in the facts), badge (≤ 3 words), frictionReducers (exactly ${counts.heroFriction} bullets, ≤ 5 words each, each removing a different objection), heroBullets (exactly ${counts.heroBullets} of {value = a short number or figure, label = what it measures}).`;
    case 'about':
      // Deliberately says nothing about stats (PLAN D4) — they are not in the output schema
      // at all, so there is nothing to instruct the model about.
      return `- about: eyebrow, title, body (2–3 sentences), exactly ${counts.pillars} pillars {t = short title, d = one sentence}. Also write story: 3–4 paragraphs of real company background for the dedicated About page. Ground every sentence in the facts — do NOT invent founding dates, family history, employee counts, awards, or milestones that are not given to you. If the facts are thin, write shorter paragraphs about the work itself rather than filling space with invented history.`;
    case 'services':
      return `- services: eyebrow, title, sub, and exactly ${counts.services} items {t = service name, d ≤ 120 chars stating what the CUSTOMER gets (an outcome, not a list of features or equipment), tag = short category, detail = 2–3 sentence expansion shown when the card opens on the Services page}. Each item's d must be distinct — no two services may share a description shape or opening phrase.`;
    case 'work':
      return '- work: eyebrow, title, sub; include projects ONLY if real projects/case studies are grounded in the notes.';
    case 'testimonials':
      return counts.testimonials === 0
        ? `- testimonials: return { eyebrow: "", title: "", items: [] } — no real customer reviews are in the provided facts, so write NOTHING invented here. Leave items empty; the section will be hidden.`
        : `- testimonials: eyebrow, title, and exactly ${counts.testimonials} items {q = quote, a = "First L.", r = role, company = optional location/company, stars = 1–5}. Each quote must name a SPECIFIC situation and what happened — the problem, the response, the result. Generic praise is a failure: never write a quote whose main content is an adjective ("great", "amazing", "awesome", "professional", "highly recommend"). Vary length and voice between quotes so they do not read as one author.`;
    case 'faq':
      return `- faq: eyebrow, title, sub, and exactly ${counts.faq} question/answer pairs. Write the questions a real customer asks before buying, phrased the way they would phrase them. Answer each in ≤ 2 sentences, grounded strictly in the facts — if a question cannot be answered from the facts, ask a different question rather than speculating. Never state a price, a warranty length, or a response time that is not given to you.`;
    case 'finalCta':
      return `- finalCta: eyebrow, headline, headlineEmphasis (a verbatim substring of the finalCta headline to render in gold accent — the phrase that captures the key offer, e.g. "same day" or "at no cost"; omit if no phrase clearly stands out), sub, cta, secondary (short "or call…" style line), frictionReducers (exactly ${counts.ctaFriction} short bullets).`;
    case 'footer':
      return '- footer.blurb: a 1–2 sentence company blurb.';
    case 'seo':
      return '- seo: title (≤ 60 chars; lead with what the business DOES, then the business name, then the city when known — never just the business name), description (≤ 155 chars; one sentence naming the service and the area served, ending in a reason to click).';
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
  return `- subpages: exactly one item per route (${routes}), each { route, eyebrow, title, sub, ctaLabel + ctaHref (optional), seoTitle ≤ 60 chars, seoDescription ≤ 155 chars }. Every page's header and SEO must be DISTINCT and specific to that page — never a copy of the hero or of another page. About introduces the company; Services frames the offering; Contact invites the visitor to get in touch.`;
}

/** Build the SectionCounts a base SiteContent implies — shared by buildCopyUserMessage and
 *  the sections block resolver so "how many of each" is computed in exactly one place. */
export function countsFor(base: SiteContent): SectionCounts {
  return {
    pillars: base.about.pillars.length,
    services: base.services.items.length,
    testimonials: base.testimonials.items.length,
    faq: base.faq.items.length,
    heroBullets: base.hero.heroBullets.length,
    heroFriction: base.hero.frictionReducers.length,
    ctaFriction: base.finalCta.frictionReducers.length,
  };
}

export function buildCopyUserMessage(
  vertical: VerticalId,
  base: SiteContent,
  details?: string,
  sections: Section[] = ALL_SECTIONS,
  websiteNotes?: string,
): string {
  const want = new Set<Section>(['brand', ...sections]);
  const label = VERTICALS.find((v) => v.id === vertical)?.label ?? vertical;
  const b = base.brand;
  const x = base.extensions;
  // Everything below `license` comes straight off the client's onboarding form and was
  // being collected, mapped, written to disk — and then never shown to the model. The
  // copywriter was writing "serving the local area" while the intake knew the actual towns.
  // Undefined-safe throughout: extensions is optional and older intakes predate these keys.
  const facts = {
    name: b.name, long: b.long, tagline: b.tagline, established: b.established,
    phone: b.phone, email: b.email, address: b.address, license: b.license,
    serviceArea: x?.serviceArea?.length ? x.serviceArea : undefined,
    hours: x?.hours?.all || undefined,
    certifications: x?.trustBadges?.length ? x.trustBadges : undefined,
    notableClients: base.trust?.logos?.length ? base.trust.logos : undefined,
  };
  const counts = countsFor(base);
  const reference = {
    hero: { eyebrow: base.hero.eyebrow, headline: base.hero.headline },
    serviceTags: base.services.items.map((s) => s.tag),
  };

  const lines: string[] = [];
  for (const s of ALL_SECTIONS) {
    if (!want.has(s)) continue;
    const line = sectionInstructionLine(s, counts);
    if (line) lines.push(line);
  }

  return [
    `Industry vertical: ${label}.`,
    `Business facts (from the client's onboarding intake / preset):`,
    JSON.stringify(facts, null, 2),
    websiteNotes && websiteNotes.trim()
      ? `Content scanned from the business's own website — treat this as ground truth for facts (name, contact, services, reviews) and rewrite/organize it into the copy:\n${websiteNotes.trim()}`
      : '',
    // Attributed to the CLIENT, not the operator.
    //
    // brandDirectionToDetails() assembles this from what the business owner answered during
    // onboarding — what makes them different, who they sell to, how they want to sound, what
    // to avoid. Calling it "guidance from the operator" understated it: an operator's note is
    // a suggestion, whereas the owner's own account of their business is the most
    // authoritative positioning input available. The "invent no facts" clause stays.
    details && details.trim()
      ? `The business owner's own description of their business, given during onboarding. Authoritative for positioning, audience and tone — follow it closely, but invent no facts beyond it:\n${details.trim()}`
      : '',
    `Existing structure to respect — keep these exact counts:`,
    JSON.stringify({ ...counts, reference }, null, 2),
    `Write brand copy for ONLY these sections:`,
    lines.join('\n'),
    `Be specific and grounded in the ${label} vertical. Return only JSON matching the schema.`,
  ].filter(Boolean).join('\n\n');
}

/**
 * Convenience wrapper bundling both halves of the prompt, for a future Stage 2 "review the
 * full prompt" preview that needs { system, user } together rather than two separate calls.
 * Not yet used by generate-copy/route.ts, which still calls the two functions above directly
 * to keep this move a no-behavior-change relocation.
 */
export function compilePrompt(
  vertical: VerticalId,
  base: SiteContent,
  details?: string,
  sections: Section[] = ALL_SECTIONS,
  websiteNotes?: string,
): { system: string; user: string } {
  return {
    system: brandCopywriterSystem(vertical),
    user: buildCopyUserMessage(vertical, base, details, sections, websiteNotes),
  };
}
