'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle,
  Warning,
  Rocket,
  CircleNotch,
  DotsSixVertical,
  LockSimple,
  ArrowsOut,
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
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CategoryEntry } from './categories';
import type { Selections, SkinSelections } from './StudioApp';
import type { VerticalId } from '@/lib/verticals';
import type { SiteContent } from '@/data/site';
import { type Section } from '@/lib/copy-schema';
import { EditProvider } from '@/lib/editable';
import { defaultSkin, supportsSkin, type SkinId } from '@/lib/skins';
import StyleToolbar from './StyleToolbar';
import FullScreenPreview from './FullScreenPreview';
import ImportPanel from './ImportPanel';
import ScrapePanel from './ScrapePanel';
import GenerateCopyPanel from './GenerateCopyPanel';

type ClientInfo = { slug: string; hasRepo: boolean };

type Status =
  | { kind: 'idle' }
  | { kind: 'running'; steps: string[] }
  | { kind: 'done'; repoPath: string; components: string[]; steps: string[] }
  | { kind: 'error'; message: string; detail?: string; steps: string[] };

export default function FinalizePanel({
  categories,
  selections,
  skins,
  onSkinChange,
  order,
  onReorder,
  vertical,
  effective,
  setField,
  imported,
  onImport,
  onClearImport,
  generated,
  onGenerated,
  onClearGenerated,
  onResetEdits,
  onResetStyles,
  hideSources = false,
  lockedSlug,
}: {
  categories: CategoryEntry[];
  selections: Selections;
  skins: SkinSelections;
  onSkinChange: (categoryId: string, skin: SkinId) => void;
  order: string[];
  onReorder: (activeId: string, overId: string) => void;
  vertical: VerticalId;
  effective: SiteContent;
  setField: (path: string, value: unknown) => void;
  imported: SiteContent | null;
  onImport: (site: SiteContent) => void;
  onClearImport: () => void;
  generated: Partial<SiteContent> | null;
  onGenerated: (p: Partial<SiteContent>) => void;
  onClearGenerated: () => void;
  onResetEdits: () => void;
  onResetStyles: () => void;
  /** Hide the Import/Generate/Seed source tabs (they live in the wizard's intake step). */
  hideSources?: boolean;
  /** Lock the destination to a fixed slug (chosen in the wizard's client step). */
  lockedSlug?: string;
}) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [source, setSource] = useState<'import' | 'generate' | 'seed'>('import');
  const [clients, setClients] = useState<ClientInfo[]>([]);
  const [mode, setMode] = useState<'existing' | 'new'>('new');
  const [selectedSlug, setSelectedSlug] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [overwrite, setOverwrite] = useState(false);
  const [styleSel, setStyleSel] = useState<{ path: string; rect: DOMRect } | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  // Close the style toolbar on scroll/resize — its anchor rect would go stale.
  useEffect(() => {
    if (!styleSel) return;
    const close = () => setStyleSel(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [styleSel]);

  // Load existing client folders for the destination dropdown.
  useEffect(() => {
    fetch('/api/build/clients')
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
    // `skin` drives the live preview (safe to pass regardless — render() ignores it when
    // the component has no skin prop). `exportSkin` is undefined unless the component
    // actually declares one, so the export payload never asks the server to bake a
    // `skin="…"` attribute onto a component whose props type doesn't have it.
    const skin = skins[c.id] ?? defaultSkin(name);
    const exportSkin = supportsSkin(name) ? skin : undefined;
    return { categoryId: c.id, categoryLabel: c.label, name, label: v.label, id: v.id, skin, exportSkin, variant: v };
  }

  // Body sections in the user-chosen sequence (order already pins nav first / footer last).
  const bodyEntries = order
    .map(entryFor)
    .filter((x): x is NonNullable<ReturnType<typeof entryFor>> => x !== null);

  // SEO is non-visual: not in the body order, but still wired as generateMetadata.
  const seoEntry = entryFor('seo');

  // The export payload IS the page order: body sections in sequence, then seo.
  const exportEntries = seoEntry ? [...bodyEntries, seoEntry] : bodyEntries;

  // Copy sections map 1:1 to category ids; brand + announcement are always generated.
  const COPY_SECTION_CATEGORIES: Section[] = ['trust', 'hero', 'about', 'services', 'work', 'testimonials', 'faq', 'finalCta', 'footer', 'seo'];
  const selectedSections: Section[] = ['brand', 'announcement', ...COPY_SECTION_CATEGORIES.filter((c) => selections[c])];

  const effectiveSlug = (lockedSlug ?? (mode === 'new' ? newSlug : selectedSlug)).trim();
  const slugHasRepo = clients.find((c) => c.slug === effectiveSlug)?.hasRepo ?? false;
  const busy = status.kind === 'running';
  const canExport = exportEntries.length > 0 && effectiveSlug.length > 0 && !busy;

  // Sortable strip: nav pinned first, footer pinned last, the rest reorder freely.
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
      res = await fetch('/api/build/export', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug: effectiveSlug,
          overwrite: slugHasRepo ? overwrite : false,
          selections: exportEntries.map((e) => ({ categoryId: e.categoryId, name: e.name, label: e.label, skin: e.exportSkin })),
          vertical,
          content: effective,
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
        <p className="font-chromeMono text-xs uppercase tracking-widest text-uiInkSoft">Finalize</p>
        <h1 className="mt-2 font-display text-3xl font-medium text-uiInk">Dial in &amp; build the client site</h1>
        <p className="mt-2 max-w-prose text-sm text-zinc-500">
          Set the page order, fine-tune copy and styling in the preview, open the Brand panel to
          tune the whole page, then export to{' '}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-chromeMono text-xs text-zinc-700">
            clients/&lt;slug&gt;/repo
          </code>
          .
        </p>
      </header>

      {/* ── Copy source: Import JSON / Generate Copy / Seed from website ──── */}
      {!hideSources && (
      <div className="space-y-4">
        <div className="inline-flex rounded-md border border-uiCardRule bg-white p-1">
          {([
            ['import', 'Import JSON'],
            ['generate', 'Generate Copy'],
            ['seed', 'Seed from website'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSource(id)}
              className={[
                'rounded px-3 py-1.5 font-chromeMono text-[11px] uppercase tracking-widest transition-colors',
                source === id ? 'bg-uiInk text-white' : 'text-zinc-500 hover:text-zinc-900',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        {source === 'import' && (
          <ImportPanel imported={imported} onImport={onImport} onClear={onClearImport} />
        )}
        {source === 'generate' && (
          <GenerateCopyPanel
            vertical={vertical}
            base={effective}
            sections={selectedSections}
            generated={generated}
            onGenerated={onGenerated}
            onClearGenerated={onClearGenerated}
          />
        )}
        {source === 'seed' && (
          <ScrapePanel imported={imported} onImport={onImport} vertical={vertical} base={effective} />
        )}
      </div>
      )}

      {/* ── Page order — single horizontal strip, directly above the preview ── */}
      <div className="space-y-3">
        <p className="font-chromeMono text-xs uppercase tracking-widest text-zinc-500">Page order</p>
        {order.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-white px-6 py-8 text-center text-sm text-zinc-400">
            No sections selected yet — pick components in the sidebar, then arrange them here.
          </div>
        ) : (
          <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
            {hasNav && <PinnedCard entry={entryFor('nav')} position={1} where="top" />}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSortEnd}>
              <SortableContext items={middle} strategy={horizontalListSortingStrategy}>
                <div className="flex items-stretch gap-2">
                  {middle.map((id, i) => (
                    <SortableCard
                      key={id}
                      id={id}
                      entry={entryFor(id)}
                      position={(hasNav ? 1 : 0) + i + 1}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            {hasFooter && <PinnedCard entry={entryFor('footer')} position={order.length} where="bottom" />}
          </div>
        )}
        {seoEntry && (
          <p className="font-chromeMono text-[11px] text-zinc-400">
            SEO ({seoEntry.label}) is wired into page metadata and has no position in the layout.
          </p>
        )}
      </div>

      {/* ── Live preview (in page order) ────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-chromeMono text-xs uppercase tracking-widest text-zinc-500">
            Live preview — click text to edit; it stays selected to restyle color, size &amp; weight
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onResetStyles}
              className="font-chromeMono text-xs text-zinc-400 underline-offset-2 hover:text-zinc-700 hover:underline"
            >
              Reset styles
            </button>
            <button
              type="button"
              onClick={onResetEdits}
              className="font-chromeMono text-xs text-zinc-400 underline-offset-2 hover:text-zinc-700 hover:underline"
            >
              Reset text edits
            </button>
            <button
              type="button"
              onClick={() => setFullscreen(true)}
              disabled={bodyEntries.length === 0}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-500 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowsOut size={13} weight="bold" />
              Full screen
            </button>
          </div>
        </div>
        {bodyEntries.length === 0 ? (
          <div className="flex items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 py-10">
            <p className="text-sm text-zinc-400">No sections selected yet.</p>
          </div>
        ) : (
          <EditProvider
            setField={setField}
            overrides={effective.overrides}
            onSelect={(path, el) => setStyleSel({ path, rect: el.getBoundingClientRect() })}
          >
            <div className="overflow-hidden rounded-lg border border-zinc-200 bg-bg">
              {bodyEntries.map((e) => (
                <div key={e.categoryId} className="border-b border-zinc-100 last:border-0">
                  {e.variant.render(e.skin)}
                </div>
              ))}
            </div>
          </EditProvider>
        )}
        <p className="font-chromeMono text-xs text-zinc-400">
          SEO metadata is non-visual and not shown in the preview.
        </p>
      </section>

      {styleSel && (
        <StyleToolbar
          path={styleSel.path}
          rect={styleSel.rect}
          overrides={effective.overrides}
          setField={setField}
          onClose={() => setStyleSel(null)}
        />
      )}

      {fullscreen && (
        <FullScreenPreview
          brand={effective.brand}
          title={effective.brand.short || effective.brand.name}
          sections={bodyEntries.map((e) => ({ key: e.categoryId, node: e.variant.render(e.skin) }))}
          onClose={() => setFullscreen(false)}
        />
      )}

      {/* ── Destination (below the preview) ─────────────────────────────── */}
      <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6">
        <p className="font-chromeMono text-xs uppercase tracking-widest text-zinc-500">Destination</p>

        {lockedSlug ? (
          <p className="text-sm text-zinc-600">
            Building for client{' '}
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-chromeMono text-xs text-zinc-800">
              {lockedSlug}
            </code>{' '}
            (chosen in step 1).
          </p>
        ) : (
        <>
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
        </>
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

      {/* ── Action (below the preview) ──────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={handleExport}
          disabled={!canExport}
          className="inline-flex items-center gap-2 rounded-md bg-uiInk px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-uiInk/90 disabled:cursor-not-allowed disabled:opacity-50"
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
    </section>
  );
}

// ─── Horizontal order cards ────────────────────────────────────────────────────

type CardEntry = { categoryLabel: string; label: string } | null;

function CardShell({
  children,
  dragging,
  pinned,
}: {
  children: React.ReactNode;
  dragging?: boolean;
  pinned?: boolean;
}) {
  return (
    <div
      className={[
        'flex h-full w-28 shrink-0 flex-col justify-between rounded-md border bg-white p-2.5 text-xs',
        dragging ? 'border-emerald-400 shadow-lg' : pinned ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-200',
      ].join(' ')}
    >
      {children}
    </div>
  );
}

function CardBody({ entry, position }: { entry: CardEntry; position: number }) {
  if (!entry) return null;
  return (
    <>
      <span className="font-chromeMono text-[10px] uppercase tracking-widest text-zinc-400">
        {position} · {entry.categoryLabel}
      </span>
      <p className="mt-1 line-clamp-2 font-medium text-zinc-900">{entry.label}</p>
    </>
  );
}

function SortableCard({ id, entry, position }: { id: string; entry: CardEntry; position: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <CardShell dragging={isDragging}>
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${entry?.categoryLabel ?? id}`}
          className="mb-1 cursor-grab self-end rounded p-0.5 text-zinc-400 hover:text-zinc-700 active:cursor-grabbing"
        >
          <DotsSixVertical size={14} />
        </button>
        <CardBody entry={entry} position={position} />
      </CardShell>
    </div>
  );
}

function PinnedCard({ entry, position, where }: { entry: CardEntry; position: number; where: 'top' | 'bottom' }) {
  return (
    <CardShell pinned>
      <span
        className="mb-1 self-end text-zinc-300"
        title={where === 'top' ? 'Pinned first' : 'Pinned last'}
      >
        <LockSimple size={14} />
      </span>
      <CardBody entry={entry} position={position} />
    </CardShell>
  );
}
