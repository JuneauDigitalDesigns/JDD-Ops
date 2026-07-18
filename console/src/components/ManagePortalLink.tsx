'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { LinkSimple, Play, Flask, Warning } from '@phosphor-icons/react';
import type { ClientContext } from '@/lib/types';

type LogLine = { kind: 'meta' | 'step' | 'log' | 'ok' | 'error'; text: string };

function classify(line: string): LogLine['kind'] {
  if (/\bFAIL\b|✗|Error:|error\b/i.test(line)) return 'error';
  if (/\[step\b|\[pre-flight\]|\[dry-run\]|\[link-portal\]/.test(line)) return 'step';
  if (/✓|passed|Provisioned|Updated|Clerk user:|done/i.test(line)) return 'ok';
  return 'log';
}

const LINE_COLOR: Record<LogLine['kind'], string> = {
  meta: 'var(--fg-3)',
  step: 'var(--accent)',
  log: 'var(--fg-2)',
  ok: 'var(--ok)',
  error: 'var(--danger)',
};

/** Portal-link status hint from the client's saved CLERK_USER_ID. */
function linkHint(ctx: ClientContext): { label: string; linked: boolean } {
  const linked = Boolean(ctx.sites?.[0]?.env?.CLERK_USER_ID);
  return { linked, label: linked ? 'Previously linked' : 'Not yet linked' };
}

export default function ManagePortalLink() {
  const [clients, setClients] = useState<ClientContext[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [slug, setSlug] = useState('');
  const [email, setEmail] = useState('');
  const [dryRun, setDryRun] = useState(true);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  // Load the client list from the existing runbook endpoint.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/runbook/clients');
        const data = (await res.json()) as { clients?: ClientContext[]; error?: string };
        if (cancelled) return;
        if (data.error) setLoadError(data.error);
        // Only clients with an intake schema can be linked (onboard.js reads site.ts).
        setClients((data.clients ?? []).filter((c) => c.hasIntake));
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load clients.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [logs]);

  const selected = useMemo(() => clients?.find((c) => c.slug === slug) ?? null, [clients, slug]);

  async function run() {
    if (!slug) return;
    setRunning(true);
    setExitCode(null);
    setLogs([{ kind: 'meta', text: dryRun ? '— dry run (no Clerk writes) —' : '— REAL RUN —' }]);

    try {
      const res = await fetch('/api/manage/link-portal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, email: email.trim() || undefined, dryRun }),
      });
      if (!res.body) throw new Error('No response stream.');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n');
        buf = parts.pop() ?? '';
        for (const part of parts) {
          if (!part.trim()) continue;
          let ev: { type: string; line?: string; message?: string; command?: string; code?: number };
          try {
            ev = JSON.parse(part);
          } catch {
            continue;
          }
          if (ev.type === 'start') setLogs((l) => [...l, { kind: 'meta', text: `$ ${ev.command}` }]);
          else if (ev.type === 'log' && ev.line) setLogs((l) => [...l, { kind: classify(ev.line!), text: ev.line! }]);
          else if (ev.type === 'error') setLogs((l) => [...l, { kind: 'error', text: ev.message ?? 'Error' }]);
          else if (ev.type === 'exit') setExitCode(ev.code ?? 1);
        }
      }
    } catch (err) {
      setLogs((l) => [...l, { kind: 'error', text: err instanceof Error ? err.message : 'Run failed.' }]);
      setExitCode(1);
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
        Re-applies a client&apos;s Clerk <code className="codechip">publicMetadata</code> so their
        portal loads. Use this if a client is unlinked from their site (deleted &amp; re-signed-up,
        wrong metadata, or they signed up with a different email). Runs{' '}
        <code className="codechip">onboard.js --link-portal</code>.
      </p>

      {loadError && (
        <div className="flex items-center gap-2 text-[12.5px]" style={{ color: 'var(--danger)' }}>
          <Warning size={14} /> {loadError}
        </div>
      )}

      {/* Client picker */}
      <label className="flex flex-col gap-1.5">
        <span className="kicker">Client</span>
        <select
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          disabled={running || !clients}
          className="rounded-[10px] border border-rule bg-[var(--bg-deep)] px-3 py-2 text-[13px] text-fg"
        >
          <option value="">{clients ? 'Select a client…' : 'Loading…'}</option>
          {clients?.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.brandName} — {c.slug} ({c.plan})
            </option>
          ))}
        </select>
      </label>

      {selected && (
        <div className="flex items-center gap-2 text-[12px] text-fg3">
          <span
            className="badge"
            style={{ color: linkHint(selected).linked ? 'var(--ok)' : 'var(--fg-3)' }}
          >
            <span className="dot" /> {linkHint(selected).label}
          </span>
          <span>·</span>
          <span>{selected.plan}</span>
        </div>
      )}

      {/* Email override */}
      <label className="flex flex-col gap-1.5">
        <span className="kicker">Sign-up email (optional)</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={running}
          placeholder="Defaults to the business email in site.ts — enter the email the client actually signed up with if different"
          className="rounded-[10px] border border-rule bg-[var(--bg-deep)] px-3 py-2 text-[13px] text-fg placeholder:text-fg3"
        />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Dry-run toggle (defaults ON) */}
        <button
          type="button"
          onClick={() => setDryRun((d) => !d)}
          disabled={running}
          className="flex items-center gap-2 text-[12.5px]"
          title="Dry runs write nothing to Clerk — just preview the metadata"
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
          disabled={running || !slug}
          onClick={run}
          className={dryRun ? 'btn btn-sm' : 'btn btn-primary btn-sm'}
        >
          <Play size={13} weight="fill" />
          {running ? 'Running…' : dryRun ? 'Preview (dry run)' : 'Link / Repair portal'}
        </button>
      </div>

      {/* Live feed */}
      {logs.length > 0 && (
        <div
          ref={feedRef}
          className="no-scrollbar max-h-[300px] overflow-y-auto rounded-[10px] border border-rule bg-[var(--bg-deep)] p-3"
        >
          {logs.map((l, i) => (
            <div key={i} className="mono whitespace-pre-wrap text-[11.5px] leading-[1.55]" style={{ color: LINE_COLOR[l.kind] }}>
              {l.text}
            </div>
          ))}
          {running && (
            <div className="mono mt-1 text-[11.5px]" style={{ color: 'var(--accent)' }}>
              <span className="inline-block animate-pulse">▍</span>
            </div>
          )}
        </div>
      )}

      {exitCode !== null && (
        <div className="flex items-center gap-2">
          <span className={`badge ${exitCode === 0 ? 'badge-ok' : 'badge-danger'}`}>
            <span className="dot" />
            {exitCode === 0 ? 'Completed' : `Exited ${exitCode}`}
          </span>
          <span className="text-[12px] text-fg3">
            {exitCode === 0
              ? dryRun
                ? 'Dry run clean — flip the toggle off to apply for real.'
                : 'Linked. Have the client reload /portal (or sign in again).'
              : 'See the log above.'}
          </span>
        </div>
      )}
    </div>
  );
}
