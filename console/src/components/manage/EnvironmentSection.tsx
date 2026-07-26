'use client';

import {
  ArrowsClockwise,
  CheckCircle,
  CloudArrowUp,
  RocketLaunch,
  Warning,
  XCircle,
} from '@phosphor-icons/react';
import { useState } from 'react';
import { ENV_GROUPS } from '@/lib/envFields';
import { useEnvEditor } from '@/lib/useEnvEditor';
import { useManage } from './ManageContext';
import SectionHeader from './SectionHeader';
import EnvFieldRow from './EnvFieldRow';
import AdvancedTable from './AdvancedTable';
import SaveBar from './SaveBar';

/**
 * The env editor: curated fields grouped by what they actually do, then everything else.
 *
 * Grouping is the main change from the old flat list — "ring seconds" and "Airtable base"
 * sat in the same undifferentiated stack, so nothing signalled that one is call routing
 * and the other is an integration. Empty groups self-hide, which matters for starter
 * clients: they have Lead delivery vars only, and would otherwise show two empty panels.
 */
export default function EnvironmentSection() {
  const { ctx, site: siteInfo } = useManage();
  const env = useEnvEditor(ctx.slug, siteInfo.slug);
  const [deploying, setDeploying] = useState(false);
  const [deployed, setDeployed] = useState<{ error?: string; deployment?: { inspectorUrl: string | null } } | null>(null);

  const { site } = env;

  async function redeploy() {
    setDeploying(true);
    setDeployed(null);
    try {
      const res = await fetch('/api/manage/env/redeploy', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: ctx.slug, siteSlug: siteInfo.slug }),
      });
      setDeployed(await res.json());
    } catch (err) {
      setDeployed({ error: err instanceof Error ? err.message : 'Redeploy failed.' });
    } finally {
      setDeploying(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[900px] px-8 py-8 lg:px-10">
      <SectionHeader
        title="Environment"
        lede={`Edits write clients/${ctx.slug}/.env.local, then push to Vercel. A redeploy is required before the live site picks them up.`}
        actions={
          env.driftLoading ? (
            <span className="flex items-center gap-1.5 text-xs text-fg3">
              <ArrowsClockwise size={13} className="animate-spin" /> checking drift…
            </span>
          ) : env.driftCount > 0 ? (
            <span className="badge badge-warn">
              <span className="dot" />
              {env.driftCount} out of sync
            </span>
          ) : site?.vercel.ok ? (
            <span className="badge badge-ok">
              <span className="dot" />
              in sync with Vercel
            </span>
          ) : null
        }
      />

      {env.loadError && (
        <div className="mb-4 flex items-center gap-2 text-xs" style={{ color: 'var(--danger)' }}>
          <Warning size={14} /> {env.loadError}
        </div>
      )}

      {env.loading && <p className="py-12 text-center text-xs text-fg3">Reading .env.local…</p>}

      {site && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-fg3">
            <CloudArrowUp size={13} />
            {site.vercel.ok ? (
              <span>
                Vercel project <span className="text-fg2">{site.vercel.projectName}</span>
              </span>
            ) : (
              <span style={{ color: env.driftLoading ? 'var(--fg-3)' : 'var(--warn)' }}>
                {site.vercel.reason}
              </span>
            )}
          </div>

          {!site.envExists && (
            <div className="mb-4 flex items-center gap-2 text-xs" style={{ color: 'var(--danger)' }}>
              <Warning size={14} /> No .env.local yet — this site hasn&apos;t been provisioned.
            </div>
          )}

          <div className="flex flex-col gap-4">
            {ENV_GROUPS.map((group) => {
              const fields = site.fields.filter((f) => (f.group ?? 'advanced') === group.id);
              if (fields.length === 0) return null; // starter has routing/integrations empty
              return (
                <section key={group.id} className="panel flex flex-col gap-1 p-5">
                  <header className="mb-1 flex flex-col gap-1">
                    <h2 className="font-display text-lg font-semibold tracking-tightish text-fg">
                      {group.label}
                    </h2>
                    <p className="text-xs text-fg3">{group.help}</p>
                  </header>
                  {fields.map((field) => (
                    <EnvFieldRow
                      key={field.key}
                      field={field}
                      slug={ctx.slug}
                      siteSlug={site.slug}
                      value={env.valueOf(field.key, field.value)}
                      dirty={field.key in env.draft}
                      drift={env.driftFor(field.key)}
                      disabled={env.saving}
                      onChange={(v) => env.set(field.key, v)}
                      onRevert={() => env.revert(field.key)}
                      onSynced={() => void env.reload()}
                    />
                  ))}
                </section>
              );
            })}

            <AdvancedTable
              slug={ctx.slug}
              siteSlug={site.slug}
              advanced={site.advanced}
              locked={site.locked}
              newRows={env.newRows}
              setNewRows={env.setNewRows}
              valueOf={env.valueOf}
              onChange={env.set}
              driftFor={env.driftFor}
              disabled={env.saving}
            />
          </div>

          {env.saved && <SaveResult saved={env.saved} deploying={deploying} deployed={deployed} onRedeploy={redeploy} />}

          {env.dirty && (
            <SaveBar
              changedKeys={env.changedKeys}
              saving={env.saving}
              onSave={() => void env.save()}
              onRevertAll={env.revertAll}
            />
          )}
        </>
      )}
    </div>
  );
}

