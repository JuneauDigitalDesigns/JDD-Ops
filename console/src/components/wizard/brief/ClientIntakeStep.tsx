'use client';

/**
 * Step 1 — everything the client gave us, in one place.
 *
 * This is the screen the whole rebuild was asked for. Before it, "what did the client actually
 * tell us, and what are we still missing" had no answer anywhere in the console: the facts
 * were spread across a block editor, the client's own words sat in a different block, the
 * industry was a <select> in a header, and nothing distinguished a real client answer from a
 * vertical preset's placeholder. An operator could not review an intake, because there was no
 * intake to review.
 *
 * ── Two columns, two different jobs ──────────────────────────────────────────────────────
 * LEFT is editable: the fact paths the copywriter reads, grouped, each marked with where its
 * value came from. RIGHT is read-only: the client's own prose, shown as context while you fill
 * the left. The same prose is editable one step later ("Their words"), which is where it feeds
 * the prompt — editing it in two places would be two places to change one thing.
 *
 * ── It replaced the Facts block ──────────────────────────────────────────────────────────
 * There is no `facts` block any more (see resolve.ts). This screen edits those paths directly,
 * and the include/exclude toggle that block used to own is the one control at the top here.
 */
import { useState } from 'react';
import { WarningCircle, CheckCircle, BracketsCurly, X, Copy, Check, Warning } from '@phosphor-icons/react';
import type { CopyBrief } from '@jdd/schema';
import type { SiteContent } from '@/data/site';
import { Field, StringListSection, type SetField } from '@/components/fields';
import { isFieldFlagged } from '@/lib/flags';
import { labelOf } from '@/lib/field-labels';
import { getPath } from '@/lib/merge';
import { COPY_FACT_PATHS } from '@/lib/copy-brief/facts';
import { emptyFactPaths } from '@/lib/copy-brief/attention';
import { setBlockEnabled } from '@/lib/copy-brief/mutations';
import type { LinesBlock } from '@/lib/copy-brief/types';
import { VERTICALS, type VerticalId } from '@/lib/verticals';
import VerticalPicker from '@/app/c/[slug]/build/VerticalPicker';

type Update = (mutate: (brief: CopyBrief) => CopyBrief) => void;

const LIST_PATHS = new Set(['extensions.serviceArea', 'extensions.trustBadges', 'trust.logos']);

/** The fact paths, grouped for reading. Every COPY_FACT_PATHS entry appears exactly once; the
 *  final group catches anything added to that list later so a new fact can never go unrendered. */
const GROUPS: Array<{ title: string; paths: string[] }> = [
  { title: 'Identity', paths: ['brand.name', 'brand.long', 'brand.tagline', 'brand.established'] },
  { title: 'Contact', paths: ['brand.phone', 'brand.email', 'brand.address', 'brand.license'] },
  {
    title: 'Coverage & proof',
    paths: [
      'extensions.serviceArea', 'extensions.hours.all', 'extensions.trustBadges', 'trust.logos',
      'extensions.ownerName', 'extensions.brandsCarried', 'extensions.responseTime',
    ],
  },
];

function groupedPaths(): Array<{ title: string; paths: string[] }> {
  const claimed = new Set(GROUPS.flatMap((g) => g.paths));
  const rest = COPY_FACT_PATHS.filter((p) => !claimed.has(p));
  return rest.length ? [...GROUPS, { title: 'Other facts', paths: rest }] : GROUPS;
}

function SourceChip({ fromIntake }: { fromIntake: boolean }) {
  return (
    <span
      className="rounded px-1.5 py-0.5 font-chromeMono text-2xs uppercase tracking-wide"
      style={{
        background: 'var(--ui-surface)',
        color: fromIntake ? 'var(--ui-accent)' : 'var(--ui-fg-3)',
      }}
      title={
        fromIntake
          ? "The client's onboarding intake supplied this value"
          : 'Not in the intake — this came from the vertical preset or from you'
      }
    >
      {fromIntake ? 'from intake' : 'preset'}
    </span>
  );
}

