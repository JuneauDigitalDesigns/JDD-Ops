// Canonical per-client runbook content, as data. Mirrors ops/jdd-ops/RUNBOOK.md and
// interpolates each client's real values (slug, plan, env IDs, canonical). Pure function
// of ClientContext so it is safe to run on the client. One source of truth for the guide.

import { ENV_FIELDS } from './envFields';
import type { ClientContext, OpsConfig, Plan, SiteInfo } from './types';

/**
 * The default ring window, in seconds, read from the copy the console bundle already pins.
 *
 * NOT a literal. The guide used to say "~25s" in two places while `lib/client-env.js` defaulted
 * to 15 and clamped at 20 — prose that tells an operator to expect a window the system will not
 * give them, and the same stale 25 that reached the plan-upgrade route and the env field's max.
 * ring-window.test.mjs pins envFields.ts to client-env.js, so deriving from it here means this
 * copy cannot drift on its own.
 */
const RING_SECONDS_DEFAULT =
  ENV_FIELDS.find((f) => f.key === 'CLIENT_FORWARD_RING_SECONDS')?.placeholder ?? '15';

export type Block =
  | { t: 'text'; body: string }
  | { t: 'callout'; tone: 'info' | 'warn' | 'danger'; title?: string; body: string }
  | { t: 'nav'; app: string; path: string[] }
  | { t: 'cmd'; command: string; cwd?: string; note?: string }
  | { t: 'copy'; label: string; value: string; pending?: boolean }
  | { t: 'fields'; caption?: string; rows: { label: string; value: string; pending?: boolean }[] }
  | { t: 'env'; file: string; vars: { key: string; value: string; note?: string; pending?: boolean }[] }
  | { t: 'json'; label: string; json: string }
  | { t: 'substeps'; items: { text: string; detail?: string }[] }
  // "Get it from → Put it here → looks like" context card. value (when known) renders a copy
  // button; otherwise example shows the format.
  | { t: 'context'; label: string; from: string; to: string; example?: string; value?: string; pending?: boolean }
  | { t: 'link'; label: string; href: string }
  // A live, data-bound architecture diagram. Deliberately thin: the node/edge model is derived
  // inside the component from ClientContext, so the env plumbing lives in ONE place instead of
  // being restated at every call site. `siteSlug` picks the site on enterprise; omit for the
  // primary site. Only rendered on /onboard — Part A has no client, so BlockView drops it.
  | { t: 'diagram'; kind: 'call-routing' | 'pipeline' | 'post-call'; siteSlug?: string }
  // Faithful replicas of the two Make.com modules that must be edited by hand per client,
  // side by side. Thin like `diagram`: the whole field model is derived in make-modules.ts
  // from ClientContext, so the ten Airtable mappings exist in exactly one place.
  | { t: 'make-module'; siteSlug?: string }
  // The deployed site as the focal point of its review step: the .vercel.app URL in display
  // type plus a live preview frame.
  | { t: 'site-hero'; siteSlug?: string }
  // In-step prompt editor + version history, for the call → edit → push → call-again loop.
  | { t: 'prompt-tuner'; siteSlug?: string }
  // Success criteria: what you should observe if the step worked. Previously written as a
  // trailing "You should see: …" info callout, which read as advice rather than a check.
  | { t: 'verify'; title?: string; items: { text: string; detail?: string }[] }
  // An in-app action button (go-live wizard only). Runs one of the guarded /api/go-live/*
  // endpoints. `destructive` actions force a dry-run preview before the real run can fire;
  // read-only ones (preflight) run straight away. BlockView renders <RunBlock>.
  | {
      t: 'run';
      action:
        | 'preflight'
        | 'stripe-go-live'
        | 'kv-reset'
        | 'env-sync'
        | 'turnstile-provision'
        | 'stripe-webhook';
      label: string;
      /** Forces dry-run → confirm before a real run. */
      destructive?: boolean;
      /** Extra body sent to the endpoint (e.g. { scope: 'test' }). */
      params?: Record<string, string>;
    };

