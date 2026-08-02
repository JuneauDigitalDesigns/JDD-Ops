'use client';

import Link from 'next/link';
import { Check, Warning } from '@phosphor-icons/react';

/**
 * One row in a <NavRail>. The single row implementation for both rails.
 *
 * The two rails previously had two near-identical RailRow components — same 2px accent
 * edge, same surface-2 active fill, same transition — living in different files, which is
 * how they drifted apart in padding and font size in the first place.
 *
 * They differ in exactly two ways, both expressed as props here rather than as a fork:
 *   • /manage rows are <Link>s (a URL per section); runbook rows are <button>s (local state).
 *     Pass `href` or `onClick`.
 *   • The leading element is an icon (/manage), a numbered circle, or a REF tag (runbook).
 *     Pass `leading`.
 *
 * The active marker is an ABSOLUTE 2px edge rather than a border-left. A border swap would
 * nudge every label sideways by 2px as you move between rows.
 */
export default function RailRow({
  label,
  leading,
  active,
  href,
  onClick,
  badge,
  sublabel,
  trailing,
  struck,
  muted,
}: {
  label: string;
  leading: React.ReactNode;
  active: boolean;
  href?: string;
  onClick?: () => void;
  /** Attention count, e.g. 2 drifted env keys. Rendered warn-toned. */
  badge?: number;
  /** Secondary line under the label — the runbook's `est` duration. */
  sublabel?: string;
  /** Right-aligned marker — the runbook's launch bolt. */
  trailing?: React.ReactNode;
  /** Completed and not current: struck through. */
  struck?: boolean;
  /** Reference rows, which are read rather than done. */
  muted?: boolean;
}) {
  const inner = (
    <>
      {active && (
        <span
          className="absolute inset-y-0 left-0 w-[2px]"
          style={{ background: 'var(--accent)' }}
          aria-hidden
        />
      )}

      <span className="mt-[1px] flex shrink-0 items-center justify-center">{leading}</span>

      <span className="min-w-0 flex-1">
        <span
          className="block text-xs leading-[1.4] transition-colors"
          style={{
            color: active ? 'var(--fg)' : muted ? 'var(--fg-3)' : 'var(--fg-2)',
            fontWeight: active ? 500 : 400,
            textDecoration: struck ? 'line-through' : undefined,
          }}
        >
          {label}
        </span>
        {sublabel && <span className="meta mt-0.5 block">{sublabel}</span>}
      </span>

      {badge !== undefined && badge > 0 && (
        <span
          className="flex shrink-0 items-center gap-1 text-2xs"
          style={{ color: 'var(--warn)' }}
          title={`${badge} item${badge === 1 ? '' : 's'} need attention`}
        >
          <Warning size={12} weight="fill" />
          {badge}
        </span>
      )}

      {trailing}
    </>
  );

  const cls = 'group relative flex w-full items-start gap-2.5 py-2 pl-4 pr-3 text-left transition-colors';
  const style = { background: active ? 'var(--surface-2)' : undefined };

  if (href) {
    return (
      <Link href={href} aria-current={active ? 'page' : undefined} className={cls} style={style}>
        {inner}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'step' : undefined}
      className={cls}
      style={style}
    >
      {inner}
    </button>
  );
}

/** The runbook's numbered circle — fills accent and swaps to a check on completion. */
export function StepNumber({
  n,
  done,
  active,
}: {
  n: number;
  done: boolean;
  active: boolean;
}) {
  return (
    <span
      className="flex h-[18px] w-[18px] items-center justify-center rounded-full border text-[10px] font-medium transition-colors"
      style={
        done
          ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: 'var(--accent-ink)' }
          : { borderColor: active ? 'var(--accent)' : 'var(--rule-strong)', color: 'var(--fg-3)' }
      }
    >
      {done ? <Check size={11} weight="bold" /> : n}
    </span>
  );
}

/**
 * Reference steps get a REF tag instead of a numbered circle. They are the architecture
 * screens — read, not done — so giving them a checkbox would put them in the progress
 * count and make 100% unreachable.
 *
 * This was an inline `style={{ fontSize: 8.5 }}` on a .kicker. 8.5px all-caps mono is not
 * a size anyone should have to read; .meta at 11px is both denser overall AND legible.
 */
export function RefTag() {
  return <span className="meta w-[18px] text-center">REF</span>;
}
