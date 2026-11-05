// The two Make.com modules an operator must edit by hand on every client, as data.
//
// Deliberately thin at the call site, like `diagram`: the Block is just
// `{ t: 'make-module', siteSlug }` and the whole field model is derived HERE from
// ClientContext. The alternative — restating ten Airtable mappings inside
// runbook-content.ts — put the field list in two places and guaranteed they would drift.
//
// WHY THIS EXISTS AT ALL: onboard.js clones the master post-call scenario per client, but the
// clone carries the master's module settings. Until the Airtable module points at this client's
// base and the HTTP module carries this client's ingest token, the scenario is wired to someone
// else's resources. Nothing errors — the calls just land in the wrong log, or brief nobody.
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
  app: 'airtable' | 'http';
  title: string;
  subtitle: string;
  /** The module's number on the Make canvas — 8 and 10 in the master's layout. */
  number: number;
  accent: string;
  fields: MakeField[];
}

const v = (t: string): MakeToken => ({ k: 'var', t });
const fn = (t: string): MakeToken => ({ k: 'fn', t });
const op = (t: string): MakeToken => ({ k: 'op', t });
const lit = (t: string): MakeToken => ({ k: 'lit', t });

/** `1. call: a: b` — how Make prints a resolved path chip. */
const callVar = (path: string) => v(`1. call: ${path.split('.').join(': ')}`);

export const AIRTABLE_BLUE = '#2d7ff9';
/** Make's HTTP app colour. */
export const HTTP_BLUE = '#1f6feb';

/** Where every clone's HTTP module posts the owner brief — the recorded master's URL. */
export const AGENCY_CALL_URL = 'https://www.juneaudigitaldesigns.com/api/ingest/call';

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
      label: 'Callback number',
      expr: {
        raw: '{{1.call.call_analysis.custom_analysis_data.callback_number}}',
        lines: [[callVar('call_analysis.custom_analysis_data.callback_number')]],
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
      // Never the bare field: Retell sends "" when it could not fill it, Airtable rejects "" as a
      // new select option, and the whole row is lost (2026-11-03). Pinned equal to
      // SELECT_MAPPINGS in jdd-ops/lib/voice-consent.js by test/voice-consent.test.mjs.
      expr: {
        raw: '{{if(1.call.call_analysis.custom_analysis_data.caller_priority = "emergency"; "emergency"; "callback")}}',
        lines: [[
          fn('if('), callVar('call_analysis.custom_analysis_data.caller_priority'), op('='), lit('emergency'), fn(';'),
          lit('emergency'), fn(';'), lit('callback'), fn(')'),
        ]],
      },
      help: 'emergency / callback — lowercase, same reason as Call type. Wrapped in if() so a blank extraction becomes “callback” instead of failing the whole row.',
      warn: true,
    },
    {
      label: 'SMS consent',
      expr: {
        raw: '{{if(1.call.call_analysis.custom_analysis_data.sms_consent = "granted"; "granted"; if(1.call.call_analysis.custom_analysis_data.sms_consent = "declined"; "declined"; "unknown"))}}',
        lines: [
          [fn('if('), callVar('call_analysis.custom_analysis_data.sms_consent'), op('='), lit('granted'), fn(';'), lit('granted'), fn(';')],
          [fn('if('), callVar('call_analysis.custom_analysis_data.sms_consent'), op('='), lit('declined'), fn(';'), lit('declined'), fn(';')],
          [lit('unknown'), fn('))')],
        ],
      },
      help: 'granted / declined / unknown — the caller’s answer to the closing SMS question. Anything else, including a blank, becomes “unknown”, which blocks texting. Lowercase, same reason as Call type.',
      warn: true,
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
 * The HTTP module as `patchPostCallBlueprint` writes it into the clone: the owner's end-of-call
 * brief, handed to the agency.
 *
 * It replaced a Twilio module (2026-11-03). That module's `to`, `from` and very existence were
 * stamped in at onboarding and never re-read, so an owner who opted in through the portal later
 * was never texted. Now the clone posts the call to the agency's `/api/ingest/call`, which reads
 * the owner's consent at send time and texts from JDD's notification number. There is nothing
 * SMS-shaped left in the clone to get wrong.
 *
 * Every value here mirrors the RECORDED master module (jdd-ops test/fixtures/make/
 * master-blueprint.json, module 10), which test/sms-lane-copy.test.mjs pins. The token is shown
 * by key name only: it is this client's credential, and a copy button holding it would put it on
 * the clipboard of anyone reading the runbook.
 */
function httpFields(): MakeField[] {
  return [
    { label: 'Authentication type', required: true, select: { value: 'No authentication' }, help: 'The token goes in a header below, not here.' },
    {
      label: 'URL',
      required: true,
      expr: { raw: AGENCY_CALL_URL, lines: [[lit(AGENCY_CALL_URL)]] },
      help: 'www, not the bare domain — the apex 307-redirects and drops the Authorization header, so every brief would 401.',
      warn: true,
    },
    { label: 'Method', required: true, select: { value: 'POST', emphasis: true }, help: 'The agency only accepts POST. The master’s module was first saved as GET.', warn: true },
    { label: 'Headers', group: true },
    {
      label: 'Authorization',
      select: { value: 'Bearer <this site’s LEAD_INGEST_TOKEN>', emphasis: true },
      help: 'onboard.js writes this site’s token in place of the master’s REPLACE_PER_CLIENT placeholder. Another site’s token would brief the wrong owner; the placeholder would 401 every call.',
      warn: true,
    },
    { label: 'Body content type', required: true, select: { value: 'application/x-www-form-urlencoded' }, help: 'Make encodes form values itself. A JSON body would be built by string interpolation and break on a quote in a caller’s name.' },
    { label: 'Fields', group: true },
    { label: 'call_id', expr: { raw: '{{1.call.call_id}}', lines: [[callVar('call_id')]] }, help: 'The agency texts once per call_id, so a Make retry never double-texts.' },
    {
      label: 'caller_name',
      expr: {
        raw: '{{1.call.call_analysis.custom_analysis_data.caller_name}}',
        lines: [[callVar('call_analysis.custom_analysis_data.caller_name')]],
      },
    },
    {
      label: 'caller_priority',
      expr: {
        raw: '{{1.call.call_analysis.custom_analysis_data.caller_priority}}',
        lines: [[callVar('call_analysis.custom_analysis_data.caller_priority')]],
      },
    },
    {
      label: 'caller_number',
      expr: {
        raw: '{{if(1.call.direction = "inbound"; 1.call.from_number; 1.call.to_number)}}',
        lines: [[
          fn('if('), callVar('direction'), op('='), lit('inbound'), fn(';'),
          callVar('from_number'), fn(';'), callVar('to_number'), fn(')'),
        ]],
      },
    },
    {
      label: 'airtable_record_id',
      expr: { raw: '{{8.id}}', lines: [[v('8. ID')]] },
      help: 'The Airtable row just written (module 8’s ID) — the portal’s id for this call, so the owner’s text can open it. Pick it from the mapping panel; don’t type it.',
    },
    { label: 'Parse response', select: { value: 'No' } },
    {
      label: 'Evaluate all states as errors',
      select: { value: 'No', emphasis: true },
      help: 'Must stay No. A 429 or 503 that errors the run counts toward Make deactivating the scenario — and that stops the Airtable call log too.',
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
      app: 'http',
      title: 'HTTP',
      subtitle: 'Make a request',
      number: 10,
      accent: HTTP_BLUE,
      fields: httpFields(),
    },
  ];
}
