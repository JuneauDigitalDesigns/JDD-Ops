'use client';

import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Warning, BracketsCurly, Copy, X, Check, Sparkle, Globe } from '@phosphor-icons/react';
import type { SiteContent } from '@/data/site';
import type { VerticalId } from '@/lib/verticals';
import { ALL_SECTIONS, type Section } from '@/lib/copy-schema';
import GenerateCopyPanel from '@/app/c/[slug]/build/GenerateCopyPanel';
import ScrapePanel from '@/app/c/[slug]/build/ScrapePanel';
import SectionCopyModal from '@/app/c/[slug]/build/SectionCopyModal';
import VerticalPicker from '@/app/c/[slug]/build/VerticalPicker';
import MissingFieldQueue from './MissingFieldQueue';

/**
 * Step 2 — where content comes FROM, and what's still missing.
 *
 * This used to be the whole schema as twelve collapsible sections: every field for every
 * category, whether or not it needed attention. That inverted the job. The intake's actual
 * work is (a) getting copy in — AI generation or scraping an existing site — and (b)
 * closing the gaps that leaves behind.
 *
 * So: one source pane at a time, then a guided queue over `_meta.missing_fields`. Everything
 * else is edited in the Studio, on the live page, where it has context. The raw-JSON editor
 * stays as the escape hatch for bulk work.
 */

type SourceId = 'generate' | 'seed';

const SOURCES: ReadonlyArray<{ id: SourceId; label: string; Icon: typeof Sparkle }> = [
  { id: 'generate', label: 'Generate copy', Icon: Sparkle },
  { id: 'seed', label: 'Seed from website', Icon: Globe },
];

export default function IntakeReviewStep({
  slug,
  vertical,
  onVerticalChange,
  effective,
  setField,
  generated,
  onGenerated,
  onClearGenerated,
  onReplaceContent,
  imported,
  onImport,
  onDone,
  onEditInStudio,
}: {
  slug: string;
  vertical: VerticalId;
  onVerticalChange: (v: VerticalId) => void;
  effective: SiteContent;
  setField: (path: string, value: unknown) => void;
  generated: Partial<SiteContent> | null;
  onGenerated: (p: Partial<SiteContent>) => void;
  onClearGenerated: () => void;
  onReplaceContent: (site: SiteContent) => void;
  imported: SiteContent | null;
  onImport: (site: SiteContent) => void;
  /** Advance to the Studio step. */
  onDone: () => void;
  /** Jump to Studio focused on a section (from the review modal). */
  onEditInStudio: (s: Section) => void;
}) {
  const [source, setSource] = useState<SourceId>('generate');
  const [reviewSection, setReviewSection] = useState<Section | null>(null);
  const missing = effective._meta?.missing_fields ?? [];

  // ── Editable JSON view (the escape hatch) ───────────────────────────────────
  const [jsonOpen, setJsonOpen] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function openJson() {
    setJsonText(JSON.stringify(effective, null, 2));
    setJsonError(null);
    setCopied(false);
    setJsonOpen(true);
  }
  function saveJson() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : 'Invalid JSON.');
      return;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      setJsonError('The JSON must be an object (the site content).');
      return;
    }
    onReplaceContent(parsed as SiteContent);
    setJsonOpen(false);
  }
  async function copyJson() {
    try {
      await navigator.clipboard.writeText(jsonText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — no-op */
    }
  }

  return (
    <div className="step-body max-w-3xl">
      <header className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            {/* No step number. It said "Step 2" from when choosing a client was step 1, and
                counting to two isn't worth a line of chrome now that it isn't. */}
            <h1 className="font-display text-3xl font-medium text-uiInk">
              Review the intake{slug ? <span className="text-uiInkSoft"> · {slug}</span> : null}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <VerticalPicker vertical={vertical} onChange={onVerticalChange} />
            <button type="button" onClick={openJson} className="btn btn-sm">
              <BracketsCurly size={16} /> JSON
            </button>
          </div>
        </div>
      </header>

      {/* ── Where the copy comes from — one pane at a time ─────────────────── */}
      <section className="mb-8">
        <div className="mb-4 inline-flex rounded-lg border border-rule bg-panel p-1 shadow-raised">
          {SOURCES.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSource(id)}
              className={[
                'inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-colors',
                source === id ? 'bg-uiInk text-white' : 'text-fg2 hover:text-fg',
              ].join(' ')}
            >
              <Icon size={16} weight={source === id ? 'fill' : 'regular'} /> {label}
            </button>
          ))}
        </div>

        {source === 'generate' && (
          <GenerateCopyPanel
            vertical={vertical}
            base={effective}
            sections={ALL_SECTIONS}
            generated={generated}
            onGenerated={onGenerated}
            onClearGenerated={onClearGenerated}
            onReviewSection={setReviewSection}
          />
        )}
        {source === 'seed' && (
          <ScrapePanel imported={imported} onImport={onImport} vertical={vertical} base={effective} />
        )}
      </section>

      {/* ── What still needs a human ────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 font-display text-xl font-semibold text-uiInk">Needs review</h2>
        <MissingFieldQueue
          content={effective}
          setField={setField}
          paths={missing}
          onDone={onDone}
        />
      </section>

      {/* ── Read-only review-copy modal (opened from a checklist item) ─────── */}
      <AnimatePresence>
        {reviewSection && (
          <SectionCopyModal
            section={reviewSection}
            content={effective}
            isGenerated={Boolean(generated && reviewSection in generated)}
            onClose={() => setReviewSection(null)}
            onEditInStudio={onEditInStudio}
          />
        )}
      </AnimatePresence>

      {/* ── Editable JSON modal ──────────────────────────────────────────── */}
      {jsonOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex h-[95vh] w-full max-w-3xl flex-col rounded-xl border border-rule bg-panel shadow-overlay">
            <div className="flex items-center justify-between border-b border-rule px-5 py-4">
              <h3 className="font-display text-xl font-semibold text-fg">Structured intake · JSON</h3>
              <button type="button" onClick={() => setJsonOpen(false)} aria-label="Close" className="rounded-md p-1.5 text-fg3 hover:bg-surface hover:text-fg">
                <X size={18} />
              </button>
            </div>

            <textarea
              value={jsonText}
              onChange={(e) => { setJsonText(e.target.value); setJsonError(null); }}
              spellCheck={false}
              className="flex-1 resize-none overflow-auto border-0 bg-transparent px-5 py-4 font-chromeMono text-xs leading-relaxed text-fg outline-none"
            />

            {jsonError && (
              <p className="flex items-center gap-2 border-t border-amber-200 bg-amber-50 px-5 py-2 text-xs text-amber-800">
                <Warning size={14} /> {jsonError}
              </p>
            )}

            <div className="flex items-center justify-between gap-2 border-t border-rule px-5 py-3">
              <button type="button" onClick={copyJson} className="btn btn-sm">
                {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy'}
              </button>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setJsonOpen(false)} className="btn btn-sm">
                  Cancel
                </button>
                <button type="button" onClick={saveJson} className="btn btn-sm btn-primary">
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
