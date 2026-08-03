import 'server-only';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  appendFileSync,
  readdirSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { clientsDir } from './paths';
import type { Plan } from './types';

/**
 * The durable record of a torn-down client — everything a teardown captures before it
 * destroys anything, plus what happened during the run.
 *
 * Lives at clients/.archive/, dot-prefixed rather than underscore: both directory
 * enumerators in this codebase (clients.ts, export.ts) already skip dotfiles
 * unconditionally, whereas an underscore-prefixed folder would render as a broken client
 * card the moment "Show fixtures" is toggled on the root picker — getClientContext returns
 * a stub for any folder that merely exists. Gitignored like every other client folder
 * (`/clients/*`); this is the same trust model as live client data, not a stronger one.
 *
 *   clients/.archive/
 *     index.ndjson                       one line per teardown, newest appended last
 *     {slug}/{timestamp}/
 *       record.json                      the ArchiveRecord below
 *       site.ts                          verbatim intake snapshot
 *       agent-prompt.txt                 if the client had one
 *       env.local.txt                    verbatim, one section per site
 *       run.log                          the full streamed log
 */

function archiveRoot(): string {
  return resolve(clientsDir(), '.archive');
}

export type ArchiveStatus = 'in-progress' | 'partial' | 'complete';

export interface ArchiveSiteIdentifiers {
  siteSlug: string;
  vercelProjectId: string | null;
  vercelProjectName: string | null;
  githubRepo: string | null;
  liveUrl: string | null;
  domains: Array<{ name: string; verified: boolean; redirect: string | null; apexName: string | null }>;
  twilioNumber: string | null;
  twilioSid: string | null;
  retellAgentId: string | null;
  retellLlmId: string | null;
  makeScenarioId: string | null;
  makeWebhookUrl: string | null;
  airtableSiteTag: string | null;
}

export interface ArchiveIdentifiers {
  portalEmail: string | null;
  clerkUserId: string | null;
  clerkResolvedBy: 'env' | 'email' | null;
  airtableBaseId: string | null;
  airtableBaseName: string | null;
  sites: ArchiveSiteIdentifiers[];
}

export interface ArchiveIntake {
  schemaPath: string;
  /** Verbatim site.ts source, so the record is self-contained even if archive.ts changes shape. */
  source: string;
  /** The parsed intake envelope — plan + sites — for anything that wants structured access. */
  parsed: unknown;
  /** Every site's .env.local, keyed by site slug. */
  envBySite: Record<string, Record<string, string>>;
  agentPrompt: string | null;
}

export type StepOutcome = 'deleted' | 'already-gone' | 'skipped' | 'failed';

export interface ArchiveStep {
  order: number;
  resource: string;
  target: string;
  outcome: StepOutcome;
  httpStatus?: number;
  message?: string;
  at: string;
  durationMs: number;
}

export interface ArchiveOrphan {
  kind: string;
  detail: string;
  action?: string;
}

export interface ArchiveRecord {
  schemaVersion: 1;
  id: string;
  slug: string;
  brandName: string;
  plan: Plan;
  isEnterprise: boolean;
  archivedAt: string;
  reason: string;
  status: ArchiveStatus;
  /** True once a `partial` run's remaining steps can be resumed against this same record. */
  resumable: boolean;
  previewHash: string;
  identifiers: ArchiveIdentifiers;
  intake: ArchiveIntake;
  receipt: { startedAt: string; finishedAt: string | null; steps: ArchiveStep[] };
  orphans: ArchiveOrphan[];
}

/** One line of the index — enough to list without opening every record. */
export interface ArchiveIndexEntry {
  id: string;
  slug: string;
  brandName: string;
  plan: Plan;
  archivedAt: string;
  status: ArchiveStatus;
}

const TIMESTAMP_RE = /^\d{8}-\d{6}$/;
/** Slugs never contain this — SLUG_RE is [A-Za-z0-9_-]+ and nothing generates a double hyphen. */
const ID_SEP = '--';

export function makeTimestamp(now: Date = new Date()): string {
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return (
    `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-` +
    `${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`
  );
}

export function makeArchiveId(slug: string, timestamp: string): string {
  return `${slug}${ID_SEP}${timestamp}`;
}

/** Split an id back into slug + timestamp. Rejects anything that doesn't round-trip cleanly. */
export function parseArchiveId(id: string): { slug: string; timestamp: string } | null {
  const i = id.lastIndexOf(ID_SEP);
  if (i === -1) return null;
  const slug = id.slice(0, i);
  const timestamp = id.slice(i + ID_SEP.length);
  if (!slug || !TIMESTAMP_RE.test(timestamp)) return null;
  return { slug, timestamp };
}

/** clients/.archive/{slug}/{timestamp} — validated to stay inside archiveRoot(). */
function recordDir(slug: string, timestamp: string): string {
  const dir = resolve(archiveRoot(), slug, timestamp);
  if (!dir.startsWith(archiveRoot())) throw new Error('Invalid archive id.');
  return dir;
}

