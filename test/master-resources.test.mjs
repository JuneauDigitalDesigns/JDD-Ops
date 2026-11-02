/**
 * No client may be wired into a MASTER resource.
 *
 * The bug this encodes: `clients/_e2e_test_growth` had `AIRTABLE_BASE_ID` set to the master
 * call-log base, and its Retell agent's `webhook_url` pointed at the master scenario's own
 * hook. So the one client that existed to prove the provisioning pipeline ran entirely through
 * the master and never once exercised `cloneAndWirePostCall`. Five bugs in that function
 * shipped behind it — the fixture was proving the master works, which was never in question.
 *
 * Sharing a master resource does not look broken. It looks like a working client whose calls
 * land in someone else's log.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { checkNotMasterBase, checkNotMasterHook } from '../lib/onboard-checks.js';
import { loadFixture, masterBlueprint, masterFieldMap } from './helpers/fixtures.mjs';

// Taken from the recordings so the test tracks the real master rather than a hardcoded guess.
const MASTER_BASE = masterFieldMap().baseId;
const MASTER_SCENARIO = loadFixture('make/scenario.json').scenario;
const MASTER_HOOK_URL = loadFixture('make/hooks-list.json').hooks.find(
  (h) => h.id === MASTER_SCENARIO.hookId,
)?.url;

const CLONE_HOOK_URL = 'https://hook.us2.make.com/a-per-client-clone-token';

test('the recordings still describe a master with both a base and a hook', () => {
  assert.ok(MASTER_BASE, 'master base id must be resolvable from the recorded schema');
  assert.ok(MASTER_HOOK_URL, 'the master scenario must still own a hook');
});

test('a client pointed at the master Airtable base is refused', () => {
  const c = checkNotMasterBase({ clientBaseId: MASTER_BASE, masterBaseId: MASTER_BASE });
  assert.equal(c.ok, false);
  assert.match(c.detail, /master base/);
});

test('a client with its own base passes', () => {
  const c = checkNotMasterBase({ clientBaseId: 'appCLIENTownbase1', masterBaseId: MASTER_BASE });
  assert.equal(c.ok, true);
});

test('an unresolved base is null, not a pass', () => {
  assert.equal(checkNotMasterBase({ clientBaseId: null, masterBaseId: MASTER_BASE }).ok, null);
  assert.equal(checkNotMasterBase({ clientBaseId: 'appX', masterBaseId: null }).ok, null);
});

test('a recorded webhook pointing at the master hook is refused', () => {
  // Fatal because cloneAndWirePostCall short-circuits when RETELL_POST_CALL_WEBHOOK_URL is
  // already set — the run would reuse the master hook rather than replace it.
  const c = checkNotMasterHook({
    clientWebhookUrl: MASTER_HOOK_URL,
    agentWebhookUrl: null,
    masterHookUrl: MASTER_HOOK_URL,
  });
  assert.equal(c.ok, false);
  assert.match(c.detail, /RETELL_POST_CALL_WEBHOOK_URL/);
});

test('a live AGENT pointing at the master hook is caught even when the env file is silent', () => {
  // This is the signal that actually found the e2e fixture: its .env.local had no webhook key
  // at all, so a check reading only the client's env would have declared it clean.
  const c = checkNotMasterHook({
    clientWebhookUrl: null,
    agentWebhookUrl: MASTER_HOOK_URL,
    masterHookUrl: MASTER_HOOK_URL,
  });
  assert.equal(c.ok, false);
  assert.match(c.detail, /Retell agent/);
});

test('both sources offending is reported together, with agreeing grammar', () => {
  const c = checkNotMasterHook({
    clientWebhookUrl: MASTER_HOOK_URL,
    agentWebhookUrl: MASTER_HOOK_URL,
    masterHookUrl: MASTER_HOOK_URL,
  });
  assert.equal(c.ok, false);
  assert.match(c.detail, / point at /, 'two offenders take the plural verb');
});

test('one offender takes the singular verb', () => {
  const c = checkNotMasterHook({
    clientWebhookUrl: MASTER_HOOK_URL,
    agentWebhookUrl: null,
    masterHookUrl: MASTER_HOOK_URL,
  });
  assert.match(c.detail, / points at /);
});

test('a per-client clone passes', () => {
  const c = checkNotMasterHook({
    clientWebhookUrl: CLONE_HOOK_URL,
    agentWebhookUrl: CLONE_HOOK_URL,
    masterHookUrl: MASTER_HOOK_URL,
  });
  assert.equal(c.ok, true);
});

test('nothing wired yet is null, not a pass', () => {
  const c = checkNotMasterHook({ clientWebhookUrl: null, agentWebhookUrl: null, masterHookUrl: MASTER_HOOK_URL });
  assert.equal(c.ok, null);
});

test('no master hook resolved is null — absent credentials never read as verified', () => {
  const c = checkNotMasterHook({
    clientWebhookUrl: MASTER_HOOK_URL,
    agentWebhookUrl: null,
    masterHookUrl: null,
  });
  assert.equal(c.ok, null, 'without the master hook we cannot know, and must not claim to');
});

test('the e2e fixture is not pointed at the master base', () => {
  // The decoupling itself, pinned. If AIRTABLE_BASE_ID is ever pasted back, this fails here
  // rather than the next provisioning run quietly logging into the shared master base.
  //
  // This used to assert the id was EMPTY, as a stand-in for "not the master's". That held only
  // while the fixture sat decoupled and unprovisioned; the moment it was provisioned properly
  // and got its OWN base, the stand-in failed the very state it existed to produce. Assert the
  // real rule, through the same predicate the provisioning run uses.
  const path = fileURLToPath(new URL('../clients/_e2e_test_growth/.env.local', import.meta.url));
  if (!existsSync(path)) return; // fixture client not present in this checkout (e.g. CI)
  const env = readFileSync(path, 'utf8');
  const line = env.split(/\r?\n/).find((l) => l.startsWith('AIRTABLE_BASE_ID='));
  assert.ok(line !== undefined, 'the key should still be present');
  const clientBaseId = line.slice('AIRTABLE_BASE_ID='.length).trim();

  const masterBaseId = masterBlueprint().flow.find((m) =>
    (m.module ?? '').startsWith('airtable'),
  )?.mapper?.base;
  assert.ok(masterBaseId, 'the recorded master blueprint should name the master base');

  // `ok === false` is the only verdict that means "this IS the master base". An unprovisioned
  // fixture degrades to null, which is not a pass anywhere else and is not treated as one here.
  const c = checkNotMasterBase({ clientBaseId, masterBaseId });
  assert.notEqual(c.ok, false, c.detail);
});
