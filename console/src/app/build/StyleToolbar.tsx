'use client';

import { useEffect, useState } from 'react';
import { X } from '@phosphor-icons/react';
import { getPath } from '@/lib/merge';
import type { ElementStyle } from '@/data/site';

const WEIGHTS = [400, 500, 600, 700, 800];

// Floating color / size / weight controls anchored to the focused <E> element in the Finalize
// preview. Every change writes through setField('overrides.<path>.<prop>', value) into the same
// edits layer inline text edits use, so it serializes into the exported site.ts.
export default function StyleToolbar({
  path,
  rect,
  overrides,
  setField,
  onClose,
}: {
  path: string;
  rect: DOMRect;
  overrides?: Record<string, unknown>;
  setField: (p: string, v: unknown) => void;
  onClose: () => void;
}) {
  const cur = (getPath(overrides, path) as ElementStyle | undefined) ?? {};
  const [size, setSize] = useState<number>(cur.fontSize ?? 16);

  // Reset the slider when the selected element changes.
  useEffect(() => {
    setSize(cur.fontSize ?? 16);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  const top = Math.min(rect.bottom + 8, window.innerHeight - 96);
  const left = Math.min(Math.max(rect.left, 12), window.innerWidth - 300);
  const set = (k: keyof ElementStyle, v: unknown) => setField(`overrides.${path}.${k}`, v);

  return (
    <div
      style={{ position: 'fixed', top, left, zIndex: 60 }}
      className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-xl"
      // Keep the underlying <E> focused while interacting with the toolbar.
      onMouseDown={(e) => e.preventDefault()}
    >
      <label className="flex items-center gap-1.5" title="Text color">
        <span className="font-chromeMono text-[10px] uppercase tracking-widest text-zinc-400">Color</span>
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(cur.color ?? '') ? (cur.color as string) : '#000000'}
          onChange={(e) => set('color', e.target.value)}
          className="h-6 w-6 cursor-pointer rounded border border-zinc-300 bg-transparent"
        />
      </label>

      <label className="flex items-center gap-1.5" title="Font size">
        <span className="font-chromeMono text-[10px] uppercase tracking-widest text-zinc-400">Size</span>
        <input
          type="range"
          min={10}
          max={96}
          step={1}
          value={size}
          onChange={(e) => {
            const n = Number(e.target.value);
            setSize(n);
            set('fontSize', n);
          }}
          className="w-28 accent-zinc-800"
        />
        <span className="w-8 font-chromeMono text-xs text-zinc-600">{size}</span>
      </label>

      <label className="flex items-center gap-1.5" title="Weight">
        <span className="font-chromeMono text-[10px] uppercase tracking-widest text-zinc-400">Weight</span>
        <select
          value={cur.fontWeight ?? ''}
          onChange={(e) => set('fontWeight', e.target.value ? Number(e.target.value) : undefined)}
          className="rounded border border-zinc-300 px-1.5 py-0.5 text-xs"
        >
          <option value="">auto</option>
          {WEIGHTS.map((w) => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
      </label>

      <button type="button" onClick={onClose} aria-label="Close" className="text-zinc-400 hover:text-zinc-700">
        <X size={14} />
      </button>
    </div>
  );
}