/**
 * Which blocks break out of the stage's prose column.
 *
 * The stage is a CENTRED reading column because that's what body text needs. Everything else —
 * diagrams, the Make replicas, the site hero, the prompt tuner — is not text and was being
 * squeezed into it, which is what clipped the diagrams. Wide blocks break out to the full stage
 * width while the prose stays centred under them. One place decides, so the two stages can't
 * disagree.
 */
const WIDE_BLOCKS = new Set(['diagram', 'make-module', 'site-hero', 'prompt-tuner']);
export function isWideBlock(b: Block): boolean {
  return WIDE_BLOCKS.has(b.t);
}

export interface Step {
  id: string;
  title: string;
  why?: string;
  est?: string;
  auto?: boolean; // performed automatically by onboard.js (shown for context, not a manual to-do)
  /**
   * The site this step belongs to, when a phase fans out per site (enterprise). The rail groups
   * consecutive steps sharing a site under one sub-header — without it a 3-site client renders
   * ~20 undifferentiated rows.
   */
  site?: string;
  /** This step IS the provisioning run: the stage hands off to the launch screen. */
  launch?: boolean;
  blocks: Block[];
}

export interface Phase {
  id: string;
  title: string;
  subtitle?: string;
  /**
   * Which macro-phase this sub-phase belongs to: all `onboarding` sub-phases (the work) render
   * before all `review` sub-phases (checks + reference). OPTIONAL so go-live-content.ts phases,
   * which borrow this type and have no macro grouping, keep compiling. buildRunbook always sets it.
   */
  group?: 'onboarding' | 'review';
  steps: Step[];
}

// ── value helpers ────────────────────────────────────────────────────────────
function pending(label: string): { value: string; pending: boolean } {
  return { value: label, pending: true };
}
/** Real env value if present, else a clearly-marked placeholder. */
function envVal(v: string | undefined, placeholder: string) {
  return v ? { value: v, pending: false } : pending(placeholder);
}

function clerkMetadataJson(ctx: ClientContext): string {
  const primary = ctx.sites[0];
  const base: Record<string, unknown> = {
    slug: ctx.slug,
    name: primary?.brandName ?? ctx.brandName,
    plan: ctx.plan,
    canonical: primary?.canonical ?? 'https://REPLACE_WITH_LIVE_URL',
    airtableBaseId:
      ctx.isWebOnly ? null : primary?.env.AIRTABLE_BASE_ID ?? 'appREPLACE_FROM_ENV_LOCAL',
    vercelProjectId: primary?.env.VERCEL_PROJECT_ID ?? 'prj_REPLACE_FROM_VERCEL',
  };
  if (ctx.isEnterprise) {
    base.sites = ctx.sites.map((s) => ({
      slug: s.slug,
      name: s.brandName,
      canonical: s.canonical ?? 'https://REPLACE_WITH_LIVE_URL',
      vercelProjectId: s.env.VERCEL_PROJECT_ID ?? 'prj_REPLACE_FROM_VERCEL',
    }));
  }
  return JSON.stringify(base, null, 2);
}

// ── per-client phases ────────────────────────────────────────────────────────
// Two macro-groups, in order: ONBOARDING (everything you must DO) then REVIEW (everything you
// check once the work is done, plus reference). `group` tags each sub-phase; buildRunbook emits
// all onboarding sub-phases first, then all review sub-phases. Sub-phase titles name the action.

