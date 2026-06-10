'use client';
import { MagnifyingGlass } from '@phosphor-icons/react';
import type { ClientContext, RunbookState } from '@/lib/types';
import { PLAN_LABEL } from '@/lib/runbook-content';

const STATUS_DOT: Record<string, string> = {
  'needs-build': 'var(--warn)',
  ready: 'var(--accent)',
  provisioned: 'var(--accent)',
  'portal-pending': 'var(--ok)',
  live: 'var(--ok)',
  unknown: 'var(--fg-3)',
};

export default function ClientList({
  clients,
  state,
  selectedSlug,
  onSelect,
  query,
  setQuery,
}: {
  clients: ClientContext[];
  state: RunbookState;
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  query: string;
  setQuery: (q: string) => void;
}) {
  const filtered = clients.filter(
    (c) =>
      c.slug.toLowerCase().includes(query.toLowerCase()) ||
      c.brandName.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="relative">
        <MagnifyingGlass
          size={14}
          style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-3)' }}
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search clients…"
          className="w-full py-2 pl-9 pr-3 text-[13px]"
        />
      </div>

      <div className="no-scrollbar flex flex-1 flex-col gap-1.5 overflow-y-auto pb-4">
        {filtered.length === 0 && (
          <p className="px-1 py-6 text-center text-[12.5px] text-fg3">
            {clients.length === 0 ? 'No clients under clients/ yet.' : 'No matches.'}
          </p>
        )}
        {filtered.map((c) => {
          const active = c.slug === selectedSlug;
          const status = state[c.slug]?.status ?? c.detectedStatus;
          return (
            <button
              key={c.slug}
              type="button"
              onClick={() => onSelect(c.slug)}
              className="rounded-[11px] border px-3 py-2.5 text-left transition-colors"
              style={{
                borderColor: active ? 'var(--accent)' : 'var(--rule)',
                background: active ? 'var(--surface-2)' : 'transparent',
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-[7px] w-[7px] shrink-0 rounded-full"
                  style={{ background: STATUS_DOT[status], boxShadow: `0 0 8px 1px ${STATUS_DOT[status]}` }}
                />
                <span className="truncate font-display text-[14px] font-medium" style={{ color: active ? 'var(--fg)' : 'var(--fg-2)' }}>
                  {c.brandName}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2 pl-[15px]">
                <span className="mono text-[10.5px] text-fg3">{c.slug}</span>
                <span className="kicker" style={{ fontSize: 9.5 }}>
                  {PLAN_LABEL[c.plan]}
                  {c.isEnterprise && c.sites.length > 1 ? ` · ${c.sites.length} sites` : ''}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
