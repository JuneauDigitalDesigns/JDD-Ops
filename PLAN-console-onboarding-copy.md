# PLAN — Console onboarding copy: the two SMS lanes + consent capture

**Status:** drafted 2026-10-29, not started
**Repo:** `jdd-ops/console` (copy only) + two doc deliverables at the repo root
**Driver:** `HANDOFF-console-onboarding-a2p.md`, `HANDOFF-leadform-sms-consent.md`,
`PLAN-portal-form-capture.md` §1a–1e / §11, `~/Desktop/JDD-a2p-isv-runbook.html`

---

## 0. Scope — copy, not features

This plan changes **operator-facing copy in the console** so it stops describing a world that the
2026-10-29 decisions replaced. It does **not** implement the A2P migration, the portal lead
ingest, the consent gate, or the `@jdd/ui` release. Those are owned by other agents and by the
documents listed above.

The one deliberate exception is two lines of display plumbing (§3.1) — one `OpsConfig` field —
because a step that names an env key but cannot report whether it is set is a step that cannot
tell the operator whether they have done it.

### Owned here

| File | Change |
|---|---|
| `console/src/lib/runbook-content.ts` | Part A (`/setup`) + per-client (`/onboard`) copy |
| `console/src/lib/make-modules.ts` | Twilio module replica: `From`, `MessagingServiceSid`, 30034 help |
| `console/src/lib/types.ts` | 1 optional `OpsConfig` field — see §3.1 |
| `console/src/lib/opsConfig.ts` | 1 corresponding `ops.*` read |
| `HANDOFF-retell-voice-consent.md` *(new)* | The voice-consent handoff (§6) |

### Not touched

`onboard.js`, `lib/*`, `envFields.ts`, the agency repo, `jdd-ui`, the Make master scenario, any
Twilio or Retell resource. Findings that require those are **routed, not fixed** — see §2.

---

## 1. Decisions taken 2026-10-29 (interactive review)

| # | Decision |
|---|---|
| 1 | Both surfaces in scope: Part A at `/setup` **and** the per-client runbook at `/onboard` |
| 2 | Add **one** `OpsConfig` field (`twilioNotificationNumber`) so the notification-number step renders live value + `pending`. Revised 2026-11-01 — see §1a |
| 3 | Delete the 7-field Airtable enumeration; point at the module replica instead |
| 4 | Update the `make-modules.ts` Twilio replica and its help text |
| 5 | LeadForm disclosure is an always-visible **notice**, not a checkbox |
| 6 | Disclosure wording **names the client business** and uses US spelling ("inquiry") |
| 7 | Each client site gets **its own `/sms-terms`** page as the disclosure target |
| 8 | Live client sites are **batch-bumped and redeployed**, not left to the next re-run |
| 9 | Recording disclaimer is the agent's **first utterance**; SMS ask is at the **end** |
| 10 | SMS ask happens on **every** call including emergencies — one-word yes/no, no priority branch |
| 11 | Consent marker is a `post_call_analysis_data` enum at `custom_analysis_data.sms_consent` |
| 12 | Three states: `granted` / `declined` / `unknown`. **`unknown` blocks. `declined` is sticky** |
| 13 | Marker reaches the gate by the **portal promoting it from Airtable** on its existing read |
| 14 | `SMS consent` becomes a lowercase single-select Call Log column |
| 15 | `npm run update-prompt` is extended to push **prompt + agent schema** together |
| 16 | The voice-consent handoff covers **marker production only** — the gate stays with §11 |

Decisions 5–8 resolve the `_(decide with the operator)_` items in `HANDOFF-leadform-sms-consent.md`
§4 and §5.2. Decisions 9–15 are the input to the new handoff (§6). Decision 12 settles the
`_(decide)_` call-only row in `PLAN-portal-form-capture.md` §11.

---

## 1a. Reconciled against `PLAN-console-a2p-registration.md` (2026-11-01)

That plan is executing now and moves the entire A2P chain into a console stepper at
`/c/{slug}/manage/messaging`, with every Twilio write click-gated. Its Phase 0 item 3 and §11
both fence `runbook-content.ts` as owned here, and it touches neither `make-modules.ts` nor
`envFields.ts` — so there are **no file collisions**. Four things change on this side:

