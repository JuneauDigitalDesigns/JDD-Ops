'use client';

/**
 * Shared building blocks for the Brief stage's eleven block editors.
 *
 * Unlike components/fields/index.tsx's Field/Area/Checkbox — which read and write directly
 * against a SiteContent path via setField — everything here is plain controlled
 * value/onChange, because most blocks edit a CopyBrief override, not a SiteContent field.
 * (The Facts block is the one exception: it uses the real Field/Area/Checkbox directly,
 * since business facts genuinely are SiteContent paths.)
 *
 * Uses the console's INPUT_CLS/LABEL_CLS so a block's inputs look identical to every other
 * form control in /build, per D3 — colours here are chrome tokens (uiInk/uiAccent/uiCardRule
 * etc.), never the client-brand `rule`/`accent`/`bg`/`ink` aliases the .studio-chrome scope
 * remaps (see the intake rebuild plan's Trap T1).
 */
import type { ReactNode } from 'react';
import { ArrowCounterClockwise, Check } from '@phosphor-icons/react';
import { INPUT_CLS, LABEL_CLS } from '@/components/fields';
import type { BlockChannel } from '@/lib/copy-brief/types';

export function BlockHeader({
  label,
  channel,
  enabled,
  onToggleEnabled,
  edited,
  onRevert,
  revertLabel = 'Revert to default',
}: {
  label: string;
  channel: BlockChannel;
  enabled: boolean;
  onToggleEnabled: (v: boolean) => void;
  /** Omit when this block has no single "default vs edited" state (e.g. Custom fields). */
  edited?: boolean;
  onRevert?: () => void;
  revertLabel?: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-uiCardRule pb-4">
      <h2 className="font-display text-xl font-semibold text-uiInk">{label}</h2>
      <span
        className="mono rounded-full px-2 py-0.5 text-2xs uppercase tracking-wide text-uiInkSoft"
        style={{ background: 'var(--ui-surface)' }}
        title={channel === 'system' ? 'Part of the copywriter\'s role/rules prompt' : 'Part of the per-run business message'}
      >
        {channel}
      </span>

      <div className="ml-auto flex items-center gap-3">
        {edited !== undefined && (
          <span className="flex items-center gap-1.5">
            <span className={`mono text-2xs uppercase tracking-wide ${edited ? 'text-uiAccent' : 'text-uiInkSoft'}`}>
              {edited ? 'edited' : 'default'}
            </span>
            {edited && onRevert && (
              <button
                type="button"
                onClick={onRevert}
                className="inline-flex items-center gap-1 font-chromeMono text-2xs text-uiInkSoft transition-colors hover:text-uiInk"
                title={revertLabel}
              >
                <ArrowCounterClockwise size={12} /> revert
              </button>
            )}
          </span>
        )}

        <label className="flex cursor-pointer items-center gap-2 text-sm text-uiFg2">
          <span className="text-2xs uppercase tracking-wide text-uiInkSoft">{enabled ? 'included' : 'excluded'}</span>
          <span
            role="switch"
            aria-checked={enabled}
            onClick={() => onToggleEnabled(!enabled)}
            className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors"
            style={{ background: enabled ? 'var(--ui-accent)' : 'var(--ui-rule-strong)' }}
          >
            <span
              className="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform"
              style={{ transform: enabled ? 'translateX(18px)' : 'translateX(3px)' }}
            />
          </span>
        </label>
      </div>
    </div>
  );
}

export function OverrideInput({
  value, onChange, placeholder, monospace,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; monospace?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`${INPUT_CLS}${monospace ? ' font-chromeMono' : ''}`}
    />
  );
}

export function OverrideTextarea({
  value, onChange, placeholder, rows = 4,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={`${INPUT_CLS} min-h-0 py-2 leading-relaxed`}
    />
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <span className={`${LABEL_CLS} mb-1.5`}>{children}</span>;
}

/** One editable text part with its own inline revert — role/guardrails, a clientWords line,
 *  a per-section instruction, scan notes. */
export function TextPartEditor({
  label,
  text,
  defaultText,
  edited,
  onChange,
  onRevert,
  rows = 4,
  placeholder,
}: {
  label: string;
  text: string;
  defaultText: string;
  edited: boolean;
  onChange: (v: string) => void;
  onRevert: () => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <FieldLabel>{label}</FieldLabel>
        {edited && (
          <button
            type="button"
            onClick={onRevert}
            className="mb-1.5 inline-flex items-center gap-1 font-chromeMono text-2xs text-uiInkSoft transition-colors hover:text-uiInk"
          >
            <ArrowCounterClockwise size={11} /> revert
          </button>
        )}
      </div>
      <OverrideTextarea value={text} onChange={onChange} rows={rows} placeholder={placeholder ?? defaultText} />
    </div>
  );
}

export function Chip({
  label, selected, onToggle,
}: {
  label: string; selected: boolean; onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors"
      style={{
        borderColor: selected ? 'var(--ui-accent)' : 'var(--ui-card-rule)',
        background: selected ? 'var(--ui-accent)' : 'transparent',
        color: selected ? 'var(--ui-accent-ink)' : 'var(--ui-fg-2)',
      }}
    >
      {selected && <Check size={11} weight="bold" />}
      {label}
    </button>
  );
}

/** A tickable option set with an "add your own" free-text line — positioning, offers, forbidden. */
export function ChipGroupEditor({
  label,
  options,
  selected,
  onToggle,
  freeText,
  onFreeTextChange,
  freeTextPlaceholder = 'Add your own, comma-separated…',
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (option: string) => void;
  freeText?: string;
  onFreeTextChange?: (v: string) => void;
  freeTextPlaceholder?: string;
}) {
  const selectedSet = new Set(selected);
  return (
    <div className="mb-4 last:mb-0">
      <FieldLabel>{label}</FieldLabel>
      {options.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {options.map((o) => (
            <Chip key={o} label={o} selected={selectedSet.has(o)} onToggle={() => onToggle(o)} />
          ))}
        </div>
      )}
      {onFreeTextChange && (
        <OverrideInput value={freeText ?? ''} onChange={onFreeTextChange} placeholder={freeTextPlaceholder} />
      )}
    </div>
  );
}
