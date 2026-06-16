'use client';
import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';
import type { SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'trust-bar',
  category: 'trust',
  label: 'Trust / Announcement bar',
  consumes: ['announcement', 'trust.logos'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react'],
} as const;

export default function TrustBar({ content = CONTENT }: { content?: SiteContent }) {
  const reduce = useReducedMotion() ?? false;
  const { announcement, trust } = content;
  const [visible, setVisible] = useState(true);

  if (!announcement && !trust.logos.length) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="bg-accent text-accentFg"
          initial={reduce ? false : { height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={reduce ? undefined : { height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2.5">
            <div className="flex flex-1 flex-wrap items-center justify-center gap-4 text-sm">
              {announcement && (
                <span className="font-medium"><E p="announcement">{announcement}</E></span>
              )}
              {trust.logos.length > 0 && (
                <span className="hidden items-center gap-3 sm:flex">
                  {trust.logos.slice(0, 4).map((logo, i) => (
                    <span key={i} className="text-xs uppercase tracking-wide text-accentFg/80"><E p={`trust.logos.${i}`}>{logo}</E></span>
                  ))}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setVisible(false)}
              aria-label="Dismiss announcement"
              className="shrink-0 rounded p-1 text-accentFg/70 transition-colors hover:bg-white/20 hover:text-accentFg"
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
