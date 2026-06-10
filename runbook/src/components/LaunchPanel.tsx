'use client';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Flask, Hammer, Lightning, ArrowSquareOut, X } from '@phosphor-icons/react';
import type { ClientContext } from '@/lib/types';
import CopyButton from './CopyButton';

type LogLine = { kind: 'meta' | 'step' | 'log' | 'ok' | 'error'; text: string };

function classify(line: string): LogLine['kind'] {
  if (/\bFAIL\b|✗|Error:|error\b/i.test(line)) return 'error';
  if (/\[step\b|\[pre-flight\]|\[dry-run\]/.test(line)) return 'step';
  if (/✓|passed|Provisioned|Wrote|ONBOARDED|done/i.test(line)) return 'ok';
  return 'log';
}

const LINE_COLOR: Record<LogLine['kind'], string> = {
  meta: 'var(--fg-3)',
  step: 'var(--accent)',
  log: 'var(--fg-2)',
  ok: 'var(--ok)',
  error: 'var(--danger)',
};

export default function LaunchPanel({ ctx, onComplete }: { ctx: ClientContext; onComplete: () => void }) {
  const [dryRun, setDryRun] = useState(true);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [logs]);

  async function launch() {
    setConfirming(false);
    setRunning(true);
    setExitCode(null);
    setLogs([{ kind: 'meta', text: dryRun ? '— dry run —' : '— REAL RUN —' }]);

    try {
      const res = await fetch('/api/onboard', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: ctx.slug, dryRun }),
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
      onComplete();
    }
  }

  // ── Pre-build gate ─────────────────────────────────────────────────────────
  if (!ctx.repoBuilt) {
    return (
      <div className="panel flex flex-col gap-3 p-5">
        <div className="flex items-center gap-2">
          <Hammer size={17} style={{ color: 'var(--warn)' }} />
          <h3 className="font-display text-[16px] font-medium">Build the site first</h3>
        </div>
        <p className="text-[13px] leading-[1.6] text-fg2">
          No <code className="codechip">clients/{ctx.slug}/repo</code> yet. Compose the site in the studio (drag-and-drop),
          export it to this client folder, then come back to provision.
        </p>
        <div className="flex items-center gap-2 rounded-[10px] border border-rule bg-[var(--bg-deep)] px-3 py-2">
          <code className="mono flex-1 text-fg2">npm run preview</code>
          <CopyButton value="npm run preview" />
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="http://localhost:3000" target="_blank" rel="noreferrer" className="btn btn-sm">
            <ArrowSquareOut size={13} /> Open studio
          </a>
          <span className="text-[12px] text-fg3">or scaffold manually:</span>
          <code className="codechip">npm run new-client -- --slug {ctx.slug}</code>
        </div>
      </div>
    );
  }

  return (
    <div className="panel flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Lightning size={17} weight="fill" style={{ color: 'var(--accent)' }} />
          <h3 className="font-display text-[16px] font-medium">Provision</h3>
        </div>

        <div className="flex items-center gap-3">
          {/* Dry-run toggle (defaults ON) */}
          <button
            type="button"
            onClick={() => setDryRun((d) => !d)}
            disabled={running}
            className="flex items-center gap-2 text-[12.5px]"
            title="Dry runs hit no APIs and write no files"
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
            disabled={running}
            onClick={() => (dryRun ? launch() : setConfirming(true))}
            className={dryRun ? 'btn btn-sm' : 'btn btn-primary btn-sm'}
          >
            <Play size={13} weight="fill" />
            {running ? 'Running…' : dryRun ? 'Run dry run' : 'Provision for real'}
          </button>
        </div>
      </div>

      <p className="text-[12.5px] leading-[1.5] text-fg3">
        Runs <code className="codechip">npm run onboard -- --schema {ctx.schemaPath}</code>
        {dryRun ? ' with --dry-run (no APIs, no writes).' : ' — creates real repos, agents, numbers, and bases.'}
      </p>

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
                ? 'Dry run clean — flip the toggle off to provision for real.'
                : 'Provisioned. Continue with the steps below.'
              : 'See the log above; fix and re-run.'}
          </span>
        </div>
      )}

      {/* Confirm modal for a real run */}
      <AnimatePresence>
        {confirming && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center p-6"
            style={{ background: 'rgba(4,8,18,0.86)', backdropFilter: 'blur(8px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConfirming(false)}
          >
            <motion.div
              className="panel w-full max-w-[440px] p-6"
              initial={{ scale: 0.96, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-[18px] font-medium">Provision for real?</h3>
                <button type="button" onClick={() => setConfirming(false)} className="text-fg3 hover:text-fg">
                  <X size={18} />
                </button>
              </div>
              <p className="mb-4 text-[13px] leading-[1.6] text-fg2">
                This runs onboard.js against live APIs for <strong className="text-fg">{ctx.brandName}</strong> ({ctx.plan}):
                creates a GitHub repo and Vercel project
                {ctx.plan !== 'starter' && ', a Retell agent, a phone number, and an Airtable base'}. Some of this costs money
                and is not auto-reversible.
              </p>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn btn-sm" onClick={() => setConfirming(false)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={launch}>
                  <Lightning size={13} weight="fill" /> Yes, provision
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
