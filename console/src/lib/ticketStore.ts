import 'server-only';
import { Redis } from '@upstash/redis';
import { loadKvCredentials } from './opsSecrets';
import {
  TICKET_INDEX,
  ticketKey,
  applyTicketStatus,
  appendTicketMessage,
  appendTicketActivity,
  type Ticket,
  type TicketStatus,
} from '@jdd/schema';

/**
 * Ticket queue (console / operator side).
 *
 * The agency site's portal writes support tickets into KV (`jdd:ticket:item:{id}` +
 * `jdd:ticket:index`) scoped to one account + site; this console reads the whole queue and
 * renders it at /tickets, and is the only side that may set any status or delete.
 *
 * The canonical shape and the pure read-modify-write ops live in `@jdd/schema` (client-safe);
 * this file is the server-only I/O half, mirroring leadQueue.ts. There is deliberately no TTL.
 */

export {
  TICKET_STATUSES,
  TICKET_CATEGORIES,
  TICKET_INDEX,
  ticketKey,
} from '@jdd/schema';
export type {
  Ticket,
  TicketStatus,
  TicketCategory,
  TicketActivity,
  TicketMessage,
} from '@jdd/schema';

let _redis: Redis | null = null;

/** True when KV creds are present; lets routes degrade gracefully instead of throwing. */
export function ticketQueueConfigured(): boolean {
  loadKvCredentials();
  return Boolean(
    (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) &&
      (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN),
  );
}

function getRedis(): Redis {
  loadKvCredentials();
  if (!_redis) {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      throw new Error(
        'Ticket queue not configured — set KV_REST_API_URL and KV_REST_API_TOKEN in jdd-ops/.env ' +
          '(the same pair the lead/intake queues use).',
      );
    }
    _redis = new Redis({ url, token });
  }
  return _redis;
}

/**
 * Newest-first list of tickets.
 *
 * Prunes index entries whose item is gone rather than returning holes — the same self-healing
 * read as listLeads — and guards the two append-only arrays so a pre-array record can't crash
 * the board/modal render.
 */
export async function listTickets(): Promise<Ticket[]> {
  const redis = getRedis();
  const ids = await redis.zrange<string[]>(TICKET_INDEX, 0, -1, { rev: true });
  if (!ids.length) return [];
  const items = await Promise.all(ids.map((id) => redis.get<Ticket>(ticketKey(id))));

  const out: Ticket[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) {
      await redis.zrem(TICKET_INDEX, ids[i]).catch(() => {});
      continue;
    }
    out.push({
      ...item,
      activity: Array.isArray(item.activity) ? item.activity : [],
      messages: Array.isArray(item.messages) ? item.messages : [],
    });
  }
  return out;
}

export async function getTicket(id: string): Promise<Ticket | null> {
  return getRedis().get<Ticket>(ticketKey(id));
}

/** Write a ticket and index it at its createdAt score. Idempotent re-index on update. */
export async function saveTicket(ticket: Ticket): Promise<void> {
  const redis = getRedis();
  await redis.set(ticketKey(ticket.id), ticket);
  await redis.zadd(TICKET_INDEX, { score: ticket.createdAt, member: ticket.id });
}

export interface TicketPatch {
  status?: TicketStatus;
  order?: number;
  /** Appended to the thread. The operator route sets author:'operator'. */
  message?: { author: 'client' | 'operator'; text: string };
  /** Extra audit entries beyond the one applyTicketStatus already stamps. */
  activity?: { kind: string; text: string } | { kind: string; text: string }[];
}

/**
 * Merge an update for one ticket and persist via the shared pure ops. Returns the new record,
 * or null if it's gone. Read-modify-write with no locking — fine for a single-operator console.
 */
export async function patchTicket(id: string, patch: TicketPatch): Promise<Ticket | null> {
  const redis = getRedis();
  const prev = await redis.get<Ticket>(ticketKey(id));
  if (!prev) return null;

  const now = Date.now();
  let next: Ticket = {
    ...prev,
    activity: Array.isArray(prev.activity) ? prev.activity : [],
    messages: Array.isArray(prev.messages) ? prev.messages : [],
  };

  if (patch.status !== undefined) next = applyTicketStatus(next, patch.status, now);
  if (patch.message) next = appendTicketMessage(next, patch.message, now);
  if (patch.activity) next = appendTicketActivity(next, patch.activity, now);
  if (patch.order !== undefined) next = { ...next, order: patch.order, updatedAt: now };

  await redis.set(ticketKey(id), next);
  return next;
}

/** Hard-delete one ticket: removes the item key and the index entry. Returns false if not found. */
export async function deleteTicket(id: string): Promise<boolean> {
  const redis = getRedis();
  const count = await redis.del(ticketKey(id));
  if (count > 0) await redis.zrem(TICKET_INDEX, id).catch(() => {});
  return count > 0;
}
