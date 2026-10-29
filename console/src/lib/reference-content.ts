// Everything in the onboarding guide you READ rather than DO.
//
// This used to be a step. It sat inside "Test-call the agent" as a non-actionable `auto` step,
// which put a reference page between two checkpoints — you finished the test call, hit Next,
// and landed on a wall of diagrams before the post-call verification you were actually heading
// for. Numbering skipped it, progress ignored it, and it still cost a click each way.
//
// So it is not a step any more. It lives in a panel that opens over the stage from the right
// edge, available on every step and in the way on none, which also means each step in the flow
// is now unambiguously "do this".

import type { Block } from './runbook-content';
import type { ClientContext } from './types';

export interface ReferenceSection {
  id: string;
  title: string;
  /** One line under the tab, saying what you'd open this for. */
  blurb: string;
  blocks: Block[];
}

export function buildReference(ctx: ClientContext): ReferenceSection[] {
  const sections: ReferenceSection[] = [];

  if (!ctx.isWebOnly) {
    sections.push({
      id: 'routing',
      title: 'Call routing',
      blurb: 'How an inbound call reaches the owner first and the agent only on no-answer.',
      blocks: [
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
          title: 'Keep the ring window under ~20 seconds',
          body: 'If the forward rings long enough for the owner’s carrier voicemail to answer, Twilio scores that as answered (DialCallStatus=completed), the no-answer branch never fires, and the caller lands in voicemail instead of the agent. lib/client-env.js clamps CLIENT_FORWARD_RING_SECONDS to 5–20 (default 15), and /api/voice clamps whatever it is handed rather than applying it verbatim.',
        },
        {
          t: 'callout',
          tone: 'warn',
          title: 'Only works once deployed',
          body: 'Twilio has to reach /api/voice at the .vercel.app URL, so routing is dead until the repo is deployed with env synced — local dev gets no Twilio webhooks without a tunnel. To change the ring window, set CLIENT_FORWARD_RING_SECONDS in .env.local and re-sync; no code edit. Note the clamp ships in route code, which only an onboard.js run rewrites — npm run sync-env pushes env, not routes.',
        },
        {
          t: 'callout',
          tone: 'info',
          title: 'If the AI leg 500s after the ring',
          body: '/api/voice/no-answer needs RETELL_API_KEY and RETELL_SIP_DOMAIN at runtime to register the call and build the SIP URI. onboard.js writes both and Vercel sync pushes them — so if it fails, confirm RETELL_API_KEY actually exists on the Vercel project.',
        },
      ],
    });
  }

  sections.push({
    id: 'pipeline',
    title: 'Provisioning pipeline',
    blurb: 'What onboard.js does, in order, and what each step leaves behind.',
    blocks: [
      { t: 'diagram', kind: 'pipeline' },
      {
        t: 'callout',
        tone: 'warn',
        title: 'Re-running is safe',
        body: 'If a step FAILs: fix the cause in jdd-ops/.env and re-run. onboard.js is idempotent — it reuses already-provisioned IDs from .env.local, so re-runs won’t double-charge or duplicate resources.',
      },
      {
        t: 'callout',
        tone: 'info',
        title: 'Order is load-bearing',
        body: 'writeClientEnvLocal runs BEFORE the published-number swap so it captures the owner’s number as the forward target. Mutate brand.phone any earlier and CLIENT_FORWARD_PHONE becomes the Twilio number — /api/voice would then forward to the number that invoked it.',
      },
    ],
  });

  // ── Which value holds what ─────────────────────────────────────────────────
  const idBlocks: Block[] = [
    {
      t: 'callout',
      tone: 'info',
      title: 'Two numbers, two jobs',
      body: 'brand.phone (in src/data/site.ts) holds the JDD Twilio number — what the website shows and what customers dial. CLIENT_FORWARD_PHONE (in .env.local) holds the owner’s real line — where /api/voice forwards on hop 1. Publishing the owner’s number instead is the failure with no error anywhere to find: the receptionist works and is simply never reached.',
    },
  ];
  for (const s of ctx.sites) {
    const vars = [
      ['TWILIO_NUMBER', s.env.TWILIO_NUMBER],
      ['CLIENT_FORWARD_PHONE', s.env.CLIENT_FORWARD_PHONE],
      ['CLIENT_FORWARD_RING_SECONDS', s.env.CLIENT_FORWARD_RING_SECONDS ?? '15'],
      ['RETELL_AGENT_ID', s.env.RETELL_AGENT_ID],
      ['RETELL_LLM_ID', s.env.RETELL_LLM_ID],
      ['AIRTABLE_BASE_ID', s.env.AIRTABLE_BASE_ID],
      ['VERCEL_PROJECT_NAME', s.env.VERCEL_PROJECT_NAME],
      ['LEAD_DELIVERY_MODE', s.env.LEAD_DELIVERY_MODE],
    ] as const;
    idBlocks.push({
      t: 'env',
      file: ctx.isEnterprise ? `clients/${s.slug}/.env.local` : `clients/${ctx.slug}/.env.local`,
      vars: vars
        .filter(([k]) => !ctx.isWebOnly || k === 'VERCEL_PROJECT_NAME' || k === 'LEAD_DELIVERY_MODE')
        .map(([key, value]) => ({
          key,
          value: value ?? 'not provisioned yet',
          pending: !value,
        })),
    });
  }
  sections.push({
    id: 'ids',
    title: 'IDs & env',
    blurb: 'This client’s real values, and which number does which job.',
    blocks: idBlocks,
  });

  if (!ctx.isWebOnly) {
    sections.push({
      id: 'trouble',
      title: 'Troubleshooting',
      blurb: 'Nothing arrived, or the wrong thing did — walk it backwards.',
      blocks: [
        ...ctx.sites.map((s): Block => ({ t: 'diagram', kind: 'post-call', siteSlug: s.slug })),
        {
          t: 'substeps',
          items: [
            { text: 'Retell call log — did the call complete and emit a call_analyzed event?' },
            { text: 'Make → the client’s scenario → History — did the webhook fire, did the filter pass, did any module error?' },
            { text: 'Airtable — an invalid select option fails the WHOLE row, not just that cell.', detail: 'Call type and Priority are lowercase on purpose: the module runs with typecast: false, so “Inbound” is rejected.' },
            { text: 'Twilio → Messaging logs — is the number in the Messaging Service sender pool yet? Otherwise every post-call text fails with 30034.' },
          ],
        },
        {
          t: 'callout',
          tone: 'warn',
          title: 'Three rows per call, two of them empty',
          body: 'The clone’s {{1.event}} = call_analyzed filter was dropped. Without it the scenario logs call_started and call_ended too.',
        },
        {
          t: 'callout',
          tone: 'danger',
          title: 'Calls landing in someone else’s log',
          body: 'The client is wired to a master resource. AIRTABLE_BASE_ID must never be the master base, and the agent’s webhook_url must never be the master scenario’s hook. verifyNoMasterResources refuses at pre-flight for exactly this, because the create steps short-circuit on an existing value and would reuse the master rather than replace it.',
        },
      ],
    });
  }

  return sections;
}