export default function ClientIntakeStep({
  content, setField, missingFields, intakePaths, clientWords, factsEnabled, onUpdate,
  vertical, clientPickedVertical, onVerticalChange, onReplaceContent,
}: {
  content: SiteContent;
  setField: SetField;
  missingFields: string[];
  /** Fact paths the client's intake supplied — see copy-brief/attention.ts. */
  intakePaths: Set<string>;
  /** The client's-own-words block, rendered READ-ONLY here. Editable on the next step.
   *  Optional: resolveBrief is free to stop producing it, and an absent block reads the same
   *  as a client who answered nothing. */
  clientWords: LinesBlock | undefined;
  /** `brief.blocks.facts?.enabled ?? true` — now a settings key, not a block. */
  factsEnabled: boolean;
  onUpdate: Update;
  vertical: VerticalId;
  clientPickedVertical: VerticalId | null;
  onVerticalChange: (v: VerticalId) => void;
  onReplaceContent: (site: SiteContent) => void;
}) {
  const empty = emptyFactPaths(content);
  const filled = COPY_FACT_PATHS.length - empty.length;
  const services = content.services?.items ?? [];

  return (
    <div>
      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-uiCardRule pb-4">
        <h2 className="font-display text-xl font-semibold text-uiInk">
          {content.brand?.name?.trim() || <span className="italic text-uiFg3">Unnamed business</span>}
        </h2>
        {empty.length > 0 ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-medium"
            style={{ background: 'var(--warn-glow)', color: 'var(--warn)' }}
          >
            <WarningCircle size={13} weight="fill" />
            {empty.length} still empty
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-2xs font-medium text-ok">
            <CheckCircle size={13} weight="fill" /> Every fact filled
          </span>
        )}
        <span className="font-chromeMono text-2xs text-uiFg3">
          {filled} of {COPY_FACT_PATHS.length} filled
        </span>

        <div className="ml-auto flex items-center gap-3">
          <JsonHatch content={content} onReplaceContent={onReplaceContent} />
          <label className="flex cursor-pointer items-center gap-2">
            <span className="text-2xs uppercase tracking-wide text-uiInkSoft">
              {factsEnabled ? 'sent to copywriter' : 'withheld'}
            </span>
            <span
              role="switch"
              aria-checked={factsEnabled}
              onClick={() => onUpdate((b) => setBlockEnabled(b, 'facts', !factsEnabled))}
              className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors"
              style={{ background: factsEnabled ? 'var(--ui-accent)' : 'var(--ui-rule-strong)' }}
            >
              <span
                className="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform"
                style={{ transform: factsEnabled ? 'translateX(18px)' : 'translateX(3px)' }}
              />
            </span>
          </label>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ── LEFT: the facts, editable ───────────────────────────────────────── */}
        <div className="min-w-0 space-y-6">
          <section>
            <p className="kicker mb-2">Industry</p>
            <div className="rounded-lg border border-uiCardRule p-3">
              <VerticalPicker vertical={vertical} clientPicked={clientPickedVertical} onChange={onVerticalChange} />
              <p className="mt-2 text-2xs leading-relaxed text-uiFg3">
                Chooses the preset baseline and the copywriter&rsquo;s role, guardrails and forbidden
                words. Edit that prompt text on the Voice &amp; rules step.
                {VERTICALS.find((v) => v.id === vertical) && (
                  <> Currently <span className="font-chromeMono text-uiFg2">{VERTICALS.find((v) => v.id === vertical)!.label}</span>.</>
                )}
              </p>
            </div>
          </section>

          {groupedPaths().map((group) => (
            <section key={group.title}>
              <p className="kicker mb-2">{group.title}</p>
              <div className="space-y-4">
                {group.paths.map((path) => {
                  const flagged = isFieldFlagged(missingFields, path);
                  const fromIntake = intakePaths.has(path);
                  if (LIST_PATHS.has(path)) {
                    const arr = (getPath(content, path) as string[] | undefined) ?? [];
                    return (
                      <div key={path} className="rounded-md border border-uiCardRule">
                        <StringListSection
                          content={content}
                          setField={setField}
                          basePath={path}
                          title={labelOf(path)}
                          flagged={flagged}
                          defaultOpen={arr.length > 0}
                          right={<SourceChip fromIntake={fromIntake} />}
                        />
                      </div>
                    );
                  }
                  return (
                    <Field
                      key={path}
                      content={content}
                      setField={setField}
                      path={path}
                      label={<>{labelOf(path)} <SourceChip fromIntake={fromIntake} /></>}
                      flagged={flagged}
                    />
                  );
                })}
              </div>
            </section>
          ))}

          {/* Services are read-only here: they're a list with their own copy fields (tag,
              description, detail) that the Studio's Brand drawer owns. This is the record of
              what the client asked for, so you can see it while filling the facts. */}
          <section>
            <p className="kicker mb-2">Services they listed</p>
            {services.length === 0 ? (
              <p className="text-sm italic text-uiFg3">The client listed no services.</p>
            ) : (
              <ul className="space-y-1.5">
                {services.map((s, i) => (
                  <li key={i} className="flex items-baseline gap-2 rounded-md border border-uiCardRule px-3 py-2">
                    <span className="text-sm text-uiFg2">{s.t?.trim() || <span className="italic text-uiFg3">untitled</span>}</span>
                    {s.tag?.trim() && <span className="badge shrink-0">{s.tag}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* ── RIGHT: their own words, read-only ───────────────────────────────── */}
        <aside className="min-w-0">
          <p className="kicker mb-2">In their own words</p>
          {!clientWords || clientWords.lines.length === 0 ? (
            <p className="rounded-lg border border-dashed border-uiCardRule p-3 text-xs italic leading-relaxed text-uiFg3">
              The client skipped the brand-direction step during onboarding, so there is nothing
              here. The copy will be grounded in the facts alone.
            </p>
          ) : (
            <>
              <div className="space-y-2.5">
                {clientWords.lines.map((line) => (
                  <div key={line.id} className="rounded-lg border border-uiCardRule bg-uiSurface p-3">
                    <p className="font-chromeMono text-2xs uppercase tracking-wide text-uiFg3">{line.label}</p>
                    <p className="mt-1 text-sm leading-relaxed text-uiFg2">{line.text}</p>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-2xs leading-relaxed text-uiFg3">
                Read-only here. Edit these on the next step, Their words, which is where they
                reach the copywriter.
              </p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

/**
 * The raw-content escape hatch, moved here from the deleted Intake header bar — this is the
 * step that owns "what the underlying intake actually says", so it's where a raw view belongs.
 *
 * Deliberately NOT subject to the copy-review gate: this is the operator's own hand-authored
 * content, and gating it would make a stuck draft unrecoverable. Do not "close the loophole".
 */
function JsonHatch({
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
