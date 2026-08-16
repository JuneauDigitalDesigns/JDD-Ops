import 'server-only';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { sortFindings, type Finding, type ReconcileResult } from '@jdd/schema';
import type { ClientContext, SiteInfo } from './types';
import { siteDirFor } from './clients';
import { loadVercelSync } from './vercelSync';
import {
  loadVercelCredentials,
  loadRetellApiKey,
  loadMakeApiKey,
  loadTeardownCredentials,
} from './opsSecrets';
import { probeUrl } from './probe';
import { resolveLiveUrl } from './manageSites';
import { loadReconcileProbes } from './reconcileProbes';

/**
 * The reconcile engine: ask every vendor what is true, and report where that differs from
 * what we intended.
 *
 * ── Two rules this file exists to keep ──────────────────────────────────────
 *
 * 1. RUNS PER SITE. An enterprise client is 2–3 sites, each with its own Retell agent and
 *    Twilio number, sharing one Airtable base and one portal account. A per-client sweep
 *    would check site 1 and never look at sites 2 and 3 — which is worse than not checking
 *    at all, because the screen would say it had.
 *
 * 2. ENV DRIFT IS NOT HERE. Resolving it costs one Vercel request PER KEY per site;
 *    attention.ts documents that as exactly why drift is a button rather than something
 *    that fires on page load. A launch sweep that pulled it would be hundreds of requests
 *    to paint a screen you open constantly. It stays an explicit action.
 *
 * Everything a probe cannot determine becomes an `unknown` finding rather than silence.
 * Silence is indistinguishable from health, and this whole engine exists because things
 * were failing silently.
 */

export interface ReconcileOptions {
  /** Skip vendors whose credentials are absent instead of emitting `unknown` for each. */
  quiet?: boolean;
}

