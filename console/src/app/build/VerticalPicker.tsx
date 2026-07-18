'use client';
import { VERTICALS, type VerticalId } from '@/lib/verticals';

export default function VerticalPicker({
  vertical,
  onChange,
}: {
  vertical: VerticalId;
  onChange: (v: VerticalId) => void;
}) {
  return (
    <select
      value={vertical}
      onChange={(e) => onChange(e.target.value as VerticalId)}
      aria-label="Industry"
      className="rounded-md border border-uiRule bg-uiSurface px-2 py-1 font-chromeMono text-[11px] text-uiFg2 outline-none focus:border-uiAccent"
    >
      {VERTICALS.map((v) => (
        <option key={v.id} value={v.id}>{v.label}</option>
      ))}
    </select>
  );
}
