/**
 * commitAndPush must push even when there is nothing new to commit.
 *
 * It used to `return` on "Nothing to commit — skipping push." That is only safe if the remote is
 * already up to date, which a clean working tree says nothing about. A run whose commit landed but
 * whose push failed (bad token, network, a rejected push) leaves HEAD ahead of origin; every later
 * run then saw a clean tree and skipped the push again, so the provisioning commit never reached
 * GitHub, Vercel never built it, and nothing reported an error.
 *
 * onboard.js is a script, not a module, so this reads the source — same approach as the
 * credential guards in secrets.test.mjs.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ONBOARD = readFileSync(new URL('../onboard.js', import.meta.url), 'utf8');

function commitAndPushBody() {
  const start = ONBOARD.indexOf('function commitAndPush(');
  assert.ok(start >= 0, 'commitAndPush not found in onboard.js');
  return ONBOARD.slice(start, ONBOARD.indexOf('\n}', start));
}

test('a clean tree does not return before the push', () => {
  const body = commitAndPushBody();
  const pushAt = body.search(/\bpush\b[^\n]*HEAD:main/);
  assert.ok(pushAt >= 0, 'expected the git push in commitAndPush');
  // The only early return allowed before the push is the dry-run one.
  const beforePush = body
    .slice(0, pushAt)
    .split(/\r?\n/)
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n');
  // Drop the dry-run block by its closing brace at function-body indent (its log line has
  // `${…}` braces of its own, so the first `}` is not the end of it).
  const afterDry = beforePush.replace(/if \(DRY_RUN\) \{[\s\S]*?\r?\n {2}\}/, '');
  assert.notEqual(afterDry, beforePush, 'expected a DRY_RUN block in commitAndPush');
  assert.doesNotMatch(afterDry, /\breturn\b/, 'commitAndPush returns before pushing on a non-dry run');
});
