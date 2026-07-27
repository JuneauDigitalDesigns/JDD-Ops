'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { LiveUrlSource } from '@/lib/manageSites';
import type { ClientContext, SiteInfo } from '@/lib/types';

/**
 * Client identity for everything under /manage/[slug].
 *
 * The [slug] layout loads ClientContext on the server and provides it here, so moving
 * between sections costs zero fetches for "who am I looking at" — only the section's own
 * data reloads. That, plus the layout persisting across sibling segments, is the whole
 * reason sections are route segments rather than a client-side switch.
 *
 * The selected enterprise site lives in `?site=` rather than in this context: it needs to
 * survive a refresh and be linkable, and useSearchParams already gives every consumer the
 * same value without prop drilling.
 */

/** One domain attached to the site's Vercel project, plus its DNS state when pending. */
export interface DomainEntry {
  name: string;
  apexName: string | null;
  verified: boolean;
  redirect: string | null;
  verification: Array<{ type: string; domain: string; value: string; reason: string | null }>;
  config?: {
    ok: boolean;
    configuredBy: string | null;
    misconfigured: boolean;
    nameservers: string[];
    aValues: string[];
    cnames: string[];
    reason?: string;
  };
}

export interface DomainState {
  loading: boolean;
  ok: boolean;
  reason?: string;
  domains: DomainEntry[];
  /** What site.ts claims — frequently a preset placeholder. */
  canonical: string | null;
  /** Where the site actually serves, per Vercel. */
  liveUrl: string | null;
  source: LiveUrlSource;
}

interface ManageContextValue {
  ctx: ClientContext;
  /** The site being edited — the whole client for starter/growth. */
  site: SiteInfo;
  siteSlug: string;
  setSiteSlug: (slug: string) => void;
  /** True when this client has more than one provisionable site. */
  multiSite: boolean;
  /** Shared so the rail, Overview, and the Domain section agree and fetch once. */
  domains: DomainState;
  refreshDomains: () => Promise<void>;
}

const Ctx = createContext<ManageContextValue | null>(null);

export function useManage(): ManageContextValue {
  const value = useContext(Ctx);
  if (!value) throw new Error('useManage must be used inside <ManageProvider>');
  return value;
}

export function ManageProvider({
  ctx,
  children,
}: {
  ctx: ClientContext;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // An unknown or absent ?site= falls back to the first site rather than erroring —
  // a stale bookmark should still open the client.
  const requested = params.get('site');
  const site = useMemo(
    () => ctx.sites.find((s) => s.slug === requested) ?? ctx.sites[0],
    [ctx.sites, requested],
  );

  const setSiteSlug = useCallback(
    (slug: string) => {
      const next = new URLSearchParams(params.toString());
      // Single-site clients never need the param cluttering the URL.
      if (slug === ctx.sites[0]?.slug) next.delete('site');
      else next.set('site', slug);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [ctx.sites, params, pathname, router],
  );

  // Fetched once here rather than per-consumer: the rail's "Open site" link, the Overview
  // health tile, and the Domain section all need the same answer, and three components
  // resolving it independently is how they end up disagreeing.
  const [domains, setDomains] = useState<DomainState>({
    loading: true,
    ok: false,
    domains: [],
    canonical: null,
    liveUrl: null,
    source: 'none',
  });

  const refreshDomains = useCallback(async () => {
    setDomains((prev) => ({ ...prev, loading: true }));
    try {
      const qs = new URLSearchParams({ slug: ctx.slug, site: site.slug });
      const res = await fetch(`/api/manage/domains?${qs.toString()}`, { cache: 'no-store' });
      const body = (await res.json()) as Partial<DomainState> & { error?: string };
      setDomains({
        loading: false,
        ok: Boolean(body.ok),
        reason: body.error ?? body.reason,
        domains: body.domains ?? [],
        canonical: body.canonical ?? null,
        liveUrl: body.liveUrl ?? null,
        source: body.source ?? 'none',
      });
    } catch (err) {
      setDomains({
        loading: false,
        ok: false,
        reason: err instanceof Error ? err.message : 'Domain lookup failed.',
        domains: [],
        canonical: null,
        liveUrl: null,
        source: 'none',
      });
    }
  }, [ctx.slug, site.slug]);

  useEffect(() => {
    void refreshDomains();
  }, [refreshDomains]);

  const value = useMemo<ManageContextValue>(
    () => ({
      ctx,
      site,
      siteSlug: site.slug,
      setSiteSlug,
      multiSite: ctx.sites.length > 1,
      domains,
      refreshDomains,
    }),
    [ctx, site, setSiteSlug, domains, refreshDomains],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
