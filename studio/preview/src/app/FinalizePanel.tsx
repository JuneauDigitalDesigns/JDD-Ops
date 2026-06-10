'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle,
  Warning,
  Rocket,
  CircleNotch,
  DotsSixVertical,
  LockSimple,
} from '@phosphor-icons/react';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CategoryEntry } from './page';
import type { Selections } from './StudioApp';

type ClientInfo = { slug: string; hasRepo: boolean };

type Status =
  | { kind: 'idle' }
  | { kind: 'running'; steps: string[] }
  | { kind: 'done'; repoPath: string; components: string[]; steps: string[] }
  | { kind: 'error'; message: string; detail?: string; steps: string[] };

export default function FinalizePanel({
  categories,
  selections,
  order,
  onReorder,
}: {
  categories: CategoryEntry[];
  selections: Selections;
  order: string[];
  onReorder: (activeId: string, overId: string) => void;
}) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [clients, setClients] = useState<ClientInfo[]>([]);
  const [mode, setMode] = useState<'existing' | 'new'>('new');
  const [selectedSlug, setSelectedSlug] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [overwrite, setOverwrite] = useState(false);

  // Load existing client folders for the destination dropdown.
  useEffect(() => {
    fetch('/api/clients')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { clients?: ClientInfo[] }) => {
        const list = d.clients ?? [];
        setClients(list);
        if (list.length > 0) {
          setMode('existing');
          setSelectedSlug(list[0].slug);
        }
      })
      .catch(() => {
        /* listing is best-effort; you can still type a new slug */
      });
  }, []);

  const catById = (id: string) => categories.find((c) => c.id === id);

  function entryFor(categoryId: string) {
    const c = catById(categoryId);
    const name = c ? selections[c.id] : undefined;
    const v = c && name ? c.variants.find((x) => x.name === name) : undefined;
    if (!c || !name || !v) return null;
    return { categoryId: c.id, categoryLabel: c.label, name, label: v.label, id: v.id };
  }

  // Body sections in the user-chosen sequence (order already pins nav first / footer last).
  const bodyEntries = order
    .map(entryFor)
    .filter((x): x is NonNullable<ReturnType<typeof entryFor>> => x !== null);

  // SEO is non-visual: not in the body order, but still wired as generateMetadata.
  const seoEntry = entryFor('seo');

  // The export payload IS the page order: body sections in sequence, then seo.
  const exportEntries = seoEntry ? [...bodyEntries, seoEntry] : bodyEntries;

  const effectiveSlug = (mode === 'new' ? newSlug : selectedSlug).trim();
  const slugHasRepo = clients.find((c) => c.slug === effectiveSlug)?.hasRepo ?? false;
  const busy = status.kind === 'running';
  const canExport = exportEntries.length > 0 && effectiveSlug.length > 0 && !busy;

  // Sortable list: nav pinned top, footer pinned bottom, the rest reorder freely.
  const middle = order.filter((id) => id !== 'nav' && id !== 'footer');
  const hasNav = order.includes('nav');
  const hasFooter = order.includes('footer');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleSortEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      onReorder(String(active.id), String(over.id));
    }
  }

  async function handleExport() {
    if (!canExport) return;
    setStatus({ kind: 'running', steps: [] });

    let res: Response;
    try {
      res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug: effectiveSlug,
          overwrite: slugHasRepo ? overwrite : false,
          selections: exportEntries.map((e) => ({ categoryId: e.categoryId, name: e.name, label: e.label })),
        }),
      });
    } catch {
      setStatus({ kind: 'error', message: 'Could not reach the export service.', steps: [] });
      return;
    }
    if (!res.body) {
      setStatus({ kind: 'error', message: 'No response stream from the export service.', steps: [] });
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    const steps: string[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let msg: { type: string; [k: string]: unknown };
        try {
          msg = JSON.parse(line);
        } catch {
          continue;
        }
        if (msg.type === 'step') {
          steps.push(String(msg.message));
          setStatus({ kind: 'running', steps: [...steps] });
        } else if (msg.type === 'done') {
          setStatus({
            kind: 'done',
            repoPath: String(msg.repoPath),
            components: (msg.components as string[]) ?? [],
            steps: [...steps],
          });
        } else if (msg.type === 'error') {
          setStatus({
            kind: 'error',
            message: String(msg.message),
            detail: msg.detail ? String(msg.detail) : undefined,
            steps: [...steps],
          });
        }
      }
    }
  }

  return (
    <section className="space-y-10">
      <header>
        <p className="font-chromeMono text-xs uppercase tracking-widest text-zinc-500">Finalize</p>
        <h1 className="mt-2 text-3xl font-medium text-zinc-900">Arrange &amp; build the client site</h1>
        <p className="mt-2 max-w-prose text-sm text-zinc-500">
          Drag the sections below to set the page order — what you see here is the order the
          site is built in. Nav stays at the top and Footer at the bottom. Then pick a client and
          export to{' '}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-chromeMono text-xs text-zinc-700">
            clients/&lt;slug&gt;/repo
          </code>
          .
        </p>
      </header>

      {/* ── Page order (sortable) ───────────────────────────────────────── */}
      <div className="space-y-4">
        <p className="font-chromeMono text-xs uppercase tracking-widest text-zinc-500">Page order</p>
        {order.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-white px-6 py-10 text-center text-sm text-zinc-400">
            No sections selected yet — pick components in the category tabs, then arrange them here.
          </div>
        ) : (
          <div className="space-y-1.5">
            {hasNav && <PinnedRow entry={entryFor('nav')} position={1} where="top" />}

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleSortEnd}
            >
              <SortableContext items={middle} strategy={verticalListSortingStrategy}>
                <div className="space-y-1.5">
                  {middle.map((id, i) => (
                    <SortableRow
                      key={id}
                      id={id}
                      entry={entryFor(id)}
                      position={(hasNav ? 1 : 0) + i + 1}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {hasFooter && (
              <PinnedRow entry={entryFor('footer')} position={order.length} where="bottom" />
            )}
          </div>
        )}

        {seoEntry && (
          <p className="font-chromeMono text-[11px] text-zinc-400">
            SEO ({seoEntry.label}) is wired into page metadata and has no position in the layout.
          </p>
        )}
      </div>

      {/* ── Destination ─────────────────────────────────────────────────── */}
      <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6">
        <p className="font-chromeMono text-xs uppercase tracking-widest text-zinc-500">Destination</p>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="dest-mode"
              checked={mode === 'existing'}
              disabled={clients.length === 0}
              onChange={() => setMode('existing')}
            />
            Existing client
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="dest-mode"
              checked={mode === 'new'}
              onChange={() => setMode('new')}
            />
            New client
          </label>
        </div>

        {mode === 'existing' ? (
          <select
            value={selectedSlug}
            onChange={(e) => setSelectedSlug(e.target.value)}
            disabled={busy || clients.length === 0}
            className="w-full max-w-sm rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            {clients.length === 0 && <option value="">No existing clients</option>}
            {clients.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.slug}
                {c.hasRepo ? ' (has repo)' : ''}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value)}
            placeholder="new-client-slug"
            disabled={busy}
            className="w-full max-w-sm rounded-md border border-zinc-300 px-3 py-2 font-chromeMono text-sm"
          />
        )}

        {effectiveSlug && (
          <p className="font-chromeMono text-xs text-zinc-500">
            → clients/{effectiveSlug}/repo
          </p>
        )}

        {slugHasRepo && (
          <label className="flex items-center gap-2 text-sm text-amber-800">
            <input
              type="checkbox"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
              disabled={busy}
            />
            This client already has a repo — overwrite it with a fresh template copy
            <span className="text-xs text-amber-700">(otherwise the repo is reused and components refreshed)</span>
          </label>
        )}
      </div>

      {/* ── Action ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={handleExport}
          disabled={!canExport}
          className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <CircleNotch size={16} className="animate-spin" /> : <Rocket size={16} weight="regular" />}
          {busy ? 'Building…' : 'Export & build site'}
        </button>
        <p className="text-sm text-zinc-500">
          {bodyEntries.length} section{bodyEntries.length === 1 ? '' : 's'}
          {seoEntry ? ' + SEO' : ''} selected.
        </p>
      </div>

      {/* ── Progress / result ───────────────────────────────────────────── */}
      {status.kind !== 'idle' && 'steps' in status && status.steps.length > 0 && (
        <ol className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
          {status.steps.map((s, i) => {
            const isLast = i === status.steps.length - 1;
            const pending = status.kind === 'running' && isLast;
            return (
              <li key={i} className="flex items-center gap-2">
                {pending ? (
                  <CircleNotch size={15} className="animate-spin text-emerald-600" />
                ) : (
                  <CheckCircle size={15} weight="fill" className="text-emerald-600" />
                )}
                {s}
              </li>
            );
          })}
        </ol>
      )}

      {status.kind === 'done' && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="flex items-center gap-2 font-medium">
            <CheckCircle size={18} weight="fill" />
            Done — your site is built at{' '}
            <code className="rounded bg-emerald-100 px-1.5 py-0.5 font-chromeMono text-xs">
              {status.repoPath}
            </code>
          </p>
          <ul className="mt-3 space-y-1 font-chromeMono text-xs text-emerald-800">
            {status.components.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-emerald-800">
            Next: <code className="rounded bg-emerald-100 px-1 py-0.5">cd {status.repoPath} && npm run dev</code> to preview.
          </p>
        </div>
      )}

      {status.kind === 'error' && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="flex items-center gap-2 font-medium">
            <Warning size={18} weight="regular" />
            {status.message}
          </p>
          {status.detail && (
            <pre className="mt-3 max-h-64 overflow-auto rounded bg-amber-100 p-3 font-chromeMono text-xs text-amber-900">
              {status.detail}
            </pre>
          )}
        </div>
      )}

      {/* ── Live preview (in page order) ────────────────────────────────── */}
      <section className="space-y-4">
        <p className="font-chromeMono text-xs uppercase tracking-widest text-zinc-500">
          Live preview — exactly as it will build
        </p>
        {bodyEntries.length === 0 ? (
          <div className="flex items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 py-10">
            <p className="text-sm text-zinc-400">No sections selected yet.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-bg">
            {bodyEntries.map((e) => {
              const c = catById(e.categoryId);
              const variant = c?.variants.find((v) => v.name === e.name);
              return (
                <div key={e.categoryId} className="border-b border-zinc-100 last:border-0">
                  {variant?.node}
                </div>
              );
            })}
          </div>
        )}
        <p className="font-chromeMono text-xs text-zinc-400">
          SEO metadata is non-visual and not shown in the preview.
        </p>
      </section>
    </section>
  );
}

