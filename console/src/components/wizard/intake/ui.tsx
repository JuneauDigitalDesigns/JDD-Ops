'use client';

/**
 * Shared pieces of the intake boards (redesign approved 2026-11-10). Every label here is a
 * neutral statement of what a thing is: console copy never addresses anyone or asks.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PencilSimple, Plus, X } from '@phosphor-icons/react';
import { SOURCE_LABEL, type FactSource } from '@/lib/intake-sources';
import { typeLiveChip, settleLiveChip } from '@/lib/live-chip';

/** A bordered panel that fills its grid cell and never grows the page: its body scrolls inside
 *  the card only when a window is too small for the content. */
export function Card({
  title, right, children, className = '', bodyClassName = '',
}: {
  title: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`flex min-h-0 flex-col overflow-hidden rounded-xl border border-uiCardRule bg-uiBg ${className}`}>
      <header className="flex shrink-0 items-center gap-2 border-b border-uiCardRule/70 px-3.5 py-2.5">
        <h3 className="font-chromeMono text-2xs uppercase tracking-[0.14em] text-uiFg2">{title}</h3>
        {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
      </header>
      <div className={`no-scrollbar min-h-0 flex-1 overflow-y-auto ${bodyClassName}`}>{children}</div>
    </section>
  );
}

const CHIP_STYLE: Record<FactSource, { bg: string; fg: string; border?: string }> = {
  form: { bg: 'rgba(31,111,120,.12)', fg: '#1a5d65' },
  close: { bg: 'transparent', fg: 'var(--ui-fg-2)', border: '1px solid var(--ui-rule-strong)' },
  console: { bg: 'var(--ui-surface-2)', fg: 'var(--ui-fg-2)' },
  preset: { bg: 'var(--warn-glow)', fg: '#7d500f' },
  notGiven: { bg: 'transparent', fg: '#7d500f', border: '1px dashed rgba(200,132,42,.7)' },
  notAsked: { bg: 'transparent', fg: 'var(--ui-fg-3)', border: '1px dashed var(--ui-rule-strong)' },
};

const SOURCE_TITLE: Record<FactSource, string> = {
  form: "Supplied by the client's onboarding form",
  close: 'Supplied at the sales-call close',
  console: 'Entered in the console',
  preset: "The vertical preset's placeholder: not this client's value",
  notGiven: 'Asked on the onboarding form and left blank',
  notAsked: 'Never asked: this client predates the question',
};

export function SourceChip({ source }: { source: FactSource }) {
  const s = CHIP_STYLE[source];
  return (
    <span
      title={SOURCE_TITLE[source]}
      className="inline-flex h-[18px] shrink-0 items-center whitespace-nowrap rounded px-1.5 font-chromeMono text-[10px] uppercase tracking-[0.06em]"
      style={{ background: s.bg, color: s.fg, border: s.border }}
    >
      {SOURCE_LABEL[source]}
    </span>
  );
}

/** A small status chip with free text (e.g. "Own page", "2 short", "Optional"). */
export function Tag({ children, tone = 'neutral', title }: { children: ReactNode; tone?: 'neutral' | 'warn' | 'ok' | 'teal'; title?: string }) {
  const style =
    tone === 'warn' ? { background: 'var(--warn-glow)', color: '#7d500f' }
      : tone === 'ok' ? { background: 'var(--ok-glow)', color: '#2f6e46' }
        : tone === 'teal' ? { background: 'rgba(31,111,120,.12)', color: '#1a5d65' }
          : { background: 'var(--ui-surface-2)', color: 'var(--ui-fg-2)' };
  return (
    <span title={title} className="inline-flex h-[18px] shrink-0 items-center whitespace-nowrap rounded px-1.5 font-chromeMono text-[10px] uppercase tracking-[0.06em]" style={style}>
      {children}
    </span>
  );
}

/** Filled check for a supplied value, dashed ring for a missing one. */
export function StatusMark({ ok, optional }: { ok: boolean; optional?: boolean }) {
  if (ok) {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0">
        <circle cx="8" cy="8" r="7" fill="var(--ok)" />
        <path d="M5 8.2l2 2 4-4.4" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0">
      <circle cx="8" cy="8" r="6.2" fill="none" stroke={optional ? 'var(--ui-rule-strong)' : 'var(--warn)'} strokeWidth="1.6" strokeDasharray="2.4 2" />
    </svg>
  );
}

export const FIELD_LABEL = 'mb-1.5 flex items-center gap-2 font-chromeMono text-[10.5px] uppercase tracking-[0.12em] text-uiFg2';
export const INPUT = 'h-8 w-full rounded-lg border border-ruleStrong bg-panel px-2.5 text-[13.5px] text-fg outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-glow)]';

/**
 * A list of short strings as chips, with an add box. Writes the whole array, trimmed and
 * de-duplicated; an empty list writes `[]`, which reads as "not given".
 */
