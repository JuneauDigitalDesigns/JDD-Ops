import 'server-only';
import { loadGoogleCredentialPaths } from './opsSecrets';
import { loadSearchConsole, type SearchConsoleClient, type SearchConsoleModule } from './searchConsoleLib';
import type { StepResult } from './teardownOps';

/**
 * The console's side of L11: which Search Console properties JDD holds for a site, and leaving
 * them at teardown. The rules (property shape, Google's required order) live in
 * jdd-ops/lib/search-console.js; this only resolves credentials and maps outcomes.
 */

export async function searchConsole(): Promise<{ mod: SearchConsoleModule; client: SearchConsoleClient } | null> {
  const paths = loadGoogleCredentialPaths();
  if (!paths) return null;
  const mod = await loadSearchConsole();
  const oauth = mod.loadGoogleOAuth(paths);
  return oauth ? { mod, client: mod.createSearchConsoleClient({ oauth }) } : null;
}

/**
 * The properties JDD has in its own Search Console for these hosts: one URL-prefix property per
 * host, so a custom domain and the vercel.app alias are checked separately. `null` means it could
 * not be checked (Google not configured, or Google unreachable), which is never "none".
 */
export async function jddPropertiesFor(hosts: string[]): Promise<string[] | null> {
  const gsc = await searchConsole().catch(() => null);
  if (!gsc) return null;
  const out: string[] = [];
  try {
    for (const host of [...new Set(hosts)]) {
      const property = gsc.mod.propertyUrl(host);
      if (await gsc.client.getSite(property)) out.push(property);
    }
  } catch {
    return null;
  }
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Teardown: JDD leaves one property. Runs after the Vercel project and the repo are deleted, which
 * takes JDD's token file off the site; Google refuses to let JDD leave while it is still served,
 * so a host that still serves it (an edge cache) is re-checked for up to `waitMs` first.
 */
export async function leaveSearchConsoleProperty(property: string, { waitMs = 120_000, pollMs = 10_000 } = {}): Promise<StepResult> {
  const started = Date.now();
  const base = { resource: 'gsc.property', target: property };
  const gsc = await searchConsole().catch(() => null);
  if (!gsc) return { ...base, outcome: 'skipped', message: 'Google Search Console credentials not set', durationMs: Date.now() - started };
  while (Date.now() - started < waitMs && (await gsc.mod.verificationFileServed(property))) await sleep(pollMs);
  const out = await gsc.mod.leaveProperty({ client: gsc.client, property });
  const left = out.ok && (out.detail.startsWith('relinquished') || out.detail.endsWith('; unlisted'));
  // Wording W47–W49 in the shared-notes mockup (search-console-mockups.html), for approval.
  const message = !out.ok
    ? /still served/.test(out.detail)
      ? 'The token file is still on the site, and Google won’t let JDD leave until it’s gone.'
      : out.detail
    : left
      ? 'JDD left; removed from JDD’s list'
      : 'JDD had already left; not on JDD’s list';
  return { ...base, outcome: !out.ok ? 'failed' : left ? 'deleted' : 'already-gone', message, durationMs: Date.now() - started };
}
