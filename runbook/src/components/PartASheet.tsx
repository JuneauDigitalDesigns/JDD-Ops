'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from '@phosphor-icons/react';
import type { Phase } from '@/lib/runbook-content';
import StepGuide from './StepGuide';

export default function PartASheet({
  open,
  onClose,
  phases,
  done,
  onToggle,
}: {
  open: boolean;
  onClose: () => void;
  phases: Phase[];
  done: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex justify-end"
          style={{ background: 'rgba(4,8,18,0.7)', backdropFilter: 'blur(6px)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.aside
            className="no-scrollbar h-full w-full max-w-[620px] overflow-y-auto border-l border-ruleStrong bg-[var(--bg)] p-7"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-start justify-between">
              <div className="flex flex-col gap-1">
                <span className="kicker">One-time · Part A</span>
                <h2 className="font-display text-[26px] font-semibold tracking-tightest">Master setup</h2>
                <p className="text-[12.5px] text-fg3">Do these once, before your first paid client.</p>
              </div>
              <button type="button" onClick={onClose} className="btn btn-sm">
                <X size={15} /> Close
              </button>
            </div>
            <StepGuide phases={phases} done={done} onToggle={onToggle} />
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
