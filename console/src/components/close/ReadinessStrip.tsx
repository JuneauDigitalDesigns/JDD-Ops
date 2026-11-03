import type { ReadinessLight, ReadinessTone } from '@jdd/schema';

const TONE: Record<ReadinessTone, string> = {
  ok: 'var(--ok)',
  wait: 'var(--accent)',
  warn: 'var(--warn)',
  bad: 'var(--danger)',
  off: 'var(--rule-strong)',
};

/**
 * The four lights on a client closed on a call: Payment · Onboarding · SMS brand · SMS campaign.
 * Values and tones come from `readinessFor` in `@jdd/schema`; this only draws them. The colour is
 * never the only signal — every light carries its word.
 */
export default function ReadinessStrip({ lights, compact = false }: { lights: ReadinessLight[]; compact?: boolean }) {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-4 ${compact ? 'gap-1.5' : 'gap-2.5'}`}>
      {lights.map((l) => (
        <div
          key={l.id}
          className={`flex min-w-0 flex-col gap-1 rounded-[10px] border border-[var(--rule)] bg-[var(--panel)] ${compact ? 'p-2' : 'p-3.5'}`}
          style={{ borderTop: `${compact ? 3 : 4}px solid ${TONE[l.tone]}` }}
        >
          <span className="field-label truncate">{l.label}</span>
          <span className={`flex items-center gap-1.5 font-semibold text-fg ${compact ? 'text-[13px]' : 'text-[15px]'}`}>
            <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: TONE[l.tone] }} aria-hidden />
            {l.value}
          </span>
        </div>
      ))}
    </div>
  );
}
