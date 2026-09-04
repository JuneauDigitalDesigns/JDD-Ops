/**
 * resolveBrief(ctx) — computes every ResolvedBlock for one render, given the vertical, the
 * live SiteContent, and the operator's saved CopyBrief. This is the ONLY place that decides
 * what a block's default is; every editor component just renders whatever this returns and
 * calls back to change the underlying CopyBrief.
 */
import type { BrandDirection } from '@jdd/schema';
import { differentiatorsFor, customersFor, joinChoices } from '@jdd/schema';
import type { SiteContent } from '@/data/site';
import { getPath } from '@/lib/merge';
import { ALL_SECTIONS, type Section } from '@/lib/copy-schema';
import { labelFor } from '@/lib/section-labels';
import { countsFor, sectionInstructionLine } from './compile';
import { COPY_FACT_PATHS } from './facts';
import type {
  BriefContext,
  ChipGroup,
  CustomBlock,
  FactsBlock,
  ForbiddenBlock,
  LinesBlock,
  OffersBlock,
  PositioningBlock,
  ProseBlock,
  ResolvedBlock,
  SectionEntry,
  SectionsBlock,
  StructureBlock,
  TextPart,
  WebsiteBlock,
} from './types';

function isEnabled(ctx: BriefContext, id: ResolvedBlock['id']): boolean {
  return ctx.brief.blocks[id]?.enabled ?? true;
}

function stringOverride(ctx: BriefContext, id: ResolvedBlock['id'], key: string): string | undefined {
  const v = ctx.brief.blocks[id]?.overrides?.[key];
  return typeof v === 'string' ? v : undefined;
}

function arrayOverride(ctx: BriefContext, id: ResolvedBlock['id'], key: string): string[] | undefined {
  const v = ctx.brief.blocks[id]?.overrides?.[key];
  return Array.isArray(v) ? v : undefined;
}

function textPart(ctx: BriefContext, id: ResolvedBlock['id'], key: string, label: string, defaultText: string): TextPart {
  const override = stringOverride(ctx, id, key);
  return { id: key, label, defaultText, text: override ?? defaultText, edited: override !== undefined && override !== defaultText };
}

function chipGroup(
  ctx: BriefContext,
  id: ResolvedBlock['id'],
  key: string,
  label: string,
  options: string[],
  defaultSelected: string[],
  defaultFreeText = '',
): ChipGroup {
  const selectedOverride = arrayOverride(ctx, id, `${key}.selected`);
  const freeTextOverride = stringOverride(ctx, id, `${key}.freeText`);
  return {
    key,
    label,
    options,
    selected: selectedOverride ?? defaultSelected,
    defaultSelected,
    freeText: freeTextOverride ?? defaultFreeText,
    defaultFreeText,
  };
}

function resolveRole(ctx: BriefContext): ProseBlock {
  const part = textPart(ctx, 'role', 'full', 'Role & rules', ctx.vertical.prompt.role);
  return {
    id: 'role', kind: 'prose', label: 'Role & rules', channel: 'system',
    enabled: isEnabled(ctx, 'role'), part,
    summary: part.edited ? 'edited' : 'default',
  };
}

function resolveGuardrails(ctx: BriefContext): ProseBlock {
  const defaultText = ctx.vertical.prompt.guardrails;
  const part = textPart(ctx, 'guardrails', 'full', 'Guardrails', defaultText);
  return {
    id: 'guardrails', kind: 'prose', label: 'Guardrails', channel: 'system',
    enabled: isEnabled(ctx, 'guardrails'), part,
    summary: !defaultText && !part.edited ? 'none for this vertical' : part.edited ? 'edited' : 'default',
  };
}

function resolveForbidden(ctx: BriefContext): ForbiddenBlock {
  const brandDirection = (ctx.imported?._meta.brandDirection ?? null) as BrandDirection | null;
  const words = chipGroup(ctx, 'forbidden', 'words', 'Words & phrases to avoid', ctx.vertical.prompt.forbidden, ctx.vertical.prompt.forbidden);
  const freeText = textPart(ctx, 'forbidden', 'freeText', 'Additional claims to avoid', (brandDirection?.forbidden ?? '').trim());
  const count = words.selected.length + (freeText.text.trim() ? 1 : 0);
  return {
    id: 'forbidden', kind: 'forbidden', label: 'Forbidden words & claims', channel: 'system',
    enabled: isEnabled(ctx, 'forbidden'), words, freeText,
    summary: count === 0 ? 'none' : `${count} rule${count === 1 ? '' : 's'}`,
  };
}

