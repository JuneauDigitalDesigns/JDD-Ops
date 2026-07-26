'use client';
// The launch moment.
//
// Provisioning is the most consequential thing this app does — it creates repos, buys phone
// numbers, and spends real money — and it used to be a 5px-padded card you scrolled past on
// the way to a checklist. Here it owns the stage: a statement of what is about to happen, the
// pipeline diagram as the live tracker, and the outcome underneath.
//
// The two gates below (no intake / not built) are preserved verbatim from LaunchPanel. They
// are the difference between "nothing to provision" and "provisioning will fail confusingly",
// and both are reachable from a fresh client folder.

import { useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight, CheckCircle, FileDashed, Flask, Hammer, Lightning, Play, Stack, X,
} from '@phosphor-icons/react';
import { EASE } from '@/lib/motion';
import { expectedPhases, mergeRun, restingPhases } from '@/lib/run-plan';
import type { OnboardRun } from '@/lib/useOnboardRun';
import type { ClientContext } from '@/lib/types';
import CopyButton from './CopyButton';
import NextSteps from './NextSteps';
import PipelineFlow from './flow/PipelineFlow';
import RunLogDrawer from './RunLogDrawer';
import RunOutcomeCard from './RunOutcomeCard';

/**
 * Centred column for everything that isn't the pipeline diagram. Wider than the 70ch prose
 * measure because these are functional panels (a toggle + button row, a streamed log) that
 * need room — but still centred on the same axis, so the stage doesn't read as left-hung.
 */
const PANEL = 'mx-auto w-full max-w-[880px]';

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: EASE }}
      className="mx-auto flex w-full max-w-[1180px] flex-col gap-8 px-8 py-10 lg:px-10"
    >
      {children}
    </motion.div>
  );
}

function Header({ ctx, sub }: { ctx: ClientContext; sub: string }) {
  return (
    // Reading column, same as StepStage — only the pipeline diagram spans the full frame.
    <header className="mx-auto flex w-full max-w-[70ch] flex-col gap-4">
      <span className="flex items-center gap-2.5">
        <span className="h-px w-8 shrink-0" style={{ background: 'var(--accent)' }} />
        <span className="kicker">Provision &amp; preview</span>
      </span>
      <h1 className="font-display text-5xl font-semibold leading-[1.02] tracking-tightest">
        Provision {ctx.brandName}
      </h1>
      <p className="max-w-[62ch] text-lg leading-[1.5] text-fg2">{sub}</p>
    </header>
  );
}

