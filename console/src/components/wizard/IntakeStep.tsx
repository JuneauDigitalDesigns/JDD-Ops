'use client';

import { useCallback, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Warning, BracketsCurly, Copy, X, Check } from '@phosphor-icons/react';
import { BUILT_IN_VERTICALS } from '@jdd/schema';
import type { CopyBrief, CopyBriefBlockId } from '@jdd/schema';
import type { SiteContent } from '@/data/site';
import { VERTICALS, type VerticalId } from '@/lib/verticals';
import { ALL_SECTIONS, parseVerdictKey, type Section, type VerdictKey } from '@/lib/copy-schema';
import { buildReviewGroups, reviewKeys, type ReviewPage } from '@/lib/copy-review-groups';
import { labelFor } from '@/lib/section-labels';
import { missingFields as getMissingFields } from '@/lib/flags';
import { stepVariants, stepTransition } from '@/lib/step-motion';
import { resolveBrief } from '@/lib/copy-brief/resolve';
import { setTickedSections } from '@/lib/copy-brief/mutations';
import VerticalPicker from '@/app/c/[slug]/build/VerticalPicker';
import BriefRail from './brief/BriefRail';
import BriefStage from './brief/BriefStage';
import PromptStage from './prompt/PromptStage';
import CopyWireframe, { type SectionVerdict } from './CopyWireframe';

export type IntakeStageId = 'brief' | 'prompt' | 'review';

const STAGES: ReadonlyArray<{ id: IntakeStageId; label: string }> = [
  { id: 'brief', label: 'Brief' },
  { id: 'prompt', label: 'Prompt' },
  { id: 'review', label: 'Review' },
];

/**
 * The Intake step's three sub-stages: Brief (assemble everything the copywriter reads) →
 * Prompt (review the compiled prompt and generate) → Review (a wireframe of the result).
 *
 * Brief and Prompt are both fully real now (P5 and P6 of the intake rebuild): the same
 * `blocks` this step resolves once per render feeds both — Stage 1 edits them, Stage 2
 * compiles and runs them. Review is still a placeholder until the copy wireframe lands.
 *
 * MissingFieldList/IntakeReviewRail ("Needs review") and the old GenerateCopyPanel/
 * ScrapePanel are gone, not deferred: the Brief's Facts and Website blocks cover the same
 * ground with the operator able to see and edit exactly what feeds the copywriter, which the
 * old free-text `details` box and the missing-fields list never showed.
 */
