import { NextResponse } from 'next/server';
import { resolve } from 'node:path';
import { listClients, repoExists, resolveRepoRoot } from '@/lib/export';
import { loadIntake } from '@/lib/intake';

// Lists existing client slugs under clients/, flagging which already have a repo/ and
// reading each one's display name + plan out of clients/<slug>/site.ts so the wizard's
// Step 1 cards are human-readable rather than slug-only. The export UI also uses this to
// populate the destination dropdown (it only needs slug/hasRepo).
//
// loadIntake does a dynamic import per client, so this is slower than a bare readdir —
// fine for a local tool with a handful of clients, but worth caching if that grows.
// It returns null for unreadable/missing files, which degrades to name: null rather than
// failing the whole list.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const repoRoot = resolveRepoRoot();
    const clients = await Promise.all(
      listClients(repoRoot).map(async (slug) => {
        const intake = await loadIntake(resolve(repoRoot, 'clients', slug, 'site.ts'));
        const name = intake?.sites?.[0]?.brand?.name?.trim() || null;
        return { slug, hasRepo: repoExists(repoRoot, slug), name, plan: intake?.plan ?? null };
      }),
    );
    return NextResponse.json({ clients });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list clients.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
