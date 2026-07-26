'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, ArrowUUpLeft, ArrowUUpRight } from '@phosphor-icons/react';
import { arrayMove } from '@dnd-kit/sortable';
import type { SiteContent } from '@/data/site';
import { VERTICALS, VERTICAL_PRESETS, type VerticalId } from '@/lib/verticals';
import { deepMerge, applyEdits } from '@/lib/merge';
import { EASE } from '@/lib/motion';
import { defaultSkin, isValidSkin, type SkinId } from '@/lib/skins';
import {
  reconcileOrder,
  enforcePins,
  type Selections,
  type SkinSelections,
} from './page-order';
import { buildCategories } from './categories';
import { injectImagePlaceholders } from '@/data/preview-placeholders';
import StudioStep from './StudioStep';
import ClientSelectStep from '@/components/wizard/ClientSelectStep';
import IntakeReviewStep from '@/components/wizard/IntakeReviewStep';
import PlanChip from '@/components/PlanChip';
import NavSlot from '@/components/NavSlot';
import { useHistory, type ContentSnapshot } from '@/lib/useContentHistory';

const DEFAULT_VERTICAL: VerticalId = VERTICALS[0].id;
const bundleKey = (slug: string) => `jdd-wizard:${slug}`;

// Three steps, not four. Build and Finalize were merged into one Studio: composing the
// page and editing it are the same activity, and the old split meant assembling blind in
// step 3 then discovering the result in step 4.
const STEPS = [
  { id: 'client', label: 'Client' },
  { id: 'intake', label: 'Intake' },
  { id: 'studio', label: 'Studio' },
] as const;
type StepId = (typeof STEPS)[number]['id'];

/** The full per-client wizard bundle persisted under jdd-wizard:{slug}. */
type WizardBundle = {
  vertical: VerticalId;
  imported: SiteContent | null;
  generated: Partial<SiteContent> | null;
  edits: Record<string, unknown>;
  selections: Selections;
  skins: SkinSelections;
  order: string[];
};

function freshBundle(seed: SiteContent | null): WizardBundle {
  return {
    vertical: DEFAULT_VERTICAL,
    imported: seed,
    generated: null,
    edits: {},
    selections: {},
    skins: {},
    order: [],
  };
}

/**
 * The Build side as a 4-step, full-screen wizard: pick/create a client → review the
 * structured intake (vertical + generate copy + edit) → compose the site → finalize.
 * ALL wizard state (content + builder) lives here and is persisted PER CLIENT under
 * jdd-wizard:{slug}, so each client keeps its own copy and a new client starts fresh
 * from the default vertical preset.
 */
