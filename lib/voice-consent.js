/**
 * lib/voice-consent.js — the recording disclosure, the SMS consent ask, and the post-call
 * analysis schema that records the answer. One copy, imported by onboard.js (new agents),
 * scripts/update-agent-prompt.js (existing agents) and the test suite.
 *
 * ── Why the wording lives in code, not in the generated prompt ──────────────
 *
 * These sentences are spoken to members of the public and become the evidence of consent. The
 * operator approved them word for word on 2026-11-02. A generated prompt paraphrases; a constant
 * does not. So the opening line is set as the LLM's `begin_message` (spoken verbatim the moment
 * the call connects, before the caller can say anything), and the closing ask is injected into
 * the generator's instructions as a quoted line it must reproduce exactly.
 *
 * Change a word here and you have changed what every future caller hears — get the operator's
 * sign-off first, exactly as for the web form's disclosure in @jdd/ui.
 *
 * ── Recording disclosure ────────────────────────────────────────────────────
 *
 * Florida is an all-party-consent state and Retell records from connect, so the disclosure is
 * the first thing said and the caller can hang up before saying anything substantive. Only the
 * Retell leg is recorded by us; hop 1 (/api/voice forwarding to the owner) is a plain dial.
 *
 * Inbound and outbound open differently, and one `begin_message` cannot branch: dynamic
 * variables substitute text, they do not choose between lines. The inbound line is the LLM's
 * `begin_message`. The outbound line has to be sent per call by `/api/contact` as
 * `agent_override.retell_llm.begin_message` on create-phone-call — that route is owned by the
 * form-capture work, so it reaches it as a handed-off patch, not from here.
 *
 * ── The consent marker — a contract, do not change unilaterally ─────────────
 *
 *   custom_analysis_data.sms_consent : "granted" | "declined" | "unknown"
 *   Airtable "SMS consent"           : singleSelect, the same three lowercase choices
 *
 *   granted  — the caller said yes to the ask. Messaging allowed (subject to window + A2P).
 *   declined — the caller said no. Sticky: a later call's silence never upgrades it.
 *   unknown  — never asked, call ended first, or the answer was unclear. BLOCKS (fail closed).
 *
 * Lowercase is load-bearing: the Make Airtable module runs with `typecast: false`, so a
 * mis-cased option rejects the whole row, not just the cell.
 */

export const SMS_CONSENT_FIELD = 'sms_consent';
export const SMS_CONSENT_CHOICES = ['granted', 'declined', 'unknown'];

/** Feeds the Call Log `Priority` singleSelect, so the choices must equal that column's. */
export const CALLER_PRIORITY_CHOICES = ['emergency', 'callback'];

/**
 * The Make expressions that write the two analysis enums into their singleSelect columns.
 *
 * Never map an analysis field into a singleSelect bare. Retell returns "" for a field it could
 * not fill, and Airtable rejects "" as an unknown option ("Insufficient permissions to create
 * new select option") — which fails the WHOLE row, not the cell. That shipped on 2026-11-03: a
 * completed Growth callback came back with caller_priority "", the clone wrote it straight into
 * Priority, and no row, no portal lead and no owner brief followed. Make then deactivated the
 * scenario, so every later call queued behind it.
 *
 * Each expression is total: it can only ever emit one of the column's choices. The fallback is
 * the safe reading, not a guess — "callback" means "someone should follow up", and "unknown" is
 * exactly the fail-closed consent state (it blocks texting).
 *
 * The master scenario carries these strings, and console/src/lib/make-modules.ts restates them
 * (Next cannot import from the ops root); test/voice-consent.test.mjs pins all three equal.
 */
const ANALYSIS = '1.call.call_analysis.custom_analysis_data';
export const SELECT_MAPPINGS = {
  Priority: `{{if(${ANALYSIS}.caller_priority = "emergency"; "emergency"; "callback")}}`,
  'SMS consent': `{{if(${ANALYSIS}.sms_consent = "granted"; "granted"; if(${ANALYSIS}.sms_consent = "declined"; "declined"; "unknown"))}}`,
};

