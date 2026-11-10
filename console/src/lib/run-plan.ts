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
  [PHASE_LABELS.publishNumber]: 'Put the Twilio number on the site, keeping the owner’s line as the forward target',
  [PHASE_LABELS.checks]: 'Assert the run is correct — tier matrix, published number, Airtable field mapping',
  [PHASE_LABELS.push]: 'Commit and push the client repo',
  [PHASE_LABELS.vercel]: 'Create/link the Vercel project and sync env',
  [PHASE_LABELS.deploy]: 'Trigger a preview deployment — review it, then promote in the Vercel dashboard',
  [PHASE_LABELS.portal]: 'Create the Clerk portal account record',
  [PHASE_LABELS.testLogin]: 'Look up the Clerk test login for the portal (never sets a password)',
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
 *  - a WEB-ONLY client (Starter + receptionistMode 'declined') skips AI prompt / Retell agent /
 *    phone number / Airtable / call logging (onboard.js:2006). Every other client — including a
 *    Starter WITH a receptionist — runs the full stack. The gate is `isWebOnly`, never the plan.
 *  - the site tag is only emitted when sites.length > 1 (:1349), so single-site keys are bare
 *  - Airtable is created on the FIRST site only; enterprise sites 2+ reuse the shared base
 *    via a plain console.log, NOT a log(8, …) marker — so they get no Airtable phase (:1367-73)
 *
 * The voice phases ARE emitted for a web-only client, pre-marked 'skipped' so the pipeline shows
 * them struck through rather than hidden (the operator asked to see the full shape). This is NOT
 * the earlier mistake of pre-marking a GROWTH client's phases 'skipped' — those run and are
 * 'pending'; only a genuinely web-only client gets 'skipped'. 'skipped' and 'pending' are styled
 * distinctly in PipelineFlow (dashed + struck vs solid), so the two no longer look alike.
 */
export function expectedPhases(ctx: ClientContext): PlannedPhase[] {
  const sites = ctx.sites.length ? ctx.sites : [null];
  const multi = sites.length > 1;
  // Keyed on web-only, not plan (mirrors onboard.js:2006). A web-only client (Starter + declined)
  // is the only one that skips the voice stack; everyone else runs it. The voice phases are still
  // EMITTED for a web-only client, pre-marked 'skipped', so the pipeline shows the full shape with
  // those steps struck through rather than hiding them.
  const voice = !ctx.isWebOnly;
  const voiceStatus: PlannedPhase['status'] = voice ? 'pending' : 'skipped';

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
    // Publishing the number needs a number, so it is voice-gated like the purchase itself.
    out.push(planned(PHASE_LABELS.publishNumber, tag, slug, voiceStatus));
    // The checks run for EVERY client including web-only — a web-only client still has a tier
    // matrix to get wrong. Vendor-facing checks inside it self-skip.
    out.push(planned(PHASE_LABELS.checks, tag, slug));
    out.push(
      planned(PHASE_LABELS.push, tag, slug),
      planned(PHASE_LABELS.vercel, tag, slug),
      // The preview deploy runs for every client (web-only included) — not voice-gated.
      planned(PHASE_LABELS.deploy, tag, slug),
      // Portal attach is PER SITE and therefore site-tagged. onboard.js links each site inside
      // the loop deliberately — an enterprise run that dies on site 3 should still leave sites
      // 1 and 2 visible in the client's portal. This was previously planned once, untagged,
      // after the loop, so on an enterprise run the planned node never lit up and the two real
      // ones rendered as `unplanned`. Caught by phase-contract.test.mjs.
      planned(PHASE_LABELS.portal, tag, slug),
    );
  });

  // The Clerk test login is genuinely once-per-client: it runs after the loop with
  // CURRENT_SITE_LABEL cleared, so it alone is untagged.
  out.push(planned(PHASE_LABELS.testLogin, ''));
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
    // A phase expectedPhases already marked 'skipped' (web-only voice stack) will never run, so
    // disk state can't make it done/pending — keep it struck.
    if (p.status === 'skipped') return p;
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
      // Deliberately NOT inferred from TWILIO_NUMBER alone: a number exists from the moment it
      // is bought, and treating that as "published" is the exact bug this phase was added to
      // catch — the site kept the owner's number while the stack hung off the Twilio one.
      //
      // The site.ts-vs-env comparison itself happens in clients.ts (`numberPublished`), where
      // @jdd/schema's `samePhone` is already available. Keeping that import out of this file is
      // not incidental: @jdd/schema declares only an `import` export condition, so a .ts module
      // that pulls it in cannot be loaded by the tsx-based test runner — which is exactly how
      // the phase-contract test broke when this logic first lived here.
      case PHASE_LABELS.publishNumber: done = !!site?.numberPublished; break;
      case PHASE_LABELS.testLogin: done = !!env.CLERK_USER_ID; break;
      // The portal record itself lives in KV, but onboard.js carries PORTAL_ACCOUNT_EMAIL into
      // .env.local (see CARRIED_KEYS), so the attach IS knowable from disk. This previously
      // fell through to `default` with a comment claiming otherwise, which left a fully
      // provisioned client showing a permanently pending Portal node.
      case PHASE_LABELS.portal: done = !!env.PORTAL_ACCOUNT_EMAIL; break;
      // Genuinely unknowable from clients/: pre-flight and the correctness checks leave no
      // artifact at all, and a preview deploy's state lives in Vercel. These stay pending
      // until a run reports them — which is honest, not a gap.
      default: done = false;
    }
    // Everything expectedPhases() emits will run, so anything not already on disk is simply
    // 'pending' — upcoming work, not an absence.
    return { ...p, status: done ? 'done' : 'pending' };
  });
}