export default function BuildWizard() {
  const reduce = useReducedMotion();

  // ── Wizard position ────────────────────────────────────────────────────────
  const [stepIndex, setStepIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [slug, setSlug] = useState('');
  const step: StepId = STEPS[stepIndex].id;
  // A one-shot "scroll Studio to this section" request, set by the Intake review modal's
  // "Edit in Studio" jump and consumed once by StudioStep on entry.
  const [focusSection, setFocusSection] = useState<string | null>(null);

  // ── Content layer ───────────────────────────────────────────────────────────
  const [vertical, setVertical] = useState<VerticalId>(DEFAULT_VERTICAL);
  const [imported, setImported] = useState<SiteContent | null>(null);
  const [generated, setGenerated] = useState<Partial<SiteContent> | null>(null);
  const [edits, setEdits] = useState<Record<string, unknown>>({});

  // ── Builder layer ─────────────────────────────────────────────────────────
  const [selections, setSelections] = useState<Selections>({});
  const [skins, setSkins] = useState<SkinSelections>({});
  const [order, setOrder] = useState<string[]>([]);
  // A one-shot position request from select(…, atIndex), consumed by the reconcile effect.
  // A ref rather than state: it must not itself trigger a render, and it is always read in
  // the same tick the selection it describes is reconciled.
  const pendingInsert = useRef<{ id: string; at: number } | null>(null);

  // Effective = vertical preset ← imported ← generated ← user edits (top).
  const effective = useMemo(
    () => {
      const merged = applyEdits(
        deepMerge(deepMerge(VERTICAL_PRESETS[vertical], imported ?? {}), generated ?? {}),
        edits,
      );
      // Work ships hidden+empty in every preset. Once it has projects (added via the Brand
      // drawer, AI copy, or a seed) the section must show — in the preview AND the exported
      // content. Left hidden while empty, so an untouched Work section stays off (and the
      // preview still injects sample projects via injectImagePlaceholders).
      if (merged.work?.projects?.length && merged.work.hidden) {
        return { ...merged, work: { ...merged.work, hidden: false } };
      }
      return merged;
    },
    [vertical, imported, generated, edits],
  );
  // Tier shown in the header. Every vertical preset stamps _meta.selectedPlan and
  // ClientSelectStep's withPlan() overrides it from real intake, so this is almost always
  // present; 'growth' matches the fallback loadIntake() already uses (lib/intake.ts).
  const planTier = effective._meta?.selectedPlan ?? 'growth';
  // Preview-only: fill empty/preset image slots with per-vertical topical stock so
  // the build catalog renders (esp. Work). Export still uses the untouched `effective`.
  const previewContent = useMemo(
    () => injectImagePlaceholders(effective, vertical),
    [effective, vertical],
  );
  const categories = useMemo(() => buildCategories(previewContent), [previewContent]);

  // Reconcile body order whenever selections change.
  //
  // Order is DERIVED: select() writes `selections`, then this recomputes `order` via
  // reconcileOrder(), which drops new categories at their canonical slot. A caller asking
  // for a specific position (the between-sections "+") therefore can't set it directly —
  // it parks the request here and we apply it after reconcile has run.
  useEffect(() => {
    // Read and clear the request HERE, not inside the updater below. A setState updater
    // must be pure: StrictMode invokes it twice in dev and keeps the second result, so
    // clearing the ref inside it made the second pass see null and silently fall back to
    // canonical placement — the position was dropped every time.
    const p = pendingInsert.current;
    pendingInsert.current = null;
    setOrder((prev) => {
      const next = reconcileOrder(prev, selections);
      // Only reposition a genuinely NEW section. Re-picking a variant for a section already
      // on the page must not silently relocate it.
      if (!p || prev.includes(p.id) || !next.includes(p.id)) return next;
      const from = next.indexOf(p.id);
      const to = Math.max(0, Math.min(p.at, next.length - 1));
      // enforcePins keeps nav first / footer last, so an insert aimed past either resolves.
      return enforcePins(arrayMove(next, from, to));
    });
  }, [selections]);

  // Persist the per-client bundle on any change (only once a client is chosen).
  useEffect(() => {
    if (!slug) return;
    try {
      const bundle: WizardBundle = { vertical, imported, generated, edits, selections, skins, order };
      window.localStorage.setItem(bundleKey(slug), JSON.stringify(bundle));
    } catch {
      /* storage full or unavailable */
    }
  }, [slug, vertical, imported, generated, edits, selections, skins, order]);

  // ── Undo/redo — two view-scoped stacks (Intake vs Studio) ─────────────────
  // Each step's undo/redo drives its own stack. Both snapshots include `edits` (shared: the
  // Intake missing-field queue and Studio inline editing both write it). Accepted limitation:
  // editing an Intake field AFTER a Studio snapshot, then undoing in Studio, can revert that
  // Intake edit — rare in the linear Intake → Studio flow.
  const applyIntakeSnapshot = useCallback((s: ContentSnapshot) => {
    setVertical(s.vertical);
    setImported(s.imported);
    setGenerated(s.generated);
    setEdits(s.edits);
  }, []);
  const intakeHistory = useHistory({ vertical, imported, generated, edits }, applyIntakeSnapshot);

  const applyStudioSnapshot = useCallback(
    (s: { edits: Record<string, unknown>; selections: Selections; skins: SkinSelections; order: string[] }) => {
      setEdits(s.edits);
      setSelections(s.selections);
      setSkins(s.skins);
      setOrder(s.order);
    },
    [],
  );
  const studioHistory = useHistory({ edits, selections, skins, order }, applyStudioSnapshot);

  // Stable per-stack checkpoint fns (the hook memoizes these; the returned object is fresh
  // each render but its members are stable, so downstream callbacks stay referentially stable).
  const intakeCheckpoint = intakeHistory.checkpoint;
  const intakeCheckpointEdit = intakeHistory.checkpointEdit;
  const studioCheckpoint = studioHistory.checkpoint;
  const studioCheckpointEdit = studioHistory.checkpointEdit;

  // The active step's undo/redo — drives the keyboard shortcut and, for Intake, the navbar.
  const activeUndo = step === 'studio' ? studioHistory.undo : step === 'intake' ? intakeHistory.undo : null;
  const activeRedo = step === 'studio' ? studioHistory.redo : step === 'intake' ? intakeHistory.redo : null;

  // Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z (and Ctrl+Y), routed to the active step's stack. Skipped while
  // a contenteditable has focus: that's the preview's inline <E> editor, where the browser's own
  // text-level undo is what the operator means. Bound here (not in the hook) so the two stacks
  // don't both listen; only the active step responds.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k !== 'z' && k !== 'y') return;
      const el = document.activeElement as HTMLElement | null;
      if (el?.isContentEditable) return;
      if (!activeUndo || !activeRedo) return;
      e.preventDefault();
      if (k === 'y' || e.shiftKey) activeRedo();
      else activeUndo();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeUndo, activeRedo]);

  // Switching vertical swaps the whole preset baseline — undoable on the Intake stack.
  const changeVertical = useCallback((v: VerticalId) => {
    intakeCheckpoint();
    setVertical(v);
  }, [intakeCheckpoint]);

  // ── Content setters ──────────────────────────────────────────────────────
  const setField = useCallback((path: string, value: unknown) => {
    (step === 'studio' ? studioCheckpointEdit : intakeCheckpointEdit)();
    setEdits((e) => {
      // A whole-array write (Brand-drawer add/remove/reorder) supersedes any per-item leaf edits
      // beneath it. Without this, stale leaves like `work.projects.<i>.image.url` / `.t` get
      // re-applied by applyEdits ONTO the shortened array — resurrecting deleted items and
      // corrupting survivors. Their values are already baked into `value` (read from `effective`),
      // so dropping the descendants is lossless.
      const base = Array.isArray(value)
        ? Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith(path + '.')))
        : e;
      return { ...base, [path]: value };
    });
  }, [step, studioCheckpointEdit, intakeCheckpointEdit]);
  const applyBundle = useCallback((b: WizardBundle) => {
    setVertical(b.vertical);
    setImported(b.imported);
    setGenerated(b.generated);
    setEdits(b.edits);
    setSelections(b.selections);
    setSkins(b.skins);
    setOrder(b.order);
  }, []);
  // Each of these replaces a whole content layer, so each is one undo step (Intake stack).
  const importSite = useCallback((site: SiteContent) => {
    intakeCheckpoint();
    setImported(site);
  }, [intakeCheckpoint]);
  const applyGenerated = useCallback((partial: Partial<SiteContent>) => {
    intakeCheckpoint();
    setGenerated(partial);
  }, [intakeCheckpoint]);
  const clearGenerated = useCallback(() => {
    intakeCheckpoint();
    setGenerated(null);
  }, [intakeCheckpoint]);
  // The Styles/Text reset buttons live in the Studio control bar — one undo step on the Studio stack.
  const resetEdits = useCallback(() => {
    studioCheckpoint();
    setEdits({});
  }, [studioCheckpoint]);
  const resetStyles = useCallback(() => {
    studioCheckpoint();
    setEdits((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith('overrides.'))));
  }, [studioCheckpoint]);
  // Replace the whole working copy from the JSON editor: the pasted object becomes the
  // imported baseline and per-field edits/generated are cleared so it's authoritative.
  const replaceContent = useCallback((site: SiteContent) => {
    intakeCheckpoint();
    setImported(site);
    setGenerated(null);
    setEdits({});
  }, [intakeCheckpoint]);

  // ── Builder setters ──────────────────────────────────────────────────────
  const select = useCallback((categoryId: string, componentName: string, atIndex?: number) => {
    studioCheckpoint();
    // Parked for the reconcile effect above — order is derived from selections, so the
    // position can only be applied once reconcileOrder has placed the new id.
    pendingInsert.current = atIndex === undefined ? null : { id: categoryId, at: atIndex };
    setSelections((prev) => ({ ...prev, [categoryId]: componentName }));
    setSkins((prev) => {
      const current = prev[categoryId];
      return current && isValidSkin(componentName, current)
        ? prev
        : { ...prev, [categoryId]: defaultSkin(componentName) };
    });
  }, [studioCheckpoint]);
  const selectSkin = useCallback((categoryId: string, skin: SkinId) => {
    studioCheckpoint();
    setSkins((prev) => ({ ...prev, [categoryId]: skin }));
  }, [studioCheckpoint]);
  const deselect = useCallback((categoryId: string) => {
    studioCheckpoint();
    setSelections((prev) => { const next = { ...prev }; delete next[categoryId]; return next; });
    setSkins((prev) => { const next = { ...prev }; delete next[categoryId]; return next; });
  }, [studioCheckpoint]);
  const reorder = useCallback((activeId: string, overId: string) => {
    // Guard the no-op reorder before checkpointing so an idle drop doesn't add an undo step.
    // Indices read from `order` (== the committed list; no concurrent mutation mid-drag).
    const oldIndex = order.indexOf(activeId);
    const newIndex = order.indexOf(overId);
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
    studioCheckpoint();
    setOrder((prev) => enforcePins(arrayMove(prev, oldIndex, newIndex)));
  }, [order, studioCheckpoint]);

  // ── Navigation ───────────────────────────────────────────────────────────
  const canAdvance = step === 'client' ? slug.trim().length > 0 : true;
  const isLast = stepIndex === STEPS.length - 1;

  function go(nextIndex: number) {
    if (nextIndex < 0 || nextIndex > STEPS.length - 1) return;
    setDir(nextIndex > stepIndex ? 1 : -1);
    setStepIndex(nextIndex);
  }

  /** Step 1 → chose a client. Restore its saved bundle, or start fresh (optionally seeded). */
  function handleChooseClient(chosenSlug: string, seed: SiteContent | null) {
    let bundle: WizardBundle | null = null;
    try {
      const raw = window.localStorage.getItem(bundleKey(chosenSlug));
      if (raw) bundle = JSON.parse(raw) as WizardBundle;
    } catch {
      /* ignore malformed storage */
    }
    applyBundle(bundle ?? freshBundle(seed));
    // Undoing across a client switch would restore another client's content into this one.
    intakeHistory.clear();
    studioHistory.clear();
    setSlug(chosenSlug);
    go(1);
  }

  const variants = {
    enter: (d: number) => ({ x: reduce ? 0 : d > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: reduce ? 0 : d > 0 ? '-100%' : '100%', opacity: 0 }),
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-uiCanvas">
      {/* ── Wizard chrome, rendered up into the global ConsoleNav so /build shows ONE bar,
             not two. Step rail · client + plan · undo/redo · Back/Next. ──────────────── */}
      <NavSlot>
        <div className="flex shrink-0 items-center gap-1.5">
          {STEPS.map((s, i) => {
            const state = i === stepIndex ? 'active' : i < stepIndex ? 'done' : 'todo';
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => i < stepIndex && go(i)}
                disabled={i > stepIndex}
                className={[
                  'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                  state === 'active'
                    ? 'bg-accent text-[var(--accent-ink)]'
                    : state === 'done'
                    ? 'text-accent hover:bg-surface'
                    : 'cursor-default text-fg3/60',
                ].join(' ')}
              >
                <span
                  className={[
                    'flex h-4 w-4 items-center justify-center rounded-full text-2xs',
                    state === 'active'
                      ? 'bg-[var(--accent-ink)] text-accent'
                      : state === 'done'
                      ? 'bg-accent text-[var(--accent-ink)]'
                      : 'border border-current',
                  ].join(' ')}
                >
                  {state === 'done' ? <Check size={9} weight="bold" /> : i + 1}
                </span>
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Who you're building for. Absent on step 1 (no client chosen yet). */}
        {slug && (
          <div className="flex min-w-0 items-center gap-2 border-l border-rule pl-3">
            <span className="min-w-0 truncate font-display text-sm font-medium text-fg">
              {effective.brand.name}
            </span>
            <span className="hidden shrink-0 font-chromeMono text-kicker text-fg3 lg:inline">
              {slug}
            </span>
            <PlanChip plan={planTier} />
          </div>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {/* Undo/redo for the Intake step only — it drives the Intake stack (vertical, generated
              copy, seed, missing-field edits). The Studio step has its own undo/redo down in the
              Studio control bar, scoped to page composition + inline edits. */}
          {step === 'intake' && (
            <div className="flex items-center">
              <button
                type="button"
                onClick={intakeHistory.undo}
                disabled={!intakeHistory.canUndo}
                aria-label="Undo"
                className="rounded-md p-1.5 text-fg3 hover:bg-surface hover:text-fg disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ArrowUUpLeft size={15} />
              </button>
              <button
                type="button"
                onClick={intakeHistory.redo}
                disabled={!intakeHistory.canRedo}
                aria-label="Redo"
                className="rounded-md p-1.5 text-fg3 hover:bg-surface hover:text-fg disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ArrowUUpRight size={15} />
              </button>
            </div>
          )}
          {stepIndex > 0 && (
            <button type="button" onClick={() => go(stepIndex - 1)} className="btn btn-sm">
              <ArrowLeft size={14} /> Back
            </button>
          )}
          {!isLast && (
            <button
              type="button"
              onClick={() => go(stepIndex + 1)}
              disabled={!canAdvance}
              className="btn btn-sm btn-primary"
            >
              Next <ArrowRight size={14} />
            </button>
          )}
        </div>
      </NavSlot>

      {/* ── Sliding step viewport ──────────────────────────────────────────── */}
      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence custom={dir} initial={false} mode="popLayout">
          <motion.div
            key={step}
            custom={dir}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: reduce ? 0 : 0.42, ease: EASE }}
            className="absolute inset-0"
          >
            {step === 'client' && (
              <div className="h-full overflow-y-auto">
                <ClientSelectStep selectedSlug={slug} onChoose={handleChooseClient} />
              </div>
            )}

            {step === 'intake' && (
              <div className="h-full overflow-y-auto">
                <IntakeReviewStep
                  slug={slug}
                  vertical={vertical}
                  onVerticalChange={changeVertical}
                  effective={effective}
                  setField={setField}
                  generated={generated}
                  onGenerated={applyGenerated}
                  onClearGenerated={clearGenerated}
                  onReplaceContent={replaceContent}
                  imported={imported}
                  onImport={importSite}
                  onDone={() => go(2)}
                  onEditInStudio={(s) => { setFocusSection(s); go(2); }}
                />
              </div>
            )}

            {step === 'studio' && (
              <div className="h-full">
                <StudioStep
                  categories={categories}
                  effective={effective}
                  selections={selections}
                  skins={skins}
                  order={order}
                  vertical={vertical}
                  slug={slug}
                  onSelect={select}
                  onSelectSkin={selectSkin}
                  onDeselect={deselect}
                  onReorder={reorder}
                  setField={setField}
                  onResetEdits={resetEdits}
                  onResetStyles={resetStyles}
                  onUndo={studioHistory.undo}
                  onRedo={studioHistory.redo}
                  canUndo={studioHistory.canUndo}
                  canRedo={studioHistory.canRedo}
                  focusSection={focusSection}
                  onFocusHandled={() => setFocusSection(null)}
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
