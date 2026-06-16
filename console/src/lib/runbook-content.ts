// Canonical per-client runbook content, as data. Mirrors ops/jdd-ops/RUNBOOK.md and
// interpolates each client's real values (slug, plan, env IDs, canonical). Pure function
// of ClientContext so it is safe to run on the client. One source of truth for the guide.

import type { ClientContext, OpsConfig, Plan, SiteInfo } from './types';

export type Block =
  | { t: 'text'; body: string }
  | { t: 'callout'; tone: 'info' | 'warn' | 'danger'; body: string }
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
  | { t: 'link'; label: string; href: string };

export interface Step {
  id: string;
  title: string;
  why?: string;
  est?: string;
  auto?: boolean; // performed automatically by onboard.js (shown for context, not a manual to-do)
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
    plan: ctx.plan,
    canonical: primary?.canonical ?? 'https://REPLACE_WITH_LIVE_URL',
    airtableBaseId:
      ctx.plan === 'starter' ? null : primary?.env.AIRTABLE_BASE_ID ?? 'appREPLACE_FROM_ENV_LOCAL',
    ga4PropertyId: 'properties/REPLACE_WITH_GA4_PROPERTY_ID',
  };
  if (ctx.isEnterprise) {
    base.sites = ctx.sites.map((s) => ({
      slug: s.slug,
      canonical: s.canonical ?? 'https://REPLACE_WITH_LIVE_URL',
      ga4PropertyId: 'properties/REPLACE_WITH_GA4_PROPERTY_ID',
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
        title: 'Launch onboard.js',
        why: 'One command stands up the whole stack: GitHub repo, schema, build, Vercel deploy — plus (Growth/Enterprise) the Retell agent, phone number, Airtable base, Make Data Store row, and the Clerk portal user.',
        blocks: [
          {
            t: 'substeps',
            items: [
              { text: 'In the launch panel above, leave Dry run ON and click “Run dry run”.', detail: 'Rehearses all 10 steps — hits no APIs, writes no files.' },
              { text: 'Read the streamed log to the end. It should reach [step 10/10] and print an ONBOARDED summary with no FAIL / ✗ lines.' },
              { text: 'Flip the Dry run toggle OFF, click “Provision for real”, and confirm in the modal.' },
              { text: 'Watch the summary for the repo URL' + (voice ? ', Retell agent id, phone number, Airtable base,' : ' and') + ' Clerk user id.' },
            ],
          },
          { t: 'cmd', command: `npm run onboard -- --schema ${ctx.schemaPath}`, cwd: 'jdd-ops/', note: 'the launch panel runs this for you; shown for reference' },
          {
            t: 'context',
            label: 'GitHub repo it creates',
            from: 'auto-created by onboard step 2',
            to: `github.com/${org}/${ctx.slug}`,
            value: `https://github.com/${org}/${ctx.slug}`,
          },
          {
            t: 'callout',
            tone: 'info',
            body: 'Step 8 buys a JDD-owned Twilio number and points its voiceUrl at /api/voice on the client site — inbound calls ring the client’s real phone first (25s, set by CLIENT_FORWARD_RING_SECONDS), then fall back to the Retell agent over SIP. The number is saved as TWILIO_NUMBER (also the Make scenario’s from_number). Full chain in the Voice agent phase.',
          },
          {
            t: 'callout',
            tone: 'info',
            body: 'Step 10 auto-creates the Clerk portal user (needs CLERK_SECRET_KEY in jdd-ops/.env) with slug, plan, canonical, airtableBaseId — and ga4PropertyId: null. You set GA4 later via --set-ga4 in the portal phase.',
          },
          {
            t: 'callout',
            tone: 'warn',
            body: 'If a step FAILs: fix the cause in jdd-ops/.env and re-run. onboard.js is idempotent — it reuses already-provisioned IDs from .env.local, so re-runs won’t double-charge or duplicate resources.',
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
      {
        t: 'substeps',
        items: [
          { text: 'A customer dials the Twilio number → Twilio POSTs to /api/voice on the deployed client site.', detail: 'voiceUrl is set to https://{slug}.vercel.app/api/voice at number-purchase time — the .vercel.app URL stays live permanently, so a custom domain later needs no change.' },
          { text: '/api/voice normalizes CLIENT_FORWARD_PHONE to E.164 and returns <Dial timeout="25"> to the client’s real phone.', detail: 'The 25s ring window is set by CLIENT_FORWARD_RING_SECONDS in .env.local — change that env var (no code edit) to tune it per client.' },
          { text: 'If the client answers within 25s → normal connected call, the AI never engages.' },
          { text: 'If no-answer / busy / failed → /api/voice/no-answer calls Retell POST /v2/register-phone-call (Bearer RETELL_API_KEY) and gets back a call_id.' },
          { text: 'It then returns <Dial><Sip>sip:{call_id}@{RETELL_SIP_DOMAIN}</Sip></Dial> — Twilio connects the caller to the Retell agent over SIP.', detail: 'RETELL_SIP_DOMAIN defaults to sip.retellai.com. No bridge server, no Twilio SIP trunk, no number import needed — plain outbound <Dial><Sip> works out of the box.' },
        ],
      },
      ...ctx.sites.map((s): Block => {
        const num = envVal(s.env.TWILIO_NUMBER, '+1… (provision first)');
        const forward = envVal(s.env.CLIENT_FORWARD_PHONE, 'client’s real phone (from brand.phone)');
        const agent = envVal(s.env.RETELL_AGENT_ID, 'agent_… (provision first)');
        return {
          t: 'fields',
          caption: ctx.isEnterprise ? `Routing for ${s.brandName}:` : 'This client’s routing chain:',
          rows: [
            { label: 'Customers dial — TWILIO_NUMBER', value: num.value, pending: num.pending },
            { label: 'Rings first, 25s — CLIENT_FORWARD_PHONE', value: forward.value, pending: forward.pending },
            { label: 'AI fallback on no-answer (SIP) — RETELL_AGENT_ID', value: agent.value, pending: agent.pending },
          ],
        };
      }),
      {
        t: 'callout',
        tone: 'danger',
        body: 'Do NOT import this Twilio number into the Retell dashboard or set up SIP trunking there. A Retell-managed / SIP-trunked number bypasses /api/voice entirely, which kills the human-first ring (calls go straight to the AI). The number must stay JDD/Twilio-owned with its voiceUrl pointed at /api/voice — onboard.js sets this automatically.',
      },
      {
        t: 'callout',
        tone: 'info',
        body: '/api/voice/no-answer needs RETELL_API_KEY and RETELL_SIP_DOMAIN at runtime to register the call and build the SIP URI. onboard.js writes both into .env.local and Vercel sync pushes them — no manual step. If the AI leg 500s after the ring, confirm RETELL_API_KEY exists on the Vercel project.',
      },
      {
        t: 'callout',
        tone: 'warn',
        body: 'Routing only works once the client repo is deployed to Vercel with env synced — Twilio must reach /api/voice at the .vercel.app URL (local dev gets no Twilio webhooks without a tunnel). To change the ring window, set CLIENT_FORWARD_RING_SECONDS in .env.local and re-sync (no code edit).',
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
              t: 'callout',
              tone: 'info',
              body: 'You should hear: a warm greeting with the exact business name, FAQ answers drawn only from the intake, pricing deferred to the owner, and the agent collecting name + callback number.',
            },
          ],
        };
      }),
      {
        id: 'post-call-webhook',
        title: 'Wire each agent’s post-call webhook',
        why: 'This is what fills the Airtable Call Log (and therefore the portal Calls tab). onboard.js creates the agent but does NOT set this — it must be done by hand, once per agent.',
        blocks: [
          {
            t: 'callout',
            tone: 'warn',
            body: 'Manual step, easy to forget. Until it’s set, calls happen but nothing logs — the Calls tab stays empty.',
          },
          {
            t: 'substeps',
            items: [
              { text: 'Retell dashboard → Agents → select this client’s agent (match the agent id from .env.local).' },
              { text: 'Open the agent’s Settings / configuration panel.' },
              { text: 'Find the “Post-call webhook URL” (a.k.a. Webhook URL) field.' },
              { text: 'Paste the URL below and Save.' },
            ],
          },
          { t: 'nav', app: 'Retell', path: ['Agents', '{agent}', 'Settings', 'Post-call webhook URL'] },
          {
            t: 'context',
            label: 'Post-call webhook URL',
            from: config.retellPostCallWebhookUrl
              ? 'jdd-ops/.env → RETELL_POST_CALL_WEBHOOK_URL (set in one-time Part A)'
              : 'jdd-ops/.env → RETELL_POST_CALL_WEBHOOK_URL (set it up in one-time Part A first)',
            to: 'the Retell agent’s Post-call webhook URL field',
            value: config.retellPostCallWebhookUrl,
            example: 'https://hook.us2.make.com/…',
            pending: !config.retellPostCallWebhookUrl,
          },
          {
            t: 'callout',
            tone: 'info',
            body: 'You should see: after a test call ends, a green run in the jdd-post-call-log Make scenario and a new row in the client’s Airtable Call Log within ~30s.',
          },
        ],
      },
    ],
  };
}

