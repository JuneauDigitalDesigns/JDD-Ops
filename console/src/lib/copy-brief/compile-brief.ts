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
import { getPath } from '@/lib/merge';
import type { Section } from '@/lib/copy-schema';
import { FACT_KEY_FOR_PATH } from './facts';
import { compileChipGroup } from './resolve';
import type {
  BriefContext,
  CopyBriefBlockId,
  CustomBlock,
  FactsBlock,
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

const RETURN_ONLY_JSON = 'Return ONLY a JSON object that conforms to the provided output schema. No prose, no markdown, no code fences.';

const MULTI_PAGE_RULES = 'This is a MULTI-PAGE website, not a single landing page. Copy for one page must never duplicate another page\'s wording — each page stands on its own. The About page carries the detailed company story; the Services page carries per-service detail; every non-home page has a distinct header and its own SEO title and description.';

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

function factsSegment(ctx: BriefContext, blocks: ResolvedBlock[]): PromptSegment | null {
  const facts = find<FactsBlock>(blocks, 'facts');
  if (!facts.enabled) return null;
  const out: Record<string, unknown> = {};
  for (const path of facts.paths) {
    const key = FACT_KEY_FOR_PATH[path] ?? path;
    const v = getPath(ctx.effective, path);
    const present = Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? v.trim().length > 0 : v != null;
    if (present) out[key] = v;
  }
  for (const f of customFieldsFor(blocks, 'fact', [])) {
    if (f.label.trim() && f.value.trim()) out[f.label.trim()] = f.value.trim();
  }
  if (!Object.keys(out).length) return null;
  return {
    blockId: 'facts', label: facts.label,
    text: `Business facts (from the client's onboarding intake / preset):\n${JSON.stringify(out, null, 2)}`,
  };
}

function websiteSegment(blocks: ResolvedBlock[]): PromptSegment | null {
  const website = find<WebsiteBlock>(blocks, 'website');
  if (!website.enabled || !website.notes.text.trim()) return null;
  return {
    blockId: 'website', label: website.label,
    text: `Content scanned from the business's own website — treat this as ground truth for facts (name, contact, services, reviews) and rewrite/organize it into the copy:\n${website.notes.text.trim()}`,
  };
}

function clientWordsSegment(blocks: ResolvedBlock[]): PromptSegment | null {
  const clientWords = find<LinesBlock>(blocks, 'clientWords');
  if (!clientWords.enabled || clientWords.lines.length === 0) return null;
  const joined = clientWords.lines.map((l) => `${l.label}: ${l.text}`).join('\n');
  return {
    blockId: 'clientWords', label: clientWords.label,
    text: `The business owner's own description of their business, given during onboarding. Authoritative for positioning, audience and tone — follow it closely, but invent no facts beyond it:\n${joined}`,
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
  const counts: Record<string, number> = {};
  for (const e of structure.entries) counts[e.key] = e.count;
  const ref = {
    ...counts,
    reference: {
      hero: { eyebrow: ctx.effective.hero.eyebrow, headline: ctx.effective.hero.headline },
      serviceTags: ctx.effective.services.items.map((s) => s.tag),
    },
  };
  return {
    blockId: 'structure', label: structure.label,
    text: `Existing structure to respect — keep these exact counts:\n${JSON.stringify(ref, null, 2)}`,
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
