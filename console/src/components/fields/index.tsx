'use client';

import { useRef, useState } from 'react';
import { Plus, Trash, UploadSimple, DotsSixVertical, Sparkle, CircleNotch } from '@phosphor-icons/react';
import {
  DndContext, DragEndEvent, PointerSensor, closestCenter, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { SiteContent } from '@/data/site';
import { getPath } from '@/lib/merge';
import { FONT_OPTIONS } from '@/lib/fonts';

// Shared form primitives for the studio's structured editors (BrandDrawer + the wizard's
// intake step). Every control writes through setField(path, value) into the same `edits`
// layer the inline <E> editors use.

export type SetField = (path: string, value: unknown) => void;

// Sizing comes from the scale in tailwind.config.ts / globals.css — do not hardcode
// px here. `text-sm` is 15px, `text-label` is 14px (see the fontSize scale).
export const INPUT_CLS =
  'block w-full min-h-[var(--control-h)] rounded-[var(--radius-control)] border border-ruleStrong bg-panel px-3 text-sm text-fg placeholder-fg3 outline-none transition-colors focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-glow)]';

// Field labels are sentence-case body text, NOT eyebrows. The 10px uppercase mono
// treatment this replaced was applied to every field in the app and was the single
// largest source of eye strain. Eyebrows (.kicker) are for section headers only.
export const LABEL_CLS = 'mb-1.5 block font-chrome text-label font-medium text-fg2';

function str(content: SiteContent, path: string): string {
  const v = getPath(content, path);
  return v === null || v === undefined ? '' : String(v);
}

/** Small amber chip marking a field/section flagged in _meta.missing_fields. */
export function ReviewBadge() {
  return (
    <span className="rounded bg-amber-100 px-2 py-0.5 font-chromeMono text-2xs uppercase tracking-wide text-amber-700">
      review
    </span>
  );
}

export function Field({
  content, setField, path, label, type = 'text', placeholder, flagged,
}: {
  content: SiteContent; setField: SetField; path: string; label: string;
  type?: 'text' | 'number' | 'url'; placeholder?: string; flagged?: boolean;
}) {
  return (
    <label className="block">
      <span className={`${LABEL_CLS} flex items-center gap-2`}>
        {label} {flagged && <ReviewBadge />}
      </span>
      <input
        type={type === 'number' ? 'number' : 'text'}
        value={str(content, path)}
        placeholder={placeholder}
        onChange={(e) => setField(path, type === 'number' ? Number(e.target.value) : e.target.value)}
        // Mirrors <E>'s data-edit-path so lib/focusPath can target drawer inputs too
        // (used by the Cmd+K field palette and the SEO coverage readout's fix links).
        data-field-path={path}
        className={INPUT_CLS}
      />
    </label>
  );
}

export function Area({
  content, setField, path, label, flagged,
}: {
  content: SiteContent; setField: SetField; path: string; label: string; flagged?: boolean;
}) {
  return (
    <label className="block">
      <span className={`${LABEL_CLS} flex items-center gap-2`}>
        {label} {flagged && <ReviewBadge />}
      </span>
      <textarea
        rows={3}
        value={str(content, path)}
        onChange={(e) => setField(path, e.target.value)}
        data-field-path={path}
        className={INPUT_CLS}
      />
    </label>
  );
}

export function Checkbox({
  content, setField, path, label,
}: {
  content: SiteContent; setField: SetField; path: string; label: string;
}) {
  const v = Boolean(getPath(content, path));
  return (
    <label className="flex items-center gap-2 text-sm text-uiFg2">
      <input type="checkbox" checked={v} onChange={(e) => setField(path, e.target.checked)} />
      {label}
    </label>
  );
}

export function Color({
  content, setField, path, label,
}: {
  content: SiteContent; setField: SetField; path: string; label: string;
}) {
  const v = str(content, path) || '#000000';
  const safe = /^#[0-9a-fA-F]{6}$/.test(v) ? v : '#000000';
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-label font-medium text-fg2">{label}</span>
      <span className="flex items-center gap-2">
        {/* Swatch first: the colour is the control. The hex box is the fallback for exact
            values, not the primary way to change it. */}
        <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md border border-ruleStrong">
          <span className="absolute inset-0" style={{ backgroundColor: safe }} />
          <input
            type="color"
            value={safe}
            onChange={(e) => setField(path, e.target.value)}
            aria-label={label}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </span>
        <input
          type="text"
          value={str(content, path)}
          onChange={(e) => setField(path, e.target.value)}
          aria-label={`${label} hex`}
          data-field-path={path}
          className="w-24 rounded-md border border-ruleStrong bg-panel px-2 py-1.5 font-chromeMono text-xs text-fg2 outline-none focus:border-accent"
        />
      </span>
    </div>
  );
}