// ── Onboarding: Provision ─────────────────────────────────────────────────────
function provisionPhase(ctx: ClientContext, config: OpsConfig): Phase {
  const voice = !ctx.isWebOnly;
  const org = config.githubOrg ?? 'GITHUB_ORG';
  return {
    id: 'provision',
    group: 'onboarding',
    title: 'Provision the stack',
    subtitle: 'Run the orchestrator to stand up the whole client stack.',
    steps: [
      {
        id: 'run-onboard',
        launch: true,
        title: 'Launch onboard.js',
        why: 'One command stands up the whole stack: GitHub repo, schema, build, Vercel deploy — plus (Growth/Enterprise) the Retell agent, phone number, Airtable base, Make post-call clone, and the Clerk portal user.',
        blocks: [
          { t: 'diagram', kind: 'pipeline' },
          {
            t: 'context',
            label: 'GitHub repo it creates',
            from: 'auto-created by onboard step 2',
            to: `github.com/${org}/${ctx.slug}`,
            value: `https://github.com/${org}/${ctx.slug}`,
          },
          {
            t: 'callout',
            tone: 'warn',
            title: 'Re-running is safe',
            body: 'If a step FAILs: fix the cause in jdd-ops/.env and re-run. onboard.js is idempotent — it reuses already-provisioned IDs from .env.local, so re-runs won’t double-charge or duplicate resources.',
          },
          {
            t: 'verify',
            title: 'A clean run ends with',
            items: [
              { text: 'The log reaching [step 10/10] and printing an ONBOARDED summary, with no FAIL or ✗ lines.' },
              {
                text: voice
                  ? 'A repo URL, Retell agent id, phone number, Airtable base, and Clerk user id in that summary.'
                  : 'A repo URL and a Clerk user id in that summary.',
              },
            ],
          },
        ],
      },
    ],
  };
}

// ── Onboarding: map the cloned post-call scenario (per site, non-web-only) ──────
// The clone inherits the MASTER's module settings, so its Airtable + Twilio modules must be
// pointed at THIS client by hand before the first real call. The exact field expressions and
// message body are operator-supplied and reproduced verbatim.
function callLoggingSetupStepsForSite(ctx: ClientContext, s: SiteInfo): Step[] {
  const label = ctx.isEnterprise ? ` (${s.brandName})` : '';
  return [
    {
      id: `make-fieldmap-${s.slug}`,
      site: s.slug,
      title: `Map the cloned call-log scenario${label}`,
      why: 'onboard.js clones the master post-call scenario for this client, but the clone carries the master’s module settings — it is not pointed at this client yet. Until you do this, a finished call writes nothing, or writes into someone else’s log.',
      blocks: [
        {
          t: 'substeps',
          items: [
            { text: `Open Make.com → this client’s cloned scenario “Post-call: ${s.brandName}”.` },
            { text: 'In the Airtable module, set Base to this client’s own base and Table to “Call Log”.', detail: 'The clone still points at the master’s base until you change it.' },
            { text: 'Map each Call Log field to the expression shown below — click any box to copy it.', detail: 'The column names are a contract with the master scenario. A column the master writes that this base does not have is dropped silently from every logged call.' },
            { text: 'In the Twilio module, set From to this client’s number and To to the owner’s consented alert number, then paste the message body.' },
            { text: 'Save both modules, then confirm the scenario is Active.' },
          ],
        },
        { t: 'make-module', siteSlug: s.slug },
        {
          t: 'callout',
          tone: 'danger',
          title: 'Never wire this client to a master resource',
          body: 'A client must own its Airtable base and its own clone of the scenario. Sharing a master resource does not look broken — it looks like a working client whose calls land in someone else’s log.',
        },
      ],
    },
  ];
}

function callLoggingSetupPhase(ctx: ClientContext): Phase {
  return {
    id: 'call-logging-setup',
    group: 'onboarding',
    title: 'Map the call log (Make)',
    subtitle: ctx.isEnterprise
      ? 'Point each site’s cloned post-call scenario at its own base + number.'
      : 'Point the cloned post-call scenario at this client’s base + number.',
    steps: ctx.sites.flatMap((s) => callLoggingSetupStepsForSite(ctx, s)),
  };
}

