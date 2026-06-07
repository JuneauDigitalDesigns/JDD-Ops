'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, Warning, Rocket, CircleNotch } from '@phosphor-icons/react';
import type { CategoryEntry } from './page';
import type { Selections } from './StudioApp';

type ClientInfo = { slug: string; hasRepo: boolean };

type Status =
  | { kind: 'idle' }
  | { kind: 'running'; steps: string[] }
  | { kind: 'done'; repoPath: string; components: string[]; steps: string[] }
  | { kind: 'error'; message: string; detail?: string; steps: string[] };

export default function ExportPanel({
  categories,
  selections,
}: {
  categories: CategoryEntry[];
  selections: Selections;
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

  const entries = categories
    .map((c) => {
      const name = selections[c.id];
      if (!name) return null;
      const v = c.variants.find((x) => x.name === name);
      if (!v) return null;
      return { categoryId: c.id, categoryLabel: c.label, name, label: v.label, id: v.id };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const effectiveSlug = (mode === 'new' ? newSlug : selectedSlug).trim();
  const slugHasRepo = clients.find((c) => c.slug === effectiveSlug)?.hasRepo ?? false;
  const busy = status.kind === 'running';
  const canExport = entries.length > 0 && effectiveSlug.length > 0 && !busy;

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
          selections: entries.map((e) => ({ categoryId: e.categoryId, name: e.name, label: e.label })),
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
        <p className="font-chromeMono text-xs uppercase tracking-widest text-zinc-500">Export</p>
        <h1 className="mt-2 text-3xl font-medium text-zinc-900">Build the client site</h1>
        <p className="mt-2 max-w-prose text-sm text-zinc-500">
          Pick a client below. Export copies the blank website template into{' '}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-chromeMono text-xs text-zinc-700">
            clients/&lt;slug&gt;/repo
          </code>
          , drops your selected components in, wires them into the homepage, then installs and
          builds the site to make sure it works.
        </p>
      </header>

      {/* ── Selected variants ───────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 font-chromeMono text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-6 py-3 font-normal">Category</th>
              <th className="px-6 py-3 font-normal">Variant</th>
              <th className="px-6 py-3 font-normal">Target file</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 text-zinc-900">
            {categories.map((c) => {
              const sel = entries.find((e) => e.categoryId === c.id);
              return (
                <tr key={c.id}>
                  <td className="px-6 py-4">{c.label}</td>
                  <td className="px-6 py-4">
                    {sel ? sel.label : <span className="text-zinc-400">No selection</span>}
                  </td>
                  <td className="px-6 py-4 font-chromeMono text-xs text-zinc-500">
                    {sel ? `src/components/catalog/${c.id}/${sel.name}.tsx` : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
          {entries.length} of {categories.length} categories selected.
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

      {/* ── Component Preview ───────────────────────────────────────────── */}
      <section className="space-y-4">
        <p className="font-chromeMono text-xs uppercase tracking-widest text-zinc-500">
          Component Preview
        </p>
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-bg">
          {categories
            .filter((c) => c.id !== 'seo')
            .map((c) => {
              const sel = entries.find((e) => e.categoryId === c.id);
              const variant = sel ? c.variants.find((v) => v.name === sel.name) : null;
              return (
                <div key={c.id} className="border-b border-zinc-100 last:border-0">
                  {variant ? (
                    variant.node
                  ) : (
                    <div className="flex items-center justify-center bg-zinc-50 py-10">
                      <p className="text-sm text-zinc-400">
                        No {c.label} selected — drag a component to the build panel
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
        <p className="font-chromeMono text-xs text-zinc-400">
          SEO metadata is non-visual and not shown in the preview.
        </p>
      </section>
    </section>
  );
}
