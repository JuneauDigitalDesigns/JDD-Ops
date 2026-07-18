'use client';
import { useState } from 'react';
import { Sparkle, CircleNotch, ArrowCounterClockwise, Warning, CheckCircle } from '@phosphor-icons/react';
import type { SiteContent } from '@/data/site';
import type { VerticalId } from '@/lib/verticals';
import type { Section } from '@/lib/copy-schema';

type State = { kind: 'idle' } | { kind: 'running' } | { kind: 'error'; message: string };

export default function GenerateCopyPanel({
  vertical, base, sections, generated, onGenerated, onClearGenerated,
}: {
  vertical: VerticalId;
  base: SiteContent;
  sections: Section[];
  generated: Partial<SiteContent> | null;
  onGenerated: (p: Partial<SiteContent>) => void;
  onClearGenerated: () => void;
}) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [url, setUrl] = useState('');       // ephemeral — optional site to scan
  const [details, setDetails] = useState(''); // ephemeral — not persisted

  async function run() {
    setState({ kind: 'running' });
    try {
      const res = await fetch('/api/build/generate-copy', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ vertical, base, details, sections, url: url.trim() || undefined }),
      });
      const data = (await res.json()) as { generated?: Partial<SiteContent>; error?: string };
      if (!res.ok || !data.generated) {
        setState({ kind: 'error', message: data.error ?? 'Generation failed.' });
        return;
      }
      onGenerated(data.generated);
      setState({ kind: 'idle' });
    } catch {
      setState({ kind: 'error', message: 'Could not reach the copy service.' });
    }
  }

  const busy = state.kind === 'running';
  // Sections that will actually get copy (brand is an always-on tagline, not shown as a chip).
  const sectionLabels = sections.filter((s) => s !== 'brand');

  return (
    <div className="space-y-3 rounded-lg border border-uiCardRule bg-white p-6">
      <div className="flex items-center justify-between">
        <p className="font-chromeMono text-xs uppercase tracking-widest text-uiInkSoft">Generate brand copy</p>
        {generated && (
          <button
            type="button"
            onClick={onClearGenerated}
            className="inline-flex items-center gap-1 font-chromeMono text-xs text-zinc-400 hover:text-zinc-700"
          >
            <ArrowCounterClockwise size={12} /> Revert generated copy
          </button>
        )}
      </div>
      <p className="text-sm text-zinc-500">
        Writes real marketing copy for the sections you&apos;ve selected, grounded in the{' '}
        <strong className="text-zinc-700">{vertical}</strong> vertical
        {sectionLabels.length > 0 && (
          <> — <span className="text-zinc-600">{sectionLabels.join(', ')}</span></>
        )}
        . It fills the preview below and stays editable — your manual edits always win.
      </p>

      <label className="block space-y-1.5">
        <span className="font-chromeMono text-[11px] uppercase tracking-widest text-zinc-400">
          Scan an existing site (optional)
        </span>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="theirbusiness.com — Claude reads it and grounds the copy in real details"
          disabled={busy}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 outline-none focus:border-uiInk disabled:opacity-50"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="font-chromeMono text-[11px] uppercase tracking-widest text-zinc-400">
          Additional brand details (optional)
        </span>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Business name, city, what makes them different, tone/voice, services to emphasize…"
          rows={4}
          disabled={busy}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 outline-none focus:border-uiInk"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={busy || sectionLabels.length === 0}
          className="inline-flex items-center gap-2 rounded-md bg-uiInk px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-uiInk/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <CircleNotch size={15} className="animate-spin" /> : <Sparkle size={15} weight="fill" />}
          {busy
            ? (url.trim() ? 'Scanning & generating…' : 'Generating…')
            : generated ? 'Regenerate' : url.trim() ? 'Scan & generate' : 'Generate brand copy'}
        </button>
        {sectionLabels.length === 0 && (
          <span className="text-sm text-zinc-400">Select some page components first.</span>
        )}
        {generated && !busy && (
          <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700">
            <CheckCircle size={15} weight="fill" /> Applied — showing in the preview below
          </span>
        )}
        {state.kind === 'error' && (
          <span className="inline-flex items-center gap-1.5 text-sm text-amber-700">
            <Warning size={15} /> {state.message}
          </span>
        )}
      </div>
    </div>
  );
}