/**
 * Hang up when a call reaches voicemail. Set on every agent (`voicemail_option`, an AGENT field,
 * not the LLM's), at creation and by `npm run update-prompt` for existing agents.
 *
 * Operator rule, 2026-11-03: an unanswered callback is a lost lead. On the growth fixture the
 * agent had no voicemail_option, so Retell never detected voicemail and the agent talked to the
 * lead's voicemail for 48 seconds — a message from a business the lead never actually spoke to.
 * Retell's API leaves detection off unless this is set ("When creating an agent through the API,
 * set voicemail_option explicitly"); the dashboard's hang-up default does not apply to API agents.
 *
 * With detection on, Retell reports the call as `voicemail_reached`; with it off (the fixture's
 * real call) as an ordinary hangup with `in_voicemail: true`. The post-call filter drops both.
 */
export const VOICEMAIL_OPTION = { action: { type: 'hangup' } };

/** Spoken verbatim as the first utterance of every INBOUND call (the LLM's begin_message). */
export function inboundOpeningLine(businessName) {
  return `This call is recorded. Hi, this is ${businessName} — how can I help you today?`;
}

/**
 * Spoken verbatim as the first utterance of every OUTBOUND callback. Sent per call by
 * /api/contact, not stored on the LLM. `leadName` is the name the lead typed into the form.
 */
export function outboundOpeningLine(businessName, leadName) {
  const name = typeof leadName === 'string' ? leadName.trim() : '';
  const question = name ? `Am I speaking with ${name}?` : 'Is now a good time?';
  return `This call is on a recorded line. Hi, this is ${businessName}, calling about the request you sent on our website. ${question}`;
}

/**
 * The closing ask, verbatim. Asked on every call — emergencies included — once the issue is handled.
 *
 * Wording approved by the operator word for word on 2026-11-04, replacing the 2026-11-02 text: it
 * now says the texts are optional, that frequency varies, and names HELP as well as STOP — the
 * disclosures a verbal opt-in carries so it can stand as consent.
 */
export function smsConsentAsk(businessName) {
  return `One last thing — is it okay if ${businessName} texts you at that number about this request? It's optional. Message frequency varies, message and data rates may apply, and you can reply STOP to opt out or HELP for help. A yes or no is fine.`;
}

/**
 * The instructions handed to the prompt generator. Kept beside the wording so the rules for
 * mapping an answer to a marker cannot drift from the marker's definition above.
 *
 * `callbacks` — does this agent ever place outbound callbacks? Only when `LEAD_CALLBACK=on`
 * (Growth, Enterprise). A Starter agent only ever answers inbound calls, so its prompt carries no
 * outbound branch at all: rules for calls it never makes are only room to misread which call it's on.
 */
export function voiceConsentInstructions(businessName, { callbacks = false } = {}) {
  const opening = callbacks
    ? `OPENING (already spoken — do not repeat it): the call opens automatically with a fixed line before you say anything. On inbound calls it is exactly: "${inboundOpeningLine(businessName)}". On outbound callbacks it is exactly: "${outboundOpeningLine(businessName, '{name}')}" (or, when no name was submitted, ending "Is now a good time?" instead). Write the GREETING section around this: tell the agent its opening line has already been said, never to re-greet, re-announce the business, or repeat the recording notice, and to introduce itself by its first name naturally in its next turn. CALL DIRECTION: put this line near the top of the prompt, copied exactly, braces included: "This call's direction: {{direction}}." Retell replaces {{direction}} with "inbound" or "outbound" on every call. Tell the agent to decide which kind of call it is on from that word alone — "outbound" means a website callback it placed — and never by guessing from the conversation. Only if it still shows as a placeholder in braces, fall back to the opening line: one that mentions the request sent on the website is outbound.

OUTBOUND CALLBACKS: the opening line has asked whether the agent is speaking with the person who submitted the website request. If they confirm, go straight into their request — do not make them repeat why they reached out; acknowledge it and continue qualification. If it is someone else, politely ask whether that person is available; never discuss the request or any details with anyone else, and if they are not available, say the team will try again and end the call. If the opening line asked "Is now a good time?" and they say no, ask for a better time in general terms (never commit to one) and end politely.`
    : `OPENING (already spoken — do not repeat it): every call this agent handles is an INBOUND call — it never places outbound calls — and it opens automatically with this fixed line before you say anything: "${inboundOpeningLine(businessName)}". Write the GREETING section around this: tell the agent its opening line has already been said, never to re-greet, re-announce the business, or repeat the recording notice, and to introduce itself by its first name naturally in its next turn. Write no outbound or callback variant anywhere in the prompt.`;
  const sms = `SMS CONSENT (its own step at the end of CLOSING — asked on EVERY call that reaches the closing, including urgent/emergency calls; no exceptions and no priority branch): after the caller's issue is handled and contact details are collected, the agent asks exactly, word for word: "${smsConsentAsk(businessName)}"
- Yes / yeah / sure / okay / go ahead → accept it, thank them briefly, and close.
- No / I'd rather not → reply "No problem at all." and close. Never argue, explain, or ask again.
- Unclear, conditional, or off-topic answer → ask ONCE: "Sorry, is that a yes?" Whatever follows, do not ask a third time.
- Never ask this before the caller's issue is handled, never imply texts are required to get service, and never promise that texts will be sent.`;
  const voicemail = callbacks ? '\n- If an outbound callback reaches voicemail, do NOT ask it, and leave NO message — hang up.' : '';
  return `${opening}

${sms}${voicemail}
Restate in the NEVER section: never skipping the SMS consent question on a call that reaches the closing, and never re-asking it after a no.`;
}

