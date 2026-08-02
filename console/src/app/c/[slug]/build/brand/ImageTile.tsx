'use client';

import { useEffect, useRef, useState } from 'react';
import { Trash, UploadSimple, LinkSimple, CircleNotch } from '@phosphor-icons/react';
import type { SiteContent } from '@/data/site';
import type { SetField } from '@/components/fields';
import { getPath } from '@/lib/merge';

// Thumbnail-first image control. The tile IS the control — click to upload, hover to
// replace/remove, URL entry demoted to a disclosure. Shared by ImagesPane and the
// per-item tiles in the Services / Work list panes.
//
// Upload posts to /api/build/upload, which returns an `upload://<file>` ref that export
// resolves into /images. Staged refs have no resolvable URL, hence the local objectURL
// preview and the "staged" placeholder.

export function str(content: SiteContent, path: string): string {
  const v = getPath(content, path);
  return v === null || v === undefined ? '' : String(v);
}

export const isRenderable = (v: string) => /^https?:|^\//.test(v);

export default function ImageTile({
  content, setField, path, label, round,
}: {
  content: SiteContent; setField: SetField; path: string; label: string; round?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const val = str(content, path);
  const staged = val.startsWith('upload://');

  useEffect(() => () => { if (localPreview) URL.revokeObjectURL(localPreview); }, [localPreview]);

  async function onFile(file: File) {
    setBusy(true);
    const preview = URL.createObjectURL(file);
    setLocalPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return preview; });
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

  const shown = localPreview ?? (isRenderable(val) ? val : null);

  return (
    <div className="space-y-1">
      <div
        className={[
          'group relative overflow-hidden border transition-colors',
          round ? 'aspect-square rounded-full' : 'aspect-video rounded-md',
          shown || staged ? 'border-uiRule' : 'border-dashed border-uiRuleStrong hover:border-uiAccent',
        ].join(' ')}
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="" className="h-full w-full object-cover" />
        ) : staged ? (
          <div className="flex h-full w-full items-center justify-center bg-uiSurface px-2 text-center">
            <span className="font-chromeMono text-2xs leading-tight text-uiFg3">
              Staged → /images at export
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-full w-full flex-col items-center justify-center gap-1 text-uiFg3 hover:text-uiAccent"
          >
            <UploadSimple size={18} />
            <span className="font-chromeMono text-2xs uppercase tracking-widest">Add image</span>
          </button>
        )}

        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <CircleNotch size={18} className="animate-spin text-white" />
          </div>
        )}

        {(shown || staged) && !busy && (
          <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/55 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded bg-white/90 p-1.5 text-uiInk hover:bg-white"
              aria-label={`Replace ${label}`}
            >
              <UploadSimple size={13} />
            </button>
            <button
              type="button"
              onClick={() => setShowUrl((v) => !v)}
              className="rounded bg-white/90 p-1.5 text-uiInk hover:bg-white"
              aria-label={`Edit ${label} URL`}
            >
              <LinkSimple size={13} />
            </button>
            <button
              type="button"
              onClick={() => {
                setField(path, '');
                setLocalPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
              }}
              className="rounded bg-white/90 p-1.5 text-red-600 hover:bg-white"
              aria-label={`Remove ${label}`}
            >
              <Trash size={13} />
            </button>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }}
        />
      </div>

      <p className="truncate font-chromeMono text-2xs uppercase tracking-widest text-uiFg3">{label}</p>

      {(showUrl || (val && !staged && !isRenderable(val))) && (
        <input
          type="text"
          value={val}
          onChange={(e) => setField(path, e.target.value)}
          placeholder="https://…"
          aria-label={`${label} URL`}
          data-field-path={path}
          className="w-full rounded border border-uiRuleStrong bg-uiSurface px-1.5 py-1 font-chromeMono text-xs text-uiFg outline-none focus:border-uiAccent"
        />
      )}
    </div>
  );
}
