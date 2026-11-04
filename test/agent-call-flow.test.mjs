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

import { voiceConsentInstructions, callerDetailsInstructions, smsConsentAsk, inboundOpeningLine } from '../lib/voice-consent.js';
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
    assert.match(x, /placeholder in braces, ask for the best number/);
  }
});

test('"my name at gmail" is built from the name it already has', () => {
  const x = callerDetailsInstructions({ callbacks: true });
  assert.match(x, /build it from the name you already have/);
  assert.match(x, /together, or with a dot in between/);
  assert.match(x, /spell the actual address back letter by letter/);
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

test('the number is read from {{user_number}} only — the 207 read back as "four oh seven"', () => {
  assert.match(callerDetailsInstructions({ callbacks: true }), /EXACTLY the digits \{\{user_number\}\} contains/);
  const src = readFileSync(resolve(ROOT, 'onboard.js'), 'utf8');
  // The generator's own example number was 407; the agent swapped it in for the real area code.
  assert.doesNotMatch(src, /four oh seven/);
  assert.match(src, /never write an example phone number into the prompt/);
});

test('no bracketed placeholder is ever spoken — it said "[spelling out the email address]"', () => {
  const src = readFileSync(resolve(ROOT, 'onboard.js'), 'utf8');
  assert.match(src, /a quoted line must never contain a bracketed placeholder or stage direction/);
  assert.match(src, /NEVER \(consolidated list\): sounding robotic or scripted; saying a bracketed placeholder or stage direction aloud;/);
  assert.match(src, /never "thanks for calling"/);
});
