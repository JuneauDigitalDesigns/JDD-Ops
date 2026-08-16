'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardText, CurrencyDollar, Stack, Wrench } from '@phosphor-icons/react';
import { useClient, type ToolState } from '@/components/client/ClientProvider';
import { ToolsSlot } from './slots';

/**
 * The NAVIGATE zone: the three things you can do to a client.
 *
 * A single segmented control rather than three loose `btn btn-xs` buttons. The three tools
 * are one mutually-exclusive choice, and three separate buttons sitting in a gap-1.5 row
 * looked exactly like the three separate actions that used to sit next to them — which is
 * how the old bar ended up unreadable.
 *
 * Lives in the /c/[slug] layout, so it survives every navigation between tools: the client
 * is chosen once at the root picker and never asked for again.
 */

/**
 * Four phases, in the order a client passes through them. Account is last because it is
 * the only one that means anything after the work is finished — everything before it is
 * getting them live, and it is what the relationship becomes afterwards.
 */
const TOOLS = [
  { id: 'build', label: 'Build', Icon: Stack },
  { id: 'onboard', label: 'Onboard', Icon: ClipboardText },
  { id: 'manage', label: 'Manage', Icon: Wrench },
  { id: 'account', label: 'Account', Icon: CurrencyDollar },
] as const;

export default function ToolSwitcher() {
  const { ctx, tools } = useClient();
  const pathname = usePathname() ?? '';

  return (
    <ToolsSlot>
      <div
        role="tablist"
        aria-label="Client tools"
        className="flex items-center overflow-hidden rounded-[var(--radius-control)] border border-rule"
      >
        {TOOLS.map(({ id, label, Icon }, i) => (
          <Segment
            key={id}
            href={`/c/${ctx.slug}/${id}`}
            label={label}
            icon={<Icon size={13} />}
            active={pathname.startsWith(`/c/${ctx.slug}/${id}`)}
            state={tools[id]}
            first={i === 0}
          />
        ))}
      </div>
    </ToolsSlot>
  );
}

/**
 * Unavailable tools stay VISIBLE and dimmed rather than hidden. The three tools are a
 * pipeline, and hiding the ones a client hasn't reached yet removes the only cue for where
 * it's headed — and makes the control change width per client.
 *
 * A disabled segment is a <span>, not a <button disabled>. Disabled buttons don't fire
 * hover events in every browser, which would swallow the `title` explaining WHY it's
 * disabled — and that explanation is the entire point of showing the segment at all.
 */
function Segment({
  href,
  label,
  icon,
  active,
  state,
  first,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  state: ToolState;
  first: boolean;
}) {
  const base = `flex h-[28px] items-center gap-1.5 px-2.5 text-[12.5px] font-medium transition-colors ${
    first ? '' : 'border-l border-rule'
  }`;

  if (!state.enabled) {
    return (
      <span
        aria-disabled="true"
        title={state.reason ?? undefined}
        className={`${base} cursor-not-allowed text-fg3 opacity-45`}
      >
        {icon} {label}
      </span>
    );
  }

  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className={base}
      style={
        active
          ? { background: 'var(--accent-2)', color: 'var(--on-accent-2)' }
          : { color: 'var(--fg-2)' }
      }
    >
      {icon} {label}
    </Link>
  );
}
