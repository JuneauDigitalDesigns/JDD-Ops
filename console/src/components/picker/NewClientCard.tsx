'use client';

import { Plus } from '@phosphor-icons/react';

/**
 * "Add a new client" as the first cell of the client grid.
 *
 * This was a `btn btn-sm` in the console bar. Two reasons it moved:
 *
 * 1. The bar is wayfinding only now — creating a client is the single most consequential
 *    action on this screen, and it was sitting in the chrome between a Refresh button and
 *    a Fixtures toggle.
 * 2. It belongs to the grid it adds to. An outlined cell in the first position reads as
 *    "the collection continues here", which is a stronger affordance than any button, and
 *    it means the empty state needs no special case: with zero clients the grid still shows
 *    exactly one card, and it's the one you want.
 *
 * Deliberately NOT the .panel treatment. A dashed outline on the bare ground says "this
 * isn't a client yet" — a filled panel would make it look like one until you read it.
 */
export default function NewClientCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[160px] flex-col items-center justify-center gap-2.5 rounded-panel border border-dashed p-5 text-center transition-colors hover:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      style={{ borderColor: 'var(--rule-strong)' }}
    >
      <span
        className="flex h-9 w-9 items-center justify-center rounded-full border transition-colors group-hover:border-accent"
        style={{ borderColor: 'var(--rule-strong)', color: 'var(--fg-3)' }}
      >
        <Plus size={16} weight="bold" />
      </span>
      <span className="text-sm font-medium text-fg2 transition-colors group-hover:text-accent">
        Add a new client
      </span>
    </button>
  );
}