/**
 * How the agent collects the caller's details — handed to the generator as its CONTACT COLLECTION
 * section. From the growth fixture's live callback on 2026-11-04, three things the old rule
 * ("full name, best callback number, …") got wrong:
 *
 *  - It asked an outbound lead's name at the end, after the opening line had already confirmed
 *    who they were. Outbound knows the name ({{lead_name}}, from the form); inbound does not.
 *  - It asked for a phone number. Retell already has it: {{user_number}} is the caller's number
 *    on inbound (our register-phone-call passes Twilio's From) and the dialled number on outbound.
 *    The agent confirms it instead. An unset variable stays literal ("{{user_number}}") in the
 *    prompt, so the rule says what to do then.
 *  - "My email is my name at gmail" defeated it, though it had the name. It builds the address
 *    from the name and confirms the one thing it can't know: how the name is joined.
 *
 * The first fix put the name rule as two bullets under one "1. Name" step and let the agent infer
 * the direction from its opening line. On the re-test the same day it got the direction wrong and
 * asked "what's your full name?" anyway. So the direction now comes from Retell's {{direction}},
 * and outbound gets its own checklist with no name step in it at all. The same call also read
 * 207 back as "four oh seven" (the generator's example number was 407) and said "[spelling out
 * the email address]" aloud; the number rule now forbids digits from anywhere but {{user_number}}.
 */
export function callerDetailsInstructions({ callbacks = false } = {}) {
  const steps = (list) => list.map((x, i) => `${i + 1}. ${x}`).join('\n');
  const rest = (nameSource) => ['The service address or town, when the job is at a location.', emailStep(nameSource)];
  const header = 'CONTACT COLLECTION (do before ending every call), one item at a time. Copy every {{…}} placeholder below into the prompt exactly as written, braces included — Retell fills them in on each call.';
  const inboundName = 'the name they gave you earlier in this call';
  if (!callbacks) return `${header}
${steps(['Name — ask for their full name.', NUMBER_STEP, ...rest(inboundName)])}`;
  return `${header} Write it as TWO separate checklists, one per call direction, so the outbound one has no name step at all.
INBOUND CALL ({{direction}} is inbound):
${steps(['Name — ask for their full name.', NUMBER_STEP, ...rest(inboundName)])}
OUTBOUND CALLBACK ({{direction}} is outbound) — you already have their name: {{lead_name}}, from the website form, and your opening line just confirmed it. NEVER ask for their name or "full name" on an outbound call. Only if they said they are someone else, or {{lead_name}} is blank or still shows as a placeholder in braces, ask who you're speaking with.
${steps([NUMBER_STEP, ...rest('{{lead_name}}')])}`;
}

/**
 * The model can't be trusted to read a phone number's digits: on 2026-11-04 it read +12073181838
 * back as "four oh seven…", then — with the example number removed — as "seven oh seven…". So the
 * routes hand it the number already in words ({{callback_number_spoken}}, from spokenPhoneDigits),
 * and it only has to repeat them. {{user_number}} stays as the fallback for a site whose routes
 * predate the variable (an unset variable stays literal in the prompt).
 */
const NUMBER_STEP = `Callback number — do NOT ask them to recite a number. You already have the number this call is on, written out in words: {{callback_number_spoken}}. Say exactly those words back — never say digits of your own, never change or reorder them — and ask whether that's a good number to reach them. If yes, move on. If no, take the better number and read it back grouped to confirm. If {{callback_number_spoken}} is blank or still shows as a placeholder in braces, use {{user_number}} instead: say its digits one at a time exactly as they appear, dropping only the leading +1. If that is blank, withheld, or a placeholder too, ask for the best number to reach them.`;

