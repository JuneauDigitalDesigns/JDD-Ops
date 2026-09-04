/**
 * Immutable CopyBrief updates — every Brief-stage editor calls one of these instead of
 * hand-rolling a spread, so the override-key conventions resolve.ts depends on (chip groups
 * keyed as `${key}.selected` / `${key}.freeText`, everything else keyed by its own part id)
 * live in exactly one place.
 */
import type { CopyBrief, CopyBriefBlockId, CopyBriefCustomField } from '@jdd/schema';

function ensureBlock(brief: CopyBrief, id: CopyBriefBlockId) {
  return brief.blocks[id] ?? { enabled: true };
}

export function setBlockEnabled(brief: CopyBrief, id: CopyBriefBlockId, enabled: boolean): CopyBrief {
  return { ...brief, blocks: { ...brief.blocks, [id]: { ...ensureBlock(brief, id), enabled } } };
}

/** Set (or, with `value === undefined`, clear) one override key on a block. */
export function setBlockOverride(
  brief: CopyBrief,
  id: CopyBriefBlockId,
  key: string,
  value: string | string[] | undefined,
): CopyBrief {
  const block = ensureBlock(brief, id);
  const overrides = { ...(block.overrides ?? {}) };
  if (value === undefined) delete overrides[key];
  else overrides[key] = value;
  return { ...brief, blocks: { ...brief.blocks, [id]: { ...block, overrides } } };
}

export function setChipSelected(brief: CopyBrief, id: CopyBriefBlockId, groupKey: string, selected: string[]): CopyBrief {
  return setBlockOverride(brief, id, `${groupKey}.selected`, selected);
}

export function setChipFreeText(brief: CopyBrief, id: CopyBriefBlockId, groupKey: string, freeText: string): CopyBrief {
  return setBlockOverride(brief, id, `${groupKey}.freeText`, freeText);
}

export function toggleChip(selected: string[], option: string): string[] {
  return selected.includes(option) ? selected.filter((s) => s !== option) : [...selected, option];
}

export function setStructureOverride(brief: CopyBrief, key: string, count: number): CopyBrief {
  return { ...brief, structureOverrides: { ...(brief.structureOverrides ?? {}), [key]: count } };
}

export function setWebsiteUrl(brief: CopyBrief, url: string): CopyBrief {
  return { ...brief, websiteUrl: url };
}

export function setTickedSections(brief: CopyBrief, sections: string[]): CopyBrief {
  return { ...brief, tickedSections: sections };
}

export function addCustomField(brief: CopyBrief, field: CopyBriefCustomField): CopyBrief {
  return { ...brief, customFields: [...brief.customFields, field] };
}

export function updateCustomField(brief: CopyBrief, id: string, patch: Partial<CopyBriefCustomField>): CopyBrief {
  return { ...brief, customFields: brief.customFields.map((f) => (f.id === id ? { ...f, ...patch } : f)) };
}

export function removeCustomField(brief: CopyBrief, id: string): CopyBrief {
  return { ...brief, customFields: brief.customFields.filter((f) => f.id !== id) };
}

export function emptyCopyBrief(): CopyBrief {
  return { blocks: {}, customFields: [] };
}
