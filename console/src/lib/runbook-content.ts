// Canonical per-client runbook content, as data. Mirrors ops/jdd-ops/RUNBOOK.md and
// interpolates each client's real values (slug, plan, env IDs, canonical). Pure function
// of ClientContext so it is safe to run on the client. One source of truth for the guide.

import type { ClientContext, OpsConfig, Plan, SiteInfo } from './types';

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
  // Success criteria: what you should observe if the step worked. Previously written as a
  // trailing "You should see: …" info callout, which read as advice rather than a check.
  | { t: 'verify'; title?: string; items: { text: string; detail?: string }[] };

/**
 * Which blocks break out of the stage's prose column.
 *
 * The stage is a reading column (~70ch) because that's what body text needs. Diagrams are not
 * text and were being squeezed into it — that's what clipped them. One place decides, so the
 * two stages can't disagree.
 */
export function isWideBlock(b: Block): boolean {
  return b.t === 'diagram';
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
      ctx.plan === 'starter' ? null : primary?.env.AIRTABLE_BASE_ID ?? 'appREPLACE_FROM_ENV_LOCAL',
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
function provisionPhase(ctx: ClientContext, config: OpsConfig): Phase {
  const primary = ctx.sites[0];
  const proj = envVal(primary?.env.VERCEL_PROJECT_NAME, ctx.slug);
  const voice = ctx.plan !== 'starter';
  const org = config.githubOrg ?? 'GITHUB_ORG';
  return {
    id: 'provision',
    title: 'Provision & preview',
    subtitle: 'Run the orchestrator, then confirm the site renders.',
    steps: [
      {
        id: 'run-onboard',
        launch: true,
        title: 'Launch onboard.js',
        why: 'One command stands up the whole stack: GitHub repo, schema, build, Vercel deploy — plus (Growth/Enterprise) the Retell agent, phone number, Airtable base, Make Data Store row, and the Clerk portal user.',
        blocks: [
          // The step-by-step "click dry run, then click provision" instructions used to live
          // here. They're gone: the launch screen IS those instructions, and a checklist that
          // narrates the button next to it is the exact "dump of info" this redesign removes.
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
      {
        id: 'checkpoint-1',
        title: 'Checkpoint 1 — review the deployed site',
        est: '~15 min',
        why: 'Confirm the live build renders with real brand content before wiring anything else.',
        blocks: [
          {
            t: 'context',
            label: 'Vercel project',
            from: 'the ONBOARDED summary onboard.js printed (step 9), or the Vercel dashboard',
            to: 'open it in Vercel → Deployments → Production → Visit',
            value: proj.pending ? undefined : proj.value,
            example: ctx.slug,
            pending: proj.pending,
          },
          {
            t: 'substeps',
            items: [
              { text: 'Open the Vercel project (name above) → Deployments → the latest Production deploy → Visit.' },
              { text: 'Confirm the hero, services, and contact form show this client’s real copy — not “TODO” placeholders.', detail: 'Placeholders mean the intake (site.ts) still has unfilled fields.' },
              { text: 'Tab through the page on mobile width; check the nav and footer render.' },
            ],
          },
          { t: 'nav', app: 'Vercel', path: ['Project', 'Deployments', 'Production', 'Visit'] },
          { t: 'link', label: 'Open Vercel dashboard', href: 'https://vercel.com/dashboard' },
          ...(ctx.plan === 'starter'
            ? ([
                {
                  t: 'callout',
                  tone: 'info',
                  body: `Starter has no voice agent or Make scenario. Submit the contact form with a test message and confirm the lead email lands at ${primary?.env.LEAD_DELIVERY_MODE ? 'the brand inbox' : (primary?.brandName ?? 'the brand') + '’s inbox'} (Resend).`,
                } as Block,
              ])
            : []),
        ],
      },
    ],
  };
}

function voicePhase(ctx: ClientContext, config: OpsConfig): Phase {
  const routingStep: Step = {
    id: 'call-routing',
    title: 'How inbound calls route (human-first → AI fallback over SIP)',
    auto: true,
    why: 'onboard.js (step 8) and the site template wire this automatically — there is no manual Twilio or Retell console step for routing. Understand it before you test-call: the Retell agent only answers when the client misses the call.',
    blocks: [
      // The 5-step substeps list and the per-site `fields` table that used to sit here are
      // both gone — the diagram carries the sequence AND binds the same three env values, so
      // keeping either would print every number on this screen twice.
      ...ctx.sites.map((s): Block => ({ t: 'diagram', kind: 'call-routing', siteSlug: s.slug })),
      {
        t: 'callout',
        tone: 'danger',
        title: 'Never import this number into Retell',
        body: 'A Retell-managed / SIP-trunked number bypasses /api/voice entirely, which kills the human-first ring — every call would go straight to the AI. The number must stay JDD/Twilio-owned with its voiceUrl pointed at /api/voice, which onboard.js sets automatically.',
      },
      {
        t: 'callout',
        tone: 'warn',
        title: 'Only works once deployed',
        body: 'Twilio has to reach /api/voice at the .vercel.app URL, so routing is dead until the repo is deployed with env synced (local dev gets no Twilio webhooks without a tunnel). To change the ring window, set CLIENT_FORWARD_RING_SECONDS in .env.local and re-sync — no code edit.',
      },
      {
        t: 'callout',
        tone: 'info',
        title: 'If the AI leg 500s after the ring',
        body: '/api/voice/no-answer needs RETELL_API_KEY and RETELL_SIP_DOMAIN at runtime to register the call and build the SIP URI. onboard.js writes both and Vercel sync pushes them — so if it fails, confirm RETELL_API_KEY actually exists on the Vercel project.',
      },
    ],
  };
  return {
    id: 'voice',
    title: 'Voice agent',
    subtitle: 'Understand call routing, tune each agent, then wire post-call logging.',
    steps: [
      routingStep,
      ...ctx.sites.map((s, i): Step => {
        const agent = envVal(s.env.RETELL_AGENT_ID, 'agent_… (provision first)');
        const num = envVal(s.env.TWILIO_NUMBER, '+1… (provision first)');
        const slugForCmd = ctx.isEnterprise ? `${ctx.slug}/site-${i + 1}` : ctx.slug;
        return {
          id: `checkpoint-2-${s.slug}`,
          site: s.slug,
          title: ctx.isEnterprise ? `Checkpoint 2 — test-call & tune (${s.brandName})` : 'Checkpoint 2 — test-call & tune the agent',
          est: '~20 min',
          why: 'Hear the greeting and qualifying flow on a real call, fix anything wrong in the prompt, and re-upload.',
          blocks: [
            { t: 'copy', label: 'Call this number', value: num.value, pending: num.pending },
            {
              t: 'substeps',
              items: [
                { text: 'To reach the AI, call the number from a phone that is NOT the client’s, and let the client’s real phone go unanswered for ~25s — only then does the agent pick up (human-first routing). Confirm the greeting names the business correctly.', detail: 'Answering the client’s phone within the ring window (CLIENT_FORWARD_RING_SECONDS, default 25s) connects a normal call and the AI never engages — see “How inbound calls route”.' },
                { text: 'Run a fake lead: ask about a service, give a name and a callback number, mention a timeline.' },
                { text: 'Note anything off — wrong hours, missing services, awkward phrasing, quoting a price (it should never quote prices).' },
                { text: `Edit the prompt at clients/${slugForCmd}/agent-prompt.txt to fix it.` },
                { text: 'Re-upload with the command below, then call again to confirm.' },
              ],
            },
            {
              t: 'context',
              label: 'Agent prompt file',
              from: `generated by onboard step 6 → clients/${slugForCmd}/agent-prompt.txt`,
              to: 'edit it, then re-upload with the command below',
              example: 'plain-text system prompt',
            },
            { t: 'cmd', command: `npm run update-prompt -- ${agent.value} --slug ${slugForCmd}`, cwd: 'jdd-ops/' },
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
      // The old `post-call-webhook` reference step lived here. It and `postcall-auto-{slug}`
      // (in the Post-call phase) both said "confirm the webhook URL matches" — two rail rows
      // per site for one fact. Merged into the latter, which is where the per-client values
      // already were. At enterprise N=3 that's three fewer near-duplicate rows.
    ],
  };
}

function callbackStepsForSite(ctx: ClientContext, s: SiteInfo, i: number): Step[] {
  const twilio = envVal(s.env.TWILIO_NUMBER, '+1… (provision first)');
  const owner = envVal(s.env.CLIENT_FORWARD_PHONE, 'the owner number (brand.phone)');
  const ring = s.env.CLIENT_FORWARD_RING_SECONDS ?? '25';
  const slugForCmd = ctx.isEnterprise ? `${ctx.slug}/site-${i + 1}` : ctx.slug;
  const label = ctx.isEnterprise ? ` (${s.brandName})` : '';
  const voiceUrl = `https://${s.slug.replace(/_/g, '-')}.vercel.app/api/voice`;
  const isTollFree = /^\+1(800|833|844|855|866|877|888)/.test(twilio.value);
  return [
    {
      id: `postcall-auto-${s.slug}`,
      site: s.slug,
      title: `Post-call logging + owner SMS (automated)${label}`,
      auto: true,
      why: 'onboard.js cloned the master post-call scenario for this client, pointed its Airtable + Twilio SMS modules at this client, activated it, and set the clone’s webhook on the Retell agent. Nothing to do here unless verification fails.',
      blocks: [
        // The diagram binds the webhook URL, Airtable base, owner number and Twilio number, so
        // the `context` card and the info callout that restated all four are gone.
        { t: 'diagram', kind: 'post-call', siteSlug: s.slug },
        {
          t: 'verify',
          title: 'Two things to confirm',
          items: [
            { text: `Make.com has a scenario “Post-call: ${s.brandName}” and it is Active.` },
            {
              text: 'The Retell agent’s Post-call webhook URL matches the one in the diagram.',
              detail: `Retell → Agents → this client’s agent → Settings. The value is RETELL_POST_CALL_WEBHOOK_URL in clients/${slugForCmd}/.env.local, written by onboard.js.`,
            },
          ],
        },
        { t: 'nav', app: 'Retell', path: ['Agents', '{agent}', 'Settings', 'Post-call webhook URL'] },
      ],
    },
    {
      id: `twilio-sms-reg-${s.slug}`,
      site: s.slug,
      title: `Enable SMS on the Twilio number${label}`,
      why: 'US carriers block outbound SMS from unregistered numbers. Until this number is registered/approved, the owner-notification texts silently fail.',
      blocks: [
        {
          t: 'callout',
          tone: 'warn',
          body: isTollFree
            ? 'This is a TOLL-FREE number → it needs per-number Toll-Free Verification (submit the form; approval ~1–3 weeks). SMS will not deliver until Verified.'
            : 'This is a LOCAL 10DLC number → add it to the JDD A2P Messaging Service (campaign approved once in one-time setup).',
        },
        {
          t: 'substeps',
          items: isTollFree
            ? [
                { text: 'Twilio Console → Messaging → Regulatory Compliance → Toll-Free Verification → Create.' },
                { text: `Select ${twilio.value}; business info; use-case “Customer Care / Notifications”; sample = the owner call-brief SMS. Opt-in = a separate unchecked checkbox beside a mobile-number field on the public agreement page (juneaudigitaldesigns.com/agreement); it is not a condition of purchase, and consent records carry timestamp, IP, and a hash of the wording shown.` },
                { text: 'Submit; status must reach Verified before SMS delivers.' },
              ]
            : [
                { text: 'Twilio Console → Messaging → Services → the JDD Messaging Service → Sender Pool.' },
                { text: `Add ${twilio.value} to the pool so it sends under the approved A2P campaign.` },
              ],
        },
        { t: 'copy', label: 'This site’s /api/voice URL (voice webhook — already set by onboard.js at purchase; paste to re-verify)', value: voiceUrl },
        { t: 'nav', app: 'Twilio', path: ['Phone Numbers', twilio.value, 'Voice Configuration', 'A call comes in → Webhook'] },
      ],
    },
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

function callbackPhase(ctx: ClientContext): Phase {
  return {
    id: 'callback',
    title: 'Post-call logging & SMS (Make)',
    subtitle: ctx.isEnterprise
      ? 'One post-call clone per site (automated); register each number for SMS.'
      : 'Post-call clone is automated; register the number for SMS.',
    steps: ctx.sites.flatMap((s, i) => callbackStepsForSite(ctx, s, i)),
  };
}

function portalPhase(ctx: ClientContext, config: OpsConfig): Phase {
  const steps: Step[] = [];

  steps.push({
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
  });

  steps.push({
    id: 'invite-client',
    title: 'Invite the client & verify',
    why: 'Final handoff — the client signs in and sees their dashboard.',
    blocks: [
      {
        t: 'substeps',
        items: [
          { text: 'Clerk → Users → this client → Send invitation (or copy a sign-in link).' },
          { text: 'Have them sign in at the portal URL below.' },
          { text: 'Confirm all relevant tabs load with data: Traffic (Vercel Web Analytics), Performance (PageSpeed)' + (ctx.plan === 'starter' ? '.' : ', and Calls (Airtable).') },
        ],
      },
      { t: 'nav', app: 'Clerk', path: ['Users', '{client}', 'Send invitation'] },
      {
        t: 'context',
        label: 'Portal sign-in link',
        from: 'send via Clerk → Users → this client → Send invitation',
        to: `the client signs in here`,
        value: config.portalSignInUrl ?? 'https://juneaudigitaldesigns.com/portal/sign-in',
      },
    ],
  });

  return {
    id: 'portal',
    title: 'Client portal',
    subtitle: 'Give the client their performance + call-log dashboard.',
    steps,
  };
}

/** The ordered per-client phases, gated by plan. */
export function buildRunbook(ctx: ClientContext, config: OpsConfig = {}): Phase[] {
  const phases: Phase[] = [provisionPhase(ctx, config)];
  if (ctx.plan !== 'starter') {
    phases.push(voicePhase(ctx, config));
    phases.push(callbackPhase(ctx));
  }
  phases.push(portalPhase(ctx, config));
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
        title: 'Register JDD for outbound SMS (A2P 10DLC / toll-free)',
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
              { text: 'Sender Pool holds the client LOCAL numbers; onboard.js adds each one automatically when TWILIO_MESSAGING_SERVICE_SID is set.' },
              { text: 'Toll-free numbers cannot join the pool — they need per-number Toll-Free Verification instead (onboard.js warns loudly when it falls back to one).' },
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
