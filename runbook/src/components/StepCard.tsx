'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { CaretRight, Check } from '@phosphor-icons/react';
import type { Step } from '@/lib/runbook-content';
import BlockView from './BlockView';

export default function StepCard({
  step,
  n,
  done,
  onToggle,
  open,
  onOpen,
}: {
  step: Step;
  n: number;
  done: boolean;
  onToggle: () => void;
  open: boolean;
  onOpen: () => void;
}) {
  return (
    <div
      className="panel overflow-hidden transition-opacity"
      style={{ opacity: done && !open ? 0.6 : 1, borderColor: open ? 'var(--rule-strong)' : 'var(--rule)' }}
    >
      <div className="flex items-start gap-3 px-4 py-3.5">
        {/* Done toggle */}
        <button
          type="button"
          onClick={onToggle}
          aria-label={done ? 'Mark step not done' : 'Mark step done'}
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-medium transition-colors"
          style={
            done
              ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: 'var(--accent-ink)' }
              : { borderColor: 'var(--rule-strong)', color: 'var(--fg-3)' }
          }
        >
          {done ? <Check size={13} weight="bold" /> : n}
        </button>

        {/* Title + why (click to open/close) */}
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h4
              className="font-display text-[15px] font-medium"
              style={done ? { textDecoration: 'line-through', color: 'var(--fg-2)' } : undefined}
            >
              {step.title}
            </h4>
            {step.est && <span className="kicker">{step.est}</span>}
          </div>
          {step.why && !open && <p className="mt-1 line-clamp-1 text-[12.5px] leading-[1.5] text-fg3">{step.why}</p>}
        </button>

        <button
          type="button"
          onClick={onOpen}
          className="mt-0.5 shrink-0 text-fg3 transition-transform"
          style={{ transform: open ? 'rotate(90deg)' : 'none' }}
          aria-label={open ? 'Collapse' : 'Expand'}
        >
          <CaretRight size={15} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-3 px-4 pb-4 pl-[52px]">
              {step.why && <p className="text-[13px] leading-[1.6] text-fg2">{step.why}</p>}
              {step.blocks.map((b, i) => (
                <BlockView key={i} block={b} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
