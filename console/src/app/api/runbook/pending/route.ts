import { NextResponse } from 'next/server';
import { listPendingOnboardRecords, pendingKvConfigured } from '@/lib/pendingKv';
import type { PendingOnboardSummary } from '@/components/picker/PendingOnboardCard';

export async function GET() {
  if (!pendingKvConfigured()) {
    return NextResponse.json({ pending: [], error: null });
  }

  try {
    const records = await listPendingOnboardRecords();
    const pending: PendingOnboardSummary[] = records.map((r) => ({
      slug: r.slug,
      name: r.name,
      plan: r.plan,
      signerEmail: r.signerEmail,
      createdAt: r.createdAt,
    }));
    return NextResponse.json({ pending });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'KV lookup failed.';
    return NextResponse.json({ pending: [], error: msg });
  }
}
