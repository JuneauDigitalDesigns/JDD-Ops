/**
 * The runtime shapes the Brief stage computes per render — "what does this block look like
 * right now, given the vertical + live content + the operator's saved overrides."
 *
 * Deliberately NOT one shape for every block. An earlier draft tried a single ResolvedBlock
 * interface with an optional `parts` array covering both prose (role, guardrails) and chip
 * pickers (positioning, offers, forbidden) — but "the text has a default, you can edit it,
 * one button reverts it" and "these chips are ticked or not, reverting resets which chips are
 * ticked" are different interaction models, and forcing both through the same fields either
 * left most of them unused per block or blurred what each editor actually needed to render.
 * A discriminated union means every editor component destructures exactly the fields its
 * block kind has, with no `as` casts and no fields that are sometimes meaningless.
 *
 * Persisted state (CopyBrief, CopyBriefBlock, CopyBriefCustomField) lives in @jdd/schema —
 * these ResolvedBlock variants are the read side, derived fresh on every render by resolve.ts
 * from that persisted state plus the vertical record and the live SiteContent. Nothing here
 * is itself saved; edits flow back through onOverrideChange/onToggle callbacks into the
 * CopyBrief the caller owns.
 */
import type { CopyBrief, CopyBriefBlockId, CopyBriefCustomField, VerticalDef } from '@jdd/schema';
import type { SiteContent } from '@/data/site';
import type { Section } from '@/lib/copy-schema';

export type { CopyBrief, CopyBriefBlockId, CopyBriefCustomField, VerticalDef };

/** Which half of the compiled prompt a block feeds — drives where compile.ts places it. */
export type BlockChannel = 'system' | 'user';

/** One editable line/paragraph with its own default and revert, shared by several block kinds. */
export interface TextPart {
  /** Stable id within the block — the key used in CopyBriefBlock.overrides. */
  id: string;
  label: string;
  defaultText: string;
  /** defaultText, or the operator's override when one is set. */
  text: string;
  edited: boolean;
}

/** A tickable option set with free text, shared by positioning/offers/forbidden. */
export interface ChipGroup {
  key: string;
  label: string;
  options: string[];
  /** Currently ticked options — the operator's selection, or the vertical's suggested default
   *  when no override has been saved yet. */
  selected: string[];
  defaultSelected: string[];
  freeText: string;
  defaultFreeText: string;
}

export interface StructureEntry {
  key: string;
  label: string;
  count: number;
  defaultCount: number;
  /** True when the client's own intake already supplied this many real items — the count
   *  can't be edited here, only unlocked (see IntakeStep's structure block editor). */
  locked: boolean;
}

export interface SectionEntry {
  section: Section;
  label: string;
  ticked: boolean;
  defaultText: string;
  text: string;
  edited: boolean;
}

interface ResolvedBlockBase {
  id: CopyBriefBlockId;
  label: string;
  channel: BlockChannel;
  enabled: boolean;
  /** One-line rail summary, e.g. "7 facts", "4 differentiators", "off". */
  summary: string;
}

export interface ProseBlock extends ResolvedBlockBase {
  kind: 'prose';
  id: 'role' | 'guardrails';
  part: TextPart;
}

export interface ForbiddenBlock extends ResolvedBlockBase {
  kind: 'forbidden';
  id: 'forbidden';
  words: ChipGroup;
  freeText: TextPart;
}

export interface FactsBlock extends ResolvedBlockBase {
  kind: 'facts';
  id: 'facts';
  /** SiteContent paths this block covers — see facts.ts's COPY_FACT_PATHS. */
  paths: string[];
}

export interface LinesBlock extends ResolvedBlockBase {
  kind: 'lines';
  id: 'clientWords';
  lines: TextPart[];
  /** True when every line matches the client's own onboarding answers verbatim. */
  matchesClient: boolean;
}

export interface WebsiteBlock extends ResolvedBlockBase {
  kind: 'website';
  id: 'website';
  url: string;
  notes: TextPart;
}

export interface PositioningBlock extends ResolvedBlockBase {
  kind: 'positioning';
  id: 'positioning';
  groups: ChipGroup[];
}

export interface OffersBlock extends ResolvedBlockBase {
  kind: 'offers';
  id: 'offers';
  promo: TextPart;
  proof: ChipGroup;
  serviceArea: ChipGroup;
}

export interface StructureBlock extends ResolvedBlockBase {
  kind: 'structure';
  id: 'structure';
  entries: StructureEntry[];
}

export interface SectionsBlock extends ResolvedBlockBase {
  kind: 'sections';
  id: 'sections';
  entries: SectionEntry[];
}

export interface CustomBlock extends ResolvedBlockBase {
  kind: 'custom';
  id: 'custom';
  fields: CopyBriefCustomField[];
}

export type ResolvedBlock =
  | ProseBlock
  | ForbiddenBlock
  | FactsBlock
  | LinesBlock
  | WebsiteBlock
  | PositioningBlock
  | OffersBlock
  | StructureBlock
  | SectionsBlock
  | CustomBlock;

/** Everything resolve.ts needs to compute every block for one render. */
export interface BriefContext {
  vertical: VerticalDef;
  /** The merged content (preset ← imported ← generated ← edits) — what "the current facts"
   *  and "the current counts" mean right now. */
  effective: SiteContent;
  /** The client's own onboarding intake, when there is one — distinguishes a real client
   *  answer from a vertical-preset placeholder for the structure block's lock logic, and is
   *  where clientWords reads `imported._meta.brandDirection` from directly (the raw object,
   *  not the compiled `brandDirectionToDetails` string — resolving per-line parts needs the
   *  fields separately, and re-parsing them back out of the compiled prose isn't reliable). */
  imported: SiteContent | null;
  brief: CopyBrief;
  /** Sections ticked for the next run — mirrors brief.tickedSections but kept as a live
   *  Section[] since Section (copy-schema.ts) is a console-only type the schema package
   *  doesn't know about. */
  tickedSections: Section[];
}
