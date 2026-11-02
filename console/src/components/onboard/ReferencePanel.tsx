'use client';
// The reference, as a panel rather than a step.
//
// A thin labelled rail sits on the right edge of the wizard at all times. Opening it slides the
// panel left to fill the horizontal space OVER the stage — deliberately over rather than
// pushing, because pushing would reflow the step underneath every time, and the step most
// likely to be open alongside it is the Make mapping, whose two side-by-side replicas are the
// worst thing in the app to reflow.
//
// The collapse control is pinned to the panel's own left edge as a right-pointing arrow, so the
// way out sits exactly where the way in was.

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, BookOpen } from '@phosphor-icons/react';
import { buildReference } from '@/lib/reference-content';
import { isWideBlock } from '@/lib/runbook-content';
import { EASE } from '@/lib/motion';
import type { ClientContext } from '@/lib/types';
import BlockView from '@/components/BlockView';

export default function ReferencePanel({ ctx }: { ctx: ClientContext }) {
  const [open, setOpen] = useState(false);
  const sections = buildReference(ctx);
  const [active, setActive] = useState(sections[0]?.id ?? '');
  const section = sections.find((s) => s.id === active) ?? sections[0];

  if (sections.length === 0) return null;

  return (
    <>
      {/* ── the rail ─────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        title="Open reference"
        className="group fixed right-0 top-0 z-40 flex h-full w-[46px] flex-col items-center justify-center gap-3 border-l border-rule transition-colors"
        style={{ background: 'var(--panel-2)' }}
      >
        <BookOpen size={16} weight="duotone" style={{ color: 'var(--accent)' }} />
        <span
          className="kicker"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', color: 'var(--fg-2)' }}
        >
          Reference
        </span>
      </button>

      {/* ── the slide-over ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.aside
            key="reference"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.42, ease: EASE }}
            className="fixed inset-0 z-50 flex"
            style={{ background: 'var(--bg)', boxShadow: '-30px 0 70px -30px rgba(20,18,12,.45)' }}
            aria-label="Reference"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              title="Collapse reference"
              className="flex w-[46px] shrink-0 items-center justify-center border-r border-rule transition-colors hover:brightness-95"
              style={{ background: 'var(--panel-2)', color: 'var(--accent)' }}
            >
              <ArrowRight size={18} weight="bold" />
            </button>

            <div className="no-scrollbar min-w-0 flex-1 overflow-y-auto px-7 py-7 lg:px-9">
              <div className="mx-auto w-full max-w-[1100px]">
                <h2 className="font-display text-[2rem] font-semibold leading-[1.1] tracking-tightish">Reference</h2>
                <p className="mt-1.5 max-w-[72ch] text-sm leading-[1.6] text-fg2">
                  Everything you read rather than do. Pulled out of the step flow so each step is
                  only ever “do this” — open it any time without losing your place.
                </p>

                <div className="mb-5 mt-4 flex flex-wrap gap-2 border-b border-rule pb-3.5">
                  {sections.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setActive(s.id)}
                      className="btn btn-sm"
                      style={
                        s.id === active
                          ? { background: 'var(--accent)', color: 'var(--accent-ink)', borderColor: 'var(--accent)' }
                          : undefined
                      }
                    >
                      {s.title}
                    </button>
                  ))}
                </div>

                {section && (
                  <motion.div
                    key={section.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, ease: EASE }}
                    className="flex flex-col items-center gap-5"
                  >
                    <p className="w-full max-w-[82ch] text-sm leading-[1.6] text-fg3">{section.blurb}</p>
                    {section.blocks.map((b, i) => (
                      <div key={i} className={isWideBlock(b) ? 'w-full' : 'w-full max-w-[82ch]'}>
                        <BlockView block={b} />
                      </div>
                    ))}
                  </motion.div>
                )}
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
