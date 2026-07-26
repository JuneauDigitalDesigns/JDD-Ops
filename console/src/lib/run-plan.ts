// The EXPECTED shape of a provisioning run, derived from a client's plan + site count.
//
// Why this exists: onboard-parse.ts builds phases *reactively* — a node only exists once its
// log marker has arrived. That's fine for a scrolling tracker but useless for a diagram, which
// has to show the whole pipeline up front (pending → running → done) so you can see what is
// about to happen and what got skipped. So we predict the run, then overlay the live state.
//
// ⚠ THIS FILE MIRRORS onboard.js's main loop (onboard.js:1338-1400). If you add, remove, or
// reorder a log(N, …) call in onboard.js, update expectedPhases() in the same commit. Labels
// come from PHASE_LABELS so a typo is a compile error, but ORDER and GATING are only correct
// if a human keeps them correct. The dry-run checkpoint across all three plans is the guard.

import {
  PHASE_LABELS,
  PREFLIGHT_KEY,
  phaseDisplayLabel,
  phaseKey,
  type PhaseLabel,
  type RunPhase,
  type RunState,
} from './onboard-parse';
import type { ClientContext } from './types';

/** One predicted phase, before any live status is known. */
export interface PlannedPhase extends RunPhase {
  /** Which site this phase belongs to (enterprise fan-out); undefined for run-level phases. */
  siteSlug?: string;
  /** Short human explanation of what this phase actually does — the diagram node's subtitle. */
  detail: string;
}

const DETAIL: Record<PhaseLabel, string> = {
  [PHASE_LABELS.preflight]: 'Check every required master credential before touching an API',
  [PHASE_LABELS.intake]: 'Load and validate clients/{slug}/site.ts',
  [PHASE_LABELS.repo]: 'Create the GitHub repo and wire the local repo folder',
  [PHASE_LABELS.siteContent]: 'Write src/data/site.ts into the client repo',
  [PHASE_LABELS.apiRoutes]: 'Write the onboard-owned /api/contact + /api/voice routes',
  [PHASE_LABELS.env]: 'Write clients/{slug}/.env.local',
  [PHASE_LABELS.build]: 'npm install + npm run build — fails loudly on a broken schema',
  [PHASE_LABELS.prompt]: 'Claude writes the agent prompt from the intake',
  [PHASE_LABELS.agent]: 'Create the per-client Retell LLM + agent',
  [PHASE_LABELS.number]: 'Buy a JDD Twilio number, point voiceUrl at /api/voice',
  [PHASE_LABELS.airtable]: 'Create the “{brand} — Calls” base with a Call Log table',
  [PHASE_LABELS.callLogging]: 'Clone the post-call Make scenario, set the Retell webhook',
  [PHASE_LABELS.push]: 'Commit and push the client repo',
  [PHASE_LABELS.vercel]: 'Create/link the Vercel project and sync env',
  [PHASE_LABELS.portal]: 'Create the Clerk portal account record',
};

function planned(
  label: PhaseLabel,
  siteTag: string,
  siteSlug?: string,
  status: PlannedPhase['status'] = 'pending',
): PlannedPhase {
  return {
    key: phaseKey(label, siteTag),
    label: phaseDisplayLabel(label, siteTag),
    status,
    siteSlug,
    detail: DETAIL[label],
  };
}

/**
 * The phases a run for this client SHOULD emit, in order.
 *
 * Gating mirrors onboard.js exactly:
 *  - starter skips AI prompt / Retell agent / phone number / Airtable / call logging (:1360)
 *  - the site tag is only emitted when sites.length > 1 (:1349), so single-site keys are bare
 *  - Airtable is created on the FIRST site only; enterprise sites 2+ reuse the shared base
 *    via a plain console.log, NOT a log(8, …) marker — so they get no Airtable phase (:1367-73)
 *
 * Note the one deliberate departure: the voice phases are still EMITTED for starter, pre-marked
 * 'skipped'. onboard.js will never report them, and every consumer treats 'skipped' as "this
 * will not happen" — but keeping them in the list means the pipeline diagram holds the same
 * shape on every plan. An operator seeing five greyed nodes learns where the tier line is; an
 * operator seeing a mysteriously shorter graph learns nothing.
 */
