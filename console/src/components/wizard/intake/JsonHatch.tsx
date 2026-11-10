'use client';

import { useState } from 'react';
import { BracketsCurly, X, Copy, Check, Warning } from '@phosphor-icons/react';
import type { SiteContent } from '@/data/site';

/**
 * The raw-content escape hatch, moved here from the deleted Intake header bar — this is the
 * step that owns "what the underlying intake actually says", so it's where a raw view belongs.
 *
 * Deliberately NOT subject to the copy-review gate: this is the operator's own hand-authored
 * content, and gating it would make a stuck draft unrecoverable. Do not "close the loophole".
 */
export default function JsonHatch({
  content, onReplaceContent,
}: {
  content: SiteContent;
  onReplaceContent: (site: SiteContent) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function openModal() {
    setText(JSON.stringify(content, null, 2));
    setError(null);
    setCopied(false);
    setOpen(true);
  }

  function save() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid JSON.');
      return;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      setError('The JSON must be an object (the site content).');
      return;
    }
    onReplaceContent(parsed as SiteContent);
    setOpen(false);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — no-op */
    }
  }

  return (
    <>
      <button type="button" onClick={openModal} className="btn btn-sm" title="View or edit the raw site content">
        <BracketsCurly size={15} /> JSON
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex h-[95vh] w-full max-w-3xl flex-col rounded-xl border border-uiCardRule bg-uiBg shadow-overlay">
            <div className="flex items-center justify-between border-b border-uiCardRule px-5 py-4">
              <h3 className="font-display text-xl font-semibold text-uiFg">Structured intake · JSON</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-md p-1.5 text-uiFg3 hover:bg-uiSurface hover:text-uiFg"
              >
                <X size={18} />
              </button>
            </div>
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setError(null); }}
              spellCheck={false}
              className="flex-1 resize-none overflow-auto border-0 bg-transparent px-5 py-4 font-chromeMono text-xs leading-relaxed text-uiFg outline-none"
            />
            {error && (
              <p className="flex items-center gap-2 border-t border-amber-200 bg-amber-50 px-5 py-2 text-xs text-amber-800">
                <Warning size={14} /> {error}
              </p>
            )}
            <div className="flex items-center justify-between gap-2 border-t border-uiCardRule px-5 py-3">
              <button type="button" onClick={copy} className="btn btn-sm">
                {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy'}
              </button>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setOpen(false)} className="btn btn-sm">Cancel</button>
                <button type="button" onClick={save} className="btn btn-sm btn-primary">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
