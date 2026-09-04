import 'server-only';

/**
 * Turn a stored `siteUrl` value (from a `FeaturedRequestRecord`, sourced from the portal's
 * `PortalSite.canonical`) into something safe to hand to a screenshot API. That value can be
 * schemeless or absent entirely — see the agency repo's mirror of this helper for the full
 * rationale. Returns null in both cases so the caller can skip capture rather than pass an
 * empty or malformed URL to an external service.
 */
export function resolveShotUrl(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export interface CapturedScreenshot {
  bytes: Buffer;
  contentType: string;
}

/**
 * Capture a screenshot of a live URL via Microlink's free API (no API key, no Chromium to
 * host in the console). Subject to Microlink's free-tier rate limits and occasional
 * failures — callers wrap this in try/catch and fall back to the operator's manual upload.
 */
export async function captureScreenshot(url: string): Promise<CapturedScreenshot> {
  const api = new URL('https://api.microlink.io/');
  api.searchParams.set('url', url);
  api.searchParams.set('screenshot', 'true');
  api.searchParams.set('meta', 'false');
  api.searchParams.set('viewport.width', '1280');
  api.searchParams.set('viewport.height', '800');

  const res = await fetch(api.toString());
  if (!res.ok) {
    throw new Error(`Microlink request failed (${res.status})`);
  }

  const data = (await res.json()) as {
    status?: string;
    data?: { screenshot?: { url?: string } };
    message?: string;
  };
  const shotUrl = data?.data?.screenshot?.url;
  if (data.status !== 'success' || !shotUrl) {
    throw new Error(data?.message || 'Microlink returned no screenshot');
  }

  const imgRes = await fetch(shotUrl);
  if (!imgRes.ok) {
    throw new Error(`Screenshot image fetch failed (${imgRes.status})`);
  }
  const contentType = imgRes.headers.get('content-type') || 'image/png';
  const bytes = Buffer.from(await imgRes.arrayBuffer());
  return { bytes, contentType };
}