// ── Onboarding: analytics ──────────────────────────────────────────────────────
function analyticsPhase(ctx: ClientContext): Phase {
  return {
    id: 'analytics',
    group: 'onboarding',
    title: 'Enable analytics',
    subtitle: 'Switch on Web Analytics so the portal’s Traffic tab has data.',
    steps: [
      {
        id: 'enable-web-analytics',
        title: 'Enable Web Analytics on the client’s Vercel project',
        why: 'The portal’s Traffic tab reads page views + visitors from the Vercel Web Analytics API, keyed by the user’s vercelProjectId. The exported site already renders <Analytics /> from @vercel/analytics (template root layout), so enabling Web Analytics is the only step — no GA4 property, no site tag, no service-account grant.',
        blocks: [
          {
            t: 'callout',
            tone: 'info',
            body: 'The portal account record already has vercelProjectId set (onboard.js step 10 wrote it from the client’s Vercel project). You only need to switch Web Analytics on — no command, no account edit.',
          },
          {
            t: 'substeps',
            items: [
              { text: 'Vercel → the client’s project → Analytics → Enable Web Analytics.', detail: '@vercel/analytics is already in the template root layout, so no code change or redeploy is needed — the project starts collecting once enabled.' },
              { text: 'The Traffic tab stays empty until the live site receives real visitors — visit the site once and confirm data appears within ~30s.' },
              { text: 'Verify it rather than trusting the toggle: npm run audit-analytics', detail: 'Exit 0 = every live site collecting, 1 = at least one is off (it names the project), 2 = could not check. onboard.js also reports this at the end of a run.' },
            ],
          },
          { t: 'nav', app: 'Vercel', path: ['Project', 'Analytics', 'Enable Web Analytics'] },
          { t: 'link', label: 'Open Vercel dashboard', href: 'https://vercel.com/dashboard' },
          ...(ctx.isEnterprise
            ? ([
                {
                  t: 'callout',
                  tone: 'warn',
                  body: 'Enterprise: enable Web Analytics on each site’s Vercel project. Every entry in the account record’s sites[] carries its own vercelProjectId, and each project needs Analytics switched on to light up that site’s Traffic tab.',
                } as Block,
              ])
            : []),
          { t: 'json', label: 'publicMetadata shape (onboard.js step 10 set this, including vercelProjectId)', json: clerkMetadataJson(ctx) },
        ],
      },
    ],
  };
}

// ── Review: the deployed site ───────────────────────────────────────────────────
function siteReviewPhase(ctx: ClientContext): Phase {
  const primary = ctx.sites[0];
  return {
    id: 'review-site',
    group: 'review',
    title: 'Review the site',
    subtitle: 'Confirm the live build renders with real brand content.',
    steps: [
      {
        id: 'checkpoint-1',
        title: 'Review the deployed site',
        est: '~15 min',
        why: 'Confirm the live build renders with this client’s real content before trusting anything downstream of it.',
        blocks: [
          { t: 'site-hero', siteSlug: primary?.slug },
          {
            t: 'substeps',
            items: [
              { text: 'Confirm the hero, services and contact form show this client’s real copy — not “TODO” placeholders.', detail: 'Placeholders mean the intake (site.ts) still has unfilled fields.' },
              ...(ctx.isWebOnly
                ? []
                : [{
                    text: 'Confirm the number on the page is the Twilio number, not the owner’s line.',
                    detail: 'If the site still advertises the owner’s number, every caller dials them directly and bypasses /api/voice — no human-first forward, no AI fallback, no Airtable row, and no error anywhere to find.',
                  }]),
              { text: 'Check the page at mobile width; confirm the nav and footer render.' },
            ],
          },
          { t: 'link', label: 'Open Vercel dashboard', href: 'https://vercel.com/dashboard' },
          ...(ctx.isWebOnly
            ? ([
                {
                  t: 'callout',
                  tone: 'info',
                  body: `This is a web-only client (receptionist declined) — no voice agent or Make scenario. Submit the contact form with a test message and confirm the lead email lands at ${primary?.env.LEAD_DELIVERY_MODE ? 'the brand inbox' : (primary?.brandName ?? 'the brand') + '’s inbox'} (Resend).`,
                } as Block,
              ])
            : []),
        ],
      },
    ],
  };
}

// ── Review: test-call each agent (+ routing reference last) ─────────────────────
/**
 * Test-call each agent and tune its prompt in place.
 *
 * The routing reference that used to close this phase is gone from the step list — it lives in
 * the reference panel now. It was a non-actionable page sitting BETWEEN two checkpoints, so
 * finishing the test call and pressing Next landed you on a wall of diagrams instead of the
 * post-call verification you were heading for.
 */
