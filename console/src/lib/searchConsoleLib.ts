import 'server-only';
import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { opsRoot } from '@/lib/paths';

/**
 * Loader for jdd-ops/lib/search-console.js — JDD's own Google Search Console access (L11): the
 * verification file every export writes, property setup and teardown. Loaded like siteLayout.ts,
 * so Next never bundles a file from outside the console root. Server-only.
 */
export interface SetupStep {
  name: 'token' | 'file' | 'verify' | 'list' | 'sitemap' | 'owner';
  ok: boolean;
  detail?: string;
}

export interface GoogleOAuth {
  clientId: string;
  clientSecret: string;
  tokenUri: string;
  refreshToken: string;
}

export interface SearchConsoleClient {
  fileToken(property: string): Promise<string>;
  webResource(property: string): Promise<{ owners?: string[] }>;
  getSite(property: string): Promise<{ siteUrl: string; permissionLevel: string } | null>;
}

export interface SearchConsoleModule {
  JDD_GSC_VERIFICATION_FILE: string;
  writeVerificationFile(repoDir: string): string;
  propertyUrl(hostOrOrigin: string): string;
  loadGoogleOAuth(env?: Record<string, string | undefined>): GoogleOAuth | null;
  createSearchConsoleClient(args: { oauth: GoogleOAuth | null }): SearchConsoleClient;
  setupProperty(args: {
    client: SearchConsoleClient;
    property: string;
    sitemapUrl?: string;
    ownerEmails?: string[];
  }): Promise<SetupStep[]>;
  leaveProperty(args: { client: SearchConsoleClient; property: string }): Promise<{ ok: boolean; detail: string }>;
  verificationFileServed(property: string): Promise<boolean>;
}

const cache = new Map<string, Promise<SearchConsoleModule>>();

export function loadSearchConsole(): Promise<SearchConsoleModule> {
  const path = resolve(opsRoot(), 'lib', 'search-console.js');
  const url = `${pathToFileURL(path).href}?v=${statSync(path).mtimeMs}`;
  let mod = cache.get(url);
  if (!mod) {
    cache.clear();
    mod = import(/* webpackIgnore: true */ url) as Promise<SearchConsoleModule>;
    cache.set(url, mod);
  }
  return mod;
}
