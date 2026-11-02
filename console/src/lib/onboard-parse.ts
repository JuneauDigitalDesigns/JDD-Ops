// Pure, streaming parser for onboard.js stdout → a structured run model the /onboard UI renders
// (step tracker + outcome card). Fed one raw line at a time as the NDJSON `log` events arrive.
//
// Why parse the message, not the [step N/10] number: onboard.js prints a CONSTANT /10 denominator,
// repeats step numbers (step 3 ×2, step 8 ×5), and — for enterprise — loops steps 2–9 once per
// site with a ` site i/N` tag. The number is neither unique nor monotonic, so phases are keyed on
// the message text via PHASE_MAP and built dynamically as markers arrive.

export type PhaseStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

export interface RunPhase {
  key: string; // stable identity (label + optional site tag) for dedupe/reuse
  label: string; // display label, e.g. "Phone number" or "Phone number · site 2/3"
  status: PhaseStatus;
  ms?: number; // duration once the phase leaves `running`
  /** Set by mergeRun(): the run emitted a phase the plan didn't predict (PHASE_MAP drift). */
  unplanned?: boolean;
}

/**
 * The canonical short label for every phase onboard.js can emit. Referenced by both PHASE_MAP
 * below (parse side) and run-plan.ts's expectedPhases() (plan side) so the two can never drift
 * on a typo — a bad name is a compile error, not a diagram node that silently never lights up.
 */
export const PHASE_LABELS = {
  preflight: 'Pre-flight',
  intake: 'Intake',
  repo: 'GitHub repo',
  siteContent: 'Write site content',
  apiRoutes: 'API routes',
  env: 'Env vars',
  build: 'Install & build',
  prompt: 'AI prompt',
  agent: 'Retell agent',
  number: 'Phone number',
  airtable: 'Airtable base',
  callLogging: 'Call logging',
  publishNumber: 'Publish number',
  checks: 'Correctness checks',
  push: 'Push repo',
  vercel: 'Vercel deploy',
  deploy: 'Preview deploy',
  portal: 'Portal',
  testLogin: 'Portal test login',
} as const;

export type PhaseLabel = (typeof PHASE_LABELS)[keyof typeof PHASE_LABELS];

/** Pre-flight is the one phase not keyed on its label (it has no [step N/10] marker). */
export const PREFLIGHT_KEY = 'preflight';

/**
 * The key the parser assigns a phase, given its label and the site tag from the step marker.
 * run-plan.ts MUST build its expected keys through this same function — a mismatch here means
 * live status silently fails to bind onto a planned node.
 */
export function phaseKey(label: string, siteTag = ''): string {
  return siteTag ? `${label}::${siteTag}` : label;
}

/** Display label for a phase, matching the parser's `${base} · ${siteTag}` form. */
export function phaseDisplayLabel(label: string, siteTag = ''): string {
  return siteTag ? `${label} · ${siteTag}` : label;
}

export interface RunSite {
  label: string;
  repo?: string;
  agent?: string;
  number?: string;
  accent?: string;
  missing?: string[];
}

export interface RunState {
  phases: RunPhase[];
  sites: RunSite[];
  sharedBase?: string;
  portal?: string;
  vercelProject?: string;
  /** The preview deployment URL onboard.js reports (step 9), for the live deploy-status readout. */
  previewUrl?: string;
  /** The preview deployment's readyState as last seen in the log (e.g. 'building', 'ready'). */
  deployStatus?: string;
  dryRun: boolean;
  onboarded: boolean; // saw the ONBOARDED summary — the terminal success signal
  failed?: { label: string; message: string };
  log: string[]; // every raw line, for the demoted drawer
  // internals (not for rendering)
  _running?: string;
  _runningAt?: number;
  _inSummary: boolean;
}

export function initRunState(): RunState {
  return { phases: [], sites: [], dryRun: false, onboarded: false, log: [], _inSummary: false };
}

