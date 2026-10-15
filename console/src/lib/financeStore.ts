import 'server-only';
import { Redis } from '@upstash/redis';
import type { LedgerEntry, LedgerKind } from './financeTypes';

/**
 * KV I/O for the three finance ledgers: expenses, owner's draws, and tax-reserve transfers.
 *
 * Same storage shape as leadQueue.ts — a per-item key plus a sorted-set index — and the same
 * self-healing read that prunes a dangling index member rather than returning a hole. Deliberate:
 * a second storage idiom in one small console would be a second thing to learn and a second thing
 * to get wrong.
 *
 * One generic implementation serves all three ledgers because they are structurally identical.
 * They are kept in SEPARATE KEYSPACES rather than one ledger with a `kind` column precisely
 * because they must never be summed together by accident — only expenses reduce taxable profit
 * (see financeTypes.ts). A type column would make "forgot to filter" a one-line mistake that
 * silently understates tax owed; separate keyspaces make it impossible to make by accident.
 *
 * The index is scored by the ENTRY's date, not by when it was typed, so a backdated expense sorts
 * into the month it belongs to rather than the month you remembered it.
 */

let _redis: Redis | null = null;

/** True when KV creds are present; lets routes degrade gracefully instead of throwing. */
export function financeStoreConfigured(): boolean {
  return Boolean(
    (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) &&
      (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN),
  );
}

function getRedis(): Redis {
  if (!_redis) {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      throw new Error(
        'Finance store not configured — set KV_REST_API_URL and KV_REST_API_TOKEN in ' +
          'console/.env.local (the same pair the lead and intake queues use).',
      );
    }
    _redis = new Redis({ url, token });
  }
  return _redis;
}

const itemKey = (kind: LedgerKind, id: string) => `jdd:${kind}:item:${id}`;
const indexKey = (kind: LedgerKind) => `jdd:${kind}:index`;

/** Epoch ms for an ISO date, used as the sorted-set score. Invalid dates sort to 0. */
function dateScore(iso: string): number {
  const t = Date.parse(`${iso}T00:00:00Z`);
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Every entry in one ledger, newest first.
 *
 * Reads the whole ledger rather than paginating: a sole proprietor logging a handful of expenses
 * a month produces a few hundred rows a year, and the page needs the full year anyway to total
 * the months and drive the chart. Pagination here would cost complexity and buy nothing.
 */
export async function listEntries(kind: LedgerKind): Promise<LedgerEntry[]> {
  const redis = getRedis();
  const ids = await redis.zrange<string[]>(indexKey(kind), 0, -1, { rev: true });
  if (!ids.length) return [];

  const items = await Promise.all(ids.map((id) => redis.get<LedgerEntry>(itemKey(kind, id))));

  const out: LedgerEntry[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) {
      // Self-heal: an index member whose item is gone would otherwise cost a lookup on every
      // single page load, forever.
      await redis.zrem(indexKey(kind), ids[i]).catch(() => {});
      continue;
    }
    out.push(item);
  }
  return out;
}

export async function getEntry(kind: LedgerKind, id: string): Promise<LedgerEntry | null> {
  return getRedis().get<LedgerEntry>(itemKey(kind, id));
}

export async function createEntry(kind: LedgerKind, entry: LedgerEntry): Promise<LedgerEntry> {
  const redis = getRedis();
  await redis.set(itemKey(kind, entry.id), entry);
  await redis.zadd(indexKey(kind), { score: dateScore(entry.date), member: entry.id });
  return entry;
}

export interface EntryPatch {
  date?: string;
  amountCents?: number;
  note?: string;
  category?: string;
}

/**
 * Merge an edit into one entry. Returns the new record, or null if it's gone.
 *
 * Read-modify-write with no locking, like patchLead — correct for a single-operator local console
 * and would not be if this were ever multi-user.
 *
 * Changing the date rewrites the index score, which is what lets a mis-dated expense move into
 * the right month instead of being stranded in the one it was typed in.
 */
export async function patchEntry(
  kind: LedgerKind,
  id: string,
  patch: EntryPatch,
): Promise<LedgerEntry | null> {
  const redis = getRedis();
  const prev = await redis.get<LedgerEntry>(itemKey(kind, id));
  if (!prev) return null;

  const next: LedgerEntry = { ...prev };
  if (patch.date !== undefined) next.date = patch.date;
  if (patch.amountCents !== undefined) next.amountCents = patch.amountCents;
  if (patch.note !== undefined) next.note = patch.note;
  if (patch.category !== undefined) next.category = patch.category;

  await redis.set(itemKey(kind, id), next);
  if (patch.date !== undefined && patch.date !== prev.date) {
    await redis.zadd(indexKey(kind), { score: dateScore(next.date), member: id });
  }
  return next;
}

/** Hard-delete one entry: removes the item key and its index member. False if it wasn't there. */
export async function deleteEntry(kind: LedgerKind, id: string): Promise<boolean> {
  const redis = getRedis();
  const count = await redis.del(itemKey(kind, id));
  if (count > 0) await redis.zrem(indexKey(kind), id).catch(() => {});
  return count > 0;
}

/**
 * Copy one month's expenses into another — the "copy last month" button.
 *
 * Recurring costs are the same handful of subscriptions every month, so this is the difference
 * between re-typing them and adjusting the one that changed. It writes fresh ids and fresh
 * createdAt stamps: these are new records of new months' spending, not references to old ones.
 *
 * The day-of-month is preserved where the target month is long enough and clamped to the last day
 * where it isn't, so a subscription billed on the 31st lands on the 30th in April rather than
 * silently rolling into May and landing in the wrong tax month.
 *
 * Returns the created entries so the caller can report how many landed. Callers are expected to
 * confirm with the operator first — it is not idempotent, and running it twice really does mean
 * two copies, which is the honest behaviour for a ledger.
 */
export async function copyExpensesBetweenMonths(
  fromMonth: string,
  toMonth: string,
): Promise<LedgerEntry[]> {
  const source = (await listEntries('expense')).filter((e) => e.date.startsWith(fromMonth));
  if (!source.length) return [];

  const [y, m] = toMonth.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const now = new Date().toISOString();

  const created: LedgerEntry[] = [];
  for (const e of source) {
    const day = Math.min(Number(e.date.slice(8, 10)) || 1, lastDay);
    created.push(
      await createEntry('expense', {
        id: crypto.randomUUID(),
        date: `${toMonth}-${String(day).padStart(2, '0')}`,
        amountCents: e.amountCents,
        category: e.category,
        note: e.note,
        createdAt: now,
      }),
    );
  }
  return created;
}
