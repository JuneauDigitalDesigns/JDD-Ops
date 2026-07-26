'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, Rocket, CircleNotch, X, Warning } from '@phosphor-icons/react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { CategoryEntry } from './categories';
import type { Selections, SkinSelections } from './page-order';
import type { VerticalId } from '@/lib/verticals';
import type { SiteContent } from '@/data/site';
import { defaultSkin, supportsSkin } from '@/lib/skins';
import { EASE } from '@/lib/motion';

// Export + destination, lifted out of the old FinalizePanel. The Studio canvas owns
// composition and editing; this owns only "ship it". It opens from the top bar's Launch
// button so the canvas is never crowded by a form the operator uses once per client.

type ClientInfo = { slug: string; hasRepo: boolean };

type Status =
  | { kind: 'idle' }
  | { kind: 'running'; steps: string[] }
  | { kind: 'done'; repoPath: string; components: string[]; steps: string[] }
  | { kind: 'error'; message: string; detail?: string; steps: string[] };

export default function LaunchDialog({
  categories, selections, skins, order, vertical, effective, lockedSlug, onClose,
}: {
  categories: CategoryEntry[];
  selections: Selections;
  skins: SkinSelections;
  order: string[];
  vertical: VerticalId;
  effective: SiteContent;
  lockedSlug?: string;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const [clients, setClients] = useState<ClientInfo[]>([]);
  const [mode, setMode] = useState<'existing' | 'new'>('new');
  const [selectedSlug, setSelectedSlug] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [overwrite, setOverwrite] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  useEffect(() => {
    fetch('/api/build/clients')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { clients?: ClientInfo[] }) => {
        const list = d.clients ?? [];
        setClients(list);
        if (list.length > 0) { setMode('existing'); setSelectedSlug(list[0].slug); }
      })
      .catch(() => { /* listing is best-effort; you can still type a new slug */ });
  }, []);

  // Esc closes — but never mid-build, where it would orphan a running export.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && status.kind !== 'running') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, status.kind]);

  function entryFor(categoryId: string) {
    const c = categories.find((x) => x.id === categoryId);
    const name = c ? selections[c.id] : undefined;
    const v = c && name ? c.variants.find((x) => x.name === name) : undefined;
    if (!c || !name || !v) return null;
    // exportSkin stays undefined unless the component actually declares a skin prop, so the
    // payload never asks the server to bake `skin="…"` onto a component that has no such prop.
    const skin = skins[c.id] ?? defaultSkin(name);
    return { categoryId: c.id, name, label: v.label, exportSkin: supportsSkin(name) ? skin : undefined };
  }

  const bodyEntries = order.map(entryFor).filter((x): x is NonNullable<typeof x> => x !== null);
  const seoEntry = entryFor('seo');
  const exportEntries = seoEntry ? [...bodyEntries, seoEntry] : bodyEntries;

  const effectiveSlug = (lockedSlug ?? (mode === 'new' ? newSlug : selectedSlug)).trim();
  const slugHasRepo = clients.find((c) => c.slug === effectiveSlug)?.hasRepo ?? false;
  const busy = status.kind === 'running';
  const canExport = exportEntries.length > 0 && effectiveSlug.length > 0 && !busy;

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
          selections: exportEntries.map((e) => ({
            categoryId: e.categoryId, name: e.name, label: e.label, skin: e.exportSkin,
          })),
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
        try { msg = JSON.parse(line); } catch { continue; }
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduce ? 0 : 0.18 }}
        onClick={() => !busy && onClose()}
        className="absolute inset-0 bg-[var(--fg)]/40 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, y: reduce ? 0 : 12, scale: reduce ? 1 : 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: reduce ? 0 : 8, scale: reduce ? 1 : 0.98 }}
        transition={{ duration: reduce ? 0 : 0.22, ease: EASE }}
        role="dialog"
        aria-modal="true"
        aria-label="Launch site"
        className="relative flex max-h-full w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-rule bg-panel shadow-overlay"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-rule px-6 py-4">
          <h2 className="font-display text-2xl font-semibold text-fg">Launch</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="rounded-md p-1.5 text-fg3 hover:bg-surface hover:text-fg disabled:opacity-30"
          >
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {lockedSlug ? (
            <div className="flex items-center gap-2 text-sm text-fg2">
              <span className="codechip">clients/{lockedSlug}/repo</span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio" name="dest-mode" checked={mode === 'existing'}
                    disabled={clients.length === 0} onChange={() => setMode('existing')}
                  />
                  Existing client
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio" name="dest-mode" checked={mode === 'new'}
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
                  className="input"
                >
                  {clients.length === 0 && <option value="">No existing clients</option>}
                  {clients.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.slug}{c.hasRepo ? ' (has repo)' : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text" value={newSlug} onChange={(e) => setNewSlug(e.target.value)}
                  placeholder="new-client-slug" disabled={busy}
                  className="input font-chromeMono"
                />
              )}
              {effectiveSlug && <span className="codechip inline-block">clients/{effectiveSlug}/repo</span>}
            </div>
          )}

          {slugHasRepo && (
            <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <input
                type="checkbox" checked={overwrite} disabled={busy}
                onChange={(e) => setOverwrite(e.target.checked)} className="mt-1"
              />
              Overwrite the existing repo with a fresh template copy
            </label>
          )}

          {status.kind !== 'idle' && 'steps' in status && status.steps.length > 0 && (
            <ol className="space-y-2 rounded-lg border border-rule bg-surface p-4 text-sm text-fg2">
              {status.steps.map((s, i) => {
                const pending = status.kind === 'running' && i === status.steps.length - 1;
                return (
                  <li key={i} className="flex items-center gap-2">
                    {pending
                      ? <CircleNotch size={16} className="shrink-0 animate-spin text-ok" />
                      : <CheckCircle size={16} weight="fill" className="shrink-0 text-ok" />}
                    {s}
                  </li>
                );
              })}
            </ol>
          )}

          {status.kind === 'done' && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                <CheckCircle size={18} weight="fill" /> Built at
                <code className="rounded bg-emerald-100 px-1.5 py-0.5 font-chromeMono text-xs">
                  {status.repoPath}
                </code>
              </p>
            </div>
          )}

          {status.kind === 'error' && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              <p className="flex items-center gap-2 font-medium">
                <Warning size={18} weight="fill" /> {status.message}
              </p>
              {status.detail && (
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-chromeMono text-xs">{status.detail}</pre>
              )}
            </div>
          )}
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-rule px-6 py-4">
          <span className="text-sm text-fg3">
            {bodyEntries.length} section{bodyEntries.length === 1 ? '' : 's'}{seoEntry ? ' + SEO' : ''}
          </span>
          <button type="button" onClick={handleExport} disabled={!canExport} className="btn btn-primary">
            {busy ? <CircleNotch size={17} className="animate-spin" /> : <Rocket size={17} />}
            {busy ? 'Building…' : 'Export & build'}
          </button>
        </footer>
      </motion.div>
    </div>
  );
}
