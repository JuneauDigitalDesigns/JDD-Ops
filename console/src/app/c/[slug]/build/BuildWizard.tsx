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
  type StudioReverts,
} from './page-order';
import { buildCategories } from './categories';
import { injectImagePlaceholders } from '@/data/preview-placeholders';
import StudioStep from './StudioStep';
import IntakeReviewStep from '@/components/wizard/IntakeReviewStep';
import NavSlot from '@/components/NavSlot';
import { useHistory, type ContentSnapshot } from '@/lib/useContentHistory';
import type { StudioReadBack } from '@/lib/studio-readback';

const DEFAULT_VERTICAL: VerticalId = VERTICALS[0].id;
const bundleKey = (slug: string) => `jdd-wizard:${slug}`;

// Two steps. Build and Finalize were merged into one Studio — composing the page and
// editing it are the same activity, and the old split meant assembling blind then
// discovering the result. "Client" later went the same way for the same reason: the client
// is chosen once at the root picker and pinned in the shell above, so asking again here was
// a step that only restated something already decided.
const STEPS = [
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
 * The Build side as a 2-step, full-screen wizard: review the structured intake (vertical +
 * generate copy + edit) → compose the site.
 *
 * ALL wizard state (content + builder) lives here and is persisted PER CLIENT under
 * jdd-wizard:{slug}, so each client keeps its own copy and a client opened for the first
 * time starts from `seed` (its site.ts, read on the server) or the default vertical preset.
 *
 * `slug` is a prop, not state: it comes from the route, so the only way it changes is a
 * navigation that remounts this component with a fresh bundle.
 */
export default function BuildWizard({
  slug,
  seed,
  composition,
}: {
  slug: string;
  seed: SiteContent | null;
  /**
   * The page composition read back from the client's exported repo, when they have one.
   * Present = this client is already built, and the repo is the source of truth.
   */
  composition: StudioReadBack | null;
}) {
  const reduce = useReducedMotion();

  // ── Wizard position ────────────────────────────────────────────────────────
  // A client that has already been exported opens on STUDIO, not Intake. Intake is a
  // first-pass screen — "where does the content come from, and what's still missing" — and
  // for a site that already shipped the answer is "the repo". You came here to change the
  // page, so start on the page. (The rail is forward-only, so landing on Intake would also
  // mean an extra click every single time.)
  const [stepIndex, setStepIndex] = useState(composition ? STEPS.length - 1 : 0);
  const [dir, setDir] = useState(1);
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
  /**
   * False until the hydration effect has applied this client's saved bundle. Guards the
   * persist effect below: effects run in declaration order, so on the very first commit
   * persist would fire BEFORE hydration with this render's empty initial state — and write
   * that emptiness over a real saved bundle. (Hydration's setState can't reach persist's
   * closure in the same commit, so ordering alone doesn't fix it.)
   */
  const hydrated = useRef(false);

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

  // Persist the per-client bundle on any change — but never before hydration has run, or
  // the first commit's empty state would clobber what's in storage. See `hydrated`.
  useEffect(() => {
    if (!hydrated.current) return;
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
  /**
   * Fold a generation result into the generated layer.
   *
   * MERGE, not replace. This was `setGenerated(partial)` back when generation was always
   * all-or-nothing, so replacing was equivalent. Once you can regenerate a subset, replacing
   * would silently drop every section that wasn't in the request.
   *
   * The spread is section-level — `generated` is keyed by section name — which is exactly the
   * granularity per-section regeneration needs. `onClearGenerated` remains the way to remove
   * sections; this path only ever adds or overwrites the ones that came back.
   */
  const applyGenerated = useCallback((partial: Partial<SiteContent>) => {
    intakeCheckpoint();
    setGenerated((prev) => ({ ...(prev ?? {}), ...partial }));
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
  // ── Deploy-dialog reverts ────────────────────────────────────────────────
  // Putting ONE change back to what's live, from the deploy diff. Separate from the setters
  // above because the value comes from the git baseline rather than from the studio.

  /**
   * Force one subtree back to a shipped value.
   *
   * Distinct from setField, which only drops descendant edits for an array write. It can afford
   * that: its value is read out of `effective`, so the descendants are already baked into it.
   * Here the value comes from the BASELINE, so any surviving edit beneath `path` would be
   * re-applied on top by applyEdits and quietly un-revert the row.
   *
   * checkpoint, not checkpointEdit: a revert is a discrete action, and letting two fast clicks
   * coalesce into one undo step would make Ctrl+Z restore more than the operator undid.
   */
  const revertField = useCallback((path: string, value: unknown) => {
    studioCheckpoint();
    setEdits((e) => ({
      ...Object.fromEntries(
        Object.entries(e).filter(([k]) => k !== path && !k.startsWith(path + '.')),
      ),
      [path]: value,
    }));
  }, [studioCheckpoint]);

  /**
   * Put a section back as ONE undo step: variant, skin, and — when it's being re-added — the
   * position it holds on the live site. select() alone would drop it at its canonical slot with
   * a default skin, and calling select + selectSkin separately would push two checkpoints for
   * what the operator experienced as one click.
   */
  const restoreSection = useCallback(
    (categoryId: string, name: string, skin?: SkinId, atIndex?: number) => {
      studioCheckpoint();
      pendingInsert.current = atIndex === undefined ? null : { id: categoryId, at: atIndex };
      setSelections((prev) => ({ ...prev, [categoryId]: name }));
      setSkins((prev) => ({
        ...prev,
        [categoryId]: skin && isValidSkin(name, skin) ? skin : defaultSkin(name),
      }));
    },
    [studioCheckpoint],
  );

  /**
   * Restore a known page order. Sections in `next` that are no longer on the page are dropped;
   * sections on the page that `next` doesn't mention are KEPT and appended — silently deleting
   * them would be a loss the "Reordered" row never advertised.
   */
  const setOrderTo = useCallback((next: string[]) => {
    studioCheckpoint();
    setOrder((prev) =>
      enforcePins([
        ...next.filter((id) => prev.includes(id)),
        ...prev.filter((id) => !next.includes(id)),
      ]),
    );
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

  // deselect/selectSkin already do exactly what a revert of an added section / changed skin
  // needs, checkpoint included — reuse them rather than writing near-duplicates.
  const reverts = useMemo<StudioReverts>(
    () => ({
      field: revertField,
      restoreSection,
      removeSection: deselect,
      setSkin: selectSkin,
      setOrder: setOrderTo,
    }),
    [revertField, restoreSection, deselect, selectSkin, setOrderTo],
  );

  // ── Hydration ─────────────────────────────────────────────────────────────
  /**
   * Load this client's saved work: its localStorage bundle, or a fresh one from the seed
   * the server read out of clients/{slug}/site.ts.
   *
   * This is what step 1 used to do on choose. It has to live down here because it needs
   * applyBundle and both history stacks, and it flips `hydrated` so the persist effect
   * above knows the state it's looking at is real — see the note there.
   */
  useEffect(() => {
    hydrated.current = false;

    if (composition) {
      // ── Already exported: DISK WINS. ────────────────────────────────────────────────
      // The repo is what the client's site actually is, so opening the studio shows that
      // and nothing else. A stale localStorage draft from some earlier session must not
      // quietly present itself as the live page — being wrong about what's deployed is far
      // worse than losing an unsaved experiment, and deploying is how work is saved now.
      applyBundle({
        vertical: DEFAULT_VERTICAL,
        imported: seed,
        generated: null,
        edits: {},
        selections: composition.selections,
        skins: composition.skins,
        order: composition.order,
      });
    } else {
      // ── Never exported: the local draft is the only record there is. ────────────────
      let bundle: WizardBundle | null = null;
      try {
        const raw = window.localStorage.getItem(bundleKey(slug));
        if (raw) bundle = JSON.parse(raw) as WizardBundle;
      } catch {
        /* ignore malformed storage */
      }
      applyBundle(bundle ?? freshBundle(seed));
    }

    // Undo across a client switch would restore another client's content into this one.
    intakeHistory.clear();
    studioHistory.clear();
    hydrated.current = true;
    // Re-runs only on a client change, which in practice means a remount from the router.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // ── Navigation ───────────────────────────────────────────────────────────
  const isLast = stepIndex === STEPS.length - 1;

  function go(nextIndex: number) {
    if (nextIndex < 0 || nextIndex > STEPS.length - 1) return;
    setDir(nextIndex > stepIndex ? 1 : -1);
    setStepIndex(nextIndex);
  }

  const variants = {
    enter: (d: number) => ({ x: reduce ? 0 : d > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: reduce ? 0 : d > 0 ? '-100%' : '100%', opacity: 0 }),
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-uiCanvas">
      {/* ── Wizard chrome, in the per-tool ToolBar strip directly above the work.
             Step pills · undo/redo · Back/Next.

             These used to render into the console BAR alongside the app mark, the client
             name, a plan chip, a status badge and the three tool tabs — twelve-plus targets
             in one 64px band. They are ACTIONS, so they belong next to what they act on;
             the bar is wayfinding only now.

             Note the Studio step's own controls (zoom, reset, full screen, Launch/Deploy)
             stay in StudioStep's canvas bar rather than moving here. Those act on the
             CANVAS, not on the wizard, and Deploy in particular should sit with the page
             it deploys. ─────────────────────────────────────────────────────────────── */}
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

        {/* Who you're building for used to be repeated here. ClientChrome owns it now — it
            is the same in every tool, and the shell keeps it pinned above this bar. */}

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
                  // A composition read back from disk means this client is already live,
                  // so the studio's primary action becomes Deploy rather than Launch.
                  alreadyDeployed={Boolean(composition)}
                  brandName={effective.brand?.name}
                  reverts={reverts}
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
