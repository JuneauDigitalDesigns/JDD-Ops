import Link from 'next/link';
import { notFound } from 'next/navigation';
import { readArchiveRecord, type ArchiveStatus, type StepOutcome } from '@/lib/archive';
import { isSecretKey, maskSecret } from '@/lib/envFields';
import { PLAN_LABEL } from '@/lib/runbook-content';
import PageHeader from '@/components/shell/PageHeader';

/**
 * One archive record — everything captured before a teardown destroyed it, plus the
 * receipt of what happened. Read-only, server-rendered straight from record.json; there's
 * no live state to reconcile since a finished record never changes.
 *
 * Secrets in the captured .env.local text are masked here with the same isSecretKey /
 * maskSecret pair Environment uses — the archive is gitignored like clients/ itself, but a
 * record that gets read months later by someone who forgot it holds live-looking API keys
 * is a worse failure mode than the client folder ever was.
 */
export const dynamic = 'force-dynamic';

const STATUS_COLOR: Record<ArchiveStatus, string> = {
  complete: 'var(--ok)',
  partial: 'var(--warn)',
  'in-progress': 'var(--fg-3)',
};

const OUTCOME_COLOR: Record<StepOutcome, string> = {
  deleted: 'var(--ok)',
  'already-gone': 'var(--ok)',
  skipped: 'var(--fg-3)',
  failed: 'var(--danger)',
};

/** Mask any line whose key looks like a secret, leaving the rest of the file readable. */
function maskEnvText(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
      if (!m) return line;
      const [, key, value] = m;
      if (!value || !isSecretKey(key)) return line;
      return `${key}=${maskSecret(value)}`;
    })
    .join('\n');
}