function voiceReviewPhase(ctx: ClientContext): Phase {
  return {
    id: 'review-voice',
    group: 'review',
    title: 'Test-call the agent',
    subtitle: 'Hear each agent on a real call, then fix the prompt without leaving the step.',
    steps: ctx.sites.map((s): Step => {
      const num = envVal(s.env.TWILIO_NUMBER, '+1… (provision first)');
      const ring = s.env.CLIENT_FORWARD_RING_SECONDS ?? RING_SECONDS_DEFAULT;
      return {
        id: `checkpoint-2-${s.slug}`,
        site: s.slug,
        title: ctx.isEnterprise ? `Test-call & tune (${s.brandName})` : 'Test-call & tune the agent',
        est: '~20 min',
        why: 'Hear the greeting and the qualifying flow on a real call, then fix anything wrong and push it straight to the live agent.',
        blocks: [
          { t: 'copy', label: 'Call this number', value: num.value, pending: num.pending },
          {
            t: 'substeps',
            items: [
              {
                text: `Call from a phone that is NOT the client’s, and let their real line ring out for ~${ring}s.`,
                detail: 'Only then does the agent pick up — answering inside the ring window connects a normal call and the AI never engages. See Reference → Call routing.',
              },
              { text: 'Confirm the greeting names the business correctly.' },
              { text: 'Run a fake lead: ask about a service, give a name and a callback number, mention a timeline.' },
              { text: 'Note anything off — wrong hours, missing services, awkward phrasing, quoting a price.' },
              { text: 'Fix it in the editor below, push it to Retell, then call again.', detail: 'Every save and push is kept, so any change is reversible.' },
            ],
          },
          { t: 'prompt-tuner', siteSlug: s.slug },
          {
            t: 'verify',
            title: 'You should hear',
            items: [
              { text: 'A warm greeting using the exact business name.' },
              { text: 'FAQ answers drawn only from the intake — nothing invented.' },
              { text: 'Pricing deferred to the owner.', detail: 'The agent should never quote a price.' },
              { text: 'The agent collecting a name and a callback number.' },
            ],
          },
        ],
      };
    }),
  };
}

// ── Review: prove post-call logging + owner SMS (per site) ──────────────────────
function callLoggingReviewStepsForSite(ctx: ClientContext, s: SiteInfo): Step[] {
  const twilio = envVal(s.env.TWILIO_NUMBER, '+1… (provision first)');
  const owner = envVal(s.env.CLIENT_FORWARD_PHONE, 'the owner number (brand.phone)');
  const ring = s.env.CLIENT_FORWARD_RING_SECONDS ?? RING_SECONDS_DEFAULT;
  const label = ctx.isEnterprise ? ` (${s.brandName})` : '';
  return [
    {
      id: `checkpoint-postcall-${s.slug}`,
      site: s.slug,
      title: `Checkpoint — post-call log + owner SMS${label}`,
      est: '~15 min',
      why: 'Proves the chain: AI-handled call → Make clone → Airtable row + owner SMS.',
      blocks: [
        {
          t: 'substeps',
          items: [
            { text: `Trigger an AI-handled call: submit the form with your number, or call ${twilio.value} and let it ring past ${ring}s so the AI answers.` },
            { text: 'Finish the call and hang up.' },
            { text: `Within ~30s confirm a new Airtable Call Log row AND a brief SMS to ${owner.value}.` },
          ],
        },
        {
          t: 'verify',
          title: 'Within ~30 seconds',
          items: [
            { text: 'A new row in the client’s Airtable Call Log.' },
            { text: `A brief SMS to ${owner.value}.` },
          ],
        },
        {
          t: 'callout',
          tone: 'warn',
          title: 'If nothing arrives',
          body: `Walk it backwards: Retell call log (did the call complete?) → Make “Post-call: ${s.brandName}” History (webhook fired? filter passed? module errors?) → Twilio Messaging logs (is the number registered yet?).`,
        },
      ],
    },
  ];
}

