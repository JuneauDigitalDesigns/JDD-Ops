'use client';
// The stage: one step, given the whole viewport.
//
// The old StepCard rendered a step title at text-sm (15px) inside a collapsible row, so every
// step looked like a line item in a list and nothing looked like the thing you were currently
// doing. Here the step gets an editorial header — hairline eyebrow, oversized display title,
// the `why` promoted to a lede — and its blocks get room to breathe underneath.
//
// Three footer actions, and they are not redundant:
//   Back / Next  step through EVERYTHING in flat order, references included, so the system
//                can be read end to end.
//   Complete     marks done and jumps to the next ACTIONABLE step, skipping references —
//                the old StepGuide behaviour, which is what you want when you're working
//                rather than reading.

import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Lightning } from '@phosphor-icons/react';
import { EASE } from '@/lib/motion';
import { isWideBlock } from '@/lib/runbook-content';
import type { StepNode } from '@/lib/runbook-nav';
import BlockView from './BlockView';

export default function StepStage({
  node, done, total, onToggle, onBack, onNext, onComplete, onLaunch, hasBack, hasNext,
}: {
  node: StepNode;
  done: boolean;
  total: number;
  onToggle: () => void;
  onBack: () => void;
  onNext: () => void;
  onComplete: () => void;
  onLaunch: () => void;
  hasBack: boolean;
  hasNext: boolean;
}) {
  const { step, phase, n, actionable } = node;

  // Deliberately NOT wrapped in AnimatePresence with mode="wait". That made mounting the next
  // step wait on the previous one's exit animation, so navigation was hostage to an animation
  // completing — if it stalled (background tab, interrupted rAF), the rail would move but the
  // stage would sit blank on the outgoing step. Keying the article is enough: React swaps
  // immediately and the incoming step plays its own entrance.
  return (
    <motion.article
      key={step.id}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: EASE }}
      className="mx-auto flex w-full max-w-[1180px] flex-col gap-8 px-8 py-10 lg:px-10"
    >
      {/* ── Header ──────────────────────────────────────────────────────
          The article is wide so diagrams can breathe; the header stays a reading
          column so the lede doesn't run to 120 characters a line. */}
      <header className="relative mx-auto flex w-full max-w-[70ch] flex-col gap-4">
        {/* Heavy numeral, bled into the left gutter. Hidden below lg, where there is no
            gutter for it to live in. */}
        <span
          aria-hidden
          className="pointer-events-none absolute -left-[76px] -top-4 hidden select-none font-display font-black leading-none lg:block"
          style={{ fontSize: 68, color: 'var(--rule-strong)' }}
        >
          {actionable ? String(n).padStart(2, '0') : '·'}
        </span>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="flex items-center gap-2.5">
            <span className="h-px w-8 shrink-0" style={{ background: 'var(--accent)' }} />
            <span className="kicker">{phase.title}</span>
          </span>
          {actionable ? (
            <span className="kicker" style={{ color: 'var(--fg-3)' }}>Step {n} of {total}</span>
          ) : (
            <span className="badge">Reference</span>
          )}
          {step.est && <span className="kicker">{step.est}</span>}
          {done && (
            <span className="badge badge-ok"><Check size={11} weight="bold" /> Done</span>
          )}
        </div>

        <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tightest">
          {step.title}
        </h1>

        {step.why && (
          <p className="max-w-[62ch] text-lg leading-[1.55] text-fg2">{step.why}</p>
        )}
      </header>

      {/* ── Body ────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-5">
        {step.blocks.map((b, i) => (
          <div key={i} className={isWideBlock(b) ? 'w-full' : 'mx-auto w-full max-w-[70ch]'}>
            <BlockView block={b} />
          </div>
        ))}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="mx-auto flex w-full max-w-[70ch] flex-wrap items-center gap-3 border-t border-rule pt-6">
        <button type="button" onClick={onBack} disabled={!hasBack} className="btn btn-sm">
          <ArrowLeft size={13} /> Back
        </button>

        {step.launch ? (
          <button type="button" onClick={onLaunch} className="btn btn-primary cta-offset">
            <Lightning size={15} weight="fill" /> Open the provisioning run
          </button>
        ) : actionable ? (
          <button
            type="button"
            onClick={done ? onToggle : onComplete}
            className={done ? 'btn btn-sm' : 'btn btn-primary cta-offset'}
          >
            {done ? 'Mark incomplete' : <><Check size={15} weight="bold" /> Complete step</>}
          </button>
        ) : null}

        <button type="button" onClick={onNext} disabled={!hasNext} className="btn btn-sm ml-auto">
          Next <ArrowRight size={13} />
        </button>
      </footer>
    </motion.article>
  );
}
