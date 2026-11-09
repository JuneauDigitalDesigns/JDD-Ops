/**
 * Every LIVE client agent carries the consent setup — not just agents created after it shipped.
 *
 * **The bug this encodes (found 2026-11-04).** The consent work reached new clients only. Both
 * test agents had no SMS consent ask in their prompt, no recording disclosure as their opening
 * line, and no `sms_consent` field, so Xander's answered callback logged "unknown". The growth
 * agent ran on the MASTER Retell LLM, so its prompt was every client's template.
 *
 * The fixture is the RECORDED live state of both agents and their bound LLMs on that day
 * (test/fixtures/retell/agent-setup-2026-11-04.json): the check must flag both, for the reasons
 * they actually had.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkLiveAgentSetup } from '../lib/onboard-checks.js';
import { buildPostCallAnalysisData, inboundOpeningLine, SIGNED_RECORDING_SETTINGS, SIGNED_URL_EXPIRATION_MS, smsConsentAsk, VOICEMAIL_OPTION } from '../lib/voice-consent.js';
import { loadFixture } from './helpers/fixtures.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const recorded = loadFixture('retell/agent-setup-2026-11-04.json');
const MASTER = recorded.master_llm_id;
const check = ({ agent, llm }) => checkLiveAgentSetup({ agent, llm, masterLlmId: MASTER });

test('the growth fixture as found: on the master LLM, no disclosure, no ask, no sms_consent', () => {
  const c = check(recorded.agents._e2e_test_growth);
  assert.equal(c.ok, false);
  assert.match(c.detail, /MASTER Retell LLM/);
  assert.match(c.detail, /opening line is unset/);
  assert.match(c.detail, /lacks the approved SMS consent ask/);
  assert.match(c.detail, /no sms_consent/);
  assert.doesNotMatch(c.detail, /FAIL:/);
});

test('the starter fixture as found: its own LLM, but no disclosure, no ask, no sms_consent', () => {
  const c = check(recorded.agents._e2e_test_starter);
  assert.equal(c.ok, false);
  assert.doesNotMatch(c.detail, /MASTER/);
  assert.match(c.detail, /opening line/);
  assert.match(c.detail, /no sms_consent/);
});

/** What update-prompt + onboard.js produce for a client: built from the real wording functions. */
function correct(business = 'Your HVAC Co.') {
  return {
    agent: { agent_name: 'Master Agent', post_call_analysis_data: buildPostCallAnalysisData(business), voicemail_option: VOICEMAIL_OPTION, ...SIGNED_RECORDING_SETTINGS },
    llm: { llm_id: 'llm_client_own_000000000000', begin_message: inboundOpeningLine(business), general_prompt: `## CLOSING\nAsk exactly: "${smsConsentAsk(business)}"` },
  };
}

test('a correctly set-up agent passes — whatever its agent_name says', () => {
  // The growth agent is named "Master Agent"; the business comes from the disclosure, not the name.
  const c = check(correct());
  assert.equal(c.ok, true, c.detail);
  assert.match(c.detail, /Your HVAC Co\./);
});

test('each missing piece is caught on its own', () => {
  const cases = [
    [(x) => { x.llm.llm_id = MASTER; }, /MASTER/],
    [(x) => { x.llm.begin_message = 'Hi, thanks for calling!'; }, /not the recording disclosure/],
    [(x) => { x.llm.general_prompt = 'Ask if we can text them.'; }, /consent ask/],
    // The ask approved 2026-11-02, superseded on 2026-11-04, no longer counts.
    [(x) => { x.llm.general_prompt = 'One last thing — is it okay if Your HVAC Co. texts you at that number about this request? Message and data rates may apply, and you can reply STOP anytime. A yes or no is fine.'; }, /consent ask/],
    [(x) => { x.agent.post_call_analysis_data = x.agent.post_call_analysis_data.filter((f) => f.name !== 'sms_consent'); }, /sms_consent/],
    [(x) => { x.agent.voicemail_option = null; }, /voicemail/],
    [(x) => { x.agent.opt_in_signed_url = false; }, /recording links never expire/],
    // Signed, but on Retell's 24-hour default: a copied link would last a day.
    [(x) => { delete x.agent.signed_url_expiration_ms; }, /24-hour default/],
    // Said aloud to a caller on 2026-11-04: "That's [spell the name letter by letter] at G as in golf…"
    [(x) => { x.llm.general_prompt += '\nThen say: "That\'s [spell the name letter by letter]."'; }, /square brackets/],
  ];
  for (const [breakIt, why] of cases) {
    const x = correct();
    breakIt(x);
    const c = check(x);
    assert.equal(c.ok, false, `should fail: ${why}`);
    assert.match(c.detail, why);
  }
});

test('both test agents as recorded on 2026-11-09 fail: their recording links never expire', () => {
  // Retell reports the field as a real `false`, and no expiry at all.
  const found = loadFixture('retell/agent-signed-url-2026-11-09.json');
  for (const live of Object.values(found.agents)) {
    assert.equal(live.opt_in_signed_url, false);
    const x = correct();
    delete x.agent.opt_in_signed_url;
    delete x.agent.signed_url_expiration_ms;
    Object.assign(x.agent, live);
    const c = check(x);
    assert.equal(c.ok, false);
    assert.match(c.detail, /recording links never expire/);
    assert.doesNotMatch(c.detail, /FAIL:/);
  }
});

test('an unreadable agent is "could not check", never a pass', () => {
  assert.equal(checkLiveAgentSetup({ agent: null, llm: null, masterLlmId: MASTER }).ok, null);
});

/* ── what onboard.js sends for a NEW client ──────────────────────────────── */

test("a new client's LLM and agent, exactly as onboard.js sends them, pass the live check", async () => {
  // The same builders the real run and the dry-run report use.
  const { clientLlmCreateBody, clientAgentCreateBody } = await import('../onboard.js');
  const business = 'Acme Plumbing';
  const prompt = `## CLOSING\n"${smsConsentAsk(business)}"`;
  const llm = { llm_id: 'llm_new_client_own_0000000000', ...clientLlmCreateBody({ agentPrompt: prompt, businessName: business }) };
  const agent = clientAgentCreateBody({ businessName: business, llmId: llm.llm_id, voiceId: 'v' });
  assert.equal(llm.begin_message, inboundOpeningLine(business));
  assert.equal(llm.start_speaker, 'agent');
  assert.equal(agent.response_engine.llm_id, llm.llm_id);
  assert.equal(agent.opt_in_signed_url, true);
  assert.equal(agent.signed_url_expiration_ms, SIGNED_URL_EXPIRATION_MS);
  const c = checkLiveAgentSetup({ agent, llm, masterLlmId: MASTER });
  assert.equal(c.ok, true, c.detail);
});

test('onboard.js never adopts or binds the master LLM as a client\'s own', () => {
  // The growth fixture's agent ran on the master LLM; a .env.local naming it must not be reused.
  const src = readFileSync(resolve(ROOT, 'onboard.js'), 'utf8');
  assert.match(src, /if \(clientLlmId && clientLlmId === templateLlmId\) \{/);
  assert.match(src, /if \(clientLlmId === templateLlmId\) fail\(7, 'refusing to bind a client agent to the MASTER Retell LLM'\)/);
});
