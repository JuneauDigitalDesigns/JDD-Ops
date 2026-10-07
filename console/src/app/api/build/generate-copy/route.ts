import Anthropic from '@anthropic-ai/sdk';
import { BUILT_IN_VERTICALS, type CopyBrief } from '@jdd/schema';
import type { SiteContent } from '@/data/site';
import { getAnthropicKey } from '@/lib/anthropic';
import { buildCopySchema, ALL_SECTIONS, type Section, type CopyResult } from '@/lib/copy-schema';
import { resolveBrief } from '@/lib/copy-brief/resolve';
import { compileBriefPrompt } from '@/lib/copy-brief/compile-brief';
import { chunkSections } from '@/lib/copy-brief/chunking';
import { applyGeneratedCopy } from '@/lib/copy-brief/apply-generated';
import { isValidModelId, DEFAULT_MODEL_ID } from '@/lib/model-pricing';

export const runtime = 'nodejs';

/**
 * Brief-driven, streaming replacement for the old details/url-based, single-JSON-response
 * route (P6 of the intake rebuild). The structured-output merge logic (turning the
 * copywriter's CopyResult into a Partial<SiteContent> overlay) is unchanged — it moved
 * verbatim to lib/copy-brief/apply-generated.ts. What changed is everything upstream of it:
 * the prompt is compiled per-chunk from the Brief's eleven resolved blocks
 * (compileBriefPrompt) instead of two fixed functions fed a free-text `details` string, and
 * results stream back as NDJSON so the Prompt stage can show per-section progress instead of
 * waiting on one opaque request.
 *
 * Scanning is NOT done here any more (D4 — the duplicated-scan defect): the Brief's Website
 * block already carries whatever notes /api/build/scan-site fetched, so this route never
 * calls web_fetch itself.
 */

interface Body {
  vertical?: string;
  base?: SiteContent;
  imported?: SiteContent | null;
  brief?: CopyBrief;
  sections?: Section[];
  model?: string;
  /** Non-home pages of a multi-page build. Enables the `subpages` section (per-route header +
   *  SEO) and page-aware prompting; omit/empty for a single-page site. */
  subpages?: { route: string; pageType: string; label: string }[];
}

const REFUSAL = '__refusal__';

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response('Invalid JSON body.', { status: 400 });
  }

  const { base, brief } = body;
  if (!base || !base.brand) return new Response('Missing base content.', { status: 400 });
  if (!brief) return new Response('Missing brief.', { status: 400 });

  const vertical = BUILT_IN_VERTICALS.find((v) => v.id === body.vertical);
  if (!vertical) return new Response('Unknown vertical.', { status: 400 });

  const modelId = body.model && isValidModelId(body.model) ? body.model : DEFAULT_MODEL_ID;

  // Non-home pages, when this is a multi-page build. Drives the `subpages` section and the
  // page-aware prompt; without them we must never ask the model for subpage copy.
  const subpages = Array.isArray(body.subpages) ? body.subpages : [];

  const requested = Array.isArray(body.sections) ? body.sections.filter((s): s is Section => ALL_SECTIONS.includes(s)) : [];
  const requestedOrAll = requested.length ? requested : ALL_SECTIONS.filter((s) => s !== 'brand');
  // `subpages` is only generable when the build actually has subpages — drop it otherwise,
  // whether it arrived via an explicit sections list or the "all sections" default.
  const sections = subpages.length ? requestedOrAll : requestedOrAll.filter((s) => s !== 'subpages');
  const chunks = chunkSections(sections);
  const wantedSet = new Set<Section>(['brand', ...sections]);

  let key: string;
  try {
    key = getAnthropicKey();
  } catch (e) {
    return new Response(e instanceof Error ? e.message : 'No API key.', { status: 500 });
  }
  const client = new Anthropic({ apiKey: key });
  const imported = body.imported ?? null;

  const ctx = { vertical, effective: base, imported, brief, tickedSections: sections, subpages };
  const blocks = resolveBrief(ctx);

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      };
      const finish = () => {
        if (closed) return;
        closed = true;
        controller.close();
      };

      send({ type: 'start', sections, chunks: chunks.length });

      async function generateChunk(chunk: Section[]): Promise<{ chunk: Section[]; result: Partial<CopyResult> } | null> {
        for (const s of chunk) send({ type: 'section', section: s, status: 'writing' });
        try {
          const { system, user } = compileBriefPrompt(ctx, blocks, chunk);
          const res = await client.messages.create({
            model: modelId,
            max_tokens: 4000,
            system,
            output_config: { format: { type: 'json_schema', schema: buildCopySchema(chunk, false) } },
            messages: [{ role: 'user', content: user }],
          });
          if (res.stop_reason === 'refusal') throw new Error(REFUSAL);
          const tb = res.content.find((b) => b.type === 'text');
          if (!tb || tb.type !== 'text') throw new Error('No copy returned.');
          const result = JSON.parse(tb.text) as Partial<CopyResult>;
          for (const s of chunk) send({ type: 'section', section: s, status: 'done' });
          send({ type: 'usage', model: modelId, input_tokens: res.usage.input_tokens, output_tokens: res.usage.output_tokens });
          return { chunk, result };
        } catch (e) {
          const message =
            e instanceof Error && e.message === REFUSAL ? 'The model declined this request.'
            : e instanceof Anthropic.APIError ? `${e.status ?? ''} ${e.message}`.trim()
            : e instanceof Error ? e.message
            : 'Generation failed.';
          for (const s of chunk) send({ type: 'section', section: s, status: 'failed', error: message });
          return null;
        }
      }

      try {
        const settled = await Promise.all(chunks.map(generateChunk));
        const ok = settled.filter((r): r is NonNullable<typeof r> => r !== null);

        if (ok.length === 0) {
          send({ type: 'error', message: 'Every section failed. See the per-section errors above.' });
          finish();
          return;
        }

        const merged: Partial<CopyResult> = Object.assign({}, ...ok.map((r) => r.result));
        const generated = applyGeneratedCopy(base, merged, wantedSet);
        send({ type: 'done', generated });
      } catch (e) {
        send({ type: 'error', message: e instanceof Error ? e.message : 'Generation failed.' });
      } finally {
        finish();
      }
    },
  });

  return new Response(stream, {
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' },
  });
}
