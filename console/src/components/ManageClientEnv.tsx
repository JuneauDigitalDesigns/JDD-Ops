'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowsClockwise,
  CaretDown,
  CheckCircle,
  CloudArrowUp,
  Plus,
  RocketLaunch,
  Sliders,
  Warning,
  XCircle,
} from '@phosphor-icons/react';
import type { ClientContext } from '@/lib/types';
import type { EnvField } from '@/lib/envFields';

/**
 * Edit a client's env vars from the console instead of the Vercel dashboard.
 *
 * Save writes clients/{slug}/.env.local and pushes to Vercel in one step; applying the
 * change needs a deployment, which stays a separate, explicit button so a config tweak
 * never silently rebuilds a live client site.
 */

type DriftState = 'in-sync' | 'differs' | 'missing-remote' | 'remote-only' | 'unknown';

interface FieldView extends EnvField {
  value: string;
  masked: boolean;
}

interface RawView {
  key: string;
  value: string;
  masked: boolean;
  secret: boolean;
}

interface SiteView {
  slug: string;
  brandName: string;
  envExists: boolean;
  fields: FieldView[];
  advanced: RawView[];
  locked: RawView[];
  vercel: {
    ok: boolean;
    projectName: string;
    reason?: string;
    drift: Array<{ key: string; state: DriftState }>;
  };
}

interface EnvResponse {
  slug: string;
  plan: string;
  brandName: string;
  vercelConfigured: boolean;
  sites: SiteView[];
  error?: string;
}

interface SaveResponse {
  ok?: boolean;
  noop?: boolean;
  error?: string;
  errors?: Array<{ key: string; error: string }>;
  written?: { updated: string[]; added: string[]; unchanged: string[] };
  kv?: { ok: boolean; email?: string; note?: string };
  synced?: { created: string[]; updated: string[]; skipped: string[]; warnings: string[] } | null;
  syncError?: string;
  needsRedeploy?: boolean;
}

interface DeployResponse {
  ok?: boolean;
  error?: string;
  deployment?: { id: string; url: string | null; inspectorUrl: string | null; source: string };
}

const DRIFT_LABEL: Record<DriftState, string> = {
  'in-sync': 'in sync',
  differs: 'differs on Vercel',
  'missing-remote': 'not on Vercel',
  'remote-only': 'only on Vercel',
  unknown: 'set on Vercel',
};

function driftColor(state: DriftState): string {
  if (state === 'in-sync') return 'var(--ok)';
  if (state === 'differs' || state === 'missing-remote') return 'var(--danger)';
  return 'var(--fg-3)';
}

const inputClass =
  'rounded-[10px] border border-rule bg-[var(--bg-deep)] px-3 py-2 text-xs text-fg placeholder:text-fg3';