export default function LaunchStage({
  ctx, run, onExit,
}: {
  ctx: ClientContext;
  run: OnboardRun;
  onExit: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const { run: state, running, dryRun, setDryRun, launch } = run;

  // ── Gate: no intake schema ───────────────────────────────────────────────
  if (!ctx.hasIntake) {
    return (
      <Frame>
        <Header ctx={ctx} sub="There’s nothing to provision yet — this client has no intake schema on disk." />
        <div className="panel flex flex-col gap-3 p-5">
          <div className="flex items-center gap-2">
            <FileDashed size={17} style={{ color: 'var(--warn)' }} />
            <h3 className="font-display text-base font-medium">No intake schema yet</h3>
          </div>
          <p className="text-xs leading-[1.6] text-fg2">
            There’s no <code className="codechip">clients/{ctx.slug}/site.ts</code> for this client, so there’s nothing to
            provision. Build the site in the <strong className="text-fg">Build</strong> tab — exporting writes the intake
            schema into this folder.
          </p>
          <div className="flex items-center gap-2 rounded-[10px] border border-rule bg-[var(--bg-deep)] px-3 py-2">
            <code className="mono flex-1 text-fg2">npm run new-client -- --slug {ctx.slug}</code>
            <CopyButton value={`npm run new-client -- --slug ${ctx.slug}`} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/build" className="btn btn-primary btn-sm">
              <Stack size={13} /> Open Build <ArrowRight size={12} weight="bold" />
            </Link>
            <span className="text-2xs text-fg3">or scaffold a blank intake above, then fill it in.</span>
          </div>
        </div>
      </Frame>
    );
  }

  // ── Gate: repo not built ─────────────────────────────────────────────────
  if (!ctx.repoBuilt) {
    return (
      <Frame>
        <Header ctx={ctx} sub="The site has to be built and exported before there’s anything for the orchestrator to push." />
        <div className="panel flex flex-col gap-3 p-5">
          <div className="flex items-center gap-2">
            <Hammer size={17} style={{ color: 'var(--warn)' }} />
            <h3 className="font-display text-base font-medium">Build the site first</h3>
          </div>
          <p className="text-xs leading-[1.6] text-fg2">
            No <code className="codechip">clients/{ctx.slug}/repo</code> yet. Compose the site in the <strong className="text-fg">Build</strong> tab
            (drag-and-drop), export it to this client folder, then come back to provision.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/build" className="btn btn-sm">
              <Stack size={13} /> Open Build <ArrowRight size={12} weight="bold" />
            </Link>
            <span className="text-2xs text-fg3">or scaffold manually:</span>
            <code className="codechip">npm run new-client -- --slug {ctx.slug}</code>
          </div>
        </div>
      </Frame>
    );
  }

  const errored = Boolean(state?.failed);
  const succeeded = Boolean(state && state.onboarded && !state.failed);
  const errorText = state
    ? [state.failed?.message, ...state.log.filter((l) => /\bFAIL\b|✗|Error:/i.test(l))].filter(Boolean).join('\n')
    : '';

  const phases = state ? mergeRun(expectedPhases(ctx), state) : restingPhases(ctx);

  return (
    <Frame>
      <Header
        ctx={ctx}
        sub={
          dryRun
            ? 'Rehearse the whole run first. A dry run touches no APIs and writes no files — it only proves the orchestrator can get to the end.'
            : 'This creates real resources against live APIs. Some of it costs money and is not auto-reversible.'
        }
      />

      {/* ── Controls ──────────────────────────────────────────────────── */}
      <div className={`panel flex flex-wrap items-center justify-between gap-4 p-5 ${PANEL}`}>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setDryRun(!dryRun)}
            disabled={running}
            className="flex w-fit items-center gap-2.5 text-xs disabled:opacity-40"
          >
            <span
              className="relative h-[20px] w-[36px] rounded-full transition-colors"
              style={{ background: dryRun ? 'var(--ok)' : 'var(--rule-strong)' }}
            >
              <span
                className="absolute top-[2px] h-[16px] w-[16px] rounded-full bg-white transition-all"
                style={{ left: dryRun ? '18px' : '2px' }}
              />
            </span>
            <span className="kicker" style={{ color: dryRun ? 'var(--ok)' : 'var(--fg-3)' }}>
              <Flask size={12} weight="fill" style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />
              Dry run {dryRun ? 'on' : 'off'}
            </span>
          </button>
          <code className="mono text-2xs text-fg3">
            npm run onboard -- --schema {ctx.schemaPath}{dryRun ? ' --dry-run' : ''}
          </code>
        </div>

        <button
          type="button"
          disabled={running}
          onClick={() => (dryRun ? launch() : setConfirming(true))}
          className={dryRun ? 'btn' : 'btn btn-primary cta-offset'}
        >
          <Play size={15} weight="fill" />
          {running ? 'Running…' : dryRun ? 'Run dry run' : 'Provision for real'}
        </button>
      </div>

      {/* ── The pipeline: the plan before a run, the tracker during one. ── */}
      <PipelineFlow phases={phases} ctx={ctx} />

      {/* ── Outcome ───────────────────────────────────────────────────── */}
      {!running && succeeded && !dryRun && (
        <div className={PANEL}><RunOutcomeCard state={state!} /></div>
      )}

      {!running && succeeded && dryRun && (
        <div
          className={`flex flex-wrap items-center gap-3 rounded-[10px] border px-4 py-3 ${PANEL}`}
          style={{ borderColor: 'var(--ok)', background: 'var(--ok-glow)' }}
        >
          <Flask size={16} weight="fill" style={{ color: 'var(--ok)', flexShrink: 0 }} />
          <p className="text-xs text-fg2">
            Rehearsal clean — no resources created. Flip <strong className="text-fg">Dry run off</strong> to provision for real.
          </p>
        </div>
      )}

      {!running && errored && (
        <div className={`flex flex-col gap-4 ${PANEL}`}>
          <div className="flex items-center gap-2">
            <span className="badge badge-danger"><span className="dot" /> Failed{state?.failed ? ` · ${state.failed.label}` : ''}</span>
          </div>
          <NextSteps errorText={errorText} slug={ctx.slug} />
        </div>
      )}

      {state && (
        <div className={PANEL}>
          <RunLogDrawer lines={state.log} running={running} slug={ctx.slug} defaultOpen={errored} />
        </div>
      )}

      {/* ── Exit ──────────────────────────────────────────────────────── */}
      <footer className={`flex flex-wrap items-center gap-3 border-t border-rule pt-6 ${PANEL}`}>
        {!running && succeeded && !dryRun && (
          <span className="inline-flex items-center gap-1.5 text-xs text-fg3">
            <CheckCircle size={14} weight="fill" style={{ color: 'var(--ok)' }} /> Provisioned — status advanced.
          </span>
        )}
        <button type="button" onClick={onExit} disabled={running} className="btn btn-sm ml-auto">
          Continue to the next step <ArrowRight size={13} />
        </button>
      </footer>

      {/* ── Confirm modal for a real run ──────────────────────────────── */}
      <AnimatePresence>
        {confirming && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center p-6"
            style={{ background: 'rgba(4,8,18,0.86)', backdropFilter: 'blur(8px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConfirming(false)}
          >
            <motion.div
              className="panel w-full max-w-[440px] p-6"
              initial={{ scale: 0.96, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-lg font-medium">Provision for real?</h3>
                <button type="button" onClick={() => setConfirming(false)} className="text-fg3 hover:text-fg">
                  <X size={18} />
                </button>
              </div>
              <p className="mb-4 text-xs leading-[1.6] text-fg2">
                This runs onboard.js against live APIs for <strong className="text-fg">{ctx.brandName}</strong> ({ctx.plan}):
                creates a GitHub repo and Vercel project
                {ctx.plan !== 'starter' && ', a Retell agent, a phone number, and an Airtable base'}. Some of this costs money
                and is not auto-reversible.
              </p>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn btn-sm" onClick={() => setConfirming(false)}>Cancel</button>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => { setConfirming(false); launch(); }}>
                  <Lightning size={13} weight="fill" /> Yes, provision
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Frame>
  );
}