export function ChipListEditor({
  values, onChange, addLabel = 'Add', placeholder, max, inputId,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  addLabel?: string;
  placeholder?: string;
  max?: number;
  inputId?: string;
}) {
  const [draft, setDraft] = useState('');
  // The item being typed is already saved as the list's last entry (lib/live-chip.ts).
  const [live, setLive] = useState<number | null>(null);
  const committed = live === null ? values.length : values.length - 1;
  const full = max !== undefined && committed >= max && live === null;
  function type(text: string) {
    if (full) return;
    setDraft(text);
    const next = typeLiveChip(values, live, text);
    setLive(next.live);
    onChange(next.values);
  }
  /** Enter, Add or leaving the box: the typed item is already saved; start the next one. */
  function settle() {
    const next = settleLiveChip(values, live);
    if (next !== values) onChange(next);
    setDraft('');
    setLive(null);
  }
  const add = settle;
  return (
    <div className="space-y-2">
      {committed > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {values.map((v, i) => i === live ? null : (
            <li key={`${v}-${i}`} className="inline-flex h-7 items-center gap-1 rounded-full border border-uiCardRule bg-panel pl-2.5 pr-1 text-[13px]">
              {v}
              <button
                type="button"
                aria-label={`Remove ${v}`}
                onClick={() => { const base = settleLiveChip(values, live); setDraft(''); setLive(null); onChange(base.filter((x) => x !== v)); }}
                className="flex h-5 w-5 items-center justify-center rounded-full text-uiFg3 hover:bg-uiSurface hover:text-uiInk"
              >
                <X size={11} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-1.5">
        <input
          id={inputId}
          value={draft}
          disabled={full}
          onChange={(e) => type(e.target.value)}
          onBlur={settle}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={full ? `${max} maximum` : placeholder}
          aria-label={placeholder ?? addLabel}
          className={INPUT}
        />
        <button type="button" onClick={add} disabled={!draft.trim() || full} className="btn btn-sm shrink-0 disabled:opacity-40">
          <Plus size={12} /> {addLabel}
        </button>
      </div>
    </div>
  );
}

/** Toggle chips over a fixed set (e.g. a service's areas from the service area). */
export function ToggleChips({
  options, selected, onChange, emptyNote,
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  emptyNote: string;
}) {
  if (options.length === 0) return <p className="text-xs italic text-uiFg3">{emptyNote}</p>;
  const on = new Set(selected.map((s) => s.toLowerCase()));
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = on.has(o.toLowerCase());
        return (
          <button
            key={o}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? selected.filter((s) => s.toLowerCase() !== o.toLowerCase()) : [...selected, o])}
            className={[
              'inline-flex h-7 items-center rounded-full px-2.5 text-[13px] transition-colors',
              active
                ? 'border border-[rgba(31,111,120,.45)] bg-[rgba(31,111,120,.12)] text-[#174f56]'
                : 'border border-dashed border-uiCardRule text-uiFg3 hover:text-uiInk',
            ].join(' ')}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

/**
 * One fact as a checklist row: mark, label, value, source, edit. Becomes an input only when
 * opened. `list` values edit as a comma-separated line and save as an array.
 */
export function FactRow({
  label, value, source, optional, list, open, onOpen, onClose, onSave, path,
}: {
  label: string;
  value: unknown;
  source: FactSource;
  optional?: boolean;
  list?: boolean;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSave: (v: unknown) => void;
  path: string;
}) {
  const text = Array.isArray(value) ? value.filter(Boolean).join(' · ') : value == null ? '' : String(value);
  const supplied = source === 'form' || source === 'close' || source === 'console';
  const [draft, setDraft] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  /** The value when the row was opened: Escape puts it back. */
  const opened = useRef<unknown>(null);
  useEffect(() => {
    if (!open) return;
    opened.current = value;
    setDraft(Array.isArray(value) ? value.filter(Boolean).join(', ') : value == null ? '' : String(value));
    requestAnimationFrame(() => ref.current?.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Autosave (Xander, 2026-11-10): every keystroke is written through, so nothing typed waits
  // on a button or is lost on a step change, a reload or a closed tab. The input keeps the raw
  // text; the saved value is trimmed (and split, for a list).
  function change(t: string) {
    setDraft(t);
    onSave(list ? t.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean) : t.trim());
  }

  if (open) {
    return (
      <div className="grid grid-cols-[16px_118px_minmax(0,1fr)] items-center gap-2 bg-[color-mix(in_srgb,var(--ui-surface)_60%,transparent)] px-3.5 py-2.5">
        <StatusMark ok={supplied} optional={optional} />
        <label htmlFor={`fact-${path}`} className="text-[12.5px] text-uiFg2">{label}</label>
        <input
          id={`fact-${path}`}
          ref={ref}
          data-field-path={path}
          value={draft}
          onChange={(e) => change(e.target.value)}
          onBlur={onClose}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onClose();
            if (e.key === 'Escape') { onSave(opened.current); onClose(); }
          }}
          placeholder={list ? 'Comma-separated' : undefined}
          className={INPUT}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="grid h-[46px] w-full grid-cols-[16px_118px_minmax(0,1fr)_auto_16px] items-center gap-2 px-3.5 text-left transition-colors hover:bg-uiSurface"
    >
      <StatusMark ok={supplied} optional={optional} />
      <span className="text-[12.5px] text-uiFg2">{label}</span>
      <span className={`truncate text-[13.5px] ${supplied ? 'text-uiInk' : 'italic text-[#7d500f]'}`}>
        {text || '—'}
      </span>
      {optional && !supplied ? <Tag>Optional</Tag> : <SourceChip source={source} />}
      <PencilSimple size={14} className="text-uiFg3" aria-hidden />
    </button>
  );
}
