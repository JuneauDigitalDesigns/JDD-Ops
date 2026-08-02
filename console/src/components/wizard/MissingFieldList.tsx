'use client';

import { useState } from 'react';
import { ArrowRight, CaretRight, CheckCircle } from '@phosphor-icons/react';
import type { SiteContent } from '@/data/site';
import { Field, Area, type SetField } from '@/components/fields';
import { getPath } from '@/lib/merge';
import { KEY_FIELDS, LONG, fieldAnchorId, labelOf, sectionOf } from '@/lib/field-labels';

/**
 * The intake's review surface: every flagged field at once, editable in place.
 *
 * This replaced a one-field-at-a-time carousel. The carousel gave a tidy "3 of 12" walk but
 * hid the shape of the work — you couldn't see what was left, skip ahead to the one field
 * you actually knew the answer to, or tell whether the queue was nearly done. With the rail
 * beside it showing the same paths, a list is simply the honest view.
 *
 * Two groups. Flagged gaps are the default and the reason the step exists; the curated rest
 * sits collapsed underneath, because a field that was filled WRONG (a mis-scraped phone
 * number) previously had no home here at all and meant a trip to the Studio or the raw JSON.
 */
export default function MissingFieldList({
  content, setField, paths, onDone,
}: {
  content: SiteContent;
  setField: SetField;
  /** Flagged paths, from `_meta.missing_fields`. */
  paths: string[];
  onDone: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const filled = (p: string) => String(getPath(content, p) ?? '').trim().length > 0;

  // Anything curated that isn't already flagged. Flagged-but-filled stays in the top group:
  // it was flagged for a reason, and moving it on first keystroke would make rows jump.
  const rest = KEY_FIELDS.filter((p) => !paths.includes(p));

  return (
    <div className="flex flex-col gap-4">
      {paths.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-rule bg-panel px-6 py-12 text-center shadow-raised">
          <CheckCircle size={40} weight="duotone" className="text-ok" />
          <p className="font-display text-2xl font-semibold text-fg">Nothing left to review</p>
          <button type="button" onClick={onDone} className="btn btn-primary">
            Go to Studio <ArrowRight size={16} weight="bold" />
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-rule bg-panel shadow-raised">
          {paths.map((path) => (
            <FieldRow key={path} path={path} content={content} setField={setField} filled={filled(path)} />
          ))}
        </div>
      )}

      {/* Everything else worth correcting from here, out of the way until asked for. */}
      {rest.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-rule bg-panel shadow-raised">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            aria-expanded={showAll}
            className="flex w-full items-center gap-2 px-5 py-3 text-left transition-colors hover:bg-surface"
          >
            <CaretRight
              size={13}
              weight="bold"
              className="shrink-0 text-fg3 transition-transform"
              style={{ transform: showAll ? 'rotate(90deg)' : undefined }}
            />
            <span className="text-sm font-medium text-fg2">All fields</span>
            <span className="mono ml-auto text-2xs text-fg3">{rest.length}</span>
          </button>
          {showAll && (
            <div className="border-t border-rule">
              {rest.map((path) => (
                <FieldRow key={path} path={path} content={content} setField={setField} filled={filled(path)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FieldRow({
  path, content, setField, filled,
}: {
  path: string;
  content: SiteContent;
  setField: SetField;
  filled: boolean;
}) {
  return (
    <div
      id={fieldAnchorId(path)}
      // scroll-mt keeps a rail jump from tucking the row under the top of the scroll box.
      className="scroll-mt-4 border-b border-rule px-5 py-4 last:border-b-0"
    >
      <div className="mb-1.5 flex items-center gap-2">
        <span
          className="h-[6px] w-[6px] shrink-0 rounded-full"
          style={{ background: filled ? 'var(--ok)' : 'var(--rule-strong)' }}
          aria-hidden
        />
        <span className="kicker">{sectionOf(path)}</span>
      </div>
      {LONG.test(path) ? (
        <Area content={content} setField={setField} path={path} label={labelOf(path)} />
      ) : (
        <Field content={content} setField={setField} path={path} label={labelOf(path)} />
      )}
      <p className="mt-1.5 font-chromeMono text-xs text-fg3">{path}</p>
    </div>
  );
}