// In-font font picker: each option renders in its own typeface.
export function FontSelect({
  content, setField, path, label, filter,
}: {
  content: SiteContent; setField: SetField; path: string; label: string; filter: 'sans' | 'heading';
}) {
  const current = str(content, path);
  const opts = FONT_OPTIONS.filter((o) => o.role === 'both' || o.role === filter);
  const known = opts.some((o) => o.stack === current);
  return (
    <label className="block">
      <span className={LABEL_CLS}>{label}</span>
      <select value={known ? current : ''} onChange={(e) => setField(path, e.target.value)} className={INPUT_CLS}>
        {!known && <option value="">System (current)</option>}
        {opts.map((o) => (
          <option key={o.id} value={o.stack} style={{ fontFamily: o.stack }}>{o.label}</option>
        ))}
      </select>
      {known && <p className="mt-1 text-lg text-uiFg2" style={{ fontFamily: current }}>The quick brown fox</p>}
    </label>
  );
}

export function ImageSlot({
  content, setField, path, label,
}: {
  content: SiteContent; setField: SetField; path: string; label: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const val = str(content, path);

  async function onFile(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch('/api/build/upload', { method: 'POST', body: fd });
      const d = (await r.json()) as { ref?: string };
      if (d.ref) setField(path, d.ref);
    } finally {
      setBusy(false);
    }
  }

  const shown = val && !val.startsWith('upload://') && /^https?:|^\//.test(val) ? val : null;

  return (
    <div className="space-y-1.5">
      <span className={LABEL_CLS}>{label}</span>

      {/* The picture is the control. Clicking the tile opens the file picker; the URL box
          below is the secondary path for images already hosted somewhere. */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label={`Upload ${label}`}
        className="group relative flex h-28 w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-ruleStrong bg-surface transition-colors hover:border-accent disabled:opacity-50"
      >
        {shown && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <span
          className={[
            'relative flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-opacity',
            shown
              ? 'bg-panel/90 text-fg opacity-0 group-hover:opacity-100'
              : 'text-fg3 group-hover:text-accent',
          ].join(' ')}
        >
          {busy ? <CircleNotch size={15} className="animate-spin" /> : <UploadSimple size={15} />}
          {busy ? 'Uploading…' : shown ? 'Replace' : 'Upload an image'}
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }}
      />

      <input
        type="text"
        value={val}
        onChange={(e) => setField(path, e.target.value)}
        placeholder="or paste a URL"
        data-field-path={path}
        className="w-full rounded-md border border-ruleStrong bg-panel px-2.5 py-1.5 text-xs text-fg2 outline-none focus:border-accent"
      />

      {/* Staged uploads read as a chip, not a sentence — the filename IS the message. */}
      {val.startsWith('upload://') && (
        <span className="codechip inline-block">{val.slice('upload://'.length)}</span>
      )}
    </div>
  );
}

export function Section({
  title, children, defaultOpen, flagged, right,
}: {
  title: string; children: React.ReactNode; defaultOpen?: boolean; flagged?: boolean; right?: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="border-b border-uiRule">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-uiFg2 hover:bg-uiSurface">
        <span className="flex items-center gap-2">{title} {flagged && <ReviewBadge />}</span>
        {right && <span onClick={(e) => e.preventDefault()}>{right}</span>}
      </summary>
      <div className="space-y-3 px-4 pb-4">{children}</div>
    </details>
  );
}

/** Compact "Generate this section" button for a Section header. */
export function GenerateSectionButton({ onClick, busy }: { onClick: () => void; busy?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="btn btn-xs disabled:opacity-50"
    >
      {busy ? <CircleNotch size={12} className="animate-spin" /> : <Sparkle size={12} />} Generate
    </button>
  );
}

// ── Sortable row wrapper (drag handle + remove + arbitrary children) ────────────
function SortableRow({ id, onRemove, children }: { id: string; onRemove: () => void; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <li ref={setNodeRef} style={style} className="rounded-md border border-uiRule bg-uiBg p-2.5">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className="cursor-grab text-uiFg3 hover:text-uiFg active:cursor-grabbing"
        >
          <DotsSixVertical size={14} />
        </button>
        <button type="button" onClick={onRemove} aria-label="Remove" className="text-uiFg3 hover:text-red-400">
          <Trash size={14} />
        </button>
      </div>
      {children}
    </li>
  );
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn btn-sm border-dashed"
    >
      <Plus size={13} /> Add {label}
    </button>
  );
}

function useListReorder<T>(arr: T[], basePath: string, write: (next: T[]) => void) {
  const ids = arr.map((_, i) => `${basePath}-${i}`);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    write(arrayMove(arr, from, to));
  }
  return { ids, sensors, onDragEnd };
}

