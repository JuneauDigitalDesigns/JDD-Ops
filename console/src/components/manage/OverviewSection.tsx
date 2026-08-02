'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowSquareOut,
  ArrowsClockwise,
  CheckCircle,
  Globe,
  Question,
  RocketLaunch,
  Sliders,
  Warning,
  XCircle,
} from '@phosphor-icons/react';
import { relativeTime, absoluteTime } from '@/lib/relativeTime';
import type { AuditEntry } from '@/lib/audit';
import { useManage } from './ManageContext';
import SectionHeader from './SectionHeader';

/**
 * The client landing: is anything wrong, what changed recently, and what would I do next.
 *
 * Each tile owns its own request and its own failure. A missing Vercel token should grey
 * out one tile, not blank the page — which is why nothing here is fetched in a single
 * combined call.
 */

type Tone = 'ok' | 'warn' | 'danger' | 'idle';

interface DeployInfo {
  state: string;
  createdAt: number | null;
  inspectorUrl: string | null;
}

export default function OverviewSection() {
  // `domains` comes from the shared context — the rail and the Domain section read the same
  // object, so the three can't disagree about where the site lives.
  const { ctx, site, domains } = useManage();
  const params = useSearchParams();
  const qs = params.get('site') ? `?site=${encodeURIComponent(params.get('site') as string)}` : '';

  const [deploy, setDeploy] = useState<{ loading: boolean; data: DeployInfo | null; reason?: string }>({
    loading: true,
    data: null,
  });
  const [drift, setDrift] = useState<{ loading: boolean; count: number | null; reason?: string }>({
    loading: false,
    count: null,
  });
  const [activity, setActivity] = useState<AuditEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const q = new URLSearchParams({ slug: ctx.slug, site: site.slug, limit: '1' });
      try {
        const res = await fetch(`/api/manage/deployments?${q.toString()}`, { cache: 'no-store' });
        const body = (await res.json()) as {
          reason?: string;
          error?: string;
          deployments?: DeployInfo[];
        };
        if (!cancelled) {
          setDeploy({
            loading: false,
            data: body.deployments?.[0] ?? null,
            reason: body.error ?? body.reason,
          });
        }
      } catch {
        if (!cancelled) setDeploy({ loading: false, data: null, reason: 'Lookup failed.' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ctx.slug, site.slug]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/manage/audit?slug=${encodeURIComponent(ctx.slug)}&limit=6`, {
          cache: 'no-store',
        });
        const body = (await res.json()) as { entries?: AuditEntry[] };
        if (!cancelled) setActivity(body.entries ?? []);
      } catch {
        if (!cancelled) setActivity([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ctx.slug]);

  /** Drift is opt-in here too — one Vercel request per key. */
  const checkDrift = useCallback(async () => {
    setDrift({ loading: true, count: null });
    try {
      const q = new URLSearchParams({ slug: ctx.slug, site: site.slug });
      const res = await fetch(`/api/manage/env?${q.toString()}`, { cache: 'no-store' });
      const body = (await res.json()) as {
        sites?: Array<{ slug: string; vercel: { ok: boolean; reason?: string; drift: Array<{ state: string }> } }>;
      };
      const s = body.sites?.find((x) => x.slug === site.slug) ?? body.sites?.[0];
      if (!s?.vercel.ok) {
        setDrift({ loading: false, count: null, reason: s?.vercel.reason ?? 'Check failed.' });
        return;
      }
      const count = s.vercel.drift.filter(
        (d) => d.state === 'differs' || d.state === 'missing-remote',
      ).length;
      setDrift({ loading: false, count });
    } catch {
      setDrift({ loading: false, count: null, reason: 'Check failed.' });
    }
  }, [ctx.slug, site.slug]);

  const liveUrl = domains.liveUrl;

  // Three genuinely different situations the old tile blurred together:
  //   - serving on the Vercel alias with no custom domain — normal, not a problem
  //   - a custom domain attached and verified — the goal
  //   - site.ts advertising a canonical that nothing serves — actually wrong
  const custom = domains.domains.filter((d) => !d.name.endsWith('.vercel.app'));
  const canonicalMismatch =
    Boolean(domains.canonical) &&
    Boolean(domains.liveUrl) &&
    domains.canonical!.replace(/\/$/, '') !== domains.liveUrl!.replace(/\/$/, '');

  const domainTone: Tone = domains.loading
    ? 'idle'
    : canonicalMismatch
      ? 'warn'
      : custom.length && custom.every((d) => d.verified)
        ? 'ok'
        : custom.length
          ? 'warn'
          : 'idle';

  const domainDetail = domains.reason
    ? domains.reason
    : canonicalMismatch
      ? `site.ts still says ${domains.canonical} — fix in Domain`
      : custom.length
        ? custom.every((d) => d.verified)
          ? 'custom domain attached and verified'
          : 'custom domain attached, DNS pending'
        : 'serving on the Vercel alias — no custom domain';

  return (
    <div className="mx-auto w-full max-w-[900px] px-8 py-8 lg:px-10">
      <SectionHeader
        title="Overview"
        lede={`${ctx.plan} plan · ${ctx.sites.length} site${ctx.sites.length === 1 ? '' : 's'} · clients/${ctx.slug}`}
        actions={
          liveUrl && (
            <a href={liveUrl} target="_blank" rel="noreferrer" className="btn btn-sm">
              Open site <ArrowSquareOut size={13} />
            </a>
          )
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Tile
          icon={<RocketLaunch size={15} weight="fill" />}
          label="Last deploy"
          loading={deploy.loading}
          tone={
            deploy.data
              ? deploy.data.state === 'READY'
                ? 'ok'
                : deploy.data.state === 'ERROR'
                  ? 'danger'
                  : 'warn'
              : 'idle'
          }
          value={deploy.data ? relativeTime(deploy.data.createdAt) : '—'}
          detail={deploy.reason ?? (deploy.data ? deploy.data.state.toLowerCase() : 'never deployed')}
          title={absoluteTime(deploy.data?.createdAt)}
        />

        <Tile
          icon={<Globe size={15} weight="fill" />}
          label="Domain"
          loading={domains.loading}
          tone={domainTone}
          value={
            domains.liveUrl ? domains.liveUrl.replace(/^https?:\/\//, '') : 'not resolved'
          }
          detail={domainDetail}
        />

        <Tile
          icon={<Sliders size={15} weight="fill" />}
          label="Env drift"
          loading={drift.loading}
          tone={drift.count === null ? 'idle' : drift.count === 0 ? 'ok' : 'warn'}
          value={
            drift.count === null ? 'not checked' : drift.count === 0 ? 'in sync' : `${drift.count} key${drift.count === 1 ? '' : 's'}`
          }
          detail={drift.reason ?? 'disk vs Vercel · one request per key'}
          action={
            drift.loading ? undefined : (
              <button type="button" onClick={checkDrift} className="btn btn-xs">
                <ArrowsClockwise size={11} /> Check
              </button>
            )
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="panel flex flex-col gap-3 p-5">
          <h2 className="font-display text-lg font-semibold tracking-tightish text-fg">Recent activity</h2>
          {activity === null && <p className="text-xs text-fg3">Reading the audit log…</p>}
          {activity?.length === 0 && (
            <p className="text-xs text-fg3">
              Nothing yet. Every env save, sync, redeploy, portal attach, and prompt push made from
              here gets recorded.
            </p>
          )}
          {activity?.map((e, i) => (
            <div key={`${e.ts}-${i}`} className="flex items-start gap-2 border-b border-rule pb-2 last:border-b-0 last:pb-0">
              {e.ok ? (
                <CheckCircle size={13} weight="fill" style={{ color: 'var(--ok)', flexShrink: 0, marginTop: 3 }} />
              ) : (
                <XCircle size={13} weight="fill" style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 3 }} />
              )}
              <span className="min-w-0 flex-1 text-xs text-fg2">{e.summary}</span>
              <span className="shrink-0 text-xs text-fg3" title={absoluteTime(e.ts)}>
                {relativeTime(e.ts)}
              </span>
            </div>
          ))}
        </section>

        <section className="panel flex flex-col gap-2 p-5">
          <h2 className="font-display text-lg font-semibold tracking-tightish text-fg">Quick actions</h2>
          <Action href={`/c/${ctx.slug}/manage/environment${qs}`} icon={<Sliders size={14} />}>
            Edit environment
          </Action>
          <Action href={`/c/${ctx.slug}/manage/deployments${qs}`} icon={<RocketLaunch size={14} />}>
            Deployments &amp; redeploy
          </Action>
          {/* Now lands on THIS client's Build rather than a picker — the whole point of the
              client shell. */}
          <Action href={`/c/${ctx.slug}/build`} icon={<ArrowSquareOut size={14} />}>
            Edit site content in Build
          </Action>
        </section>
      </div>
    </div>
  );
}

function Tile({
  icon,
  label,
  value,
  detail,
  tone,
  loading,
  action,
  title,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string;
  tone: Tone;
  loading: boolean;
  action?: React.ReactNode;
  title?: string;
}) {
  const color =
    tone === 'ok' ? 'var(--ok)' : tone === 'warn' ? 'var(--warn)' : tone === 'danger' ? 'var(--danger)' : 'var(--fg-3)';
  return (
    <div className="panel flex flex-col gap-1.5 p-4" title={title}>
      <span className="flex items-center gap-1.5 text-xs text-fg3">
        <span style={{ color }}>{loading ? <Question size={15} /> : icon}</span>
        {label}
      </span>
      <span className="truncate text-sm font-medium text-fg" title={value}>
        {loading ? <span className="inline-block h-[10px] w-16 animate-pulse rounded-full" style={{ background: 'var(--rule)' }} /> : value}
      </span>
      {detail && !loading && <span className="text-xs text-fg3">{detail}</span>}
      {action && <span className="mt-1">{action}</span>}
    </div>
  );
}

function Action({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-[8px] px-2 py-2 text-xs text-fg2 transition-colors hover:bg-[var(--surface)] hover:text-fg"
    >
      <span className="text-fg3">{icon}</span>
      {children}
    </Link>
  );
}
