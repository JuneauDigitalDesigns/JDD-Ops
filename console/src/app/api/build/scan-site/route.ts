import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getAnthropicKey } from '@/lib/anthropic';
import { normalizeUrl, scanWebsiteNotes } from '@/lib/website-scan';

export const runtime = 'nodejs';

/**
 * Scanning, split out of generate-copy so a URL in the Brief's Website block is fetched
 * ONCE and stored, not re-fetched on every generate run (D4 — the duplicated-scan defect).
 * scanWebsiteNotes/normalizeUrl are reused completely unchanged from lib/website-scan.ts —
 * this route is a thin wrapper, plus one cheap Haiku pass to lift a few structured facts out
 * of the notes text so the Brief's Facts block can offer them as one-click "apply" rows
 * instead of the operator re-typing what the notes already say.
 */

const FACT_FIELDS = ['name', 'tagline', 'phone', 'email', 'address', 'license', 'established'] as const;
type FactField = (typeof FACT_FIELDS)[number];

const FACTS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: Object.fromEntries(FACT_FIELDS.map((f) => [f, { type: 'string' }])),
  required: [],
};

async function extractFacts(client: Anthropic, notes: string): Promise<Partial<Record<FactField, string>>> {
  try {
    const res = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 500,
      system: 'Extract these facts from the notes below, verbatim as written. Omit any field not clearly present — never guess or invent. Return ONLY JSON matching the schema.',
      output_config: { format: { type: 'json_schema', schema: FACTS_SCHEMA } },
      messages: [{ role: 'user', content: notes }],
    });
    const tb = res.content.find((b) => b.type === 'text');
    if (!tb || tb.type !== 'text') return {};
    return JSON.parse(tb.text) as Partial<Record<FactField, string>>;
  } catch {
    // Facts extraction is a convenience on top of the notes, which are the real ground
    // truth either way — a failure here shouldn't fail the whole scan.
    return {};
  }
}

export async function POST(req: Request) {
  let body: { url?: string };
  try {
    body = (await req.json()) as { url?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  let url: string;
  try {
    url = normalizeUrl(body.url ?? '');
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Invalid URL.' }, { status: 400 });
  }

  let key: string;
  try {
    key = getAnthropicKey();
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No API key.' }, { status: 500 });
  }
  const client = new Anthropic({ apiKey: key });

  let notes: string;
  try {
    notes = await scanWebsiteNotes(client, url);
  } catch (e) {
    return NextResponse.json({ error: `Website scan failed: ${e instanceof Error ? e.message : 'unknown error'}` }, { status: 502 });
  }

  const facts = await extractFacts(client, notes);
  return NextResponse.json({ notes, facts, url });
}