// step marker: `[step 3] msg`, `[step 3/10] msg` (legacy denominator), or enterprise
// `[step 8 site 2/3] msg`. The denominator is optional — onboard.js dropped the fixed `/10`
// (it was never accurate) but older logs may still carry it. Group indices are preserved either
// way: [1]=N, [2]=denominator (ignored), [3]=site i, [4]=site N, [5]=message.
const STEP_RE = /^\[step (\d+)(?:\/(\d+))?(?: site (\d+)\/(\d+))?\]\s*(.*)$/;
const PREFLIGHT_RE = /^\[pre-flight\]\s*(.*)$/;
const VERCEL_RE = /Sync env to Vercel project "([^"]+)"/;
// `Preview deploy → https://… (building)` — capture the URL and the readyState onboard.js reports.
const PREVIEW_RE = /Preview deploy → (\S+)(?:\s*\(([^)]+)\))?/;

// Message → short semantic label. First match wins; order mirrors the real run.
const PHASE_MAP: Array<{ re: RegExp; label: PhaseLabel }> = [
  { re: /Intake loaded/i, label: PHASE_LABELS.intake },
  { re: /Create empty GitHub repo/i, label: PHASE_LABELS.repo },
  { re: /Write src\/data\/site\.ts/i, label: PHASE_LABELS.siteContent },
  { re: /infrastructure API routes/i, label: PHASE_LABELS.apiRoutes },
  { re: /Write \.env\.local/i, label: PHASE_LABELS.env },
  { re: /npm install/i, label: PHASE_LABELS.build },
  { re: /Retell agent prompt/i, label: PHASE_LABELS.prompt },
  { re: /Create Retell AI agent/i, label: PHASE_LABELS.agent },
  // Must stay AHEAD of /Twilio number/i. onboard.js's publish step used to read "Publish
  // Twilio number on the site", which this map happily folded into the purchase phase — so the
  // UI showed "Phone number" going running→done→running→done and the publish step had no node
  // of its own. The message was renamed to "Publish number on the site"; this entry is the
  // belt to that braces.
  { re: /Publish number/i, label: PHASE_LABELS.publishNumber },
  { re: /Twilio number/i, label: PHASE_LABELS.number },
  { re: /Airtable base/i, label: PHASE_LABELS.airtable },
  { re: /Make scenario/i, label: PHASE_LABELS.callLogging },
  { re: /Correctness checks/i, label: PHASE_LABELS.checks },
  { re: /Commit \+ push/i, label: PHASE_LABELS.push },
  { re: /Sync env to Vercel/i, label: PHASE_LABELS.vercel },
  { re: /Preview deploy/i, label: PHASE_LABELS.deploy },
  { re: /Link portal account/i, label: PHASE_LABELS.portal },
  // onboard.js has always emitted a second portal step (`log(10, 'Portal test login')`) that
  // no entry here matched, so it fell through to labelFor's raw-message fallback and rendered
  // as an `unplanned` node on every single run. Found by the phase-contract test.
  { re: /Portal test login/i, label: PHASE_LABELS.testLogin },
];

function labelFor(message: string): string {
  return PHASE_MAP.find((p) => p.re.test(message))?.label ?? message.trim();
}

// Close the currently-running phase with a terminal status + duration.
function closeRunning(phases: RunPhase[], key: string | undefined, at: number, runningAt: number | undefined, status: PhaseStatus): RunPhase[] {
  if (!key) return phases;
  return phases.map((p) =>
    p.key === key && p.status === 'running'
      ? { ...p, status, ms: runningAt != null ? Math.max(0, Math.round(at - runningAt)) : p.ms }
      : p,
  );
}

