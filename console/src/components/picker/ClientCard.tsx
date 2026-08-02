'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Stack, ClipboardText, Wrench } from '@phosphor-icons/react';
import type { ClientContext, ClientState, OpsConfig, RunbookState } from '@/lib/types';
import { buildRunbook, PLAN_LABEL } from '@/lib/runbook-content';
import { firstIncomplete, flatten, progressOf } from '@/lib/runbook-nav';
import { effectiveStatus } from '@/lib/kanban';
import { STATUS_LABEL, STATUS_COLOR } from '@/lib/status-meta';
import { relativeTime, absoluteTime } from '@/lib/relativeTime';
import type { ClientHealth } from '@/lib/health';
import type { AttentionItem } from '@/lib/attention';
import PhaseMeter from '@/components/PhaseMeter';

/**
 * One client, as a card.
 *
 * The name is the biggest thing on it, deliberately. This grid exists so you can find the
 * client you're already thinking of, and every pixel spent on chrome above the name is a
 * pixel spent on something you weren't looking for.
 *
 * The colour band along the top is the client's OWN accent, read from site.ts. That is what
 * makes a wall of cards navigable at 15–50 clients: you learn a client's colour long before
 * you finish reading its name, so the grid becomes recognisable rather than merely readable.
 * Clients with no readable site.ts fall back to the rule colour and simply look neutral.
 *
 * Card content changes with life stage, same principle as the row it replaced: in-flight
 * clients show how far through onboarding they are; live clients show where they serve from,
 * because a full meter reading "12/12" is stale trivia on a site that shipped months ago.
 */
export default function ClientCard({
  ctx, clientState, config, health, lastTouched, attention, onSelect,
}: {
  ctx: ClientContext;
  clientState: ClientState | undefined;
  config: OpsConfig;
  health?: ClientHealth;
  lastTouched?: string;
  attention?: AttentionItem;
  onSelect: () => void;
}) {
  const phases = useMemo(() => buildRunbook(ctx, config), [ctx, config]);
  const nodes = useMemo(() => flatten(phases), [phases]);
  const done = useMemo(
    () => new Set(Object.entries(clientState?.steps ?? {}).filter(([, v]) => v).map(([k]) => k)),
    [clientState],
  );
  const { total, completed } = progressOf(nodes, done);
  const next = firstIncomplete(nodes, done);

  const state = useMemo<RunbookState>(
    () => (clientState ? { [ctx.slug]: clientState } : {}),
    [ctx.slug, clientState],
  );
  const status = effectiveStatus(ctx, state);
  const isLive = status === 'live';

  const accent = ctx.sites[0]?.accent ?? null;
  const band = attention
    ? attention.kind === 'down'
      ? 'var(--danger)'
      : 'var(--warn)'
    : (accent ?? 'var(--rule-strong)');

  const up = health?.http?.ok;
  const dot = up === undefined ? null : up ? 'var(--ok)' : 'var(--danger)';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className="panel group relative flex cursor-pointer flex-col overflow-hidden p-0 text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-accent hover:shadow-panel focus:outline-none focus-visible:ring-2 focus-visible:ring-uiAccent"
    >
      {/* The client's own colour. Also the attention signal when something is wrong — one
          band doing both jobs, because a card can only have one most-important fact. */}
      <span aria-hidden className="h-1 w-full shrink-0" style={{ background: band }} />

      <div className="flex min-w-0 flex-1 flex-col gap-3 p-5">
        <div className="min-w-0">
          {/* Big, tight, and allowed two lines — a truncated brand name defeats the point. */}
          <h3 className="font-display text-[26px] font-semibold leading-[1.1] tracking-tightish text-fg">
            {ctx.brandName}
          </h3>
          <p className="mono mt-1 truncate text-2xs text-fg3">{ctx.slug}</p>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="meta">{PLAN_LABEL[ctx.plan]}</span>
          <span aria-hidden className="text-fg3">·</span>
          <span className="text-xs font-medium" style={{ color: STATUS_COLOR[status] }}>
            {STATUS_LABEL[status]}
          </span>
          {ctx.isEnterprise && ctx.sites.length > 1 && (
            <span className="meta" style={{ color: 'var(--accent)' }}>
              {ctx.sites.length} sites
            </span>
          )}
        </div>

        {/* Life-stage slot */}
        <div className="mt-auto flex flex-col gap-1.5">
          {isLive ? (
            <span className="mono truncate text-2xs text-fg3" title={health?.liveUrl ?? undefined}>
              {health?.liveUrl ? health.liveUrl.replace(/^https?:\/\//, '') : '—'}
            </span>
          ) : (
            <>
              <PhaseMeter phases={phases} done={done} color={STATUS_COLOR[status]} />
              <span className="meta">
                {completed}/{total} steps
                {next ? ` · next: ${next.step.title}` : ''}
              </span>
            </>
          )}

          <div className="flex items-center gap-2 text-2xs text-fg3">
            {dot && (
              <span className="flex items-center gap-1.5">
                <span
                  className="h-[6px] w-[6px] rounded-full"
                  style={{ background: dot, boxShadow: `0 0 6px 1px ${dot}` }}
                />
                <span style={{ color: dot }}>{up ? 'up' : 'down'}</span>
              </span>
            )}
            {lastTouched && (
              <span title={absoluteTime(lastTouched)}>touched {relativeTime(lastTouched)}</span>
            )}
          </div>

          {attention && (
            <p
              className="text-2xs font-medium"
              style={{ color: attention.kind === 'down' ? 'var(--danger)' : 'var(--warn)' }}
            >
              {attention.reason}
            </p>
          )}
        </div>
      </div>

      {/* Straight to a tool, skipping the shell's status routing. Always in the DOM (so it
          doesn't reflow on hover) but only visible on hover/focus-within. */}
      <div className="flex items-center gap-1 border-t border-rule px-3 py-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <ToolLink slug={ctx.slug} tool="build" label="Build" icon={<Stack size={12} />} />
        <ToolLink slug={ctx.slug} tool="onboard" label="Onboard" icon={<ClipboardText size={12} />} />
        <ToolLink slug={ctx.slug} tool="manage" label="Manage" icon={<Wrench size={12} />} />
      </div>
    </div>
  );
}

function ToolLink({
  slug, tool, label, icon,
}: {
  slug: string;
  tool: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={`/c/${slug}/${tool}`}
      // The card itself is clickable; without this a tool click would also fire the card's
      // handler and race two navigations.
      onClick={(e) => e.stopPropagation()}
      className="btn btn-xs"
    >
      {icon} {label}
    </Link>
  );
}
