/**
 * lib/call-log-fields.js — the `Call Log` columns every client base gets.
 *
 * ONE copy. onboard.js creates bases from it, lib/repair-ops.js recreates a missing table from
 * it, and the tests compare it against a recorded read of the Make master's base. It used to be
 * two arrays, and they had drifted badly: repair-ops' copy had 7 of the 11 columns (no Email,
 * Address, Recording URL or Priority) and made `Call type` free text, so a repaired base was
 * silently missing a third of every logged call. Import it; never copy it.
 *
 * The real contract is with the Make master's Airtable module. Step 8c remaps the cloned
 * blueprint's record keys BY COLUMN NAME, so a name present on one side and not the other
 * silently drops that value from every logged call. Freezing a captured client base as a
 * fixture would only prove what one historical base looked like; checking this array proves
 * what the next client base will look like.
 *
 * The singleSelect choices are the master's literal values, not prettier labels. The master
 * maps `{{1.call.direction}}` straight into `Call type`, which Retell emits as
 * "inbound"/"outbound", and the module runs with `typecast: false`. Choices of
 * "Inbound"/"Outbound callback" therefore rejected the write as an invalid option and failed
 * the whole row — the casing has to match what Retell actually sends. `Priority` and
 * `SMS consent` take their choices from the Retell analysis enums that feed them, for the same
 * reason.
 */
import { CALLER_PRIORITY_CHOICES, SMS_CONSENT_CHOICES } from './voice-consent.js';

const choicesOf = (names) => ({ choices: names.map((name) => ({ name })) });

export const CALL_LOG_FIELDS = [
  { name: 'Date', type: 'dateTime', options: { dateFormat: { name: 'us' }, timeFormat: { name: '12hour' }, timeZone: 'client' } },
  { name: 'Caller name', type: 'singleLineText' },
  { name: 'Caller number', type: 'phoneNumber' },
  { name: 'Summary', type: 'multilineText' },
  { name: 'Duration (seconds)', type: 'number', options: { precision: 0 } },
  {
    name: 'Call type',
    type: 'singleSelect',
    options: { choices: [{ name: 'inbound' }, { name: 'outbound' }] },
  },
  { name: 'Email', type: 'email' },
  { name: 'Address', type: 'singleLineText' },
  { name: 'Recording URL', type: 'url' },
  { name: 'Priority', type: 'singleSelect', options: choicesOf(CALLER_PRIORITY_CHOICES) },
  // The caller's spoken answer to the closing SMS ask — see lib/voice-consent.js for the
  // contract. Portal-side promotion into msg-consent storage reads this column.
  { name: 'SMS consent', type: 'singleSelect', options: choicesOf(SMS_CONSENT_CHOICES) },
  // Nothing writes Outcome — the master scenario has no mapping for it. It exists for the
  // owner to set by hand while triaging the log, which is why it keeps human-cased labels.
  {
    name: 'Outcome',
    type: 'singleSelect',
    options: {
      choices: [
        { name: 'Qualified' },
        { name: 'Not qualified' },
        { name: 'Follow-up needed' },
        { name: 'No answer' },
        { name: 'Voicemail' },
      ],
    },
  },
];
