'use client';

import { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { X, PencilSimple } from '@phosphor-icons/react';
import type { SiteContent } from '@/data/site';
import type { Section } from '@/lib/copy-schema';
import { labelFor, SECTION_ICONS } from '@/lib/section-labels';
import { EASE } from '@/lib/motion';
import SectionCopyBody from '@/components/wizard/SectionCopyBody';

/**
 * Read-only "review brand copy" modal for the Intake step. Renders a single section's copy in
 * an EDITORIAL reader layout — natural hierarchy (eyebrow / headline / sub / CTA chips / cards),
 * NOT a form — so a reviewer grasps it at a glance. Neutral cream styling (not the client's
 * brand skin). Editing happens in Studio via the footer jump. Chrome mirrors LaunchDialog.
 */
export default function SectionCopyModal({
  section, content, isGenerated, onClose, onEditInStudio,
}: {
  section: Section;
  content: SiteContent;
  isGenerated: boolean;
  onClose: () => void;
  onEditInStudio: (s: Section) => void;
}) {
  const reduce = useReducedMotion();
  const Icon = SECTION_ICONS[section];

  // Esc closes; lock background scroll while open (matches FullScreenPreview).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduce ? 0 : 0.18 }}
        onClick={onClose}
        className="absolute inset-0 bg-[var(--fg)]/40 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, y: reduce ? 0 : 12, scale: reduce ? 1 : 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: reduce ? 0 : 8, scale: reduce ? 1 : 0.98 }}
        transition={{ duration: reduce ? 0 : 0.22, ease: EASE }}
        role="dialog"
        aria-modal="true"
        aria-label={`Review ${labelFor(section)} copy`}
        className="relative flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-rule bg-panel shadow-overlay"
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-rule px-6 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-rule bg-surface text-accent">
            <Icon size={18} weight="regular" />
          </span>
          <h2 className="font-display text-2xl font-semibold text-fg">{labelFor(section)}</h2>
          <span className={isGenerated ? 'badge badge-accent' : 'badge'}>
            {isGenerated ? 'AI-generated' : 'Preset copy'}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto rounded-md p-1.5 text-fg3 hover:bg-surface hover:text-fg"
          >
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <SectionCopyBody section={section} content={content} />
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-rule px-6 py-4">
          <span className="text-xs text-fg3">Read-only · edit on the live page in Studio</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="btn btn-sm">Close</button>
            <button
              type="button"
              onClick={() => { onEditInStudio(section); onClose(); }}
              className="btn btn-sm btn-primary"
            >
              <PencilSimple size={15} /> Edit in Studio
            </button>
          </div>
        </footer>
      </motion.div>
    </div>
  );
}

