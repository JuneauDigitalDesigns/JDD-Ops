import 'server-only';
import { NextResponse } from 'next/server';
import {
  createEntry,
  deleteEntry,
  financeStoreConfigured,
  listEntries,
  patchEntry,
} from './financeStore';
import { getFinanceSettings } from './financeSettings';
import { cleanNote, guardLocal, isValidAmountCents, isValidDate } from './financeGuard';
import type { LedgerEntry, LedgerKind } from './financeTypes';

/**
 * One set of CRUD handlers, shared by the expenses, draws, and reserve routes.
 *
 * The three ledgers have identical mechanics and differ only in whether a category applies, so
 * three hand-written routes would be three places to fix the same validation bug. The keyspaces
 * stay separate in storage (see financeStore.ts) — this shares the HTTP layer, not the data.
 */

const KV_HINT =
  'Finances storage not configured — set KV_REST_API_URL and KV_REST_API_TOKEN in ' +
  'console/.env.local (the same pair the lead queue uses).';

export function ledgerHandlers(kind: LedgerKind) {
  /** Only expenses carry a category; a draw or reserve transfer has nothing to categorise. */
  const usesCategory = kind === 'expense';

  /**
   * Missing KV returns 200 with an empty list and an explanatory error, rather than a 5xx.
   * Same posture as /api/leads: an unconfigured console should render a page that explains
   * itself, not an error boundary.
   */
  async function GET(req: Request) {
    const gate = guardLocal(req);
    if (gate) return gate;

    if (!financeStoreConfigured()) {
      return NextResponse.json({ entries: [], error: KV_HINT }, { status: 200 });
    }

    try {
      return NextResponse.json({ entries: await listEntries(kind) });
    } catch (e) {
      console.error(`[/api/finances/${kind}] list failed`, e);
      return NextResponse.json(
        { entries: [], error: 'Could not read that ledger.' },
        { status: 200 },
      );
    }
  }

  async function POST(req: Request) {
    const gate = guardLocal(req);
    if (gate) return gate;
    if (!financeStoreConfigured()) {
      return NextResponse.json({ error: KV_HINT }, { status: 503 });
    }

    let body: { date?: unknown; amountCents?: unknown; note?: unknown; category?: unknown };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
    }

    if (!isValidDate(body.date)) {
      return NextResponse.json({ error: 'date must be a real YYYY-MM-DD date.' }, { status: 400 });
    }
    if (!isValidAmountCents(body.amountCents)) {
      return NextResponse.json(
        { error: 'amountCents must be a whole number of cents greater than zero.' },
        { status: 400 },
      );
    }

    let category: string | undefined;
    if (usesCategory) {
      // Validated against the operator's own list so a typo can't create a phantom category
      // that then fragments the totals.
      const settings = await getFinanceSettings();
      const raw = typeof body.category === 'string' ? body.category.trim() : '';
      if (!raw) return NextResponse.json({ error: 'category is required.' }, { status: 400 });
      const match = settings.categories.find((c) => c.toLowerCase() === raw.toLowerCase());
      if (!match) {
        return NextResponse.json(
          { error: `Unknown category "${raw}". Add it in Settings first.` },
          { status: 400 },
        );
      }
      category = match;
    }

    const entry: LedgerEntry = {
      id: crypto.randomUUID(),
      date: body.date,
      amountCents: body.amountCents,
      note: cleanNote(body.note),
      createdAt: new Date().toISOString(),
      ...(category ? { category } : {}),
    };

    try {
      return NextResponse.json({ entry: await createEntry(kind, entry) });
    } catch (e) {
      console.error(`[/api/finances/${kind}] create failed`, e);
      return NextResponse.json({ error: 'Could not save that entry.' }, { status: 500 });
    }
  }

  /** Click-to-edit sends one field at a time, so every field here is optional. */
  async function PATCH(req: Request) {
    const gate = guardLocal(req);
    if (gate) return gate;
    if (!financeStoreConfigured()) {
      return NextResponse.json({ error: KV_HINT }, { status: 503 });
    }

    let body: {
      id?: unknown;
      date?: unknown;
      amountCents?: unknown;
      note?: unknown;
      category?: unknown;
    };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
    }

    if (typeof body.id !== 'string' || !body.id) {
      return NextResponse.json({ error: 'id is required.' }, { status: 400 });
    }
    if (body.date !== undefined && !isValidDate(body.date)) {
      return NextResponse.json({ error: 'date must be a real YYYY-MM-DD date.' }, { status: 400 });
    }
    if (body.amountCents !== undefined && !isValidAmountCents(body.amountCents)) {
      return NextResponse.json(
        { error: 'amountCents must be a whole number of cents greater than zero.' },
        { status: 400 },
      );
    }

    let category: string | undefined;
    if (usesCategory && body.category !== undefined) {
      const settings = await getFinanceSettings();
      const raw = typeof body.category === 'string' ? body.category.trim() : '';
      const match = settings.categories.find((c) => c.toLowerCase() === raw.toLowerCase());
      if (!match) {
        return NextResponse.json(
          { error: `Unknown category "${raw}". Add it in Settings first.` },
          { status: 400 },
        );
      }
      category = match;
    }

    try {
      const updated = await patchEntry(kind, body.id, {
        date: body.date as string | undefined,
        amountCents: body.amountCents as number | undefined,
        note: body.note !== undefined ? (cleanNote(body.note) ?? '') : undefined,
        category,
      });
      if (!updated) return NextResponse.json({ error: 'Entry not found.' }, { status: 404 });
      return NextResponse.json({ entry: updated });
    } catch (e) {
      console.error(`[/api/finances/${kind}] patch failed`, e);
      return NextResponse.json({ error: 'Could not save that change.' }, { status: 500 });
    }
  }

  async function DELETE(req: Request) {
    const gate = guardLocal(req);
    if (gate) return gate;
    if (!financeStoreConfigured()) {
      return NextResponse.json({ error: KV_HINT }, { status: 503 });
    }

    let body: { id?: unknown };
    try {
      body = (await req.json()) as { id?: unknown };
    } catch {
      return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
    }
    if (typeof body.id !== 'string' || !body.id) {
      return NextResponse.json({ error: 'id is required.' }, { status: 400 });
    }

    try {
      const found = await deleteEntry(kind, body.id);
      if (!found) return NextResponse.json({ error: 'Entry not found.' }, { status: 404 });
      return NextResponse.json({ ok: true });
    } catch (e) {
      console.error(`[/api/finances/${kind}] delete failed`, e);
      return NextResponse.json({ error: 'Could not delete that entry.' }, { status: 500 });
    }
  }

  return { GET, POST, PATCH, DELETE };
}
