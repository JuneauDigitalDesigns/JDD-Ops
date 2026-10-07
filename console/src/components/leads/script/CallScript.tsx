'use client';
// The call script, opened over a lead.
//
// A response-driven wizard for a live phone call. Each beat shows its goal, the line to say, the
// talking points, and the things the prospect might say back. You move ONLY by tapping what they
// said: forward branches carry the bridge line you say as you advance, objection branches route
// you into a full objection beat that hands you back into the flow. There is no Next button; Back
// is the one manual override, and it retraces the actual path you took (objection detours and all).
//
// A top arc map is the orientation: it lights up as you move and shows a "handling objection" state
// while you are off on a detour. Guardrails (only-if-asked facts) live in a drawer, not the flow.
//
// Notes are the lead's own `notes` field, not a copy. Typing autosaves (silently, so the trail is
// not spammed) and closing flushes once with a single "Notes updated" activity entry. Position in
// the script (track, step, the back-history) and the calculator inputs live in localStorage, per lead.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, ArrowUUpLeft, CaretDown, CaretUp, Phone, ShieldCheck, X } from '@phosphor-icons/react';
import type { QueuedLead } from '@/lib/leadTypes';
import {
  GUARDRAILS,
  TONE_ORDER,
  TRACKS,
  TRACK_IDS,
  arcNodes,
  branchHint,
  branchTone,
  calcOutcome,
  defaultTrack,
  firstName,
  fillScript,
  fmtDollars,
  getStep,
  isObjectionStep,
  resolveGoto,
  type ScriptBranch,
  type ScriptTrackId,
} from '@/lib/sales-script';
import { stepTransition, stepVariants } from '@/lib/step-motion';

const storageKey = (leadId: string) => `jdd:script:${leadId}`;

interface HistoryEntry {
  track: ScriptTrackId;
  stepId: string;
}

interface Stored {
  track?: ScriptTrackId;
  stepId?: string;
  history?: HistoryEntry[];
  lastTrackStepId?: string;
  calc?: { calls: string; job: string; rec: string };
  /** Unsaved notes, kept as a crash guard. Only honoured while `base` still matches the lead. */
  draft?: string;
  base?: string;
}

function readStored(leadId: string): Stored {
  try {
    const raw = window.localStorage.getItem(storageKey(leadId));
    return raw ? (JSON.parse(raw) as Stored) : {};
  } catch {
    return {};
  }
}

function writeStored(leadId: string, value: Stored) {
  try {
    window.localStorage.setItem(storageKey(leadId), JSON.stringify(value));
  } catch {
    /* storage full or unavailable */
  }
}

const NOTES_MAX_PX = 192;
const NOTES_IDLE_PX = 34;
const AUTOSAVE_MS = 1200;

/** First track step id for a step: the step itself if it lives in the track, else the track opener. */
function trackStepFor(track: ScriptTrackId, stepId: string): string {
  return isObjectionStep(stepId) ? TRACKS[track].order[0] : stepId;
}

interface CallScriptProps {
  lead: QueuedLead;
  narrow: boolean;
  onClose: () => void;
  /** `silent` autosaves leave the activity trail alone; the closing flush does not. */
  onSaveNotes: (notes: string, silent: boolean) => void;
}

/**
 * Rendered into document.body, not in place. The leads view is a `relative z-10` stacking
 * context, so a `fixed z-[80]` overlay inside it is really z-10 and the console's z-50 navbar
 * paints over the top bar (the track switcher and the close button). The `onboard-chrome`
 * wrapper carries the form-control styling the notes field and calculator inputs depend on,
 * which is scoped to that class and would not reach a portal otherwise.
 */
export default function CallScript(props: CallScriptProps) {
  return createPortal(
    <div className="onboard-chrome">
      <CallScriptView {...props} />
    </div>,
    document.body,
  );
}

