import { NextResponse } from 'next/server';
import {
  firecrawlExtractionSchema,
  firecrawlExtractionPrompt,
  type ScrapedContent,
} from '@/data/firecrawl-schema';

// Scrapes a single page (the client's existing homepage) with Firecrawl's v2
// /scrape endpoint, asking for structured JSON shaped by firecrawlExtractionSchema.
// The route stays thin: it returns the raw `extracted` JSON and lets the client
// (ImportPanel) map it onto SiteContent and merge it into the imported intake.
//
// We call the REST API directly with fetch rather than pulling in an SDK — the
// v2 contract (formats: [{ type: 'json', schema }]) is stable and this keeps the
// studio dependency-free. FIRECRAWL_API_KEY is server-side only.

const FIRECRAWL_ENDPOINT = 'https://api.firecrawl.dev/v2/scrape';
const TIMEOUT_MS = 90_000;

/** Add https:// if the operator typed a bare domain, and validate. */
function normalizeUrl(raw: string): string | null {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return null;
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withProto);
    if (u.hostname.includes('.')) return u.toString();
    return null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'FIRECRAWL_API_KEY is not set. Add it to studio/preview/.env.local and restart the dev server.' },
      { status: 500 },
    );
  }

  let body: { url?: string };
  try {
    body = (await req.json()) as { url?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const url = normalizeUrl(body.url ?? '');
  if (!url) {
    return NextResponse.json({ error: 'Provide a valid website URL or domain to scrape.' }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(FIRECRAWL_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        onlyMainContent: false, // keep nav + footer so we can pull nav links / social
        formats: [
          {
            type: 'json',
            schema: firecrawlExtractionSchema,
            prompt: firecrawlExtractionPrompt,
          },
        ],
      }),
      signal: controller.signal,
    });

    const payload = (await res.json().catch(() => null)) as
      | { success?: boolean; data?: { json?: unknown }; error?: string }
      | null;

    if (!res.ok || !payload || payload.success === false) {
      const detail = payload?.error || `Firecrawl returned ${res.status}.`;
      return NextResponse.json(
        { error: `Scrape failed: ${detail}` },
        { status: res.status >= 400 && res.status < 600 ? res.status : 502 },
      );
    }

    const extracted = (payload.data?.json ?? {}) as ScrapedContent;
    return NextResponse.json({ url, extracted });
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    const message = aborted
      ? 'Scrape timed out. Try again or check the URL.'
      : err instanceof Error
        ? err.message
        : 'Scrape failed.';
    return NextResponse.json({ error: message }, { status: 504 });
  } finally {
    clearTimeout(timeout);
  }
}
