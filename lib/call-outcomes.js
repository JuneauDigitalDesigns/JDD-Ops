/**
 * lib/call-outcomes.js — which finished calls the post-call scenario logs and briefs.
 *
 * Operator rule, 2026-11-03: **an unanswered callback is a lost lead.** An outbound call that
 * never reached a person — no answer, busy, failed, voicemail, an IVR — produces no Airtable row,
 * no portal entry and no owner text. Everything else is logged exactly as before.
 *
 * Operator rule, 2026-11-08: **a call that drops before anything useful is collected counts the
 * same.** A caller connects, says a word, the line goes: Retell still analyses it, and the row and
 * the owner's text both went out (an 18-second callback on the growth fixture, nothing collected).
 * "Useful" is what the agent actually took down, so `caller_name` counts on inbound only: on a
 * callback it comes from the opening line, not from the caller.
 *
 * Retell sends `call_analyzed` even for a call that never connected (its webhook docs: "It will
 * still have its call_ended and call_analyzed webhooks triggered"), so the scenario's trigger
 * filter is the only thing that can stop it. `checkConnectedCallsOnly` in onboard-checks.js runs
 * that filter, as Make would, against every case below.
 *
 * Two kinds of case, labelled by where they came from:
 *   - `recorded` — a shape this account's calls have actually produced, captured by
 *     `npm run fixtures:refresh` into test/fixtures/retell/call-outcomes.json. A test fails when
 *     a newly recorded shape has no case here, so a new real outcome forces a decision.
 *   - `documented` — a shape Retell documents and this account has not yet produced (no
 *     callback here has ever gone unanswered). Values are Retell's documented enums, quoted, not
 *     guessed — but they are not recordings, and the live ring-out test is what proves them.
 *
 * Voicemail is the case that would have slipped through a filter written from the docs alone:
 * voicemail detection is off on these agents, so Retell never says `voicemail_reached`. The two
 * real voicemail calls are `ended` with an ordinary hangup and `call_analysis.in_voicemail: true`.
 */

/** The rule itself, as data-independent code: should this finished call be logged? */
export function shouldLog({ event, call }) {
  if (event !== 'call_analyzed') return false;
  if (call?.call_status !== 'ended') return false; // not_connected, error
  if (call.call_analysis?.in_voicemail === true) return false;
  if (['voicemail_reached', 'ivr_reached'].includes(call.disconnection_reason)) return false;
  return gotSomewhere(call);
}

/** Did the agent take anything down? Mirrors the groups in `postCallGateFilter`. */
function gotSomewhere(call) {
  const d = call.call_analysis?.custom_analysis_data ?? {};
  return (
    d.sms_consent === 'granted' ||
    d.sms_consent === 'declined' ||
    d.caller_priority === 'emergency' ||
    Boolean(d.caller_address) ||
    Boolean(d.caller_email) ||
    Boolean(d.callback_number) ||
    (call.direction !== 'outbound' && Boolean(d.caller_name))
  );
}

/**
 * The Make filter on the master's Airtable module: the rule above, in Make's shape.
 *
 * Complete on purpose. A clone has one filter slot before its row is written, so this repeats the
 * event and connected-call conditions instead of relying on the datastore module's filter, which
 * `patchPostCallBlueprint` removes with that module. The HTTP module runs after this one, so a
 * call that doesn't pass gets no row and no text.
 */
export function postCallGateFilter() {
  const field = (n) => `{{1.call.call_analysis.custom_analysis_data.${n}}}`;
  const connected = [
    { a: '{{1.event}}', b: 'call_analyzed', o: 'text:equal' },
    { a: '{{1.call.call_status}}', b: 'ended', o: 'text:equal' },
    { a: '{{1.call.call_analysis.in_voicemail}}', b: 'true', o: 'text:notequal' },
    { a: '{{1.call.disconnection_reason}}', b: 'voicemail_reached', o: 'text:notequal' },
    { a: '{{1.call.disconnection_reason}}', b: 'ivr_reached', o: 'text:notequal' },
  ];
  const filled = (n) => ({ a: field(n), b: '', o: 'text:notequal' });
  const signals = [
    [{ a: field('sms_consent'), b: 'granted', o: 'text:equal' }],
    [{ a: field('sms_consent'), b: 'declined', o: 'text:equal' }],
    [{ a: field('caller_priority'), b: 'emergency', o: 'text:equal' }],
    [filled('caller_address')],
    [filled('caller_email')],
    [filled('callback_number')],
    [{ a: '{{1.call.direction}}', b: 'outbound', o: 'text:notequal' }, filled('caller_name')],
  ];
  return { name: 'Connected, and the caller gave something', conditions: signals.map((s) => [...connected, ...s]) };
}

/** A finished call that collected details, as every answered call on this account has. */
const COMPLETED = { caller_name: 'Dana', callback_number: '2075550100', caller_address: '1 Main St', caller_email: '', caller_priority: 'callback', sms_consent: 'granted' };
/** What Retell extracted from the 18-second dropped callback on 2026-11-08. */
const DROPPED = { caller_name: 'Dana', callback_number: '', caller_address: '', caller_email: '', caller_priority: 'callback', sms_consent: 'unknown' };

const call = (direction, call_status, disconnection_reason, in_voicemail, custom_analysis_data) => ({
  direction,
  call_status,
  disconnection_reason,
  ...(in_voicemail === undefined ? {} : { call_analysis: { in_voicemail, ...(custom_analysis_data ? { custom_analysis_data } : {}) } }),
});

