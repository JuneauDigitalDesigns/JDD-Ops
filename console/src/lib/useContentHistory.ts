'use client';

import { useCallback, useRef, useState } from 'react';
import type { SiteContent } from '@/data/site';
import type { VerticalId } from '@/lib/verticals';

// Generic undo/redo over a snapshot object.
//
// The wizard runs TWO independent instances (see BuildWizard): one scoped to the Intake
// content layers, one scoped to the Studio layers. Each snapshot is a whole-object copy of
// the relevant state rather than an inverse patch — the right trade here: the layers are
// already immutable (every setter produces a fresh object) and already JSON-serialized to
// localStorage each change, and list editors rewrite an entire array at basePath as one entry,
// so one array edit is correctly one undo step.
//
// The keyboard shortcut is NOT bound here: with two instances a hook-level listener would fire
// twice and couldn't know which step is active. BuildWizard binds one listener routed to the
// active step's stack.

/** Intake stack snapshot — content layers. */
export type ContentSnapshot = {
  vertical: VerticalId;
  imported: SiteContent | null;
  generated: Partial<SiteContent> | null;
  edits: Record<string, unknown>;
};

const CAP = 50;
/** Edits closer together than this coalesce into one undo step, so typing a word isn't 12. */
const BURST_MS = 600;

export function useHistory<T extends object>(
  current: T,
  apply: (snap: T) => void,
) {
  const latest = useRef(current);
  latest.current = current;

  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const lastEditAt = useRef(0);
  // Refs hold the stacks (no re-render on push); this counter surfaces depth to the UI.
  const [, bump] = useState(0);

  const commit = useCallback(() => {
    past.current.push(latest.current);
    if (past.current.length > CAP) past.current.shift();
    future.current = [];
    bump((n) => n + 1);
  }, []);

  /** Snapshot before a discrete action (generate copy, reset, add/reorder section, vertical switch). */
  const checkpoint = useCallback(() => {
    lastEditAt.current = 0; // a discrete action always ends the current typing burst
    commit();
  }, [commit]);

  /** Snapshot before a field edit, coalescing rapid successive edits into one step. */
  const checkpointEdit = useCallback(() => {
    const now = Date.now();
    if (now - lastEditAt.current > BURST_MS) commit();
    lastEditAt.current = now;
  }, [commit]);

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(latest.current);
    lastEditAt.current = 0;
    apply(prev);
    bump((n) => n + 1);
  }, [apply]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(latest.current);
    lastEditAt.current = 0;
    apply(next);
    bump((n) => n + 1);
  }, [apply]);

  /** Drop all history — call when switching clients, where restoring another's state is nonsense. */
  const clear = useCallback(() => {
    past.current = [];
    future.current = [];
    lastEditAt.current = 0;
    bump((n) => n + 1);
  }, []);

  return {
    checkpoint,
    checkpointEdit,
    undo,
    redo,
    clear,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}