function CallScriptView({ lead, narrow, onClose, onSaveNotes }: CallScriptProps) {
  const reduce = useReducedMotion();

  // Everything restorable is read once, synchronously, so the first paint is already in place.
  const [initial] = useState(() => {
    const s = readStored(lead.id);
    const track: ScriptTrackId = s.track && TRACKS[s.track] ? s.track : defaultTrack(lead);
    const stepId = s.stepId && getStep(track, s.stepId) ? s.stepId : TRACKS[track].order[0];
    const history = (s.history ?? []).filter((h) => TRACKS[h.track] && getStep(h.track, h.stepId));
    const lastTrackStepId =
      s.lastTrackStepId && TRACKS[track].steps[s.lastTrackStepId]
        ? s.lastTrackStepId
        : trackStepFor(track, stepId);
    const base = lead.notes ?? '';
    const restoreDraft = typeof s.draft === 'string' && s.base === base && s.draft !== base;
    return {
      track,
      stepId,
      history,
      lastTrackStepId,
      calc: s.calc ?? { calls: '', job: '', rec: '' },
      notes: restoreDraft ? (s.draft as string) : base,
      restoreDraft,
      base,
    };
  });

  const [track, setTrack] = useState<ScriptTrackId>(initial.track);
  const [stepId, setStepId] = useState<string>(initial.stepId);
  const [history, setHistory] = useState<HistoryEntry[]>(initial.history);
  const historyRef = useRef(history);
  historyRef.current = history;
  const [lastTrackStepId, setLastTrackStepId] = useState<string>(initial.lastTrackStepId);
  const [dir, setDir] = useState(1);
  const [calcOpen, setCalcOpen] = useState(false);
  const [calc, setCalc] = useState(initial.calc);
  const [guardOpen, setGuardOpen] = useState(false);
  const [openGuards, setOpenGuards] = useState<string[]>([]);
  const [notes, setNotes] = useState(initial.notes);
  const [notesFocused, setNotesFocused] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle');

  const notesRef = useRef<HTMLTextAreaElement>(null);
  const notesValue = useRef(notes);
  notesValue.current = notes;
  const changed = useRef(initial.restoreDraft);
  const saveRef = useRef(onSaveNotes);
  saveRef.current = onSaveNotes;

  const step = getStep(track, stepId) ?? TRACKS[track].steps[TRACKS[track].order[0]];
  const isObj = isObjectionStep(step.id);

  // Branches, ordered forward -> objection -> exit. Held in a ref too, so the number-key handler
  // can pick the Nth visible branch without re-sorting.
  const branches = useMemo(
    () => [...step.branches].sort((a, b) => TONE_ORDER[branchTone(a)] - TONE_ORDER[branchTone(b)]),
    [step],
  );
  const branchesRef = useRef(branches);
  branchesRef.current = branches;

  // ── Persistence ────────────────────────────────────────────────────────────
  useEffect(() => {
    writeStored(lead.id, {
      track,
      stepId,
      history,
      lastTrackStepId,
      calc,
      draft: changed.current ? notes : undefined,
      base: initial.base,
    });
  }, [lead.id, track, stepId, history, lastTrackStepId, calc, notes, initial.base]);

  // Debounced silent autosave. `changed` gates it so merely opening the script never writes.
  useEffect(() => {
    if (!changed.current) return;
    const t = setTimeout(() => {
      saveRef.current(notes, true);
      setSaveState('saved');
    }, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [notes]);

  const close = useCallback(() => {
    // One logged entry per call: the autosaves were silent, so the trail says nothing yet.
    if (changed.current && notesValue.current !== initial.base) {
      saveRef.current(notesValue.current, false);
    }
    writeStored(lead.id, { ...readStored(lead.id), draft: undefined });
    onClose();
  }, [initial.base, lead.id, onClose]);

  const closeRef = useRef(close);
  closeRef.current = close;

  // ── Navigation ─────────────────────────────────────────────────────────────
  const dirBetween = useCallback(
    (fromTrack: ScriptTrackId, fromStep: string, toTrack: ScriptTrackId, toStep: string): number => {
      if (fromTrack === toTrack) {
        const ord = TRACKS[toTrack].order;
        const a = ord.indexOf(fromStep);
        const b = ord.indexOf(toStep);
        if (a >= 0 && b >= 0) return b >= a ? 1 : -1;
      }
      return 1;
    },
    [],
  );

  const goBack = useCallback(() => {
    const h = historyRef.current;
    if (!h.length) return;
    const prev = h[h.length - 1];
    setHistory(h.slice(0, -1));
    setDir(-1);
    setTrack(prev.track);
    setStepId(prev.stepId);
    if (!isObjectionStep(prev.stepId)) setLastTrackStepId(trackStepFor(prev.track, prev.stepId));
    setCalcOpen(false);
  }, []);
  const goBackRef = useRef(goBack);
  goBackRef.current = goBack;

  const navigateTo = useCallback(
    (toTrack: ScriptTrackId, toStep: string) => {
      setHistory((h) => [...h, { track, stepId }]);
      setDir(dirBetween(track, stepId, toTrack, toStep));
      setTrack(toTrack);
      setStepId(toStep);
      if (!isObjectionStep(toStep)) setLastTrackStepId(toStep);
      setCalcOpen(false);
    },
    [track, stepId, dirBetween],
  );

  const takeBranch = useCallback(
    (b: ScriptBranch) => {
      const nav = resolveGoto(b.goto, track);
      if (nav.kind === 'done') {
        close();
        return;
      }
      if (nav.kind === 'back') {
        goBack();
        return;
      }
      navigateTo(nav.track, nav.stepId);
    },
    [track, close, goBack, navigateTo],
  );

  const switchTrack = useCallback(
    (t: ScriptTrackId) => {
      if (t === track) return;
      navigateTo(t, TRACKS[t].order[0]);
    },
    [track, navigateTo],
  );

  const jumpArc = useCallback(
    (firstId: string) => {
      if (firstId !== stepId) navigateTo(track, firstId);
    },
    [track, stepId, navigateTo],
  );

  // Escape closes the script. Capture phase + stopPropagation: the lead modal underneath listens
  // for Escape on `document` and would otherwise close itself in the same keypress.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (guardOpen) {
        setGuardOpen(false);
        return;
      }
      closeRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [guardOpen]);

  // Number keys pick the Nth visible branch; ArrowLeft goes Back. Ignored while typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      if (e.key === 'ArrowLeft') {
        goBackRef.current();
        return;
      }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 9 && branchesRef.current[n - 1]) {
        takeBranch(branchesRef.current[n - 1]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [takeBranch]);

  // ── Notes strip sizing ─────────────────────────────────────────────────────
  useEffect(() => {
    const el = notesRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = notesFocused
      ? `${Math.min(Math.max(el.scrollHeight, 88), NOTES_MAX_PX)}px`
      : `${NOTES_IDLE_PX}px`;
  }, [notes, notesFocused, narrow]);

  // ── Arc map ────────────────────────────────────────────────────────────────
  const nodes = useMemo(() => arcNodes(track), [track]);
  const activeArcStepId = isObj ? lastTrackStepId : stepId;
  const curArcIdx = nodes.findIndex((n) => n.stepIds.includes(activeArcStepId));

  // ── Calculator ─────────────────────────────────────────────────────────────
  const out = calcOutcome(
    parseFloat(calc.calls) || 0,
    parseFloat(calc.job) || 0,
    calc.rec === '' ? 0 : parseFloat(calc.rec),
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  if (narrow) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Call script"
        className="fixed inset-0 z-[80] flex items-center justify-center p-4"
        style={{ background: 'var(--bg)' }}
      >
        <div className="panel max-w-sm p-6 text-center">
          <h3 className="mb-1 font-display text-base font-medium text-fg">Not enough room</h3>
          <p className="text-xs text-fg2">
            The call script needs a wider window. Widen it and it will pick up where you left off.
          </p>
          <button type="button" onClick={close} className="btn btn-sm mt-3">
            <ArrowLeft size={13} /> Back to the lead
          </button>
        </div>
      </div>
    );
  }

  const toneStyle = (tone: ReturnType<typeof branchTone>) =>
    tone === 'objection'
      ? { border: 'var(--warn)', hint: 'var(--warn)' }
      : tone === 'exit'
        ? { border: 'var(--rule-strong)', hint: 'var(--fg-3)' }
        : { border: 'var(--accent)', hint: 'var(--accent)' };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Call script for ${lead.businessName}`}
      className="fixed inset-0 z-[80] flex flex-col"
      style={{ background: 'var(--bg)' }}
    >
      {/* ── Top bar ── */}
      <div
        className="flex shrink-0 items-center gap-4 border-b border-rule px-6 py-3"
        style={{ background: 'var(--panel)' }}
      >
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className="truncate font-display text-lg font-semibold leading-none tracking-tightish">
            {lead.businessName}
          </h2>
          {lead.name?.trim() && <span className="meta shrink-0">{firstName(lead.name)}</span>}
        </div>

        <div className="ml-auto flex items-center gap-1.5" role="tablist" aria-label="Script track">
          {TRACK_IDS.map((id) => {
            const active = id === track;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => switchTrack(id)}
                className="rounded-[7px] border px-3 py-1 text-xs transition-colors"
                style={{
                  borderColor: active ? 'var(--accent)' : 'var(--rule)',
                  background: active ? 'var(--accent-glow)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--fg-2)',
                }}
              >
                {TRACKS[id].name}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setGuardOpen(true)}
          className="btn btn-sm shrink-0"
          aria-label="Open guardrails"
        >
          <ShieldCheck size={14} /> Guardrails
        </button>

        <button
          type="button"
          onClick={close}
          aria-label="Close call script"
          className="shrink-0 rounded p-1 text-fg3 hover:text-fg"
        >
          <X size={16} />
        </button>
      </div>

      {/* ── Arc map ── */}
      <div
        className="no-scrollbar flex shrink-0 items-center gap-1 overflow-x-auto border-b border-rule px-6 py-2.5"
        style={{ background: 'var(--panel)' }}
      >
        {nodes.map((n, i) => {
          const done = curArcIdx >= 0 && i < curArcIdx;
          const current = i === curArcIdx;
          return (
            <div key={n.label + i} className="flex shrink-0 items-center gap-1">
              {i > 0 && (
                <span
                  className="h-px w-5 shrink-0"
                  style={{ background: done ? 'var(--ok)' : 'var(--rule-strong)' }}
                />
              )}
              <button
                type="button"
                onClick={() => jumpArc(n.firstId)}
                className="flex items-center gap-2 rounded-[7px] px-1.5 py-1 transition-opacity"
                style={{ opacity: current || done ? 1 : 0.55 }}
              >
                <span
                  className="mono flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                  style={
                    done
                      ? { background: 'var(--ok)', color: 'var(--bg)', border: '1.5px solid var(--ok)' }
                      : current
                        ? { color: 'var(--accent)', border: '1.5px solid var(--accent)', boxShadow: '0 0 0 3px var(--accent-glow)' }
                        : { color: 'var(--fg-3)', border: '1.5px solid var(--rule-strong)' }
                  }
                >
                  {done ? '✓' : i + 1}
                </span>
                <span
                  className="whitespace-nowrap text-[13px] font-medium"
                  style={{ color: current ? 'var(--fg)' : done ? 'var(--fg-2)' : 'var(--fg-3)' }}
                >
                  {n.label}
                </span>
              </button>
            </div>
          );
        })}
        {isObj && (
          <span
            className="mono ml-2 shrink-0 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wider"
            style={{ color: 'var(--warn)', borderColor: 'var(--warn)', background: 'var(--warn-glow)' }}
          >
            Handling objection
          </span>
        )}
      </div>

      {/* ── Stage ── */}
      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence custom={dir} initial={false} mode="popLayout">
          <motion.div
            key={`${track}:${step.id}`}
            custom={dir}
            variants={stepVariants(reduce)}
            initial="enter"
            animate="center"
            exit="exit"
            transition={stepTransition(reduce)}
            className="no-scrollbar absolute inset-0 overflow-y-auto"
          >
            <div className="step-body max-w-[680px]">
              {isObj ? (
                <span
                  className="mono mb-3 inline-block rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wider"
                  style={{ color: 'var(--warn)', borderColor: 'var(--warn)', background: 'var(--warn-glow)' }}
                >
                  Objection
                </span>
              ) : (
                <div className="mb-3 flex items-baseline gap-2">
                  <span className="meta" style={{ color: 'var(--accent-2)' }}>
                    Goal
                  </span>
                  <span className="text-sm italic text-fg2">{step.goal}</span>
                </div>
              )}

              <h1 className="mb-5 font-display text-[28px] font-semibold leading-[1.1] tracking-tightish">
                {step.title}
              </h1>

              <div
                className="mb-6 rounded-[12px] border p-5"
                style={{
                  borderColor: 'var(--rule-strong)',
                  borderLeft: `3px solid ${isObj ? 'var(--warn)' : 'var(--accent)'}`,
                  background: 'var(--panel)',
                }}
              >
                <div className="meta mb-2" style={{ color: isObj ? 'var(--warn)' : 'var(--accent)' }}>
                  Say this
                </div>
                <p className="text-[19px] font-semibold leading-snug tracking-tightish text-fg">
                  {fillScript(step.say, lead)}
                </p>
                {step.phone && (
                  <div className="mono mt-3 flex items-center gap-1.5" style={{ color: 'var(--accent-2)' }}>
                    <Phone size={13} weight="fill" /> {step.phone}
                  </div>
                )}
              </div>

              {step.points.length > 0 && (
                <ul className="mb-7 flex flex-col gap-2.5">
                  {step.points.map((p) => (
                    <li key={p} className="flex gap-3 text-sm leading-relaxed text-fg2">
                      <span
                        className="mt-[9px] h-[5px] w-[5px] shrink-0 rounded-full"
                        style={{ background: 'var(--accent-2)' }}
                      />
                      {p}
                    </li>
                  ))}
                </ul>
              )}

              {step.calc && (
                <div className="mb-7">
                  <button
                    type="button"
                    onClick={() => setCalcOpen((o) => !o)}
                    className="btn btn-sm btn-accent"
                    aria-expanded={calcOpen}
                  >
                    Missed-calls calculator {calcOpen ? <CaretUp size={12} /> : <CaretDown size={12} />}
                  </button>
                  {calcOpen && (
                    <div className="panel mt-3 flex flex-col gap-4 p-4">
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="field-label" htmlFor="calc-calls">Missed calls / week</label>
                          <input
                            id="calc-calls"
                            type="number"
                            min={0}
                            inputMode="numeric"
                            placeholder="10"
                            value={calc.calls}
                            onChange={(e) => setCalc({ ...calc, calls: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="field-label" htmlFor="calc-job">Avg job value ($)</label>
                          <input
                            id="calc-job"
                            type="number"
                            min={0}
                            inputMode="numeric"
                            placeholder="800"
                            value={calc.job}
                            onChange={(e) => setCalc({ ...calc, job: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="field-label" htmlFor="calc-rec">% they catch today</label>
                          <input
                            id="calc-rec"
                            type="number"
                            min={0}
                            max={100}
                            inputMode="numeric"
                            placeholder="20"
                            value={calc.rec}
                            onChange={(e) => setCalc({ ...calc, rec: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div
                          className="rounded-[10px] border p-3 text-center"
                          style={{ borderColor: 'var(--rule)', background: 'var(--danger-glow)' }}
                        >
                          <div className="meta mb-1">Lost to missed calls / yr</div>
                          <div className="font-display text-2xl font-semibold" style={{ color: 'var(--danger)' }}>
                            {fmtDollars(out.lost)}
                          </div>
                        </div>
                        <div
                          className="rounded-[10px] border p-3 text-center"
                          style={{ borderColor: 'var(--rule)', background: 'var(--ok-glow)' }}
                        >
                          <div className="meta mb-1">Won back with a receptionist / yr</div>
                          <div className="font-display text-2xl font-semibold" style={{ color: 'var(--ok)' }}>
                            {fmtDollars(out.won)}
                          </div>
                        </div>
                      </div>
                      <p className="text-xs italic text-fg3">
                        Same math as the website. 37% of missed calls are leads, 46% close, 50%
                        recoverable. Illustrative.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {branches.length > 0 ? (
                <div>
                  <div className="meta mb-2">They respond</div>
                  <div className="flex flex-col gap-2">
                    {branches.map((b, i) => {
                      const tone = branchTone(b);
                      const c = toneStyle(tone);
                      return (
                        <button
                          key={b.label}
                          type="button"
                          onClick={() => takeBranch(b)}
                          className="flex items-center justify-between gap-3 rounded-[10px] border px-4 py-3 text-left transition-colors hover:brightness-105"
                          style={{
                            borderColor: 'var(--rule-strong)',
                            borderLeft: `3px solid ${c.border}`,
                            background: 'var(--surface)',
                          }}
                        >
                          <span className="flex min-w-0 flex-col gap-1">
                            <span className="flex items-center gap-2 text-sm font-medium text-fg">
                              <span
                                className="mono shrink-0 rounded border px-1.5 text-[10px] text-fg3"
                                style={{ borderColor: 'var(--rule)' }}
                              >
                                {i + 1}
                              </span>
                              {b.label}
                            </span>
                            {b.bridge && (
                              <span className="text-[13px] text-fg2">
                                Say: <span style={{ color: 'var(--accent)' }}>&ldquo;{b.bridge}&rdquo;</span>
                              </span>
                            )}
                          </span>
                          <span
                            className="meta flex shrink-0 items-center gap-1.5"
                            style={{ color: c.hint }}
                          >
                            {branchHint(b, track)} <ArrowRight size={11} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="meta mb-2">That&apos;s the close</div>
                  <button type="button" onClick={close} className="btn btn-primary">
                    Done. Close script
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Dock: notes strip + Back ── */}
      <div className="shrink-0 border-t border-rule px-6 py-3" style={{ background: 'var(--panel)' }}>
        <div className="mx-auto flex max-w-[680px] items-end gap-3">
          <div className="min-w-0 flex-1">
            <div className="meta mb-1 flex items-center justify-between">
              <span>Notes</span>
              {saveState === 'saved' && <span>Saved</span>}
            </div>
            <textarea
              ref={notesRef}
              value={notes}
              rows={1}
              onChange={(e) => {
                changed.current = true;
                setSaveState('idle');
                setNotes(e.target.value);
              }}
              onFocus={() => setNotesFocused(true)}
              onBlur={() => setNotesFocused(false)}
              placeholder="What you learned, what you promised, what's next."
              className="w-full resize-none text-sm leading-relaxed"
              style={{
                minHeight: NOTES_IDLE_PX,
                maxHeight: NOTES_MAX_PX,
                padding: '6px 12px',
                overflowY: notesFocused ? 'auto' : 'hidden',
              }}
            />
          </div>
          <div className="flex shrink-0 items-center gap-2 pb-px">
            <button type="button" className="btn" disabled={!history.length} onClick={goBack}>
              <ArrowUUpLeft size={14} /> Back
            </button>
          </div>
        </div>
      </div>

      {/* ── Guardrails drawer ── */}
      <AnimatePresence>
        {guardOpen && (
          <>
            <motion.div
              className="absolute inset-0 z-[1]"
              style={{ background: 'rgba(0,0,0,0.35)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setGuardOpen(false)}
            />
            <motion.div
              className="no-scrollbar absolute right-0 top-0 z-[2] flex h-full w-[min(420px,92vw)] flex-col overflow-y-auto border-l border-rule"
              style={{ background: 'var(--panel)' }}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: reduce ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-center justify-between border-b border-rule px-5 py-4">
                <h3 className="font-display text-base font-semibold">
                  Guardrails <span className="meta">only if asked</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setGuardOpen(false)}
                  className="rounded p-1 text-fg3 hover:text-fg"
                  aria-label="Close guardrails"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex flex-col gap-2 p-5">
                {GUARDRAILS.map((g) => {
                  const open = openGuards.includes(g.id);
                  return (
                    <div
                      key={g.id}
                      className="overflow-hidden rounded-[10px] border"
                      style={{ borderColor: open ? 'var(--accent)' : 'var(--rule)', background: 'var(--surface)' }}
                    >
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() =>
                          setOpenGuards((prev) =>
                            prev.includes(g.id) ? prev.filter((x) => x !== g.id) : [...prev, g.id],
                          )
                        }
                        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left"
                      >
                        <span className="text-sm font-medium text-fg">{g.title}</span>
                        {open ? <CaretUp size={12} /> : <CaretDown size={12} />}
                      </button>
                      {open && (
                        <div className="flex flex-col gap-3 px-4 pb-4">
                          <p
                            className="rounded-[8px] border-l-2 px-3 py-2.5 text-[15px] font-semibold leading-snug text-fg"
                            style={{ borderColor: 'var(--accent)', background: 'var(--panel)' }}
                          >
                            {fillScript(g.say, lead)}
                          </p>
                          {g.phone && (
                            <div className="mono flex items-center gap-1.5" style={{ color: 'var(--accent-2)' }}>
                              <Phone size={13} weight="fill" /> {g.phone}
                            </div>
                          )}
                          <ul className="flex flex-col gap-2">
                            {g.points.map((p) => (
                              <li key={p} className="flex gap-2.5 text-sm leading-relaxed text-fg2">
                                <span
                                  className="mt-[9px] h-[5px] w-[5px] shrink-0 rounded-full"
                                  style={{ background: 'var(--accent-2)' }}
                                />
                                {p}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