function resolveFacts(ctx: BriefContext): FactsBlock {
  const filled = COPY_FACT_PATHS.filter((p) => {
    const v = getPath(ctx.effective, p);
    return Array.isArray(v) ? v.length > 0 : String(v ?? '').trim().length > 0;
  }).length;
  return {
    id: 'facts', kind: 'facts', label: 'Business facts', channel: 'user',
    enabled: isEnabled(ctx, 'facts'), paths: COPY_FACT_PATHS,
    summary: `${filled} of ${COPY_FACT_PATHS.length} filled`,
  };
}

/** Mirrors brandDirectionToDetails's labels (@jdd/schema/brand-direction.ts) — one line per
 *  non-empty field, in the same order, so "matches the client's onboarding answers" and the
 *  compiled "client's own words" paragraph read the same way they did before this rebuild. */
const CLIENT_WORDS_FIELDS: Array<{ key: keyof BrandDirection; label: string; join?: boolean }> = [
  { key: 'differentiators', label: 'What makes them different' },
  { key: 'targetCustomer', label: 'Target customer' },
  { key: 'vibe', label: 'Desired visual vibe', join: true },
  { key: 'tone', label: 'Tone of voice', join: true },
  { key: 'adjectives', label: 'Brand adjectives', join: true },
  { key: 'references', label: 'Brands/sites they admire' },
  { key: 'forbidden', label: 'Avoid (words / claims / styles)' },
];

function resolveClientWords(ctx: BriefContext): LinesBlock {
  const brandDirection = (ctx.imported?._meta.brandDirection ?? null) as BrandDirection | null;
  const lines: TextPart[] = [];
  for (const f of CLIENT_WORDS_FIELDS) {
    const raw = brandDirection?.[f.key];
    const defaultText = f.join ? (Array.isArray(raw) ? raw.join(', ') : '') : typeof raw === 'string' ? raw.trim() : '';
    if (!defaultText) continue;
    lines.push(textPart(ctx, 'clientWords', f.key, f.label, defaultText));
  }
  return {
    id: 'clientWords', kind: 'lines', label: "Client's own words", channel: 'user',
    enabled: isEnabled(ctx, 'clientWords'), lines,
    matchesClient: lines.every((l) => !l.edited),
    summary: lines.length === 0 ? 'client gave none' : lines.some((l) => l.edited) ? 'edited' : `${lines.length} from onboarding`,
  };
}

function resolveWebsite(ctx: BriefContext): WebsiteBlock {
  const url = ctx.brief.websiteUrl ?? '';
  const notes = textPart(ctx, 'website', 'notes', 'Scanned notes', '');
  return {
    id: 'website', kind: 'website', label: 'Website notes', channel: 'user',
    enabled: isEnabled(ctx, 'website'), url, notes,
    summary: notes.text.trim() ? `${Math.round(notes.text.length / 1024 * 10) / 10}KB scanned` : url ? 'not scanned yet' : 'no URL',
  };
}

function resolvePositioning(ctx: BriefContext): PositioningBlock {
  const serviceOptions = ctx.vertical.services.map((s) => s.label);
  const existingServiceNames = (ctx.imported?.services?.items ?? [])
    .map((s) => s.t?.trim())
    .filter((t): t is string => Boolean(t));
  const servicesSelected = existingServiceNames.filter((name) =>
    serviceOptions.some((o) => o.toLowerCase() === name.toLowerCase()),
  );
  const servicesFreeText = existingServiceNames
    .filter((name) => !serviceOptions.some((o) => o.toLowerCase() === name.toLowerCase()))
    .join(', ');

  const groups: ChipGroup[] = [
    chipGroup(ctx, 'positioning', 'services', 'Services offered', serviceOptions, servicesSelected, servicesFreeText),
    chipGroup(ctx, 'positioning', 'differentiators', 'What sets them apart', differentiatorsFor(ctx.vertical.id), []),
    chipGroup(ctx, 'positioning', 'customers', 'Who they serve', customersFor(ctx.vertical.id), []),
  ];
  const total = groups.reduce((n, g) => n + g.selected.length + (g.freeText.trim() ? 1 : 0), 0);
  return {
    id: 'positioning', kind: 'positioning', label: 'Positioning', channel: 'user',
    enabled: isEnabled(ctx, 'positioning'), groups,
    summary: total === 0 ? 'nothing selected' : `${total} selected`,
  };
}

