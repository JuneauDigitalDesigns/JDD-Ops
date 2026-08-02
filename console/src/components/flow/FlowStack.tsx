'use client';
// The narrow renderer. Same FlowModel, laid out as a vertical list: each node is a row, each
// edge becomes the connector label between the rows it joins.
//
// Node order is the authored array order, which every diagram builds in flow order — so
// reading top-to-bottom follows the same path the canvas draws left-to-right. Branches lose
// their geometry here and become labelled connectors instead ("on no-answer", "if answered"),
// which is the honest degradation: the information survives, the shape doesn't.

import CopyButton from '../CopyButton';
import { TONE_COLOR, styleFor, type FlowModel } from './types';

export default function FlowStack({ model }: { model: FlowModel }) {
  const outgoing = new Map<string, typeof model.edges>();
  for (const e of model.edges) {
    const list = outgoing.get(e.from) ?? [];
    list.push(e);
    outgoing.set(e.from, list);
  }

  return (
    <ol className="flex flex-col">
      {model.nodes.map((n, i) => {
        const s = styleFor(n.state, n.tone);
        const shown = n.value ?? n.placeholder;
        const next = model.nodes[i + 1];
        // The label for the edge that actually leads to the next row, if there is one.
        const link = next ? outgoing.get(n.id)?.find((e) => e.to === next.id) : undefined;

        return (
          <li key={n.id} className="flex flex-col">
            <div
              className="flex flex-col gap-1.5 rounded-[12px] px-3 py-2.5"
              style={{
                opacity: s.opacity,
                background: s.background,
                border: `1px ${s.dashed ? 'dashed' : 'solid'} ${s.border}`,
              }}
            >
              {n.kicker && (
                <span
                  className="meta"
                  style={{ color: n.tone === 'default' ? 'var(--fg-3)' : TONE_COLOR[n.tone ?? 'default'] }}
                >
                  {n.kicker}
                </span>
              )}
              <div className="flex items-start gap-1.5">
                {n.icon && <span className="mt-[1px] shrink-0">{n.icon}</span>}
                <span className="font-display text-base font-medium leading-[1.15]">{n.title}</span>
              </div>
              {shown && (
                <div className="flex items-start gap-1.5">
                  <code className="codechip min-w-0 flex-1" style={{ fontSize: 11.5, padding: '2px 6px' }}>
                    {shown}
                  </code>
                  {n.value && <CopyButton value={n.value} label="" />}
                </div>
              )}
              {n.note && <span className="text-[11px] leading-[1.4] text-fg3">{n.note}</span>}
              {s.tag && !n.value && <span className="meta">{s.tag}</span>}
            </div>

            {next && (
              <div className="flex items-center gap-2 py-1 pl-4">
                <span className="h-4 w-px" style={{ background: 'var(--rule-strong)' }} />
                {link?.label && <span className="meta">{link.label}</span>}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
