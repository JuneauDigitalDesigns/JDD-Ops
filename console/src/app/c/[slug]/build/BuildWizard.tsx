'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, ArrowUUpLeft, ArrowUUpRight } from '@phosphor-icons/react';
import { arrayMove } from '@dnd-kit/sortable';
import type { SiteContent } from '@/data/site';
import { VERTICALS, presetFor, type VerticalId } from '@/lib/verticals';
import { deepMerge, applyEdits } from '@/lib/merge';
import { stepVariants, stepTransition } from '@/lib/step-motion';
import { defaultSkin, isValidSkin, type SkinId } from '@/lib/skins';
import type { CopyBrief } from '@jdd/schema';
import { emptyCopyBrief } from '@/lib/copy-brief/mutations';
import { DEFAULT_MODEL_ID } from '@/lib/model-pricing';
import {
  reconcileOrder,
  enforcePins,
  type Selections,
  type SkinSelections,
  type StudioReverts,
} from './page-order';
import { buildCategories } from './categories';
import { fillImagePlaceholders } from '@/data/image-placeholders';
import StudioStep from './StudioStep';
import IntakeStep, { type IntakeStageId } from '@/components/wizard/IntakeStep';
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

/** Index of the Studio step. Derived, so it can't drift out of range if STEPS changes again. */
const STUDIO_STEP = STEPS.length - 1;

/**
 * The full per-client wizard bundle persisted under jdd-wizard:{slug}.
 *
 * The four intake-input fields below were local component state until they kept getting
 * thrown away: the step tree unmounts on navigation (AnimatePresence keys on `step`), so
 * anything typed into the intake vanished the moment you looked at the Studio. The output
 * of generation persisted while the input that produced it did not, which made "tweak the
 * brief and re-run" impossible.
 */
type WizardBundle = {
  vertical: VerticalId;
  imported: SiteContent | null;
  generated: Partial<SiteContent> | null;
  edits: Record<string, unknown>;
  selections: Selections;
  skins: SkinSelections;
  order: string[];
  /** The Intake step's own sub-stage (Brief / Prompt / Review). */
  intakeStage: IntakeStageId;
  /** Everything the Brief stage's eleven blocks read and write — including which sections
   *  are ticked for generation (brief.tickedSections), which used to be its own field here. */
  brief: CopyBrief;
  /** The model picked on the Prompt stage's run controls. */
  copyModel: string;
};

/**
 * The vertical implied by the client's stated industry, when we can tell.
 *
 * The pick is not cosmetic: it chooses the preset baseline AND the copywriter's system
 * prompt, so getting it from the client rather than from an operator's guess is the whole
 * point of asking them.
 *
 * This sat here inert for a while: @jdd/schema declared `industry` with the comment "console
 * maps this to a copywriter VerticalId" but `mapBrandIntakeToIntake` never emitted the value,
 * so the client's answer was gone before the console saw it. Live as of schema v1.16.0.
 *
 * Still falls back to the manual pick whenever nothing matches — "other" is a real answer a
 * client can give, and an unrecognised industry must not silently pick a wrong vertical.
 */
function verticalFromIntake(seed: SiteContent | null): VerticalId | null {
  const industry = (seed?._meta as { industry?: string } | undefined)?.industry?.trim().toLowerCase();
  if (!industry) return null;
  const hit = VERTICALS.find(
    (v) => v.id === industry || v.label.toLowerCase() === industry,
  );
  return hit?.id ?? null;
}

/** Read a client's saved bundle. Partial because older ones predate the intake-input fields. */
function readBundle(slug: string): Partial<WizardBundle> | null {
  try {
    const raw = window.localStorage.getItem(bundleKey(slug));
    return raw ? (JSON.parse(raw) as Partial<WizardBundle>) : null;
  } catch {
    return null; // malformed or unavailable storage
  }
}

