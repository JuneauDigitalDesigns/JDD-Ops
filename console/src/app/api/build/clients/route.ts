import { NextResponse } from 'next/server';
import { listClients, repoExists, resolveRepoRoot } from '@/lib/export';

// Lists existing client slugs under clients/, flagging which already have a repo/.
// The export UI uses this to populate the destination dropdown.
export async function GET() {
  try {
    const repoRoot = resolveRepoRoot();
    const clients = listClients(repoRoot).map((slug) => ({
      slug,
      hasRepo: repoExists(repoRoot, slug),
    }));
    return NextResponse.json({ clients });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list clients.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
