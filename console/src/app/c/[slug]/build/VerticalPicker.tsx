'use client';
import { VERTICALS, type VerticalId } from '@/lib/verticals';

/**
 * The copywriter vertical, and where it came from.
 *
 * `clientPicked` is the industry the business owner chose during onboarding, when they
 * chose one. Showing it matters because this select is preselected from their answer and
 * otherwise looks identical to a default nobody chose — and the vertical drives both the
 * preset baseline and the copywriter's system prompt, so silently overriding a client's
 * answer is worth making visible.
 *
 * Still fully editable. A client who picked "Other", or picked wrong, is exactly why the
 * manual control stays.
 */
export default function VerticalPicker({
  vertical,
  clientPicked,
  onChange,
}: {
  vertical: VerticalId;
  /** The client's own industry answer, if the intake carried one. */
  clientPicked?: VerticalId | null;
  onChange: (v: VerticalId) => void;
}) {
  const overridden = Boolean(clientPicked) && clientPicked !== vertical;

  return (
    <span className="inline-flex items-center gap-1.5">
      <select
        value={vertical}
        onChange={(e) => onChange(e.target.value as VerticalId)}
        aria-label="Industry"
        className="rounded-md border border-uiRule bg-uiSurface px-2 py-1 font-chromeMono text-xs text-uiFg2 outline-none focus:border-uiAccent"
      >
        {VERTICALS.map((v) => (
          <option key={v.id} value={v.id}>{v.label}</option>
        ))}
      </select>

      {clientPicked && !overridden && (
        <span className="font-chromeMono text-[10px] text-uiFg3" title="Preselected from the client's onboarding answer">
          from client
        </span>
      )}
      {overridden && (
        <span
          className="font-chromeMono text-[10px]"
          style={{ color: 'var(--warn)' }}
          title={`The client chose ${VERTICALS.find((v) => v.id === clientPicked)?.label ?? clientPicked}`}
        >
          overriding client
        </span>
      )}
    </span>
  );
}
