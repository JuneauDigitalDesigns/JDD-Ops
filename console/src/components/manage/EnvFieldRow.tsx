'use client';

import { ArrowCounterClockwise } from '@phosphor-icons/react';
import { DRIFT_LABEL, driftColor, isDrifted } from '@/lib/envDrift';
import type { DriftState, FieldView } from '@/lib/useEnvEditor';
import SecretValue from './SecretValue';
import DriftDiff from './DriftDiff';

/**
 * One curated env field: label, control, help, drift state, and a revert when edited.
 *
 * Uses .field-label (14px) rather than the .kicker the old component reached for —
 * kicker is an all-caps 11.5px section eyebrow, and using it for form labels is what made
 * the previous env editor read as a wall of tiny uppercase text.
 */
export default function EnvFieldRow({
  field,
  slug,
  siteSlug,
  value,
  dirty,
  drift,
  disabled,
  onChange,
  onRevert,
  onSynced,
}: {
  field: FieldView;
  slug: string;
  siteSlug: string;
  value: string;
  dirty: boolean;
  drift: DriftState | null;
  disabled: boolean;
  onChange: (value: string) => void;
  onRevert: () => void;
  onSynced: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 border-b border-rule py-3.5 last:border-b-0">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={`env-${field.key}`} className="field-label !mb-0">
          {field.label}
          {dirty && (
            <span className="ml-2 text-2xs" style={{ color: 'var(--accent)' }}>
              edited
            </span>
          )}
        </label>

        <span className="flex shrink-0 items-center gap-2.5">
          {drift && (
            <span className="text-2xs" style={{ color: driftColor(drift) }}>
              {DRIFT_LABEL[drift]}
            </span>
          )}
          {dirty && (
            <button
              type="button"
              onClick={onRevert}
              title="Discard this change"
              className="flex items-center gap-1 text-2xs text-fg3 transition-colors hover:text-fg"
            >
              <ArrowCounterClockwise size={12} /> revert
            </button>
          )}
        </span>
      </div>

      {/* A masked secret is displayed, never edited: the value on screen is a sentinel,
          and making it an input invites writing `••••••••` over a real credential. */}
      {field.masked ? (
        <SecretValue slug={slug} siteSlug={siteSlug} envKey={field.key} masked={field.value} />
      ) : field.kind === 'select' ? (
        <select
          id={`env-${field.key}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        >
          <option value="">(unset)</option>
          {field.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={`env-${field.key}`}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={field.placeholder ?? ''}
          spellCheck={false}
        />
      )}

      <p className="text-xs text-fg3">{field.help}</p>

      {isDrifted(drift) && (
        <DriftDiff
          slug={slug}
          siteSlug={siteSlug}
          envKey={field.key}
          localValue={field.value}
          state={drift}
          onSynced={onSynced}
        />
      )}
    </div>
  );
}
