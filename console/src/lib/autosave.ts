/**
 * Debounced, retrying saves with a status (Xander, 2026-11-10: "whatever gets typed into any of
 * these fields should just be saved immediately", and a failed save is shown, never silent).
 *
 * This wraps the wizard's EXISTING writes (save-draft, save-brief); it adds no second path. It:
 *   - debounces: many changes in quick succession send once, with the latest value;
 *   - coalesces: a change during a send is sent right after it, never dropped or interleaved;
 *   - retries a failed send on a backoff, and reports the failure until one succeeds;
 *   - flushes on demand (tab close, `keepalive`), skipping the debounce.
 *
 * Before this the sends were fire-and-forget with `.catch(() => {})`: a failed server save left
 * nothing anywhere to see.
 */

export type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export interface SaveStatus {
  state: SaveState;
  /** The last failure's message, while state is 'error'. */
  error?: string;
  /** Failed attempts in a row. */
  failures: number;
}

export type Send<T> = (value: T, opts: { keepalive: boolean }) => Promise<void>;

export interface Timers {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (id: unknown) => void;
}

export interface Autosaver<T> {
  /** Queue a value; it is sent after `delayMs` of quiet. */
  schedule(value: T): void;
  /** Send the queued value now (tab close: `keepalive`). Resolves when that send settles. */
  flush(opts?: { keepalive?: boolean }): Promise<void>;
  /** Retry a failed save now instead of waiting for the backoff. */
  retry(): void;
  status(): SaveStatus;
  subscribe(fn: (s: SaveStatus) => void): () => void;
  dispose(): void;
}

export const RETRY_MS = [2000, 5000, 15000, 30000];

export function createAutosaver<T>(
  send: Send<T>,
  { delayMs = 700, retryMs = RETRY_MS, timers = globalThis as unknown as Timers }: { delayMs?: number; retryMs?: number[]; timers?: Timers } = {},
): Autosaver<T> {
  let queued: { value: T } | null = null;
  let timer: unknown = null;
  let inFlight: Promise<void> | null = null;
  let status: SaveStatus = { state: 'idle', failures: 0 };
  const subs = new Set<(s: SaveStatus) => void>();
  let disposed = false;

  const set = (s: SaveStatus) => {
    status = s;
    for (const fn of subs) fn(s);
  };
  const clear = () => {
    if (timer !== null) timers.clearTimeout(timer);
    timer = null;
  };
  const arm = (ms: number) => {
    clear();
    timer = timers.setTimeout(() => { timer = null; void run(false); }, ms);
  };

  async function run(keepalive: boolean): Promise<void> {
    if (disposed) return;
    if (inFlight) {
      // A send is running: the queued value goes as soon as it settles.
      await inFlight;
      if (queued) return run(keepalive);
      return;
    }
    if (!queued) return;
    const { value } = queued;
    queued = null;
    set({ state: 'saving', failures: status.failures });
    inFlight = (async () => {
      try {
        await send(value, { keepalive });
        set({ state: queued ? 'pending' : 'saved', failures: 0 });
      } catch (e) {
        // Put the failed value back unless a newer one is already queued.
        if (!queued) queued = { value };
        const failures = status.failures + 1;
        set({ state: 'error', error: e instanceof Error ? e.message : String(e), failures });
        if (!disposed) arm(retryMs[Math.min(failures - 1, retryMs.length - 1)]);
      } finally {
        inFlight = null;
      }
    })();
    await inFlight;
    if (queued && status.state !== 'error') return run(keepalive);
  }

  return {
    schedule(value) {
      if (disposed) return;
      queued = { value };
      // A failure keeps showing until a save succeeds; otherwise show the wait.
      if (status.state !== 'error') set({ state: 'pending', failures: status.failures });
      arm(status.state === 'error' ? retryMs[Math.min(status.failures - 1, retryMs.length - 1)] : delayMs);
    },
    flush({ keepalive = false } = {}) {
      clear();
      return run(keepalive);
    },
    retry() {
      clear();
      void run(false);
    },
    status: () => status,
    subscribe(fn) {
      subs.add(fn);
      return () => { subs.delete(fn); };
    },
    dispose() {
      disposed = true;
      clear();
      subs.clear();
    },
  };
}

/** The worse of several statuses, for one indicator over several saves. */
export function combineStatus(...all: SaveStatus[]): SaveStatus {
  const rank: Record<SaveState, number> = { error: 4, saving: 3, pending: 2, saved: 1, idle: 0 };
  return all.reduce((a, b) => (rank[b.state] > rank[a.state] ? b : a), { state: 'idle', failures: 0 } as SaveStatus);
}

/**
 * A send for one of the wizard's JSON endpoints. A non-2xx answer is a failure, not a success.
 * `keepalive` (tab close) caps the body at 64 KB in browsers; a bigger bundle then fails that one
 * send, and the copy already written to this browser's storage on the same change covers it.
 */
export function postJson<T>(url: string): Send<T> {
  return async (value, { keepalive }) => {
    const body = JSON.stringify(value);
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: keepalive && body.length < 60_000,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  };
}
