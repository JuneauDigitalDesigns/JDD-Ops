'use client';

import { LockSimple, Plus, Trash } from '@phosphor-icons/react';
import { DRIFT_SHORT, driftColor } from '@/lib/envDrift';
import type { DriftState, RawView } from '@/lib/useEnvEditor';
import SecretValue from './SecretValue';

/**
 * Everything on disk that isn't a curated field, as a real aligned table rather than the
 * old <details> stack of loose inputs.
 *
 * Keeps the escape-hatch framing: this is where uncurated keys live, with no validation
 * beyond "looks like an env var". Keys onboard.js owns are rendered locked — editing
 * VERCEL_PROJECT_NAME here would orphan the Vercel project, and CLERK_USER_ID /
 * RETELL_LLM_ID are written by other tools that would immediately overwrite you.
 */
export default function AdvancedTable({
  slug,
  siteSlug,
  advanced,
  locked,
  newRows,
  setNewRows,
  valueOf,
  onChange,
  driftFor,
  disabled,
}: {
  slug: string;
  siteSlug: string;
  advanced: RawView[];
  locked: RawView[];
  newRows: Array<{ key: string; value: string }>;
  setNewRows: (fn: (prev: Array<{ key: string; value: string }>) => Array<{ key: string; value: string }>) => void;
  valueOf: (key: string, fallback: string) => string;
  onChange: (key: string, value: string) => void;
  driftFor: (key: string) => DriftState | null;
  disabled: boolean;
}) {
  return (
    <section className="panel flex flex-col gap-3 p-5">
      <header className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-semibold tracking-tightish text-fg">Other variables</h2>
        <p className="text-xs text-fg3">
          Everything else in <code className="codechip">.env.local</code>. No validation here — a
          typo lands on the deployed site.
        </p>
      </header>

      <div className="flex flex-col">
        {advanced.length === 0 && newRows.length === 0 && (
          <p className="py-3 text-xs text-fg3">No uncurated variables on this site.</p>
        )}

        {advanced.map((row) => {
          const state = driftFor(row.key);
          return (
            <div key={row.key} className="flex items-center gap-3 border-b border-rule py-2 last:border-b-0">
              <span
                className="w-[38%] shrink-0 truncate font-mono text-xs text-fg2"
                title={row.key}
              >
                {row.key}
              </span>
              <span className="min-w-0 flex-1">
                {row.masked ? (
                  <SecretValue slug={slug} siteSlug={siteSlug} envKey={row.key} masked={row.value} />
                ) : (
                  <input
                    type="text"
                    className="mono-field w-full"
                    value={valueOf(row.key, row.value)}
                    onChange={(e) => onChange(row.key, e.target.value)}
                    disabled={disabled}
                    spellCheck={false}
                    aria-label={row.key}
                  />
                )}
              </span>
              <span
                className="w-[62px] shrink-0 text-right text-2xs"
                style={{ color: state ? driftColor(state) : 'var(--fg-3)' }}
              >
                {state ? DRIFT_SHORT[state] : ''}
              </span>
            </div>
          );
        })}

        {newRows.map((row, i) => (
          <div key={`new-${i}`} className="flex items-center gap-3 border-b border-rule py-2 last:border-b-0">
            <input
              type="text"
              className="mono-field w-[38%] shrink-0"
              value={row.key}
              placeholder="NEW_KEY"
              onChange={(e) =>
                setNewRows((prev) => prev.map((r, j) => (j === i ? { ...r, key: e.target.value } : r)))
              }
              disabled={disabled}
              spellCheck={false}
              aria-label="New variable name"
            />
            <input
              type="text"
              className="mono-field min-w-0 flex-1"
              value={row.value}
              placeholder="value"
              onChange={(e) =>
                setNewRows((prev) => prev.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))
              }
              disabled={disabled}
              spellCheck={false}
              aria-label="New variable value"
            />
            <button
              type="button"
              onClick={() => setNewRows((prev) => prev.filter((_, j) => j !== i))}
              disabled={disabled}
              title="Remove this row"
              className="w-[62px] shrink-0 text-right text-fg3 transition-colors hover:text-danger"
            >
              <Trash size={13} className="ml-auto" />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setNewRows((prev) => [...prev, { key: '', value: '' }])}
        disabled={disabled}
        className="btn btn-sm self-start"
      >
        <Plus size={12} /> Add variable
      </button>

      {locked.length > 0 && (
        <div className="mt-1 flex flex-col gap-1.5 border-t border-rule pt-3">
          <span className="flex items-center gap-1.5 text-xs text-fg3">
            <LockSimple size={12} weight="fill" />
            Managed by onboard.js — editing these here would be overwritten or orphan the project.
          </span>
          {locked.map((row) => (
            <div key={row.key} className="flex items-center gap-3 py-0.5">
              <span className="w-[38%] shrink-0 truncate font-mono text-xs text-fg3">{row.key}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-fg3" title={row.value}>
                {row.value}
              </span>
              <span className="w-[62px] shrink-0" />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
