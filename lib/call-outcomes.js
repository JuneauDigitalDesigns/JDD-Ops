/**
 * lib/call-outcomes.js — which finished calls the post-call scenario logs and briefs.
 *
 * Operator rule, 2026-11-03: **an unanswered callback is a lost lead.** An outbound call that
 * never reached a person — no answer, busy, failed, voicemail, an IVR — produces no Airtable row,
 * no portal entry and no owner text. Everything else is logged exactly as before.
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
  if (call?.direction !== 'outbound') return true; // inbound, web calls: unchanged
  if (call.call_status !== 'ended') return false; // not_connected, error
  if (call.call_analysis?.in_voicemail === true) return false;
  return !['voicemail_reached', 'ivr_reached'].includes(call.disconnection_reason);
}

const call = (direction, call_status, disconnection_reason, in_voicemail) => ({
  direction,
  call_status,
  disconnection_reason,
  ...(in_voicemail === undefined ? {} : { call_analysis: { in_voicemail } }),
});

/** `{ label, source, payload }` — `payload` is the webhook body Retell posts: `{ event, call }`. */
export const CALL_OUTCOME_CASES = [
  // ── recorded ──
  { source: 'recorded', label: 'inbound, agent hung up', payload: { event: 'call_analyzed', call: call('inbound', 'ended', 'agent_hangup', false) } },
  { source: 'recorded', label: 'inbound, silence timeout', payload: { event: 'call_analyzed', call: call('inbound', 'ended', 'inactivity', false) } },
  { source: 'recorded', label: 'inbound, caller hung up', payload: { event: 'call_analyzed', call: call('inbound', 'ended', 'user_hangup', false) } },
  { source: 'recorded', label: 'answered callback, agent hung up', payload: { event: 'call_analyzed', call: call('outbound', 'ended', 'agent_hangup', false) } },
  { source: 'recorded', label: 'answered callback, lead hung up', payload: { event: 'call_analyzed', call: call('outbound', 'ended', 'user_hangup', false) } },
  { source: 'recorded', label: 'callback reached voicemail, agent hung up', payload: { event: 'call_analyzed', call: call('outbound', 'ended', 'agent_hangup', true) } },
  { source: 'recorded', label: 'callback reached voicemail, line hung up', payload: { event: 'call_analyzed', call: call('outbound', 'ended', 'user_hangup', true) } },
  { source: 'recorded', label: 'web call (no direction)', payload: { event: 'call_analyzed', call: call(null, 'ended', 'user_hangup', false) } },
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
