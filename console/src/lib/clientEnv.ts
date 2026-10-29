import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { opsRoot } from '@/lib/paths';

/**
 * Loader for jdd-ops/lib/client-env.js — the ONE definition of a client's `.env.local`.
 *
 * Why a dynamic import rather than a normal one: `buildClientEnvLines` is the plan-tier matrix
 * (which tier emails leads vs calls them back, who gets the voice stack, and that
 * CLIENT_FORWARD_PHONE is the owner's line and never the Twilio number). It lives in the ops
 * root, outside the Next project, so it is loaded the same way `reconcileProbes.ts` loads
 * `lib/reconcile-probes.js`: an mtime-keyed file URL with `webpackIgnore` so Next doesn't try
 * to bundle it, and a one-entry cache so edits are picked up without restarting the dev server.
 *
 * Why it matters that the console uses this at all: `/manage`'s plan-upgrade route used to
 * carry its own hand-written copy of the template, and that copy had drifted — it wrote a
 * 25-second ring window where onboard.js writes 15. Above ~20s the owner's carrier voicemail
 * answers the forward leg, Twilio scores the call as answered, the no-answer branch never
 * fires, and the caller lands in voicemail instead of the receptionist. Every client upgraded
 * to Growth through the console would have inherited that silently.
 *
 * Server-only: imports node:fs. Never pull this into a client component.
 */

export interface ClientEnvModule {
  buildClientEnvLines(args: {
    siteSlug: string;
    plan: string;
    content: { brand: { email?: string | null; name?: string | null; phone?: string | null } };
    webOnly: boolean;
    prev?: Record<string, string>;
    env?: Record<string, string | undefined>;
  }): { lines: string[]; carried: string[] };
  clampRingSeconds(raw: unknown): number;
  RING_SECONDS_DEFAULT: number;
  RING_SECONDS_MIN: number;
  RING_SECONDS_MAX: number;
}

const cache = new Map<string, Promise<ClientEnvModule>>();

export function loadClientEnv(): Promise<ClientEnvModule> {
  const path = resolve(opsRoot(), 'lib', 'client-env.js');
  const url = `${pathToFileURL(path).href}?v=${statSync(path).mtimeMs}`;

  let mod = cache.get(url);
  if (!mod) {
    cache.clear(); // drop the stale revision; only the current one is useful
    mod = import(/* webpackIgnore: true */ url) as Promise<ClientEnvModule>;
    cache.set(url, mod);
  }
  return mod;
}

/**
 * The `KEY=value` lines the shared builder produces, as an object.
 *
 * The plan route needs a `Record<string, string>` of updates rather than a file body, and
 * parsing the builder's own output is deliberate: it guarantees the console applies exactly
 * what onboard.js would write, instead of re-deriving a parallel list that can drift again.
 */
export function envLinesToObject(lines: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of lines) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2];
  }
  return out;
}
