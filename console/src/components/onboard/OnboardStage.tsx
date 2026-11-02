'use client';
// One onboarding step — the work itself, and nothing in front of it.
//
// What changed, and why:
//
// * The eyebrow is gone. A muted phase name above every title was a third line of chrome over
//   content that already sits under a breadcrumb trail naming that same phase.
// * The ACTION CARD is gone. It carried a label ("Do this now") and a sentence of hint prose
//   ("Work through the detail below, then mark this step done") that told the operator nothing
//   the step didn't, and it pushed the actual instructions below the fold. An incomplete step
//   now opens straight into its first instruction. Launch steps keep a real button, because
//   that one does something.
// * Completion moved onto Next, in the wizard's sticky bar. One forward motion instead of a
//   button to finish and a separate button to move.
// * Nav is gone from the bottom entirely — it lives in the sticky bar now, where it stays
//   reachable on a long step instead of requiring a scroll back up.
//
// LAYOUT: the content column is CENTRED on the page. Prose and instructions are capped at a
// readable measure and centred under the wide blocks (diagrams, the Make replicas, the site
// hero, the prompt tuner), which break out to the full stage width. Previously everything was
// left-aligned inside a wide container, so on a large screen the instructions hugged the left
// edge while the replicas spanned the whole width — two different left margins in one column.

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Eye, Lightning } from '@phosphor-icons/react';
import { EASE } from '@/lib/motion';
import { isWideBlock } from '@/lib/runbook-content';
import type { StepNode } from '@/lib/runbook-nav';
import BlockView from '@/components/BlockView';

export default function OnboardStage({
  node, done, total, onToggle, onNext, onLaunch, hasNext,
}: {
  node: StepNode;
  done: boolean;
  total: number;
  onToggle: () => void;
  onNext: () => void;
  onLaunch: () => void;
  hasNext: boolean;
}) {
  const { step, phase, n, actionable } = node;

  /**
   * Whether the dim has been lifted for THIS visit.
   *
   * Deliberately local and deliberately not persisted: the wizard mounts this component with
   * `key={step.id}`, so navigating away and back resets it. A completed step should read as
   * completed every time you land on it — a sticky reveal would quietly turn the overlay off
   * for the rest of the session after one click.
   */
  const [revealed, setRevealed] = useState(false);
  const dimmed = done && !revealed;

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
      className="mx-auto flex w-full max-w-[1420px] flex-col px-6 pb-20 pt-7 lg:px-10"
    >
      {/* ── Header: title, then meta inline after it ──────────────────── */}
      <header className="mx-auto mb-6 flex w-full max-w-[82ch] flex-wrap items-baseline gap-x-3.5 gap-y-2">
        <h1 className="font-display text-[2.05rem] font-semibold leading-[1.08] tracking-tightish">
          {step.title}
        </h1>
        <span className="flex items-center gap-2.5 pb-[3px]">
          {actionable ? (
            <span className="meta">Step {n} of {total}</span>
          ) : (
            <span className="badge badge-accent">Reference</span>
          )}
          {step.est && <span className="meta">{step.est}</span>}
          {done ? (
            <span className="badge badge-ok"><Check size={11} weight="bold" /> Done</span>
          ) : actionable ? (
            <span className="badge">To do</span>
          ) : null}
        </span>
      </header>

      {/* ── Content region — what the completed overlay dims ──────────── */}
      <div className="relative flex w-full flex-col">
        <motion.div
          animate={dimmed ? { filter: 'blur(2.5px) saturate(0.5)', opacity: 0.3 } : { filter: 'blur(0px) saturate(1)', opacity: 1 }}
          transition={{ duration: 0.3, ease: EASE }}
          style={dimmed ? { pointerEvents: 'none', userSelect: 'none' } : undefined}
          aria-hidden={dimmed}
          className="flex w-full flex-col items-center gap-6"
        >
          {step.launch && (
            <div className="flex w-full max-w-[82ch] flex-wrap items-center gap-3">
              <button type="button" onClick={onLaunch} className="btn btn-primary">
                <Lightning size={15} weight="fill" /> Open the provisioning run
              </button>
              <span className="meta">Rehearse with a dry run first — it checks the same predicates the test suite does.</span>
            </div>
          )}

          {step.why && (
            <p className="w-full max-w-[82ch] text-sm leading-[1.6] text-fg2">{step.why}</p>
          )}

          {step.blocks.map((b, i) => (
            <div key={i} className={isWideBlock(b) ? 'w-full' : 'w-full max-w-[82ch]'}>
              <BlockView block={b} />
            </div>
          ))}
        </motion.div>

        {/* ── Completed overlay ──────────────────────────────────────── */}
        {dimmed && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="absolute inset-x-0 top-0 z-20 flex justify-center pt-12"
            >
              <div
                className="max-w-[430px] rounded-[16px] border px-8 py-7 text-center"
                style={{
                  background: 'var(--panel)',
                  borderColor: 'var(--rule-strong)',
                  boxShadow: '0 30px 70px -28px rgba(20,18,12,.4)',
                }}
              >
                <div
                  className="mx-auto mb-3.5 flex h-[46px] w-[46px] items-center justify-center rounded-full"
                  style={{ background: 'var(--ok-glow)', color: 'var(--ok)', border: '1px solid rgba(63,143,92,.38)' }}
                >
                  <Check size={23} weight="bold" />
                </div>
                <h3 className="font-display text-[1.5rem] font-semibold">Step Completed</h3>
                <p className="mx-auto mb-5 mt-1.5 max-w-[42ch] text-xs leading-[1.6] text-fg2">
                  You finished <b>{step.title}</b>. Nothing here needs doing again — carry on, or
                  reopen it if something changed.
                </p>
                <div className="flex flex-col items-center gap-2.5">
                  <button type="button" onClick={onNext} disabled={!hasNext} className="btn btn-primary">
                    Next <ArrowRight size={14} weight="bold" />
                  </button>
                  <button type="button" onClick={onToggle} className="btn btn-sm">
                    Mark incomplete
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Bottom-right escape hatch: lift the dim without reopening the step. */}
            <div className="pointer-events-auto absolute bottom-0 right-0 z-20">
              <button type="button" onClick={() => setRevealed(true)} className="btn btn-sm">
                <Eye size={13} /> View this step
              </button>
            </div>
          </>
        )}

        {/* A revealed step keeps a quiet way back to the completed state. */}
        {done && revealed && (
          <div className="mx-auto mt-6 flex w-full max-w-[82ch] items-center gap-2.5 border-t border-rule pt-4">
            <span className="badge badge-ok"><Check size={11} weight="bold" /> Completed</span>
            <span className="meta">Viewing a step you already finished.</span>
            <button type="button" onClick={() => setRevealed(false)} className="btn btn-xs ml-auto">
              Hide again
            </button>
          </div>
        )}
      </div>
    </motion.article>
  );
}
