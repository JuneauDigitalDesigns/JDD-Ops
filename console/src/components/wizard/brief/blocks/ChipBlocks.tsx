'use client';

import type { CopyBrief } from '@jdd/schema';
import type { OffersBlock, PositioningBlock } from '@/lib/copy-brief/types';
import { setBlockEnabled, setBlockOverride, setChipFreeText, setChipSelected, toggleChip } from '@/lib/copy-brief/mutations';
import { BlockHeader, ChipGroupEditor, FieldLabel, OverrideTextarea } from '../BlockPrimitives';

type Update = (mutate: (brief: CopyBrief) => CopyBrief) => void;

export function PositioningBlockEditor({ block, onUpdate }: { block: PositioningBlock; onUpdate: Update }) {
  return (
    <div>
      <BlockHeader
        label={block.label}
        channel={block.channel}
        enabled={block.enabled}
        onToggleEnabled={(v) => onUpdate((b) => setBlockEnabled(b, 'positioning', v))}
      />
      {block.groups.map((group) => (
        <ChipGroupEditor
          key={group.key}
          label={group.label}
          options={group.options}
          selected={group.selected}
          onToggle={(option) => onUpdate((b) => setChipSelected(b, 'positioning', group.key, toggleChip(group.selected, option)))}
          freeText={group.freeText}
          onFreeTextChange={(v) => onUpdate((b) => setChipFreeText(b, 'positioning', group.key, v))}
          freeTextPlaceholder={group.key === 'services' ? 'Other services, comma-separated…' : 'Add your own, comma-separated…'}
        />
      ))}
    </div>
  );
}

export function OffersBlockEditor({ block, onUpdate }: { block: OffersBlock; onUpdate: Update }) {
  return (
    <div>
      <BlockHeader
        label={block.label}
        channel={block.channel}
        enabled={block.enabled}
        onToggleEnabled={(v) => onUpdate((b) => setBlockEnabled(b, 'offers', v))}
      />
      <div className="mb-4">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <FieldLabel>{block.promo.label}</FieldLabel>
          {block.promo.edited && (
            <button
              type="button"
              onClick={() => onUpdate((b) => setBlockOverride(b, 'offers', 'promo', undefined))}
              className="mb-1.5 font-chromeMono text-2xs text-uiInkSoft hover:text-uiInk"
            >
              revert
            </button>
          )}
        </div>
        <OverrideTextarea
          value={block.promo.text}
          onChange={(v) => onUpdate((b) => setBlockOverride(b, 'offers', 'promo', v === block.promo.defaultText ? undefined : v))}
          rows={2}
          placeholder="e.g. $50 off first service this month"
        />
      </div>
      <ChipGroupEditor
        label="Proof points"
        options={block.proof.options}
        selected={block.proof.selected}
        onToggle={(o) => onUpdate((b) => setChipSelected(b, 'offers', 'proof', toggleChip(block.proof.selected, o)))}
        freeText={block.proof.freeText}
        onFreeTextChange={(v) => onUpdate((b) => setChipFreeText(b, 'offers', 'proof', v))}
        freeTextPlaceholder="Other certifications or awards, comma-separated…"
      />
      <ChipGroupEditor
        label="Service area"
        options={block.serviceArea.options}
        selected={block.serviceArea.selected}
        onToggle={(o) => onUpdate((b) => setChipSelected(b, 'offers', 'serviceArea', toggleChip(block.serviceArea.selected, o)))}
        freeText={block.serviceArea.freeText}
        onFreeTextChange={(v) => onUpdate((b) => setChipFreeText(b, 'offers', 'serviceArea', v))}
        freeTextPlaceholder="Other towns, comma-separated…"
      />
    </div>
  );
}