/**
 * Create the record directory and write record.json for the first time.
 * Called at the start of phase 0, before anything is destroyed — its existence on disk is
 * what makes the intake snapshot recoverable if the run fails before completing.
 */
export function createArchiveRecord(record: ArchiveRecord): void {
  const { slug, timestamp } = parseArchiveId(record.id) ?? {};
  if (!slug || !timestamp) throw new Error(`Invalid archive id: ${record.id}`);
  mkdirSync(recordDir(slug, timestamp), { recursive: true });
  writeArchiveRecord(record);
}

/** Overwrite record.json — used as each phase completes and to finalize at the end. */
export function writeArchiveRecord(record: ArchiveRecord): void {
  const parsed = parseArchiveId(record.id);
  if (!parsed) throw new Error(`Invalid archive id: ${record.id}`);
  const dir = recordDir(parsed.slug, parsed.timestamp);
  mkdirSync(dir, { recursive: true });
  const tmp = resolve(dir, `record.${process.pid}.tmp`);
  writeFileSync(tmp, JSON.stringify(record, null, 2), 'utf8');
  renameSync(tmp, resolve(dir, 'record.json'));
}

export function readArchiveRecord(id: string): ArchiveRecord | null {
  const parsed = parseArchiveId(id);
  if (!parsed) return null;
  try {
    const path = resolve(recordDir(parsed.slug, parsed.timestamp), 'record.json');
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf8')) as ArchiveRecord;
  } catch {
    return null;
  }
}

/** Write one of the verbatim capture files (site.ts, env.local.txt, agent-prompt.txt, run.log). */
export function writeArchiveFile(id: string, filename: string, content: string): void {
  const parsed = parseArchiveId(id);
  if (!parsed) throw new Error(`Invalid archive id: ${id}`);
  const dir = recordDir(parsed.slug, parsed.timestamp);
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, filename), content, 'utf8');
}

export function appendArchiveRunLog(id: string, line: string): void {
  const parsed = parseArchiveId(id);
  if (!parsed) return;
  try {
    appendFileSync(resolve(recordDir(parsed.slug, parsed.timestamp), 'run.log'), `${line}\n`, 'utf8');
  } catch {
    // The run.log is a convenience copy of what already streamed to the browser — never
    // let a disk hiccup here fail the teardown itself.
  }
}

/** Any client with an in-progress or partial record — used to offer Resume instead of a fresh run. */
export function findUnfinishedArchive(slug: string): ArchiveRecord | null {
  const dir = resolve(archiveRoot(), slug);
  if (!existsSync(dir)) return null;
  try {
    const timestamps = readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && TIMESTAMP_RE.test(d.name))
      .map((d) => d.name)
      .sort()
      .reverse();
    for (const ts of timestamps) {
      const record = readArchiveRecord(makeArchiveId(slug, ts));
      if (record && record.status !== 'complete') return record;
    }
    return null;
  } catch {
    return null;
  }
}

/* ── Index — the list view reads this instead of walking every record ───────── */

const INDEX_FILE = () => resolve(archiveRoot(), 'index.ndjson');

export function appendArchiveIndex(entry: ArchiveIndexEntry): void {
  try {
    mkdirSync(archiveRoot(), { recursive: true });
    appendFileSync(INDEX_FILE(), `${JSON.stringify(entry)}\n`, 'utf8');
  } catch {
    // Best-effort, like audit.ts — the record.json on disk is the source of truth;
    // the index is a convenience for the list view.
  }
}

/**
 * Update the index line for an id (status changed since it was first appended) by
 * rewriting the file. Rare enough (once per teardown, at most a few times) that a full
 * rewrite is simpler than an in-place patch, and safer than corrupting the file mid-line.
 */
export function updateArchiveIndex(entry: ArchiveIndexEntry): void {
  const all = readArchiveIndex({ limit: Number.MAX_SAFE_INTEGER });
  const next = all.filter((e) => e.id !== entry.id);
  next.push(entry);
  try {
    mkdirSync(archiveRoot(), { recursive: true });
    const tmp = resolve(archiveRoot(), `index.${process.pid}.tmp`);
    writeFileSync(tmp, next.map((e) => JSON.stringify(e)).join('\n') + (next.length ? '\n' : ''), 'utf8');
    renameSync(tmp, INDEX_FILE());
  } catch {
    // Leave the stale line in place rather than losing the index entirely.
  }
}

/** Newest-first, tolerant of malformed lines — same style as audit.ts's readAudit. */
export function readArchiveIndex({ limit = 100 }: { limit?: number } = {}): ArchiveIndexEntry[] {
  try {
    if (!existsSync(INDEX_FILE())) return [];
    const out: ArchiveIndexEntry[] = [];
    for (const line of readFileSync(INDEX_FILE(), 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        out.push(JSON.parse(line) as ArchiveIndexEntry);
      } catch {
        // Skip an unparseable line rather than failing the whole read.
      }
    }
    return out.reverse().slice(0, limit);
  } catch {
    return [];
  }
}