// ─── Rows ──────────────────────────────────────────────────────────────────

type RowEntry = { categoryLabel: string; label: string } | null;

function RowShell({
  children,
  dragging,
}: {
  children: React.ReactNode;
  dragging?: boolean;
}) {
  return (
    <div
      className={[
        'flex items-center gap-3 rounded-md border bg-white px-3 py-2.5 text-sm',
        dragging ? 'border-emerald-400 shadow-lg' : 'border-zinc-200',
      ].join(' ')}
    >
      {children}
    </div>
  );
}

function RowBody({ entry, position }: { entry: RowEntry; position: number }) {
  if (!entry) return null;
  return (
    <>
      <span className="w-5 shrink-0 text-center font-chromeMono text-xs text-zinc-400">
        {position}
      </span>
      <div className="min-w-0 flex-1">
        <span className="font-chromeMono text-[10px] uppercase tracking-widest text-zinc-400">
          {entry.categoryLabel}
        </span>
        <p className="truncate text-zinc-900">{entry.label}</p>
      </div>
    </>
  );
}

function SortableRow({
  id,
  entry,
  position,
}: {
  id: string;
  entry: RowEntry;
  position: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <RowShell dragging={isDragging}>
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${entry?.categoryLabel ?? id}`}
          className="shrink-0 cursor-grab rounded p-0.5 text-zinc-400 hover:text-zinc-700 active:cursor-grabbing"
        >
          <DotsSixVertical size={16} />
        </button>
        <RowBody entry={entry} position={position} />
      </RowShell>
    </div>
  );
}

function PinnedRow({
  entry,
  position,
  where,
}: {
  entry: RowEntry;
  position: number;
  where: 'top' | 'bottom';
}) {
  return (
    <RowShell>
      <span
        className="shrink-0 rounded p-0.5 text-zinc-300"
        title={where === 'top' ? 'Pinned to top' : 'Pinned to bottom'}
      >
        <LockSimple size={16} />
      </span>
      <RowBody entry={entry} position={position} />
      <span className="shrink-0 font-chromeMono text-[10px] uppercase tracking-widest text-zinc-300">
        {where === 'top' ? 'top' : 'bottom'}
      </span>
    </RowShell>
  );
}
