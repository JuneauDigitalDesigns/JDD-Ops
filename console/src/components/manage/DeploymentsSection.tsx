'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowSquareOut, ArrowsClockwise, RocketLaunch, Warning } from '@phosphor-icons/react';
import { relativeTime, absoluteTime } from '@/lib/relativeTime';
import { useManage } from './ManageContext';
import SectionHeader from './SectionHeader';

/**
 * Recent builds, and the redeploy button.
 *
 * Redeploy lives here rather than only appearing inside the env save panel, which is
 * where it used to hide — you often want to reapply config without having just edited it.
 * No rollback: promoting an old deployment over a live client site is a different kind of
 * decision from "reapply my env change", and mixing them into one list invites a misclick.
 */

interface DeploymentRecord {
  id: string;
  url: string | null;
  inspectorUrl: string | null;
  state: string;
  target: string | null;
  createdAt: number | null;
  readyAt: number | null;
  commitSha: string | null;
  commitMessage: string | null;
  creator: string | null;
}

function stateColor(state: string): string {
  if (state === 'READY') return 'var(--ok)';
  if (state === 'ERROR' || state === 'CANCELED') return 'var(--danger)';
  return 'var(--warn)';
}

export default function DeploymentsSection() {
  const { ctx, site } = useManage();
  const [rows, setRows] = useState<DeploymentRecord[] | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string; href?: string | null } | null>(null);

  const load = useCallback(async () => {
    setRows(null);
    setReason(null);
    try {
      const qs = new URLSearchParams({ slug: ctx.slug, site: site.slug, limit: '10' });
      const res = await fetch(`/api/manage/deployments?${qs.toString()}`, { cache: 'no-store' });
      const body = (await res.json()) as {
        ok?: boolean;
        reason?: string;
        error?: string;
        deployments?: DeploymentRecord[];
      };
      if (body.error || body.reason) setReason(body.error ?? body.reason ?? null);
      setRows(body.deployments ?? []);
    } catch (err) {
      setReason(err instanceof Error ? err.message : 'Failed to list deployments.');
      setRows([]);
    }
  }, [ctx.slug, site.slug]);

  useEffect(() => {
    void load();
  }, [load]);

  async function redeploy() {
    setDeploying(true);
    setNotice(null);
    try {
      const res = await fetch('/api/manage/env/redeploy', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: ctx.slug, siteSlug: site.slug }),
      });
      const body = (await res.json()) as {
        error?: string;
        deployment?: { inspectorUrl: string | null };
      };
      if (body.error) setNotice({ ok: false, text: body.error });
      else {
        setNotice({ ok: true, text: 'Deployment queued.', href: body.deployment?.inspectorUrl });
        // The new build won't be in the list we already fetched.
        setTimeout(() => void load(), 1500);
      }
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : 'Redeploy failed.' });
    } finally {
      setDeploying(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[900px] px-8 py-8 lg:px-10">
      <SectionHeader
        title="Deployments"
        lede="Env changes are inert until the site rebuilds — this is where you apply them."
        actions={
          <>
            <button type="button" onClick={() => void load()} className="btn btn-sm" title="Refresh">
              <ArrowsClockwise size={13} />
            </button>
            <button type="button" onClick={redeploy} disabled={deploying} className="btn btn-primary btn-sm">
              {deploying ? (
                <ArrowsClockwise size={13} className="animate-spin" />
              ) : (
                <RocketLaunch size={13} weight="fill" />
              )}
              {deploying ? 'Deploying…' : 'Redeploy'}
            </button>
          </>
        }
      />

      {notice && (
        <div
          className="mb-4 flex items-center gap-2 rounded-[10px] border px-3 py-2 text-xs"
          style={{
            borderColor: notice.ok ? 'var(--ok)' : 'var(--danger)',
            background: notice.ok ? 'var(--ok-glow)' : 'var(--danger-glow)',
            color: 'var(--fg-2)',
          }}
        >
          {notice.text}
          {notice.href && (
            <a href={notice.href} target="_blank" rel="noreferrer" className="underline">
              Watch the build
            </a>
          )}
        </div>
      )}

      {reason && (
        <div className="mb-4 flex items-center gap-2 text-xs" style={{ color: 'var(--warn)' }}>
          <Warning size={14} /> {reason}
        </div>
      )}

      <section className="panel flex flex-col p-5">
        {rows === null && <p className="py-8 text-center text-xs text-fg3">Loading deployments…</p>}
        {rows?.length === 0 && !reason && (
          <p className="py-8 text-center text-xs text-fg3">
            No production deployments yet for {site.slug}.
          </p>
        )}

        {rows?.map((d) => (
          <div key={d.id} className="flex items-center gap-3 border-b border-rule py-3 last:border-b-0">
            <span
              className="h-[7px] w-[7px] shrink-0 rounded-full"
              style={{ background: stateColor(d.state) }}
              title={d.state}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-sm text-fg" title={d.commitMessage ?? undefined}>
                {d.commitMessage ?? '(no commit message)'}
              </span>
              <span className="truncate font-mono text-xs text-fg3">
                {d.commitSha ? d.commitSha.slice(0, 7) : d.id.slice(0, 12)}
                {d.creator && ` · ${d.creator}`}
                {d.state !== 'READY' && ` · ${d.state.toLowerCase()}`}
              </span>
            </div>
            <span className="w-[54px] shrink-0 text-right text-xs text-fg2" title={absoluteTime(d.createdAt)}>
              {relativeTime(d.createdAt)}
            </span>
            {d.inspectorUrl && (
              <a
                href={d.inspectorUrl}
                target="_blank"
                rel="noreferrer"
                title="Open in Vercel"
                className="shrink-0 text-fg3 transition-colors hover:text-accent"
              >
                <ArrowSquareOut size={14} />
              </a>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
