/**
 * compileBriefPrompt / compileBriefSegments — assembles the REAL system + user prompt from
 * the Brief stage's resolved blocks, for one chunk of sections. This is the integration
 * point P3 deliberately deferred: compile.ts's brandCopywriterSystem/buildCopyUserMessage
 * are a fixed, hardcoded shape, while this reads whatever the operator's eleven blocks
 * currently say — enabled or excluded, default or edited, chips ticked or not.
 *
 * "Byte-identical to the old prompt" is no longer the bar (that requirement lived entirely
 * in P3, to prove the file *move* didn't change anything before the *redesign* began). This
 * is the redesign: an operator excluding "Forbidden words" now visibly removes that
 * paragraph, exactly as it should.
 *
 * `sections` is the CURRENT CHUNK's sections (generate-copy still chunks 2 at a time — see
 * chunking.ts's note on why), not every ticked section — mirrors the old
 * buildCopyUserMessage's own `sections` parameter for the same reason.
 *
 * Segments, not just a joined string: the Prompt stage's annotated document (P6) shows which
 * block produced each paragraph and lets a click jump back to it, which needs the origin
 * preserved — compileBriefPrompt is a thin join over the same segments this exposes.
 */
import type { Section } from '@/lib/copy-schema';
import { COPY_FACT_PATHS, FACT_KEY_FOR_PATH } from './facts';
import { groundedAt, groundedString } from './grounded';
import { compileChipGroup } from './resolve';
import type {
  BriefContext,
  CopyBriefBlockId,
  CustomBlock,
  ForbiddenBlock,
  LinesBlock,
  OffersBlock,
  PositioningBlock,
  ProseBlock,
  ResolvedBlock,
  SectionsBlock,
  StructureBlock,
  WebsiteBlock,
} from './types';

/**
 * The output contract.
 *
 * Was a single sentence ("Return ONLY a JSON object that conforms to the provided output
 * schema. No prose, no markdown, no code fences.") which named the requirement without saying
 * what either failure mode costs. Both are silent: an unrecognised key is dropped at import,
 * and an omitted key falls through the merge to the vertical preset — so a model that invents
 * a key or skips a field produces a site that looks successfully generated and is actually
 * still showing placeholder copy. Stating the consequence is what makes the rule stick.
 */
const RETURN_ONLY_JSON = [
  'Return ONLY a single valid JSON object. No prose before or after it, no markdown, no code fences, no comments, no trailing commas.',
  'Every key you emit must be one the output schema names. Unknown keys are discarded on import without warning, so an invented key is silently lost work.',
  'Write every field you are asked for. A field you omit falls back to generic placeholder copy from the industry preset, which ships to the client looking like real output. Omitting is worse than brief.',
  'Write ONLY the sections you are instructed to write. Do not emit keys for sections not requested in this run; they are being handled separately and your version would overwrite theirs.',
].join(' ');

const MULTI_PAGE_RULES = 'This is a MULTI-PAGE website, not a single landing page. Copy for one page must never duplicate another page\'s wording; each page stands on its own. The About page carries the detailed company story; the Services page carries per-service detail; every non-home page has a distinct header and its own SEO title and description.';

/** One paragraph of the compiled prompt, tagged with the block that produced it.
 *  `blockId` is null for the handful of lines that aren't sourced from any block (the
 *  vertical-label opener, the brand instruction, the closing "be specific" line) —
 *  matching how those same lines were unconditional in the old hardcoded prompt. */
export interface PromptSegment {
  blockId: CopyBriefBlockId | null;
  label: string;
  text: string;
}

function find<T extends ResolvedBlock>(blocks: ResolvedBlock[], id: T['id']): T {
  const b = blocks.find((x) => x.id === id);
  if (!b) throw new Error(`resolveBrief did not produce a "${id}" block`);
  return b as T;
}

function customForbiddenWords(blocks: ResolvedBlock[]): string[] {
  const custom = find<CustomBlock>(blocks, 'custom');
  return custom.fields.filter((f) => f.kind === 'forbidden').map((f) => f.value.trim()).filter(Boolean);
}

/** Custom fields matching this chunk: whole-brief ones (empty `sections`) always match;
 *  section-scoped ones match when any of their sections is in the current chunk. */
