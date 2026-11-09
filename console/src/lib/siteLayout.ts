import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { opsRoot } from '@/lib/paths';

/**
 * Loader for jdd-ops/lib/site-layout.js — the ONE rule for which site-wide pieces a client's
 * layout.tsx must mount (smooth scrolling, the mobile sticky call bar). onboard.js applies it on
 * every run; the export applies it on every export. Loaded like uiPinRules.ts, so Next does not
 * bundle a file from outside the console root. Server-only: imports node:fs.
 */
export interface SiteLayoutModule {
  LAYOUT_FILE: string;
  /** `error` set means nothing was written and `added` is empty. */
  ensureSiteLayout(repoDir: string, opts?: { write?: boolean }): { added: string[]; error?: string };
}

const cache = new Map<string, Promise<SiteLayoutModule>>();

export function loadSiteLayout(): Promise<SiteLayoutModule> {
  const path = resolve(opsRoot(), 'lib', 'site-layout.js');
  const url = `${pathToFileURL(path).href}?v=${statSync(path).mtimeMs}`;
  let mod = cache.get(url);
  if (!mod) {
    cache.clear();
    mod = import(/* webpackIgnore: true */ url) as Promise<SiteLayoutModule>;
    cache.set(url, mod);
  }
  return mod;
}
