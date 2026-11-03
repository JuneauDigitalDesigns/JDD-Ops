/**
 * Re-patching an EXISTING client's post-call clone from the current master.
 *
 * **Why this exists.** Every deliberate master edit since 2026-11-02 — SMS consent, total selects,
 * the connected-calls filter, the agency HTTP hand-off — reached exactly one clone, the growth
 * fixture's, carried there by hand from a scratch script. Every other clone stayed on the design
 * it was cloned with.
 *
 * **The trap it must not fall into.** A clone's first module is bound to the clone's OWN webhook.
 * Copying the master's blueprint wholesale would bind the clone to the master's hook (the scratch
 * script's first preview showed it: clone hook 3013197, master hook 2421720). So the trigger is
 * kept and only what follows it is rebuilt, through the real `patchPostCallBlueprint`.
 *
 * Asserted on the RECORDED master. The "clone" is that master with its trigger bound to a
 * different hook, which is exactly how a real clone differs from it.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { CALL_LOG_FIELDS } from '../onboard.js';
import { rebuildCloneBlueprint, checkCloneTriggerKept, describeFlow } from '../lib/post-call-repatch.js';
import {
  checkBlueprintFieldsResolve,
  checkBlueprintNoDatastore,
  checkConnectedCallsOnly,
  checkOwnerBriefViaAgency,
  checkSelectMappingsTotal,
  fieldMapFromSpec,
} from '../lib/onboard-checks.js';
import { CALL_OUTCOME_CASES, shouldLog } from '../lib/call-outcomes.js';
import { masterBlueprint, masterFieldMap } from './helpers/fixtures.mjs';

const TOKEN = '9'.repeat(64);
const CLONE_HOOK = 3013197;
const clientMap = () => fieldMapFromSpec(CALL_LOG_FIELDS, { tableId: 'tblCLIENT00000001' });

/** A clone as Make leaves it: the master's design at clone time, triggered by its own hook. */
function oldClone() {
  const bp = masterBlueprint();
  bp.flow[0].parameters = { ...bp.flow[0].parameters, hook: CLONE_HOOK };
  // An out-of-date clone: still has a Twilio module and none of the newer modules.
  bp.flow = [bp.flow[0], { id: 8, module: 'airtable:ActionCreateRecord', version: 3, mapper: { record: {} } }, { id: 9, module: 'twilio:SendSMS', version: 2, mapper: {} }];
  return bp;
}

const rebuild = (clone = oldClone()) =>
  rebuildCloneBlueprint({ clone, master: masterBlueprint(), baseId: 'appCLIENTbase0001', ingestToken: TOKEN, masterMap: masterFieldMap(), clientMap: clientMap() });

test('the clone keeps its OWN webhook trigger — never the master hook', () => {
  const next = rebuild();
  assert.equal(next.flow[0].parameters.hook, CLONE_HOOK);
  assert.notEqual(next.flow[0].parameters.hook, masterBlueprint().flow[0].parameters.hook);
  assert.equal(checkCloneTriggerKept({ before: oldClone(), after: next }).ok, true);
});

test('copying the master wholesale is caught: the trigger would change', () => {
  // The scratch script's first draft would have done exactly this.
  assert.equal(checkCloneTriggerKept({ before: oldClone(), after: masterBlueprint() }).ok, false);
});

test('everything after the trigger is the current master, patched for this client', () => {
  const next = rebuild();
  const cm = clientMap();
  for (const c of [
    checkBlueprintFieldsResolve({ blueprint: next, clientMap: cm, siteTag: null }),
    checkBlueprintNoDatastore({ blueprint: next }),
    checkSelectMappingsTotal({ blueprint: next, fieldMap: cm }),
    checkConnectedCallsOnly({ blueprint: next, cases: CALL_OUTCOME_CASES, shouldLog }),
    checkOwnerBriefViaAgency({ blueprint: next, ingestToken: TOKEN }),
  ]) {
    assert.equal(c.ok, true, `${c.id}: ${c.detail}`);
  }
  assert.equal(next.flow.filter((m) => (m.module ?? '').startsWith('twilio')).length, 0, 'the stale Twilio module is gone');
});

test('neither the master nor the live clone object is mutated', () => {
  const master = masterBlueprint();
  const clone = oldClone();
  const [m0, c0] = [JSON.stringify(master), JSON.stringify(clone)];
  rebuildCloneBlueprint({ clone, master, baseId: 'appX', ingestToken: TOKEN, masterMap: masterFieldMap(), clientMap: clientMap() });
  assert.equal(JSON.stringify(master), m0);
  assert.equal(JSON.stringify(clone), c0);
});

test('a blueprint that is not webhook-triggered is refused, not guessed at', () => {
  const clone = oldClone();
  clone.flow[0].module = 'airtable:ActionCreateRecord';
  assert.throws(() => rebuild(clone), /not a webhook trigger/);
});

test('the before/after summary never carries the token', () => {
  assert.ok(!describeFlow(rebuild()).includes(TOKEN));
});
