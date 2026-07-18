'use client';
import { useState } from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react';
import type { ClientContext, OpsConfig, RunbookState } from '@/lib/types';
import ClientCard from './ClientCard';

export default function ClientGrid({
  clients, state, config, onSelect,
}: {
  clients: ClientContext[];
  state: RunbookState;
  config: OpsConfig;
  onSelect: (slug: string) => void;
}) {
  const [query, setQuery] = useState('');
  const filtered = clients.filter(
    (c) =>
      c.slug.toLowerCase().includes(query.toLowerCase()) ||
      c.brandName.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="mx-auto w-full max-w-[820px] px-6 py-10 md:px-8">
      <div className="mb-2 flex items-center gap-4">
        <div className="relative max-w-sm flex-1">
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
        <span className="kicker text-fg3">{clients.length} client{clients.length === 1 ? '' : 's'}</span>
      </div>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-[13px] text-fg3">
          {clients.length === 0 ? 'No clients under clients/ yet.' : 'No matches.'}
        </p>
      ) : (
        <div className="flex flex-col">
          {filtered.map((c) => (
            <ClientCard key={c.slug} ctx={c} clientState={state[c.slug]} config={config} onSelect={() => onSelect(c.slug)} />
          ))}
        </div>
      )}
    </div>
  );
}
