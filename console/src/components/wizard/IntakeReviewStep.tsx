'use client';

import { useState } from 'react';
import { Warning, BracketsCurly, Copy, X, Check, Sparkle, Globe } from '@phosphor-icons/react';
import type { SiteContent } from '@/data/site';
import { VERTICALS, type VerticalId } from '@/lib/verticals';
import { ALL_SECTIONS, type Section } from '@/lib/copy-schema';
import GenerateCopyPanel from '@/app/c/[slug]/build/GenerateCopyPanel';
import ScrapePanel from '@/app/c/[slug]/build/ScrapePanel';
import VerticalPicker from '@/app/c/[slug]/build/VerticalPicker';
import MissingFieldList from './MissingFieldList';
import IntakeReviewRail from './IntakeReviewRail';
import GeneratedSections from './GeneratedSections';

/**
 * The intake — where content comes FROM, what it produced, and what's still missing.
 *
 * This used to be the whole schema as twelve collapsible sections: every field for every
 * category, whether or not it needed attention. That inverted the job. The intake's actual
 * work is (a) getting copy in — AI generation or scraping an existing site — and (b)
 * closing the gaps that leaves behind.
 *
 * Two panes. The work column runs source → generated copy → fields needing input; the rail
 * is a live outline of the last of those. Flagged gaps are still the default view, so the
 * original reasoning holds — the "All fields" group is opt-in and scoped to the curated
 * dozen in field-labels.ts, not a return to the full-schema form. Everything else is edited
 * in the Studio, on the live page, where it has context, and the raw-JSON editor stays as
 * the escape hatch for bulk work.
 */

export type SourceId = 'generate' | 'seed';

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
  details,
  onDetailsChange,
  clientDetails,
  scanUrl,
  onScanUrlChange,
  source,
  onSourceChange,
  genSections,
  onGenSectionsChange,
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
  /**
   * The intake inputs live in the wizard bundle, not here — they used to be local state
   * and were destroyed every time this step unmounted on navigation.
   */
  details: string;
  onDetailsChange: (v: string) => void;
  /** The client's onboarding brand answers as prose; empty when they skipped that step. */
  clientDetails: string;
  scanUrl: string;
  onScanUrlChange: (v: string) => void;
  source: SourceId;
  onSourceChange: (v: SourceId) => void;
  genSections: Section[];
  onGenSectionsChange: (v: Section[]) => void;
}) {
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

  /**
   * The industry the client chose during onboarding, when it maps to a vertical we support.
   *
   * `null` for "other" or an unrecognised value — both mean the same thing here, that the
   * preselected vertical is ours rather than theirs, and the picker should say so.
   */
  const clientPickedVertical = ((): VerticalId | null => {
    const industry = (imported?._meta as { industry?: string } | undefined)?.industry
      ?.trim()
      .toLowerCase();
    if (!industry) return null;
    return VERTICALS.find((v) => v.id === industry || v.label.toLowerCase() === industry)?.id ?? null;
  })();

  return (
    <div className="flex h-full min-h-0">
      {/* Work column. Keeps max-w-3xl inside: the extra width buys the rail, not wider
          inputs — long-form copy past ~70ch gets harder to read, not easier. */}
      <div className="no-scrollbar min-w-0 flex-1 overflow-y-auto">
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
            {/* Derived from the intake already in scope rather than threaded down from
                BuildWizard: the client's answer and the imported intake are the same
                object, and a second prop would give them two chances to disagree. */}
            <VerticalPicker
              vertical={vertical}
              clientPicked={clientPickedVertical}
              onChange={onVerticalChange}
            />
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
              onClick={() => onSourceChange(id)}
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
            sections={genSections}
            onSectionsChange={onGenSectionsChange}
            details={details}
            onDetailsChange={onDetailsChange}
            clientDetails={clientDetails}
            scanUrl={scanUrl}
            onScanUrlChange={onScanUrlChange}
            generated={generated}
            onGenerated={onGenerated}
            onClearGenerated={onClearGenerated}
          />
        )}
        {source === 'seed' && (
          <ScrapePanel
            imported={imported}
            onImport={onImport}
            vertical={vertical}
            base={effective}
            url={scanUrl}
            onUrlChange={onScanUrlChange}
          />
        )}
      </section>

      {/* ── What the copywriter wrote ───────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="mb-3 font-display text-xl font-semibold text-uiInk">Brand copy</h2>
        <GeneratedSections
          content={effective}
          generated={generated}
          selected={genSections}
          onSelectedChange={onGenSectionsChange}
          onEditInStudio={onEditInStudio}
          busy={false}
        />
      </section>

      {/* ── What still needs a human ────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 font-display text-xl font-semibold text-uiInk">Needs review</h2>
        {/* Below lg the rail is hidden, so its outline would be the only thing lost —
            the list itself is here either way and stays fully usable. */}
        <MissingFieldList
          content={effective}
          setField={setField}
          paths={missing}
          onDone={onDone}
        />
      </section>


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
      </div>

      {/* ── Review rail ──────────────────────────────────────────────────────
          Hidden below lg: 768 (work column) + 320 (rail) + gutters needs ~1150px, and
          crushing both is worse than dropping the outline. Nothing is lost when it goes —
          the rail only jumps to fields the main column already lists. */}
      <aside className="hidden w-[320px] shrink-0 overflow-hidden border-l border-rule lg:block">
        <IntakeReviewRail content={effective} paths={missing} onDone={onDone} />
      </aside>
    </div>
  );
}