/**
 * Re-test, 2026-11-04 16:53: told "it's my full name at gmail dot com", the agent said "your first
 * and last name all together at G as in golf, M as in Mike…", never once said the name, and when
 * asked what the first part was, offered the words "my full name". So: it works the address out
 * itself from the name it already has, says the result, and spells with plain letters only.
 */
function emailStep(nameSource) {
  return `Email — optional; never pressure. If they say it's their name at a provider ("it's my name at gmail", "my full name at gmail dot com"), the name is the one you already have — ${nameSource}. The words "my name" or "my full name" are NEVER part of the address. Ask only: "Is that first and last name together, or with a dot in between?" Then work out the actual address yourself — the name in lowercase letters, joined the way they said, then the provider — and read THAT address back: spell the part before the @ one letter at a time, then say "at gmail dot com" (say common providers as words: gmail, yahoo, outlook, hotmail, icloud). If they give you the whole address themselves, read it back the same way. Let them correct it.`;
}

const DIGIT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

/**
 * A US number in words, grouped the way people say it: "+12073181838" → "two zero seven, three one
 * eight, one eight three eight". "" for anything that isn't a ten-digit US number, so the prompt
 * falls back. The site routes carry a standalone copy (client repos have no @jdd dependency);
 * test/agent-call-flow.test.mjs runs both copies and pins them equal.
 */
export function spokenPhoneDigits(raw) {
  const d = String(raw ?? '').replace(/\D/g, '');
  const ten = d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
  if (ten.length !== 10) return '';
  const say = (s) => [...s].map((c) => DIGIT_WORDS[Number(c)]).join(' ');
  return `${say(ten.slice(0, 3))}, ${say(ten.slice(3, 6))}, ${say(ten.slice(6))}`;
}

/**
 * How the agent spells anything aloud. Handed to the generator as a CORE SPEAKING RULE.
 * The phonetic alphabet came from the model, not the prompt; it has to be ruled out by name.
 */
export const SPELLING_RULE = `- Spelling aloud (emails, names, street names): say plain letters only, one at a time — "x, a, n, d, e, r". NEVER use phonetic or military alphabet words (alpha, bravo, golf, Mike, x-ray) and never say "as in".`;

/**
 * Structured fields Retell extracts after each call into `call_analysis.custom_analysis_data`.
 * The Make post-call clone reads them into the Airtable row and the owner's text.
 *
 * Every `custom_analysis_data.*` the master scenario reads MUST be defined here —
 * `checkAnalysisCoversBlueprint` in lib/onboard-checks.js enforces it. Until 2026-11-02 the
 * master read caller_email, caller_address and caller_priority while this schema defined none
 * of them, so Email, Address and Priority were blank on every call ever logged, with no error.
 *
 * `urgency` was removed in the same change: the prompt collected it "for downstream use" and
 * nothing downstream read it. Its values could not simply be wired into Priority either — two of
 * its three were not valid choices there and would have failed the whole row.
 */
export function buildPostCallAnalysisData(businessName) {
  return [
    {
      type: 'string',
      name: 'caller_name',
      description: "The caller's full name as they gave it. Empty string if never provided.",
    },
    {
      type: 'string',
      name: 'callback_number',
      description:
        'The best callback number the caller asked to be reached at, as spoken during the call (digits only). If none was spoken, use the number they called from.',
    },
    {
      type: 'string',
      name: 'caller_email',
      description: "The caller's email address exactly as they gave it, spelled out in normal email form. Empty string if never provided — never guess one.",
    },
    {
      type: 'string',
      name: 'caller_address',
      description: 'The service address or location the caller gave (street, town). Empty string if never provided — never guess one.',
    },
    {
      type: 'enum',
      name: 'caller_priority',
      choices: [...CALLER_PRIORITY_CHOICES],
      description:
        '"emergency" when the caller described an urgent or safety-critical problem that needs immediate attention; otherwise "callback" — they want the team to follow up.',
    },
    {
      type: 'enum',
      name: SMS_CONSENT_FIELD,
      choices: [...SMS_CONSENT_CHOICES],
      description:
        `The caller's answer when asked near the end of the call whether ${businessName} may text them about this request. ` +
        '"granted" ONLY if they clearly said yes to that specific question. "declined" if they said no. ' +
        '"unknown" if the question was never asked, the call ended before they answered, or the answer stayed unclear or conditional. ' +
        'Never infer consent from anything else said during the call.',
    },
  ];
}
