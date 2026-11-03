// The two Make.com modules an operator must edit by hand on every client, as data.
//
// Deliberately thin at the call site, like `diagram`: the Block is just
// `{ t: 'make-module', siteSlug }` and the whole field model is derived HERE from
// ClientContext. The alternative — restating ten Airtable mappings inside
// runbook-content.ts — put the field list in two places and guaranteed they would drift.
//
// WHY THIS EXISTS AT ALL: onboard.js clones the master post-call scenario per client, but the
// clone carries the master's module settings. Until someone points the Airtable module at this
// client's base and the Twilio module at this client's number, the scenario is wired to
// someone else's resources. Nothing errors — the calls just land in the wrong log.
//
// The column list below is a CONTRACT with the master scenario, not a preference. A column the
// master writes that `createAirtableBase` doesn't create is silently dropped from every logged
// call. Keep it in step with CALL_LOG_FIELDS in jdd-ops and with the Airtable section of
// CLAUDE.md; `npm run verify-post-call` diffs both sides against the live master.

import type { ClientContext, SiteInfo } from './types';

/**
 * One piece of a Make expression, coloured the way Make colours it.
 *
 * `var` is a resolved mapping chip (dark pink). `varlt` is the lighter outlined variant Make
 * renders for a dotted path it hasn't resolved to a labelled field — the master's
 * `caller_priority` mapping really does render that way, so reproducing it is the difference
 * between "that's my screen" and "that's close enough".
 */
export type MakeTokenKind = 'var' | 'varlt' | 'op' | 'fn' | 'nl' | 'lit' | 'txt';
export interface MakeToken {
  k: MakeTokenKind;
  t: string;
}

export interface MakeField {
  label: string;
  required?: boolean;
  /** A dropdown, as opposed to an expression box. */
  select?: {
    value: string;
    /** Draw attention: this is one of the values that must be changed per client. */
    emphasis?: boolean;
    add?: boolean;
    refresh?: boolean;
    /** Render Make's "Map" toggle on the label row. */
    map?: boolean;
  };
  /** An expression box. `raw` is exactly what the copy button yields. */
  expr?: { raw: string; lines: MakeToken[][] };
  /** Rendered as a dashed, non-copyable box — a field that must stay empty. */
  unmapped?: string;
  help?: string;
  /** Marks the help text as an instruction rather than Make's own hint copy. */
  warn?: boolean;
  /** A group header (Make's "Record"); following fields render indented until the next group. */
  group?: boolean;
}

export interface MakeModule {
  app: 'airtable' | 'twilio';
  title: string;
  subtitle: string;
  /** The module's number on the Make canvas — 8 and 10 in the master's layout. */
  number: number;
  accent: string;
  fields: MakeField[];
}

const v = (t: string): MakeToken => ({ k: 'var', t });
const vl = (t: string): MakeToken => ({ k: 'varlt', t });
const fn = (t: string): MakeToken => ({ k: 'fn', t });
const op = (t: string): MakeToken => ({ k: 'op', t });
const lit = (t: string): MakeToken => ({ k: 'lit', t });
const txt = (t: string): MakeToken => ({ k: 'txt', t });
const nl = (): MakeToken => ({ k: 'nl', t: 'newline' });

/** `1. call: a: b` — how Make prints a resolved path chip. */
const callVar = (path: string) => v(`1. call: ${path.split('.').join(': ')}`);

export const AIRTABLE_BLUE = '#2d7ff9';
export const TWILIO_RED = '#f22f46';

/**
 * The ten mapped Call Log columns, plus the one that must stay empty.
 *
 * `Call type` and `Priority` are lowercase on purpose: the module runs with `typecast: false`,
 * so a prettier "Inbound" is rejected as an invalid select option and fails the WHOLE row, not
 * just that cell. `Outcome` has no mapping anywhere — it exists for the owner to set by hand
 * while triaging, which is why it keeps human-cased labels.
 */
