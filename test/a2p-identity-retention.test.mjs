/**
 * A2P identity — the pure half of the retention tests, moved from the agency repo
 * (`test/a2p-identity-retention.test.mjs`) with the modules they cover (plan decision 7).
 *
 * **Preventive, and deliberately so.** An EIN written anywhere is silent (nothing errors),
 * permanent and unrecoverable — you cannot un-leak an identifier. The agency suite's draft-store
 * half (the wizard autosave tripwires and the `WizardData` membership test) stays in that repo,
 * because the code it guards does. The vendor half lives in `a2p-register.test.mjs`, rewritten
 * for the per-step chain that replaced the one-request `createIdentityObjects`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  findTaxIdPaths,
  isEinShaped,
  looksLikeTaxId,
  scrubVendorMessage,
  validateBusinessInput,
  validateRepInput,
  validateTrustProductInput,
  buildRepEndUserAttributes,
  buildTrustEndUser,
} from '../lib/a2p-identity.js';
import { assertNoTaxId } from '../lib/a2p-registration-store.js';

const EIN = '47-1234567';
const EIN_BARE = '471234567';

test('the tax-ID guard catches an EIN under any field name, at any depth', () => {
  // A value-shape check rather than a key denylist: a denylist is one rename from leaking.
  for (const value of [
    { ein: EIN },
    { taxId: EIN },
    { a2p: { businessRegistrationNumber: EIN } },
    { answers: [{ label: 'EIN', value: EIN }] },
    { notes: `our EIN is ${EIN}, thanks` },
  ]) {
    assert.notDeepEqual(findTaxIdPaths(value), [], `missed an EIN in ${JSON.stringify(value)}`);
  }
  assert.throws(() => assertNoTaxId({ nested: { renamed: EIN } }, 'test'), /\$\.nested\.renamed/);
});

test('the tax-ID guard does not fire on the data a registration record holds', () => {
  // A tripwire that fires on ordinary data is one somebody switches off. Twilio SIDs are 34
  // characters of hex and must never trip it, nor phones, ZIP+4 or ISO dates.
  const record = {
    profileSid: 'BU09473483d4fd6808a200190e84309592',
    businessEndUserSid: 'IT3660d6717ee400692c2cc46d15194f02',
    phone: '+14075551234',
    phonePretty: '(407) 555-1234',
    zipPlusFour: '32801-5123',
    at: '2026-11-02T12:00:00.000Z',
  };
  assert.deepEqual(findTaxIdPaths(record), []);
  assert.equal(looksLikeTaxId('4075551234'), false);
  assert.equal(looksLikeTaxId('555-1234'), false);
  assert.equal(looksLikeTaxId(EIN), true);
});

test('the EIN format check accepts only NN-NNNNNNN', () => {
  assert.equal(isEinShaped(EIN), true);
  assert.equal(isEinShaped(' 47-1234567 '), true);
  assert.equal(isEinShaped(EIN_BARE), false, 'an unhyphenated EIN is a typo we can catch');
  assert.equal(isEinShaped('47-123456'), false);
  assert.equal(isEinShaped('47-12345678'), false);
});

test('validation reports field names, never values', () => {
  const result = validateBusinessInput({ ein: EIN, businessIndustry: 'PLUMBING' });
  assert.equal(result.ok, false);
  assert.ok(result.fields.includes('legalBusinessName'));
  assert.ok(result.fields.includes('businessIndustry'), 'industry is an enum, not free text');
  assert.ok(!result.fields.includes('ein'));
  assert.deepEqual(findTaxIdPaths(result), []);
  assert.equal(
    validateBusinessInput({ legalBusinessName: 'A', businessType: 'Limited Liability Company', businessIndustry: 'CONSUMER', websiteUrl: 'https://a.co', ein: EIN }).ok,
    false,
    "the runbook's spelling of LLC is not one Twilio accepts",
  );
});

test('the sole-prop person and trust EndUsers carry only what their policies list', () => {
  const rep = { firstName: 'A', lastName: 'B', email: 'a@b.co', phone: '+14075550123' };
  assert.equal(validateRepInput(rep, 'sole-proprietor').ok, true, 'no title fields on the starter profile');
  assert.equal(validateRepInput(rep, 'standard').ok, false, 'the authorized rep needs both titles');
  assert.equal('job_position' in buildRepEndUserAttributes(rep, 'sole-proprietor'), false);

  assert.equal(validateTrustProductInput({ brandName: 'A', mobile: '4075550123' }, 'sole-proprietor').ok, false, 'mobile must be E.164');
  const { attributes } = buildTrustEndUser({ brandName: 'A', mobile: '+14075550123' }, 'sole-proprietor');
  assert.equal('vertical' in attributes, false, 'an optional vertical is omitted, not sent empty');
  const priv = buildTrustEndUser({ companyType: 'private', brandContactEmail: 'ops@x.co' }, 'standard');
  assert.equal('stock_ticker' in priv.attributes, false);
});

test('scrubVendorMessage removes submitted values and tax-ID shapes alike', () => {
  const body = `Invalid business_registration_number: ${EIN}; rep arthur@arthursplumbing.com unknown`;
  const scrubbed = scrubVendorMessage(body, [EIN, 'arthur@arthursplumbing.com']);
  assert.ok(!scrubbed.includes(EIN));
  assert.ok(!scrubbed.includes('arthur@arthursplumbing.com'));
  assert.match(scrubbed, /business_registration_number/);
  assert.ok(!scrubVendorMessage('saw 99-8887776 in there', []).includes('99-8887776'));
});
