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
  const facts = {
    name: b.name, long: b.long, tagline: b.tagline, established: b.established,
    phone: b.phone, email: b.email, address: b.address, license: b.license,
  };
  const counts = {
    pillars: base.about.pillars.length,
    stats: base.about.stats.length,
    services: base.services.items.length,
    testimonials: base.testimonials.items.length,
    faq: base.faq.items.length,
    heroBullets: base.hero.heroBullets.length,
    heroFriction: base.hero.frictionReducers.length,
    ctaFriction: base.finalCta.frictionReducers.length,
  };
  const reference = {
    hero: { eyebrow: base.hero.eyebrow, headline: base.hero.headline },
    serviceTags: base.services.items.map((s) => s.tag),
  };

  const lines: string[] = [];
  if (want.has('brand'))
    lines.push('- brand.tagline: short, memorable. Populate brand name/phone/email/address/license ONLY when grounded (see rules); otherwise omit them.');
  if (want.has('announcement'))
    lines.push('- announcement.text: one short promotional/seasonal line (or a general welcome if nothing specific is known).');
  if (want.has('trust'))
    lines.push('- trust: a short label, plus logos[] ONLY for real certifications/affiliations found in the notes or details — omit logos if none are grounded.');
  if (want.has('hero'))
    lines.push(`- hero: eyebrow, headline, headlineEmphasis (an EXACT substring of headline to accent, or omit), sub (one sentence), cta (action + outcome), secondaryCta, formLabel, trust (one credibility sentence), badge (short), frictionReducers (exactly ${counts.heroFriction} short bullets), heroBullets (exactly ${counts.heroBullets} of {value, label}).`);
  if (want.has('about'))
    lines.push(`- about: eyebrow, title, body (2–3 sentences), exactly ${counts.pillars} pillars {t = short title, d = one sentence}, and exactly ${counts.stats} stats {n = short value, l = label}.`);
  if (want.has('services'))
    lines.push(`- services: eyebrow, title, sub, and exactly ${counts.services} items {t = service name, d ≤ 120 chars, tag = short category}.`);
  if (want.has('work'))
    lines.push('- work: eyebrow, title, sub; include projects ONLY if real projects/case studies are grounded in the notes.');
  if (want.has('testimonials'))
    lines.push(`- testimonials: eyebrow, title, and exactly ${counts.testimonials} items {q = quote, a = "First L.", r = role, company = optional location/company, stars = 1–5}.`);
  if (want.has('faq'))
    lines.push(`- faq: eyebrow, title, sub, and exactly ${counts.faq} question/answer pairs grounded in the facts.`);
  if (want.has('finalCta'))
    lines.push(`- finalCta: eyebrow, headline, sub, cta, secondary (short "or call…" style line), frictionReducers (exactly ${counts.ctaFriction} short bullets).`);
  if (want.has('footer'))
    lines.push('- footer.blurb: a 1–2 sentence company blurb.');
  if (want.has('seo'))
    lines.push('- seo: title, description.');

  return [
    `Industry vertical: ${label}.`,
    `Business facts (from the client's onboarding intake / preset):`,
    JSON.stringify(facts, null, 2),
    websiteNotes && websiteNotes.trim()
      ? `Content scanned from the business's own website — treat this as ground truth for facts (name, contact, services, reviews) and rewrite/organize it into the copy:\n${websiteNotes.trim()}`
      : '',
    details && details.trim()
      ? `Additional brand-specific guidance from the operator — use it, but invent no facts beyond it:\n${details.trim()}`
      : '',
    `Existing structure to respect — keep these exact counts:`,
    JSON.stringify({ ...counts, reference }, null, 2),
    `Write brand copy for ONLY these sections:`,
    lines.join('\n'),
    `Be specific and grounded in the ${label} vertical. Return only JSON matching the schema.`,
  ].filter(Boolean).join('\n\n');
}
