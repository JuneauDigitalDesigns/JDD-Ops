import 'server-only';
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Every version of a client's agent prompt the console has ever written.
 *
 * Tuning an agent is a call → edit → push → call-again loop, and before this existed each push
 * destroyed the previous wording irrecoverably: `agent-prompt.txt` was overwritten in place and
 * Retell keeps no history of its own. Getting a regression back meant rewriting it from memory.
 *
 * Captured on EVERY save and EVERY push, so the disk edit you regret is as recoverable as the
 * live one. Content is stored inline rather than as separate files — a prompt is a few KB, and
 * one append-only file per site avoids both directory churn and a second thing to keep in step.
 *
 * Lives beside audit.ndjson in .state/ (gitignored via `**\/.state/`) and resolves the directory
 * the same way: process.cwd() is the console app dir.
 */
const STATE_DIR = resolve(process.cwd(), '.state');
const VERSIONS_DIR = resolve(STATE_DIR, 'prompt-versions');

/** Keep the tail bounded. Older versions past this are dropped on the next write. */
const KEEP = 60;

export type PromptTrigger = 'generated' | 'saved' | 'pushed';

export interface PromptVersion {
  id: string;
  ts: string;
  trigger: PromptTrigger;
  chars: number;
  content: string;
}
/** What the list endpoint returns — same shape minus the body. */
export type PromptVersionMeta = Omit<PromptVersion, 'content'> & { delta: number };

/** One file per site. Enterprise sites each tune their own agent, so they never share a log. */
function fileFor(slug: string, siteSlug: string): string {
  const safe = `${slug}__${siteSlug}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  return resolve(VERSIONS_DIR, `${safe}.ndjson`);
}

function readAll(slug: string, siteSlug: string): PromptVersion[] {
  try {
    const path = fileFor(slug, siteSlug);
    if (!existsSync(path)) return [];
    const out: PromptVersion[] = [];
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        out.push(JSON.parse(line) as PromptVersion);
      } catch {
        // Skip an unparseable line rather than losing the whole history to one bad write.
      }
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Append one version.
 *
 * Best-effort, like appendAudit: a failed history write must never fail the save or push it was
 * recording. Losing a history entry is a worse outcome than not having one, but it is far better
 * than refusing to update a live phone agent because a log file was busy.
 *
 * One entry per distinct prompt text, labelled with the furthest that text got. Pushing writes
 * the same string to disk and then to Retell, so a naive append would log it twice; instead the
 * existing entry is PROMOTED from `saved` to `pushed`. That keeps the timeline readable while
 * still answering the question the labels exist for — which versions the live agent actually
 * spoke — and it means a push whose Retell leg fails still leaves the text recoverable as a save.
 */
export function recordPromptVersion(args: {
  slug: string;
  siteSlug: string;
  trigger: PromptTrigger;
  content: string;
}): void {
  try {
    const existing = readAll(args.slug, args.siteSlug);
    const last = existing[existing.length - 1];
    if (last && last.content === args.content) {
      const promoting = args.trigger === 'pushed' && last.trigger !== 'pushed';
      if (!promoting) return;
      const promoted = [...existing.slice(0, -1), { ...last, trigger: 'pushed' as const, ts: new Date().toISOString() }];
      writeAll(args.slug, args.siteSlug, promoted);
      return;
    }

    mkdirSync(VERSIONS_DIR, { recursive: true });
    const entry: PromptVersion = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      ts: new Date().toISOString(),
      trigger: args.trigger,
      chars: args.content.length,
      content: args.content,
    };

    if (existing.length >= KEEP) {
      writeAll(args.slug, args.siteSlug, [...existing.slice(-(KEEP - 1)), entry]);
      return;
    }
    appendFileSync(fileFor(args.slug, args.siteSlug), `${JSON.stringify(entry)}\n`, 'utf8');
  } catch {
    // Intentionally silent — see the doc comment.
  }
}

/** Whole-file rewrite via tmp+rename, so a truncated write can't blank the history. */
function writeAll(slug: string, siteSlug: string, versions: PromptVersion[]): void {
  mkdirSync(VERSIONS_DIR, { recursive: true });
  const tmp = resolve(VERSIONS_DIR, `${process.pid}.tmp`);
  writeFileSync(tmp, `${versions.map((e) => JSON.stringify(e)).join('\n')}\n`, 'utf8');
  renameSync(tmp, fileFor(slug, siteSlug));
}

/**
 * Record what is already on disk as the baseline, if nothing has been recorded yet.
 *
 * Without this the FIRST edit through the console is the one change that can't be undone: the
 * generated prompt onboard.js wrote would be overwritten before any version of it was kept.
 */
export function ensureBaseline(args: { slug: string; siteSlug: string; diskContent: string }): void {
  if (!args.diskContent.trim()) return;
  if (readAll(args.slug, args.siteSlug).length > 0) return;
  recordPromptVersion({ ...args, trigger: 'generated', content: args.diskContent });
}

/** Newest first, without bodies. `delta` is the char change from the version before it. */
export function listPromptVersions(slug: string, siteSlug: string): PromptVersionMeta[] {
  const all = readAll(slug, siteSlug);
  return all
    .map((v, i) => ({
      id: v.id,
      ts: v.ts,
      trigger: v.trigger,
      chars: v.chars,
      delta: i === 0 ? 0 : v.chars - all[i - 1].chars,
    }))
    .reverse();
}

export function getPromptVersion(slug: string, siteSlug: string, id: string): PromptVersion | null {
  return readAll(slug, siteSlug).find((v) => v.id === id) ?? null;
}
