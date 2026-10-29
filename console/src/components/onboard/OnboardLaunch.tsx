'use client';
// The launch moment, redesigned.
//
// Provisioning is the most consequential thing this app does — it creates repos, buys numbers,
// and spends real money. The brief: during a run the RAW STREAMED LOG is the centrepiece (the
// phase tracker shrinks to a slim progress header); the moment the run ends the OUTCOME is what
// you see first, with the log demoted. Before a run, the full pipeline diagram is the plan.
//
// Carried over from the old LaunchStage: the two gates (no intake / not built) and the dry-run
// toggle + confirm modal, which are load-bearing safety, not decoration. New here: the receptionist
// mode control (required when the intake never stated one — onboard.js refuses to guess) and the
// live preview-deploy status.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight, ArrowSquareOut, CheckCircle, CircleNotch, FileDashed, Flask, Hammer, Lightning,
  Play, Stack, Warning, X,
} from '@phosphor-icons/react';
import { EASE } from '@/lib/motion';
import { expectedPhases, mergeRun, restingPhases } from '@/lib/run-plan';
import { PHASE_LABELS } from '@/lib/onboard-parse';
import type { OnboardRun } from '@/lib/useOnboardRun';
import type { ClientContext, ReceptionistMode } from '@/lib/types';
import NextSteps from '@/components/NextSteps';
import PipelineFlow from '@/components/flow/PipelineFlow';
import RunLogDrawer from '@/components/RunLogDrawer';
import RunOutcomeCard from '@/components/RunOutcomeCard';

const PANEL = 'mx-auto w-full max-w-[920px]';

const MODES: { value: ReceptionistMode; label: string; hint: string }[] = [
  { value: 'forwarded', label: 'Forwarded line', hint: 'Owner forwards their existing number to the JDD number.' },
  { value: 'published', label: 'Published number', hint: 'The JDD number is published as the business number.' },
  { value: 'declined', label: 'Web-only (declined)', hint: 'No receptionist — site only. Starter only.' },
];

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
      className="mx-auto flex w-full max-w-[1100px] flex-col gap-7 px-8 py-8 lg:px-10"
    >
      {children}
    </motion.div>
  );
}

function Header({ ctx, sub }: { ctx: ClientContext; sub: string }) {
  return (
    <header className="mx-auto flex w-full max-w-[72ch] flex-col gap-3">
      <span className="flex items-center gap-2.5">
        <span className="h-px w-7 shrink-0" style={{ background: 'var(--accent)' }} />
        <span className="kicker">Provision &amp; preview</span>
      </span>
      <h1 className="font-display text-[2.4rem] font-semibold leading-[1.05] tracking-tightest">
        Provision {ctx.brandName}
      </h1>
      <p className="max-w-[64ch] text-base leading-[1.5] text-fg2">{sub}</p>
    </header>
  );
}