function airtableFields(ctx: ClientContext, site: SiteInfo): MakeField[] {
  const baseName = `${site.brandName} — Calls`;
  return [
    {
      label: 'Connection',
      required: true,
      select: { value: 'JDD Airtable PAT', add: true },
      help: 'For more information on how to create a connection to Airtable, see the online Help.',
    },
    {
      label: 'Base',
      required: true,
      select: { value: baseName, emphasis: true },
      help: `Set this to ${baseName}. The clone still points at the master’s base until you change it.`,
      warn: true,
    },
    { label: 'Table', required: true, select: { value: 'Call Log', refresh: true } },
    { label: 'Record', group: true },
    {
      label: 'Date',
      expr: {
        raw: '{{parseDate(1.call.start_timestamp; "x")}}',
        lines: [[fn('parseDate('), callVar('start_timestamp'), fn(';'), fn('x'), fn(')')]],
      },
      help: 'Time zone: America/New_York. For more information on supported date formats, see the online Help.',
    },
    {
      label: 'Caller name',
      expr: {
        raw: '{{1.call.call_analysis.custom_analysis_data.caller_name}}',
        lines: [[callVar('call_analysis.custom_analysis_data.caller_name')]],
      },
    },
    {
      label: 'Caller number',
      expr: {
        raw: '{{if(1.call.direction = "inbound"; 1.call.from_number; 1.call.to_number)}}',
        lines: [[
          fn('if('), callVar('direction'), op('='), lit('inbound'), fn(';'),
          callVar('from_number'), fn(';'), callVar('to_number'), fn(')'),
        ]],
      },
    },
    {
      label: 'Summary',
      expr: {
        raw: '{{1.call.call_analysis.call_summary}}',
        lines: [[callVar('call_analysis.call_summary')]],
      },
    },
    {
      label: 'Duration (seconds)',
      expr: {
        raw: '{{round(ifempty(1.call.duration_ms; 0) / 1000)}}',
        lines: [[
          fn('round('), fn('ifempty('), callVar('duration_ms'), fn(';'), lit('0'), fn(')'),
          lit('/'), lit('1000'), fn(')'),
        ]],
      },
    },
    {
      label: 'Call type',
      expr: { raw: '{{1.call.direction}}', lines: [[callVar('direction')]] },
      help: 'Lowercase on purpose — the module runs with typecast: false, so “Inbound” is rejected as an invalid option and fails the whole row.',
      warn: true,
    },
    {
      label: 'Email',
      expr: {
        raw: '{{1.call.call_analysis.custom_analysis_data.caller_email}}',
        lines: [[callVar('call_analysis.custom_analysis_data.caller_email')]],
      },
    },
    {
      label: 'Address',
      expr: {
        raw: '{{1.call.call_analysis.custom_analysis_data.caller_address}}',
        lines: [[callVar('call_analysis.custom_analysis_data.caller_address')]],
      },
    },
    {
      label: 'Recording URL',
      expr: { raw: '{{1.call.recording_url}}', lines: [[callVar('recording_url')]] },
    },
    {
      label: 'Priority',
      expr: {
        raw: '{{1.call.call_analysis.custom_analysis_data.caller_priority}}',
        lines: [[callVar('call_analysis.custom_analysis_data.caller_priority')]],
      },
      help: 'emergency / callback — lowercase, same reason as Call type.',
    },
    {
      label: 'Outcome',
      unmapped: '— leave unmapped —',
      help: 'Nothing writes Outcome. It exists for the owner to set by hand while triaging.',
    },
    ...(ctx.isEnterprise
      ? [{
          label: 'Site',
          expr: { raw: site.slug, lines: [[lit(site.slug)]] },
          help: 'Enterprise only: the shared base uses this column to tell the sites apart.',
          warn: true,
        } as MakeField]
      : []),
  ];
}

