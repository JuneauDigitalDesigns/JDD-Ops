'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle, CloudArrowUp, FloppyDisk, Info, Question, SpinnerGap, Warning, XCircle } from '@phosphor-icons/react';
import { useManage } from './ManageContext';
import SectionHeader from './SectionHeader';

/**
 * The Retell agent prompt.
 *
 * Disk is the source of truth for editing, but the route now READS BACK what the agent is
 * actually answering with, and this shows both when they differ.
 *
 * That gap used to be papered over with a banner admitting the textarea might be stale.
 * Saying it plainly was better than implying otherwise, but it still left you unable to act:
 * the reconcile engine would report "live prompt differs from agent-prompt.txt" and tell you
 * to compare the two, with nowhere to do it. Worse, saving from here would silently
 * overwrite whatever had been changed in the Retell dashboard.
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
  /**
   * What Retell says the agent is answering with right now.
   *
   * `inSync: null` means we could not read it — rendered as "couldn't check", never as
   * agreement. A prompt editor that implies the live agent matches when it has no idea is
   * the failure this read-back exists to remove.
   */
  const [live, setLive] = useState<{
    prompt: string | null;
    error: string | null;
    inSync: boolean | null;
  }>({ prompt: null, error: null, inSync: null });
  const [showLive, setShowLive] = useState(false);

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
        livePrompt?: string | null;
        liveError?: string | null;
        inSync?: boolean | null;
        error?: string;
      };
      if (body.error) {
        setError(body.error);
        return;
      }
      setPrompt(body.prompt ?? '');
      setOriginal(body.prompt ?? '');
      setMeta({ exists: Boolean(body.exists), agentId: body.agentId ?? null, llmId: body.llmId ?? null });
      setLive({
        prompt: body.livePrompt ?? null,
        error: body.liveError ?? null,
        inSync: body.inSync ?? null,
      });
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
          You are editing the file on disk. It is compared against the live agent on open —
          the strip below says whether they match, and shows the live prompt when they
          don&apos;t. Pushing overwrites the agent with what is in this box.
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
          {/* Live-agent comparison. Only speaks up when it has something to say: agreement
              is the expected case and needs one quiet line, a mismatch needs the actual
              text, and "couldn't check" must never be rendered as agreement. */}
          <div className="mb-3 flex flex-col gap-2">
            {live.error ? (
              <p className="flex items-start gap-1.5 text-xs" style={{ color: 'var(--fg-3)' }}>
                <Question size={13} style={{ flexShrink: 0, marginTop: 2 }} />
                Couldn’t read the live agent ({live.error}). This textarea is the last thing
                <em> we </em> wrote, which may not be what the agent is answering with.
              </p>
            ) : live.inSync === true ? (
              <p className="flex items-center gap-1.5 text-xs text-fg2">
                <CheckCircle size={13} weight="fill" style={{ color: 'var(--ok)' }} />
                Matches what the agent is answering with.
              </p>
            ) : live.inSync === false ? (
              <div className="panel flex flex-col gap-2 p-3" style={{ borderColor: 'var(--warn)' }}>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--warn)' }}>
                    <Warning size={13} weight="fill" />
                    The agent is answering with something different — most likely edited in the
                    Retell dashboard. Saving from here will overwrite it.
                  </span>
                  <button type="button" className="btn btn-xs shrink-0" onClick={() => setShowLive((v) => !v)}>
                    {showLive ? 'Hide' : 'Show live prompt'}
                  </button>
                </div>
                {showLive && (
                  <>
                    <textarea
                      className="mono-field w-full"
                      style={{ minHeight: 220 }}
                      value={live.prompt ?? ''}
                      readOnly
                      aria-label="Live prompt on the Retell agent (read-only)"
                    />
                    <button
                      type="button"
                      className="btn btn-xs w-fit"
                      onClick={() => setPrompt(live.prompt ?? '')}
                      // Loads it into the editor rather than writing disk directly, so the
                      // existing Save/Push buttons stay the only things that commit — one
                      // path to disk, one path to Retell.
                    >
                      Copy live prompt into the editor
                    </button>
                  </>
                )}
              </div>
            ) : null}
          </div>

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
