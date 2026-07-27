import 'server-only';

/**
 * Is this URL serving? Shared by the roster health check and the Domain section.
 *
 * Never throws — an unreachable host is the answer, not an exception.
 */

export const PROBE_TIMEOUT_MS = 4000;

export interface ProbeResult {
  ok: boolean;
  status: number | null;
  ms: number;
  error?: string;
}

/**
 * HEAD the URL, falling back to GET on 405 — some hosts reject HEAD outright, and a bare
 * "405" would read as an outage when the site is fine.
 */
export async function probeUrl(url: string): Promise<ProbeResult> {
  const started = Date.now();
  const opts = {
    redirect: 'follow' as const,
    signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    cache: 'no-store' as const,
  };
  try {
    let res = await fetch(url, { method: 'HEAD', ...opts });
    if (res.status === 405) res = await fetch(url, { method: 'GET', ...opts });
    return { ok: res.ok, status: res.status, ms: Date.now() - started };
  } catch (err) {
    return {
      ok: false,
      status: null,
      ms: Date.now() - started,
      error: err instanceof Error ? err.message : 'unreachable',
    };
  }
}
