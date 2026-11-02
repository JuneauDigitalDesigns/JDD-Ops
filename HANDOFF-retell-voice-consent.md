# HANDOFF — Recording disclaimer + SMS consent on every client's Retell agent

**Date:** 2026-10-29
**Status:** context only — no work started
**Goal:** every client's voice agent opens by disclosing that the line is recorded, closes by
asking the caller a one-word yes/no for SMS, and exposes that answer post-call as a structured
marker that is logged and readable — so the portal has a real consent basis for callers who
*phoned* rather than filled in a form.

---

## 1. Why this exists

`PLAN-portal-form-capture.md` §11 settles consent for web-form leads and leaves one row of its
consent-basis table explicitly open:

> Customer **called** the business → "Consumer-initiated, but no written record and no disclosure
> → **Decide.**"

§11 also notes this is **the common case**: most CRM customers arrive through the receptionist,
not the form. Its fallback position is weak — allow a responsive reply inside a window, log
`basis: "inbound-call"` so the weakness shows in an audit.

This work replaces that fallback with something provable. The agent speaks a disclosure, the
caller verbally answers, the transcript is the evidence, and a structured marker makes it
queryable. That turns the weakest row in the table into one of the strongest.

---

## 2. Scope — and the hard non-conflict rule

Three other work streams are live. This handoff owns **marker production only**.

### You own

| File | Change |
|---|---|
| `onboard.js:~992` (prompt template) | Recording disclaimer + closing consent ask |
| `onboard.js:1128` (`postCallAnalysisData`) | New `sms_consent` field, plus §4 prerequisites |
| `onboard.js:1444` (`CALL_LOG_FIELDS`) | `SMS consent` column |
| `lib/repair-ops.js:118` (`CALL_LOG_FIELDS`) | The **second copy** of that list |
| `lib/repair-ops.js:73` (allow-list) | Add `post_call_analysis_data` |
| `scripts/update-agent-prompt.js` | Push prompt **and** agent schema together (§6) |
| `lib/onboard-checks.js` | New predicate (§7) |
| The Make **master** scenario's Airtable module | One new mapping (§5) |
| `console/src/lib/make-modules.ts` → `airtableFields()` **only** | The replica row |

### ⛔ Do NOT touch — other work owns these

- `canMessageContact()`, `MessageBlockReason`, the `messaging` gate, `portal:msg-consent:v1:*`
  — `PLAN-portal-form-capture.md` §11
- `WebLead` and its `consent` field — a published contract; the CRM v2 agent builds against it
- `lib/site-routes/contact.route.ts`, `POST /api/ingest/lead`, `portal-leads.ts`
- `~/Desktop/ops/jdd-ui/**` and `LeadForm` — `HANDOFF-leadform-sms-consent.md`
- `clients/*/repo/**` — generated output, never hand-edited
- `console/src/lib/make-modules.ts` → `twilioFields()` and `runbook-content.ts`
  — `PLAN-console-onboarding-copy.md` owns those. **You share a file with that work**: it edits
  `twilioFields()` and the runbook copy, you edit `airtableFields()`. No semantic overlap, but
  coordinate the commit order or you will merge-conflict on one file.

If you believe you need something in the forbidden list, stop and raise it.

---

## 3. The seam

```
agent speaks disclosure + ask
  → Retell post-call analysis  →  custom_analysis_data.sms_consent
  → Make clone                 →  Airtable "SMS consent" column
      ^^^^^^^^ you own to here
  → portal promotes into portal:msg-consent:v1:*   ← §11 owns
  → canMessageContact() gates the send             ← §11 owns
```

**Your deliverable is that the marker is present, correct, and contractually documented on the
Airtable row.** You do not write the KV key and you do not touch the gate. §11 already claims
that storage, so promotion is theirs — your job is to make the value exist and to document its
exact name, values and semantics so they can consume it without guessing.

### The contract — do not change unilaterally

```
custom_analysis_data.sms_consent : "granted" | "declined" | "unknown"
Airtable "SMS consent"            : singleSelect, same three lowercase choices
```

**Lowercase is not a style choice.** The Airtable module runs with `typecast: false`, so a
capitalized option is rejected as an invalid choice and fails the **whole row**, not just that
cell — the same trap already documented for `Call type` and `Priority`.

### Semantics, decided 2026-10-29

