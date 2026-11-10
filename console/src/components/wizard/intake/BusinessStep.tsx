'use client';

/**
 * Step 1, Business: the business facts as three checklist columns, plus the client's own words
 * read-only beside them. Replaces ClientIntakeStep, one form 3,785 px tall at 1440×900.
 *
 * Each row says where its value came from (lib/intake-sources.ts). A preset placeholder shows as
 * Preset and counts as missing. The rows are BUSINESS_GROUPS from lib/intake-todo.ts, the same
 * list Still to do checks. Services, area, profiles and reviews each have their own step.
 */
import { useEffect, useState } from 'react';
import type { CopyBrief } from '@jdd/schema';
import type { SiteContent } from '@/data/site';
import type { SetField } from '@/components/fields';
import { getPath } from '@/lib/merge';
import { setBlockEnabled } from '@/lib/copy-brief/mutations';
import type { LinesBlock } from '@/lib/copy-brief/types';
import { sourceOf, isSupplied, type SourceContext } from '@/lib/intake-sources';
import { BUSINESS_GROUPS } from '@/lib/intake-todo';
import type { VerticalId } from '@/lib/verticals';
import VerticalPicker from '@/app/c/[slug]/build/VerticalPicker';
import { Card, FactRow, SourceChip } from './ui';
import JsonHatch from './JsonHatch';

type Update = (mutate: (brief: CopyBrief) => CopyBrief) => void;

export default function BusinessStep({
  content, sources, setField, clientWords, factsEnabled, onUpdate,
  vertical, clientPickedVertical, onVerticalChange, onReplaceContent, focusPath,
}: {
  content: SiteContent;
  sources: SourceContext;
  setField: SetField;
  clientWords: LinesBlock | undefined;
  factsEnabled: boolean;
  onUpdate: Update;
  vertical: VerticalId;
  clientPickedVertical: VerticalId | null;
  onVerticalChange: (v: VerticalId) => void;
  onReplaceContent: (site: SiteContent) => void;
  /** A path Still to do jumped to: that row opens for editing. */
  focusPath?: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { if (focusPath) setOpen(focusPath); }, [focusPath]);

  const fields = BUSINESS_GROUPS.flatMap((g) => g.fields);
  const supplied = fields.filter((f) => isSupplied(sourceOf(sources, f.path))).length;
  const pct = Math.round((supplied / fields.length) * 100);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3.5 px-6 py-4">
      <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2">
        <h2 className="font-display text-[28px] font-bold leading-none text-uiInk">
          {content.brand?.name?.trim() || <span className="italic text-uiFg3">Unnamed business</span>}
        </h2>
        <div className="flex flex-col gap-1">
          <div className="h-1.5 w-40 overflow-hidden rounded-full bg-uiSurface-2" style={{ background: 'var(--ui-surface-2)' }}>
            <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--ok)' }} />
          </div>
          <span className="font-chromeMono text-2xs text-uiFg3">{supplied} of {fields.length} facts</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Sources">
          <SourceChip source="form" /><SourceChip source="close" /><SourceChip source="console" />
          <SourceChip source="preset" /><SourceChip source="notGiven" /><SourceChip source="notAsked" />
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2 text-2xs text-uiFg3">
            Industry
            <VerticalPicker vertical={vertical} clientPicked={clientPickedVertical} onChange={onVerticalChange} />
          </span>
          <JsonHatch content={content} onReplaceContent={onReplaceContent} />
          <label className="flex cursor-pointer items-center gap-2">
            <span className="text-2xs uppercase tracking-wide text-uiFg2">
              {factsEnabled ? 'Sent to copywriter' : 'Withheld'}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={factsEnabled}
              aria-label="Business facts sent to the copywriter"
              onClick={() => onUpdate((b) => setBlockEnabled(b, 'facts', !factsEnabled))}
              className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors"
              style={{ background: factsEnabled ? 'var(--ui-accent)' : 'var(--ui-rule-strong)' }}
            >
              <span
                className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
                style={{ transform: factsEnabled ? 'translateX(18px)' : 'translateX(3px)' }}
              />
            </button>
          </label>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-3.5 lg:grid-cols-[repeat(3,minmax(0,1fr))_300px] 2xl:grid-cols-[repeat(3,minmax(0,1fr))_380px]">
        {BUSINESS_GROUPS.map((g) => {
          const done = g.fields.filter((f) => isSupplied(sourceOf(sources, f.path))).length;
          return (
            <Card key={g.id} title={g.title} right={<span className="font-chromeMono text-2xs text-uiFg3">{done} / {g.fields.length}</span>}>
              <div className="divide-y divide-uiCardRule/40">
                {g.fields.map((f) => (
                  <FactRow
                    key={f.path}
                    path={f.path}
                    label={f.label}
                    value={getPath(content, f.path)}
                    source={sourceOf(sources, f.path)}
                    optional={f.optional}
                    list={f.list}
                    open={open === f.path}
                    onOpen={() => setOpen(f.path)}
                    onClose={() => setOpen(null)}
                    onSave={(v) => setField(f.path, v)}
                  />
                ))}
              </div>
            </Card>
          );
        })}

        <Card title="In their own words" right={<span className="font-chromeMono text-2xs text-uiFg3">read-only</span>}>
          {!clientWords || clientWords.lines.length === 0 ? (
            <p className="p-3.5 text-xs italic leading-relaxed text-uiFg3">
              No brand-direction answers in the intake. The copy is grounded in the facts alone.
            </p>
          ) : (
            <div className="divide-y divide-uiCardRule/40">
              {clientWords.lines.map((line) => (
                <div key={line.id} className="px-3.5 py-3">
                  <p className="font-chromeMono text-[10.5px] uppercase tracking-[0.1em] text-uiFg3">{line.label}</p>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-uiFg2">{line.text}</p>
                </div>
              ))}
              <p className="px-3.5 py-2.5 text-2xs text-uiFg3">Edited on Their words.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
