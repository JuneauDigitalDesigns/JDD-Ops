'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check } from '@phosphor-icons/react';
import { arrayMove } from '@dnd-kit/sortable';
import type { SiteContent } from '@/data/site';
import { VERTICALS, VERTICAL_PRESETS, type VerticalId } from '@/lib/verticals';
import { deepMerge, applyEdits } from '@/lib/merge';
import { EASE } from '@/lib/motion';
import { paletteVars, typographyVars } from '@/lib/palette';
import { defaultSkin, isValidSkin, type SkinId } from '@/lib/skins';
import {
  reconcileOrder,
  enforcePins,
  type Selections,
  type SkinSelections,
} from './StudioApp';
import { buildCategories } from './categories';
import { injectImagePlaceholders } from '@/data/preview-placeholders';
import StudioApp from './StudioApp';
import FinalizePanel from './FinalizePanel';
import BrandDrawer from './BrandDrawer';
import ClientSelectStep from '@/components/wizard/ClientSelectStep';
import IntakeReviewStep from '@/components/wizard/IntakeReviewStep';

const DEFAULT_VERTICAL: VerticalId = VERTICALS[0].id;
const bundleKey = (slug: string) => `jdd-wizard:${slug}`;

const STEPS = [
  { id: 'client', label: 'Client' },
  { id: 'intake', label: 'Intake' },
  { id: 'builder', label: 'Build' },
  { id: 'finalize', label: 'Finalize' },
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

  // ── Content layer ───────────────────────────────────────────────────────────
  const [vertical, setVertical] = useState<VerticalId>(DEFAULT_VERTICAL);
  const [imported, setImported] = useState<SiteContent | null>(null);
  const [generated, setGenerated] = useState<Partial<SiteContent> | null>(null);
  const [edits, setEdits] = useState<Record<string, unknown>>({});

  // ── Builder layer ─────────────────────────────────────────────────────────
  const [selections, setSelections] = useState<Selections>({});
  const [skins, setSkins] = useState<SkinSelections>({});
  const [order, setOrder] = useState<string[]>([]);

  // Effective = vertical preset ← imported ← generated ← user edits (top).
  const effective = useMemo(
    () =>
      applyEdits(
        deepMerge(deepMerge(VERTICAL_PRESETS[vertical], imported ?? {}), generated ?? {}),
        edits,
      ),
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
  useEffect(() => {
    setOrder((prev) => reconcileOrder(prev, selections));
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

  // ── Content setters ──────────────────────────────────────────────────────
  const setField = useCallback((path: string, value: unknown) => {
    setEdits((e) => ({ ...e, [path]: value }));
  }, []);
  const applyBundle = useCallback((b: WizardBundle) => {
    setVertical(b.vertical);
    setImported(b.imported);
    setGenerated(b.generated);
    setEdits(b.edits);
    setSelections(b.selections);
    setSkins(b.skins);
    setOrder(b.order);
  }, []);
  const importSite = useCallback((site: SiteContent) => setImported(site), []);
  const clearImport = useCallback(() => { setImported(null); setGenerated(null); }, []);
  const applyGenerated = useCallback((partial: Partial<SiteContent>) => setGenerated(partial), []);
  const clearGenerated = useCallback(() => setGenerated(null), []);
  const resetEdits = useCallback(() => setEdits({}), []);
  const resetStyles = useCallback(
    () => setEdits((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith('overrides.')))),
    [],
  );
  // Replace the whole working copy from the JSON editor: the pasted object becomes the
  // imported baseline and per-field edits/generated are cleared so it's authoritative.
  const replaceContent = useCallback((site: SiteContent) => {
    setImported(site);
    setGenerated(null);
    setEdits({});
  }, []);

  // ── Builder setters ──────────────────────────────────────────────────────
  const select = useCallback((categoryId: string, componentName: string) => {
    setSelections((prev) => ({ ...prev, [categoryId]: componentName }));
    setSkins((prev) => {
      const current = prev[categoryId];
      return current && isValidSkin(componentName, current)
        ? prev
        : { ...prev, [categoryId]: defaultSkin(componentName) };
    });
  }, []);
  const selectSkin = useCallback((categoryId: string, skin: SkinId) => {
    setSkins((prev) => ({ ...prev, [categoryId]: skin }));
  }, []);
  const deselect = useCallback((categoryId: string) => {
    setSelections((prev) => { const next = { ...prev }; delete next[categoryId]; return next; });
    setSkins((prev) => { const next = { ...prev }; delete next[categoryId]; return next; });
  }, []);
  const reorder = useCallback((activeId: string, overId: string) => {
    setOrder((prev) => {
      const oldIndex = prev.indexOf(activeId);
      const newIndex = prev.indexOf(overId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return prev;
      return enforcePins(arrayMove(prev, oldIndex, newIndex));
    });
  }, []);

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
    setSlug(chosenSlug);
    go(1);
  }

  const variants = {
    enter: (d: number) => ({ x: reduce ? 0 : d > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: reduce ? 0 : d > 0 ? '-100%' : '100%', opacity: 0 }),
  };

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-uiCanvas">
      {/* ── Top chrome: step indicator + Back/Next ─────────────────────────── */}
      <header className="flex shrink-0 items-center justify-between border-b border-uiRule px-5 py-3">
        <div className="flex items-center gap-2">
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
                    ? 'bg-uiInk text-white'
                    : state === 'done'
                    ? 'text-uiInk hover:bg-uiSurface'
                    : 'text-uiInkSoft/60 cursor-default',
                ].join(' ')}
              >
                <span
                  className={[
                    'flex h-4 w-4 items-center justify-center rounded-full text-[9px]',
                    state === 'active'
                      ? 'bg-white text-uiInk'
                      : state === 'done'
                      ? 'bg-uiInk text-white'
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

        <div className="flex items-center gap-2">
          {stepIndex > 0 && (
            <button
              type="button"
              onClick={() => go(stepIndex - 1)}
              className="flex items-center gap-1 rounded-md border border-uiRule px-3 py-1.5 text-sm text-uiInk hover:border-uiInk"
            >
              <ArrowLeft size={14} /> Back
            </button>
          )}
          {!isLast && (
            <button
              type="button"
              onClick={() => go(stepIndex + 1)}
              disabled={!canAdvance}
              className="flex items-center gap-1 rounded-md bg-uiInk px-4 py-1.5 text-sm font-medium text-white hover:bg-uiInk/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next <ArrowRight size={14} />
            </button>
          )}
        </div>
      </header>

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
                  onVerticalChange={setVertical}
                  effective={effective}
                  setField={setField}
                  generated={generated}
                  onGenerated={applyGenerated}
                  onClearGenerated={clearGenerated}
                  onReplaceContent={replaceContent}
                />
              </div>
            )}

            {step === 'builder' && (
              <div className="h-full">
                <StudioApp
                  categories={categories}
                  effective={effective}
                  selections={selections}
                  skins={skins}
                  onSelect={select}
                  onSelectSkin={selectSkin}
                  onDeselect={deselect}
                  onClearAll={() => { setSelections({}); setSkins({}); }}
                />
              </div>
            )}

            {step === 'finalize' && (
              <div className="flex h-full overflow-hidden">
                <main
                  className="flex-1 overflow-y-auto"
                  style={{ ...paletteVars(effective.brand), ...typographyVars(effective.brand) }}
                >
                  <div className="mx-auto max-w-5xl px-6 py-10">
                    <FinalizePanel
                      categories={categories}
                      selections={selections}
                      skins={skins}
                      onSkinChange={selectSkin}
                      order={order}
                      onReorder={reorder}
                      vertical={vertical}
                      effective={effective}
                      setField={setField}
                      imported={imported}
                      onImport={importSite}
                      onClearImport={clearImport}
                      generated={generated}
                      onGenerated={applyGenerated}
                      onClearGenerated={clearGenerated}
                      onResetEdits={resetEdits}
                      onResetStyles={resetStyles}
                      hideSources
                      lockedSlug={slug}
                    />
                  </div>
                </main>
                <BrandDrawer content={effective} setField={setField} />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