function freshBundle(seed: SiteContent | null): WizardBundle {
  return {
    vertical: verticalFromIntake(seed) ?? DEFAULT_VERTICAL,
    imported: seed,
    generated: null,
    edits: {},
    selections: {},
    skins: {},
    order: [],
    intakeStage: 'brief',
    brief: (seed?._meta.copyBrief as CopyBrief | undefined) ?? emptyCopyBrief(),
    copyModel: DEFAULT_MODEL_ID,
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
  draftBundle,
}: {
  slug: string;
  seed: SiteContent | null;
  /**
   * The page composition read back from the client's exported repo, when they have one.
   * Present = this client is already built, and the repo is the source of truth.
   */
  composition: StudioReadBack | null;
  /** Server-side draft saved by the last session. Survives cache clears and mid-generation refreshes. */
  draftBundle: Record<string, unknown> | null;
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

  // ── Intake inputs ─────────────────────────────────────────────────────────
  // The Brief's eleven blocks (lib/copy-brief) now own everything that used to live here as
  // separate details/scanUrl/source/genSections fields — they were lifted into the bundle in
  // the first place because the step tree unmounts on navigation, and `brief` inherits that
  // same reasoning: it has to survive the Intake step's own sub-stage navigation too.
  const [intakeStage, setIntakeStage] = useState<IntakeStageId>('brief');
  const [brief, setBrief] = useState<CopyBrief>(emptyCopyBrief);
  const [copyModel, setCopyModel] = useState<string>(DEFAULT_MODEL_ID);

  // ── Builder layer ─────────────────────────────────────────────────────────
  const [selections, setSelections] = useState<Selections>({});
  const [skins, setSkins] = useState<SkinSelections>({});
  const [order, setOrder] = useState<string[]>([]);
  // A one-shot position request from select(…, atIndex), consumed by the reconcile effect.
  // A ref rather than state: it must not itself trigger a render, and it is always read in
  // the same tick the selection it describes is reconciled.
  const pendingInsert = useRef<{ id: string; at: number } | null>(null);
  const saveDraftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
        deepMerge(deepMerge(presetFor(vertical), imported ?? {}), generated ?? {}),
        edits,
      );
      // Work ships hidden+empty in every preset. Once it has projects (added via the Brand
      // drawer, AI copy, or a seed) the section must show — in the preview AND the exported
      // content. Left hidden while empty, so an untouched Work section stays off (and the
      // preview still injects sample projects via fillImagePlaceholders's includeWork).
      if (merged.work?.projects?.length && merged.work.hidden) {
        return { ...merged, work: { ...merged.work, hidden: false } };
      }
      return merged;
    },
    [vertical, imported, generated, edits],
  );
  // Fill empty/preset image slots with per-vertical topical stock so the build catalog
  // renders. The export route runs the same transform on the server, so what's previewed
  // here is what ships — except `includeWork`, whose fabricated sample projects are
  // preview-only and are never serialized into a client repo.
  const previewContent = useMemo(
    () => fillImagePlaceholders(effective, vertical, { includeWork: true }).content,
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
    const bundle: WizardBundle = {
      vertical, imported, generated, edits, selections, skins, order,
      intakeStage, brief, copyModel,
    };
    try {
      window.localStorage.setItem(bundleKey(slug), JSON.stringify(bundle));
    } catch {
      /* storage full or unavailable */
    }
    // Also save to the server (debounced) so the draft survives cache clears and
    // mid-generation refreshes. Fire-and-forget — no user-visible error state.
    if (saveDraftTimer.current) clearTimeout(saveDraftTimer.current);
    saveDraftTimer.current = setTimeout(() => {
      fetch('/api/build/save-draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, bundle }),
      }).catch(() => { /* best-effort */ });
    }, 700);
  }, [
    slug, vertical, imported, generated, edits, selections, skins, order,
    intakeStage, brief, copyModel,
  ]);

  // Persist the brief durably to clients/{slug}/site.ts (_meta.copyBrief) — separate from the
  // draft save above, which writes .draft.json and gets deleted on a successful export (T13
  // in the intake rebuild plan). The brief has to survive past launch, so it needs its own
  // debounced save straight to the file the export route never touches. Watches only `brief`
  // (not the whole bundle) so an unrelated Studio edit doesn't trigger an extra write here.
  const saveBriefTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hydrated.current) return;
    if (saveBriefTimer.current) clearTimeout(saveBriefTimer.current);
    saveBriefTimer.current = setTimeout(() => {
      fetch('/api/build/save-brief', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, brief }),
      }).catch(() => { /* best-effort */ });
    }, 700);
  }, [slug, brief]);

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
  /** The Brief stage's own edits — always on the Intake stack, regardless of which outer
   *  step is active, since the Brief only exists on the Intake step. */
  const updateBrief = useCallback((mutate: (b: CopyBrief) => CopyBrief) => {
    intakeCheckpointEdit();
    setBrief((b) => mutate(b));
  }, [intakeCheckpointEdit]);
  /**
   * Apply a saved bundle to state.
   *
   * Takes a Partial deliberately: every bundle written before the intake-input fields
   * existed is missing them, so this has to default rather than assign `undefined` into a
   * controlled input (React would flip the textarea to uncontrolled and warn).
   */
  const applyBundle = useCallback((b: Partial<WizardBundle>) => {
    setVertical(b.vertical ?? verticalFromIntake(seed) ?? DEFAULT_VERTICAL);
    setImported(b.imported ?? null);
    setGenerated(b.generated ?? null);
    setEdits(b.edits ?? {});
    setSelections(b.selections ?? {});
    setSkins(b.skins ?? {});
    setOrder(b.order ?? []);
    setIntakeStage(b.intakeStage ?? 'brief');
    // Falls back to the durably-saved brief (site.ts's _meta.copyBrief, P4 of the intake
    // rebuild) rather than an empty one — a bundle can be missing the key entirely (an old
    // save predating the Brief stage) or the client's localStorage can simply be gone, and
    // either way the brief the operator built last time should still be there.
    setBrief(b.brief ?? (seed?._meta.copyBrief as CopyBrief | undefined) ?? emptyCopyBrief());
    setCopyModel(b.copyModel ?? DEFAULT_MODEL_ID);
    // `seed` is read for the durable-brief fallback, so it belongs in the deps — an empty
    // array here would pin this callback to the first client's intake.
  }, [seed]);
  // Each of these replaces a whole content layer, so each is one undo step (Intake stack).
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
  /**
   * Set (or, with `value === undefined`, remove) one top-level key of the generated overlay.
   * Backs the Review stage's per-section "Revert" — restoring a section to what it was
   * before the last run means either putting back that run's OWN prior value (when one
   * exists) or removing the key entirely so the merge falls through to imported/preset
   * content, and `undefined` is what signals "no prior value" through to here.
   */
  const setGeneratedSection = useCallback((section: string, value: unknown) => {
    intakeCheckpoint();
    setGenerated((prev) => {
      const next: Record<string, unknown> = { ...(prev ?? {}) };
      if (value === undefined) delete next[section];
      else next[section] = value;
      return Object.keys(next).length ? (next as Partial<SiteContent>) : null;
    });
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

    const saved = readBundle(slug);

    if (composition) {
      // ── Already exported: DISK WINS, for CONTENT. ───────────────────────────────────
      // The repo is what the client's site actually is, so opening the studio shows that
      // and nothing else. A stale localStorage draft from some earlier session must not
      // quietly present itself as the live page — being wrong about what's deployed is far
      // worse than losing an unsaved experiment, and deploying is how work is saved now.
      //
      // The intake INPUTS are carried across anyway. They aren't content and can't
      // misrepresent what's deployed — they're the brief you wrote — and an exported client
      // is precisely when you come back to tweak the guidance and regenerate.
      applyBundle({
        vertical: DEFAULT_VERTICAL,
        imported: seed,
        generated: null,
        edits: {},
        selections: composition.selections,
        skins: composition.skins,
        order: composition.order,
        intakeStage: saved?.intakeStage ?? draftBundle?.intakeStage as IntakeStageId | undefined,
        brief: (saved?.brief ?? draftBundle?.brief as CopyBrief | undefined) ?? (seed?._meta.copyBrief as CopyBrief | undefined),
        copyModel: saved?.copyModel ?? draftBundle?.copyModel as string | undefined,
      });
    } else {
      // ── Never exported: local storage wins, then the server draft, then a fresh start. ──
      applyBundle(saved ?? draftBundle ?? freshBundle(seed));
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

  const variants = stepVariants(reduce);

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
          {/* Hidden on the Intake step: IntakeStep now owns its own "Approve & continue to
              Studio" action on its last sub-stage, so a second Next here would be a
              redundant, confusing second way to do the same thing. */}
          {!isLast && step !== 'intake' && (
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
            transition={stepTransition(reduce)}
            className="absolute inset-0"
          >
            {/* overflow-HIDDEN, not auto: the Intake step is two panes that each own their
                own scroll now, and a scroll container here would stack a second scrollbar
                on top of theirs. */}
            {step === 'intake' && (
              <div className="h-full overflow-hidden">
                <IntakeStep
                  stage={intakeStage}
                  onStageChange={setIntakeStage}
                  vertical={vertical}
                  onVerticalChange={changeVertical}
                  effective={effective}
                  setField={setField}
                  generated={generated}
                  onGenerated={applyGenerated}
                  onClearGenerated={clearGenerated}
                  onSetGeneratedSection={setGeneratedSection}
                  onReplaceContent={replaceContent}
                  imported={imported}
                  // go(2) was dead. STEPS has two entries and go() rejects anything past the
                  // last index, so "Go to Studio" silently did nothing. Left over from when
                  // picking a client was step 0.
                  onDone={() => go(STUDIO_STEP)}
                  brief={brief}
                  onBriefChange={updateBrief}
                  copyModel={copyModel}
                  onCopyModelChange={setCopyModel}
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
