import 'server-only';
import { loadTeardownCredentials } from './opsSecrets';

/**
 * The client's Airtable Call Log, read by the console.
 *
 * The portal has shown clients their own calls for months; the console has never shown
 * them to you. So the one question you are most often asked — "have my calls been coming
 * through?" — was answerable by the client and not by the operator.
 *
 * Field names mirror the agency site's `app/lib/airtable-calls.ts` exactly. They are the
 * column names onboard.js creates on the base, so a rename on either side breaks both;
 * keeping them identical means a mismatch shows up as an empty column in two places rather
 * than as two apps quietly disagreeing about what a call is.
 *
 * Read-only. The console never writes to a client's call log — that base is the client's
 * record of their own business, and the post-call automation is its only writer.
 */

const TABLE = 'Call Log';

export interface CallRow {
  id: string;
  date: string | null;
  callerName: string | null;
  callerNumber: string | null;
  summary: string | null;
  durationSeconds: number | null;
  callType: string | null;
  outcome: string | null;
  /** Enterprise only — which site of a shared base this call belongs to. */
  site: string | null;
}

export type CallLogResult =
  | { ok: true; calls: CallRow[]; total: number }
  | { ok: false; reason: string };

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);

/**
 * Recent calls for one base, newest first.
 *
 * `siteTag` filters a SHARED enterprise base down to one site. Without it an enterprise
 * client's three sites would each show all three sites' calls — the same failure the
 * missing-Site-column finding warns about, just on the read side.
 */
export async function fetchCallLog({
  baseId,
  siteTag,
  limit = 25,
}: {
  baseId: string | null | undefined;
  siteTag?: string | null;
  limit?: number;
}): Promise<CallLogResult> {
  if (!baseId) return { ok: false, reason: 'No AIRTABLE_BASE_ID for this site.' };

  const { airtableApiKey } = loadTeardownCredentials();
  if (!airtableApiKey) return { ok: false, reason: 'No AIRTABLE_API_KEY in jdd-ops/.env.' };

  const params = new URLSearchParams({ pageSize: String(Math.min(limit, 100)) });
  params.append('sort[0][field]', 'Date');
  params.append('sort[0][direction]', 'desc');
  if (siteTag) {
    // Airtable formula quoting: a stray quote in a site tag would otherwise produce a
    // syntactically broken formula and a confusing 422.
    params.set('filterByFormula', `{Site}='${siteTag.replace(/'/g, "\\'")}'`);
  }

  try {
    const res = await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(TABLE)}?${params}`, {
      headers: { Authorization: `Bearer ${airtableApiKey}` },
      cache: 'no-store',
    });

    if (res.status === 404) {
      return { ok: false, reason: `Base ${baseId} has no "${TABLE}" table.` };
    }
    if (!res.ok) {
      return { ok: false, reason: `Airtable returned ${res.status}.` };
    }

    const body = (await res.json()) as { records?: AirtableRecord[] };
    const calls = (body.records ?? []).map((r) => ({
      id: r.id,
      date: str(r.fields['Date']),
      callerName: str(r.fields['Caller name']),
      callerNumber: str(r.fields['Caller number']),
      summary: str(r.fields['Summary']),
      durationSeconds: num(r.fields['Duration (seconds)']),
      callType: str(r.fields['Call type']),
      outcome: str(r.fields['Outcome']),
      site: str(r.fields['Site']),
    }));

    return { ok: true, calls, total: calls.length };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}