/** Poll the preview deployment's live state (building → ready) once onboard.js reports a URL. */
function PreviewDeployStatus({ slug, fallbackUrl }: { slug: string; fallbackUrl?: string }) {
  const [state, setState] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(fallbackUrl ?? null);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const terminal = new Set(['READY', 'ERROR', 'CANCELED']);
    const tick = async () => {
      try {
        const res = await fetch(`/api/runbook/deploy-status?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' });
        const data = (await res.json()) as { deployments?: { state: string; url: string | null }[] };
        const dep = data.deployments?.[0];
        if (alive && dep) {
          setState(dep.state);
          if (dep.url) setUrl(dep.url.startsWith('http') ? dep.url : `https://${dep.url}`);
          if (terminal.has(dep.state)) return; // stop polling
        }
      } catch {
        /* transient — keep the last known state */
      }
      if (alive) timer = setTimeout(tick, 4000);
    };
    tick();
    return () => { alive = false; clearTimeout(timer); };
  }, [slug]);

  const ready = state === 'READY';
  const errored = state === 'ERROR' || state === 'CANCELED';
  const color = ready ? 'var(--ok)' : errored ? 'var(--danger)' : 'var(--accent)';

  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-[10px] border px-4 py-3 ${PANEL}`} style={{ borderColor: color }}>
      {ready ? (
        <CheckCircle size={16} weight="fill" style={{ color, flexShrink: 0 }} />
      ) : errored ? (
        <Warning size={16} weight="fill" style={{ color, flexShrink: 0 }} />
      ) : (
        <CircleNotch size={16} className="animate-spin" style={{ color, flexShrink: 0 }} />
      )}
      <span className="meta" style={{ color }}>
        Preview deploy {state ? state.toLowerCase() : 'building…'}
      </span>
      {url && (
        <a href={url} target="_blank" rel="noreferrer" className="btn btn-sm ml-auto inline-flex min-w-0">
          <ArrowSquareOut size={13} /> <span className="truncate">{url}</span>
        </a>
      )}
      <span className="w-full text-2xs text-fg3">
        Review the preview, then promote it to production in the Vercel dashboard — onboard.js never auto-promotes.
      </span>
    </div>
  );
}

/** Live raw log — the centrepiece while a run streams. Auto-scrolls unless the user scrolled up. */
function LiveLog({ lines }: { lines: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  useEffect(() => {
    if (stick.current) ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [lines]);
  return (
    <div className={PANEL}>
      <div
        ref={ref}
        onScroll={() => {
          const el = ref.current;
          if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
        }}
        className="no-scrollbar max-h-[460px] min-h-[280px] overflow-y-auto rounded-[12px] border border-rule bg-[var(--bg-deep)] p-4"
      >
        {lines.map((l, i) => (
          <div
            key={i}
            className="mono whitespace-pre-wrap text-[11.5px] leading-[1.55]"
            style={{ color: /\bFAIL\b|✗|Error:/i.test(l) ? 'var(--danger)' : /\[step|\[pre-flight\]/.test(l) ? 'var(--accent)' : /✓|ONBOARDED|passed|Provisioned/i.test(l) ? 'var(--ok)' : 'var(--fg-2)' }}
          >
            {l || ' '}
          </div>
        ))}
        <div className="mono mt-1 text-[11.5px]" style={{ color: 'var(--accent)' }}>
          <span className="inline-block animate-pulse">▍</span>
        </div>
      </div>
    </div>
  );
}

export default function OnboardLaunch({
  ctx, run, onExit,
}: {
  ctx: ClientContext;
  run: OnboardRun;
  onExit: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const { run: state, running, dryRun, setDryRun, receptionist, setReceptionist, launch } = run;

  // ── Gate: no intake schema ───────────────────────────────────────────────
  if (!ctx.hasIntake) {
    return (
      <Frame>
        <Header ctx={ctx} sub="There’s nothing to provision yet — this client has no intake schema on disk." />
        <div className={`panel flex flex-col gap-3 p-5 ${PANEL}`}>
          <div className="flex items-center gap-2">
            <FileDashed size={17} style={{ color: 'var(--warn)' }} />
            <h3 className="font-display text-base font-medium">No intake schema yet</h3>
          </div>
          <p className="text-xs leading-[1.6] text-fg2">
            There’s no <code className="codechip">clients/{ctx.slug}/site.ts</code> for this client, so there’s nothing to
            provision. Build the site in the <strong className="text-fg">Build</strong> tab — exporting writes the intake
            schema into this folder.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/c/${ctx.slug}/build`} className="btn btn-primary btn-sm">
              <Stack size={13} /> Open Build <ArrowRight size={12} weight="bold" />
            </Link>
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
        <div className={`panel flex flex-col gap-3 p-5 ${PANEL}`}>
          <div className="flex items-center gap-2">
            <Hammer size={17} style={{ color: 'var(--warn)' }} />
            <h3 className="font-display text-base font-medium">Build the site first</h3>
          </div>
          <p className="text-xs leading-[1.6] text-fg2">
            No <code className="codechip">clients/{ctx.slug}/repo</code> yet. Compose the site in the <strong className="text-fg">Build</strong> tab,
            export it to this client folder, then come back to provision.
          </p>
          <Link href={`/c/${ctx.slug}/build`} className="btn btn-sm w-fit">
            <Stack size={13} /> Open Build <ArrowRight size={12} weight="bold" />
          </Link>
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
  const siteSlug = ctx.sites[0]?.slug ?? ctx.slug;

  /**
   * Is this a resume rather than a first run?
   *
   * Derived from DISK (restingPhases), deliberately — not from `state?.failed`. The realistic
   * case is not "it failed and I'll click again immediately": it is "Twilio was suspended, I
   * fixed billing, and I came back the next day". Keying on in-session failure would show that
   * operator a fresh "Provision for real" button with no hint that an agent, a number and an
   * Airtable base already exist — which reads like it is about to buy them all again.
   *
   * `restingPhases` resolves each phase from .env.local and site.ts, so it survives a reload.
   */
  const diskPhases = restingPhases(ctx);
  const alreadyDone = diskPhases.filter((p) => p.status === 'done');
  const stillToDo = diskPhases.filter((p) => p.status === 'pending');
  // "Partially provisioned" means real resources exist but the run never finished. The repo
  // phases alone don't count — those are satisfied by the Build step, not by provisioning.
  const resumable =
    !running &&
    !succeeded &&
    stillToDo.length > 0 &&
    alreadyDone.some((p) =>
      [PHASE_LABELS.agent, PHASE_LABELS.number, PHASE_LABELS.airtable, PHASE_LABELS.callLogging]
        .includes(p.label.split(' · ')[0] as never),
    );

  // onboard.js refuses to run without a stated mode. When the intake never carried one, the
  // operator MUST pick before either a dry or a real run — otherwise validateIntake fails.
  const modeRequired = !ctx.receptionistModeVerified && !receptionist;

  // ── Slim tracker shown while streaming ────────────────────────────────────
  const doneCount = phases.filter((p) => p.status === 'done').length;
  const runningPhase = state?.phases.find((p) => p.status === 'running')?.label.split(' · ')[0];

  return (
    <Frame>
      <Header
        ctx={ctx}
        sub={
          running
            ? 'onboard.js is running — watch the live log below.'
            : dryRun
              ? 'Rehearse the whole run first. A dry run touches no APIs and writes no files.'
              : 'This creates real resources against live APIs. Some of it costs money and is not auto-reversible.'
        }
      />

      {/* ── Receptionist mode ─────────────────────────────────────────────── */}
      {!running && !succeeded && (
        <div className={`flex flex-col gap-2.5 rounded-[12px] border p-4 ${PANEL}`}
          style={{ borderColor: modeRequired ? 'var(--warn)' : 'var(--rule)' }}>
          <div className="flex items-center gap-2">
            <span className="kicker">Receptionist mode</span>
            {!ctx.receptionistModeVerified && (
              <span className="badge" style={{ color: 'var(--warn)' }}>unverified — not stated in the intake</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {MODES.map((m) => {
              const active = receptionist === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setReceptionist(m.value)}
                  title={m.hint}
                  className="rounded-[9px] border px-3 py-1.5 text-xs transition-colors"
                  style={{
                    borderColor: active ? 'var(--accent)' : 'var(--rule)',
                    background: active ? 'var(--accent-glow)' : 'transparent',
                    color: active ? 'var(--fg)' : 'var(--fg-2)',
                  }}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
          <p className="text-2xs text-fg3">
            {modeRequired
              ? 'Pick how this client activated the receptionist before running — onboard.js will not guess.'
              : MODES.find((m) => m.value === receptionist)?.hint ?? 'This is passed to onboard.js as --receptionist.'}
          </p>
        </div>
      )}

      {/* ── Resume: what already exists, and what's left ──────────────────── */}
      {resumable && (
        <div className={`flex flex-col gap-3 rounded-[12px] border p-4 ${PANEL}`} style={{ borderColor: 'var(--ok)' }}>
          <div className="flex items-center gap-2">
            <span className="kicker" style={{ color: 'var(--ok)' }}>Partially provisioned</span>
            <span className="badge">{alreadyDone.length} done · {stillToDo.length} remaining</span>
          </div>
          <p className="text-xs leading-[1.6] text-fg2">
            A previous run got part of the way. Running again <strong className="text-fg">resumes</strong> — onboard.js
            detects what already exists and skips it, so nothing below is bought or created twice.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <span className="meta" style={{ color: 'var(--ok)' }}>Reused, not recreated</span>
              <ul className="flex flex-col gap-0.5">
                {alreadyDone.map((p) => (
                  <li key={p.key} className="text-2xs text-fg3">✓ {p.label}</li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-1">
              <span className="meta">Still to do</span>
              <ul className="flex flex-col gap-0.5">
                {stillToDo.map((p) => (
                  <li key={p.key} className="text-2xs text-fg2">· {p.label}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── Controls ──────────────────────────────────────────────────────── */}
      {!running && (
        <div className={`panel flex flex-wrap items-center justify-between gap-4 p-5 ${PANEL}`}>
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => setDryRun(!dryRun)}
              className="flex w-fit items-center gap-2.5 text-xs"
            >
              <span className="relative h-[20px] w-[36px] rounded-full transition-colors"
                style={{ background: dryRun ? 'var(--ok)' : 'var(--rule-strong)' }}>
                <span className="absolute top-[2px] h-[16px] w-[16px] rounded-full bg-white transition-all"
                  style={{ left: dryRun ? '18px' : '2px' }} />
              </span>
              <span className="meta" style={{ color: dryRun ? 'var(--ok)' : 'var(--fg-3)' }}>
                <Flask size={12} weight="fill" style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />
                Dry run {dryRun ? 'on' : 'off'}
              </span>
            </button>
            <code className="mono text-2xs text-fg3">
              npm run onboard -- --schema {ctx.schemaPath}{dryRun ? ' --dry-run' : ''}{receptionist ? ` --receptionist ${receptionist}` : ''}
            </code>
          </div>

          <button
            type="button"
            disabled={modeRequired}
            onClick={() => (dryRun ? launch() : setConfirming(true))}
            className={dryRun ? 'btn' : 'btn btn-primary'}
            title={modeRequired ? 'Pick a receptionist mode first' : undefined}
          >
            <Play size={15} weight="fill" />
            {/* "Provision for real" on a half-finished client reads like starting over and
                paying twice. Say what it actually does. */}
            {dryRun ? 'Run dry run' : resumable ? 'Resume provisioning' : 'Provision for real'}
          </button>
        </div>
      )}

      {/* ── Streaming: slim tracker + raw log centrepiece ─────────────────── */}
      {running && state && (
        <>
          <div className={`flex items-center gap-3 rounded-[10px] border border-rule px-4 py-2.5 ${PANEL}`}>
            <CircleNotch size={15} className="animate-spin" style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span className="meta truncate" style={{ color: 'var(--fg-2)' }}>
              {runningPhase ? `${runningPhase}…` : 'Running…'}
            </span>
            <span className="meta ml-auto shrink-0" style={{ color: 'var(--fg-3)' }}>
              {doneCount}/{phases.length} steps
            </span>
          </div>
          <LiveLog lines={state.log} />
        </>
      )}

      {/* ── Not running: the pipeline as the plan ─────────────────────────── */}
      {!running && <PipelineFlow phases={phases} ctx={ctx} />}

      {/* ── Outcome first ─────────────────────────────────────────────────── */}
      {!running && succeeded && !dryRun && (
        <>
          <div className={PANEL}><RunOutcomeCard state={state!} /></div>
          {state!.previewUrl && <PreviewDeployStatus slug={siteSlug} fallbackUrl={state!.previewUrl} />}
        </>
      )}

      {!running && succeeded && dryRun && (
        <div className={`flex flex-wrap items-center gap-3 rounded-[10px] border px-4 py-3 ${PANEL}`}
          style={{ borderColor: 'var(--ok)', background: 'var(--ok-glow)' }}>
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

      {/* ── Log, demoted — only after a run ───────────────────────────────── */}
      {!running && state && (
        <div className={PANEL}>
          <RunLogDrawer lines={state.log} running={running} slug={ctx.slug} defaultOpen={errored} />
        </div>
      )}

      {/* ── Exit ──────────────────────────────────────────────────────────── */}
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

      {/* ── Confirm modal for a real run ──────────────────────────────────── */}
      <AnimatePresence>
        {confirming && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center p-6"
            style={{ background: 'rgba(4,8,18,0.86)', backdropFilter: 'blur(8px)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setConfirming(false)}
          >
            <motion.div
              className="panel w-full max-w-[440px] p-6"
              initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-lg font-medium">
                  {resumable ? 'Resume provisioning?' : 'Provision for real?'}
                </h3>
                <button type="button" onClick={() => setConfirming(false)} className="text-fg3 hover:text-fg">
                  <X size={18} />
                </button>
              </div>
              {/* On a resume the generic "this creates everything" warning is actively
                  misleading — most of it already exists. Name what is actually left. */}
              {resumable ? (
                <div className="mb-4 flex flex-col gap-2 text-xs leading-[1.6] text-fg2">
                  <p>
                    Continues the unfinished run for <strong className="text-fg">{ctx.brandName}</strong> ({ctx.plan}).
                    The {alreadyDone.length} completed step{alreadyDone.length === 1 ? '' : 's'} are detected and
                    skipped — nothing already provisioned is bought again.
                  </p>
                  <p>
                    <span className="meta">Remaining:</span>{' '}
                    {stillToDo.map((p) => p.label).join(', ')}
                  </p>
                </div>
              ) : (
                <p className="mb-4 text-xs leading-[1.6] text-fg2">
                  This runs onboard.js against live APIs for <strong className="text-fg">{ctx.brandName}</strong> ({ctx.plan}):
                  creates a GitHub repo and Vercel project
                  {!ctx.isWebOnly && ', a Retell agent, a phone number, and an Airtable base'}. Some of this costs money
                  and is not auto-reversible.
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button type="button" className="btn btn-sm" onClick={() => setConfirming(false)}>Cancel</button>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => { setConfirming(false); launch(); }}>
                  <Lightning size={13} weight="fill" /> {resumable ? 'Yes, resume' : 'Yes, provision'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Frame>
  );
}
