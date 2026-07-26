'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle, CloudArrowUp, FloppyDisk, Info, SpinnerGap, Warning, XCircle } from '@phosphor-icons/react';
import { useManage } from './ManageContext';
import SectionHeader from './SectionHeader';

/**
 * The Retell agent prompt.
 *
 * Disk is the source of truth here, and the banner says so. There is no read-back from
 * Retell — the API has no exported "get current prompt" helper — so if someone edited in
 * the Retell dashboard, this textarea shows the last thing WE wrote, not what the agent
 * is currently answering with. Implying otherwise would be worse than saying it plainly.
 *
 * Save and push are separate buttons for the same reason redeploy is separate from an env
 * save: writing a file is cheap and reversible, changing what a live phone agent says is
 * neither.
 */
export default function VoiceAgentSection() {
  const { ctx, site } = useManage();
  const [prompt, setPrompt] = useState('');
  const [original, setOriginal] = useState('');
  const [meta, setMeta] = useState<{ exists: boolean; agentId: string | null; llmId: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'push' | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ slug: ctx.slug, site: site.slug });
      const res = await fetch(`/api/manage/agent-prompt?${qs.toString()}`, { cache: 'no-store' });
      const body = (await res.json()) as {
        exists?: boolean;
        prompt?: string;
        agentId?: string | null;
        llmId?: string | null;
        error?: string;
      };
      if (body.error) {
        setError(body.error);
        return;
      }
      setPrompt(body.prompt ?? '');
      setOriginal(body.prompt ?? '');
      setMeta({ exists: Boolean(body.exists), agentId: body.agentId ?? null, llmId: body.llmId ?? null });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read agent-prompt.txt');
    } finally {
      setLoading(false);
    }
  }, [ctx.slug, site.slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = prompt !== original;

  async function submit(push: boolean) {
    setBusy(push ? 'push' : 'save');
    setResult(null);
    try {
      const res = await fetch('/api/manage/agent-prompt', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: ctx.slug, site: site.slug, prompt, push }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        saved?: boolean;
        pushed?: boolean;
        pushError?: string;
        llmId?: string;
        error?: string;
      };
      if (body.error) {
        setResult({ ok: false, text: body.error });
        return;
      }
      setOriginal(prompt);
      if (body.pushError) setResult({ ok: false, text: `Saved to disk, but the push failed: ${body.pushError}` });
      else if (body.pushed) setResult({ ok: true, text: `Saved and pushed to Retell LLM ${body.llmId}.` });
      else setResult({ ok: true, text: 'Saved to agent-prompt.txt. Not pushed to Retell yet.' });
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : 'Save failed.' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[900px] px-8 py-8 lg:px-10">
      <SectionHeader
        title="Voice agent"
        lede={`The prompt the Retell agent answers with. Stored at clients/${ctx.slug}/agent-prompt.txt.`}
        actions={
          <>
            <button type="button" onClick={() => void submit(false)} disabled={!dirty || busy !== null} className="btn btn-sm">
              {busy === 'save' ? <SpinnerGap size={13} className="animate-spin" /> : <FloppyDisk size={13} />}
              Save to disk
            </button>
            <button type="button" onClick={() => void submit(true)} disabled={busy !== null} className="btn btn-primary btn-sm">
              {busy === 'push' ? <SpinnerGap size={13} className="animate-spin" /> : <CloudArrowUp size={13} weight="fill" />}
              Save + push to Retell
            </button>
          </>
        }
      />

      {error && (
        <div className="mb-4 flex items-center gap-2 text-xs" style={{ color: 'var(--danger)' }}>
          <Warning size={14} /> {error}
        </div>
      )}

      <div
        className="mb-4 flex items-start gap-2 rounded-[10px] border px-3 py-2 text-xs"
        style={{ borderColor: 'var(--rule)', background: 'var(--bg-deep)', color: 'var(--fg-3)' }}
      >
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>
          This is the file on disk, not a read-back from Retell — there is no API to fetch the
          live prompt. If someone edited it in the Retell dashboard, that change isn&apos;t shown here.
          {meta?.agentId && (
            <>
              {' '}Agent <code className="codechip">{meta.agentId}</code>
              {meta.llmId ? <> · LLM <code className="codechip">{meta.llmId}</code></> : ' · LLM resolved on push'}
            </>
          )}
        </span>
      </div>

      {result && (
        <div
          className="mb-4 flex items-start gap-2 text-xs"
          style={{ color: result.ok ? undefined : 'var(--danger)' }}
        >
          {result.ok ? (
            <CheckCircle size={14} weight="fill" style={{ color: 'var(--ok)', flexShrink: 0, marginTop: 2 }} />
          ) : (
            <XCircle size={14} weight="fill" style={{ flexShrink: 0, marginTop: 2 }} />
          )}
          <span className={result.ok ? 'text-fg2' : undefined}>{result.text}</span>
        </div>
      )}

      {loading ? (
        <p className="py-12 text-center text-xs text-fg3">Reading agent-prompt.txt…</p>
      ) : meta && !meta.exists ? (
        <div className="panel flex flex-col items-center gap-2 p-10 text-center">
          <p className="text-sm text-fg2">No agent-prompt.txt for this site yet.</p>
          <p className="max-w-[420px] text-xs text-fg3">
            onboard.js writes it during provisioning (step 6). You can still author one here and
            push it to the agent.
          </p>
        </div>
      ) : (
        <>
          <textarea
            className="mono-field w-full"
            style={{ minHeight: 460 }}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={busy !== null}
            spellCheck={false}
            aria-label="Retell agent prompt"
          />
          <div className="mt-2 flex items-center justify-between text-xs text-fg3">
            <span>{prompt.length.toLocaleString()} characters</span>
            {dirty && <span style={{ color: 'var(--accent)' }}>unsaved changes</span>}
          </div>
        </>
      )}
    </div>
  );
}
