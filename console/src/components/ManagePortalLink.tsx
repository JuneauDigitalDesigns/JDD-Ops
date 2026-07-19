'use client';
import { useEffect, useMemo, useState } from 'react';
import { LinkSimple, Play, Flask, Warning, CheckCircle, XCircle } from '@phosphor-icons/react';
import type { ClientContext } from '@/lib/types';

type Result = {
  slug: string;
  ok: boolean;
  attached?: string[];
  sitesOnAccount?: number;
  error?: string;
};

type Response = {
  ok?: boolean;
  dryRun?: boolean;
  email?: string;
  results?: Result[];
  error?: string;
};

export default function ManagePortalLink() {
  const [clients, setClients] = useState<ClientContext[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [email, setEmail] = useState('');
  const [dryRun, setDryRun] = useState(true);
  const [running, setRunning] = useState(false);
  const [response, setResponse] = useState<Response | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/runbook/clients');
        const data = (await res.json()) as { clients?: ClientContext[]; error?: string };
        if (cancelled) return;
        if (data.error) setLoadError(data.error);
        // Only clients with an intake can be attached (we read site.ts for their details).
        setClients((data.clients ?? []).filter((c) => c.hasIntake));
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load clients.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canRun = selected.size > 0 && emailValid && !running;

  const totalSites = useMemo(
    () =>
      (clients ?? [])
        .filter((c) => selected.has(c.slug))
        .reduce((n, c) => n + Math.max(1, c.sites.length), 0),
    [clients, selected],
  );

  function toggle(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  async function run() {
    setRunning(true);
    setResponse(null);
    try {
      const res = await fetch('/api/manage/link-portal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slugs: [...selected], email: email.trim(), dryRun }),
      });
      setResponse((await res.json()) as Response);
    } catch (err) {
      setResponse({ error: err instanceof Error ? err.message : 'Request failed.' });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="panel flex flex-col gap-4 p-5">
      <div className="flex items-center gap-2">
        <LinkSimple size={17} weight="fill" style={{ color: 'var(--accent)' }} />
        <h3 className="font-display text-[16px] font-medium">Repair portal link</h3>
      </div>
      <p className="text-[12.5px] leading-[1.5] text-fg3">
        Attaches client sites to a portal account so their <code className="codechip">/portal</code>{' '}
        loads. Use this if a client is unlinked from one or several sites (deleted &amp;
        re-signed-up, or they signed up with a different email). Each attach is an upsert —
        sites already on the account are <strong className="text-fg">never</strong> removed.
      </p>

      {loadError && (
        <div className="flex items-center gap-2 text-[12.5px]" style={{ color: 'var(--danger)' }}>
          <Warning size={14} /> {loadError}
        </div>
      )}

      {/* Account email — names the account being written to, so it's required. */}
      <label className="flex flex-col gap-1.5">
        <span className="kicker">Account email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={running}
          placeholder="The email the client signed up to the portal with"
          className="rounded-[10px] border border-rule bg-[var(--bg-deep)] px-3 py-2 text-[13px] text-fg placeholder:text-fg3"
        />
        <span className="text-[11.5px] text-fg3">
          Every selected site is attached to this one account. It must be the address they
          actually signed up with — not necessarily the business email in site.ts.
        </span>
      </label>

      {/* Client multi-select */}
      <div className="flex flex-col gap-1.5">
        <span className="kicker">Sites to attach</span>
        <div className="max-h-[220px] overflow-y-auto rounded-[10px] border border-rule bg-[var(--bg-deep)] p-1">
          {!clients && <div className="px-3 py-2 text-[12.5px] text-fg3">Loading…</div>}
          {clients?.length === 0 && (
            <div className="px-3 py-2 text-[12.5px] text-fg3">No clients with an intake schema.</div>
          )}
          {clients?.map((c) => {
            const linked = Boolean(c.sites?.[0]?.env?.CLERK_USER_ID);
            return (
              <label
                key={c.slug}
                className="flex cursor-pointer items-center gap-3 rounded-[8px] px-3 py-2 hover:bg-[var(--surface)]"
              >
                <input
                  type="checkbox"
                  checked={selected.has(c.slug)}
                  onChange={() => toggle(c.slug)}
                  disabled={running}
                />
                <span className="flex-1 text-[13px] text-fg">
                  {c.brandName}{' '}
                  <span className="text-fg3">
                    — {c.slug} ({c.plan}
                    {c.sites.length > 1 ? `, ${c.sites.length} sites` : ''})
                  </span>
                </span>
                <span className="text-[11px]" style={{ color: linked ? 'var(--ok)' : 'var(--fg-3)' }}>
                  {linked ? 'previously linked' : 'not linked'}
                </span>
              </label>
            );
          })}
        </div>
        {selected.size > 0 && (
          <span className="text-[11.5px] text-fg3">
            {selected.size} client{selected.size === 1 ? '' : 's'} selected → {totalSites} site
            {totalSites === 1 ? '' : 's'} will be attached.
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setDryRun((d) => !d)}
          disabled={running}
          className="flex items-center gap-2 text-[12.5px]"
          title="Dry runs write nothing — just show what would be attached"
        >
          <span
            className="relative h-[18px] w-[32px] rounded-full transition-colors"
            style={{ background: dryRun ? 'var(--ok)' : 'var(--rule-strong)' }}
          >
            <span
              className="absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white transition-all"
              style={{ left: dryRun ? '16px' : '2px' }}
            />
          </span>
          <span className="kicker" style={{ color: dryRun ? 'var(--ok)' : 'var(--fg-3)' }}>
            <Flask size={12} weight="fill" style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />
            Dry run {dryRun ? 'on' : 'off'}
          </span>
        </button>

        <button
          type="button"
          disabled={!canRun}
          onClick={run}
          className={dryRun ? 'btn btn-sm' : 'btn btn-primary btn-sm'}
        >
          <Play size={13} weight="fill" />
          {running ? 'Working…' : dryRun ? 'Preview (dry run)' : 'Attach to account'}
        </button>
      </div>

      {/* Results */}
      {response && (
        <div className="flex flex-col gap-2 rounded-[10px] border border-rule bg-[var(--bg-deep)] p-3">
          {response.error && (
            <div className="flex items-center gap-2 text-[12.5px]" style={{ color: 'var(--danger)' }}>
              <XCircle size={14} weight="fill" /> {response.error}
            </div>
          )}
          {response.results?.map((r) => (
            <div key={r.slug} className="flex items-start gap-2 text-[12.5px]">
              {r.ok ? (
                <CheckCircle size={14} weight="fill" style={{ color: 'var(--ok)', flexShrink: 0, marginTop: 2 }} />
              ) : (
                <XCircle size={14} weight="fill" style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 2 }} />
              )}
              <span className="text-fg2">
                <span className="text-fg">{r.slug}</span>
                {r.ok ? (
                  <>
                    {' '}
                    — {response.dryRun ? 'would attach' : 'attached'} {r.attached?.join(', ')}
                    {typeof r.sitesOnAccount === 'number' && (
                      <span className="text-fg3"> ({r.sitesOnAccount} site
                        {r.sitesOnAccount === 1 ? '' : 's'} now on {response.email})</span>
                    )}
                  </>
                ) : (
                  <> — {r.error}</>
                )}
              </span>
            </div>
          ))}
          {response.results && response.ok && !response.dryRun && (
            <span className="text-[11.5px] text-fg3">
              Done. Have the client reload /portal (or sign in again).
            </span>
          )}
          {response.dryRun && response.ok && (
            <span className="text-[11.5px] text-fg3">
              Dry run clean — flip the toggle off to write.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