/** Outcome of the last save, including the redeploy prompt. */
function SaveResult({
  saved,
  deploying,
  deployed,
  onRedeploy,
}: {
  saved: NonNullable<ReturnType<typeof useEnvEditor>['saved']>;
  deploying: boolean;
  deployed: { error?: string; deployment?: { inspectorUrl: string | null } } | null;
  onRedeploy: () => void;
}) {
  return (
    <div className="mt-4 flex flex-col gap-2 rounded-[10px] border border-rule p-3" style={{ background: 'var(--bg-deep)' }}>
      {saved.error && (
        <Line tone="danger" icon={<XCircle size={14} weight="fill" />}>
          {saved.error}
        </Line>
      )}
      {saved.ok && saved.noop && <span className="text-xs text-fg3">Nothing changed.</span>}
      {saved.ok && saved.written && !saved.noop && (
        <Line tone="ok" icon={<CheckCircle size={14} weight="fill" />}>
          Wrote {[...saved.written.updated, ...saved.written.added].join(', ')} to .env.local
          {saved.synced && (
            <> · Vercel: {saved.synced.created.length} created, {saved.synced.updated.length} updated</>
          )}
        </Line>
      )}
      {saved.syncError && (
        <Line tone="danger" icon={<Warning size={14} />}>{saved.syncError}</Line>
      )}
      {saved.synced?.warnings.map((w) => (
        <Line key={w} tone="danger" icon={<Warning size={14} />}>{w}</Line>
      ))}
      {saved.kv && (
        <span className="text-xs text-fg3">
          {saved.kv.ok
            ? `Portal account (${saved.kv.email}) updated with the new Airtable base.`
            : saved.kv.note}
        </span>
      )}

      {saved.needsRedeploy && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-2">
          <span className="text-xs text-fg3">Live site still runs the old values until it redeploys.</span>
          <button type="button" disabled={deploying} onClick={onRedeploy} className="btn btn-primary btn-sm">
            {deploying ? (
              <ArrowsClockwise size={13} className="animate-spin" />
            ) : (
              <RocketLaunch size={13} weight="fill" />
            )}
            {deploying ? 'Deploying…' : 'Redeploy to apply'}
          </button>
        </div>
      )}

      {deployed?.error && (
        <Line tone="danger" icon={<XCircle size={14} weight="fill" />}>{deployed.error}</Line>
      )}
      {deployed?.deployment && (
        <Line tone="ok" icon={<CheckCircle size={14} weight="fill" />}>
          Deployment queued.{' '}
          {deployed.deployment.inspectorUrl && (
            <a href={deployed.deployment.inspectorUrl} target="_blank" rel="noreferrer" className="underline">
              Watch the build
            </a>
          )}
        </Line>
      )}
    </div>
  );
}

function Line({
  tone,
  icon,
  children,
}: {
  tone: 'ok' | 'danger';
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 text-xs" style={{ color: tone === 'danger' ? 'var(--danger)' : undefined }}>
      <span className="shrink-0 pt-0.5" style={{ color: tone === 'ok' ? 'var(--ok)' : undefined }}>
        {icon}
      </span>
      <span className={tone === 'ok' ? 'text-fg2' : undefined}>{children}</span>
    </div>
  );
}