function resolveOffers(ctx: BriefContext): OffersBlock {
  const promo = textPart(ctx, 'offers', 'promo', 'Current promotion', ctx.effective.announcement ?? '');
  const trustBadges = ctx.effective.extensions?.trustBadges ?? [];
  const proof = chipGroup(ctx, 'offers', 'proof', 'Proof points', trustBadges, trustBadges);
  const towns = ctx.effective.extensions?.serviceArea ?? [];
  const serviceArea = chipGroup(ctx, 'offers', 'serviceArea', 'Service area', towns, towns);
  const total = (promo.text.trim() ? 1 : 0) + proof.selected.length + serviceArea.selected.length;
  return {
    id: 'offers', kind: 'offers', label: 'Offers, proof & coverage', channel: 'user',
    enabled: isEnabled(ctx, 'offers'), promo, proof, serviceArea,
    summary: total === 0 ? 'nothing set' : `${total} item${total === 1 ? '' : 's'}`,
  };
}

/** Structure entries whose count the client's own intake already fixed — only services is
 *  ever client-driven (buildScaffold seeds one entry per client-supplied service); every
 *  other count is always scaffold-seeded from DEFAULT_STRUCTURE regardless of client input,
 *  so only this one can lock. See the plan's note: "only generate these when the client has
 *  not already provided them from their intake file" applies to services alone. */
function resolveStructure(ctx: BriefContext): StructureBlock {
  const counts = countsFor(ctx.effective);
  const structureOverrides = ctx.brief.structureOverrides ?? {};
  const clientServiceNames = (ctx.imported?.services?.items ?? []).filter((s) => s.t?.trim());
  const servicesLocked = clientServiceNames.length > 0;

  const entries: StructureBlock['entries'] = [
    { key: 'services', label: 'Services', count: counts.services, defaultCount: counts.services, locked: servicesLocked },
    { key: 'pillars', label: 'About pillars', count: structureOverrides.pillars ?? counts.pillars, defaultCount: ctx.vertical.structure.pillars ?? counts.pillars, locked: false },
    { key: 'stats', label: 'Stats', count: structureOverrides.stats ?? counts.stats, defaultCount: ctx.vertical.structure.stats ?? counts.stats, locked: false },
    { key: 'testimonials', label: 'Testimonials', count: structureOverrides.testimonials ?? counts.testimonials, defaultCount: ctx.vertical.structure.testimonials ?? counts.testimonials, locked: false },
    { key: 'faq', label: 'FAQ', count: structureOverrides.faq ?? counts.faq, defaultCount: ctx.vertical.structure.faq ?? counts.faq, locked: false },
    { key: 'heroBullets', label: 'Hero bullets', count: structureOverrides.heroBullets ?? counts.heroBullets, defaultCount: ctx.vertical.structure.heroBullets ?? counts.heroBullets, locked: false },
    { key: 'heroFrictionReducers', label: 'Hero friction reducers', count: structureOverrides.heroFrictionReducers ?? counts.heroFriction, defaultCount: ctx.vertical.structure.heroFrictionReducers ?? counts.heroFriction, locked: false },
    { key: 'ctaFrictionReducers', label: 'CTA friction reducers', count: structureOverrides.ctaFrictionReducers ?? counts.ctaFriction, defaultCount: ctx.vertical.structure.ctaFrictionReducers ?? counts.ctaFriction, locked: false },
  ];
  return {
    id: 'structure', kind: 'structure', label: 'Structure & counts', channel: 'user',
    enabled: isEnabled(ctx, 'structure'), entries,
    summary: servicesLocked ? `${counts.services} services from client` : `${entries.length} counts`,
  };
}

