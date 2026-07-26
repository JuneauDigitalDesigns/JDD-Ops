'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { ArrowCounterClockwise, CloudArrowUp, SpinnerGap } from '@phosphor-icons/react';
import { EASE } from '@/lib/motion';

/**
 * Pending changes and the save action, pinned to the bottom of the stage.
 *
 * Sticky rather than a footer: the old env editor put the save button after the advanced
 * drawer, so on a client with many keys you could edit a field, scroll, and lose track of
 * whether anything was pending. Naming the changed keys means you can confirm what you're
 * about to write without scrolling back up.
 *
 * Only rendered when dirty, which is what makes the auto-clean in useEnvEditor.set matter
 * — a draft entry equal to the server value would keep this bar on screen claiming a
 * change that would be a no-op.
 */
export default function SaveBar({
  changedKeys,
  saving,
  onSave,
  onRevertAll,
}: {
  changedKeys: string[];
  saving: boolean;
  onSave: () => void;
  onRevertAll: () => void;
}) {
  const reduce = useReducedMotion();
  const n = changedKeys.length;

  return (
    <motion.div
      initial={reduce ? false : { y: 16, opacity: 0.6 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: reduce ? 0 : 0.2, ease: EASE }}
      className="sticky bottom-0 z-20 -mx-8 mt-6 border-t px-8 py-3 lg:-mx-10 lg:px-10"
      style={{
        borderColor: 'var(--rule)',
        background: 'var(--panel)',
        boxShadow: '0 -8px 24px -18px rgba(20,18,12,0.5)',
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-sm text-fg">
            {n} change{n === 1 ? '' : 's'} pending
          </span>
          <span className="flex min-w-0 flex-wrap items-center gap-1">
            {changedKeys.slice(0, 4).map((k) => (
              <code key={k} className="codechip">
                {k}
              </code>
            ))}
            {n > 4 && <span className="text-xs text-fg3">+{n - 4} more</span>}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={onRevertAll} disabled={saving} className="btn btn-sm">
            <ArrowCounterClockwise size={13} /> Revert all
          </button>
          <button type="button" onClick={onSave} disabled={saving} className="btn btn-primary btn-sm">
            {saving ? (
              <SpinnerGap size={13} className="animate-spin" />
            ) : (
              <CloudArrowUp size={13} weight="fill" />
            )}
            {saving ? 'Saving…' : 'Save + sync to Vercel'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
