'use client';
import { useEffect, useRef, useState } from 'react';
import { CaretRight, DownloadSimple } from '@phosphor-icons/react';
import CopyButton from './CopyButton';

// Regex-color the raw stdout (moved here from LaunchPanel — the drawer is now its only consumer).
function classify(line: string): 'meta' | 'step' | 'ok' | 'error' | 'log' {
  if (/\bFAIL\b|✗|Error:|error\b/i.test(line)) return 'error';
  if (/\[step\b|\[pre-flight\]|\[dry-run\]/.test(line)) return 'step';
  if (/✓|passed|Provisioned|Wrote|ONBOARDED|done/i.test(line)) return 'ok';
  if (/^===|^\$ /.test(line.trim())) return 'meta';
  return 'log';
}
const COLOR = { meta: 'var(--fg-3)', step: 'var(--accent)', ok: 'var(--ok)', error: 'var(--danger)', log: 'var(--fg-2)' };

/**
 * The raw stream, demoted to a collapsible drawer under the step tracker. Auto-opens on failure,
 * offers copy-all + download, and only auto-scrolls when the user is already at the bottom.
 */
export default function RunLogDrawer({
  lines, running, slug, defaultOpen = false,
}: {
  lines: string[];
  running: boolean;
  slug: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const feedRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  // Auto-open when the caller flips defaultOpen (e.g. a failure).
  useEffect(() => { if (defaultOpen) setOpen(true); }, [defaultOpen]);

  // Auto-scroll to bottom only if the user hasn't scrolled up.
  useEffect(() => {
    if (open && stick.current) feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [lines, open]);

  function onScroll() {
    const el = feedRef.current;
    if (!el) return;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
  }

  function download() {
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `onboard-${slug}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.log`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (lines.length === 0) return null;

  return (
    <div className="rounded-[10px] border border-rule">
      <div className="flex items-center gap-2 px-3 py-1.5">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-1.5 text-fg2 hover:text-fg">
          <CaretRight size={13} className="transition-transform" style={{ transform: open ? 'rotate(90deg)' : undefined }} />
          <span className="kicker">Raw log · {lines.length} line{lines.length === 1 ? '' : 's'}</span>
        </button>
        <div className="ml-auto flex items-center gap-1">
          <CopyButton value={lines.join('\n')} />
          <button type="button" onClick={download} aria-label="Download log" title="Download log" className="rounded p-1 text-fg3 hover:bg-[var(--surface)] hover:text-fg">
            <DownloadSimple size={14} />
          </button>
        </div>
      </div>

      {open && (
        <div
          ref={feedRef}
          onScroll={onScroll}
          className="no-scrollbar max-h-[300px] overflow-y-auto border-t border-rule bg-[var(--bg-deep)] p-3"
        >
          {lines.map((l, i) => (
            <div key={i} className="mono whitespace-pre-wrap text-[11.5px] leading-[1.55]" style={{ color: COLOR[classify(l)] }}>
              {l || ' '}
            </div>
          ))}
          {running && (
            <div className="mono mt-1 text-[11.5px]" style={{ color: 'var(--accent)' }}>
              <span className="inline-block animate-pulse">▍</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
