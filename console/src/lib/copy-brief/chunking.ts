import { ALL_SECTIONS, type Section } from '@/lib/copy-schema';

/**
 * Requesting every section in one json_schema compiles a grammar Claude rejects as too large
 * (see the original note on generate-copy/route.ts, now split between estimate and
 * generate-copy) — sections are chunked small and generated in parallel instead. Shared here
 * so the token estimate and the real run always agree on where the boundaries fall; a
 * mismatch would make the estimate's chunk count (and therefore its cost) wrong.
 */
export const CHUNK_SIZE = 2;

/** Split sections into CHUNK_SIZE groups, `brand` always force-included as its own member. */
export function chunkSections(sections: Section[]): Section[][] {
  const want = new Set<Section>(['brand', ...sections]);
  const ordered = ALL_SECTIONS.filter((s) => want.has(s));
  const chunks: Section[][] = [];
  for (let i = 0; i < ordered.length; i += CHUNK_SIZE) chunks.push(ordered.slice(i, i + CHUNK_SIZE));
  return chunks;
}
