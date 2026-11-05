/**
 * What Xander's growth test callback got wrong on 2026-11-04, after the consent backfill.
 *
 *  1. It said "Hi, this is _e2e_test_growth". `npm run sync-env` read brand.name by stripping the
 *     TypeScript with a regex, the import threw, and it silently pushed the SLUG as
 *     NEXT_PUBLIC_BRAND_NAME — which /api/contact speaks in the callback's opening line.
 *  2. It asked the lead's name at the end, though the opening line had just confirmed it.
 *  3. It asked the caller to recite a phone number Retell already had ({{user_number}}).
 *  4. "My email is my name at gmail" — it struggled to spell it, with the name in hand.
 *
 * And the rule behind 2: only an agent that places callbacks (Growth, Enterprise) needs the
 * inbound/outbound distinction. A Starter agent only ever answers inbound calls, so its prompt
 * gets no outbound branch at all.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  voiceConsentInstructions,
  callerDetailsInstructions,
  smsConsentAsk,
  inboundOpeningLine,
  spokenPhoneDigits,
  SPELLING_RULE,
} from '../lib/voice-consent.js';
import { placesCallbacks, buildClientEnvLines } from '../lib/client-env.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BIZ = 'Your HVAC Co.';

/* ── 1. the business name the callback speaks ─────────────────────────────── */

test('sync-env reads the real brand name from a site.ts, never the slug', async () => {
  const { readBrandName } = await import('../scripts/sync-vercel-env.js');
  for (const [shape, name] of [
    ['growth', 'Fixture Plumbing Co.'],
    ['starter', 'Fixture Electric LLC'],
    ['enterprise', 'Fixture Mechanical Orlando'],
  ]) {
    assert.equal(await readBrandName(resolve(ROOT, `test/fixtures/intake/fixture-${shape}/site.ts`)), name, shape);
  }
  // Unreadable is null — main() then refuses unless --brand is passed. Never a guess.
  assert.equal(await readBrandName(resolve(ROOT, 'test/fixtures/intake/nope/site.ts')), null);
});

test('sync-env has no slug fallback for the spoken business name', () => {
  const src = readFileSync(resolve(ROOT, 'scripts/sync-vercel-env.js'), 'utf8');
  assert.doesNotMatch(src, /brand\?\.name \|\| slug/);
  assert.doesNotMatch(src, /return slug;/);
  assert.match(src, /--brand/);
});

/* ── who gets outbound rules ──────────────────────────────────────────────── */

test('only Growth and Enterprise place callbacks — the same rule as LEAD_CALLBACK', () => {
  assert.equal(placesCallbacks('starter'), false);
  assert.equal(placesCallbacks('growth'), true);
  assert.equal(placesCallbacks('enterprise'), true);
  for (const plan of ['starter', 'growth', 'enterprise']) {
    const { lines } = buildClientEnvLines({ siteSlug: 's', plan, content: { brand: { phone: '4075551212' } }, webOnly: false });
    assert.ok(lines.includes(`LEAD_CALLBACK=${placesCallbacks(plan) ? 'on' : 'off'}`), plan);
  }
});

test('a Starter agent gets no outbound branch; a Growth agent gets both', () => {
  const starter = voiceConsentInstructions(BIZ, { callbacks: false });
  const growth = voiceConsentInstructions(BIZ, { callbacks: true });
  assert.doesNotMatch(starter, /OUTBOUND CALLBACKS|request you sent on our website|outbound callback reaches voicemail/);
  assert.match(starter, /never places outbound calls/);
  assert.match(growth, /OUTBOUND CALLBACKS/);
  assert.match(growth, /request you sent on our website/);
  // Both keep the approved wording verbatim.
  for (const x of [starter, growth]) {
    assert.ok(x.includes(smsConsentAsk(BIZ)));
    assert.ok(x.includes(inboundOpeningLine(BIZ)));
  }
  assert.doesNotMatch(callerDetailsInstructions({ callbacks: false }), /OUTBOUND|lead_name/);
});

/* ── 2–4. collecting the caller's details ─────────────────────────────────── */

test('an outbound callback does not re-ask the name it just confirmed; inbound asks', () => {
  const growth = callerDetailsInstructions({ callbacks: true });
  assert.match(growth, /NEVER ask for their name or "full name" on an outbound call/);
  assert.match(growth, /\{\{lead_name\}\}/);
  assert.match(growth, /INBOUND CALL \(\{\{direction\}\} is inbound\):\n1\. Name — ask for their full name/);
  assert.match(callerDetailsInstructions({ callbacks: false }), /ask for their full name/);
});

test('the agent confirms the number it is on instead of asking for one', () => {
  for (const callbacks of [false, true]) {
    const x = callerDetailsInstructions({ callbacks });
    assert.match(x, /\{\{user_number\}\}/);
    assert.match(x, /do NOT ask them to recite a number/);
    assert.match(x, /good number to reach them/);
    // Retell leaves an unset variable literal; the agent must not read "{{user_number}}" aloud.
    assert.match(x, /a placeholder too, ask for the best number/);
  }
});

