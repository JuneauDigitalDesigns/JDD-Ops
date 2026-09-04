'use client';

import type { CopyBrief } from '@jdd/schema';
import type { SiteContent } from '@/data/site';
import { Field, StringListSection, type SetField } from '@/components/fields';
import { isFieldFlagged } from '@/lib/flags';
import { labelOf } from '@/lib/field-labels';
import { getPath } from '@/lib/merge';
import type { FactsBlock } from '@/lib/copy-brief/types';
import { setBlockEnabled } from '@/lib/copy-brief/mutations';
import { BlockHeader } from '../BlockPrimitives';

type Update = (mutate: (brief: CopyBrief) => CopyBrief) => void;

const LIST_PATHS = new Set(['extensions.serviceArea', 'extensions.trustBadges', 'trust.logos']);

/**
 * Absorbs what used to be the standalone "Needs review" section (MissingFieldList.tsx,
 * deleted in this rebuild) — the same curated fact paths, editable in place, with the same
 * amber ReviewBadge for anything the intake flagged. The difference is scope: this covers
 * exactly the paths the copywriter actually reads (copy-brief/facts.ts's COPY_FACT_PATHS),
 * not a longer "every field that might matter" list.
 *
 * Writes go straight through setField to SiteContent — there is no separate "override" for
 * facts, since the fact IS the content. Only the include/exclude toggle touches the CopyBrief.
 */
export default function FactsBlockEditor({
  block, content, setField, missingFields, onUpdate,
}: {
  block: FactsBlock;
  content: SiteContent;
  setField: SetField;
  /** _meta.missing_fields, for the ReviewBadge — see lib/flags.ts. */
  missingFields: string[];
  onUpdate: Update;
}) {
  return (
    <div>
      <BlockHeader
        label={block.label}
        channel={block.channel}
        enabled={block.enabled}
        onToggleEnabled={(v) => onUpdate((b) => setBlockEnabled(b, 'facts', v))}
      />
      <div className="space-y-4">
        {block.paths.map((path) => {
          const flagged = isFieldFlagged(missingFields, path);
          if (LIST_PATHS.has(path)) {
            const arr = (getPath(content, path) as string[] | undefined) ?? [];
            return (
              <div key={path} className="rounded-md border border-uiCardRule">
                <StringListSection
                  content={content}
                  setField={setField}
                  basePath={path}
                  title={labelOf(path)}
                  flagged={flagged}
                  defaultOpen={arr.length > 0}
                />
              </div>
            );
          }
          return <Field key={path} content={content} setField={setField} path={path} label={labelOf(path)} flagged={flagged} />;
        })}
      </div>
    </div>
  );
}
