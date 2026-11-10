import 'server-only';
import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { vercelAppHost } from '@jdd/schema';
import { opsRoot } from './paths';
import { loadCloudflareCredentials } from './opsSecrets';

/**
 * Bridge to jdd-ops/lib/turnstile-pool.js: the pool of Cloudflare Turnstile widgets behind every
 * client site's lead form. Same `webpackIgnore`'d import as vercelSync.ts, so Next never bundles
 * a file from outside the console, with the mtime in the URL so an edit takes effect.
 *
 * The console only ever ADDS a hostname to the widget a site already renders (`allowMove: false`).
 * Moving a site to another widget changes its public key, which needs a rebuild: that is
 * onboard.js's job, and the console says so rather than doing half of it.
 */

export interface TurnstilePlan {
  action: 'none' | 'add' | 'create' | 'full';
  siteKey: string | null;
  missing: string[];
  changesSiteKey: boolean;
  domains?: string[];
  name?: string;
}
export interface TurnstileWidget {
  sitekey: string;
  name: string;
  domains: string[];
}
interface PoolModule {
  siteHostnames(input: { vercelHost: string; domains: string[] }): string[];
  ensureSiteOnPool(input: {
    accountId: string;
    token: string;
    wanted: string[];
    currentSiteKey: string;
    allowMove: boolean;
    storeSecret: (siteKey: string, secret: string) => Promise<void>;
    dryRun?: boolean;
  }): Promise<{ plan: TurnstilePlan; siteKey: string | null; widgets: TurnstileWidget[] }>;
  listWidgets(input: { accountId: string; token: string }): Promise<TurnstileWidget[]>;
  missingTurnstileHostnames(input: { widgets: TurnstileWidget[]; siteKey: string; wanted: string[] }): {
    ok: boolean;
    siteKeyKnown: boolean;
    missing: string[];
  };
  describeTurnstilePlan(plan: TurnstilePlan): string;
}

const cache = new Map<string, Promise<PoolModule>>();
export function loadTurnstilePool(): Promise<PoolModule> {
  const path = resolve(opsRoot(), 'lib', 'turnstile-pool.js');
  const url = `${pathToFileURL(path).href}?v=${statSync(path).mtimeMs}`;
  let mod = cache.get(url);
  if (!mod) {
    cache.clear();
    mod = import(/* webpackIgnore: true */ url) as Promise<PoolModule>;
    cache.set(url, mod);
  }
  return mod;
}

/** The console never creates a widget, so it never holds a secret. */
const noSecrets = async () => {
  throw new Error('the console does not create Turnstile widgets');
};

export type WidgetHostnamesResult =
  | { ok: true; added: string[]; siteKey: string }
  | { ok: false; error: string };

/**
 * Put `hostnames` on the widget this site renders, or say exactly why not. Used before a domain is
 * attached (so a refusal attaches nothing) and by the finding's "Add" button.
 */
export async function addHostnamesToSiteWidget({
  slug,
  siteSlug,
  siteKey,
  hostnames,
}: {
  slug: string;
  siteSlug: string;
  siteKey: string;
  hostnames: string[];
}): Promise<WidgetHostnamesResult> {
  const named = hostnames.join(', ');
  const creds = loadCloudflareCredentials();
  if (!creds) {
    return {
      ok: false,
      error:
        `CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID aren't set in jdd-ops/.env, so ${named} can't be added to ` +
        "this site's Turnstile widget. Without it the lead form's human check can't run there: leads would still " +
        'arrive, but no AI call would be placed for them. Add the token, then try again.',
    };
  }
  if (!siteKey) {
    return {
      ok: false,
      error: `This site has no Turnstile site key yet. Re-run onboarding for ${slug} first; it assigns one. Then try again.`,
    };
  }
  const pool = await loadTurnstilePool();
  const wanted = pool.siteHostnames({ vercelHost: vercelAppHost(siteSlug), domains: hostnames });
  try {
    const { plan } = await pool.ensureSiteOnPool({
      accountId: creds.accountId,
      token: creds.token,
      wanted,
      currentSiteKey: siteKey,
      allowMove: false,
      storeSecret: noSecrets,
    });
    if (plan.action === 'full') {
      return {
        ok: false,
        error:
          `This site's Turnstile widget (${siteKey}) has no room for ${plan.missing.join(', ')}, or isn't one of the ` +
          `pool's widgets. Re-run onboarding for ${slug}: it moves the site to a widget with room and rebuilds it. Then try again.`,
      };
    }
    return { ok: true, added: plan.missing, siteKey };
  } catch (e) {
    return {
      ok: false,
      error: `Couldn't add ${named} to this site's Turnstile widget: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
