import 'server-only';
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

/**
 * Reversal payloads for the one-click repairs.
 *
 * A separate file from audit.ndjson, and the separation is the point. The audit log's rule
 * is **key names, never values** — it is plaintext on disk, and putting an env value in it
 * would defeat masking them in the UI. But an undo has to hold the previous value or it
 * cannot restore anything. Those two requirements are irreconcilable in one file, so:
 *
 *   audit.ndjson   what happened. Its `detail` is key names only, and it never records a
 *                  PREVIOUS value or a secret. The `summary` is prose and does name the
 *                  value being set — that is what makes the activity feed readable, and a
 *                  webhook URL we just wrote is not a credential.
 *   undo.ndjson    how to reverse it. Holds the previous value by necessity, short-lived,
 *                  gitignored, never rendered in a feed.
 *
 * Both are written for every repair. The audit entry is the durable record; the undo entry
 * is the escape hatch, and it expiring is fine — an undo you didn't take within the week is
 * one you decided against.
 *
 * `.state/` is already gitignored via `**\/.state/`, so this file never leaves the machine.
 */

const STATE_DIR = resolve(process.cwd(), '.state');
const UNDO_FILE = resolve(STATE_DIR, 'undo.ndjson');

const MAX_BYTES = 2_000_000;
const KEEP_ENTRIES = 500;

/** Entries older than this are pruned on write; an undo has a natural shelf life. */
const TTL_MS = 14 * 24 * 60 * 60 * 1000;

export type UndoKind =
  | 'twilio.voiceUrl'
  | 'twilio.smsUrl'
  | 'retell.webhook'
  | 'retell.agentConfig'
  | 'make.scenarioState'
  | 'env.value';

export interface UndoEntry {
  id: string;
  ts: string;
  slug: string;
  siteSlug: string;
  kind: UndoKind;
  /** Human-readable, rendered on the undo button. */
  summary: string;
  /**
   * What it was, and what we set it to. `before` is what an undo restores.
   *
   * `null` means the field was genuinely unset, and restoring it means clearing it — as
   * distinct from `undefined`/absent, which would mean we never captured it and therefore
   * cannot safely undo. patchSite() draws the same distinction for the same reason.
   */
  before: unknown;
  after: unknown;
  /** Set once an undo has been applied, so the UI stops offering it twice. */
  undoneAt?: string;
}

function readAll(): UndoEntry[] {
  try {
    if (!existsSync(UNDO_FILE)) return [];
    const out: UndoEntry[] = [];
    for (const line of readFileSync(UNDO_FILE, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        out.push(JSON.parse(line) as UndoEntry);
      } catch {
        // Skip an unparseable line rather than failing the whole read.
      }
    }
    return out;
  } catch {
    return [];
  }
}

function writeAll(entries: UndoEntry[]): void {
  mkdirSync(STATE_DIR, { recursive: true });
  const tmp = resolve(STATE_DIR, `undo.${process.pid}.tmp`);
  writeFileSync(tmp, entries.map((e) => JSON.stringify(e)).join('\n') + (entries.length ? '\n' : ''), 'utf8');
  renameSync(tmp, UNDO_FILE);
}

/**
 * Record how to reverse a repair, and return the id the UI needs to offer it.
 *
 * Unlike appendAudit this is NOT best-effort: a caller that cannot record an undo should
 * know before it mutates a vendor, because the alternative is an irreversible change that
 * the UI will nonetheless present as reversible.
 */
export function recordUndo(entry: Omit<UndoEntry, 'id' | 'ts'>): string {
  mkdirSync(STATE_DIR, { recursive: true });
  pruneIfNeeded();
  const id = `u_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const line = JSON.stringify({ id, ts: new Date().toISOString(), ...entry });
  appendFileSync(UNDO_FILE, `${line}\n`, 'utf8');
  return id;
}

/** Newest-first, excluding entries already undone and anything past its TTL. */
export function listUndo({ slug, limit = 20 }: { slug?: string; limit?: number } = {}): UndoEntry[] {
  const cutoff = Date.now() - TTL_MS;
  return readAll()
    .filter((e) => !e.undoneAt)
    .filter((e) => Date.parse(e.ts) >= cutoff)
    .filter((e) => !slug || e.slug === slug)
    .reverse()
    .slice(0, limit);
}

export function getUndo(id: string): UndoEntry | null {
  return readAll().find((e) => e.id === id) ?? null;
}

/**
 * Mark an undo as spent.
 *
 * Called AFTER the reversal succeeds, never before — marking first and then failing would
 * remove the only record of how to get back, which is the one thing this file exists to
 * prevent.
 */
export function markUndone(id: string): boolean {
  const all = readAll();
  const idx = all.findIndex((e) => e.id === id);
  if (idx === -1 || all[idx].undoneAt) return false;
  all[idx] = { ...all[idx], undoneAt: new Date().toISOString() };
  writeAll(all);
  return true;
}

/** Drop expired and excess entries. Runs on write, so the file self-limits. */
function pruneIfNeeded(): void {
  try {
    if (!existsSync(UNDO_FILE)) return;
    const tooBig = statSync(UNDO_FILE).size > MAX_BYTES;
    const cutoff = Date.now() - TTL_MS;
    const all = readAll();
    const fresh = all.filter((e) => Date.parse(e.ts) >= cutoff);
    if (!tooBig && fresh.length === all.length) return;
    writeAll(fresh.slice(-KEEP_ENTRIES));
  } catch {
    // A failed prune just means the file stays long; never block the write.
  }
}
