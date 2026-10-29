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
    <div className="flex items-center gap-2 border-b border-uiRule bg-uiBg px-4 py-2.5">
      <span className="mr-1 font-chromeMono text-[10px] uppercase tracking-widest text-uiFg3">
        Industry
      </span>
      {VERTICALS.map((v) => (
        <button
          key={v.id}
          type="button"
          onClick={() => onChange(v.id)}
          className={[
            'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors',
            vertical === v.id
              ? 'bg-uiAccent text-uiAccentInk'
              : 'border border-uiRule bg-uiSurface text-uiFg2 hover:border-uiRuleStrong hover:text-uiFg',
          ].join(' ')}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
