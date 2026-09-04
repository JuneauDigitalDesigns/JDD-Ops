'use client';

import type { CopyBrief } from '@jdd/schema';
import type { ForbiddenBlock, ProseBlock } from '@/lib/copy-brief/types';
import { setBlockEnabled, setBlockOverride, setChipSelected, toggleChip } from '@/lib/copy-brief/mutations';
import { BlockHeader, ChipGroupEditor, OverrideTextarea } from '../BlockPrimitives';

type Update = (mutate: (brief: CopyBrief) => CopyBrief) => void;

/** role and guardrails share this editor — both are a single editable paragraph with one
 *  default/edited/revert. Guardrails additionally shows a note when the vertical has none. */
export function ProseBlockEditor({ block, onUpdate }: { block: ProseBlock; onUpdate: Update }) {
  const { part } = block;
  return (
    <div>
      <BlockHeader
        label={block.label}
        channel={block.channel}
        enabled={block.enabled}
        onToggleEnabled={(v) => onUpdate((b) => setBlockEnabled(b, block.id, v))}
        edited={part.edited}
        onRevert={() => onUpdate((b) => setBlockOverride(b, block.id, 'full', undefined))}
      />
      {block.id === 'guardrails' && !part.defaultText && !part.edited && (
        <p className="mb-3 text-sm text-uiInkSoft">
          No standing guardrails for this vertical. Add some below if this client needs them —
          they won&rsquo;t affect the vertical&rsquo;s default for other clients.
        </p>
      )}
      <OverrideTextarea
        value={part.text}
        onChange={(v) => onUpdate((b) => setBlockOverride(b, block.id, 'full', v === part.defaultText ? undefined : v))}
        rows={block.id === 'guardrails' ? 3 : 8}
        placeholder={block.id === 'guardrails' ? 'e.g. no medical claims, no pricing promises…' : undefined}
      />
    </div>
  );
}

export function ForbiddenBlockEditor({ block, onUpdate }: { block: ForbiddenBlock; onUpdate: Update }) {
  const { words, freeText } = block;
  const edited = words.selected.join() !== words.defaultSelected.join() || freeText.edited;
  return (
    <div>
      <BlockHeader
        label={block.label}
        channel={block.channel}
        enabled={block.enabled}
        onToggleEnabled={(v) => onUpdate((b) => setBlockEnabled(b, 'forbidden', v))}
        edited={edited}
        onRevert={() =>
          onUpdate((b) => {
            const cleared = setBlockOverride(b, 'forbidden', 'words.selected', undefined);
            return setBlockOverride(cleared, 'forbidden', 'freeText', undefined);
          })
        }
        revertLabel="Revert to the vertical's defaults"
      />
      <ChipGroupEditor
        label="Clichés to never use"
        options={words.options}
        selected={words.selected}
        onToggle={(option) => onUpdate((b) => setChipSelected(b, 'forbidden', 'words', toggleChip(words.selected, option)))}
      />
      <div>
        <p className="mb-1.5 text-sm font-medium text-uiFg2">Additional claims to avoid</p>
        <OverrideTextarea
          value={freeText.text}
          onChange={(v) => onUpdate((b) => setBlockOverride(b, 'forbidden', 'freeText', v === freeText.defaultText ? undefined : v))}
          rows={2}
          placeholder="e.g. never mention financing, never promise same-day service…"
        />
      </div>
    </div>
  );
}