test('"my name at gmail" is built from the name it already has', () => {
  const x = callerDetailsInstructions({ callbacks: true });
  assert.match(x, /together, or with a dot in between/);
  assert.match(x, /work out the actual address yourself/);
});

test('the generator uses these rules, chosen by whether the agent places callbacks', () => {
  const src = readFileSync(resolve(ROOT, 'onboard.js'), 'utf8');
  // The old rule asked every caller for "full name, best callback number".
  assert.doesNotMatch(src, /one item at a time: full name, best callback number/);
  assert.match(src, /\$\{callerDetailsInstructions\(\{ callbacks \}\)\}/);
  assert.match(src, /\$\{voiceConsentInstructions\(content\.brand\.name, \{ callbacks \}\)\}/);
  assert.match(src, /generateRetellPrompt\(site, clientDir, siteSlug, \{ callbacks: placesCallbacks\(intake\.plan\) \}\)/);
  const regen = readFileSync(resolve(ROOT, 'scripts/regenerate-prompt.js'), 'utf8');
  assert.match(regen, /\{ regenerate: true, callbacks \}/);
});

/* ── the re-test, 2026-11-04 16:34: what the first fix still got wrong ──── */

test('the direction comes from Retell\'s {{direction}}, not from guessing at the opening line', () => {
  const growth = voiceConsentInstructions(BIZ, { callbacks: true });
  assert.match(growth, /This call's direction: \{\{direction\}\}\./);
  assert.match(growth, /from that word alone/);
  // The first fix inferred it from the opening line, and got it wrong on a live callback.
  assert.doesNotMatch(growth, /Tell it to read its own opening line in the conversation to know which kind of call this is/);
  assert.doesNotMatch(voiceConsentInstructions(BIZ, { callbacks: false }), /\{\{direction\}\}/);
});

test('the outbound checklist has no name step at all', () => {
  const growth = callerDetailsInstructions({ callbacks: true });
  const [inbound, outbound] = growth.split(/OUTBOUND CALLBACK \(\{\{direction\}\} is outbound\)/);
  assert.ok(outbound, 'an outbound checklist of its own');
  assert.match(inbound, /1\. Name — ask for their full name/);
  assert.doesNotMatch(outbound, /^\d\. Name/m);
  assert.match(outbound, /^1\. Callback number/m);
  assert.match(outbound, /NEVER ask for their name/);
});

test('no example phone number in the generator — the 207 read back as "four oh seven"', () => {
  const src = readFileSync(resolve(ROOT, 'onboard.js'), 'utf8');
  assert.doesNotMatch(src, /four oh seven/);
  assert.match(src, /never write an example phone number into the prompt/);
  assert.match(src, /never "thanks for calling"/);
});

/* ── the third test, 2026-11-04 16:53 ─────────────────────────────────────── */

test('the number reaches the agent already in words — it then read 207 as "seven oh seven"', () => {
  assert.equal(spokenPhoneDigits('+12073181838'), 'two zero seven, three one eight, one eight three eight');
  assert.equal(spokenPhoneDigits('(207) 318-1838'), 'two zero seven, three one eight, one eight three eight');
  assert.equal(spokenPhoneDigits('+442071234567'), '', 'not a US number: the prompt falls back');
  assert.equal(spokenPhoneDigits(undefined), '');
  for (const callbacks of [false, true]) {
    const x = callerDetailsInstructions({ callbacks });
    assert.match(x, /written out in words: \{\{callback_number_spoken\}\}\. Say exactly those words back/);
    assert.match(x, /use \{\{user_number\}\} instead/);
  }
});

/** The route's standalone copy, run for real: strip the TS annotations and evaluate it. */
function routeSpokenPhoneDigits(file) {
  const src = readFileSync(resolve(ROOT, 'lib/site-routes', file), 'utf8');
  const m = /function spokenPhoneDigits\(raw: unknown\): string \{[\s\S]*?\n\}/.exec(src);
  assert.ok(m, `${file} has no spokenPhoneDigits`);
  const js = m[0].replace('(raw: unknown): string', '(raw)').replace('(s: string)', '(s)');
  return new Function(`${js}; return spokenPhoneDigits;`)();
}

test('both routes pass callback_number_spoken, computed by a copy equal to the lib one', () => {
  const cases = ['+12073181838', '2073181838', '12073181838', '+1 (407) 555-0100', '', null, '+15551234', 'abc'];
  for (const file of ['contact.route.ts', 'no-answer.route.ts']) {
    const fn = routeSpokenPhoneDigits(file);
    for (const c of cases) assert.equal(fn(c), spokenPhoneDigits(c), `${file}: ${c}`);
  }
  const contact = readFileSync(resolve(ROOT, 'lib/site-routes/contact.route.ts'), 'utf8');
  assert.match(contact, /retell_llm_dynamic_variables: \{ lead_name: name, callback_number_spoken: spokenPhoneDigits\(toNumber\) \}/);
  const noAnswer = readFileSync(resolve(ROOT, 'lib/site-routes/no-answer.route.ts'), 'utf8');
  assert.match(noAnswer, /retell_llm_dynamic_variables: \{ callback_number_spoken: spokenPhoneDigits\(fromNumber\) \}/);
});

test('the email is worked out from the name, and "my full name" is never part of it', () => {
  // It said "your first and last name all together at G as in golf…", then offered the words
  // "my full name" as the first part.
  const growth = callerDetailsInstructions({ callbacks: true });
  const [inbound, outbound] = growth.split(/OUTBOUND CALLBACK/);
  assert.match(outbound, /the name is the one you already have — \{\{lead_name\}\}/);
  assert.match(inbound, /the name is the one you already have — the name they gave you earlier in this call/);
  assert.match(growth, /The words "my name" or "my full name" are NEVER part of the address/);
  assert.match(growth, /read THAT address back/);
});

test('spelling uses plain letters — never "G as in golf, M as in Mike"', () => {
  assert.match(SPELLING_RULE, /plain letters only/);
  assert.match(SPELLING_RULE, /NEVER use phonetic or military alphabet words/);
  assert.match(SPELLING_RULE, /never say "as in"/);
  const src = readFileSync(resolve(ROOT, 'onboard.js'), 'utf8');
  assert.match(src, /\$\{SPELLING_RULE\}/);
  assert.match(src, /spelling with phonetic or military alphabet words;/);
});

/* ── every fix above reaches a NEW client, not just the two test agents ───── */

test("a new client's prompt generator is handed every live-test fix — Growth and Starter", async () => {
  const { promptGeneratorSystem, loadIntake } = await import('../onboard.js');
  for (const [shape, callbacks] of [['growth', true], ['starter', false]]) {
    const intake = await loadIntake(resolve(ROOT, `test/fixtures/intake/fixture-${shape}/site.ts`));
    assert.equal(placesCallbacks(intake.plan), callbacks, `${shape} fixture's plan`);
    const content = intake.sites[0];
    const sys = promptGeneratorSystem(content, { callbacks });
    const biz = content.brand.name;
    const why = (x) => `${shape}: ${x}`;
    // Approved wording, verbatim.
    assert.ok(sys.includes(smsConsentAsk(biz)), why('consent ask'));
    assert.ok(sys.includes(inboundOpeningLine(biz)), why('inbound disclosure'));
    // The callback number, in words, with the raw-digit fallback.
    assert.match(sys, /\{\{callback_number_spoken\}\}/, why('spoken number'));
    assert.doesNotMatch(sys, /four oh seven/, why('example number'));
    // The email from the name; plain letters; nothing bracketed.
    assert.match(sys, /"my full name" are NEVER part of the address/, why('email'));
    assert.ok(sys.includes(SPELLING_RULE), why('spelling'));
    assert.match(sys, /NO square brackets anywhere/, why('brackets rule'));
    assert.doesNotMatch(sys, /[[\]]/, why('the instructions themselves hold no brackets to imitate'));
    // Outbound rules for callback agents only.
    if (callbacks) {
      assert.match(sys, /This call's direction: \{\{direction\}\}\./, why('direction'));
      assert.match(sys, /OUTBOUND CALLBACK \(\{\{direction\}\} is outbound\)/, why('outbound checklist'));
      assert.match(sys, /never "thanks for calling"/, why('outbound goodbye'));
    } else {
      assert.doesNotMatch(sys, /\{\{direction\}\}|\{\{lead_name\}\}|OUTBOUND CALLBACKS/, why('no outbound branch'));
      assert.match(sys, /ONLY answers inbound calls/, why('inbound only'));
    }
  }
});

test('onboard.js refuses a generated prompt with square brackets, and writes the current routes', () => {
  const src = readFileSync(resolve(ROOT, 'onboard.js'), 'utf8');
  assert.match(src, /const system = promptGeneratorSystem\(content, \{ callbacks \}\);/);
  // checkPromptParity refuses brackets, and much more: see test/prompt-parity.test.mjs.
  assert.match(src, /const parity = checkPromptParity\(/);
  assert.match(src, /if \(parity\.ok === false\) \{/);
  // Every run rewrites these from lib/site-routes, so callback_number_spoken reaches new clients.
  assert.match(src, /\{ asset: 'contact\.route\.ts',\s+dest: 'src\/app\/api\/contact\/route\.ts' \}/);
  assert.match(src, /\{ asset: 'no-answer\.route\.ts', dest: 'src\/app\/api\/voice\/no-answer\/route\.ts' \}/);
});

test('no square brackets in a prompt — it said "[spell the name letter by letter]" aloud', () => {
  const src = readFileSync(resolve(ROOT, 'onboard.js'), 'utf8');
  assert.match(src, /the prompt must contain NO square brackets anywhere/);
  // The previous rule GAVE bracketed examples ("[grouped number]"), and the agent imitated them.
  assert.doesNotMatch(src, /"\[grouped number\]"/);
  for (const callbacks of [false, true]) {
    assert.doesNotMatch(callerDetailsInstructions({ callbacks }), /[[\]]/);
    assert.doesNotMatch(voiceConsentInstructions(BIZ, { callbacks }), /[[\]]/);
  }
});