export default function IntakeStep({
  stage,
  onStageChange,
  vertical,
  onVerticalChange,
  effective,
  setField,
  generated,
  onGenerated,
  onClearGenerated,
  onSetGeneratedSection,
  onReplaceContent,
  imported,
  onDone,
  brief,
  onBriefChange,
  copyModel,
  onCopyModelChange,
  pages,
}: {
  stage: IntakeStageId;
  onStageChange: (s: IntakeStageId) => void;
  vertical: VerticalId;
  onVerticalChange: (v: VerticalId) => void;
  effective: SiteContent;
  setField: (path: string, value: unknown) => void;
  generated: Partial<SiteContent> | null;
  onGenerated: (p: Partial<SiteContent>) => void;
  onClearGenerated: () => void;
  onSetGeneratedSection: (section: string, value: unknown) => void;
  onReplaceContent: (site: SiteContent) => void;
  imported: SiteContent | null;
  onDone: () => void;
  brief: CopyBrief;
  onBriefChange: (mutate: (brief: CopyBrief) => CopyBrief) => void;
  copyModel: string;
  onCopyModelChange: (m: string) => void;
  /** The site's non-home pages (from the live composition) — drives the per-page review groups
   *  and, with them, the gate. Empty for a single-page site. */
  pages: ReviewPage[];
}) {
  const reduce = useReducedMotion();
  const stageIndex = STAGES.findIndex((s) => s.id === stage);
  const [dir, setDir] = useState(1);

  function go(id: IntakeStageId) {
    const next = STAGES.findIndex((s) => s.id === id);
    setDir(next > stageIndex ? 1 : -1);
    onStageChange(id);
  }

  const missing = getMissingFields(effective._meta);

  // Only the six built-in verticals are visible client-side today — a custom/overridden
  // vertical (console/.state/verticals.json, resolved server-side by
  // lib/verticals-registry.ts) doesn't reach the browser bundle yet. Threading that through
  // as a prop is the vertical editor's job (a later pass); until then this falls back to the
  // hvac role/rules for an id it doesn't recognise, same as the rest of the app does today.
  const verticalDef = useMemo(
    () => BUILT_IN_VERTICALS.find((v) => v.id === vertical) ?? BUILT_IN_VERTICALS[0],
    [vertical],
  );
  // undefined (the key was never set — an old brief, or a brand-new one) defaults to every
  // section; an explicit [] (the operator deselected everything via "None") must stay empty.
  // Checking `.length` instead of `=== undefined` conflated the two, so unticking the last
  // section snapped straight back to all eleven — "generate nothing" was unreachable.
  const tickedSections = useMemo(
    () => (brief.tickedSections === undefined ? ALL_SECTIONS.filter((s) => s !== 'brand') : (brief.tickedSections as Section[])),
    [brief.tickedSections],
  );
  // The verdict layer addresses copy per section PER PAGE, so it reads the brief's tickedSections
  // as the raw VerdictKey[] it actually is (string[] in @jdd/schema) rather than the Section[]
  // narrowing above, which the Brief/Prompt pipeline needs. A home section's key is its bare id;
  // a per-route key is `route:section`. The default (no brief yet) ticks every home section.
  const tickedKeys = useMemo<VerdictKey[]>(
    () => (brief.tickedSections === undefined ? ALL_SECTIONS.filter((s) => s !== 'brand') : brief.tickedSections),
    [brief.tickedSections],
  );
  const blocks = useMemo(
    () => resolveBrief({ vertical: verticalDef, effective, imported, brief, tickedSections }),
    [verticalDef, effective, imported, brief, tickedSections],
  );
  const [activeBlockId, setActiveBlockId] = useState<CopyBriefBlockId>(blocks[0].id);

  function jumpToBlock(id: CopyBriefBlockId) {
    setActiveBlockId(id);
    go('brief');
  }

  // Snapshot `generated` the instant before a run's results land, so Stage 3's per-section
  // Revert has an exact pre-run value to restore — `generated` (the prop) is still the old
  // value at the moment this fires, since onGenerated is what causes it to change.
  const [preRunGenerated, setPreRunGenerated] = useState<Partial<SiteContent> | null>(null);
  const handleGenerated = useCallback((p: Partial<SiteContent>) => {
    setPreRunGenerated(generated);
    onGenerated(p);
  }, [generated, onGenerated]);

  function verdictFor(key: VerdictKey): SectionVerdict {
    // The revert machinery keys off the generated overlay's TOP-LEVEL section key (what
    // onSetGeneratedSection writes); the route only distinguishes which review row this is.
    const { section } = parseVerdictKey(key);
    const ticked = tickedKeys.includes(key);
    const priorValue = preRunGenerated ? (preRunGenerated as Record<string, unknown>)[section] : undefined;
    const currentValue = generated ? (generated as Record<string, unknown>)[section] : undefined;
    return {
      ticked,
      canRevert: priorValue !== undefined || currentValue !== undefined,
      onAccept: () => onBriefChange((b) => setTickedSections(b, tickedKeys.filter((k) => k !== key))),
      onReroll: () => {
        if (!ticked) onBriefChange((b) => setTickedSections(b, [...tickedKeys, key]));
        go('prompt');
      },
      onRevert: () => onSetGeneratedSection(section, priorValue),
    };
  }

  // ── The copy-review gate (decision 51, a HARD block) ──────────────────────────────────────
  // A key is "unreviewed" when it has model-generated copy behind it AND is still ticked (ticked
  // = queued for regeneration = not yet approved; Accept is what removes it). Leaving the Intake
  // step is blocked while any key is unreviewed, so a model's prose only reaches a client site
  // after an operator has actually read it. The group counts shown in the review surface use this
  // exact set, so the UI and the gate never disagree.
  const reviewGroups = useMemo(() => buildReviewGroups(pages), [pages]);
  const allKeys = useMemo(() => reviewKeys(reviewGroups), [reviewGroups]);
  const hasGeneratedBehind = useCallback((key: VerdictKey): boolean => {
    if (!generated) return false;
    const { route, section } = parseVerdictKey(key);
    // A per-route page header's generated copy lives in the route-keyed subpages overlay; every
    // other key (home sections, and the Services page's shared services.detail) reads the
    // overlay's top-level section key.
    if (route && section === 'subpages') {
      const map = (generated as { subpages?: Record<string, unknown> }).subpages;
      return Boolean(map && map[route] !== undefined);
    }
    return (generated as Record<string, unknown>)[section] !== undefined;
  }, [generated]);
  const unreviewed = useMemo<VerdictKey[]>(
    () => allKeys.filter((k) => hasGeneratedBehind(k) && tickedKeys.includes(k)),
    [allKeys, hasGeneratedBehind, tickedKeys],
  );
  const unreviewedSet = useMemo(() => new Set(unreviewed), [unreviewed]);

  function approve() {
    if (unreviewed.length > 0) return; // the hard block — mirrors the disabled button below
    onBriefChange((b) => ({ ...b, lastRunAt: new Date().toISOString() }));
    onDone();
  }

  // A short, human reason for the gate: first few unreviewed sections, by page.
  const unreviewedLabel = (key: VerdictKey): string => {
    const { route, section } = parseVerdictKey(key);
    const page = route ? (pages.find((p) => p.route === route)?.label ?? route) : 'Home';
    return `${page} · ${labelFor(section)}`;
  };
  const gateReason = unreviewed.length === 0
    ? undefined
    : `${unreviewed.length} section${unreviewed.length === 1 ? '' : 's'} still need review: ${unreviewed.slice(0, 3).map(unreviewedLabel).join(', ')}${unreviewed.length > 3 ? '…' : ''}`;

  const clientPickedVertical = ((): VerticalId | null => {
    const industry = imported?._meta.industry?.trim().toLowerCase();
    if (!industry) return null;
    return VERTICALS.find((v) => v.id === industry || v.label.toLowerCase() === industry)?.id ?? null;
  })();

  // ── Editable JSON view (the escape hatch, unchanged from the old IntakeReviewStep) ──────
  // Deliberately NOT subject to the copy-review gate below: this is the operator's own
  // hand-authored content, not model output, and gating it would make a stuck draft
  // unrecoverable. Do not "close the loophole" — it is the only way out of a bad gate state.
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
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-uiCardRule px-6 py-3">
        <div className="flex items-center gap-1.5">
          {STAGES.map((s, i) => {
            const state = i === stageIndex ? 'active' : i < stageIndex ? 'done' : 'todo';
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => i <= stageIndex && go(s.id)}
                disabled={i > stageIndex}
                className={[
                  'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                  state === 'active' ? 'bg-uiAccent text-uiAccentInk' : state === 'done' ? 'text-uiAccent hover:bg-uiSurface' : 'cursor-default text-uiInkSoft/60',
                ].join(' ')}
              >
                <span
                  className={[
                    'flex h-4 w-4 items-center justify-center rounded-full text-2xs',
                    state === 'active' ? 'bg-uiAccentInk text-uiAccent' : state === 'done' ? 'bg-uiAccent text-uiAccentInk' : 'border border-current',
                  ].join(' ')}
                >
                  {state === 'done' ? <Check size={9} weight="bold" /> : i + 1}
                </span>
                {s.label}
                {s.id === 'review' && unreviewed.length > 0 && (
                  <span
                    className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-2xs font-semibold text-white"
                    title={gateReason}
                  >
                    {unreviewed.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <VerticalPicker vertical={vertical} clientPicked={clientPickedVertical} onChange={onVerticalChange} />
          <button type="button" onClick={openJson} className="btn btn-sm">
            <BracketsCurly size={16} /> JSON
          </button>
          {stageIndex > 0 && (
            <button type="button" onClick={() => go(STAGES[stageIndex - 1].id)} className="btn btn-sm">
              Back
            </button>
          )}
          {stageIndex < STAGES.length - 1 ? (
            // The sub-stage Next is NEVER gated — Brief → Prompt → Review must stay freely
            // navigable, since Review is where the reviewing happens. Only the exit to Studio below.
            <button type="button" onClick={() => go(STAGES[stageIndex + 1].id)} className="btn btn-sm btn-primary">
              Next
            </button>
          ) : (
            <>
              {gateReason && (
                <span className="max-w-xs truncate text-2xs text-uiInkSoft" title={gateReason}>
                  Review flagged copy first
                </span>
              )}
              <button
                type="button"
                onClick={approve}
                disabled={unreviewed.length > 0}
                title={gateReason}
                className="btn btn-sm btn-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                Approve &amp; continue to Studio
              </button>
            </>
          )}
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence custom={dir} initial={false} mode="popLayout">
          <motion.div
            key={stage}
            custom={dir}
            variants={stepVariants(reduce)}
            initial="enter"
            animate="center"
            exit="exit"
            transition={stepTransition(reduce)}
            className="absolute inset-0 overflow-hidden"
          >
            {stage === 'brief' && (
              <div className="flex h-full min-h-0">
                <BriefRail blocks={blocks} activeId={activeBlockId} onSelect={setActiveBlockId} />
                <div className="no-scrollbar min-w-0 flex-1 overflow-y-auto">
                  <div className="step-body max-w-2xl">
                    <BriefStage
                      blocks={blocks}
                      activeId={activeBlockId}
                      content={effective}
                      setField={setField}
                      missingFields={missing}
                      onUpdate={onBriefChange}
                    />
                  </div>
                </div>
              </div>
            )}

            {stage === 'prompt' && (
              <PromptStage
                vertical={vertical}
                verticalDef={verticalDef}
                base={effective}
                imported={imported}
                brief={brief}
                tickedSections={tickedSections}
                blocks={blocks}
                onBriefChange={onBriefChange}
                model={copyModel}
                onModelChange={onCopyModelChange}
                onGenerated={handleGenerated}
                onClearGenerated={onClearGenerated}
                hasGenerated={Boolean(generated)}
                onJumpToBlock={jumpToBlock}
              />
            )}

            {stage === 'review' && (
              <div className="no-scrollbar h-full overflow-y-auto px-6 py-6">
                <CopyWireframe content={effective} setField={setField} verdictFor={verdictFor} pages={pages} unreviewed={unreviewedSet} />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {jsonOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex h-[95vh] w-full max-w-3xl flex-col rounded-xl border border-uiCardRule bg-uiBg shadow-overlay">
            <div className="flex items-center justify-between border-b border-uiCardRule px-5 py-4">
              <h3 className="font-display text-xl font-semibold text-uiFg">Structured intake · JSON</h3>
              <button type="button" onClick={() => setJsonOpen(false)} aria-label="Close" className="rounded-md p-1.5 text-uiFg3 hover:bg-uiSurface hover:text-uiFg">
                <X size={18} />
              </button>
            </div>
            <textarea
              value={jsonText}
              onChange={(e) => { setJsonText(e.target.value); setJsonError(null); }}
              spellCheck={false}
              className="flex-1 resize-none overflow-auto border-0 bg-transparent px-5 py-4 font-chromeMono text-xs leading-relaxed text-uiFg outline-none"
            />
            {jsonError && (
              <p className="flex items-center gap-2 border-t border-amber-200 bg-amber-50 px-5 py-2 text-xs text-amber-800">
                <Warning size={14} /> {jsonError}
              </p>
            )}
            <div className="flex items-center justify-between gap-2 border-t border-uiCardRule px-5 py-3">
              <button type="button" onClick={copyJson} className="btn btn-sm">
                {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy'}
              </button>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setJsonOpen(false)} className="btn btn-sm">Cancel</button>
                <button type="button" onClick={saveJson} className="btn btn-sm btn-primary">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
