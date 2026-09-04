'use client';

import { useState } from 'react';
import type { CopyBrief, CopyBriefCustomField } from '@jdd/schema';
import { Plus, Trash, CaretDown } from '@phosphor-icons/react';
import type { CustomBlock } from '@/lib/copy-brief/types';
import { ALL_SECTIONS, type Section } from '@/lib/copy-schema';
import { labelFor } from '@/lib/section-labels';
import { addCustomField, removeCustomField, updateCustomField } from '@/lib/copy-brief/mutations';
import { FieldLabel, OverrideInput, OverrideTextarea } from '../BlockPrimitives';

type Update = (mutate: (brief: CopyBrief) => CopyBrief) => void;

const KIND_OPTIONS: Array<{ value: CopyBriefCustomField['kind']; label: string; hint: string }> = [
  { value: 'fact', label: 'Fact', hint: 'Grounds a claim — lands in the business-facts JSON.' },
  { value: 'instruction', label: 'Instruction', hint: "Tells the copywriter what to do — lands in the section's rules." },
  { value: 'forbidden', label: 'Forbidden', hint: 'A word or claim to never use — lands in the anti-rules.' },
  { value: 'reference', label: 'Reference', hint: 'Example copy to imitate the voice of.' },
];

const sectionOptions = ALL_SECTIONS.filter((s) => s !== 'brand');

function newField(): CopyBriefCustomField {
  return { id: crypto.randomUUID(), kind: 'instruction', label: '', value: '', sections: [] };
}

export default function CustomFieldsBlockEditor({ block, onUpdate }: { block: CustomBlock; onUpdate: Update }) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between border-b border-uiCardRule pb-4">
        <h2 className="font-display text-xl font-semibold text-uiInk">{block.label}</h2>
        <button
          type="button"
          onClick={() => onUpdate((b) => addCustomField(b, newField()))}
          className="btn btn-sm"
        >
          <Plus size={14} /> Add field
        </button>
      </div>
      {block.fields.length === 0 ? (
        <p className="text-sm text-uiInkSoft">
          Nothing beyond the standard blocks yet. Add a field when there&rsquo;s something specific this client
          needs — a fact the standard blocks don&rsquo;t cover, a one-off instruction, or an extra word to avoid.
        </p>
      ) : (
        <div className="space-y-3">
          {block.fields.map((field) => (
            <CustomFieldRow
              key={field.id}
              field={field}
              onChange={(patch) => onUpdate((b) => updateCustomField(b, field.id, patch))}
              onRemove={() => onUpdate((b) => removeCustomField(b, field.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CustomFieldRow({
  field, onChange, onRemove,
}: {
  field: CopyBriefCustomField;
  onChange: (patch: Partial<CopyBriefCustomField>) => void;
  onRemove: () => void;
}) {
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const kindMeta = KIND_OPTIONS.find((k) => k.value === field.kind)!;

  return (
    <div className="rounded-lg border border-uiCardRule p-4">
      <div className="mb-3 flex items-center gap-2">
        <select
          value={field.kind}
          onChange={(e) => onChange({ kind: e.target.value as CopyBriefCustomField['kind'] })}
          className="rounded-md border border-uiCardRule bg-uiSurface px-2 py-1 font-chromeMono text-xs text-uiFg2 outline-none focus:border-uiAccent"
        >
          {KIND_OPTIONS.map((k) => (
            <option key={k.value} value={k.value}>{k.label}</option>
          ))}
        </select>
        <span className="text-2xs text-uiInkSoft">{kindMeta.hint}</span>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove field"
          className="ml-auto rounded-md p-1.5 text-uiInkSoft transition-colors hover:bg-uiSurface hover:text-danger"
        >
          <Trash size={14} />
        </button>
      </div>

      <div className="mb-3">
        <FieldLabel>Label</FieldLabel>
        <OverrideInput value={field.label} onChange={(v) => onChange({ label: v })} placeholder="e.g. Fleet size" />
      </div>

      <div className="mb-3">
        <FieldLabel>{field.kind === 'reference' ? 'Example copy' : 'Value'}</FieldLabel>
        <OverrideTextarea value={field.value} onChange={(v) => onChange({ value: v })} rows={2} />
      </div>

      <div>
        <button
          type="button"
          onClick={() => setSectionsOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 font-chromeMono text-2xs text-uiInkSoft hover:text-uiInk"
        >
          <CaretDown size={11} style={{ transform: sectionsOpen ? undefined : 'rotate(-90deg)' }} />
          {field.sections.length === 0 ? 'Applies to the whole brief' : `Applies to ${field.sections.length} section${field.sections.length === 1 ? '' : 's'}`}
        </button>
        {sectionsOpen && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {sectionOptions.map((s) => {
              const on = field.sections.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => onChange({ sections: on ? field.sections.filter((x) => x !== s) : [...field.sections, s] })}
                  className="rounded-full border px-2 py-0.5 text-2xs transition-colors"
                  style={{
                    borderColor: on ? 'var(--ui-accent)' : 'var(--ui-card-rule)',
                    background: on ? 'var(--ui-accent)' : 'transparent',
                    color: on ? 'var(--ui-accent-ink)' : 'var(--ui-fg-2)',
                  }}
                >
                  {labelFor(s as Section)}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
