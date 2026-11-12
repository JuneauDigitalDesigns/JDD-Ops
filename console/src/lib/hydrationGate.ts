// Whether the state a component is rendering is the saved state it loaded, not its initial state.
import { useState } from 'react';

/**
 * A gate for effects that save state, opened only once the loaded state has RENDERED.
 *
 * BuildWizard loads a client's saved bundle in an effect (`applyBundle`, i.e. setState calls) and
 * saves the bundle in other effects on every change. A save must not run against the initial,
 * empty state, so it was guarded by a ref the load effect set to true. But a ref is not render
 * state: it flips the moment the load effect runs, while the loaded state only exists from the
 * NEXT render. Anything that re-runs the first render's effects then sees `true` beside the empty
 * state. React Strict Mode does exactly that on every mount under `next dev` (found 2026-11-11):
 *
 *   1. the save effect re-ran, saw `true`, wrote the initial state (`imported: null`, a fresh
 *      `savedAt`) to localStorage, and queued it for the server draft;
 *   2. the load effect re-ran, found that bundle in localStorage, and `newerBundle` preferred it
 *      over a fresh one built from the client's site.ts.
 *
 * So a client imported from the intake queue opened on the vertical preset's sample content, and
 * every later save carried `imported: null`. It never recovered on its own.
 *
 * This gate is state, set in the same batch as the loaded state, so it can only read open in a
 * render that is showing the loaded state. It is keyed: a gate opened for one client reads closed
 * for another, so a slug change can't save one client's state under the next one's key.
 *
 * Usage: `const [hydrated, markHydrated] = useHydrationGate(slug)`; call `markHydrated(slug)` in
 * the load effect beside the setState calls it gates, and guard each save effect on `hydrated`
 * (listing it in that effect's deps). test/hydration-gate.test.mjs runs this under Strict Mode.
 */
export function useHydrationGate(key: string): readonly [hydrated: boolean, markHydrated: (key: string) => void] {
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);
  return [hydratedFor === key, setHydratedFor] as const;
}
