'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MagnifyingGlass, Stack, ClipboardText, Wrench, CircleNotch } from '@phosphor-icons/react';
import type { ClientContext } from '@/lib/types';

/**
 * ⌘K — jump to any client, from anywhere.
 *
 * This is the piece that makes the persistent client shell pay off. Because the shell keeps a
 * client pinned across Build / Onboard / Manage, the navigation you now perform most often
 * isn't switching tools — it's switching CLIENTS, and without this that costs a trip back to
 * the root and a visual scan every time.
 *
 * Mounted in the root layout so it's reachable inside the Build studio and the Manage tables
 * alike. Note it deliberately does NOT skip when a contenteditable has focus, unlike
 * BuildWizard's ⌘Z handler: you need to be able to leave a client mid-edit, and ⌘K isn't a
 * text-editing shortcut so there's nothing to collide with.
 *
 * Fixtures are included — the palette is for reaching anything, including a test client the
 * index is hiding.
 */

const TOOLS = [
  { id: 'build', label: 'Build', Icon: Stack },
  { id: 'onboard', label: 'Onboard', Icon: ClipboardText },
  { id: 'manage', label: 'Manage', Icon: Wrench },
] as const;
type ToolId = (typeof TOOLS)[number]['id'];

/**
 * Split "arthur man" into a client query and an optional tool.
 *
 * Only the LAST token is considered, and only if it prefixes a tool name — so "manage co"
 * stays a two-word client search rather than silently becoming a tool jump, and a client
 * genuinely called "Build" is still reachable as a single token.
 */
function parseQuery(raw: string): { clientQuery: string; tool: ToolId | null } {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { clientQuery: raw.trim(), tool: null };
  const last = parts[parts.length - 1].toLowerCase();
  const match = TOOLS.find((t) => t.id.startsWith(last));
  if (!match) return { clientQuery: raw.trim(), tool: null };
  return { clientQuery: parts.slice(0, -1).join(' '), tool: match.id };
}

/** Lower is better; -1 means no match. Prefix beats substring, name beats slug. */
function score(ctx: ClientContext, q: string): number {
  if (!q) return 3;
  const name = ctx.brandName.toLowerCase();
  const slug = ctx.slug.toLowerCase();
  if (name.startsWith(q)) return 0;
  if (slug.startsWith(q)) return 1;
  if (name.includes(q) || slug.includes(q)) return 2;
  return -1;
}

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState('');
  const [cursor, setCursor] = useState(0);
  const [clients, setClients] = useState<ClientContext[]>([]);
  const [activity, setActivity] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  /** Fetch the roster once, on first open — not on mount, so it costs nothing until used. */
  const fetched = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadOnce = useCallback(async () => {
    if (fetched.current) return;
    fetched.current = true;
    setLoading(true);
    try {
      const res = await fetch('/api/runbook/clients?fixtures=1', { cache: 'no-store' });
      const data = await res.json();
      setClients(data.clients ?? []);
      setActivity(data.activity ?? {});
    } catch {
      fetched.current = false; // let a later open retry
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => {
          if (!prev) {
            setRaw('');
            setCursor(0);
            void loadOnce();
          }
          return !prev;
        });
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [loadOnce]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const { clientQuery, tool } = useMemo(() => parseQuery(raw), [raw]);

  const results = useMemo(() => {
    const q = clientQuery.toLowerCase();
    return clients
      .map((c) => ({ ctx: c, s: score(c, q) }))
      .filter((r) => r.s >= 0)
      .sort(
        (a, b) =>
          a.s - b.s ||
          // Ties break on what you last worked on — the thing you mean is usually recent.
          (activity[b.ctx.slug] ?? '').localeCompare(activity[a.ctx.slug] ?? '') ||
          a.ctx.brandName.localeCompare(b.ctx.brandName),
      )
      .slice(0, 8)
      .map((r) => r.ctx);
  }, [clients, clientQuery, activity]);

  const go = useCallback(
    (ctx: ClientContext) => {
      setOpen(false);
      router.push(tool ? `/c/${ctx.slug}/${tool}` : `/c/${ctx.slug}`);
    },
    [router, tool],
  );

  if (!open) return null;

  const active = results[Math.min(cursor, Math.max(results.length - 1, 0))];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 p-4 pt-[12vh]"
      onClick={() => setOpen(false)}
      role="presentation"
    >
      <div
        className="panel w-full max-w-lg overflow-hidden p-0 shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-rule px-4 py-3">
          <MagnifyingGlass size={15} className="shrink-0 text-fg3" />
          <input
            ref={inputRef}
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              setCursor(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                setOpen(false);
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setCursor((c) => Math.min(c + 1, results.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setCursor((c) => Math.max(c - 1, 0));
              } else if (e.key === 'Enter' && active) {
                e.preventDefault();
                go(active);
              }
            }}
            placeholder="Go to client…  (try “arthur manage”)"
            className="w-full border-0 bg-transparent p-0 text-sm text-fg outline-none placeholder:text-fg3"
          />
          {loading && <CircleNotch size={14} className="shrink-0 animate-spin text-fg3" />}
          {tool && (
            <span className="meta shrink-0" style={{ color: 'var(--accent)' }}>
              → {tool}
            </span>
          )}
        </div>

        <ul className="max-h-[46vh] overflow-y-auto py-1">
          {results.length === 0 ? (
            <li className="px-4 py-6 text-center text-xs text-fg3">
              {loading ? 'Loading clients…' : 'No matches.'}
            </li>
          ) : (
            results.map((ctx, i) => {
              const selected = ctx.slug === active?.slug;
              return (
                <li key={ctx.slug}>
                  <button
                    type="button"
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => go(ctx)}
                    className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors"
                    style={selected ? { background: 'var(--surface-2)' } : undefined}
                  >
                    <span className="min-w-0 flex-1 truncate font-display text-sm font-medium text-fg">
                      {ctx.brandName}
                    </span>
                    <span className="mono shrink-0 text-2xs text-fg3">{ctx.slug}</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>

        <div className="flex items-center gap-3 border-t border-rule px-4 py-2 text-2xs text-fg3">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
          <span className="ml-auto">append a tool name to jump straight to it</span>
        </div>
      </div>
    </div>
  );
}