export function expectedPhases(ctx: ClientContext): PlannedPhase[] {
  const sites = ctx.sites.length ? ctx.sites : [null];
  const multi = sites.length > 1;
  const voice = ctx.plan !== 'starter';
  const voiceStatus = voice ? 'pending' : 'skipped';

  const out: PlannedPhase[] = [
    { ...planned(PHASE_LABELS.intake, ''), key: phaseKey(PHASE_LABELS.intake) },
    { ...planned(PHASE_LABELS.preflight, ''), key: PREFLIGHT_KEY },
  ];

  sites.forEach((site, i) => {
    const tag = multi ? `site ${i + 1}/${sites.length}` : '';
    const slug = site?.slug;
    out.push(
      planned(PHASE_LABELS.repo, tag, slug),
      planned(PHASE_LABELS.siteContent, tag, slug),
      planned(PHASE_LABELS.apiRoutes, tag, slug),
      planned(PHASE_LABELS.env, tag, slug),
      planned(PHASE_LABELS.build, tag, slug),
    );
    out.push(
      planned(PHASE_LABELS.prompt, tag, slug, voiceStatus),
      planned(PHASE_LABELS.agent, tag, slug, voiceStatus),
      planned(PHASE_LABELS.number, tag, slug, voiceStatus),
    );
    // Only site 1 creates the base; the rest inherit it without a step marker.
    if (i === 0) out.push(planned(PHASE_LABELS.airtable, tag, slug, voiceStatus));
    out.push(planned(PHASE_LABELS.callLogging, tag, slug, voiceStatus));
    out.push(planned(PHASE_LABELS.push, tag, slug), planned(PHASE_LABELS.vercel, tag, slug));
  });

  // Runs after the loop with CURRENT_SITE_LABEL cleared (:1397), so never site-tagged.
  out.push(planned(PHASE_LABELS.portal, ''));
  return out;
}

/**
 * Overlay a live run onto the plan.
 *
 * Rules:
 *  1. Plan order wins — the diagram's shape must not jump around mid-run.
 *  2. A planned phase the run has reported takes the run's status and duration.
 *  3. A phase the run reported but the plan didn't predict is appended with `unplanned` so
 *     PHASE_MAP drift is VISIBLE (rendered in coral) rather than silently swallowed.
 *  4. Once the run is `onboarded`, planned-but-never-seen phases are 'skipped', NOT 'done'.
 *     reduceRun force-marks everything it knows about as done on the ONBOARDED line
 *     (onboard-parse.ts:110) — but it can only mark what it saw, and claiming a node
 *     succeeded when no log line ever mentioned it is exactly the lie this guards against.
 */
export function mergeRun(expected: PlannedPhase[], run: RunState | null): PlannedPhase[] {
  if (!run) return expected;

  const live = new Map(run.phases.map((p) => [p.key, p]));
  const merged = expected.map((p): PlannedPhase => {
    const hit = live.get(p.key);
    if (hit) return { ...p, status: hit.status, ms: hit.ms };
    if (run.onboarded) return { ...p, status: 'skipped' };
    return p;
  });

  const plannedKeys = new Set(expected.map((p) => p.key));
  for (const p of run.phases) {
    if (plannedKeys.has(p.key)) continue;
    merged.push({ ...p, unplanned: true, detail: 'Not predicted by run-plan.ts — onboard.js may have changed' });
  }
  return merged;
}

/**
 * Status for the pipeline diagram when NO run is active — derived from what's already on disk.
 * Lets the diagram be meaningful before you ever press Provision.
 */
export function restingPhases(ctx: ClientContext): PlannedPhase[] {
  return expectedPhases(ctx).map((p): PlannedPhase => {
    const site = p.siteSlug ? ctx.sites.find((s) => s.slug === p.siteSlug) : ctx.sites[0];
    const env = site?.env ?? {};
    const built = site?.repoBuilt ?? ctx.repoBuilt;

    let done = false;
    switch (p.label.split(' · ')[0] as PhaseLabel) {
      case PHASE_LABELS.intake: done = ctx.hasIntake; break;
      case PHASE_LABELS.repo:
      case PHASE_LABELS.siteContent:
      case PHASE_LABELS.apiRoutes:
      case PHASE_LABELS.build:
      case PHASE_LABELS.push: done = built; break;
      case PHASE_LABELS.env: done = Object.keys(env).length > 0; break;
      case PHASE_LABELS.agent:
      case PHASE_LABELS.prompt: done = !!env.RETELL_AGENT_ID; break;
      case PHASE_LABELS.number: done = !!env.TWILIO_NUMBER; break;
      case PHASE_LABELS.airtable: done = !!env.AIRTABLE_BASE_ID; break;
      case PHASE_LABELS.callLogging: done = !!env.RETELL_POST_CALL_WEBHOOK_URL; break;
      case PHASE_LABELS.vercel: done = !!env.VERCEL_PROJECT_NAME; break;
      // Pre-flight leaves no artifact, and the portal record lives in KV, not on disk —
      // neither is knowable from clients/, so both stay pending until a run reports them.
      default: done = false;
    }
    // Fall back to the planned status rather than 'pending' — that preserves the 'skipped'
    // that expectedPhases() pre-marks on starter's voice nodes.
    return { ...p, status: done ? 'done' : p.status };
  });
}

const VOICE_LABELS: PhaseLabel[] = [
  PHASE_LABELS.prompt,
  PHASE_LABELS.agent,
  PHASE_LABELS.number,
  PHASE_LABELS.airtable,
  PHASE_LABELS.callLogging,
];

export function isVoicePhase(p: Pick<PlannedPhase, 'label'>): boolean {
  return VOICE_LABELS.includes(p.label.split(' · ')[0] as PhaseLabel);
}