export default function ManageClientEnv() {
  const [clients, setClients] = useState<ClientContext[] | null>(null);
  const [slug, setSlug] = useState('');
  const [data, setData] = useState<EnvResponse | null>(null);
  const [siteSlug, setSiteSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Only edited keys live here; everything else falls back to the server's value.
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [newRows, setNewRows] = useState<Array<{ key: string; value: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<SaveResponse | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [deployed, setDeployed] = useState<DeployResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/runbook/clients');
        const body = (await res.json()) as { clients?: ClientContext[]; error?: string };
        if (cancelled) return;
        if (body.error) setLoadError(body.error);
        setClients((body.clients ?? []).filter((c) => c.hasIntake));
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load clients.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // `keepSite` holds the enterprise site tab across the post-save refresh; without it
  // saving site-2 would snap the form back to site-1.
  const load = useCallback(async (target: string, keepSite?: string) => {
    setLoading(true);
    setLoadError(null);
    setData(null);
    setDraft({});
    setNewRows([]);
    // Deliberately does NOT clear `saved` — save() re-loads to refresh drift, and the
    // result panel (with the redeploy button) has to survive that. Switching client
    // clears it instead, below.
    try {
      const res = await fetch(`/api/manage/env?slug=${encodeURIComponent(target)}`);
      const body = (await res.json()) as EnvResponse;
      if (body.error) {
        setLoadError(body.error);
        return;
      }
      setData(body);
      const keep = keepSite && body.sites.some((s) => s.slug === keepSite) ? keepSite : null;
      setSiteSlug(keep ?? body.sites[0]?.slug ?? '');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load env.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!slug) return;
    setSaved(null);
    setDeployed(null);
    void load(slug);
  }, [slug, load]);

  const site = useMemo(
    () => data?.sites.find((s) => s.slug === siteSlug) ?? data?.sites[0] ?? null,
    [data, siteSlug],
  );

  const driftFor = useCallback(
    (key: string): DriftState | null => site?.vercel.drift.find((d) => d.key === key)?.state ?? null,
    [site],
  );

  const valueOf = (key: string, serverValue: string) => draft[key] ?? serverValue;
  const set = (key: string, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setSaved(null);
    setDeployed(null);
  };

  const pendingUpdates = useMemo(() => {
    const out: Record<string, string> = { ...draft };
    for (const row of newRows) {
      const key = row.key.trim().toUpperCase();
      if (key) out[key] = row.value;
    }
    return out;
  }, [draft, newRows]);

  const dirty = Object.keys(pendingUpdates).length > 0;

  async function save() {
    if (!data || !site) return;
    setSaving(true);
    setSaved(null);
    setDeployed(null);
    try {
      const res = await fetch('/api/manage/env', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: data.slug, siteSlug: site.slug, updates: pendingUpdates }),
      });
      const body = (await res.json()) as SaveResponse;
      setSaved(body);
      if (body.ok) {
        setDraft({});
        setNewRows([]);
        await load(data.slug, site.slug); // re-read disk + refresh drift
      }
    } catch (err) {
      setSaved({ error: err instanceof Error ? err.message : 'Save failed.' });
    } finally {
      setSaving(false);
    }
  }

  async function redeploy() {
    if (!data || !site) return;
    setDeploying(true);
    setDeployed(null);
    try {
      const res = await fetch('/api/manage/env/redeploy', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: data.slug, siteSlug: site.slug }),
      });
      setDeployed((await res.json()) as DeployResponse);
    } catch (err) {
      setDeployed({ error: err instanceof Error ? err.message : 'Redeploy failed.' });
    } finally {
      setDeploying(false);
    }
  }

  return (
    <div className="panel flex flex-col gap-4 p-5">
      <div className="flex items-center gap-2">
        <Sliders size={17} weight="fill" style={{ color: 'var(--accent)' }} />
        <h3 className="font-display text-base font-medium">Client environment</h3>
      </div>
      <p className="text-[11.5px] text-fg3">
        Edits write <code>clients/{'{slug}'}/.env.local</code> and push to the client&apos;s Vercel
        project. A redeploy is required before the live site picks them up.
      </p>

      {loadError && (
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--danger)' }}>
          <Warning size={14} /> {loadError}
        </div>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="kicker">Client</span>
        <select
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          disabled={!clients || saving}
          className={inputClass}
        >
          <option value="">{clients ? 'Select a client…' : 'Loading…'}</option>
          {clients?.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.brandName} — {c.slug} ({c.plan})
            </option>
          ))}
        </select>
      </label>

      {loading && <div className="text-xs text-fg3">Reading .env.local and Vercel…</div>}

      {data && site && (
        <>
          {/* Enterprise clients have one project per site — each has its own env. */}
          {data.sites.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {data.sites.map((s) => (
                <button
                  key={s.slug}
                  type="button"
                  onClick={() => {
                    setSiteSlug(s.slug);
                    setDraft({});
                    setNewRows([]);
                    setSaved(null);
                  }}
                  className={s.slug === site.slug ? 'btn btn-primary btn-sm' : 'btn btn-sm'}
                >
                  {s.slug}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 text-[11.5px] text-fg3">
            <CloudArrowUp size={13} />
            {site.vercel.ok ? (
              <span>
                Vercel project <span className="text-fg2">{site.vercel.projectName}</span>
              </span>
            ) : (
              <span style={{ color: 'var(--danger)' }}>{site.vercel.reason}</span>
            )}
          </div>

          {!site.envExists && (
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--danger)' }}>
              <Warning size={14} /> No .env.local yet — this site hasn&apos;t been provisioned.
            </div>
          )}

          {/* Curated fields for the plan */}
          <div className="flex flex-col gap-3">
            {site.fields.map((f) => {
              const state = driftFor(f.key);
              return (
                <label key={f.key} className="flex flex-col gap-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="kicker">{f.label}</span>
                    {state && (
                      <span className="text-[10.5px]" style={{ color: driftColor(state) }}>
                        {DRIFT_LABEL[state]}
                      </span>
                    )}
                  </span>
                  {f.kind === 'select' ? (
                    <select
                      value={valueOf(f.key, f.value)}
                      onChange={(e) => set(f.key, e.target.value)}
                      disabled={saving}
                      className={inputClass}
                    >
                      <option value="">(unset)</option>
                      {f.options?.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={valueOf(f.key, f.value)}
                      onChange={(e) => set(f.key, e.target.value)}
                      disabled={saving}
                      placeholder={f.placeholder ?? ''}
                      className={inputClass}
                    />
                  )}
                  <span className="text-[11px] text-fg3">{f.help}</span>
                </label>
              );
            })}
          </div>

          {/* Everything else on disk, plus keys onboard.js owns. */}
          <details className="rounded-[10px] border border-rule bg-[var(--bg-deep)] p-3">
            <summary className="flex cursor-pointer items-center gap-1.5 text-xs text-fg2">
              <CaretDown size={12} />
              Advanced ({site.advanced.length} other key{site.advanced.length === 1 ? '' : 's'})
            </summary>

            <div className="mt-3 flex flex-col gap-2">
              {site.advanced.map((row) => {
                const state = driftFor(row.key);
                return (
                  <div key={row.key} className="flex items-center gap-2">
                    <span className="w-[46%] shrink-0 font-mono text-[11px] text-fg2">{row.key}</span>
                    <input
                      type="text"
                      value={valueOf(row.key, row.value)}
                      onChange={(e) => set(row.key, e.target.value)}
                      disabled={saving}
                      className={`${inputClass} flex-1`}
                    />
                    {state && (
                      <span
                        className="w-[70px] shrink-0 text-right text-[10px]"
                        style={{ color: driftColor(state) }}
                      >
                        {DRIFT_LABEL[state]}
                      </span>
                    )}
                  </div>
                );
              })}

              {newRows.map((row, i) => (
                <div key={`new-${i}`} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={row.key}
                    placeholder="NEW_KEY"
                    onChange={(e) =>
                      setNewRows((prev) =>
                        prev.map((r, j) => (j === i ? { ...r, key: e.target.value } : r)),
                      )
                    }
                    disabled={saving}
                    className={`${inputClass} w-[46%] shrink-0 font-mono`}
                  />
                  <input
                    type="text"
                    value={row.value}
                    placeholder="value"
                    onChange={(e) =>
                      setNewRows((prev) =>
                        prev.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)),
                      )
                    }
                    disabled={saving}
                    className={`${inputClass} flex-1`}
                  />
                </div>
              ))}

              <button
                type="button"
                onClick={() => setNewRows((prev) => [...prev, { key: '', value: '' }])}
                disabled={saving}
                className="btn btn-sm self-start"
              >
                <Plus size={12} /> Add variable
              </button>

              {site.locked.length > 0 && (
                <div className="mt-2 flex flex-col gap-1 border-t border-rule pt-2">
                  <span className="kicker">Managed by onboard.js — read only</span>
                  {site.locked.map((row) => (
                    <div key={row.key} className="flex gap-2 font-mono text-[11px] text-fg3">
                      <span className="w-[46%] shrink-0">{row.key}</span>
                      <span className="truncate">{row.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </details>

          <div className="flex items-center justify-between gap-3">
            <span className="text-[11.5px] text-fg3">
              {dirty
                ? `${Object.keys(pendingUpdates).length} change${
                    Object.keys(pendingUpdates).length === 1 ? '' : 's'
                  } pending`
                : 'No changes'}
            </span>
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={save}
              className="btn btn-primary btn-sm"
            >
              <CloudArrowUp size={13} weight="fill" />
              {saving ? 'Saving…' : 'Save + sync to Vercel'}
            </button>
          </div>

          {saved && (
            <div className="flex flex-col gap-2 rounded-[10px] border border-rule bg-[var(--bg-deep)] p-3">
              {saved.error && (
                <div className="flex items-start gap-2 text-xs" style={{ color: 'var(--danger)' }}>
                  <XCircle size={14} weight="fill" style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>{saved.error}</span>
                </div>
              )}

              {saved.ok && saved.noop && <span className="text-xs text-fg3">Nothing changed.</span>}

              {saved.ok && saved.written && !saved.noop && (
                <div className="flex items-start gap-2 text-xs">
                  <CheckCircle
                    size={14}
                    weight="fill"
                    style={{ color: 'var(--ok)', flexShrink: 0, marginTop: 2 }}
                  />
                  <span className="text-fg2">
                    Wrote {[...saved.written.updated, ...saved.written.added].join(', ')} to
                    .env.local
                    {saved.synced && (
                      <>
                        {' '}
                        · Vercel: {saved.synced.created.length} created,{' '}
                        {saved.synced.updated.length} updated
                      </>
                    )}
                  </span>
                </div>
              )}

              {saved.syncError && (
                <div className="flex items-start gap-2 text-xs" style={{ color: 'var(--danger)' }}>
                  <Warning size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>{saved.syncError}</span>
                </div>
              )}

              {saved.synced?.warnings.map((w) => (
                <div key={w} className="flex items-start gap-2 text-xs" style={{ color: 'var(--danger)' }}>
                  <Warning size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>{w}</span>
                </div>
              ))}

              {saved.kv && (
                <span className="text-[11.5px] text-fg3">
                  {saved.kv.ok
                    ? `Portal account (${saved.kv.email}) updated with the new Airtable base.`
                    : saved.kv.note}
                </span>
              )}

              {saved.needsRedeploy && (
                <div className="flex items-center justify-between gap-3 border-t border-rule pt-2">
                  <span className="text-[11.5px] text-fg3">
                    Live site still runs the old values until it redeploys.
                  </span>
                  <button
                    type="button"
                    disabled={deploying}
                    onClick={redeploy}
                    className="btn btn-primary btn-sm"
                  >
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
                <div className="flex items-start gap-2 text-xs" style={{ color: 'var(--danger)' }}>
                  <XCircle size={14} weight="fill" style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>{deployed.error}</span>
                </div>
              )}
              {deployed?.deployment && (
                <div className="flex items-start gap-2 text-xs">
                  <CheckCircle
                    size={14}
                    weight="fill"
                    style={{ color: 'var(--ok)', flexShrink: 0, marginTop: 2 }}
                  />
                  <span className="text-fg2">
                    Deployment queued.{' '}
                    {deployed.deployment.inspectorUrl && (
                      <a
                        href={deployed.deployment.inspectorUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        Watch the build
                      </a>
                    )}
                  </span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
