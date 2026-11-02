/**
 * The forward ring window, and the ceiling that keeps callers out of voicemail.
 *
 * Inbound routing dials `CLIENT_FORWARD_PHONE` with this value as the Twilio `<Dial timeout>`.
 * If the forward rings long enough for the owner's carrier voicemail to answer, Twilio scores
 * the call as ANSWERED (`DialCallStatus=completed`), the no-answer branch never fires, and the
 * caller lands in a voicemail box instead of the receptionist the client is paying for. The
 * failure is silent: the number looks configured and the agent looks healthy.
 *
 * ── Why this file also reads documentation ──────────────────────────────────
 *
 * The invariant existed only as prose, and the prose disagreed with itself. RUNBOOK.md said
 * "default 25" while onboard.js, voice.route.ts, CLAUDE.md and the Starter handoff all said 15
 * — and that 25 had already propagated into the console's plan-upgrade route and into the
 * Environment field's placeholder, with a max of 60. Every client upgraded to Growth through
 * the console would have inherited a ring window that can route callers past the receptionist.
 *
 * So the docs are asserted alongside the code. Prose that can silently steer behaviour is part
 * of the behaviour.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildClientEnvLines,
  clampRingSeconds,
  RING_SECONDS_DEFAULT,
  RING_SECONDS_MIN,
  RING_SECONDS_MAX,
} from '../lib/client-env.js';
import { envLinesToObject } from '../lib/onboard-checks.js';
import { makeIntake } from './helpers/fixtures.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

const ringOf = (prev = {}) =>
  envLinesToObject(
    buildClientEnvLines({
      siteSlug: 'fixture',
      plan: 'growth',
      content: makeIntake().sites[0],
      webOnly: false,
      prev,
      env: {},
    }).lines,
  ).CLIENT_FORWARD_RING_SECONDS;

test('the shared constants are the documented values', () => {
  assert.equal(RING_SECONDS_DEFAULT, 15, '15s is roughly 2–3 rings and clears the earliest carrier voicemail');
  assert.equal(RING_SECONDS_MIN, 5);
  assert.equal(RING_SECONDS_MAX, 20, 'above ~20s carrier voicemail answers and Twilio scores the call completed');
  assert.ok(RING_SECONDS_DEFAULT < RING_SECONDS_MAX, 'the default must sit inside the band');
});

test('a fresh client gets the default', () => {
  assert.equal(ringOf(), String(RING_SECONDS_DEFAULT));
});

test('an operator-tuned value inside the band is preserved', () => {
  assert.equal(ringOf({ CLIENT_FORWARD_RING_SECONDS: '12' }), '12');
});

test('a value above the ceiling is clamped, not honoured', () => {
  // The exact shape of the bug: 25 was being written deliberately.
  assert.equal(ringOf({ CLIENT_FORWARD_RING_SECONDS: '25' }), String(RING_SECONDS_MAX));
  assert.equal(ringOf({ CLIENT_FORWARD_RING_SECONDS: '60' }), String(RING_SECONDS_MAX));
});

test('a value below the floor is raised', () => {
  assert.equal(ringOf({ CLIENT_FORWARD_RING_SECONDS: '1' }), String(RING_SECONDS_MIN));
});

test('clampRingSeconds falls back to the default for anything unparseable', () => {
  for (const raw of ['', null, undefined, 'abc', '0', '-5']) {
    assert.equal(clampRingSeconds(raw), RING_SECONDS_DEFAULT, `for ${JSON.stringify(raw)}`);
  }
});

test('the route written into client repos clamps to the same band', () => {
  // voice.route.ts is copied verbatim into each CLIENT repo, which has no dependency on
  // jdd-ops or @jdd/schema, so it cannot import the constants — the same standalone-copy
  // exception @jdd/schema's phone.ts documents for its own inline toE164. Hence: assert equal.
  const src = read('lib/site-routes/voice.route.ts');
  assert.match(src, new RegExp(`const RING_DEFAULT = ${RING_SECONDS_DEFAULT};`));
  assert.match(src, new RegExp(`const RING_MIN = ${RING_SECONDS_MIN};`));
  assert.match(src, new RegExp(`const RING_MAX = ${RING_SECONDS_MAX};`));
  assert.match(src, /Math\.min\(RING_MAX, Math\.max\(RING_MIN, ringSecondsRaw\)\)/,
    'the env value must be clamped, not applied verbatim');
});

test('the console env field offers only the safe band', () => {
  // envFields.ts is bundled by Next and imported by client components, so it cannot
  // dynamic-import from the ops root the way reconcileProbes.ts does — another pinned copy.
  const src = read('console/src/lib/envFields.ts');
  const field = src.slice(src.indexOf("key: 'CLIENT_FORWARD_RING_SECONDS'"));
  const block = field.slice(0, field.indexOf('},'));
  assert.match(block, new RegExp(`min: ${RING_SECONDS_MIN},`));
  assert.match(block, new RegExp(`max: ${RING_SECONDS_MAX},`));
  assert.match(block, new RegExp(`placeholder: '${RING_SECONDS_DEFAULT}'`),
    'the placeholder is what an operator types when unsure; it must suggest the default');
});

test('the console plan route no longer hardcodes a ring window', () => {
  // It derives the whole template from lib/client-env.js now. A literal here is how the 25 got
  // in, so its absence is worth asserting rather than trusting.
  //
  // Comment lines are stripped first: the route legitimately *documents* the old
  // `CLIENT_FORWARD_RING_SECONDS=25` bug in prose, and an assertion about code should not trip
  // over an explanation of why the code is the way it is.
  const code = read('console/src/app/api/manage/plan/route.ts')
    .split(/\r?\n/)
    .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
    .join('\n');
  assert.ok(
    !/CLIENT_FORWARD_RING_SECONDS\s*[:=]\s*['"]?\d/.test(code),
    'the plan route must not assign a ring-window literal',
  );
  assert.match(code, /loadClientEnv/, 'it should use the shared builder instead');
});

test('every document states the same default', () => {
  // RUNBOOK.md said 25 while everything else said 15, and that is where the 25s came from.
  for (const rel of ['CLAUDE.md', 'RUNBOOK.md', 'HANDOFF-starter-receptionist.md']) {
    const src = read(rel);
    if (!/CLIENT_FORWARD_RING_SECONDS/.test(src)) continue;
    const wrongDefault = /CLIENT_FORWARD_RING_SECONDS`? \(default \*{0,2}(\d+)/.exec(src);
    if (wrongDefault) {
      assert.equal(
        Number(wrongDefault[1]),
        RING_SECONDS_DEFAULT,
        `${rel} documents a default of ${wrongDefault[1]}s, but the code writes ${RING_SECONDS_DEFAULT}s`,
      );
    }
  }
});

test('no document recommends a value at or above the ceiling', () => {
  const src = read('RUNBOOK.md');
  assert.ok(
    !/CLIENT_FORWARD_RING_SECONDS`? \(default \*{0,2}2[5-9]/.test(src),
    'RUNBOOK.md must not reintroduce a 25s default',
  );
});
