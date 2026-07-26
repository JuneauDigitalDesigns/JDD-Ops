import 'server-only';
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * A durable record of every write /manage makes — env saves, Vercel syncs, redeploys,
 * portal attaches, agent-prompt pushes.
 *
 * The console has no auth of any kind, so this is the only thing that can answer "what
 * did I change on this client, and when?" after the fact. /manage → Overview renders the
 * last few entries as Recent activity.
 *
 * Lives beside progress.json in .state/ (gitignored via `**\/.state/`), and resolves the
 * directory the same way state.ts does — process.cwd() is the console app dir.
 */
const STATE_DIR = resolve(process.cwd(), '.state');
const AUDIT_FILE = resolve(STATE_DIR, 'audit.ndjson');

/** Keep the tail bounded; rotation drops the oldest entries past this. */
const MAX_BYTES = 1_000_000;
const KEEP_LINES = 2000;

export type AuditAction =
  | 'env.save'
  | 'env.sync'
  | 'env.pull'
  | 'deploy.trigger'
  | 'portal.attach'
  | 'agent.prompt.save'
  | 'agent.prompt.push';

export interface AuditEntry {
  /** ISO timestamp. */
  ts: string;
  /** Base client slug (the clients/{slug} folder). */
  slug: string;
  /** Provisioning slug of the specific site, for enterprise clients. */
  siteSlug?: string;
  action: AuditAction;
  ok: boolean;
  /** One line, already human-readable — the activity feed renders this verbatim. */
  summary: string;
  /**
   * Structured extras. Key NAMES only, never values: this file is plaintext on disk
   * and an env value here would defeat the point of masking them in the UI.
   */
  detail?: Record<string, unknown>;
}

/**
 * Append one entry. Best-effort by design — a failed audit write must never fail the
 * operation it was recording, so every error is swallowed.
 *
 * Deliberately a plain O_APPEND write rather than state.ts's tmp+rename dance: that
 * pattern protects a whole-file rewrite from truncation, whereas a single-line append
 * from one process is already the safer primitive.
 */
export function appendAudit(entry: Omit<AuditEntry, 'ts'> & { ts?: string }): void {
  try {
    mkdirSync(STATE_DIR, { recursive: true });
    rotateIfLarge();
    const line = JSON.stringify({ ts: new Date().toISOString(), ...entry });
    appendFileSync(AUDIT_FILE, `${line}\n`, 'utf8');
  } catch {
    // Intentionally silent — see the doc comment.
  }
}

/** Trim to the most recent KEEP_LINES once the file grows past MAX_BYTES. */
function rotateIfLarge(): void {
  try {
    if (!existsSync(AUDIT_FILE) || statSync(AUDIT_FILE).size <= MAX_BYTES) return;
    const kept = readFileSync(AUDIT_FILE, 'utf8').split('\n').filter(Boolean).slice(-KEEP_LINES);
    const tmp = resolve(STATE_DIR, `audit.${process.pid}.tmp`);
    writeFileSync(tmp, `${kept.join('\n')}\n`, 'utf8');
    renameSync(tmp, AUDIT_FILE);
  } catch {
    // A failed rotation just means the file stays long.
  }
}

/**
 * Read entries newest-first, optionally for one client. Tolerates malformed lines so a
 * single truncated write can't blank the whole feed.
 */
export function readAudit({ slug, limit = 20 }: { slug?: string; limit?: number } = {}): AuditEntry[] {
  try {
    if (!existsSync(AUDIT_FILE)) return [];
    const out: AuditEntry[] = [];
    for (const line of readFileSync(AUDIT_FILE, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line) as AuditEntry;
        if (!slug || entry.slug === slug) out.push(entry);
      } catch {
        // Skip an unparseable line rather than failing the read.
      }
    }
    return out.reverse().slice(0, limit);
  } catch {
    return [];
  }
}