function customFieldsFor(blocks: ResolvedBlock[], kind: string, sections: Section[]) {
  const custom = find<CustomBlock>(blocks, 'custom');
  return custom.fields.filter((f) => f.kind === kind && (f.sections.length === 0 || f.sections.some((s) => sections.includes(s as Section))));
}

function systemSegments(ctx: BriefContext, blocks: ResolvedBlock[]): PromptSegment[] {
  const role = find<ProseBlock>(blocks, 'role');
  const guardrails = find<ProseBlock>(blocks, 'guardrails');
  const forbidden = find<ForbiddenBlock>(blocks, 'forbidden');
  const segments: PromptSegment[] = [];

  if (role.enabled && role.part.text.trim()) {
    segments.push({ blockId: 'role', label: role.label, text: role.part.text.trim() });
  }
  if (guardrails.enabled && guardrails.part.text.trim()) {
    segments.push({ blockId: 'guardrails', label: guardrails.label, text: guardrails.part.text.trim() });
  }
  if (forbidden.enabled) {
    const words = [...forbidden.words.selected, ...customForbiddenWords(blocks)];
    const extra = forbidden.freeText.text.trim();
    if (words.length || extra) {
      const clicheLine = words.length ? `Never use these words or phrases: ${words.join(', ')}.` : '';
      segments.push({ blockId: 'forbidden', label: forbidden.label, text: [clicheLine, extra].filter(Boolean).join(' ') });
    }
  }
  if (ctx.subpages?.length) {
    segments.push({ blockId: null, label: 'Multi-page', text: MULTI_PAGE_RULES });
  }
  segments.push({ blockId: null, label: 'Output format', text: RETURN_ONLY_JSON });
  return segments;
}

/** Names the site's pages and what each carries, so the copywriter writes standalone,
 *  non-redundant per-page copy. Null on a single-page build (no subpages). */
function siteStructureSegment(ctx: BriefContext): PromptSegment | null {
  if (!ctx.subpages?.length) return null;
  const pageList = ctx.subpages.map((p) => `${p.label} (/${p.route})`).join(', ');
  return {
    blockId: null, label: 'Site structure',
    text: `This is a multi-page website. Home is a lean landing page (hero, trust, services, testimonials, final CTA). Dedicated pages: ${pageList}. Write standalone, non-redundant copy: the About page carries the detailed company story, the Services page needs per-service detail, and each subpage needs a distinct header and its own SEO. Do not repeat the hero's wording on other pages.`,
  };
}

/**
 * The business facts paragraph.
 *
 * Reads COPY_FACT_PATHS directly rather than going through a resolved `facts` block, because
 * there is no longer a facts block to go through: the Client intake step edits every one of
 * these paths, so a block whose only job was to render the same fields was removed rather
 * than left in the resolved array with no UI behind it.
 *
 * The include/exclude capability survives as the raw persisted flag. `brief.blocks.facts` is
 * now a settings key, not a block — the Client intake step's toggle is what writes it.
 * Defaults to included when the key was never set, matching resolve.ts's isEnabled().
 */
function factsSegment(ctx: BriefContext, blocks: ResolvedBlock[]): PromptSegment | null {
  if (ctx.brief.blocks.facts?.enabled === false) return null;
  const out: Record<string, unknown> = {};
  for (const path of COPY_FACT_PATHS) {
    const key = FACT_KEY_FOR_PATH[path] ?? path;
    // Grounded, not effective: a fact the client didn't give used to fall through to the
    // preset's sample (the tagline "Comfort in every season.", the badge "Licensed & insured ·
    // CAC1234567") and was sent under this heading as the client's (Tracewell, 2026-11-11).
    const v = groundedAt(ctx, path);
    const present = Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? v.trim().length > 0 : v != null;
    if (present) out[key] = v;
  }
  for (const f of customFieldsFor(blocks, 'fact', [])) {
    if (f.label.trim() && f.value.trim()) out[f.label.trim()] = f.value.trim();
  }
  if (!Object.keys(out).length) return null;
  return {
    blockId: 'facts', label: 'Business facts',
    text: `Business facts (from the client's onboarding intake and the operator):\n${JSON.stringify(out, null, 2)}`,
  };
}