function callbackStepsForSite(ctx: ClientContext, s: SiteInfo, i: number): Step[] {
  const num = envVal(s.env.TWILIO_NUMBER, '+1… (provision first)');
  const agent = envVal(s.env.RETELL_AGENT_ID, 'agent_… (provision first)');
  const webhook = envVal(s.env.MAKE_WEBHOOK_URL, 'https://hook.us1.make.com/… (your clone’s URL)');
  const slugForCmd = ctx.isEnterprise ? `${ctx.slug}/site-${i + 1}` : ctx.slug;
  const label = ctx.isEnterprise ? ` (${s.brandName})` : '';
  return [
    {
      id: `clone-scenario-${s.slug}`,
      title: `Clone the outbound master scenario${label}`,
      why: 'Each site needs its own clone — the HTTP module hardcodes this site’s from_number and agent id, so one scenario can serve exactly one site.',
      blocks: [
        {
          t: 'substeps',
          items: [
            { text: 'Make.com → open the outbound master scenario (the deactivated “Lead → Retell” template).' },
            { text: 'Click the ⋯ menu (top-right of the editor) → Clone.' },
            { text: `Rename the clone: “Lead → Retell: ${s.brandShort ?? s.brandName}”.` },
            { text: 'Open the clone’s Webhook trigger (module 1) → Copy address to clipboard. That is this site’s unique webhook URL — keep it for two steps from now.' },
          ],
        },
        { t: 'nav', app: 'Make.com', path: ['master scenario', '⋯', 'Clone'] },
        {
          t: 'context',
          label: 'This clone’s webhook URL',
          from: 'the clone’s Webhook trigger (module 1) → Copy address to clipboard',
          to: 'you’ll paste it into MAKE_WEBHOOK_URL two steps down (“Paste the webhook URL”)',
          example: 'https://hook.us1.make.com/…',
        },
        { t: 'callout', tone: 'info', body: 'You should see: a new scenario in your list, still inactive, with its own webhook URL distinct from the master.' },
      ],
    },
    {
      id: `replace-placeholders-${s.slug}`,
      title: `Replace the HTTP placeholders & activate${label}`,
      why: 'Point the clone at this site’s Retell-provisioned number and agent, then turn it on.',
      blocks: [
        {
          t: 'substeps',
          items: [
            { text: 'In the clone, open the HTTP module (module 2 — “Make a request”).' },
            { text: 'In the Body (raw JSON), replace <<<TWILIO_NUMBER>>> with the number below (paste only the value, no angle brackets).' },
            { text: 'Replace <<<RETELL_AGENT_ID>>> with the agent id below.' },
            { text: 'Save the module, then toggle the scenario Active (switch, bottom-left of the editor).' },
          ],
        },
        {
          t: 'fields',
          caption: `Copy each value (from clients/${slugForCmd}/.env.local) into the clone’s HTTP module Body:`,
          rows: [
            { label: '<<<TWILIO_NUMBER>>>', value: num.value, pending: num.pending },
            { label: '<<<RETELL_AGENT_ID>>>', value: agent.value, pending: agent.pending },
          ],
        },
        { t: 'callout', tone: 'warn', body: 'Gotcha: don’t leave any < or > brackets. A leftover placeholder makes Retell’s create-phone-call 4xx and the callback silently never fires.' },
      ],
    },
    {
      id: `wire-webhook-env-${s.slug}`,
      title: `Paste the webhook URL & sync to Vercel${label}`,
      why: 'The deployed /api/contact route reads MAKE_WEBHOOK_URL to know where to POST each lead.',
      blocks: [
        {
          t: 'substeps',
          items: [
            { text: `Open clients/${slugForCmd}/.env.local.` },
            { text: 'Set MAKE_WEBHOOK_URL to the clone’s webhook URL you copied.' },
            { text: 'Run the sync command below to push it to the Vercel project.' },
            { text: 'Redeploy so the live site picks up the new env (push any commit, or Vercel → Deployments → ⋯ → Redeploy).' },
          ],
        },
        {
          t: 'context',
          label: 'Make webhook URL',
          from: 'the clone’s Webhook trigger → Copy address (from the “Clone…” step above)',
          to: `clients/${slugForCmd}/.env.local → MAKE_WEBHOOK_URL`,
          value: webhook.pending ? undefined : webhook.value,
          example: 'https://hook.us1.make.com/…',
          pending: webhook.pending,
        },
        { t: 'env', file: `clients/${slugForCmd}/.env.local`, vars: [{ key: 'MAKE_WEBHOOK_URL', value: webhook.value, note: 'the clone’s webhook URL', pending: webhook.pending }] },
        { t: 'cmd', command: `npm run sync-env -- --slug ${slugForCmd}`, cwd: 'jdd-ops/' },
      ],
    },
    {
      id: `checkpoint-3-${s.slug}`,
      title: `Checkpoint 3 — live end-to-end test${label}`,
      est: '~15 min',
      why: 'Proves the whole chain: form → Make → Retell callback → Airtable log.',
      blocks: [
        {
          t: 'substeps',
          items: [
            { text: 'On the deployed site, submit the lead form with your own phone number.' },
            { text: 'Within ~60s the agent should call you back with this brand’s greeting.' },
            { text: 'After you hang up, confirm a new row appears in the client’s Airtable Call Log.' },
          ],
        },
        {
          t: 'callout',
          tone: 'info',
          body: 'If nothing in 90s, walk the chain: Vercel /api/contact logs (200 vs 500) → Make clone History (did the webhook fire? did the Retell request succeed?) → Retell outbound call logs → the jdd-post-call-log scenario → the Airtable row.',
        },
      ],
    },
  ];
}

