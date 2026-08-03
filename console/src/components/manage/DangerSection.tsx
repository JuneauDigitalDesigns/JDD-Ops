'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowsClockwise,
  CheckCircle,
  Circle,
  SpinnerGap,
  Warning,
  X,
  XCircle,
} from '@phosphor-icons/react';
import { useManage } from './ManageContext';
import SectionHeader from './SectionHeader';
import RunLogDrawer from '@/components/RunLogDrawer';
import { useTeardownRun } from '@/lib/useTeardownRun';
import type { TeardownPlan } from '@/lib/teardownPlan';
import type { ArchiveRecord } from '@/lib/archive';

/**
 * Tear down every resource provisioned for this client — the most destructive action in
 * the console, on a route with no auth. The preview, the typed confirmation, and the
 * signed-hash handshake with the API are what stand in for that missing auth; see the API
 * route for the ordering and the guards this UI is presenting.
 *
 * Three states in one component rather than three files: preview → confirm → run. They
 * share the plan and the client identity, and splitting them would mean threading that
 * across a boundary for no real gain.
 */
export default function DangerSection() {
  // Deliberately just `ctx`, not `site` — unlike every other section, teardown acts on
  // ALL of a client's sites at once, not the one selected via ?site=.
  const { ctx } = useManage();
  const router = useRouter();

  const [plan, setPlan] = useState<TeardownPlan | null>(null);
  const [unfinished, setUnfinished] = useState<ArchiveRecord | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [confirming, setConfirming] = useState(false);
  const [confirmSlug, setConfirmSlug] = useState('');
  const [domainConfirm, setDomainConfirm] = useState('');
  const [reason, setReason] = useState('');

  const { state: run, running, start } = useTeardownRun((final) => {
    // On a clean finish, land on the archive record — the client's folder is gone, so
    // staying on this route would 404 the moment anything triggers a server round-trip.
    if (final.archiveId && (final.status === 'complete' || final.exitCode === 0)) {
      router.replace(`/archive/${final.archiveId}`);
    }
  });

  const loadPreview = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/manage/teardown/preview?slug=${encodeURIComponent(ctx.slug)}`, { cache: 'no-store' });
      const body = (await res.json()) as { plan?: TeardownPlan; unfinished?: ArchiveRecord | null; error?: string };
      if (body.error) setLoadError(body.error);
      setPlan(body.plan ?? null);
      setUnfinished(body.unfinished ?? null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load the teardown preview.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.slug]);

  const verifiedDomains = (plan?.sites ?? []).flatMap((s) =>
    s.vercel.domains.filter((d) => d.verified && !d.redirect && !d.name.endsWith('.vercel.app')).map((d) => d.name),
  );
  const needsDomainConfirm = verifiedDomains.length > 0;
  const canArm =
    !!plan &&
    confirmSlug === ctx.slug &&
    (!needsDomainConfirm || verifiedDomains.includes(domainConfirm.trim()));

  async function runTeardown() {
    if (!plan) return;
    setConfirming(false);
    await start({
      slug: ctx.slug,
      previewHash: plan.previewHash,
      confirmSlug,
      domainConfirm: needsDomainConfirm ? domainConfirm.trim() : undefined,
      reason: reason.trim(),
      resumeId: unfinished?.id,
    });
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[900px] px-8 py-8 lg:px-10">
        <SectionHeader title="Danger" lede="Tear down every resource provisioned for this client." />
        <p className="text-xs text-fg3">Verifying what actually exists…</p>
      </div>
    );
  }

  if (loadError || !plan) {
    return (
      <div className="mx-auto w-full max-w-[900px] px-8 py-8 lg:px-10">
        <SectionHeader title="Danger" lede="Tear down every resource provisioned for this client." />
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--danger)' }}>
          <Warning size={14} /> {loadError ?? 'Could not build a preview for this client.'}
        </div>
      </div>
    );
  }

  // ── Mid-run or just finished ────────────────────────────────────────────
  if (running || run.exitCode !== null) {
    return (
      <div className="mx-auto w-full max-w-[900px] px-8 py-8 lg:px-10">
        <SectionHeader title={running ? 'Tearing down…' : 'Teardown finished'} lede={plan.brandName} />
        {run.error && (
          <div className="mb-4 flex items-center gap-2 text-xs" style={{ color: 'var(--danger)' }}>
            <Warning size={14} /> {run.error}
          </div>
        )}
        <section className="panel mb-4 flex flex-col p-5">
          {run.steps.length === 0 && running && (
            <p className="flex items-center gap-2 text-xs text-fg3">
              <SpinnerGap size={13} className="animate-spin" /> Starting…
            </p>
          )}
          {run.steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2 border-b border-rule py-2 text-xs last:border-b-0">
              {s.outcome === 'deleted' || s.outcome === 'already-gone' ? (
                <CheckCircle size={14} weight="fill" style={{ color: 'var(--ok)' }} />
              ) : s.outcome === 'skipped' ? (
                <Circle size={14} style={{ color: 'var(--fg-3)' }} />
              ) : (
                <XCircle size={14} weight="fill" style={{ color: 'var(--danger)' }} />
              )}
              <span className="min-w-0 flex-1 truncate text-fg2">
                {s.resource}
                {s.target && s.target !== '—' ? ` — ${s.target}` : ''}
              </span>
              <span className="mono shrink-0 text-2xs text-fg3">{s.outcome}</span>
            </div>
          ))}
          {running && <SpinnerGap size={13} className="mt-2 animate-spin self-center text-fg3" />}
        </section>
        <RunLogDrawer lines={run.lines} running={running} slug={ctx.slug} defaultOpen={!running && run.exitCode !== 0} />
        {!running && run.status === 'partial' && (
          <div className="mt-4 flex items-center gap-2 text-xs" style={{ color: 'var(--warn)' }}>
            <Warning size={14} weight="fill" />
            Some steps failed — the local folder was kept so this can be resumed. Reopen this
            section to try again.
          </div>
        )}
      </div>
    );
  }

  // ── Preview ─────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-[900px] px-8 py-8 lg:px-10">
      <SectionHeader
        title="Danger"
        lede={`Tear down every resource provisioned for ${plan.brandName}.`}
        actions={
          <button type="button" onClick={() => void loadPreview()} className="btn btn-sm">
            <ArrowsClockwise size={13} /> Refresh preview
          </button>
        }
      />

      {unfinished && (
        <div
          className="mb-4 flex items-center gap-2 rounded-[10px] border px-3 py-2 text-xs"
          style={{ borderColor: 'var(--warn)', background: 'var(--warn-glow)', color: 'var(--fg-2)' }}
        >
          <Warning size={14} weight="fill" style={{ color: 'var(--warn)' }} />
          A previous teardown left this client {unfinished.status}. Running again will resume
          from where it stopped — already-deleted resources report as such and are skipped, not
          re-attempted.
        </div>
      )}

      {plan.warnings.length > 0 && (
        <div className="mb-4 flex flex-col gap-1">
          {plan.warnings.map((w) => (
            <span key={w} className="flex items-center gap-2 text-xs" style={{ color: 'var(--warn)' }}>
              <Warning size={12} /> {w}
            </span>
          ))}
        </div>
      )}

      {/* ── Will be destroyed ─────────────────────────────────────────────── */}
      <section className="panel mb-4 flex flex-col gap-3 p-5">
        <h2 className="font-display text-lg font-semibold tracking-tightish text-fg">Will be destroyed</h2>
        {plan.sites.map((s) => (
          <div key={s.siteSlug} className="flex flex-col gap-1 border-b border-rule pb-3 last:border-b-0">
            <span className="kicker">{s.siteSlug}</span>
            <ResourceRow label="GitHub repo" name={s.github.repo} exists={s.github.exists} />
            <ResourceRow
              label="Vercel project"
              name={s.vercel.projectName}
              exists={s.vercel.exists}
              detail={s.vercel.domains.length ? `domains: ${s.vercel.domains.map((d) => d.name).join(', ')}` : undefined}
            />
            <ResourceRow label="Twilio number" name={s.twilio.number ?? '—'} exists={s.twilio.owned} />
            <ResourceRow label="Retell agent" name={s.retell.agentId ?? '—'} exists={s.retell.agentExists} />
            <ResourceRow label="Retell LLM" name={s.retell.llmId ?? '—'} exists={s.retell.llmId ? true : null} />
            <ResourceRow
              label="Make scenario"
              name={s.make.scenarioId ?? 'not resolved'}
              exists={s.make.scenarioId ? true : null}
            />
          </div>
        ))}
        {plan.airtable.baseId && (
          <div className="flex flex-col gap-1">
            <span className="kicker">Airtable (shared across sites)</span>
            {plan.airtable.sharedWith.length > 0 ? (
              <span className="flex items-center gap-2 text-xs" style={{ color: 'var(--warn)' }}>
                <Warning size={12} /> {plan.airtable.baseId} kept — also used by {plan.airtable.sharedWith.join(', ')}
              </span>
            ) : (
              <ResourceRow label="Base" name={plan.airtable.baseName ? `${plan.airtable.baseName} (${plan.airtable.baseId})` : plan.airtable.baseId} exists={plan.airtable.exists} />
            )}
          </div>
        )}
        {plan.portal.configured && plan.portal.email && (
          <div className="flex flex-col gap-1">
            <span className="kicker">Portal</span>
            <span className="text-xs text-fg2">Detach from {plan.portal.email}</span>
            {plan.portal.clerkUserId && (
              <span className="text-xs text-fg2">
                Clerk login {plan.portal.remainingSitesOnAccount === 0 ? 'deleted (last site on the account)' : 'kept — other sites remain on this account'}
              </span>
            )}
          </div>
        )}
        <div className="flex flex-col gap-1">
          <span className="kicker">Local</span>
          <span className="text-xs text-fg2">
            clients/{ctx.slug} {plan.localFolder.approxBytes != null && `(${formatBytes(plan.localFolder.approxBytes)})`}
          </span>
        </div>
      </section>

      {/* ── Will be left behind ───────────────────────────────────────────── */}
      {plan.leftBehind.length > 0 && (
        <section className="panel mb-4 flex flex-col gap-2 p-5">
          <h2 className="font-display text-lg font-semibold tracking-tightish text-fg">Will be left behind</h2>
          {plan.leftBehind.map((o, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <Circle size={6} weight="fill" className="mt-1.5 shrink-0 text-fg3" />
              <span className="text-fg2">
                {o.detail}
                {o.action && <span className="text-fg3"> — {o.action}</span>}
              </span>
            </div>
          ))}
        </section>
      )}

      <button type="button" onClick={() => setConfirming(true)} className="btn">
        <Warning size={13} weight="fill" style={{ color: 'var(--danger)' }} />
        Tear down {plan.brandName}
      </button>

      {/* ── Confirm modal ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {confirming && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center p-6"
            style={{ background: 'rgba(4,8,18,0.86)', backdropFilter: 'blur(8px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConfirming(false)}
            onKeyDown={(e) => e.key === 'Escape' && setConfirming(false)}
          >
            <motion.div
              className="panel w-full max-w-[560px] p-6"
              initial={{ scale: 0.96, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-lg font-medium">Tear down {plan.brandName}?</h3>
                <button type="button" onClick={() => setConfirming(false)} className="text-fg3 hover:text-fg">
                  <X size={18} />
                </button>
              </div>
              <p className="mb-4 text-xs leading-[1.6] text-fg2">
                This destroys every resource above against live APIs. The GitHub repo, Vercel
                project, Twilio number, and Retell agent/LLM for {plan.sites.length} site
                {plan.sites.length === 1 ? '' : 's'}
                {plan.airtable.baseId && !plan.airtable.sharedWith.length && ', the Airtable base and its Call Log'}. Not
                auto-reversible — a snapshot is archived first, but the Twilio number and
                Airtable base cannot be re-acquired.
              </p>

              <label className="mb-3 block">
                <span className="field-label">
                  Type <code className="codechip">{ctx.slug}</code> to confirm
                </span>
                <input
                  type="text"
                  value={confirmSlug}
                  onChange={(e) => setConfirmSlug(e.target.value)}
                  spellCheck={false}
                  autoFocus
                />
              </label>

              {needsDomainConfirm && (
                <label className="mb-3 block">
                  <span className="field-label">
                    This client has a live custom domain. Type it to confirm:{' '}
                    <code className="codechip">{verifiedDomains.join(', ')}</code>
                  </span>
                  <input type="text" value={domainConfirm} onChange={(e) => setDomainConfirm(e.target.value)} spellCheck={false} />
                </label>
              )}

              <label className="mb-4 block">
                <span className="field-label">Reason (optional, kept in the archive record)</span>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
              </label>

              <div className="flex justify-end gap-2">
                <button type="button" className="btn btn-sm" onClick={() => setConfirming(false)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-danger btn-sm" disabled={!canArm} onClick={() => void runTeardown()}>
                  <Warning size={13} weight="fill" />
                  Yes, tear down {ctx.slug}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ResourceRow({
  label, name, exists, detail,
}: {
  label: string;
  name: string;
  exists: boolean | null;
  /** A secondary line — e.g. the domains attached to a Vercel project. */
  detail?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-2 text-xs">
        {exists === true ? (
          <CheckCircle size={12} weight="fill" style={{ color: 'var(--ok)' }} />
        ) : exists === false ? (
          <Circle size={12} style={{ color: 'var(--fg-3)' }} />
        ) : (
          <Warning size={12} style={{ color: 'var(--fg-3)' }} />
        )}
        <span className="w-[120px] shrink-0 text-fg3">{label}</span>
        <span className="min-w-0 flex-1 truncate text-fg2" title={name}>
          {exists === false ? <span className="text-fg3">not found</span> : name}
        </span>
      </div>
      {detail && <span className="meta pl-5 text-fg3">{detail}</span>}
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