export default function ArchiveRecordPage({ params }: { params: { id: string } }) {
  const record = readArchiveRecord(params.id);
  if (!record) notFound();

  const { identifiers, intake, receipt, orphans } = record;

  return (
    <div className="mx-auto w-full max-w-[900px] px-6 py-8 md:px-8">
      <PageHeader
        title={record.brandName}
        lede={`${record.slug} — torn down ${new Date(record.archivedAt).toLocaleString()}`}
        actions={
          <Link href="/archive" className="btn btn-sm">
            All archived clients
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="h-[8px] w-[8px] rounded-full" style={{ background: STATUS_COLOR[record.status] }} />
          <span className="text-fg2">{record.status}</span>
        </span>
        <span className="meta">{PLAN_LABEL[record.plan]}</span>
        {record.isEnterprise && <span className="meta">enterprise</span>}
        <span className="meta">{identifiers.sites.length} site{identifiers.sites.length === 1 ? '' : 's'}</span>
      </div>

      {record.status === 'partial' && (
        <div
          className="mb-4 flex items-center gap-2 rounded-[10px] border px-3 py-2 text-xs"
          style={{ borderColor: 'var(--warn)', background: 'var(--warn-glow)', color: 'var(--fg-2)' }}
        >
          Some steps failed and the local folder was kept — this teardown is resumable. Reopening{' '}
          <code className="codechip">/c/{record.slug}/manage/danger</code> will offer to continue.
        </div>
      )}

      {record.reason && (
        <section className="panel mb-4 p-5">
          <h2 className="kicker mb-1">Reason</h2>
          <p className="text-xs text-fg2">{record.reason}</p>
        </section>
      )}

      {/* ── Identifiers, as they were ─────────────────────────────────────── */}
      <section className="panel mb-4 flex flex-col gap-3 p-5">
        <h2 className="font-display text-lg font-semibold tracking-tightish text-fg">Identifiers</h2>
        {identifiers.sites.map((s) => (
          <div key={s.siteSlug} className="flex flex-col gap-1 border-b border-rule pb-3 text-xs last:border-b-0">
            <span className="kicker">{s.siteSlug}</span>
            <IdRow label="GitHub repo" value={s.githubRepo} />
            <IdRow label="Vercel project" value={s.vercelProjectName ?? s.vercelProjectId} />
            <IdRow label="Live URL" value={s.liveUrl} />
            {s.domains.length > 0 && (
              <IdRow label="Domains" value={s.domains.map((d) => d.name).join(', ')} />
            )}
            <IdRow label="Twilio number" value={s.twilioNumber} />
            <IdRow label="Retell agent" value={s.retellAgentId} />
            <IdRow label="Retell LLM" value={s.retellLlmId} />
            <IdRow label="Make scenario" value={s.makeScenarioId} />
          </div>
        ))}
        <div className="flex flex-col gap-1 text-xs">
          <span className="kicker">Shared</span>
          <IdRow label="Airtable base" value={identifiers.airtableBaseName ? `${identifiers.airtableBaseName} (${identifiers.airtableBaseId})` : identifiers.airtableBaseId} />
          <IdRow label="Portal account" value={identifiers.portalEmail} />
          <IdRow label="Clerk user" value={identifiers.clerkUserId} />
        </div>
      </section>

      {/* ── Receipt ────────────────────────────────────────────────────────── */}
      <section className="panel mb-4 flex flex-col p-5">
        <h2 className="font-display text-lg font-semibold tracking-tightish text-fg mb-2">
          Destruction receipt
        </h2>
        {receipt.steps.length === 0 ? (
          <p className="text-xs text-fg3">No steps recorded.</p>
        ) : (
          receipt.steps.map((s) => (
            <div key={s.order} className="flex items-center gap-2 border-b border-rule py-2 text-xs last:border-b-0">
              <span className="h-[8px] w-[8px] shrink-0 rounded-full" style={{ background: OUTCOME_COLOR[s.outcome] }} />
              <span className="min-w-0 flex-1 truncate text-fg2">
                {s.resource}
                {s.target && s.target !== '—' ? ` — ${s.target}` : ''}
              </span>
              <span className="mono shrink-0 text-2xs text-fg3">{s.outcome}</span>
            </div>
          ))
        )}
        {receipt.finishedAt && (
          <p className="meta mt-2">
            Started {new Date(receipt.startedAt).toLocaleString()}, finished{' '}
            {new Date(receipt.finishedAt).toLocaleString()}.
          </p>
        )}
      </section>

      {/* ── Orphans ────────────────────────────────────────────────────────── */}
      {orphans.length > 0 && (
        <section className="panel mb-4 flex flex-col gap-2 p-5">
          <h2 className="font-display text-lg font-semibold tracking-tightish text-fg">Left behind</h2>
          {orphans.map((o, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className="mt-1.5 h-[6px] w-[6px] shrink-0 rounded-full" style={{ background: 'var(--fg-3)' }} />
              <span className="text-fg2">
                <span className="font-medium">{o.kind}</span> — {o.detail}
                {o.action && <span className="text-fg3"> — {o.action}</span>}
              </span>
            </div>
          ))}
        </section>
      )}

      {/* ── Intake snapshot ────────────────────────────────────────────────── */}
      <details className="panel mb-4 p-5">
        <summary className="cursor-pointer font-display text-lg font-semibold tracking-tightish text-fg">
          Intake snapshot (site.ts)
        </summary>
        <pre className="mono mt-3 max-h-[480px] overflow-auto whitespace-pre-wrap text-2xs text-fg2">
          {intake.source}
        </pre>
      </details>

      {Object.keys(intake.envBySite).length > 0 && (
        <details className="panel mb-4 p-5">
          <summary className="cursor-pointer font-display text-lg font-semibold tracking-tightish text-fg">
            Environment, at capture (secrets masked)
          </summary>
          {Object.entries(intake.envBySite).map(([siteSlug, text]) => (
            <div key={siteSlug} className="mt-3">
              <span className="kicker">{siteSlug}</span>
              <pre className="mono mt-1 max-h-[320px] overflow-auto whitespace-pre-wrap text-2xs text-fg2">
                {maskEnvText(text)}
              </pre>
            </div>
          ))}
        </details>
      )}

      {intake.agentPrompt && (
        <details className="panel p-5">
          <summary className="cursor-pointer font-display text-lg font-semibold tracking-tightish text-fg">
            Voice agent prompt
          </summary>
          <pre className="mono mt-3 max-h-[480px] overflow-auto whitespace-pre-wrap text-2xs text-fg2">
            {intake.agentPrompt}
          </pre>
        </details>
      )}
    </div>
  );
}

function IdRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[120px] shrink-0 text-fg3">{label}</span>
      <span className="min-w-0 flex-1 truncate text-fg2">{value ?? <span className="text-fg3">—</span>}</span>
    </div>
  );
}
