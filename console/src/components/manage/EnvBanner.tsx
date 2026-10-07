import type { OpsConfig } from '@/lib/types';

/**
 * Environment banner. Server-renderable (no hooks) so it can sit in the manage layout and
 * the roster page. Renders nothing in `test`: the signal is only worth anything if it is
 * absent when there is nothing to warn about.
 */
export default function EnvBanner({
  envMode,
  envSignals,
}: Pick<OpsConfig, 'envMode' | 'envSignals'>) {
  if (!envMode || envMode === 'test') return null;

  if (envMode === 'production') {
    return (
      <div
        role="status"
        className="flex shrink-0 items-center gap-2 px-4 text-[11px] font-semibold uppercase"
        style={{
          height: 26,
          background: 'var(--accent)',
          color: 'var(--accent-ink)',
          letterSpacing: 'var(--tracking-widest)',
        }}
      >
        Production, live customer data
      </div>
    );
  }

  const prod = (envSignals ?? []).filter((s) => s.signal === 'production').map((s) => s.label);
  const test = (envSignals ?? []).filter((s) => s.signal === 'test').map((s) => s.label);
  const detail =
    prod.length && test.length
      ? `${prod.join(', ')} are live but ${test.join(', ')} ${test.length > 1 ? 'are' : 'is'} on test.`
      : 'Credentials point at different environments.';

  return (
    <div
      role="alert"
      className="flex shrink-0 flex-wrap items-center gap-x-3 px-4 py-1 text-[11px] font-semibold uppercase"
      style={{
        background: 'var(--danger)',
        color: 'var(--on-accent-2)',
        letterSpacing: 'var(--tracking-widest)',
      }}
    >
      <span>Mixed environment, writes may land on the wrong instance</span>
      <span style={{ opacity: 0.9 }}>{detail}</span>
    </div>
  );
}