- `granted` — the caller said yes. Messaging allowed, subject to the §11 window and A2P status.
- `declined` — the caller said no. **Sticky.** Never upgraded by a later call's silence; only an
  explicit later `granted`, or an inbound text from that number, overrides it.
- `unknown` — never asked, call ended early, or the answer was unintelligible. **Blocks.** Fail
  closed, exactly as §11 treats a lead arriving with no `consent` object.

`unknown` and `declined` must stay distinguishable. A boolean column was considered and rejected
for precisely this reason: it collapses "we never asked" into "they refused", and the gate
depends on telling them apart.

---

## 4. ⚠️ Prerequisites — three Call Log columns are already dead

Found 2026-10-29 while scoping this work, confirmed against
`test/fixtures/make/master-blueprint.json` (a **recorded** capture of the live master, not a mock).
**Fix these in the same pass**, because you are editing the exact array that causes them and
adding a fourth field beside three broken ones would be indefensible.

### 4.1 `Email`, `Address` and `Priority` are empty on every logged call

The master maps `custom_analysis_data.caller_email`, `caller_address` and `caller_priority`.
`postCallAnalysisData` at `onboard.js:1128` defines **only** `caller_name`, `callback_number` and
`urgency`. The agent has never emitted the other three, for any client, ever. Nothing errors —
the row writes, those cells are blank.

Fix: add `caller_email`, `caller_address` and `caller_priority` to the schema. `caller_priority`
must be an enum with choices `emergency` / `callback`, lowercase, matching the Airtable column it
feeds.

### 4.2 `urgency` is collected deliberately and read by nothing

`onboard.js:992` instructs the generated prompt to emit exactly `"Immediate service"`,
`"Callback requested"` or `"General inquiry"`, and justifies it in the prompt text as *"this label
is used downstream, so use those exact words."* `urgency` appears **zero** times in the master
blueprint.

Decide one of: map it somewhere, or drop it from the schema and the prompt. Do **not** wire it
straight into `Priority` — two of its three values are not valid choices there and would fail the
whole row under `typecast: false`.

### 4.3 Out of scope but raised

The live master's SMS body carries **no opt-out language** —
`Name:{{caller_name}}\nStatus:{{caller_priority}}\nPhone:{{…}}`, with no `Reply STOP` anywhere in
the blueprint, while `runbook-content.ts:531` pins a different string and says it must match the
A2P campaign sample. That is a compliance question for the operator, not yours. Noted here
because 4.1 is why `Status:` currently renders blank.

---

## 5. What to build

### 5.1 The recording disclaimer — first utterance, non-negotiable

Florida is an **all-party consent** state for call recording, and Retell records from the moment
the call connects. The disclosure therefore cannot come later in the conversation, and the caller
needs a real chance to hang up before saying anything substantive.

Scope note: only the **Retell leg** is recorded by us. Hop 1 — `/api/voice` forwarding to
`CLIENT_FORWARD_PHONE` — is a plain Twilio dial with no recording, so the disclaimer belongs to
the agent and not to the forward.

Keep it to one sentence, naming the business, before anything else is said.

### 5.2 The consent ask — last, one word, every call

Placement is the **end** of the call, after the caller's actual problem has been handled. Rationale:
front-loading two compliance asks before "how can I help you" makes a service call sound like a
robocall, and asking at the end lets the agent name what the texts will actually be about.

**Ask on every call, including emergencies.** An earlier draft skipped the ask when
`caller_priority` read as an emergency; that was wrong and is superseded. Combined with
`unknown` blocking, skipping would have denied the owner SMS on exactly the calls where following
up matters most. It is a one-word answer, so the friction argument does not hold. The closing
sequence is therefore **unconditional** — no priority branch in the prompt.

Prompt requirements:

- Name the business, not JDD. The caller consents to be texted by the client's business; the
  agent is speaking as that business
- State what the texts are for — a follow-up about this enquiry, not marketing
- Accept a one-word yes or no, and do not argue with a no or re-ask it
- Map the verbal answer to exactly `granted` / `declined` / `unknown`
- A call that ends before the ask is `unknown`, which is correct and must not be guessed at

### 5.3 The analysis field

Add to `postCallAnalysisData` as `type: 'enum'`, `name: 'sms_consent'`, choices
`['granted', 'declined', 'unknown']`, with a description that tells the extractor to use
`unknown` whenever the ask did not happen or the answer was unclear. Lean on the existing
`urgency` entry for the shape.

