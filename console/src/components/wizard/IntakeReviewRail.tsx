'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, CaretRight } from '@phosphor-icons/react';
import type { SiteContent } from '@/data/site';
import { getPath } from '@/lib/merge';
import { EASE } from '@/lib/motion';
import { KEY_FIELDS, fieldAnchorId, labelOf, sectionOf } from '@/lib/field-labels';

/**
 * What still needs you, beside the work instead of below it.
 *
 * Deliberately ONLY the fields. Generated copy and generation progress live in the main
 * column — putting them here as well would make the rail a second, competing surface rather
 * than an outline of one.
 *
 * The dots are live: filling a field in the main column clears its dot and moves the bar,
 * which is the feedback the old carousel never gave.
 */
export default function IntakeReviewRail({
  content,
  paths,
  onDone,
}: {
  content: SiteContent;
  /** Flagged paths, from `_meta.missing_fields`. */
  paths: string[];
  onDone: () => void;
}) {
  const reduce = useReducedMotion();
  const [showAll, setShowAll] = useState(false);

  const filled = (p: string) => String(getPath(content, p) ?? '').trim().length > 0;
  const done = paths.filter(filled).length;
  const pct = paths.length ? (done / paths.length) * 100 : 100;
  const rest = KEY_FIELDS.filter((p) => !paths.includes(p));

  /**
   * Scroll the main column to a field. The panes scroll independently, so this can't just be
   * an anchor href — that would move the window, not the pane.
   */
  const jump = (path: string) => {
    document.getElementById(fieldAnchorId(path))?.scrollIntoView({
      behavior: reduce ? 'auto' : 'smooth',
      block: 'center',
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-2 border-b border-rule px-5 py-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="kicker">Needs review</span>
          <span className="mono text-2xs tabular-nums text-fg3">
            {done} / {paths.length}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface2">
          <motion.div
            className="h-full rounded-full bg-accent"
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ duration: reduce ? 0 : 0.3, ease: EASE }}
          />
        </div>
      </div>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto py-2">
        {paths.length === 0 ? (
          <p className="px-5 py-3 text-xs text-fg3">
            Nothing flagged. Anything else worth changing is under All fields.
          </p>
        ) : (
          paths.map((p) => <RailRow key={p} path={p} filled={filled(p)} onClick={() => jump(p)} />)
        )}

        {rest.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              aria-expanded={showAll}
              className="mt-2 flex w-full items-center gap-2 border-t border-rule px-5 py-2.5 text-left transition-colors hover:bg-surface"
            >
              <CaretRight
                size={12}
                weight="bold"
                className="shrink-0 text-fg3 transition-transform"
                style={{ transform: showAll ? 'rotate(90deg)' : undefined }}
              />
              <span className="text-xs text-fg2">All fields</span>
              <span className="mono ml-auto text-2xs text-fg3">{rest.length}</span>
            </button>
            {showAll &&
              rest.map((p) => (
                <RailRow key={p} path={p} filled={filled(p)} onClick={() => jump(p)} />
              ))}
          </>
        )}
      </div>

      <div className="mt-auto border-t border-rule px-5 py-3">
        <button type="button" onClick={onDone} className="btn btn-primary btn-sm w-full">
          Go to Studio <ArrowRight size={14} weight="bold" />
        </button>
      </div>
    </div>
  );
}

function RailRow({ path, filled, onClick }: { path: string; filled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-5 py-1.5 text-left transition-colors hover:bg-surface"
    >
      <span
        className="h-[6px] w-[6px] shrink-0 rounded-full"
        style={{ background: filled ? 'var(--ok)' : 'var(--rule-strong)' }}
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate text-xs text-fg2">{labelOf(path)}</span>
      <span className="mono shrink-0 text-2xs text-fg3">{sectionOf(path)}</span>
    </button>
  );
}
