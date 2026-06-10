'use client';
import { CaretRight, Terminal, Warning, Info, ArrowSquareOut, Crosshair, ArrowBendDownRight } from '@phosphor-icons/react';
import type { Block } from '@/lib/runbook-content';
import CopyButton from './CopyButton';

const CALLOUT_TONE = {
  info: { color: 'var(--accent)', bg: 'var(--accent-glow)', Icon: Info },
  warn: { color: 'var(--warn)', bg: 'var(--warn-glow)', Icon: Warning },
  danger: { color: 'var(--danger)', bg: 'var(--danger-glow)', Icon: Warning },
} as const;

function PendingNote() {
  return <span className="kicker" style={{ color: 'var(--fg-3)' }}>(provision first)</span>;
}

export default function BlockView({ block }: { block: Block }) {
  switch (block.t) {
    case 'text':
      return <p className="text-[13.5px] leading-[1.65] text-fg2">{block.body}</p>;

    case 'callout': {
      const { color, bg, Icon } = CALLOUT_TONE[block.tone];
      return (
        <div
          className="flex gap-2.5 rounded-[10px] px-3.5 py-2.5"
          style={{ background: bg, border: `1px solid ${color}33` }}
        >
          <Icon size={16} weight="fill" style={{ color, flexShrink: 0, marginTop: 1 }} />
          <p className="text-[12.5px] leading-[1.55]" style={{ color: 'var(--fg-2)' }}>
            {block.body}
          </p>
        </div>
      );
    }

    case 'nav':
      return (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="badge badge-accent">{block.app}</span>
          {block.path.map((seg, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <CaretRight size={11} style={{ color: 'var(--fg-3)' }} />
              <span className="codechip" style={{ background: 'transparent', borderColor: 'var(--rule)' }}>
                {seg}
              </span>
            </span>
          ))}
        </div>
      );

    case 'cmd':
      return (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 rounded-[10px] border border-rule bg-[var(--bg-deep)] px-3 py-2">
            <Terminal size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <code className="mono flex-1 overflow-x-auto whitespace-pre text-fg2 no-scrollbar">{block.command}</code>
            <CopyButton value={block.command} />
          </div>
          {(block.cwd || block.note) && (
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 pl-1">
              {block.cwd && (
                <span className="kicker" style={{ color: 'var(--fg-3)' }}>
                  run from <span style={{ color: 'var(--accent)' }}>{block.cwd}</span>
                </span>
              )}
              {block.note && <span className="text-[11.5px] text-fg3">{block.note}</span>}
            </div>
          )}
        </div>
      );

    case 'copy':
      return (
        <div className="flex items-center gap-2.5">
          <span className="kicker w-32 shrink-0">{block.label}</span>
          <code className="codechip flex-1">{block.value}</code>
          {block.pending && <PendingNote />}
          <CopyButton value={block.value} disabled={block.pending} />
        </div>
      );

    case 'fields':
      return (
        <div className="flex flex-col gap-2">
          {block.caption && <p className="text-[12.5px] text-fg3">{block.caption}</p>}
          {block.rows.map((row, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <code className="mono w-44 shrink-0 text-fg3">{row.label}</code>
              <code className="codechip flex-1">{row.value}</code>
              <CopyButton value={row.value} disabled={row.pending} />
            </div>
          ))}
        </div>
      );

    case 'env':
      return (
        <div className="overflow-hidden rounded-[10px] border border-rule">
          <div className="flex items-center justify-between border-b border-rule bg-[var(--bg-deep)] px-3 py-1.5">
            <span className="kicker">{block.file}</span>
          </div>
          <div className="flex flex-col gap-1.5 px-3 py-2.5">
            {block.vars.map((v, i) => (
              <div key={i} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <code className="mono text-[12px] text-accent">{v.key}</code>
                  <span className="text-fg3">=</span>
                  <code className="mono text-[12px] text-fg2">{v.value}</code>
                  {v.pending && <PendingNote />}
                </div>
                {v.note && <span className="pl-0.5 text-[11.5px] text-fg3">↳ {v.note}</span>}
              </div>
            ))}
          </div>
        </div>
      );

    case 'substeps':
      return (
        <ol className="flex flex-col gap-2">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-2.5">
              <span
                className="mono mt-[1px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10px]"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--rule-strong)', color: 'var(--accent)' }}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-[1.5] text-fg2">{item.text}</p>
                {item.detail && <p className="mt-0.5 text-[12px] leading-[1.45] text-fg3">{item.detail}</p>}
              </div>
            </li>
          ))}
        </ol>
      );

    case 'context':
      return (
        <div className="overflow-hidden rounded-[10px] border" style={{ borderColor: 'var(--rule-strong)', background: 'var(--surface)' }}>
          <div className="flex items-center justify-between gap-2 border-b border-rule px-3 py-1.5">
            <span className="kicker" style={{ color: 'var(--accent)' }}>{block.label}</span>
            {block.value && <CopyButton value={block.value} />}
          </div>
          <div className="flex flex-col gap-1.5 px-3 py-2.5">
            <div className="flex gap-2">
              <Crosshair size={13} weight="bold" style={{ color: 'var(--fg-3)', flexShrink: 0, marginTop: 2 }} />
              <p className="text-[12.5px] leading-[1.5] text-fg2">
                <span className="kicker mr-1.5" style={{ fontSize: 9.5 }}>from</span>
                {block.from}
              </p>
            </div>
            <div className="flex gap-2">
              <ArrowBendDownRight size={13} weight="bold" style={{ color: 'var(--fg-3)', flexShrink: 0, marginTop: 2 }} />
              <p className="text-[12.5px] leading-[1.5] text-fg2">
                <span className="kicker mr-1.5" style={{ fontSize: 9.5 }}>put in</span>
                {block.to}
              </p>
            </div>
            {(block.value || block.example) && (
              <div className="flex items-center gap-2 pl-[21px]">
                <span className="kicker" style={{ fontSize: 9.5 }}>{block.value ? 'value' : 'looks like'}</span>
                <code className="codechip flex-1">{block.value ?? block.example}</code>
                {block.pending && <span className="kicker" style={{ color: 'var(--fg-3)' }}>(provision first)</span>}
              </div>
            )}
          </div>
        </div>
      );

    case 'json':
      return (
        <div className="overflow-hidden rounded-[10px] border border-rule">
          <div className="flex items-center justify-between border-b border-rule bg-[var(--bg-deep)] px-3 py-1.5">
            <span className="kicker">{block.label}</span>
            <CopyButton value={block.json} />
          </div>
          <pre className="mono overflow-x-auto px-3 py-2.5 text-[12px] leading-[1.6] text-fg2 no-scrollbar">
            {block.json}
          </pre>
        </div>
      );

    case 'link':
      if (block.href === '#') {
        return <span className="text-[12.5px] text-fg3">↳ {block.label}</span>;
      }
      return (
        <a href={block.href} target="_blank" rel="noreferrer" className="btn btn-sm inline-flex w-fit">
          <ArrowSquareOut size={13} />
          {block.label}
        </a>
      );

    default:
      return null;
  }
}
