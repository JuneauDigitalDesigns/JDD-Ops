'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, ArrowLeft, CheckCircle, SkipForward } from '@phosphor-icons/react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import type { SiteContent } from '@/data/site';
import { Field, Area, type SetField } from '@/components/fields';
import { getPath } from '@/lib/merge';
import { EASE } from '@/lib/motion';

// Human labels for the paths that actually show up in _meta.missing_fields. Anything not
// listed falls back to a humanized path, so a new schema field degrades gracefully rather
// than showing a raw dotted path with no context.
const LABELS: Record<string, string> = {
  'brand.name': 'Business name',
  'brand.short': 'Short name',
  'brand.phone': 'Phone number',
  'brand.email': 'Email address',
  'brand.address': 'Street address',
  'brand.hours': 'Business hours',
  'brand.tagline': 'Tagline',
  'hero.headline': 'Hero headline',
  'hero.subhead': 'Hero subheadline',
  'about.body': 'About copy',
  'seo.title': 'SEO title',
  'seo.description': 'SEO description',
  'seo.canonical': 'Canonical URL',
};

/** Long-form paths get a textarea; everything else a single-line input. */
const LONG = /(body|description|subhead|blurb|bio|summary|answer|tagline)$/i;

function sectionOf(path: string): string {
  const head = path.split('.')[0];
  return head.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

function labelOf(path: string): string {
  if (LABELS[path]) return LABELS[path];
  const tail = path.split('.').pop() ?? path;
  return tail.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

/**
 * The intake's review surface: one flagged field at a time instead of a twelve-section
 * wall of inputs. `_meta.missing_fields` already drives the amber ReviewBadge elsewhere;
 * here it drives an ordered queue with its own progress, so "what still needs me" is the
 * screen rather than something you hunt for inside collapsed sections.
 */
export default function MissingFieldQueue({
  content, setField, paths, onDone,
}: {
  content: SiteContent;
  setField: SetField;
  paths: string[];
  onDone: () => void;
}) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);

  // Fields can be filled from elsewhere (generation, scrape) while the queue is open —
  // keep the cursor in range rather than stranding it past the end.
  useEffect(() => {
    if (i > paths.length - 1) setI(Math.max(0, paths.length - 1));
  }, [paths.length, i]);

  if (paths.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-rule bg-panel px-6 py-12 text-center shadow-raised">
        <CheckCircle size={40} weight="duotone" className="text-ok" />
        <p className="font-display text-2xl font-semibold text-fg">Nothing left to review</p>
        <button type="button" onClick={onDone} className="btn btn-primary">
          Go to Studio <ArrowRight size={16} weight="bold" />
        </button>
      </div>
    );
  }

  const path = paths[Math.min(i, paths.length - 1)];
  const filled = String(getPath(content, path) ?? '').trim().length > 0;
  const isLast = i >= paths.length - 1;

  function step(delta: number) {
    setDir(delta);
    if (delta > 0 && isLast) { onDone(); return; }
    setI((n) => Math.min(paths.length - 1, Math.max(0, n + delta)));
  }

  return (
    <div className="overflow-hidden rounded-xl border border-rule bg-panel shadow-raised">
      {/* Progress — the queue's whole justification is that you can see the end of it. */}
      <div className="flex items-center gap-3 border-b border-rule px-5 py-3">
        <span className="text-sm font-medium text-fg">
          {i + 1} of {paths.length}
        </span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface2">
          <motion.div
            className="h-full rounded-full bg-accent"
            animate={{ width: `${((i + 1) / paths.length) * 100}%` }}
            transition={{ duration: reduce ? 0 : 0.3, ease: EASE }}
          />
        </div>
        <button type="button" onClick={onDone} className="btn btn-xs">
          Skip all
        </button>
      </div>

      <div className="relative min-h-[210px] px-6 py-7">
        <AnimatePresence custom={dir} initial={false} mode="wait">
          <motion.div
            key={path}
            custom={dir}
            initial={{ opacity: 0, x: reduce ? 0 : dir * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: reduce ? 0 : dir * -24 }}
            transition={{ duration: reduce ? 0 : 0.2, ease: EASE }}
          >
            <p className="kicker mb-2">{sectionOf(path)}</p>
            {LONG.test(path) ? (
              <Area content={content} setField={setField} path={path} label={labelOf(path)} />
            ) : (
              <Field content={content} setField={setField} path={path} label={labelOf(path)} />
            )}
            <p className="mt-2 font-chromeMono text-xs text-fg3">{path}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-rule px-5 py-3">
        <button type="button" onClick={() => step(-1)} disabled={i === 0} className="btn btn-sm">
          <ArrowLeft size={15} /> Back
        </button>
        <div className="flex items-center gap-2">
          {!filled && (
            <button type="button" onClick={() => step(1)} className="btn btn-sm">
              <SkipForward size={15} /> Skip
            </button>
          )}
          <button type="button" onClick={() => step(1)} className="btn btn-sm btn-primary">
            {isLast ? 'Go to Studio' : 'Next'} <ArrowRight size={15} weight="bold" />
          </button>
        </div>
      </div>
    </div>
  );
}