| # | Decision |
|---|---|
| 17 | **Drop `twilioPrimaryProfileSid`.** Their Phase 1 readiness panel reads that key *and* verifies the profile's business type live, surfaced on `/manage` Overview as a blocking tile. A `pending` card here would judge the same fact from key-presence alone and could read satisfied while the tile reads blocked — the ring-window failure mode both plans cite. Copy cites the readiness tile as the authority instead |
| 18 | **The console keeps the 13–20 business day figure.** Their decision 6 ("no timeframe") governs the client portal; the console is operator-facing, and the runbook needs the number to justify why "campaign not yet verified" is expected rather than broken |
| 19 | **The A2P section is a thin pointer, written now** — see §3.3. No procedure, so nothing goes stale while their Phase 4 is built |
| 20 | **Sequencing:** everything disjoint from their plan proceeds first; only the A2P section waits on their Phase 4 |

### Cross-plan gap, unowned

**`onboard.js:1277` — the master-pool join has no owner in any executing plan.**
`PLAN-portal-form-capture.md` §1d assigns it ("**Stop.** Growth/Enterprise numbers join their own
service"), `PLAN-console-a2p-registration.md` §11 puts that family of work out of scope, and this
plan does not touch `onboard.js`. So provisioning still adds the client's number to JDD's **master**
pool, after which console gate 4.3 attaches it to the client's own service. Form-capture §1a notes
Twilio's docs imply a sender-pool **move** rather than a duplicate — so 4.3 may silently pull the
number out of the master pool, or fail. Either way, pool membership depends on run order, and this
is the mis-registration the ISV migration exists to end.

Consequence here: the `:561` copy cannot state cleanly what happens to a client number today.
See §3.3.

Also unowned: `CLAUDE.md`'s `/manage` table lists five sections; the code has eight, and their
Phase 4 makes nine.

---

## 2. Three verified findings — route before writing the affected copy

All three were found while grounding this plan and all three are confirmed against
`test/fixtures/make/master-blueprint.json`, which is a **recorded** capture of the live master, not
a hand-written mock. They are **not fixed here** (they live in `onboard.js` and the Make master),
but two of them determine what the copy may truthfully say.

### 2.1 Three Call Log columns can never be written

The master maps `custom_analysis_data.caller_email`, `caller_address` and `caller_priority`. The
agent schema at `onboard.js:1128` defines only `caller_name`, `callback_number` and `urgency`. So
`Email`, `Address` and `Priority` are **empty on every logged call, for every client** — the exact
failure CLAUDE.md's Airtable section warns about, from the opposite direction: not a column the
master writes and the base lacks, but a column both have and the *agent* never supplies.

### 2.2 `urgency` is collected deliberately and read by nothing

`onboard.js:992` instructs the generated prompt to emit exactly `"Immediate service"`,
`"Callback requested"` or `"General inquiry"`, justified in the prompt itself as *"this label is
used downstream, so use those exact words."* `urgency` appears **zero** times in the master
blueprint. Note it cannot simply be wired to `Priority` either: that column's choices are
`emergency` / `callback`, so two of the three values would be rejected under `typecast: false`
and fail the entire row.

### 2.3 The live post-call SMS carries no opt-out language

The master's actual body is:

```
Name:{{1.call.call_analysis.custom_analysis_data.caller_name}}
Status:{{1.call.call_analysis.custom_analysis_data.caller_priority}}
Phone: {{if(1.call.direction = …)}}
```

There is no `Reply STOP` string anywhere in the blueprint. `runbook-content.ts:531` pins a
different body entirely and states it "MUST match the sample message submitted with the A2P
campaign and the sample shown on juneaudigitaldesigns.com/sms-terms." The constraint is right;
the reality does not meet it. Given 2.1, `Status:` also renders empty, so the owner's brief is
currently a name, a blank status and a phone number.

**This is a compliance gap, not drift.** It is also the string the A2P copy work is about to tell
an operator to submit to a carrier as the campaign sample.

### Routing

2.1 and 2.2 are naturally fixed by the voice-consent handoff, which is already editing
`post_call_analysis_data` — so they are written into it as prerequisites (§6). 2.3 needs a
deliberate master edit and operator sign-off on the wording, and is raised to the operator
directly rather than assigned.

**Until 2.3 is settled, the A2P copy states the body requirement without pinning a string it
cannot verify.** Pinning the current wrong string would propagate it into a carrier submission.

---

## 3. Work items

### 3.1 `types.ts` + `opsConfig.ts` — two fields

Mirror `makePostCallMasterScenarioId` (`types.ts:154`, `opsConfig.ts:122`) exactly:

```ts
twilioNotificationNumber?: string;  // jdd-ops/.env TWILIO_NOTIFICATION_NUMBER
```

Currently absent from `.env` and `.env.example`, so the notification-number step renders `pending`
until it is bought. That is the intended behaviour: the runbook reports its own readiness.

**`twilioPrimaryProfileSid` is deliberately NOT added** (decision 17). The A2P plan's Phase 1
readiness panel owns that fact and checks it properly — it reads the SID *and* asserts live that
the profile's business type is ISV Reseller or Partner, which key-presence cannot tell you. A
second weaker surface for one fact is the two-copies problem; the copy points at the tile instead.
If someone later adds this field, they are re-creating that problem — say so inline.

### 3.2 Part A — `a-make-post-build` (~`runbook-content.ts:519`)

| Line | Change |
|---|---|
| 528 | **Delete the 7-field enumeration.** Replace with a pointer to the `make-module` replica rendered in this step, which is the single source for the mappings |
| 529 | `From` = `TWILIO_NOTIFICATION_NUMBER`, a constant set once in the master and identical in every clone. `To` stays per-clone. Add `MessagingServiceSid` = JDD's master service, explicitly set and not omitted |
| 530 | Keep the instruction. Add a `verify` block: read a message record back and assert `messaging_service_sid` is **not null** — measured 2026-10-29, every message in the account has it `NULL`, and looking is the only way to catch it |
| 531 | State the body requirement (identify the sender, carry opt-out, match the campaign sample and `/sms-terms`) **without** pinning a string, pending §2.3 |

### 3.3 Part A — `a-twilio-a2p` (~`runbook-content.ts:548`)

| Line | Change |
|---|---|
| 555 | Add: convert the primary business profile to business type **"ISV Reseller or Partner"** in Trust Hub and record the SID as `TWILIO_PRIMARY_PROFILE_SID`. Every Secondary Customer Profile links back to it; omit the link and the profile evaluates as a direct business and the ISV posture collapses |
| 557 | State the live value exactly: `ACCOUNT_NOTIFICATION`, `has_embedded_links: false`, carrying **owner alerts only** |
| 561 | Rewrite. The master-pool join is no longer how client numbers are handled: Growth/Enterprise numbers join **their own** service, Starter and web-only join none. Attribute it correctly — the client Messaging Service is created by console gate 4.1 and the number attached by 4.3, **not** by `onboard.js`. The hard-fail described here is being re-pointed at the Account lane. **Note the §1a gap:** `onboard.js:1277` still joins the master pool and nobody owns stopping it, so this copy must not claim a client number is only ever in its own service |
| 565 | Split by lane. The 30034 warning is **false for owner alerts** once they send from the approved notification number, and **true** for customer-facing SMS. Undifferentiated, an operator reads a pending A2P status as "briefs are broken" when they are fine |

**New step — buy and wire the notification number.** The seven manual substeps from
`PLAN-portal-form-capture.md` §1c, as a `substeps` block plus a `verify` block: local Orlando
(407 → 321 → 689), **never toll-free**, named unmistakably, added to the master service, **pool
read back**, `voiceUrl` left unset, one real test message with `messaging_service_sid` confirmed
non-null. A `context` card carries `TWILIO_NOTIFICATION_NUMBER` with `pending` wired to §3.1.

**New section — per-client A2P registration (Growth/Enterprise only).** A **thin pointer**, not a
procedure (decision 19). `PLAN-console-a2p-registration.md` makes the whole chain a click-gated
stepper in the console, and its fact 2 is explicit that *"there is no step that forces the operator
into the Twilio dashboard."* So this section carries only:

- Registration happens in **Messaging & A2P** (`/c/{slug}/manage/messaging`), Growth/Enterprise only
- The **readiness tile** gates it; until that passes, no per-client registration is possible
- Expected **13–20 business days** end to end, and a `callout` stating that "campaign not yet
  verified" is an **expected** state for roughly three weeks, not a failure
- A `link` to `JDD-a2p-isv-runbook.html` for **diagnosing a rejection** — not for doing the work

Do **not** inline the nine-call TrustHub chain, and do **not** describe a dashboard walkthrough:
two descriptions will drift, the HTML runbook has the verified endpoints, and the console section
is where the clicks are. **Blocked on their Phase 4** — everything else in this plan is not
(decision 20).

> **Trap:** no check output may contain the token `FAIL:` — `onboard-parse.ts` treats any line
> carrying it as a fatal run and would abort the UI's narration over a soft A2P finding.

### 3.4 Per-client runbook (`/onboard`)

| Line | Change |
|---|---|
| 217 | "set `From` to this client's number" is now wrong. `From` is the JDD notification number, constant across clones; add `MessagingServiceSid`. This is the step that contradicts Part A if only one is fixed |
| 324 | Web-only checkpoint still describes a Resend lead email. Reword once `LEAD_DELIVERY_MODE=portal` is live; until then leave it and note the dependency |
| 390–438 | Post-call checkpoint. Keep "a brief SMS to {owner}", add a verify item for `messaging_service_sid` non-null, and say which number it now arrives from — the owner will otherwise report an unrecognised sender as a bug |

### 3.5 `make-modules.ts` — the Twilio replica (`:199`)

- `from` becomes the notification number, not `site.env.TWILIO_NUMBER`
- Add a `MessagingServiceSid` field pinned to the master service
- Rewrite the `:222` help text. It currently reads *"It must be in the A2P sender pool or every
  post-call text fails with 30034"* — exactly backwards under the new design, where the whole
  point of the notification number is that it is **already** in the approved pool and needs no
  per-client registration
- Leave the eleven Airtable mappings as the single source they already are, but see §2.1: three
  of them reference analysis fields the agent does not emit. Flag them in `help` rather than
  silently presenting them as working

---

## 4. Adopted from `HANDOFF-leadform-sms-consent.md`

That handoff is assigned to another agent and its files are **not** touched here. What this plan
contributes is the operator decisions it was blocked on (§1, decisions 5–8) plus one piece of
newly-scoped work that currently has no owner:

> **Per-client `/sms-terms` page.** Decision 7 means every client site needs its own SMS terms
> page naming that business as the sender, because the disclosure links to it and JDD's own
> `/sms-terms` describes the wrong program and the wrong sender. This is a new template page with
> per-vertical copy — real scope, outside both existing handoffs. **Needs an owner.**

Also worth the operator's attention from that handoff, verified here:

- `jdd-ui` HEAD is `16eabee` (v1.2.0); `jdd-ops/packages/ui` is `3d4db36` (v1.1.0) — a stale
  duplicate clone of a published package, nested inside a consumer of that package. The handoff
  suggests deleting it. Confirmed one release behind; recommend deletion.
- Decision 8 (batch-bump every live client) includes the two e2e fixtures, already stale at
  `#v1.0.7` and `#v1.1.0` against template/console at `#v1.2.0`.

---

## 5. What this plan does not do

- No `onboard.js`, `lib/`, or `envFields.ts` changes — so **no new phase**, and the phase contract
  (`onboard-parse.ts:110` / `run-plan.ts:86` / `phase-contract.test.mjs`) is untouched
- No Make master edit, no Twilio purchase, no Retell change
- No `WebLead`, ingest, gate or `jdd-schema` work
- No fix for §2.1–2.3; they are routed, with 2.3 unresolved and blocking one copy line
- **Nothing owned by `PLAN-console-a2p-registration.md`:** no `manageSections.ts`, no
  `MessagingSection.tsx`, no `/api/manage/a2p/*`, no TrustHub call, no `jdd:a2p-*` Redis record,
  no `a2pStatus` transition. Their Phase 0 item 2 asks whether anything here is mid-edit in
  `manageSections.ts` or `envFields.ts` — **neither is touched by this plan**
- No `A2P_*` keys in `envFields.ts`. Their decision 5 keeps the SIDs in the Redis record, which
  supersedes `HANDOFF-console-onboarding-a2p.md` §6. This plan never adopted that §6 item, so
  there is nothing here for their Phase 6 correction to undo

---

## 6. Deliverable: `HANDOFF-retell-voice-consent.md`

Written in the same pass. Scope is **marker production only** (decision 16): the prompt template,
the recording disclaimer, the `sms_consent` analysis field, the Call Log column, the
`update-prompt` extension, and promotion into KV from the portal's existing Airtable read. It
stops at a well-formed consent record; `canMessageContact()` and `portal:msg-consent:v1:*` stay
with `PLAN-portal-form-capture.md` §11. Findings 2.1 and 2.2 are written into it as prerequisites,
since it is already editing the array that causes them.

---

## 7. Verification

- `cd console && npm run build` — copy is typed data, so a malformed block fails the build
- `cd console && npm test` — includes the phase contract. It must stay green **without**
  re-recording fixtures; if it needs `fixtures:dry-run`, this plan has exceeded its scope
- `npm run check-schema`
- Walk `/setup` and `/c/{slug}/onboard` in the browser at both surfaces and confirm: every new
  `context` card shows `pending`, no step contradicts another on the Make Twilio module, and no
  check output contains `FAIL:`
- Confirm the ring-window precedent still holds: `test/ring-window.test.mjs` asserts prose,
  because prose that silently steers behaviour is part of the behaviour. Any number this copy
  states must be derived, not literal — see `RING_SECONDS_DEFAULT` at `runbook-content.ts:17`
