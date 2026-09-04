'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle,
  CloudArrowUp,
  Quotes,
  Warning,
  XCircle,
} from '@phosphor-icons/react';
import { useManage } from './ManageContext';
import SectionHeader from './SectionHeader';

interface FeaturedRequest {
  slug: string;
  siteName: string;
  siteUrl?: string;
  accountEmail: string;
  optedInAt: number;
  quote?: string;
  showName: boolean;
  showLink: boolean;
  image?: string;
  imageMode?: 'upload' | 'auto';
}

interface PublishedFeaturedSite {
  slug: string;
  image: string;
  businessName?: string;
  url?: string;
  quote?: string;
}

interface FeaturedState {
  configured: boolean;
  note?: string;
  request: FeaturedRequest | null;
  published: PublishedFeaturedSite | null;
  error?: string;
}

/**
 * The bridge between a portal opt-in and a live homepage card. The client already agreed
 * (or didn't) from the portal's Settings page — this section can only publish what they
 * asked for, never override it. Consent (credited vs anonymous) is baked into the record
 * server-side at publish time from their own choice; there is no control here that could
 * show a name or link a client opted out of.
 */
export default function FeaturedSection() {
  const { ctx, siteSlug } = useManage();
  const [state, setState] = useState<FeaturedState | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState<{ ok?: boolean; error?: string } | null>(null);

  const load = useCallback(async () => {
    setState(null);
    try {
      const qs = new URLSearchParams({ slug: ctx.slug, site: siteSlug });
      const res = await fetch(`/api/manage/featured?${qs.toString()}`, { cache: 'no-store' });
      const body = (await res.json()) as FeaturedState;
      setState(body);
    } catch (err) {
      setState({
        configured: false,
        request: null,
        published: null,
        error: err instanceof Error ? err.message : 'Failed to read the featured-site record.',
      });
    }
  }, [ctx.slug, siteSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  async function publish(opts: { recapture?: boolean } = {}) {
    // Mirrors the publish route's fallback order: a file or an explicit recapture always
    // proceeds; absent those, only proceed if the request record gives the route something
    // to fall back to (the client's own image, or an auto-capture it can run itself).
    const hasFallback = Boolean(request?.image) || request?.imageMode === 'auto';
    if (!file && !opts.recapture && !hasFallback) return;
    setWorking(true);
    setResult(null);
    try {
      const form = new FormData();
      form.set('slug', ctx.slug);
      form.set('site', siteSlug);
      if (file) form.set('file', file);
      if (opts.recapture) form.set('recapture', 'true');
      const res = await fetch('/api/manage/featured/publish', { method: 'POST', body: form });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      setResult(body);
      if (body.ok) {
        setFile(null);
        await load();
      }
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : 'Publish failed.' });
    } finally {
      setWorking(false);
    }
  }

  async function unpublish() {
    setWorking(true);
    setResult(null);
    try {
      const res = await fetch('/api/manage/featured/unpublish', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: ctx.slug, site: siteSlug }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      setResult(body);
      if (body.ok) await load();
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : 'Unpublish failed.' });
    } finally {
      setWorking(false);
    }
  }

  const request = state?.request ?? null;
  const published = state?.published ?? null;
  const credited = Boolean(request?.showName && request?.showLink);

  return (
    <div className="mx-auto w-full max-w-[900px] px-8 py-8 lg:px-10">
      <SectionHeader
        title="Featured"
        lede="Publish this client's opt-in to the agency homepage's “In the wild.” section."
      />

      {state === null && <p className="text-xs text-fg3">Reading the opt-in record…</p>}

      {state?.error && (
        <span className="flex items-center gap-2 text-xs" style={{ color: 'var(--danger)' }}>
          <Warning size={14} /> {state.error}
        </span>
      )}

      {state?.note && <p className="text-xs text-fg3">{state.note}</p>}

      {/* ── Opt-in state ──────────────────────────────────────────────────── */}
      {state && !state.error && (
        <section className="panel mb-4 flex flex-col gap-3 p-5">
          <h2 className="font-display text-lg font-semibold tracking-tightish text-fg">
            Client opt-in
          </h2>

          {!request ? (
            <p className="text-xs text-fg3">
              No featured-site opt-in on file for this client yet. It appears here the moment
              they turn it on in the portal.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <Row label="Account">{request.accountEmail}</Row>
                <Row label="Opted in">{new Date(request.optedInAt).toISOString().slice(0, 10)}</Row>
                <Row label="Listing">
                  <span style={{ color: credited ? 'var(--ok)' : 'var(--fg-2)' }}>
                    {credited ? 'Credited — name shown, site linked' : 'Anonymous — quote only'}
                  </span>
                </Row>
                {request.siteUrl && <Row label="Site">{request.siteUrl}</Row>}
                <Row label="Image">
                  {request.image
                    ? request.imageMode === 'auto'
                      ? 'Auto-captured screenshot'
                      : 'Client uploaded an image'
                    : request.imageMode === 'auto'
                      ? 'Auto-capture failed — none on file yet'
                      : 'No client image on file'}
                </Row>
              </div>
              {request.image && (
                // eslint-disable-next-line @next/next/no-img-element -- arbitrary Blob host, no next/image config needed for a small operator preview
                <img
                  src={request.image}
                  alt=""
                  className="h-24 w-auto rounded-[10px] border border-rule object-cover"
                />
              )}
              {request.quote && (
                <p className="mt-1 flex items-start gap-2 rounded-[10px] border border-rule p-3 text-xs text-fg2" style={{ background: 'var(--bg-deep)' }}>
                  <Quotes size={14} weight="fill" style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }} />
                  {request.quote}
                </p>
              )}
            </>
          )}
        </section>
      )}

      {/* ── Currently live ────────────────────────────────────────────────── */}
      {published && (
        <section className="panel mb-4 flex flex-col gap-3 p-5">
          <div className="flex items-center gap-2">
            <CheckCircle size={16} weight="fill" style={{ color: 'var(--ok)' }} />
            <h2 className="font-display text-lg font-semibold tracking-tightish text-fg">
              Live on the homepage
            </h2>
          </div>
          <Row label="Shown as">
            {published.businessName ?? <span className="text-fg3">Anonymous</span>}
          </Row>
          <Row label="Image">
            <span className="font-mono text-xs">{published.image}</span>
          </Row>
          <button
            type="button"
            onClick={unpublish}
            disabled={working}
            className="btn btn-sm w-fit"
            style={{ color: 'var(--danger)' }}
          >
            <XCircle size={13} weight="fill" />
            {working ? 'Working…' : 'Unpublish'}
          </button>
        </section>
      )}

      {/* ── Publish / republish ──────────────────────────────────────────── */}
      {request && (
        <section className="panel flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-1">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold tracking-tightish text-fg">
              <CloudArrowUp size={16} weight="fill" style={{ color: 'var(--accent)' }} />
              {published ? 'Replace screenshot' : 'Publish'}
            </h2>
            <p className="text-xs text-fg3">
              {request.image
                ? "Publishing uses the client's image by default — upload a file or capture a fresh screenshot below to override it. "
                : 'The client has no image on file — upload one or capture a screenshot below. '}
              (16:10 reads best — match the 1280×800 crop the rest of the homepage uses.) The
              card will show{' '}
              {credited ? (
                <>the business name, a link to the site, and the client&apos;s quote.</>
              ) : (
                <>only the client&apos;s quote — no name or link, per their opt-in.</>
              )}
            </p>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="field-label !mb-0">Override with a file (jpg, png or webp)</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={working}
            />
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => publish()}
              // A file always works. Absent one, the publish route falls back to the
              // client's own image or an auto-capture — so only block when neither exists.
              disabled={(!file && !request.image && request.imageMode !== 'auto') || working}
              className="btn btn-primary btn-sm w-fit"
            >
              <CloudArrowUp size={13} weight="fill" />
              {working ? 'Working…' : published ? 'Republish' : 'Publish to homepage'}
            </button>
            <button
              type="button"
              onClick={() => publish({ recapture: true })}
              disabled={working || !request.siteUrl}
              className="btn btn-sm w-fit"
            >
              <CloudArrowUp size={13} weight="fill" />
              Capture screenshot now
            </button>
          </div>

          {result && (
            <div className="flex items-center gap-2 text-xs">
              {result.error ? (
                <>
                  <XCircle size={14} weight="fill" style={{ color: 'var(--danger)' }} />
                  <span style={{ color: 'var(--danger)' }}>{result.error}</span>
                </>
              ) : (
                result.ok && (
                  <>
                    <CheckCircle size={14} weight="fill" style={{ color: 'var(--ok)' }} />
                    <span className="text-fg2">Done — live on the homepage now.</span>
                  </>
                )
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 text-xs">
      <span className="w-[90px] shrink-0 text-fg3">{label}</span>
      <span className="min-w-0 flex-1 truncate text-fg2">{children}</span>
    </div>
  );
}