function callLoggingReviewPhase(ctx: ClientContext): Phase {
  return {
    id: 'review-call-logging',
    group: 'review',
    title: 'Verify call logging',
    subtitle: ctx.isEnterprise
      ? 'Prove each site logs calls + texts the owner.'
      : 'Prove the chain: AI call → Airtable row + owner SMS.',
    steps: ctx.sites.flatMap((s) => callLoggingReviewStepsForSite(ctx, s)),
  };
}

/** The ordered per-client phases: all Onboarding (work) first, then all Review. */
export function buildRunbook(ctx: ClientContext, config: OpsConfig = {}): Phase[] {
  const phases: Phase[] = [];
  // ── Onboarding (do the work) ──
  phases.push(provisionPhase(ctx, config));
  if (!ctx.isWebOnly) phases.push(callLoggingSetupPhase(ctx));
  phases.push(analyticsPhase(ctx));
  // ── Review (verify + reference) ──
  phases.push(siteReviewPhase(ctx));
  if (!ctx.isWebOnly) {
    phases.push(voiceReviewPhase(ctx));
    phases.push(callLoggingReviewPhase(ctx));
  }
  return phases;
}

// ── one-time setup (Part A) — static, plan-independent ───────────────────────
export function buildPartA(config: OpsConfig = {}): Phase[] {
  return [
  {
    id: 'a-creds',
    title: 'Master credentials',
    subtitle: 'Fill jdd-ops/.env once.',
    steps: [
      {
        id: 'a-env',
        title: 'Fill jdd-ops/.env',
        why: 'Every provisioning step reads from this file. A missing key fails pre-flight before any resource is created.',
        blocks: [
          { t: 'cmd', command: 'cp .env.example .env   # fill in, then: npm install', cwd: 'jdd-ops/' },
          {
            t: 'substeps',
            items: [
              { text: 'ANTHROPIC_API_KEY — console.anthropic.com (generates the Retell agent prompt).' },
              { text: 'RETELL_API_KEY + RETELL_LLM_ID + RETELL_DEFAULT_VOICE_ID — dashboard.retellai.com (agent + voice). The account also needs custom-telephony / outbound SIP available — the no-answer leg dials sip:{call_id}@sip.retellai.com (on by default for standard accounts).' },
              { text: 'TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN — console.twilio.com (Growth/Enterprise: step 8 buys each client’s number and sets human-first call routing).' },
              { text: 'AIRTABLE_API_KEY (data.records:write + schema.bases:write) + AIRTABLE_WORKSPACE_ID (wsp…).' },
              { text: 'GITHUB_TOKEN (repo + delete_repo) + GITHUB_ORG; VERCEL_TOKEN + VERCEL_TEAM_ID.' },
              { text: 'MAKE_API_KEY + MAKE_POST_CALL_MASTER_SCENARIO_ID — from the Make setup below.' },
              { text: 'CLERK_SECRET_KEY — step 10 auto-creates the portal user. RESEND_API_KEY for Starter lead emails.' },
            ],
          },
          { t: 'callout', tone: 'info', body: 'Twilio creds (TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN) are required for Growth/Enterprise — onboard.js buys the number and wires human-first routing → Retell fallback. Leave TEMPLATE_REPO blank — onboarding is local-first.' },
        ],
      },
    ],
  },
  {
    id: 'a-vercel',
    title: 'Vercel GitHub App',
    steps: [
      {
        id: 'a-vercel-install',
        title: 'Install the Vercel GitHub integration on your org',
        why: 'Lets onboard.js step 9 create + link Vercel projects and auto-deploy new client repos. Without it, project creation 403s.',
        blocks: [
          {
            t: 'substeps',
            items: [
              { text: 'Open the Vercel GitHub integration page and click Add Integration.' },
              { text: 'Pick the Vercel team that owns your VERCEL_TOKEN.' },
              { text: 'Install to your GITHUB_ORG.' },
              { text: 'Repository access: choose All repositories — new client repos must be auto-visible to Vercel.' },
            ],
          },
          { t: 'link', label: 'Vercel GitHub integration', href: 'https://vercel.com/integrations/github' },
        ],
      },
    ],
  },
  {
    id: 'a-make-post',
    title: 'Post-call master Make scenario',
    subtitle: 'The one scenario onboard.js clones per client. Logs the call + texts the owner.',
    steps: [
      {
        id: 'a-make-post-build',
        title: 'Prepare the post-call master (Webhook → filter → Airtable → Twilio SMS)',
        why: 'onboard.js clones this master per client and overwrites the Airtable base and the Twilio From/To. The master itself never runs.',
        blocks: [
          {
            t: 'substeps',
            items: [
              { text: 'Open your post-call scenario. Module 1: Custom webhook (Retell posts call_ended/call_analyzed here).' },
              { text: 'Add a Filter immediately after the webhook that only passes AI-handled leads (e.g. event = call_analyzed AND custom_analysis_data.caller_name exists) — so client-answered calls never log or text.' },
              { text: 'Module: Airtable → Create a Record, table Call Log; map Date / Caller name / Caller number / Summary / Duration / Call type / Outcome. Leave the Base as a PLACEHOLDER — onboard.js overwrites it per clone.' },
              { text: 'Module: Twilio → Send a Message (JDD SID/auth connection). Leave From and To as PLACEHOLDERS — onboard.js sets From = client TWILIO_NUMBER and To = the owner’s CONSENTED alert number per clone. If the owner never opted in, onboard.js removes this module from the clone entirely.' },
              { text: 'Send via the A2P Messaging Service, not a bare From number — the Messaging Service carries the approved campaign and the Advanced Opt-Out (STOP/HELP) behaviour.' },
              { text: 'SMS body MUST identify the sender and carry opt-out language. Use exactly: “Juneau Digital Designs call alert: {{urgency}}. New lead {{caller_name}}, callback {{callback_number}}. Reply STOP to opt out.” This string must match the sample message submitted with the A2P campaign and the sample shown on juneaudigitaldesigns.com/sms-terms.' },
              { text: 'Save, then Deactivate the master (only per-client clones run).' },
            ],
          },
          {
            t: 'context',
            label: 'Master scenario ID',
            from: 'Make → open the post-call master → the numeric ID in the URL',
            to: 'jdd-ops/.env → MAKE_POST_CALL_MASTER_SCENARIO_ID (so step 8c can clone it)',
            value: config.makePostCallMasterScenarioId,
            example: '1234567',
            pending: !config.makePostCallMasterScenarioId,
          },
          { t: 'callout', tone: 'info', body: 'onboard.js reads the clone’s webhook URL and sets it on the Retell agent automatically. Exact Airtable field expressions are in retell-post-call-airtable-plan.md (repo root).' },
        ],
      },
      {
        id: 'a-twilio-a2p',
        title: 'Register JDD for outbound SMS (A2P 10DLC)',
        why: 'US carriers block SMS from unregistered numbers. Register once so client numbers can text owners; per-number attach/verify happens during each onboarding.',
        blocks: [
          {
            t: 'substeps',
            items: [
              { text: 'Twilio Console → Messaging → Regulatory Compliance → A2P 10DLC. Register the JDD Brand (business/EIN) once.' },
              { text: 'Create/attach a Messaging Service FIRST, and enable Advanced Opt-Out on it (STOP / HELP / START). That is what handles opt-out keywords; the site has no inbound SMS webhook wired.' },
              { text: 'Create a Campaign against that Messaging Service. Use-case: Customer Care / account notifications.' },
              { text: 'Sample message: “Juneau Digital Designs call alert: Callback requested. New lead Maria Alvarez, callback (930) 555-0117. Reply STOP to opt out.” Must match the Make master body and /sms-terms.' },
              { text: 'Opt-in description: consent is a separate unchecked checkbox beside a mobile-number field on the PUBLIC agreement page, juneaudigitaldesigns.com/agreement?plan=growth (no login). Tell the reviewer to open that URL and scroll to “Your details”. Consent is not a condition of purchase, and alerts only activate after Stripe payment completes.' },
              { text: 'Point the reviewer at juneaudigitaldesigns.com/sms-terms (linked in the site footer) for program name, message types, frequency, rates, and STOP/HELP.' },
              { text: 'Sender Pool holds the client LOCAL numbers; onboard.js adds each one automatically AND reads the pool back to confirm it landed when TWILIO_MESSAGING_SERVICE_SID is set. If a client has SMS consent, onboarding now HARD-FAILS (no resources created) when the SID is unset or the campaign is not yet approved — it no longer provisions a silently-textless client.' },
              { text: 'We never buy toll-free numbers — provisioning is local-only (Central FL by default via TWILIO_DEFAULT_AREA_CODES / TWILIO_DEFAULT_REGION, searched business-address ZIP → brand area code → defaults → region), so every provisioned number is A2P-eligible.' },
            ],
          },
          { t: 'callout', tone: 'warn', body: 'Carrier approval takes days — do this early. Until a number’s registration is approved, owner SMS silently fails with error 30034 (call logging still works).' },
          { t: 'callout', tone: 'info', body: 'Consent proof: every opt-in and opt-out is stored with timestamp, IP, user agent, and a hash of the exact wording shown. Look it up with GET /api/ops/sms-consent?phone=+1… (x-ops-secret header) on the agency site.' },
          { t: 'link', label: 'Twilio A2P 10DLC', href: 'https://console.twilio.com/us1/develop/sms/regulatory-compliance/a2p-10dlc' },
        ],
      },
    ],
  },
  {
    id: 'a-portal',
    title: 'Client portal master setup',
    subtitle: 'In the agency repo (juneau-digital-designs/.env).',
    steps: [
      {
        id: 'a-portal-setup',
        title: 'Clerk · Vercel Web Analytics · PageSpeed · Upstash',
        why: 'The portal (route /portal) is configured by the agency repo’s env — set these once for all clients.',
        blocks: [
          {
            t: 'substeps',
            items: [
              { text: 'Clerk: create an application; set CLERK_SECRET_KEY + NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY (and sign-in URL vars). The same CLERK_SECRET_KEY also goes in jdd-ops/.env for step 10.' },
              { text: 'Vercel API: set VERCEL_TOKEN and VERCEL_TEAM_ID in the agency repo’s .env.local AND on its Vercel project. These power the Traffic tab (Web Analytics API) and the Overview health strip (deployments + domains). Without them the Traffic tab returns “We couldn’t load this” on a perfectly healthy client — this outage already happened. Note Vercel has no read-only tokens: project-scoped ones deny team-level resources, so a team-scoped token is required.' },
              { text: 'PAGESPEED_API_KEY — PageSpeed Insights API key (still Google; one global key powers the Performance tab).' },
              { text: 'Upstash Redis: provision (Vercel → Storage) and confirm the env names match Redis.fromEnv() (UPSTASH_REDIS_REST_URL/_TOKEN).' },
              { text: 'AIRTABLE_API_KEY — the same JDD key; the portal reads each client’s Call Log.' },
            ],
          },
          { t: 'env', file: 'juneau-digital-designs/.env', vars: [
            { key: 'CLERK_SECRET_KEY + NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', value: 'Clerk app (auth for /portal)' },
            { key: 'VERCEL_TOKEN + VERCEL_TEAM_ID', value: 'team-scoped token — Traffic tab + Overview health strip. Required, not optional.' },
            { key: 'PAGESPEED_API_KEY', value: 'PageSpeed Insights — score + CrUX real-user field data' },
            { key: 'AIRTABLE_API_KEY', value: 'same JDD key — reads each client Call Log' },
            { key: 'UPSTASH_REDIS_REST_URL + _TOKEN', value: 'cache + rate-limit (Redis.fromEnv())' },
          ] },
          {
            t: 'callout',
            tone: 'info',
            body: 'Set VERCEL_TOKEN + VERCEL_TEAM_ID once here; per client you just flip on Web Analytics for that project (portal phase). No GA4 property, site tag, or service-account grant per client.',
          },
        ],
      },
    ],
  },
  ];
}

export const PLAN_LABEL: Record<Plan, string> = {
  starter: 'Starter',
  growth: 'Growth',
  enterprise: 'Enterprise',
};
