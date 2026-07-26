'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EnvField } from './envFields';

/**
 * State + mutations for the /manage Environment section.
 *
 * Lifted out of the old ManageClientEnv component, whose draft model was already the
 * right one and is preserved as-is: `draft` holds ONLY edited keys and every read goes
 * through `valueOf(key, serverValue)`, so untouched fields always reflect the server and
 * a reload can't clobber an in-progress edit.
 *
 * Two-stage load. The first request passes drift=0 so fields paint immediately; drift
 * costs one Vercel request per key, so it arrives in a second request and merges in.
 */

export type DriftState = 'in-sync' | 'differs' | 'missing-remote' | 'remote-only' | 'unknown';

export interface FieldView extends EnvField {
  value: string;
  masked: boolean;
}

export interface RawView {
  key: string;
  value: string;
  masked: boolean;
  secret: boolean;
}

export interface SiteView {
  slug: string;
  brandName: string;
  envExists: boolean;
  fields: FieldView[];
  advanced: RawView[];
  locked: RawView[];
  vercel: {
    ok: boolean;
    projectName: string;
    reason?: string;
    drift: Array<{ key: string; state: DriftState }>;
  };
}

interface EnvResponse {
  slug: string;
  plan: string;
  brandName: string;
  vercelConfigured: boolean;
  sites: SiteView[];
  error?: string;
}

export interface SaveResponse {
  ok?: boolean;
  noop?: boolean;
  error?: string;
  errors?: Array<{ key: string; error: string }>;
  written?: { updated: string[]; added: string[]; unchanged: string[] };
  kv?: { ok: boolean; email?: string; note?: string };
  synced?: { created: string[]; updated: string[]; skipped: string[]; warnings: string[] } | null;
  syncError?: string;
  needsRedeploy?: boolean;
}

export function useEnvEditor(slug: string, siteSlug: string) {
  const [site, setSite] = useState<SiteView | null>(null);
  const [loading, setLoading] = useState(true);
  const [driftLoading, setDriftLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [draft, setDraft] = useState<Record<string, string>>({});
  const [newRows, setNewRows] = useState<Array<{ key: string; value: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<SaveResponse | null>(null);

  // Guards a late drift response from overwriting a newer site selection.
  const requestRef = useRef(0);

  const pick = useCallback(
    (body: EnvResponse) => body.sites.find((s) => s.slug === siteSlug) ?? body.sites[0] ?? null,
    [siteSlug],
  );

  const load = useCallback(
    async ({ withDrift }: { withDrift: boolean }) => {
      const token = ++requestRef.current;
      const qs = new URLSearchParams({ slug, site: siteSlug });
      if (!withDrift) qs.set('drift', '0');
      const res = await fetch(`/api/manage/env?${qs.toString()}`, { cache: 'no-store' });
      const body = (await res.json()) as EnvResponse;
      if (token !== requestRef.current) return null; // superseded
      if (body.error) {
        setLoadError(body.error);
        return null;
      }
      const next = pick(body);
      setSite(next);
      return next;
    },
    [slug, siteSlug, pick],
  );

  /** Full reload: fields first, then drift. */
  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    // Deliberately does NOT clear `saved` — save() reloads to refresh drift, and the
    // result panel (with the redeploy button) has to survive that.
    try {
      await load({ withDrift: false });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to read .env.local.');
      setLoading(false);
      return;
    }
    setLoading(false);

    setDriftLoading(true);
    try {
      await load({ withDrift: true });
    } catch {
      // Fields are already on screen; a failed drift check just leaves the chips blank.
    } finally {
      setDriftLoading(false);
    }
  }, [load]);

  // Switching site (or client) starts over — including any in-progress edits, which
  // belong to the site they were typed against.
  useEffect(() => {
    setDraft({});
    setNewRows([]);
    setSaved(null);
    void reload();
  }, [reload]);

  const serverValue = useCallback(
    (key: string): string => {
      if (!site) return '';
      const field = site.fields.find((f) => f.key === key);
      if (field) return field.value;
      const raw = site.advanced.find((r) => r.key === key);
      return raw?.value ?? '';
    },
    [site],
  );

  const valueOf = useCallback(
    (key: string, fallback: string) => draft[key] ?? fallback,
    [draft],
  );

  /**
   * Record an edit. Typing a value back to what the server has REMOVES it from the draft
   * rather than storing an identical copy — otherwise the dirty count reports a pending
   * change that would be a no-op, and a save bar that only appears when dirty needs that
   * count to be honest.
   */
  const set = useCallback(
    (key: string, value: string) => {
      setDraft((prev) => {
        const next = { ...prev, [key]: value };
        if (value === serverValue(key)) delete next[key];
        return next;
      });
      setSaved(null);
    },
    [serverValue],
  );

  const revert = useCallback((key: string) => {
    setDraft((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setSaved(null);
  }, []);

  const revertAll = useCallback(() => {
    setDraft({});
    setNewRows([]);
    setSaved(null);
  }, []);

  const pendingUpdates = useMemo(() => {
    const out: Record<string, string> = { ...draft };
    for (const row of newRows) {
      const key = row.key.trim().toUpperCase();
      if (key) out[key] = row.value;
    }
    return out;
  }, [draft, newRows]);

  const changedKeys = useMemo(() => Object.keys(pendingUpdates), [pendingUpdates]);
  const dirty = changedKeys.length > 0;

  const driftFor = useCallback(
    (key: string): DriftState | null =>
      site?.vercel.drift.find((d) => d.key === key)?.state ?? null,
    [site],
  );

  const driftCount = useMemo(
    () =>
      (site?.vercel.drift ?? []).filter(
        (d) => d.state === 'differs' || d.state === 'missing-remote',
      ).length,
    [site],
  );

  const save = useCallback(async () => {
    if (!site || !dirty) return;
    setSaving(true);
    setSaved(null);
    try {
      const res = await fetch('/api/manage/env', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, siteSlug: site.slug, updates: pendingUpdates }),
      });
      const body = (await res.json()) as SaveResponse;
      setSaved(body);
      if (body.ok) {
        setDraft({});
        setNewRows([]);
        await reload(); // re-read disk and refresh drift
      }
    } catch (err) {
      setSaved({ error: err instanceof Error ? err.message : 'Save failed.' });
    } finally {
      setSaving(false);
    }
  }, [site, dirty, slug, pendingUpdates, reload]);

  return {
    site,
    loading,
    driftLoading,
    loadError,
    draft,
    newRows,
    setNewRows,
    valueOf,
    set,
    revert,
    revertAll,
    pendingUpdates,
    changedKeys,
    dirty,
    driftFor,
    driftCount,
    saving,
    saved,
    setSaved,
    save,
    reload,
  };
}