/**
 * The Twilio module as `patchPostCallBlueprint` writes it into the clone.
 *
 * `from` is the ACCOUNT-lane sender, TWILIO_NOTIFICATION_NUMBER — one JDD number, identical in
 * every clone — never this client's TWILIO_NUMBER (onboard.js commit 30acaf3). The brief goes to
 * the business owner, so it rides JDD's own campaign; a client number used for it would be stuck
 * in JDD's Messaging Service and could never join the client's own campaign later. Shown as the
 * key name, not the value: the number is agency-wide and Part A's context card carries it.
 *
 * There is deliberately no MessagingServiceSid field. The master sends `fromType: phone`, and the
 * account's own history shows 10DLC delivering with `messaging_service_sid` null — pool
 * membership is what ties a sender to a campaign, not naming the service in the call.
 *
 * `to` is the number the owner ticked SMS consent beside at intake (`smsAlerts.phone`), NOT
 * CLIENT_FORWARD_PHONE: the line we forward calls to is not a number we have permission to text.
 * SiteInfo doesn't carry it, so it is described rather than shown.
 */
function twilioFields(_site: SiteInfo): MakeField[] {
  const bodyRaw = [
    'Name:{{1.call.call_analysis.custom_analysis_data.caller_name}}',
    '{{newline}}',
    'Status:{{1.call.call_analysis.custom_analysis_data.caller_priority}}',
    '{{newline}}',
    'Phone: {{if(1.call.direction = "inbound"; 1.call.from_number; 1.call.to_number)}}',
    '{{newline}}',
    'About: {{1.call.call_analysis.call_summary}}',
  ].join('\n');
  return [
    {
      label: 'Connection',
      required: true,
      select: { value: 'JDD', add: true },
      help: 'For more information on how to create a connection to Twilio, see the online Help.',
    },
    { label: 'Send a message from', required: true, select: { value: 'phone number', map: true } },
    {
      label: 'Phone number',
      required: true,
      select: { value: 'TWILIO_NOTIFICATION_NUMBER', emphasis: true, map: true },
      help: 'From = JDD’s notification number (jdd-ops/.env), the same in every clone — NOT this client’s TWILIO_NUMBER. It is already in JDD’s approved campaign pool, so this client needs no SMS registration for the owner brief. If this clone shows the client’s own number, it was made before 2026-11-02: change it here.',
      warn: true,
    },
    {
      label: 'To',
      required: true,
      select: { value: 'Owner’s SMS-consent number', emphasis: true },
      help: 'To = the number the owner ticked SMS consent beside at intake, in E.164. Not necessarily the forwarding line. No consent on file → onboard.js removes this whole module and the owner gets no brief.',
      warn: true,
    },
    { label: 'Message Body', required: true, select: { value: 'Create a Body', map: true } },
    {
      label: 'Body',
      required: true,
      expr: {
        raw: bodyRaw,
        lines: [
          [txt('Name:'), callVar('call_analysis.custom_analysis_data.caller_name')],
          [nl()],
          [txt('Status:'), vl('1.call.call_analysis.custom_analysis_data.caller_priority')],
          [nl()],
          [
            txt('Phone:'), fn('if('), callVar('direction'), op('='), lit('inbound'), fn(';'),
            callVar('from_number'), fn(';'), callVar('to_number'), fn(')'),
          ],
          [nl()],
          [txt('About:'), callVar('call_analysis.call_summary')],
        ],
      },
      help: 'This is the master’s live body, reproduced as it is — not as it should be. Status: renders blank on every call (the agent never emits caller_priority), and the body carries no “Reply STOP” opt-out line. Both are open items with the operator; do not submit this as an A2P sample. The newline tokens are Make functions — copy the block whole rather than retyping it.',
      warn: true,
    },
  ];
}

/** The pair of modules to edit for one site, in canvas order. */
export function makeModulesForSite(ctx: ClientContext, site: SiteInfo): MakeModule[] {
  return [
    {
      app: 'airtable',
      title: 'Airtable',
      subtitle: 'Create a record',
      number: 8,
      accent: AIRTABLE_BLUE,
      fields: airtableFields(ctx, site),
    },
    {
      app: 'twilio',
      title: 'Twilio',
      subtitle: 'Create a Message',
      number: 10,
      accent: TWILIO_RED,
      fields: twilioFields(site),
    },
  ];
}
