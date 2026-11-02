import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { opsRoot } from '@/lib/paths';

/**
 * Loader for jdd-ops/lib/provisioned-fields.js — the ONE definition of which `site.ts` fields
 * onboard.js owns and the console must carry forward rather than overwrite.
 *
 * Loaded the same way `clientEnv.ts` loads `lib/client-env.js`: an mtime-keyed file URL with
 * `webpackIgnore` so Next doesn't bundle it, plus a one-entry cache so an edit is picked up
 * without restarting the dev server. The module lives in the ops root because onboard.js is
 * the other consumer and a normal import would drag its whole SDK graph into a Next route.
 *
 * Why the console cares: the export payload's `brand.phone` is the OWNER'S number, taken from
 * the intake. The repo's is the published JDD Twilio number, written by provisioning. Writing
 * the payload over it republishes the owner's line, and every inbound caller then bypasses
 * `/api/voice` — no human-first forward, no Retell fallback, no Airtable row, and no error.
 *
 * Server-only: imports node:fs. Never pull this into a client component.
 */

export interface ProvisionedFieldsModule {
  PROVISIONED_FIELDS: string[];
  CONSOLE_CONTENT_MARKER: string;
  hasConsoleMarker(src: string): boolean;
  extractContentObject(src: string): Record<string, unknown> | null;
  getPath(obj: unknown, path: string): unknown;
  setPath(obj: unknown, path: string, value: unknown): boolean;
  overlayProvisionedFields<T>(
    incoming: T,
    provisioned: unknown,
    fields?: string[],
  ): { content: T; applied: { path: string; value: unknown }[] };
}

const cache = new Map<string, Promise<ProvisionedFieldsModule>>();

export function loadProvisionedFields(): Promise<ProvisionedFieldsModule> {
  const path = resolve(opsRoot(), 'lib', 'provisioned-fields.js');
  const url = `${pathToFileURL(path).href}?v=${statSync(path).mtimeMs}`;

  let mod = cache.get(url);
  if (!mod) {
    cache.clear(); // drop the stale revision; only the current one is useful
    mod = import(/* webpackIgnore: true */ url) as Promise<ProvisionedFieldsModule>;
    cache.set(url, mod);
  }
  return mod;
}
