/**
 * What a new client's agent is written and what the tuned test fixtures run are the same design.
 *
 * Xander's bar (2026-11-05): the growth fixture's prompt is the version clients should get. The
 * output is Claude-written, so byte equality means nothing; `checkPromptParity` compares what is
 * fixed, on both sides. `generateRetellPrompt` keeps an existing file once an agent exists, so a
 * rule tuned on one agent is exactly what could fail to reach clients.
 *
 * **The bug this encodes.** The first run of this check against the real generator failed: both
 * Starter prompts carried a 16th section, LOCATION / SERVICE AREA, that no live agent has, because
 * the generator's instructions held a paragraph that read like a header. A hand-eyeballed diff of
 * the fixture would never have seen it, since it varied from run to run.
 *
 * test/fixtures/retell/live-prompts.json is RECORDED: the two live prompts, and two real
 * generator runs for the fixture intakes.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkLiveAgentSetup, checkPromptParity } from '../lib/onboard-checks.js';
import {
  buildPostCallAnalysisData,
  inboundOpeningLine,
  PROMPT_SECTIONS,
  recoverBusinessName,
  VOICEMAIL_OPTION,
} from '../lib/voice-consent.js';
import { loadFixture } from './helpers/fixtures.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const recorded = loadFixture('retell/live-prompts.json');
const { live_growth: growth, live_starter: starter, generated_growth: newGrowth, generated_starter: newStarter } = recorded;
const check = (x, prompt = x.prompt) => checkPromptParity({ prompt, business: x.business, callbacks: x.callbacks });

test('the live fixtures and real generator output all pass the same check', () => {
  for (const [name, x] of Object.entries({ growth, starter, newGrowth, newStarter })) {
    const c = check(x);
    assert.equal(c.ok, true, `${name}: ${c.detail}`);
  }
});

test('live and generated prompts have the same sections in the same order', () => {
  const headings = (p) => [...p.matchAll(/^##\s+(.+?)\s*$/gm)].map((m) => m[1]);
  for (const x of [growth, starter, newGrowth, newStarter]) assert.deepEqual(headings(x.prompt), PROMPT_SECTIONS);
});

test('an extra section is drift — the generator wrote LOCATION / SERVICE AREA on Starter', () => {
  const p = starter.prompt.replace('## NO SCHEDULING', '## LOCATION / SERVICE AREA\n\nWe serve Orlando.\n\n## NO SCHEDULING');
  const c = check(starter, p);
  assert.equal(c.ok, false);
  assert.match(c.detail, /sections out of order/);
  assert.doesNotMatch(c.detail, /FAIL:/);
});

test('the generator no longer offers that paragraph as a header, and allows no others', () => {
  const src = readFileSync(resolve(ROOT, 'onboard.js'), 'utf8');
  assert.doesNotMatch(src, /^LOCATION \/ SERVICE AREA:/m);
  assert.match(src, /Use exactly these "##" headers and no others/);
  assert.match(src, /\$\{PROMPT_SECTIONS\.join\(', '\)\}/);
  assert.match(src, /const parity = checkPromptParity\(\{ prompt, business: content\.brand\.name, callbacks \}\);/);
});

test('each rule from the 2026-11-04 live tests is caught when it goes missing', () => {
  const cases = [
    [(p) => p.replaceAll('{{callback_number_spoken}}', 'the number'), /callback_number_spoken/],
    [(p) => p.replaceAll('{{user_number}}', 'the number'), /user_number/],
    [(p) => `${p}\nSay the number like four oh seven… five five five.`, /example phone number/],
    [(p) => `${p}\nThen say "[spell the name letter by letter]".`, /square brackets/],
    [(p) => p.replace(/^.*(phonetic|military).*$/gim, ''), /phonetic/],
    [(p) => p.replace(/One last thing — is it okay/g, 'Is it okay'), /consent ask/],
  ];
  for (const [breakIt, why] of cases) {
    const c = check(growth, breakIt(growth.prompt));
    assert.equal(c.ok, false, `should fail: ${why}`);
    assert.match(c.detail, why);
  }
});

test('Growth must carry the outbound rules; Starter must carry none of them', () => {
  const noDirection = check(growth, growth.prompt.replaceAll('{{direction}}', 'the call'));
  assert.equal(noDirection.ok, false);
  assert.match(noDirection.detail, /direction/);
  const noLead = check(growth, growth.prompt.replaceAll('{{lead_name}}', 'them'));
  assert.equal(noLead.ok, false);
  assert.match(noLead.detail, /lead_name/);
  const leaked = check(starter, `${starter.prompt}\nIf {{direction}} is outbound, use {{lead_name}}.`);
  assert.equal(leaked.ok, false);
  assert.match(leaked.detail, /outbound rules/);
});

test('a prompt that could not be read is "could not check", never a pass', () => {
  assert.equal(checkPromptParity({ prompt: null, business: 'x', callbacks: true }).ok, null);
});

test('the business a disclosure was written for reads back; anything else is null', () => {
  assert.equal(recoverBusinessName(inboundOpeningLine('Your HVAC Co.')), 'Your HVAC Co.');
  assert.equal(recoverBusinessName('Hi, thanks for calling!'), null);
  assert.equal(recoverBusinessName(undefined), null);
});

test('an agent whose analysis wording lags a new client is flagged, not passed', () => {
  // A description is an instruction to Retell's extractor. Old wording on callback_number can
  // put the business's own line in the column, with nothing reporting it.
  const business = growth.business;
  const fields = buildPostCallAnalysisData(business).map((f) =>
    f.name === 'callback_number' ? { ...f, description: 'If none was spoken, use the number they called from.' } : f,
  );
  const llm = { llm_id: 'llm_client_own_000000000000', begin_message: inboundOpeningLine(business), general_prompt: growth.prompt };
  const agent = { post_call_analysis_data: fields, voicemail_option: VOICEMAIL_OPTION };
  const c = checkLiveAgentSetup({ agent, llm, masterLlmId: 'llm_master' });
  assert.equal(c.ok, false);
  assert.match(c.detail, /callback_number differ/);
  agent.post_call_analysis_data = buildPostCallAnalysisData(business);
  assert.equal(checkLiveAgentSetup({ agent, llm, masterLlmId: 'llm_master' }).ok, true);
});
