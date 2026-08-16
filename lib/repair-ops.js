/**
 * The write half of reconcile: repairs for the drift the probes find.
 *
 * Every operation here follows the same contract, and it is the contract that makes the
 * console's one-click fixes safe to offer:
 *
 *   1. READ the current value first and return it as `before`.
 *   2. Refuse to write when the read failed. If we could not learn what it was, we cannot
 *      offer to put it back, and a fix that cannot be undone must not be presented as one.
 *   3. Return `{ ok, before, after, reason }` — never throw. The caller records `before` in
 *      the undo log and an entry in the audit log before returning to the UI.
 *
 * Step 2 is the one worth defending. It would be easy to write blind and record `before` as
 * null, but null is a real value here — "the field was unset" — and conflating it with "we
 * never found out" is precisely the bug patchSite() was written to avoid.
 */

const RETELL_API = 'https://api.retellai.com';

function fail(reason) {
  return { ok: false, before: undefined, after: undefined, reason };
}

/* ── Twilio ────────────────────────────────────────────────────────────────── */

/**
 * Re-point a number's voice or SMS webhook.
 *
 * `field` is 'voiceUrl' or 'smsUrl'. Twilio's SDK takes them as separate properties, so the
 * caller names which one rather than passing a whole config object — a partial update that
 * silently blanked the other would be a far worse outcome than a failed one.
 */
export async function setTwilioWebhook({ accountSid, authToken, phoneNumber, field, url }) {
  if (!accountSid || !authToken) return fail('Twilio credentials are not set in jdd-ops/.env');
  if (!phoneNumber) return fail('No TWILIO_NUMBER for this site');
  if (field !== 'voiceUrl' && field !== 'smsUrl') return fail(`Unsupported field "${field}"`);
  if (!url) return fail('No target URL given');

  try {
    const { default: twilio } = await import('twilio');
    const client = twilio(accountSid, authToken);

    const [num] = await client.incomingPhoneNumbers.list({ phoneNumber, limit: 1 });
    if (!num) return fail(`The master Twilio account does not own ${phoneNumber}`);

    const before = num[field] ?? null;
    if (before === url) {
      return { ok: true, before, after: before, reason: 'already correct', noop: true };
    }

    const updated = await client.incomingPhoneNumbers(num.sid).update({ [field]: url });
    return { ok: true, before, after: updated[field] ?? null, reason: null };
  } catch (err) {
    return fail(`Twilio update failed: ${err.message}`);
  }
}

/* ── Retell ────────────────────────────────────────────────────────────────── */

/**
 * Set fields on an agent — post-call webhook, voice, call-duration cap.
 *
 * NOT the prompt. The prompt lives on the LLM, not the agent (a `general_prompt` passed to
 * an agent with a retell-llm response engine is ignored), and the console already has a
 * dedicated editor for it. Routing prompt edits through a generic config patch would let
 * them bypass that editor's disk write and reintroduce the drift the probe reports.
 */
export async function setRetellAgentConfig({ apiKey, agentId, patch }) {
  if (!apiKey) return fail('RETELL_API_KEY is not set in jdd-ops/.env');
  if (!agentId) return fail('No RETELL_AGENT_ID for this site');

  const allowed = ['webhook_url', 'voice_id', 'max_call_duration_ms'];
  const keys = Object.keys(patch ?? {});
  const bad = keys.filter((k) => !allowed.includes(k));
  if (!keys.length) return fail('Nothing to change');
  if (bad.length) return fail(`Not settable from here: ${bad.join(', ')}`);

  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };

  let current;
  try {
    const res = await fetch(`${RETELL_API}/get-agent/${agentId}`, { headers });
    if (!res.ok) return fail(`Retell get-agent returned ${res.status}`);
    current = await res.json();
  } catch (err) {
    return fail(`Retell get-agent failed: ${err.message}`);
  }

  const before = Object.fromEntries(keys.map((k) => [k, current?.[k] ?? null]));

  try {
    const res = await fetch(`${RETELL_API}/update-agent/${agentId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(patch),
    });
    if (!res.ok) return fail(`Retell update-agent returned ${res.status}: ${await res.text()}`);
    const after = await res.json();
    return {
      ok: true,
      before,
      after: Object.fromEntries(keys.map((k) => [k, after?.[k] ?? null])),
      reason: null,
    };
  } catch (err) {
    return fail(`Retell update-agent failed: ${err.message}`);
  }
}

/* ── Make ──────────────────────────────────────────────────────────────────── */

/**
 * Start or stop a scenario.
 *
 * `before` is read from the scenario listing rather than assumed from the requested action.
 * Reactivating something already active is a no-op worth reporting as one, and recording an
 * undo that would switch OFF a scenario that was already on is how a repair turns into an
 * outage.
 */
export async function setMakeScenarioState({ apiKey, zone, scenarioId, active }) {
  if (!apiKey) return fail('MAKE_API_KEY is not set in jdd-ops/.env');
  if (!zone) return fail('No Make zone configured');
  if (!scenarioId) return fail('No scenario id');

  const headers = { Authorization: `Token ${apiKey}`, 'Content-Type': 'application/json' };

  let before = null;
  try {
    const res = await fetch(`${zone}/scenarios/${scenarioId}`, { headers });
    if (!res.ok) return fail(`Make get-scenario returned ${res.status}`);
    const body = await res.json();
    const isActive = body?.scenario?.isActive;
    if (typeof isActive !== 'boolean') return fail('Make did not report the scenario state');
    before = isActive;
  } catch (err) {
    return fail(`Make get-scenario failed: ${err.message}`);
  }

  if (before === active) {
    return { ok: true, before, after: before, reason: 'already in that state', noop: true };
  }

  try {
    const res = await fetch(`${zone}/scenarios/${scenarioId}/${active ? 'start' : 'stop'}`, {
      method: 'POST',
      headers,
    });
    if (!res.ok) return fail(`Make ${active ? 'start' : 'stop'} returned ${res.status}: ${await res.text()}`);
    return { ok: true, before, after: active, reason: null };
  } catch (err) {
    return fail(`Make ${active ? 'start' : 'stop'} failed: ${err.message}`);
  }
}