// ── Label-only list (item text edited elsewhere, e.g. the live preview). ────────
// Kept for BrandDrawer parity.
export function ListSection<T extends Record<string, unknown>>({
  content, setField, basePath, title, labelKey, makeBlank,
}: {
  content: SiteContent; setField: SetField; basePath: string; title: string;
  labelKey: string; makeBlank: () => T;
}) {
  const arr = (getPath(content, basePath) as T[] | undefined) ?? [];
  const write = (next: T[]) => setField(basePath, next);
  const { ids, sensors, onDragEnd } = useListReorder(arr, basePath, write);

  return (
    <Section title={`${title} (${arr.length})`}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul className="space-y-1.5">
            {arr.map((item, i) => (
              <SortableRow key={ids[i]} id={ids[i]} onRemove={() => write(arr.filter((_, k) => k !== i))}>
                <span className="min-w-0 flex-1 truncate text-sm text-uiFg2">
                  {String(item[labelKey] ?? '') || `Item ${i + 1}`}
                </span>
              </SortableRow>
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <AddButton onClick={() => write([...arr, makeBlank()])} label={title.replace(/s$/, '').toLowerCase()} />
    </Section>
  );
}

// ── Fully-inline object list: each item expanded into editable sub-fields. ──────
export type ItemFieldSpec = { key: string; label: string; area?: boolean; type?: 'text' | 'number' };

export function ItemListSection({
  content, setField, basePath, title, fields, makeBlank, flagged, right, defaultOpen,
}: {
  content: SiteContent; setField: SetField; basePath: string; title: string;
  fields: ItemFieldSpec[]; makeBlank: () => Record<string, unknown>;
  flagged?: boolean; right?: React.ReactNode; defaultOpen?: boolean;
}) {
  const arr = (getPath(content, basePath) as Record<string, unknown>[] | undefined) ?? [];
  // Every field change rewrites the whole array at basePath — a single edits entry per
  // list, which sidesteps index-misalignment between per-item path edits across steps.
  const write = (next: Record<string, unknown>[]) => setField(basePath, next);
  const update = (i: number, key: string, val: unknown) =>
    write(arr.map((it, k) => (k === i ? { ...it, [key]: val } : it)));
  const { ids, sensors, onDragEnd } = useListReorder(arr, basePath, write);

  return (
    <Section title={`${title} (${arr.length})`} flagged={flagged} right={right} defaultOpen={defaultOpen}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {arr.map((item, i) => (
              <SortableRow key={ids[i]} id={ids[i]} onRemove={() => write(arr.filter((_, k) => k !== i))}>
                <div className="space-y-2">
                  {fields.map((f) => (
                    <label key={f.key} className="block">
                      <span className={LABEL_CLS}>{f.label}</span>
                      {f.area ? (
                        <textarea
                          rows={2}
                          value={String(item[f.key] ?? '')}
                          onChange={(e) => update(i, f.key, e.target.value)}
                          className={INPUT_CLS}
                        />
                      ) : (
                        <input
                          type={f.type === 'number' ? 'number' : 'text'}
                          value={item[f.key] === null || item[f.key] === undefined ? '' : String(item[f.key])}
                          onChange={(e) => update(i, f.key, f.type === 'number' ? Number(e.target.value) : e.target.value)}
                          className={INPUT_CLS}
                        />
                      )}
                    </label>
                  ))}
                </div>
              </SortableRow>
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <AddButton onClick={() => write([...arr, makeBlank()])} label={title.replace(/s$/, '').toLowerCase()} />
    </Section>
  );
}

// ── Inline string list (each item a single input). ──────────────────────────────
export function StringListSection({
  content, setField, basePath, title, placeholder, flagged, right, defaultOpen,
}: {
  content: SiteContent; setField: SetField; basePath: string; title: string;
  placeholder?: string; flagged?: boolean; right?: React.ReactNode; defaultOpen?: boolean;
}) {
  const arr = (getPath(content, basePath) as string[] | undefined) ?? [];
  const write = (next: string[]) => setField(basePath, next);
  const { ids, sensors, onDragEnd } = useListReorder(arr, basePath, write);

  return (
    <Section title={`${title} (${arr.length})`} flagged={flagged} right={right} defaultOpen={defaultOpen}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul className="space-y-1.5">
            {arr.map((item, i) => (
              <SortableRow key={ids[i]} id={ids[i]} onRemove={() => write(arr.filter((_, k) => k !== i))}>
                <input
                  type="text"
                  value={item ?? ''}
                  placeholder={placeholder}
                  onChange={(e) => write(arr.map((s, k) => (k === i ? e.target.value : s)))}
                  className={INPUT_CLS}
                />
              </SortableRow>
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <AddButton onClick={() => write([...arr, ''])} label={title.replace(/s$/, '').toLowerCase()} />
    </Section>
  );
}
