'use client';

import type { CopyBrief } from '@jdd/schema';
import type { LinesBlock } from '@/lib/copy-brief/types';
import { setBlockEnabled, setBlockOverride } from '@/lib/copy-brief/mutations';
import { BlockHeader, TextPartEditor } from '../BlockPrimitives';

type Update = (mutate: (brief: CopyBrief) => CopyBrief) => void;

export default function ClientWordsBlockEditor({ block, onUpdate }: { block: LinesBlock; onUpdate: Update }) {
  return (
    <div>
      <BlockHeader
        label={block.label}
        channel={block.channel}
        enabled={block.enabled}
        onToggleEnabled={(v) => onUpdate((b) => setBlockEnabled(b, 'clientWords', v))}
      />
      {block.lines.length === 0 ? (
        <p className="text-sm text-uiInkSoft">
          The client skipped the brand-direction step during onboarding, so there&rsquo;s nothing here yet.
        </p>
      ) : (
        <>
          <p className="mb-4 text-sm text-uiInkSoft">
            The business owner&rsquo;s own answers from onboarding. Authoritative for positioning, audience and
            tone — the copywriter follows this closely, but invents no facts beyond it.
          </p>
          {block.lines.map((line) => (
            <TextPartEditor
              key={line.id}
              label={line.label}
              text={line.text}
              defaultText={line.defaultText}
              edited={line.edited}
              rows={2}
              onChange={(v) => onUpdate((b) => setBlockOverride(b, 'clientWords', line.id, v === line.defaultText ? undefined : v))}
              onRevert={() => onUpdate((b) => setBlockOverride(b, 'clientWords', line.id, undefined))}
            />
          ))}
        </>
      )}
    </div>
  );
}