function callbackPhase(ctx: ClientContext): Phase {
  return {
    id: 'callback',
    title: 'Lead-callback (Make)',
    subtitle: ctx.isEnterprise ? 'Clone the outbound scenario once per site.' : 'Wire the form → callback automation.',
    steps: ctx.sites.flatMap((s, i) => callbackStepsForSite(ctx, s, i)),
  };
}

function portalPhase(ctx: ClientContext, config: OpsConfig): Phase {
  const steps: Step[] = [];

  ctx.sites.forEach((s) => {
    const label = ctx.isEnterprise ? ` (${s.brandName})` : '';
    steps.push({
      id: `ga4-property-${s.slug}`,
      title: `Create the GA4 property${label}`,
      why: 'The portal’s Traffic tab reads GA4 by Property ID. Enterprise gets one property per site. This step produces two IDs that later steps consume.',
      blocks: [
        {
          t: 'substeps',
          items: [
            { text: 'Google Analytics → Admin → Create Property. Name it for the client (and site, if Enterprise).' },
            { text: 'Set up a Web data stream pointing at the live site URL.' },
            { text: 'Copy the Measurement ID (G-XXXXXXX) — this tags the site.' },
            { text: 'Open Admin → Property Settings → copy the numeric Property ID, and prefix it: properties/123456789 — this goes in the portal.' },
          ],
        },
        { t: 'nav', app: 'Google Analytics', path: ['Admin', 'Create Property', 'Web data stream'] },
        {
          t: 'context',
          label: 'Measurement ID → feeds “Tag the client site”',
          from: 'GA → the Web data stream you just created',
          to: 'the next step (NEXT_PUBLIC_GA_MEASUREMENT_ID)',
          example: 'G-XXXXXXX',
        },
        {
          t: 'context',
          label: 'Property ID → feeds “Set the GA4 Property ID”',
          from: 'GA → Admin → Property Settings → Property ID',
          to: 'the --set-ga4 command (with a properties/ prefix)',
          example: 'properties/123456789',
        },
        { t: 'callout', tone: 'warn', body: 'Two different IDs, don’t mix them: the Measurement ID (G-…) tags the website; the Property ID (properties/…) goes into the portal user.' },
        { t: 'link', label: 'Open Google Analytics', href: 'https://analytics.google.com' },
      ],
    });
  });

  steps.push({
    id: 'tag-site',
    title: 'Tag the client site with GA4',
    why: 'Without the measurement tag the property collects nothing and the Traffic tab stays empty — a property alone is not enough.',
    blocks: [
      { t: 'callout', tone: 'warn', body: 'Required — the exported site is NOT GA4-tagged by default (known template gap). Until the template ships a GA component, add it per client.' },
      {
        t: 'substeps',
        items: [
          { text: `Add NEXT_PUBLIC_GA_MEASUREMENT_ID=G-… to the client repo’s env (and on Vercel).` },
          { text: 'Ensure a GA component renders it in the layout (e.g. @next/third-parties GoogleAnalytics) — add it if the template doesn’t yet.' },
          { text: 'Commit + redeploy.' },
          { text: 'Visit the live site, then check GA4 → Reports → Realtime. You should see your own visit within ~30s.' },
        ],
      },
      {
        t: 'context',
        label: 'GA4 Measurement ID',
        from: 'the GA4 Web data stream (captured in “Create the GA4 property”)',
        to: `two places: clients/${ctx.slug}/repo .env AND the Vercel project → Settings → Environment Variables, as NEXT_PUBLIC_GA_MEASUREMENT_ID`,
        example: 'G-XXXXXXX',
      },
      { t: 'env', file: `clients/${ctx.slug}/repo/.env.local`, vars: [{ key: 'NEXT_PUBLIC_GA_MEASUREMENT_ID', value: 'G-XXXXXXX', note: 'from the GA4 data stream', pending: true }] },
    ],
  });

  steps.push({
    id: 'grant-service-account',
    title: 'Grant the JDD service account access',
    why: 'The portal reads GA4 server-side using a Google service account; it must be a Viewer on each property or every Traffic call 403s.',
    blocks: [
      {
        t: 'substeps',
        items: [
          { text: 'Google Analytics → Admin → Property Access Management (for this property).' },
          { text: 'Click + (top-right) → Add users.' },
          { text: 'Paste the service account email (below).' },
          { text: 'Set role to Viewer, untick “Notify new users by email”, then Add.' },
        ],
      },
      { t: 'nav', app: 'Google Analytics', path: ['Admin', 'Property Access Management', '+', 'Add users'] },
      {
        t: 'context',
        label: 'Service account email',
        from: config.serviceAccountEmail
          ? 'GOOGLE_SERVICE_ACCOUNT_KEY → client_email (juneau-digital-designs/.env)'
          : 'the client_email field inside GOOGLE_SERVICE_ACCOUNT_KEY in juneau-digital-designs/.env (set it up in Part A first)',
        to: 'GA → Admin → Property Access Management → Add users, as a Viewer',
        value: config.serviceAccountEmail,
        example: 'jdd-portal@project.iam.gserviceaccount.com',
        pending: !config.serviceAccountEmail,
      },
      { t: 'callout', tone: 'info', body: 'Skip this and the Traffic tab returns a permission error even with a correct Property ID set.' },
    ],
  });

  steps.push({
    id: 'set-ga4',
    title: 'Set the GA4 Property ID on the portal user',
    why: 'onboard.js step 10 created the Clerk user with ga4PropertyId: null. This one command fills it in — no Clerk dashboard editing.',
    blocks: [
      {
        t: 'callout',
        tone: 'info',
        body: 'The Clerk portal user already exists (CLERK_USER_ID is in this client’s .env.local). You only need to attach the GA4 property.',
      },
      {
        t: 'context',
        label: 'GA4 Property ID',
        from: 'Google Analytics → Admin → Property Settings → Property ID (the number you copied in “Create the GA4 property”)',
        to: 'replace properties/REPLACE_WITH_PROPERTY_ID in the command below — keep the properties/ prefix',
        example: 'properties/123456789',
      },
      {
        t: 'substeps',
        items: [
          { text: 'Swap the placeholder for your real Property ID (with the properties/ prefix).' },
          { text: 'Run the command in your terminal from the jdd-ops folder.' },
          { text: 'It prints the updated Clerk user id and a reminder to grant the service account (previous step).' },
        ],
      },
      { t: 'cmd', command: `npm run onboard -- --slug ${ctx.slug} --set-ga4 properties/REPLACE_WITH_PROPERTY_ID`, cwd: 'jdd-ops/' },
      ...(ctx.isEnterprise
        ? ([
            {
              t: 'callout',
              tone: 'warn',
              body: '--set-ga4 currently sets only the top-level property. For Enterprise per-site GA4, edit each site’s ga4PropertyId under publicMetadata.sites[] in the Clerk dashboard until the --site flag lands.',
            } as Block,
          ])
        : []),
      { t: 'json', label: 'publicMetadata shape (onboard set this; --set-ga4 fills ga4PropertyId)', json: clerkMetadataJson(ctx) },
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
          { text: 'Confirm all relevant tabs load with data: Traffic (GA4), Performance (PageSpeed)' + (ctx.plan === 'starter' ? '.' : ', and Calls (Airtable).') },
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
              { text: 'MAKE_API_KEY + MAKE_DATA_STORE_ID + RETELL_POST_CALL_WEBHOOK_URL — from the Make setup below.' },
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
    id: 'a-make-out',
    title: 'Outbound master Make scenario',
    subtitle: 'Built once, cloned per client.',
    steps: [
      {
        id: 'a-make-out-build',
        title: 'Build the lead-callback master scenario',
        why: 'The template every per-client clone is made from. The master itself never runs.',
        blocks: [
          {
            t: 'substeps',
            items: [
              { text: 'Make.com → Create a new scenario.' },
              { text: 'Module 1: Webhooks → Custom webhook. Run once and POST a test lead payload so Make learns the body shape.' },
              { text: 'Module 2: HTTP → Make a request. URL https://api.retellai.com/v2/create-phone-call, method POST.' },
              { text: 'Headers: Authorization: Bearer <RETELL_API_KEY> (real key — clones inherit it) and Content-Type: application/json.' },
              { text: 'Body type Raw → JSON, using the body below with the placeholders kept literal.' },
              { text: 'Save, then Deactivate the master (bottom-left). Only clones run.' },
            ],
          },
          {
            t: 'json',
            label: 'HTTP body (placeholders stay literal in the master)',
            json: JSON.stringify({ from_number: '<<<TWILIO_NUMBER>>>', to_number: '{{1.phone}}', override_agent_id: '<<<RETELL_AGENT_ID>>>' }, null, 2),
          },
        ],
      },
    ],
  },
  {
    id: 'a-make-post',
    title: 'Post-call logging scenario + Data Store',
    subtitle: 'Shared (not cloned). Fills Airtable Call Log.',
    steps: [
      {
        id: 'a-make-post-build',
        title: 'Build retell-agent-lookup + jdd-post-call-log',
        why: 'Routes every completed call to the right client’s Airtable base by agent id — the data behind the portal Calls tab.',
        blocks: [
          {
            t: 'substeps',
            items: [
              { text: 'Make.com → Data stores → Create a data store named retell-agent-lookup with fields base_id, client_name, table_name.' },
              { text: 'Copy its numeric ID into jdd-ops/.env as MAKE_DATA_STORE_ID. (onboard.js step 8c adds one row per Growth/Enterprise client automatically.)' },
              { text: 'Create scenario jdd-post-call-log. Module 1: Custom webhook → copy its URL into .env as RETELL_POST_CALL_WEBHOOK_URL; Run once and POST a sample call_ended payload.' },
              { text: 'Module 2: Data store → Get a record, store retell-agent-lookup, key {{1.agent_id}}.' },
              { text: 'Module 3: Airtable → Create a Record, Base ID {{2.base_id}}, table Call Log; map Date / Caller name / Caller number / Summary / Duration / Call type / Outcome.' },
              { text: 'Add a Resume error handler on module 2 (so an unknown agent_id doesn’t halt it), then Activate.' },
            ],
          },
          {
            t: 'context',
            label: 'Data Store ID',
            from: 'Make → Data stores → retell-agent-lookup → the numeric ID in the URL',
            to: 'jdd-ops/.env → MAKE_DATA_STORE_ID (so step 8c can auto-register agents)',
            value: config.makeDataStoreId,
            example: '123456',
            pending: !config.makeDataStoreId,
          },
          {
            t: 'context',
            label: 'Post-call webhook URL',
            from: 'the jdd-post-call-log scenario’s Custom webhook → Copy address',
            to: 'jdd-ops/.env → RETELL_POST_CALL_WEBHOOK_URL (and onto each Retell agent later)',
            value: config.retellPostCallWebhookUrl,
            example: 'https://hook.us2.make.com/…',
            pending: !config.retellPostCallWebhookUrl,
          },
          { t: 'callout', tone: 'info', body: 'Exact field expressions are in retell-post-call-airtable-plan.md (repo root).' },
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
        title: 'Clerk · Google service account · PageSpeed · Upstash',
        why: 'The portal (route /portal) is configured by the agency repo’s env — set these once for all clients.',
        blocks: [
          {
            t: 'substeps',
            items: [
              { text: 'Clerk: create an application; set CLERK_SECRET_KEY + NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY (and sign-in URL vars). The same CLERK_SECRET_KEY also goes in jdd-ops/.env for step 10.' },
              { text: 'Google Cloud: create a service account, enable the Google Analytics Data API, download its JSON key into GOOGLE_SERVICE_ACCOUNT_KEY. Note the service account email.' },
              { text: 'PAGESPEED_API_KEY — PageSpeed Insights API key.' },
              { text: 'Upstash Redis: provision (Vercel → Storage) and confirm the env names match Redis.fromEnv() (UPSTASH_REDIS_REST_URL/_TOKEN).' },
              { text: 'AIRTABLE_API_KEY — the same JDD key; the portal reads each client’s Call Log.' },
            ],
          },
          { t: 'env', file: 'juneau-digital-designs/.env', vars: [
            { key: 'CLERK_SECRET_KEY + NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', value: 'Clerk app (auth for /portal)' },
            { key: 'GOOGLE_SERVICE_ACCOUNT_KEY', value: 'service account JSON; enable GA4 Data API' },
            { key: 'PAGESPEED_API_KEY', value: 'PageSpeed Insights' },
            { key: 'AIRTABLE_API_KEY', value: 'same JDD key — reads each client Call Log' },
            { key: 'UPSTASH_REDIS_REST_URL + _TOKEN', value: 'cache + rate-limit (Redis.fromEnv())' },
          ] },
          {
            t: 'context',
            label: 'Service account email',
            from: config.serviceAccountEmail ? 'GOOGLE_SERVICE_ACCOUNT_KEY → client_email' : 'the client_email field inside the GOOGLE_SERVICE_ACCOUNT_KEY JSON',
            to: 'you grant it Viewer on every client GA4 property (portal phase)',
            value: config.serviceAccountEmail,
            example: 'jdd-portal@project.iam.gserviceaccount.com',
            pending: !config.serviceAccountEmail,
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
