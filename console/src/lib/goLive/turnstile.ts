import 'server-only';
import { readOpsEnv } from './env';
import type { GoLiveResult } from './types';

/**
 * Create the production Cloudflare Turnstile widget the go-live step used to send you to the
 * dashboard for. Same shape as stripePrices.ts / upstash.ts: a management credential from
 * jdd-ops/.env, a no-write dry run, and a real run that `captured`s the two keys.
 *
 * Credentials (Cloudflare dashboard):
 *   CLOUDFLARE_API_TOKEN   — a token with Account › Turnstile › Edit
 *   CLOUDFLARE_ACCOUNT_ID  — the account id (dashboard URL / Account Home → Account ID)
 * Optional override:
 *   TURNSTILE_WIDGET_NAME  (default 'JDD production')
 *
 * The secret is only ever returned by Cloudflare at CREATE time. So this reuses a widget of
 * the same name for the sitekey but cannot re-read its secret — if the widget already exists
 * it reports the sitekey and tells you to rotate the secret in the dashboard rather than
 * silently rotating it (which would invalidate whatever is already deployed).
 */

const API = 'https://api.cloudflare.com/client/v4';
const DOMAIN = 'juneaudigitaldesigns.com';

interface CfWidget {
  sitekey: string;
  secret?: string;
  name: string;
  domains?: string[];
}

interface CfResponse<T> {
  success: boolean;
  errors?: { code: number; message: string }[];
  result: T;
}

async function cf<T>(path: string, init: RequestInit, token: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  const body = (await res.json().catch(() => null)) as CfResponse<T> | null;
  if (!res.ok || !body?.success) {
    const msg = body?.errors?.map((e) => `${e.code} ${e.message}`).join('; ') || res.statusText;
    throw new Error(`Cloudflare ${res.status}: ${msg}`);
  }
  return body.result;
}

export async function runTurnstileProvision(dryRun: boolean): Promise<GoLiveResult> {
  const ops = readOpsEnv();
  const token = ops.CLOUDFLARE_API_TOKEN ?? '';
  const account = ops.CLOUDFLARE_ACCOUNT_ID ?? '';
  const name = ops.TURNSTILE_WIDGET_NAME || 'JDD production';

  const haveCreds = Boolean(token && account);
  const base = `/accounts/${account}/challenges/widgets`;

  // ── Dry run ──────────────────────────────────────────────────────────────
  if (dryRun) {
    if (!haveCreds) {
      return {
        ok: true,
        dryRun: true,
        title: 'Turnstile widget — preview',
        summary: `Would create a managed widget for ${DOMAIN}. Add CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID to jdd-ops/.env to run for real.`,
        lines: [`• would create "${name}" (managed, ${DOMAIN})`],
      };
    }
    try {
      const list = await cf<CfWidget[]>(base, { method: 'GET' }, token);
      const existing = list.find((w) => w.name === name);
      return {
        ok: true,
        dryRun: true,
        title: 'Turnstile widget — preview',
        summary: existing
          ? `A widget named "${name}" already exists (sitekey ${existing.sitekey}). Cloudflare only returns the secret at creation — the real run will report the sitekey and ask you to rotate the secret in the dashboard.`
          : `Would create "${name}" (managed, ${DOMAIN}) and capture the site key + secret.`,
        lines: [existing ? `• widget exists — ${existing.sitekey}` : `• create "${name}" (managed, ${DOMAIN})`],
      };
    } catch (err) {
      return { ok: false, dryRun: true, error: err instanceof Error ? err.message : 'Cloudflare request failed.' };
    }
  }

  // ── Real run ─────────────────────────────────────────────────────────────
  if (!haveCreds) {
    return {
      ok: false,
      dryRun: false,
      error: 'Set CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID in jdd-ops/.env (token needs Account › Turnstile › Edit) to provision for real.',
    };
  }

  try {
    const list = await cf<CfWidget[]>(base, { method: 'GET' }, token);
    const existing = list.find((w) => w.name === name);

    if (existing) {
      // Don't auto-rotate — that would invalidate a secret that may already be deployed.
      return {
        ok: true,
        dryRun: false,
        title: 'Turnstile widget',
        summary: `A widget named "${name}" already exists. Its site key is below; Cloudflare only shows the secret at creation, so rotate the secret in the dashboard (or delete this widget and re-run) to get TURNSTILE_SECRET_KEY.`,
        lines: [`• reused ${existing.sitekey} — secret not re-readable`],
        captured: [{ label: 'NEXT_PUBLIC_TURNSTILE_SITE_KEY', value: existing.sitekey }],
      };
    }

    const created = await cf<CfWidget>(
      base,
      { method: 'POST', body: JSON.stringify({ name, domains: [DOMAIN], mode: 'managed' }) },
      token,
    );
    if (!created.secret) {
      return { ok: false, dryRun: false, error: `Created widget ${created.sitekey} but Cloudflare did not return a secret — check the Turnstile dashboard.` };
    }

    return {
      ok: true,
      dryRun: false,
      title: 'Turnstile widget',
      summary: 'Paste both into the agency env. The secret is shown only now — capture it before leaving this screen.',
      lines: [`✓ created "${name}" — ${created.sitekey}`],
      captured: [
        { label: 'NEXT_PUBLIC_TURNSTILE_SITE_KEY', value: created.sitekey },
        { label: 'TURNSTILE_SECRET_KEY', value: created.secret },
      ],
    };
  } catch (err) {
    return { ok: false, dryRun: false, error: err instanceof Error ? err.message : 'Turnstile provisioning failed.' };
  }
}