/** Fold one raw stdout line into the run state (immutable). `at` is injectable for tests. */
export function reduceRun(prev: RunState, rawLine: string, at: number = Date.now()): RunState {
  const line = rawLine.replace(/\r$/, '');
  const trimmed = line.trim();
  const s: RunState = { ...prev, log: [...prev.log, line] };
  if (!trimmed) return s;

  // ── Dry-run banner ───────────────────────────────────────────────────────
  if (/^=== DRY RUN MODE/.test(trimmed)) return { ...s, dryRun: true };
  if (/^=== DRY RUN COMPLETE/.test(trimmed)) return s;

  // ── Fatal failure: `[step N/10] FAIL: msg` (or `[step 0/10] FAIL:` for global). ──
  const failIdx = trimmed.indexOf('FAIL:');
  if (failIdx !== -1) {
    const message = trimmed.slice(failIdx + 'FAIL:'.length).trim();
    const runningLabel = s.phases.find((p) => p.key === s._running)?.label ?? 'Provisioning';
    return {
      ...s,
      phases: closeRunning(s.phases, s._running, at, s._runningAt, 'failed'),
      failed: { label: runningLabel, message: message || 'onboard.js failed.' },
      _running: undefined,
    };
  }

  // ── ONBOARDED summary → terminal success; mark all seen phases done. ──
  if (/^ONBOARDED:/.test(trimmed)) {
    const phases = s.phases.map((p) => (p.status === 'pending' || p.status === 'running' ? { ...p, status: 'done' as const } : p));
    return { ...s, phases, onboarded: true, _inSummary: true, _running: undefined };
  }

  // ── Summary body (only after ONBOARDED) ──
  if (s._inSummary) {
    let m: RegExpMatchArray | null;
    // Labels are alignment-padded to different widths (Twilio number has just 1 space), so match
    // the fixed label then \s+.
    if ((m = trimmed.match(/^Site \d+\/\d+:\s*(.+)$/))) return { ...s, sites: [...s.sites, { label: m[1].trim() }] };
    if ((m = trimmed.match(/^Repo\s+(.+)$/))) return patchSite(s, { repo: m[1].trim() });
    if ((m = trimmed.match(/^Retell agent\s+(.+)$/))) return patchSite(s, { agent: m[1].trim() });
    if ((m = trimmed.match(/^Twilio number\s+(.+)$/))) return patchSite(s, { number: m[1].trim() });
    if ((m = trimmed.match(/^Accent\s+(.+)$/))) return patchSite(s, { accent: m[1].trim() });
    if ((m = trimmed.match(/^⚠?\s*Missing:\s*(.+)$/))) return patchSite(s, { missing: m[1].split(',').map((x) => x.trim()).filter(Boolean) });
    if ((m = trimmed.match(/^Airtable base \(shared\):\s*(.+)$/))) return { ...s, sharedBase: m[1].trim() };
    if ((m = trimmed.match(/^Portal:\s*(\S+)/))) return { ...s, portal: m[1].trim() };
    // fall through — other summary lines (Plan:, Next:, rules) are ignored
  }

  // ── Pre-flight phase ──
  const pf = trimmed.match(PREFLIGHT_RE);
  if (pf) return openPhase(s, PREFLIGHT_KEY, PHASE_LABELS.preflight, at);
  if (/^✓ Pre-flight passed/.test(trimmed)) {
    return { ...s, phases: closeRunning(s.phases, s._running, at, s._runningAt, 'done'), _running: undefined };
  }

  // ── Step marker → open/advance a phase ──
  const step = line.match(STEP_RE);
  if (step) {
    const message = step[5] ?? '';
    const siteTag = step[3] && step[4] ? `site ${step[3]}/${step[4]}` : '';
    const base = labelFor(message);
    const key = phaseKey(base, siteTag);
    const label = phaseDisplayLabel(base, siteTag);
    const vercel = message.match(VERCEL_RE)?.[1];
    let next = vercel ? { ...s, vercelProject: vercel } : s;
    const preview = message.match(PREVIEW_RE);
    if (preview) {
      const url = /^https?:\/\//.test(preview[1]) ? preview[1] : undefined;
      next = { ...next, previewUrl: url ?? next.previewUrl, deployStatus: preview[2] ?? next.deployStatus };
    }
    return openPhase(next, key, label, at);
  }

  return s;
}

function patchSite(s: RunState, patch: Partial<RunSite>): RunState {
  if (s.sites.length === 0) return { ...s, sites: [{ label: 'Site', ...patch }] };
  const sites = s.sites.slice();
  sites[sites.length - 1] = { ...sites[sites.length - 1], ...patch };
  return { ...s, sites };
}

function openPhase(s: RunState, key: string, label: string, at: number): RunState {
  const phases = closeRunning(s.phases, s._running, at, s._runningAt, 'done');
  const exists = phases.some((p) => p.key === key);
  const next = exists
    ? phases.map((p) => (p.key === key ? { ...p, status: 'running' as const } : p))
    : [...phases, { key, label, status: 'running' as const }];
  return { ...s, phases: next, _running: key, _runningAt: at };
}

/** Convenience for tests: fold an array of lines. */
export function parseRun(lines: string[]): RunState {
  let s = initRunState();
  let t = 0;
  for (const l of lines) s = reduceRun(s, l, (t += 100));
  return s;
}
