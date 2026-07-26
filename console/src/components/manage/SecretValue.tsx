'use client';

import { useState } from 'react';
import { Copy, Check, Eye, EyeSlash, SpinnerGap } from '@phosphor-icons/react';

/**
 * A masked env value with reveal-on-click and copy.
 *
 * The list response never contains the plaintext — it arrives only when you ask, from
 * /api/manage/env/reveal, one named key at a time. So this is a read-only display, NOT
 * an input: revealing must not turn the mask sentinel into an editable value that then
 * gets written back over the real secret.
 */
export default function SecretValue({
  slug,
  siteSlug,
  envKey,
  masked,
}: {
  slug: string;
  siteSlug: string;
  envKey: string;
  /** The `••••••••1234` form the API returned. */
  masked: string;
}) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function reveal() {
    if (revealed !== null) {
      setRevealed(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ slug, site: siteSlug, key: envKey });
      const res = await fetch(`/api/manage/env/reveal?${qs.toString()}`, { cache: 'no-store' });
      const body = (await res.json()) as { value?: string; error?: string };
      if (body.error) setError(body.error);
      else setRevealed(body.value ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read value.');
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    // Copy the real value, not the mask — fetch it if it isn't on screen yet.
    let value = revealed;
    if (value === null) {
      const qs = new URLSearchParams({ slug, site: siteSlug, key: envKey });
      const res = await fetch(`/api/manage/env/reveal?${qs.toString()}`, { cache: 'no-store' });
      const body = (await res.json()) as { value?: string };
      value = body.value ?? '';
    }
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      setError('Clipboard blocked by the browser.');
    }
  }

  return (
    <span className="flex min-w-0 items-center gap-2">
      <span
        className="min-w-0 flex-1 truncate font-mono text-xs"
        style={{ color: revealed !== null ? 'var(--fg)' : 'var(--fg-3)' }}
        title={revealed ?? undefined}
      >
        {error ?? revealed ?? masked}
      </span>

      <button
        type="button"
        onClick={reveal}
        disabled={busy}
        title={revealed !== null ? 'Hide' : 'Reveal value'}
        className="shrink-0 text-fg3 transition-colors hover:text-accent"
      >
        {busy ? (
          <SpinnerGap size={14} className="animate-spin" />
        ) : revealed !== null ? (
          <EyeSlash size={14} />
        ) : (
          <Eye size={14} />
        )}
      </button>

      <button
        type="button"
        onClick={copy}
        title="Copy value"
        className="shrink-0 text-fg3 transition-colors hover:text-accent"
      >
        {copied ? <Check size={14} style={{ color: 'var(--ok)' }} /> : <Copy size={14} />}
      </button>
    </span>
  );
}