/** `{ label, source, payload }` — `payload` is the webhook body Retell posts: `{ event, call }`. */
export const CALL_OUTCOME_CASES = [
  // ── recorded ──
  { source: 'recorded', label: 'inbound, agent hung up', payload: { event: 'call_analyzed', call: call('inbound', 'ended', 'agent_hangup', false, COMPLETED) } },
  { source: 'recorded', label: 'inbound, silence timeout', payload: { event: 'call_analyzed', call: call('inbound', 'ended', 'inactivity', false, COMPLETED) } },
  { source: 'recorded', label: 'inbound, caller hung up', payload: { event: 'call_analyzed', call: call('inbound', 'ended', 'user_hangup', false, COMPLETED) } },
  { source: 'recorded', label: 'answered callback, agent hung up', payload: { event: 'call_analyzed', call: call('outbound', 'ended', 'agent_hangup', false, COMPLETED) } },
  { source: 'recorded', label: 'answered callback, lead hung up', payload: { event: 'call_analyzed', call: call('outbound', 'ended', 'user_hangup', false, COMPLETED) } },
  { source: 'recorded', label: 'callback reached voicemail, agent hung up', payload: { event: 'call_analyzed', call: call('outbound', 'ended', 'agent_hangup', true, COMPLETED) } },
  { source: 'recorded', label: 'callback reached voicemail, line hung up', payload: { event: 'call_analyzed', call: call('outbound', 'ended', 'user_hangup', true, COMPLETED) } },
  { source: 'recorded', label: 'web call (no direction)', payload: { event: 'call_analyzed', call: call(null, 'ended', 'user_hangup', false, COMPLETED) } },
  // First seen 2026-11-03 21:29, once voicemail_option hang-up was set on the growth fixture: the
  // agent hung up after 2.3 s, and Retell reports BOTH signals — voicemail_reached and in_voicemail.
  { source: 'recorded', label: 'callback reached voicemail, detection hung up', payload: { event: 'call_analyzed', call: call('outbound', 'ended', 'voicemail_reached', true) } },
  // 2026-11-08: confirmed the name, then the line dropped. Retell's analysis came back empty.
  { source: 'recorded', label: 'answered callback, dropped before details', payload: { event: 'call_analyzed', call: call('outbound', 'ended', 'user_hangup', false, DROPPED) } },
  // ── the same rule, one signal at a time ──
  { source: 'documented', label: 'inbound, dropped before anything', payload: { event: 'call_analyzed', call: call('inbound', 'ended', 'user_hangup', false, { ...DROPPED, caller_name: '' }) } },
  { source: 'documented', label: 'inbound, gave a name then dropped', payload: { event: 'call_analyzed', call: call('inbound', 'ended', 'user_hangup', false, DROPPED) } },
  { source: 'documented', label: 'dropped, but said it was an emergency', payload: { event: 'call_analyzed', call: call('outbound', 'ended', 'user_hangup', false, { ...DROPPED, caller_priority: 'emergency' }) } },
  { source: 'documented', label: 'dropped after confirming a number', payload: { event: 'call_analyzed', call: call('outbound', 'ended', 'user_hangup', false, { ...DROPPED, callback_number: '2075550100' }) } },
  { source: 'documented', label: 'dropped after giving an address', payload: { event: 'call_analyzed', call: call('outbound', 'ended', 'user_hangup', false, { ...DROPPED, caller_address: '1 Main St' }) } },
  { source: 'documented', label: 'dropped after giving an email', payload: { event: 'call_analyzed', call: call('outbound', 'ended', 'user_hangup', false, { ...DROPPED, caller_email: 'd@example.test' }) } },
  { source: 'documented', label: 'answered no to texts', payload: { event: 'call_analyzed', call: call('outbound', 'ended', 'agent_hangup', false, { ...DROPPED, sms_consent: 'declined' }) } },
  { source: 'documented', label: 'no analysis at all', payload: { event: 'call_analyzed', call: call('inbound', 'ended', 'user_hangup', false) } },
  // ── documented, never yet produced on this account ──
  { source: 'documented', label: 'callback not answered', payload: { event: 'call_analyzed', call: call('outbound', 'not_connected', 'dial_no_answer') } },
  { source: 'documented', label: 'callback busy', payload: { event: 'call_analyzed', call: call('outbound', 'not_connected', 'dial_busy') } },
  { source: 'documented', label: 'callback dial failed', payload: { event: 'call_analyzed', call: call('outbound', 'not_connected', 'dial_failed') } },
  { source: 'documented', label: 'callback voicemail, detection on', payload: { event: 'call_analyzed', call: call('outbound', 'ended', 'voicemail_reached', false) } },
  { source: 'documented', label: 'callback hit an IVR', payload: { event: 'call_analyzed', call: call('outbound', 'ended', 'ivr_reached', false) } },
  { source: 'documented', label: 'callback errored', payload: { event: 'call_analyzed', call: call('outbound', 'error', 'error_unknown') } },
  { source: 'documented', label: 'answered callback, call_started event', payload: { event: 'call_started', call: call('outbound', 'ongoing', undefined) } },
  { source: 'documented', label: 'answered callback, call_ended event', payload: { event: 'call_ended', call: call('outbound', 'ended', 'agent_hangup') } },
];