### 5.4 The Airtable column and the master mapping

- `SMS consent`, `singleSelect`, choices `granted` / `declined` / `unknown` — added to
  `CALL_LOG_FIELDS` in **both** `onboard.js:1444` and `lib/repair-ops.js:118`. Two copies exist;
  a column added to one only means `repair` rebuilds a base without it
- One new mapping in the master's Airtable module, by column **name**. Step 8c remaps the clone by
  name because Airtable table and field ids are base-scoped
- The master is **never modified by a run**; a deliberate edit is fine. `npm run fixtures:refresh`
  reporting the clone path byte-exact is the proof
- `npm run verify-post-call` after touching either side — it diffs both against the live master
  and exercises the real `patchPostCallBlueprint`

---

## 6. Backfill — two objects, two API calls

Existing clients need both halves, and there is **no path today** to push the schema half:

- The **prompt** lives on the per-client **LLM**. For a `retell-llm` response engine,
  `general_prompt` passed to `create-agent`/`update-agent` is ignored, so `npm run update-prompt`
  correctly calls `update-retell-llm`
- `post_call_analysis_data` lives on the **agent**, and `lib/repair-ops.js:73` allow-lists agent
  updates to `['webhook_url', 'voice_id', 'max_call_duration_ms']` — so the field cannot be
  pushed at all right now

Extend `scripts/update-agent-prompt.js` to do **both** in one command, and add
`post_call_analysis_data` to the allow-list. One command, so the two halves cannot drift: a new
prompt that asks for consent while the agent has no field to record it into produces a caller who
consented and a row that says `unknown`.

Note the console's voice-agent editor reads `agent-prompt.txt` from disk with no read-back from
Retell, so a hand-edit in the Retell dashboard is invisible to the console and the next scripted
push will overwrite it. Backfill in code, not by hand.

---

## 7. Testing

**Hard rule: `npm test` stays green.** Fixtures are *recorded*, never hand-written.

Add a predicate to `lib/onboard-checks.js` — imported by both the suite and
`onboard.js --dry-run`, so the dry run answers "would this provision correctly?":

> **Every `custom_analysis_data.*` field the master scenario reads must exist in
> `postCallAnalysisData`.**

This encodes §4.1, which is a bug that actually shipped and has been silently losing three columns
of every call record. It would also have caught it the day it was introduced. Break the fix and
watch it go red before trusting it — a regression test that cannot fail is decoration.

`ok` is `true | false | null`, and `null` means "could not check" — never a pass.

Also: no check output may contain the token `FAIL:`. `onboard-parse.ts` treats any line carrying it
as a fatal run and would abort the console's narration.

---

## 8. Verification before handing back

- `npm test` green at the root; `cd console && npm test` green
- `npm run verify-post-call` passes
- `npm run fixtures:refresh` shows the master blueprint changed **only** by the deliberate mapping
  edit, and the clone path still byte-exact
- One real test call through a provisioned number: hear the disclaimer as the first thing said,
  answer the closing ask with one word, then confirm the Airtable row carries the matching value
- Repeat with the call ended early, and confirm the row reads `unknown` rather than blank or
  `granted`
- Confirm a `declined` is not overwritten by a subsequent call where the ask never happened

---

## 9. Read first

| Document | Why |
|---|---|
| `PLAN-portal-form-capture.md` **§11** | The consent model, the circularity argument, the basis-by-origin table this work settles, and the gate you must not build |
| `PLAN-console-onboarding-copy.md` **§2** | The three verified findings, including the two you inherit as prerequisites |
| `HANDOFF-leadform-sms-consent.md` | The parallel form-side capture work and its seam discipline |
| `CLAUDE.md` — Retell agent, Airtable, Testing | Prompt-lives-on-the-LLM, the column contract, lowercase choices, recorded fixtures |
| `onboard.js:960–1160` | The prompt template and the analysis schema, together |

---

## 10. Out of scope

- `canMessageContact()`, the `messaging` gate, `portal:msg-consent:v1:*` — §11
- Promoting the marker from Airtable into KV — §11, decided 2026-10-29
- Form-side consent capture — `HANDOFF-leadform-sms-consent.md`
- The consent window and STOP revocation — §11
- The missing opt-out language in the live SMS body (§4.3) — operator decision
- Per-client `/sms-terms` pages — newly scoped, currently unowned
