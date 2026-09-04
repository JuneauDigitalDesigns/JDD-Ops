import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { BUILT_IN_VERTICALS, type CopyBrief } from '@jdd/schema';
import type { SiteContent } from '@/data/site';
import { getAnthropicKey } from '@/lib/anthropic';
import { ALL_SECTIONS, type Section } from '@/lib/copy-schema';
import { resolveBrief } from '@/lib/copy-brief/resolve';
import { compileBriefPrompt } from '@/lib/copy-brief/compile-brief';
import { CHUNK_SIZE, chunkSections } from '@/lib/copy-brief/chunking';
import { isValidModelId, modelOption, estimateCost, DEFAULT_MODEL_ID } from '@/lib/model-pricing';

export const runtime = 'nodejs';

interface Body {
  vertical?: string;
  base?: SiteContent;
  imported?: SiteContent | null;
  brief?: CopyBrief;
  sections?: Section[];
  model?: string;
}

/**
 * An exact input-token count (via messages.countTokens) for the brief as currently compiled,
 * plus a cost estimate. Does NOT count the json_schema grammar itself — countTokens has no
 * parameter for output_config, so the real per-request input is somewhat higher than this
 * reports; the UI labels the number accordingly rather than implying more precision than it has.
 */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { base, brief } = body;
  if (!base || !base.brand || !brief) {
    return NextResponse.json({ error: 'Missing base content or brief.' }, { status: 400 });
  }
  const vertical = BUILT_IN_VERTICALS.find((v) => v.id === body.vertical) ?? BUILT_IN_VERTICALS[0];
  const modelId = body.model && isValidModelId(body.model) ? body.model : DEFAULT_MODEL_ID;
  const model = modelOption(modelId);

  const requested = Array.isArray(body.sections) ? body.sections.filter((s): s is Section => ALL_SECTIONS.includes(s)) : [];
  const sections = requested.length ? requested : ALL_SECTIONS.filter((s) => s !== 'brand');
  const chunks = chunkSections(sections);

  const blocks = resolveBrief({
    vertical, effective: base, imported: body.imported ?? null, brief,
    tickedSections: sections,
  });

  let key: string;
  try {
    key = getAnthropicKey();
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No API key.' }, { status: 500 });
  }
  const client = new Anthropic({ apiKey: key });

  try {
    const counts = await Promise.all(
      chunks.map(async (chunk) => {
        const { system, user } = compileBriefPrompt({ vertical, effective: base, imported: body.imported ?? null, brief, tickedSections: sections }, blocks, chunk);
        const res = await client.messages.countTokens({
          model: modelId,
          system,
          messages: [{ role: 'user', content: user }],
        });
        return res.input_tokens;
      }),
    );
    const inputTokens = counts.reduce((a, b) => a + b, 0);
    const estimate = estimateCost(model, inputTokens, chunks.length);
    return NextResponse.json({ ...estimate, model: modelId, chunks: chunks.length });
  } catch (e) {
    const msg = e instanceof Anthropic.APIError ? `${e.status ?? ''} ${e.message}`.trim() : e instanceof Error ? e.message : 'Token count failed.';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
