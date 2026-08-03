import { NextResponse } from 'next/server';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { SLUG_RE } from '@/lib/manageSites';
import { getClientContext } from '@/lib/clients';
import { clientDir } from '@/lib/paths';
import {
  loadVercelCredentials,
  loadRetellApiKey,
  loadGithubToken,
  loadMakeApiKey,
  loadTeardownCredentials,
} from '@/lib/opsSecrets';
import { loadTeardownOps, type Outcome } from '@/lib/teardownOps';
import { detachSiteFromAccount, getAccount } from '@/lib/accountStore';
import { deleteClientState } from '@/lib/state';
import { appendAudit } from '@/lib/audit';
import { buildTeardownPlan, readAllEnvLocalVerbatim } from '@/lib/teardownPlan';
import {
  createArchiveRecord,
  writeArchiveRecord,
  writeArchiveFile,
  appendArchiveRunLog,
  readArchiveRecord,
  appendArchiveIndex,
  updateArchiveIndex,
  acquireTeardownLock,
  releaseTeardownLock,
  makeArchiveId,
  makeTimestamp,
  type ArchiveRecord,
  type ArchiveStep,
} from '@/lib/archive';

/**
 * Destroy a client's provisioned infrastructure — the only route in the console that can
 * do this, and the only one whose validation happens BEFORE the stream opens rather than
 * inside it. A hash mismatch or a bad confirmation is a real 409/400, not an NDJSON error
 * line the caller has to parse to notice — these are the safety gates the typed-slug prefix
 * check used to be, and they deserve to fail like gates, not like log lines.
 *
 * Order of destruction (see lib/teardown-ops.js and the module doc for why): capture the
 * archive record first, since clients/{slug} — including site.ts — is deleted last and is
 * unrecoverable after that point. Then revoke access (KV, Clerk), stop traffic (Twilio,
 * Make), destroy compute (Retell, Vercel, GitHub), destroy data (Airtable), and only once
 * everything above has been attempted, remove the local folder — and ONLY if nothing failed.
 * A failed step anywhere in phases 1-7 skips phase 8 entirely, which is what keeps a
 * partial teardown resumable: the client folder still exists, still opens, and the ids
 * needed to finish are still on disk.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  slug?: string;
  previewHash?: string;
  confirmSlug?: string;
  domainConfirm?: string;
  reason?: string;
  resumeId?: string;
}

type StreamEvent =
  | { type: 'start'; slug: string; archiveId: string }
  | { type: 'log'; line: string }
  | { type: 'step'; step: ArchiveStep }
  | { type: 'error'; message: string }
  | { type: 'exit'; code: number; archiveId: string; status: ArchiveRecord['status'] };

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const slug = (body.slug ?? '').trim();
  if (!slug || !SLUG_RE.test(slug)) {
    return NextResponse.json({ error: 'Invalid or missing client slug.' }, { status: 400 });
  }
  if ((body.confirmSlug ?? '') !== slug) {
    return NextResponse.json({ error: 'Typed confirmation did not match the client slug.' }, { status: 400 });
  }

  // ── Rebuild the plan fresh and require the caller's hash to match it ───────
  // This is what mechanically enforces "you saw a preview before arming the button" — a
  // stale preview (a domain attached five minutes ago, say) cannot produce a valid request.
  let plan;
  try {
    plan = await buildTeardownPlan(slug);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not build a teardown plan for this client.' },
      { status: 404 },
    );
  }
  if (!body.previewHash || body.previewHash !== plan.previewHash) {
    return NextResponse.json(
      { error: 'The preview has changed since it was loaded. Refresh it and try again.' },
      { status: 409 },
    );
  }

  // A verified custom domain is a second, harder gate: typing the slug alone doesn't
  // demonstrate you noticed the client has a real domain attached, not just a Vercel alias.
  if (plan.hasVerifiedCustomDomain) {
    const verifiedNames = plan.sites.flatMap((s) => s.vercel.domains.filter((d) => d.verified && !d.redirect && !d.name.endsWith('.vercel.app')).map((d) => d.name));
    if (!body.domainConfirm || !verifiedNames.includes(body.domainConfirm)) {
      return NextResponse.json(
        { error: `Type the attached domain (${verifiedNames.join(', ')}) to confirm — this client has a live custom domain.` },
        { status: 400 },
      );
    }
  }

  try {
    acquireTeardownLock(slug);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Locked.' }, { status: 409 });
  }

  const encoder = new TextEncoder();
  let order = 0;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (ev: StreamEvent) => controller.enqueue(encoder.encode(JSON.stringify(ev) + '\n'));
      let archiveId = '';
      let failed = false;

      const runStep = async (
        record: ArchiveRecord,
        label: string,
        fn: () => Promise<{ resource: string; target: string; outcome: Outcome; httpStatus?: number; message?: string; durationMs: number }>,
      ): Promise<void> => {
        send({ type: 'log', line: `— ${label} —` });
        const result = await fn();
        const archiveStep: ArchiveStep = { order: order++, at: new Date().toISOString(), ...result };
        record.receipt.steps.push(archiveStep);
        writeArchiveRecord(record);
        const glyph = result.outcome === 'deleted' || result.outcome === 'already-gone' ? '✓' : result.outcome === 'skipped' ? '·' : '✗';
        const line = `${glyph} ${label}${result.target && result.target !== '—' ? ` (${result.target})` : ''}${result.message ? ` — ${result.message}` : ''}`;
        send({ type: 'log', line });
        appendArchiveRunLog(archiveId, line);
        send({ type: 'step', step: archiveStep });
        if (result.outcome === 'failed') failed = true;
      };

      try {
        const ctx = await getClientContext(slug);
        if (!ctx) throw new Error(`No client at clients/${slug}.`);

        // ── Phase 0: capture, zero external writes ──────────────────────────
        const resumed = body.resumeId ? readArchiveRecord(body.resumeId) : null;
        const record: ArchiveRecord =
          resumed && resumed.slug === slug
            ? resumed
            : {
                schemaVersion: 1,
                id: makeArchiveId(slug, makeTimestamp()),
                slug,
                brandName: ctx.brandName,
                plan: ctx.plan,
                isEnterprise: ctx.isEnterprise,
                archivedAt: new Date().toISOString(),
                reason: body.reason?.trim() ?? '',
                status: 'in-progress',
                resumable: false,
                previewHash: plan.previewHash,
                identifiers: {
                  portalEmail: plan.portal.email,
                  clerkUserId: plan.portal.clerkUserId,
                  clerkResolvedBy: plan.portal.clerkResolvedBy,
                  airtableBaseId: plan.airtable.baseId,
                  airtableBaseName: plan.airtable.baseName,
                  sites: plan.sites.map((s) => ({
                    siteSlug: s.siteSlug,
                    vercelProjectId: null,
                    vercelProjectName: s.vercel.projectName,
                    githubRepo: s.github.repo,
                    liveUrl: s.vercel.domains[0]?.name ? `https://${s.vercel.domains[0].name}` : null,
                    domains: s.vercel.domains,
                    twilioNumber: s.twilio.number,
                    twilioSid: null,
                    retellAgentId: s.retell.agentId,
                    retellLlmId: s.retell.llmId,
                    makeScenarioId: s.make.scenarioId,
                    makeWebhookUrl: s.make.webhookUrl,
                    airtableSiteTag: null,
                  })),
                },
                intake: {
                  schemaPath: ctx.schemaPath,
                  source: '',
                  parsed: null,
                  envBySite: readAllEnvLocalVerbatim(ctx),
                  agentPrompt: null,
                },
                receipt: { startedAt: new Date().toISOString(), finishedAt: null, steps: [] },
                orphans: plan.leftBehind,
              };
        archiveId = record.id;
        order = record.receipt.steps.length;

        send({ type: 'start', slug, archiveId });
        appendArchiveRunLog(archiveId, `=== Teardown started ${new Date().toISOString()} ===`);

        if (!resumed) {
          const schemaAbs = resolve(clientDir(slug), 'site.ts');
          const siteSource = existsSync(schemaAbs) ? readFileSync(schemaAbs, 'utf8') : '';
          record.intake.source = siteSource;
          const promptPath = resolve(clientDir(slug), 'agent-prompt.txt');
          record.intake.agentPrompt = existsSync(promptPath) ? readFileSync(promptPath, 'utf8') : null;

          createArchiveRecord(record);
          if (siteSource) writeArchiveFile(archiveId, 'site.ts', siteSource);
          if (record.intake.agentPrompt) writeArchiveFile(archiveId, 'agent-prompt.txt', record.intake.agentPrompt);
          writeArchiveFile(
            archiveId,
            'env.local.txt',
            Object.entries(record.intake.envBySite)
              .map(([site, content]) => `# ── ${site} ──\n${content}`)
              .join('\n\n'),
          );
          appendArchiveIndex({ id: archiveId, slug, brandName: record.brandName, plan: record.plan, archivedAt: record.archivedAt, status: 'in-progress' });
        } else {
          send({ type: 'log', line: `Resuming a previous run (${resumed.receipt.steps.length} step(s) already recorded).` });
        }

        const ops = await loadTeardownOps();
        loadVercelCredentials();
        const retellKey = loadRetellApiKey();
        const githubToken = loadGithubToken();
        const makeKey = loadMakeApiKey();
        const { twilioAccountSid, twilioAuthToken, airtableApiKey, clerkSecretKey } = loadTeardownCredentials();

        // ── Phase 1: revoke access ──────────────────────────────────────────
        if (plan.portal.configured && plan.portal.email) {
          // Narrowed to a local const so the closures below get a real `string`, not
          // `string | null` re-read off `plan.portal` — TS narrowing on a property access
          // doesn't survive into a nested closure the way a local variable capture does.
          const portalEmail = plan.portal.email;
          for (const site of plan.sites) {
            await runStep(record, `Detach ${site.siteSlug} from portal account`, async () => {
              const started = Date.now();
              try {
                await detachSiteFromAccount(portalEmail, site.siteSlug);
                return { resource: 'portal.detach', target: site.siteSlug, outcome: 'deleted' as const, durationMs: Date.now() - started };
              } catch (err) {
                return {
                  resource: 'portal.detach',
                  target: site.siteSlug,
                  outcome: 'failed' as const,
                  durationMs: Date.now() - started,
                  message: err instanceof Error ? err.message : String(err),
                };
              }
            });
          }

          // Re-read the account AFTER detaching — never compute "remaining" as
          // "before minus what we tried to detach". A failed read means UNKNOWN, not
          // zero, and the guard must fail toward leaving Clerk access in place.
          let remaining: number | null = null;
          try {
            const account = await getAccount(portalEmail);
            const mySlugs = new Set(plan.sites.map((s) => s.siteSlug));
            remaining = account ? account.sites.filter((s) => !mySlugs.has(s.slug)).length : 0;
          } catch {
            remaining = null;
          }

          if (remaining === 0 && plan.portal.clerkUserId) {
            await runStep(record, 'Delete Clerk user', () =>
              ops.deleteClerkUser({ secretKey: clerkSecretKey ?? undefined, userId: plan.portal.clerkUserId ?? undefined }),
            );
          } else {
            const reason =
              remaining === null
                ? 'Could not confirm the account has no other sites — refusing to guess'
                : `${remaining} other site(s) remain on this account`;
            send({ type: 'log', line: `· Clerk user kept — ${reason}` });
            record.orphans.push({ kind: 'clerk.user', detail: `${plan.portal.clerkUserId ?? 'unresolved'}: ${reason}`, action: remaining === null ? 'Check manually' : undefined });
            writeArchiveRecord(record);
          }
        }

        // ── Phases 2–6: per site — stop traffic, then destroy compute ───────
        for (const site of plan.sites) {
          await runStep(record, `Stop Make scenario (${site.siteSlug})`, () =>
            ops.stopAndDeleteMakeScenario({ apiKey: makeKey ?? undefined, zone: 'https://us2.make.com/api/v2', scenarioId: site.make.scenarioId }),
          );
          await runStep(record, `Release Twilio number (${site.siteSlug})`, () =>
            ops.releaseTwilioNumber({ accountSid: twilioAccountSid ?? undefined, authToken: twilioAuthToken ?? undefined, phoneNumber: site.twilio.number ?? undefined }),
          );
          await runStep(record, `Delete Retell agent (${site.siteSlug})`, () =>
            ops.deleteRetellAgent({ apiKey: retellKey ?? undefined, agentId: site.retell.agentId ?? undefined }),
          );
          await runStep(record, `Delete Retell LLM (${site.siteSlug})`, () =>
            ops.deleteRetellLlm({ apiKey: retellKey ?? undefined, llmId: site.retell.llmId }),
          );
          await runStep(record, `Delete Vercel project (${site.siteSlug})`, () =>
            ops.deleteVercelProject({ token: process.env.VERCEL_TOKEN, teamId: process.env.VERCEL_TEAM_ID, slug: site.siteSlug }),
          );
          await runStep(record, `Delete GitHub repo (${site.siteSlug})`, () =>
            ops.deleteGitHubRepo({ token: githubToken ?? undefined, org: process.env.GITHUB_ORG, repo: site.siteSlug }),
          );
        }

        // ── Phase 7: Airtable — last remote step, skipped entirely if shared ─
        if (plan.airtable.baseId) {
          if (plan.airtable.sharedWith.length > 0) {
            send({ type: 'log', line: `· Airtable base kept — shared with ${plan.airtable.sharedWith.join(', ')}` });
          } else {
            await runStep(record, 'Delete Airtable base', () =>
              ops.deleteAirtableBase({ apiKey: airtableApiKey ?? undefined, baseId: plan.airtable.baseId ?? undefined }),
            );
          }
        }

        // ── Phase 8: local folder — ONLY if nothing above failed ────────────
        // This is the guard that makes a partial teardown resumable: if the folder
        // survives, the ids needed to finish the job are still on disk.
        if (!failed) {
          const dir = clientDir(slug);
          try {
            rmSync(dir, { recursive: true, force: true });
            deleteClientState(slug);
            send({ type: 'log', line: `✓ Removed local folder ${dir}` });
            record.status = 'complete';
          } catch (err) {
            // EBUSY/EPERM from a handle inside repo/.git (dev server watcher, VS Code,
            // a stray git process) is the common case on Windows, not an edge case.
            // Do not retry-loop — surface it and let the archive view offer a retry.
            const message = err instanceof Error ? err.message : String(err);
            send({ type: 'log', line: `✗ Could not remove ${dir}: ${message}` });
            record.receipt.steps.push({
              order: order++, resource: 'local.folder', target: dir, outcome: 'failed',
              message, at: new Date().toISOString(), durationMs: 0,
            });
            record.status = 'partial';
            record.resumable = false; // everything else already succeeded; only the folder remains
          }
        } else {
          send({ type: 'log', line: '· Local folder kept — earlier steps failed; this run is resumable.' });
          record.status = 'partial';
          record.resumable = true;
        }

        record.receipt.finishedAt = new Date().toISOString();
        writeArchiveRecord(record);
        updateArchiveIndex({ id: archiveId, slug, brandName: record.brandName, plan: record.plan, archivedAt: record.archivedAt, status: record.status });
        appendArchiveRunLog(archiveId, `=== Teardown ${record.status} ${record.receipt.finishedAt} ===`);

        appendAudit({
          slug,
          action: record.status === 'complete' ? 'client.teardown' : 'client.teardown.start',
          ok: record.status === 'complete',
          summary: `Teardown ${record.status} for ${record.brandName} — ${record.receipt.steps.filter((s) => s.outcome === 'deleted').length} deleted, ${record.receipt.steps.filter((s) => s.outcome === 'failed').length} failed`,
          detail: { archiveId, status: record.status },
        });

        send({ type: 'exit', code: record.status === 'complete' ? 0 : 1, archiveId, status: record.status });
      } catch (err) {
        send({ type: 'error', message: err instanceof Error ? err.message : 'Unhandled teardown error.' });
        send({ type: 'exit', code: 1, archiveId, status: 'partial' });
      } finally {
        releaseTeardownLock(slug);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' },
  });
}