/** Read `agent-prompt.txt` for a site, or null when there isn't one. */
function promptOnDisk(baseSlug: string, siteCount: number, index: number): string | null {
  const dir = siteDirFor(baseSlug, siteCount, index);
  const path = resolve(dir, 'agent-prompt.txt');
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

function f(finding: Finding): Finding {
  return finding;
}

/**
 * Sweep one client across every vendor.
 *
 * Vendor sections are independent and each swallows its own failures, so one dead API
 * degrades that section to `unknown` instead of aborting the others. `unreachable` names
 * the vendors that went dark, which is how the UI distinguishes "checked, fine" from
 * "never got an answer".
 */
export async function reconcileClient(
  ctx: ClientContext,
  opts: ReconcileOptions = {},
): Promise<ReconcileResult> {
  const checkedAt = Date.now();
  const findings: Finding[] = [];
  const unreachable = new Set<string>();

  const probes = await loadReconcileProbes();
  const vercelConfigured = loadVercelCredentials();
  const vercel = vercelConfigured ? await loadVercelSync().catch(() => null) : null;
  const retellKey = loadRetellApiKey();
  const makeKey = loadMakeApiKey();
  const { twilioAccountSid, twilioAuthToken, airtableApiKey } = loadTeardownCredentials();

  const siteCount = ctx.sites.length;
  const sharedBase = ctx.isEnterprise;

  for (let i = 0; i < siteCount; i++) {
    const site = ctx.sites[i];
    await reconcileSite({
      ctx,
      site,
      index: i,
      siteCount,
      sharedBase,
      findings,
      unreachable,
      probes,
      vercel,
      vercelConfigured,
      retellKey,
      makeKey,
      twilioAccountSid,
      twilioAuthToken,
      airtableApiKey,
      quiet: opts.quiet ?? false,
    });
  }

  return {
    slug: ctx.slug,
    checkedAt,
    findings: sortFindings(findings),
    unreachable: [...unreachable],
  };
}

interface SiteSweepArgs {
  ctx: ClientContext;
  site: SiteInfo;
  index: number;
  siteCount: number;
  sharedBase: boolean;
  findings: Finding[];
  unreachable: Set<string>;
  probes: Awaited<ReturnType<typeof loadReconcileProbes>>;
  vercel: Awaited<ReturnType<typeof loadVercelSync>> | null;
  vercelConfigured: boolean;
  retellKey: string | null;
  makeKey: string | null;
  twilioAccountSid: string | null;
  twilioAuthToken: string | null;
  airtableApiKey: string | null;
  quiet: boolean;
}

/**
 * Is this site supposed to be serving traffic yet?
 *
 * Everything about a live site — no domain, not answering, no deploy — is the NORMAL state
 * of one that hasn't been provisioned. Reporting those as problems would fire on every
 * client mid-build, and attention.ts already learned where that ends: "a warning that is
 * always on is wallpaper". Both current clients sit at `ready`/`needs-build`, so without
 * this gate the very first sweep flags them and keeps flagging them until launch day.
 *
 * The floor is `provisioned` — the point at which onboard.js has created the Vercel project
 * and pushed. Before that, silence is the correct output.
 */
function expectedLive(ctx: ClientContext): boolean {
  return (
    ctx.detectedStatus === 'provisioned' ||
    ctx.detectedStatus === 'portal-pending' ||
    ctx.detectedStatus === 'live'
  );
}

async function reconcileSite(a: SiteSweepArgs): Promise<void> {
  const { site, findings, unreachable, probes, quiet } = a;
  const siteSlug = site.slug;
  const isStarter = a.ctx.plan === 'starter';
  const shouldBeLive = expectedLive(a.ctx);

  /**
   * The host Vercel actually serves this site on. Set inside the Vercel block below and
   * handed to the voice checks, which compare the Twilio voiceUrl against it rather than
   * against a host recomputed from the slug — see voiceUrlForHost in reconcile-probes.js
   * for why that transform can't be trusted.
   */
  let liveHost: string | null = null;

  // ── Site: deploy, domain, reachability ────────────────────────────────────
  if (a.vercel && shouldBeLive) {
    const [deploy, domains] = await Promise.all([
      a.vercel.listDeployments(siteSlug, { limit: 1 }).then((r) => r.deployments[0] ?? null).catch(() => null),
      a.vercel.listProjectDomains(siteSlug).catch(() => null),
    ]);

    if (deploy?.state === 'ERROR') {
      findings.push(
        f({
          id: 'vercel.deployFailed',
          severity: 'red',
          area: 'site',
          siteSlug,
          title: 'Last deploy failed',
          detail:
            'The most recent production build errored, so the live site is whatever shipped before it. ' +
            'Open the build log, fix the error, and redeploy.',
          actual: deploy.inspectorUrl ?? 'ERROR',
        }),
      );
    }

    // `ok: false` carries a REASON — "Vercel project does not exist yet" is a different
    // problem from "the project is there and has no domain". Collapsing both into "no URL"
    // threw away the informative half and understated a missing project as a domain gap.
    if (domains && !domains.ok) {
      findings.push(
        f({
          id: 'vercel.projectMissing',
          severity: 'red',
          area: 'site',
          siteSlug,
          title: 'Vercel project not reachable',
          detail:
            `Vercel could not resolve the project for this site: ${domains.reason ?? 'unknown reason'}. ` +
            'The client is past provisioning, so it should exist — check the project name, or that the ' +
            'token is scoped to the team that owns it.',
          expected: siteSlug,
          actual: domains.reason ?? '(no reason given)',
        }),
      );
    }

    const resolved = resolveLiveUrl(domains?.ok ? domains.domains : [], site.canonical);
    liveHost = resolved.url ? resolved.url.replace(/^https?:\/\//, '').replace(/\/$/, '') : null;
    if (resolved.url) {
      const http = await probeUrl(resolved.url);
      if (http && http.ok === false) {
        findings.push(
          f({
            id: 'site.down',
            severity: 'red',
            area: 'site',
            siteSlug,
            title: `Site not answering (${http.status ?? 'unreachable'})`,
            detail: `A request to ${resolved.url} did not return a healthy response.`,
            expected: '200',
            actual: String(http.status ?? 'unreachable'),
          }),
        );
      }
    } else if (domains?.ok) {
      // Only meaningful once the project exists — otherwise vercel.projectMissing already
      // said the more useful thing and this would just be a second row for one cause.
      findings.push(
        f({
          id: 'site.noUrl',
          severity: 'amber',
          area: 'site',
          siteSlug,
          title: 'No live URL resolved',
          detail:
            'The Vercel project exists but has no attached domain, and site.ts has no canonical, ' +
            'so there is nothing to probe. Attach a domain, or fill in seo.canonical.',
        }),
      );
    }

    // A domain attached but never verified serves nothing. Vercel reports both separately.
    for (const d of domains?.ok ? domains.domains : []) {
      if (d.verified === false) {
        findings.push(
          f({
            id: `domain.unverified:${d.name}`,
            severity: 'red',
            area: 'site',
            siteSlug,
            title: `Domain ${d.name} is not verified`,
            detail:
              'The domain is attached to the Vercel project but ownership has not been confirmed, so it will not serve. ' +
              'Add the DNS records Vercel is asking for, then verify.',
            actual: 'unverified',
          }),
        );
      }
    }

    // Registrar expiry — only knowable for domains bought through Vercel. Anything else is
    // genuinely unknown, and saying so beats implying it was checked.
    const primary = (domains?.ok ? domains.domains : []).find((d) => d.verified)?.name ?? null;
    if (primary && !primary.endsWith('.vercel.app')) {
      const { token, teamId } = vercelCreds();
      const expiry = await probes.probeDomainExpiry({ token, teamId, domain: primary });
      if (expiry.expiresAt) {
        const daysLeft = Math.floor((expiry.expiresAt - Date.now()) / 86_400_000);
        if (daysLeft <= 30) {
          findings.push(
            f({
              id: 'domain.expiring',
              severity: daysLeft <= 7 ? 'red' : 'amber',
              area: 'site',
              siteSlug,
              title: `${primary} expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
              detail:
                'A lapsed registration takes the site down completely and is slow to undo. ' +
                (expiry.renewalDisabled ? 'Auto-renew is OFF.' : 'Confirm auto-renew is on.'),
              actual: new Date(expiry.expiresAt).toISOString().slice(0, 10),
            }),
          );
        }
      }
    }
  } else if (!a.vercel && shouldBeLive && !quiet) {
    // Only `unknown` when we WANTED an answer. A pre-provisioning client with no Vercel
    // token isn't an unanswered question, it's a question that doesn't apply yet.
    unreachable.add('vercel');
    findings.push(
      unknownFinding('vercel.unchecked', 'site', siteSlug, 'Vercel not checked', 'No VERCEL_TOKEN in jdd-ops/.env, so deploy state, domains and reachability are unknown.'),
    );
  }

  // ── Voice: Twilio + Retell + Make. Starter has none of it by design. ──────
  if (!isStarter) {
    await reconcileVoice(a, siteSlug, liveHost);
  }

  // ── Airtable ──────────────────────────────────────────────────────────────
  const baseId = site.env.AIRTABLE_BASE_ID;
  if (!isStarter && baseId) {
    const air = await probes.probeAirtableBase({
      apiKey: a.airtableApiKey,
      baseId,
      needsSiteColumn: a.sharedBase,
    });
    if (!air.checked) {
      unreachable.add('airtable');
      if (!quiet) {
        findings.push(unknownFinding('airtable.unchecked', 'leads', siteSlug, 'Airtable not checked', 'No AIRTABLE_API_KEY, or the base could not be read.'));
      }
    } else if (air.exists === false) {
      findings.push(
        f({
          id: 'airtable.missing',
          severity: 'red',
          area: 'leads',
          siteSlug,
          title: 'Airtable base is gone',
          detail: `AIRTABLE_BASE_ID points at ${baseId}, which no longer exists. Call logging is writing nowhere.`,
          actual: baseId,
        }),
      );
    } else {
      if (air.hasCallLog === false) {
        findings.push(
          f({
            id: 'airtable.noCallLog',
            severity: 'red',
            area: 'leads',
            siteSlug,
            title: 'Call Log table missing',
            detail: 'The base exists but has no "Call Log" table, so the post-call scenario has nowhere to write.',
          }),
        );
      }
      if (air.needsSiteColumn && air.hasSiteColumn === false) {
        findings.push(
          f({
            id: 'airtable.noSiteColumn',
            severity: 'amber',
            area: 'leads',
            siteSlug,
            title: 'Shared base has no Site column',
            detail:
              'Enterprise sites share one base and are kept apart by the Site column. Without it every site’s ' +
              'calls land in one undifferentiated table and the portal shows each client all of them.',
          }),
        );
      }
    }
  }
}

function vercelCreds(): { token: string | null; teamId: string | null } {
  return {
    token: process.env.VERCEL_TOKEN ?? null,
    teamId: process.env.VERCEL_TEAM_ID ?? null,
  };
}

function unknownFinding(
  id: string,
  area: Finding['area'],
  siteSlug: string,
  title: string,
  detail: string,
): Finding {
  return { id, severity: 'unknown', area, siteSlug, title, detail };
}

/** Twilio, Retell and Make — the three that carry a call from ringing to logged. */
async function reconcileVoice(
  a: SiteSweepArgs,
  siteSlug: string,
  liveHost: string | null,
): Promise<void> {
  const { site, findings, unreachable, probes, quiet } = a;

  // ── Twilio ────────────────────────────────────────────────────────────────
  const number = site.env.TWILIO_NUMBER;
  if (number) {
    const tw = await probes.probeTwilioNumber({
      accountSid: a.twilioAccountSid,
      authToken: a.twilioAuthToken,
      phoneNumber: number,
      liveHost,
    });

    if (!tw.checked) {
      unreachable.add('twilio');
      if (!quiet) {
        findings.push(unknownFinding('twilio.unchecked', 'voice', siteSlug, 'Twilio not checked', 'No Twilio credentials in jdd-ops/.env, so number routing is unknown.'));
      }
    } else if (tw.exists === false) {
      findings.push(
        f({
          id: 'twilio.numberGone',
          severity: 'red',
          area: 'voice',
          siteSlug,
          title: 'Twilio number is no longer on the account',
          detail: `${number} is in .env.local but the master Twilio account does not own it. Inbound calls are going nowhere.`,
          actual: number,
        }),
      );
    } else {
      if (tw.voiceUrlMatches === false) {
        findings.push(
          f({
            id: 'twilio.voiceUrl',
            severity: 'red',
            area: 'voice',
            siteSlug,
            title: 'Number is pointed at the wrong voice webhook',
            detail:
              'Inbound calls hit this URL first; if it is wrong the human-first ring never happens and the ' +
              'caller gets nothing. This is set once at purchase and never re-checked, so a project rename breaks it silently.',
            expected: tw.expected ?? undefined,
            actual: tw.voiceUrl ?? '(none)',
            fix: {
              route: '/api/manage/twilio/repair',
              body: { slug: a.ctx.slug, siteSlug, field: 'voiceUrl' },
              label: 'Re-point voiceUrl',
            },
          }),
        );
      }

      // Billed-but-undelivered SMS. The scenario reports success either way, so nothing
      // else in the stack can see this.
      const errs = tw.recentSendErrors;
      if (errs && errs.failed > 0) {
        const a2p = errs.codes.includes(30034);
        findings.push(
          f({
            id: 'twilio.smsFailing',
            severity: 'red',
            area: 'voice',
            siteSlug,
            title: a2p
              ? 'Post-call SMS failing — sender not registered (30034)'
              : `Post-call SMS failing (${errs.failed}/${errs.total} recent)`,
            detail: a2p
              ? 'Error 30034 means the number is not registered for A2P 10DLC. Twilio bills every attempt and ' +
                'delivers none of them, and the owner has no idea their alerts stopped. Registration is a ' +
                'submission-and-approval process in the Twilio console; it cannot be fixed from here.'
              : `${errs.failed} of the last ${errs.total} messages from this number errored (codes: ${errs.codes.join(', ')}).`,
            actual: errs.codes.join(', '),
          }),
        );
      }
    }
  }

  // ── Retell ────────────────────────────────────────────────────────────────
  const agentId = site.env.RETELL_AGENT_ID;
  if (agentId) {
    const expectedWebhook = site.env.RETELL_POST_CALL_WEBHOOK_URL ?? null;
    const re = await probes.probeRetellAgent({
      apiKey: a.retellKey,
      agentId,
      promptOnDisk: promptOnDisk(a.ctx.slug, a.siteCount, a.index),
      expectedWebhookUrl: expectedWebhook,
    });

    if (!re.checked) {
      unreachable.add('retell');
      if (!quiet) {
        findings.push(unknownFinding('retell.unchecked', 'voice', siteSlug, 'Retell not checked', 'No RETELL_API_KEY, or the agent could not be read.'));
      }
    } else if (re.exists === false) {
      findings.push(
        f({
          id: 'retell.agentGone',
          severity: 'red',
          area: 'voice',
          siteSlug,
          title: 'Retell agent no longer exists',
          detail: `RETELL_AGENT_ID is ${agentId}, which Retell does not recognise. Unanswered calls have nothing to fall through to.`,
          actual: agentId,
        }),
      );
    } else {
      if (re.promptMatches === false) {
        findings.push(
          f({
            id: 'retell.promptDrift',
            severity: 'amber',
            area: 'voice',
            siteSlug,
            title: 'Live prompt differs from agent-prompt.txt',
            detail:
              'The agent is answering with something other than what is on disk — usually an edit made in the ' +
              'Retell dashboard. The console’s editor pushes from disk, so saving here would overwrite it. ' +
              'Compare the two before you push.',
          }),
        );
      }
      if (re.webhookMatches === false) {
        findings.push(
          f({
            id: 'retell.webhook',
            severity: 'red',
            area: 'voice',
            siteSlug,
            title: 'Post-call webhook is not the one we provisioned',
            detail:
              'Completed calls POST here. If it does not match the Make clone we created, calls stop reaching ' +
              'Airtable and the owner stops getting alerts — while every call still connects normally.',
            expected: expectedWebhook ?? undefined,
            actual: re.webhookUrl ?? '(none)',
            fix: {
              route: '/api/manage/retell/config',
              body: { slug: a.ctx.slug, siteSlug, field: 'webhook_url' },
              label: 'Re-point the webhook',
            },
          }),
        );
      }
    }
  }

  // ── Make ──────────────────────────────────────────────────────────────────
  const webhookUrl = site.env.RETELL_POST_CALL_WEBHOOK_URL;
  if (webhookUrl) {
    const mk = await probes.probeMakeScenario({
      apiKey: a.makeKey,
      zone: 'https://us2.make.com/api/v2',
      webhookUrl,
    });

    if (!mk.checked) {
      unreachable.add('make');
      if (!quiet) {
        findings.push(unknownFinding('make.unchecked', 'leads', siteSlug, 'Make not checked', 'No MAKE_API_KEY, so the post-call scenario state is unknown.'));
      }
    } else if (mk.scenarioId === null) {
      findings.push(
        f({
          id: 'make.scenarioGone',
          severity: 'red',
          area: 'leads',
          siteSlug,
          title: 'Post-call scenario not found',
          detail:
            'No Make scenario owns the webhook in .env.local, so the clone was deleted or its hook changed. ' +
            'Calls connect and are never logged.',
          actual: webhookUrl,
        }),
      );
    } else if (mk.isActive === false) {
      findings.push(
        f({
          id: 'make.inactive',
          severity: 'red',
          area: 'leads',
          siteSlug,
          title: 'Post-call scenario is deactivated',
          detail:
            `Scenario ${mk.scenarioId} exists but is switched off. This is completely silent: calls still connect, ` +
            'the caller still gets an answer, and nothing reaches Airtable or the owner’s phone.',
          fix: {
            route: '/api/manage/make/datastore',
            body: { slug: a.ctx.slug, siteSlug, scenarioId: mk.scenarioId, action: 'activate' },
            label: 'Reactivate the scenario',
          },
        }),
      );
    }
  }
}
