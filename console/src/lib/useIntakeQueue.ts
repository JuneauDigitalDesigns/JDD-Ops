'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Plan } from './types';

export type IntakeSummary = {
  id: string;
  brandName: string;
  plan: Plan;
  slugGuess: string;
  receivedAt: number;
  missingFieldsCount: number;
};

/**
 * The KV signup queue — how real clients actually reach the console.
 *
 * Lifted out of the old <IntakeStrip> so the client index can render pending signups as
 * cards inside the main grid rather than as a separate band above it. The strip made a
 * signup look like a notification about the roster; it is a member of the roster, just one
 * that hasn't been claimed yet.
 *
 * Importing WRITES clients/<slug>/site.ts, which is the thing that makes a client selectable
 * at all — before that there is no folder for any tool to open. So import is the moment a
 * queue item stops being a message and becomes a client.
 */
export function useIntakeQueue() {
  const [intakes, setIntakes] = useState<IntakeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/intake/inbox', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      setIntakes(data.intakes ?? []);
      setError(null);
    } catch {
      setError('Could not read the intake queue.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /**
   * Claim a queue item and write its client folder.
   *
   * The full payload is read BEFORE the import call on purpose: importing claims the item,
   * after which it can no longer be fetched. Doing it in the other order loses the data on
   * any failure downstream of the claim.
   *
   * Returns null on success, or a message to show. `needsOverwrite` is surfaced as a normal
   * message rather than an exception because it is a routine answer — the slug is taken —
   * and the caller just needs to let the operator tick the box or pick another slug.
   */
  const importIntake = useCallback(
    async (id: string, slug: string, overwrite: boolean): Promise<string | null> => {
      try {
        const fullRes = await fetch(`/api/intake/${id}`, { cache: 'no-store' });
        const full = await fullRes.json();
        if (!fullRes.ok) return full.error ?? 'Could not read intake.';

        const res = await fetch('/api/intake/import', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id, slug, overwrite }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (data.needsOverwrite) {
            return `clients/${slug}/site.ts already exists — tick overwrite or pick another slug.`;
          }
          return data.error ?? 'Import failed.';
        }

        // Drop it locally rather than refetching: the item is claimed, so the next inbox read
        // won't return it anyway, and this makes the card convert without a round trip.
        setIntakes((prev) => prev.filter((i) => i.id !== id));
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : 'Import failed.';
      }
    },
    [],
  );

  return { intakes, loading, error, refresh, importIntake };
}
