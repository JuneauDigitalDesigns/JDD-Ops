/**
 * onboard.js must never print a credential.
 *
 * On 2026-11-02 a live run printed the GitHub token and the portal test password to stdout.
 * `commitAndPush` built `https://<token>@github.com/…` and `run()` echoes every command it runs;
 * the test-login step printed the password outright. stdout is narrated into the console UI and
 * pasted into chats and issues, and both values ended up in an AI session transcript. The token
 * had to be rotated.
 *
 * The fix has two layers and both are tested: the token never enters a URL or argv (an auth
 * header set through git's GIT_CONFIG_* environment), and `run()` redacts URL credentials in
 * whatever it echoes. The first layer is the one that matters — with the token in the URL, git
 * prints that URL itself on any failed push, past any redaction onboard.js could apply.
 *
 * That the header genuinely authenticates was checked against a private repo, not assumed: a
 * read-only `git ls-remote` succeeded with it and failed ("could not read Username… terminal
 * prompts disabled") without it.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { redactUrlCredentials, gitAuthEnv } from '../lib/secrets.js';

// Shaped like a classic PAT; not a real one.
const TOKEN = 'ghp_' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8';

test('a token-in-URL push command is redacted', () => {
  const cmd = `git -c credential.helper= push https://${TOKEN}@github.com/Org/repo.git HEAD:main`;
  const out = redactUrlCredentials(cmd);
  assert.ok(!out.includes(TOKEN), `token survived redaction: ${out}`);
  assert.match(out, /https:\/\/\*\*\*@github\.com\/Org\/repo\.git/);
});

test('user:password userinfo is redacted too', () => {
  const out = redactUrlCredentials('curl https://admin:hunter2@example.com/x');
  assert.ok(!out.includes('hunter2'));
  assert.ok(!out.includes('admin:'));
});

test('URLs without credentials, and plain text, pass through unchanged', () => {
  for (const s of [
    'git push https://github.com/Org/repo.git HEAD:main',
    'git commit -m "feat: initial provisioning for Acme"',
    'email me at owner@example.com',
  ]) {
    assert.equal(redactUrlCredentials(s), s);
  }
});

test('gitAuthEnv never carries the token in plain form', () => {
  const env = gitAuthEnv(TOKEN, {});
  for (const [k, v] of Object.entries(env)) {
    assert.ok(!k.includes(TOKEN) && !String(v).includes(TOKEN), `${k} carries the raw token`);
  }
  // …but does carry it, encoded, in a header git will send.
  const header = env.GIT_CONFIG_VALUE_0;
  assert.match(header, /^Authorization: Basic /);
  const decoded = Buffer.from(header.replace('Authorization: Basic ', ''), 'base64').toString();
  assert.equal(decoded, `x-access-token:${TOKEN}`);
});

test('the header is scoped to github.com, so no other host ever receives it', () => {
  const env = gitAuthEnv(TOKEN, {});
  assert.equal(env.GIT_CONFIG_KEY_0, 'http.https://github.com/.extraheader');
});

test('existing GIT_CONFIG_* entries are appended to, not overwritten', () => {
  // Overwriting index 0 would silently discard whatever config the caller had already set.
  const env = gitAuthEnv(TOKEN, { GIT_CONFIG_COUNT: '2' });
  assert.equal(env.GIT_CONFIG_COUNT, '3');
  assert.equal(env.GIT_CONFIG_KEY_2, 'http.https://github.com/.extraheader');
  assert.equal(env.GIT_CONFIG_KEY_0, undefined, 'must not touch an existing slot');
});

test('a missing token is an error, not an unauthenticated push', () => {
  assert.throws(() => gitAuthEnv(undefined, {}), /no GitHub token/);
});

// ─── and that onboard.js actually uses all of it ──────────────────────────────
//
// Every test above drives lib/secrets.js directly. Put the token back in the URL, or print the
// password again, and all of them still pass. These read the source so a revert fails in CI.

const ONBOARD = readFileSync(new URL('../onboard.js', import.meta.url), 'utf8');

/** onboard.js with comment lines removed, so code that DOCUMENTS the old bug doesn't trip the guard. */
const ONBOARD_CODE = ONBOARD.split(/\r?\n/)
  .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
  .join('\n');

test('onboard.js never builds a URL with a credential in it', () => {
  assert.doesNotMatch(
    ONBOARD_CODE,
    /https:\/\/\$\{[^}]*\}@/,
    'a template literal is putting a variable into URL userinfo — the token-in-URL push is back',
  );
});

test('the push authenticates through gitAuthEnv', () => {
  const start = ONBOARD.indexOf('function commitAndPush(');
  const body = ONBOARD.slice(start, ONBOARD.indexOf('\n}', start));
  assert.match(body, /gitAuthEnv\(/, 'commitAndPush must authenticate via the header env');
});

test('run() redacts what it echoes', () => {
  const start = ONBOARD.indexOf('function run(');
  const body = ONBOARD.slice(start, ONBOARD.indexOf('\n}', start));
  const echoes = body.match(/(console\.log|dryLog)\([^)]*\$\{[^}]*\}/g) ?? [];
  assert.ok(echoes.length >= 2, 'expected the live and dry-run echoes');
  for (const e of echoes) assert.match(e, /redactUrlCredentials\(/, `unredacted echo: ${e}`);
});

test('the portal test password is never interpolated into output', () => {
  assert.doesNotMatch(
    ONBOARD,
    /console\.(log|warn|error)\([^\n]*\$\{testPassword\}/,
    'the test-login step is printing the password again',
  );
});
