// The sales-call SMS registration form. From the 2026-11-08 test run: Submit came back
// "Check: Website, Mobile" on a form prefilled from the order, because the order keeps the phone
// as typed ("(407) 555-0142") and the registration check wants E.164. On that code the prefill
// went through untouched and this file doesn't exist.
//
// The checks here are the real registration validators, not a copy of their rules.
//
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toE164 } from '@jdd/schema';
import { a2pTestMode, formWebsite } from '../src/lib/a2pFormRules.ts';
import { validateBusinessInput, validateRepInput } from '../../lib/a2p-identity.js';

const rep = { firstName: 'Arthur', lastName: 'Dent', email: 'arthur@arthursplumbing.com' };

test('the phone as typed on the order passes the registration check', () => {
  assert.equal(validateRepInput({ ...rep, phone: '(407) 555-0142' }, 'sole-proprietor').ok, false, 'as typed, it is refused');
  assert.equal(toE164('(407) 555-0142'), '+14075550142');
  assert.equal(validateRepInput({ ...rep, phone: toE164('(407) 555-0142') }, 'sole-proprietor').ok, true);
});

test('a website typed without https:// passes; nonsense does not become valid', () => {
  const biz = (websiteUrl) =>
    validateBusinessInput({ legalBusinessName: 'x', businessType: 'y', businessIndustry: 'z', websiteUrl, ein: '12-3456789' });
  const fields = (r) => (r.ok ? [] : r.fields);
  assert.ok(fields(biz('arthursplumbing.com')).includes('websiteUrl'), 'bare domain is refused as typed');
  assert.ok(!fields(biz(formWebsite('arthursplumbing.com'))).includes('websiteUrl'));
  assert.equal(formWebsite('https://a.co'), 'https://a.co');
  assert.equal(formWebsite(''), '');
  assert.equal(formWebsite('none'), 'none');
});

test('test mode needs the explicit flag and no Twilio credentials', () => {
  assert.equal(a2pTestMode({ A2P_TEST_MODE: '1' }), true);
  assert.equal(a2pTestMode({}), false, 'losing the credentials must not fake a filing');
  assert.equal(a2pTestMode({ A2P_TEST_MODE: '1', TWILIO_ACCOUNT_SID: 'AC1', TWILIO_AUTH_TOKEN: 't' }), false);
  assert.equal(a2pTestMode({ A2P_TEST_MODE: '1', TWILIO_AUTH_TOKEN: 't' }), false);
});

test('the form uses the rules, labels test mode, and asks only for what Add later needs', () => {
  const src = readFileSync(new URL('../src/components/manage/A2pCloseWizard.tsx', import.meta.url), 'utf8');
  assert.match(src, /toE164\(raw\) \?\? \(raw \?\? ''\)/);
  assert.match(src, /phone: formPhone\(prefill\.repPhone\)/);
  assert.match(src, /phone: formPhone\(rep\.phone\)/);
  assert.match(src, /websiteUrl: formWebsite\(websiteUrl\)/);
  assert.match(src, /Test mode: nothing is sent to Twilio or saved\./);
  assert.match(src, /\{!addLater && <Input label="Website"/);
});
