import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { BUILT_IN_VERTICALS, type CopyBrief } from '@jdd/schema';
import type { SiteContent } from '@/data/site';
import { getAnthropicKey } from '@/lib/anthropic';
import { ALL_SECTIONS, type Section } from '@/lib/copy-schema';
import { resolveBrief } from '@/lib/copy-brief/resolve';
import { compileBriefPrompt } from '@/lib/copy-brief/compile-brief';
import { CHUNK_SIZE, chunkSections } from '@/lib/copy-brief/chunking';
import { editsFrom } from '@/lib/copy-brief/grounded';
import { presetFor } from '@/lib/verticals';
import { isValidModelId, modelOption, estimateCost, DEFAULT_MODEL_ID } from '@/lib/model-pricing';
import { planRunSections, type CopyPage } from '@/lib/copy-brief/run-sections';
import { pickServicePages } from '@/lib/servicePages';
import { pickTownPages, pickTownServicePages } from '@/lib/townPages';
import { MAX_PAGES } from '@/lib/pages';

export const runtime = 'nodejs';

interface Body {
  vertical?: string;
  base?: SiteContent;
  imported?: SiteContent | null;
  /** The operator's edits by path. With `imported`, the only source of the brief's facts. */
  edits?: Record<string, unknown>;
  brief?: CopyBrief;
  sections?: Section[];
  model?: string;
  /** The pages besides Home that the `subpages` section writes for (copy-brief/run-sections.ts). */
  subpages?: CopyPage[];
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
  // The same plan generate-copy runs, so the estimate prices the chunks Generate will send.
  const subpages = Array.isArray(body.subpages) ? body.subpages : [];
  const { sections } = planRunSections({
    requested, all: ALL_SECTIONS, subpages, hasServicePages: pickServicePages(base, MAX_PAGES).length > 0,
    hasTownPages: pickTownPages(base).length > 0, hasTownServicePages: pickTownServicePages(base).length > 0,
  });
  const chunks = chunkSections(sections);

  const ctx = {
    vertical, effective: base, imported: body.imported ?? null,
    preset: presetFor(vertical.id), edits: editsFrom(body.edits), brief,
    tickedSections: sections, subpages,
  };
  const blocks = resolveBrief(ctx);

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
        const { system, user } = compileBriefPrompt(ctx, blocks, chunk);
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
