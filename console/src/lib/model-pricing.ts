/**
 * The models offered on the Prompt stage's picker, replacing the never-set
 * CONSOLE_COPY_MODEL env var (generate-copy/route.ts and website-scan.ts both read it, and
 * it is set nowhere in this repo — every run has always silently fallen back to
 * 'claude-opus-4-8'). Pricing is per-million-token, current as of this writing; check
 * before trusting an old estimate against a stale rate.
 *
 * Exact model id strings — no date suffixes.
 */
export interface ModelOption {
  id: string;
  label: string;
  inputPerMTok: number;
  outputPerMTok: number;
}

export const MODEL_OPTIONS: ModelOption[] = [
  { id: 'claude-opus-5', label: 'Opus 5', inputPerMTok: 5.0, outputPerMTok: 25.0 },
  { id: 'claude-opus-4-8', label: 'Opus 4.8', inputPerMTok: 5.0, outputPerMTok: 25.0 },
  { id: 'claude-sonnet-5', label: 'Sonnet 5', inputPerMTok: 3.0, outputPerMTok: 15.0 },
  { id: 'claude-haiku-4-5', label: 'Haiku 4.5', inputPerMTok: 1.0, outputPerMTok: 5.0 },
];

export const DEFAULT_MODEL_ID = 'claude-opus-5';

export function modelOption(id: string): ModelOption {
  return MODEL_OPTIONS.find((m) => m.id === id) ?? MODEL_OPTIONS[0];
}

export function isValidModelId(id: string): boolean {
  return MODEL_OPTIONS.some((m) => m.id === id);
}

/** Rough $ estimate for one run: exact input tokens (from /api/build/estimate's
 *  countTokens call) plus an output guess, since output length is only known after
 *  generation. max_tokens is 4000 per chunk (generate-copy/route.ts) and a real response
 *  rarely fills it — 0.6 is a working guess, refined later from real `usage` once logged. */
export function estimateCost(model: ModelOption, inputTokens: number, chunks: number): { estInputTokens: number; estOutputTokens: number; estCostUsd: number } {
  const MAX_TOKENS_PER_CHUNK = 4000;
  const OUTPUT_FILL_RATIO = 0.6;
  const estOutputTokens = Math.round(chunks * MAX_TOKENS_PER_CHUNK * OUTPUT_FILL_RATIO);
  const estCostUsd = (inputTokens / 1_000_000) * model.inputPerMTok + (estOutputTokens / 1_000_000) * model.outputPerMTok;
  return { estInputTokens: inputTokens, estOutputTokens, estCostUsd };
}