function websiteSegment(blocks: ResolvedBlock[]): PromptSegment | null {
  const website = find<WebsiteBlock>(blocks, 'website');
  if (!website.enabled || !website.notes.text.trim()) return null;
  return {
    blockId: 'website', label: website.label,
    text: `Content scanned from the business's own website. Treat this as ground truth for facts (name, contact, services, reviews) and rewrite/organize it into the copy:\n${website.notes.text.trim()}`,
  };
}

function clientWordsSegment(blocks: ResolvedBlock[]): PromptSegment | null {
  const clientWords = find<LinesBlock>(blocks, 'clientWords');
  if (!clientWords.enabled || clientWords.lines.length === 0) return null;
  const joined = clientWords.lines.map((l) => `${l.label}: ${l.text}`).join('\n');
  return {
    blockId: 'clientWords', label: clientWords.label,
    text: `The business owner's own description of their business, given during onboarding. Authoritative for positioning, audience and tone: follow it closely, but invent no facts beyond it:\n${joined}`,
  };
}

/**
 * Tells the model what to DO with the client's words and the positioning chips together.
 *
 * Both were already in the prompt, each introduced by its own paragraph, and the model was
 * left to infer the relationship between them — which it gets wrong in a specific, repeatable
 * way: it treats the chips (short, abstract, "family-owned", "same-day service") as the voice
 * to write in, and the client's own sentences as mere facts to summarise. That inverts them.
 * The chips describe how the business wants to be PERCEIVED; the client's sentences are the
 * only sample of how they actually TALK, and that's what the copy has to sound like.
 *
 * Emitted only when both halves are present — with one side missing there is no relationship
 * to describe, and the paragraph would be instruction without referent.
 */
function voiceSynthesisSegment(blocks: ResolvedBlock[]): PromptSegment | null {
  const clientWords = find<LinesBlock>(blocks, 'clientWords');
  const positioning = find<PositioningBlock>(blocks, 'positioning');
  if (!clientWords.enabled || clientWords.lines.length === 0) return null;
  if (!positioning.enabled || !positioning.groups.some((g) => compileChipGroup(g))) return null;
  return {
    blockId: 'clientWords',
    label: 'Voice synthesis',
    text: [
      'How to combine the two inputs above: the positioning lines state how this business wants to be PERCEIVED; the owner\'s own words are the only evidence of how they actually TALK.',
      'Write in their voice, not in the positioning\'s voice. Carry through their specific vocabulary, their level of formality, and any term they use for their own work or their customers: if they say "folks" do not write "clients", if they name a process or a product line, use their name for it.',
      'Do not quote them verbatim and do not repeat their phrasing back as a headline; you are matching a register, not transcribing. Where their words and the positioning conflict, their words win.',
    ].join(' '),
  };
}

function positioningSegment(blocks: ResolvedBlock[]): PromptSegment | null {
  const positioning = find<PositioningBlock>(blocks, 'positioning');
  if (!positioning.enabled) return null;
  const lines = positioning.groups
    .map((g) => ({ label: g.label, text: compileChipGroup(g) }))
    .filter((g) => g.text)
    .map((g) => `${g.label}: ${g.text}.`);
  if (!lines.length) return null;
  return { blockId: 'positioning', label: positioning.label, text: `Positioning: ${lines.join(' ')}` };
}

function offersSegment(blocks: ResolvedBlock[]): PromptSegment | null {
  const offers = find<OffersBlock>(blocks, 'offers');
  if (!offers.enabled) return null;
  const lines: string[] = [];
  if (offers.promo.text.trim()) lines.push(`Current promotion: ${offers.promo.text.trim()}.`);
  const proof = compileChipGroup(offers.proof);
  if (proof) lines.push(`Proof points: ${proof}.`);
  const area = compileChipGroup(offers.serviceArea);
  if (area) lines.push(`Service area: ${area}.`);
  if (!lines.length) return null;
  return { blockId: 'offers', label: offers.label, text: `Offers and coverage: ${lines.join(' ')}` };
}

