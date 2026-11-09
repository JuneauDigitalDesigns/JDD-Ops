import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { opsRoot } from '@/lib/paths';
import type { UiPinRules } from '@/lib/sharedLibs';

/**
 * Loader for jdd-ops/lib/ui-pin.js — the ONE rule for when a client repo's @jdd/ui moves to the
 * template's pin. onboard.js applies it on every run; the console export applies it only once the
 * operator has confirmed the change it was shown.
 *
 * Loaded the same way provisionedFields.ts loads its module: an mtime-keyed file URL with
 * `webpackIgnore`, so Next does not bundle a file from outside the console root.
 *
 * Server-only: imports node:fs.
 */
const cache = new Map<string, Promise<UiPinRules>>();

export function loadUiPinRules(): Promise<UiPinRules> {
  const path = resolve(opsRoot(), 'lib', 'ui-pin.js');
  const url = `${pathToFileURL(path).href}?v=${statSync(path).mtimeMs}`;

  let mod = cache.get(url);
  if (!mod) {
    cache.clear();
    mod = import(/* webpackIgnore: true */ url) as Promise<UiPinRules>;
    cache.set(url, mod);
  }
  return mod;
}
