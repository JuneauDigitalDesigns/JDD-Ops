'use client';

import { useState } from 'react';
import { CheckCircle, XCircle, MinusCircle, Play, Warning, Lightning } from '@phosphor-icons/react';
import CopyButton from './CopyButton';
import type { GoLiveAction, GoLiveResult } from '@/lib/goLive/types';

/**
 * The one interactive primitive the go-live wizard adds on top of the runbook DSL: a button
 * that runs a guarded /api/go-live/* action and renders its result inline.
 *
 * Two flavours, decided by `destructive`:
 *   - read-only (preflight): a single Run button.
 *   - destructive (stripe prices, kv reset, env sync): Dry run first; the real run stays
 *     disabled until a dry run has succeeded, and then asks for an explicit confirm. Nothing
 *     that creates prices or deletes keys can fire on a single click.
 */
export default function RunBlock({
  action,
  label,
  destructive = false,
  params,
}: {
  action: GoLiveAction;
  label: string;
  destructive?: boolean;
  params?: Record<string, string>;
}) {
  const [busy, setBusy] = useState<false | 'dry' | 'real'>(false);
  const [result, setResult] = useState<GoLiveResult | null>(null);
  const [dryOk, setDryOk] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function run(dryRun: boolean) {
    setBusy(dryRun ? 'dry' : 'real');
    setConfirming(false);
    try {
      const res = await fetch(`/api/go-live/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dryRun, ...(params ?? {}) }),
      });
      const body = (await res.json()) as GoLiveResult;
      setResult(body);
      if (dryRun && body.ok) setDryOk(true);
      if (!dryRun) setDryOk(false); // require a fresh dry run before the next real run
    } catch (err) {
      setResult({
        ok: false,
        dryRun,
        error: err instanceof Error ? err.message : 'Request failed.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-[10px] border border-rule p-3.5" style={{ background: 'var(--surface)' }}>
      <div className="flex flex-wrap items-center gap-2.5">
        {!destructive ? (
          <button type="button" onClick={() => run(true)} disabled={Boolean(busy)} className="btn btn-primary btn-sm">
            <Play size={13} weight="fill" /> {busy ? 'Running…' : label}
          </button>
        ) : (
          <>
            <button type="button" onClick={() => run(true)} disabled={Boolean(busy)} className="btn btn-sm">
              <Play size={13} weight="fill" /> {busy === 'dry' ? 'Previewing…' : 'Dry run'}
            </button>
            {!confirming ? (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={!dryOk || Boolean(busy)}
                className="btn btn-primary btn-sm"
                title={dryOk ? undefined : 'Run a dry run first'}
              >
                <Lightning size={13} weight="fill" /> {label}
              </button>
            ) : (
              <span className="flex items-center gap-2">
                <span className="meta" style={{ color: 'var(--warn)' }}>
                  <Warning size={12} weight="fill" style={{ display: 'inline', verticalAlign: -1, marginRight: 3 }} />
                  For real?
                </span>
                <button type="button" onClick={() => run(false)} disabled={Boolean(busy)} className="btn btn-primary btn-sm">
                  {busy === 'real' ? 'Running…' : 'Confirm'}
                </button>
                <button type="button" onClick={() => setConfirming(false)} disabled={Boolean(busy)} className="btn btn-sm">
                  Cancel
                </button>
              </span>
            )}
          </>
        )}
        {result && !result.error && (
          <span className="meta ml-auto" style={{ color: result.ok ? 'var(--ok)' : 'var(--danger)' }}>
            {result.dryRun ? 'preview' : 'done'} · {result.ok ? 'ok' : 'issues'}
          </span>
        )}
      </div>

      {result && <ResultView result={result} />}
    </div>
  );
}

function ResultView({ result }: { result: GoLiveResult }) {
  if (result.error) {
    return (
      <span className="flex items-center gap-2 text-xs" style={{ color: 'var(--danger)' }}>
        <XCircle size={14} weight="fill" /> {result.error}
      </span>
    );
  }
  return (
    <div className="flex flex-col gap-2.5">
      {result.summary && <p className="text-xs text-fg2">{result.summary}</p>}

      {result.checks && result.checks.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {result.checks.map((c, i) => {
            const Icon = c.ok === true ? CheckCircle : c.ok === false ? XCircle : MinusCircle;
            const color = c.ok === true ? 'var(--ok)' : c.ok === false ? 'var(--danger)' : 'var(--fg-3)';
            return (
              <li key={i} className="flex items-start gap-2 text-xs">
                <Icon size={14} weight="fill" style={{ color, flexShrink: 0, marginTop: 1.5 }} />
                <div className="min-w-0 flex-1">
                  <span className="text-fg2">{c.label}</span>
                  {c.detail && <span className="text-fg3"> — {c.detail}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {result.lines && result.lines.length > 0 && (
        <pre className="mono no-scrollbar max-h-56 overflow-auto rounded-[8px] border border-rule bg-[var(--bg-deep)] px-3 py-2 text-2xs leading-[1.6] text-fg2">
          {result.lines.join('\n')}
        </pre>
      )}

      {result.captured && result.captured.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {result.captured.map((c, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <span className="meta w-52 shrink-0">{c.label}</span>
              <code className="codechip flex-1">{c.value}</code>
              <CopyButton value={c.value} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