function resolveSections(ctx: BriefContext): SectionsBlock {
  const counts = countsFor(ctx.effective);
  const sectionIds = ALL_SECTIONS.filter((s) => s !== 'brand');
  const ticked = new Set(ctx.tickedSections);
  const entries: SectionEntry[] = sectionIds.map((section) => {
    const defaultText = sectionInstructionLine(section, {
      pillars: counts.pillars, stats: counts.stats, services: counts.services,
      testimonials: counts.testimonials, faq: counts.faq, heroBullets: counts.heroBullets,
      heroFriction: counts.heroFriction, ctaFriction: counts.ctaFriction,
    }) ?? '';
    const override = stringOverride(ctx, 'sections', section);
    return {
      section, label: labelFor(section), ticked: ticked.has(section),
      defaultText, text: override ?? defaultText, edited: override !== undefined && override !== defaultText,
    };
  });
  const tickedCount = entries.filter((e) => e.ticked).length;
  return {
    id: 'sections', kind: 'sections', label: 'Section instructions', channel: 'user',
    enabled: isEnabled(ctx, 'sections'), entries,
    summary: `${tickedCount} of ${entries.length} ticked`,
  };
}

function resolveCustom(ctx: BriefContext): CustomBlock {
  return {
    id: 'custom', kind: 'custom', label: 'Custom fields', channel: 'user',
    enabled: true, fields: ctx.brief.customFields,
    summary: ctx.brief.customFields.length === 0 ? 'none' : `${ctx.brief.customFields.length} field${ctx.brief.customFields.length === 1 ? '' : 's'}`,
  };
}

export function resolveBrief(ctx: BriefContext): ResolvedBlock[] {
  return [
    resolveRole(ctx),
    resolveGuardrails(ctx),
    resolveFacts(ctx),
    resolveClientWords(ctx),
    resolveWebsite(ctx),
    resolvePositioning(ctx),
    resolveOffers(ctx),
    resolveForbidden(ctx),
    resolveStructure(ctx),
    resolveSections(ctx),
    resolveCustom(ctx),
  ];
}

/** Compile joined chip-group text: ticked options + free text, matching joinChoices'
 *  ". "-separated convention (@jdd/schema/industry-menu.ts) so a chip block's compiled
 *  contribution reads the same way the onboarding wizard's own chip pickers do. */
export function compileChipGroup(group: ChipGroup): string {
  return joinChoices(group.selected, group.freeText);
}

function chipGroupEdited(g: ChipGroup): boolean {
  return g.selected.join(' ') !== g.defaultSelected.join(' ') || g.freeText !== g.defaultFreeText;
}

/** Whether a resolved block differs from its default — for the rail's status dot. Kept
 *  separate from each editor's own header (which needs the SAME judgement to show its
 *  revert button) so the rail doesn't have to mount a block's editor just to know its state. */
export function blockStatus(block: ResolvedBlock): 'off' | 'edited' | 'default' {
  if (!block.enabled) return 'off';
  switch (block.kind) {
    case 'prose':
      return block.part.edited ? 'edited' : 'default';
    case 'forbidden':
      return chipGroupEdited(block.words) || block.freeText.edited ? 'edited' : 'default';
    case 'facts':
      return 'default';
    case 'lines':
      return block.matchesClient ? 'default' : 'edited';
    case 'website':
      return block.notes.edited ? 'edited' : 'default';
    case 'positioning':
      return block.groups.some(chipGroupEdited) ? 'edited' : 'default';
    case 'offers':
      return block.promo.edited || chipGroupEdited(block.proof) || chipGroupEdited(block.serviceArea) ? 'edited' : 'default';
    case 'structure':
      return block.entries.some((e) => e.count !== e.defaultCount) ? 'edited' : 'default';
    case 'sections':
      return block.entries.some((e) => e.edited) ? 'edited' : 'default';
    case 'custom':
      return 'default';
    default:
      return 'default';
  }
}
