'use client';

import { createContext, useCallback, useContext, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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

interface ManageContextValue {
  ctx: ClientContext;
  /** The site being edited — the whole client for starter/growth. */
  site: SiteInfo;
  siteSlug: string;
  setSiteSlug: (slug: string) => void;
  /** True when this client has more than one provisionable site. */
  multiSite: boolean;
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

  const value = useMemo<ManageContextValue>(
    () => ({ ctx, site, siteSlug: site.slug, setSiteSlug, multiSite: ctx.sites.length > 1 }),
    [ctx, site, setSiteSlug],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