function structureSegment(ctx: BriefContext, blocks: ResolvedBlock[]): PromptSegment | null {
  const structure = find<StructureBlock>(blocks, 'structure');
  if (!structure.enabled) return null;
  // The counts are layout and come from the composition (effective), preset included. The
  // reference is text the model is told to respect, so it is grounded: the preset's hero
  // ("Licensed & insured · 24/7 emergency service" / "AC out? We can be there today.") was sent
  // as this client's existing hero (Tracewell, 2026-11-11). A previous run's generated hero is
  // not sent either: it would hand the model back whatever that run invented.
  const counts: Record<string, number> = {};
  for (const e of structure.entries) counts[e.key] = e.count;
  const hero: Record<string, string> = {};
  const eyebrow = groundedString(ctx, 'hero.eyebrow');
  const headline = groundedString(ctx, 'hero.headline');
  if (eyebrow) hero.eyebrow = eyebrow;
  if (headline) hero.headline = headline;
  const serviceTags = ctx.effective.services.items
    .map((_, i) => groundedString(ctx, `services.items.${i}.tag`))
    .filter(Boolean);
  const reference: Record<string, unknown> = {};
  if (Object.keys(hero).length) reference.hero = hero;
  if (serviceTags.length) reference.serviceTags = serviceTags;
  const ref = Object.keys(reference).length ? { ...counts, reference } : counts;
  return {
    blockId: 'structure', label: structure.label,
    text: `Existing structure to respect. Keep these exact counts:\n${JSON.stringify(ref, null, 2)}`,
  };
}

function sectionsSegment(blocks: ResolvedBlock[], sections: Section[]): PromptSegment {
  const sectionsBlock = find<SectionsBlock>(blocks, 'sections');
  const instructions = customFieldsFor(blocks, 'instruction', sections);
  const references = customFieldsFor(blocks, 'reference', sections);
  const lines: string[] = [
    // brand isn't a Sections-block entry (see resolveSections), and is always force-included
    // by generate-copy — this line is the one thing not sourced from a block, matching the
    // old system's own hardcoding of it.
    '- brand.tagline: short, memorable. Populate brand name/phone/email/address/license ONLY when grounded (see rules); otherwise omit them.',
  ];
  if (sectionsBlock.enabled) {
    for (const entry of sectionsBlock.entries) {
      if (!sections.includes(entry.section)) continue;
      let line = entry.text;
      const scopedInstructions = instructions.filter((f) => f.sections.includes(entry.section));
      if (scopedInstructions.length) line += ` ${scopedInstructions.map((f) => f.value.trim()).join(' ')}`;
      lines.push(line);
    }
  }
  for (const f of instructions.filter((f) => f.sections.length === 0)) lines.push(f.value.trim());
  for (const f of references) lines.push(`Imitate the voice of this example: ${f.value.trim()}`);
  return { blockId: 'sections', label: sectionsBlock.label, text: `Write brand copy for ONLY these sections:\n${lines.join('\n')}` };
}

export function userSegments(ctx: BriefContext, blocks: ResolvedBlock[], sections: Section[]): PromptSegment[] {
  const label = ctx.vertical.label;
  const segments: Array<PromptSegment | null> = [
    { blockId: null, label: 'Vertical', text: `Industry vertical: ${label}.` },
    siteStructureSegment(ctx),
    factsSegment(ctx, blocks),
    websiteSegment(blocks),
    clientWordsSegment(blocks),
    positioningSegment(blocks),
    // After both inputs it reconciles — an instruction about how to weigh A against B is
    // unreadable before B has been stated.
    voiceSynthesisSegment(blocks),
    offersSegment(blocks),
    structureSegment(ctx, blocks),
    sectionsSegment(blocks, sections),
    { blockId: null, label: 'Closing', text: `Be specific and grounded in the ${label} vertical. Return only JSON matching the schema.` },
  ];
  return segments.filter((s): s is PromptSegment => s !== null);
}

export function compileBriefSegments(
  ctx: BriefContext,
  blocks: ResolvedBlock[],
  sections: Section[],
): { system: PromptSegment[]; user: PromptSegment[] } {
  return { system: systemSegments(ctx, blocks), user: userSegments(ctx, blocks, sections) };
}

export function compileBriefPrompt(
  ctx: BriefContext,
  blocks: ResolvedBlock[],
  sections: Section[],
): { system: string; user: string } {
  const { system, user } = compileBriefSegments(ctx, blocks, sections);
  return {
    system: system.map((s) => s.text).join('\n\n'),
    user: user.map((s) => s.text).join('\n\n'),
  };
}
