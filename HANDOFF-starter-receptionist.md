# HANDOFF: Starter gets a receptionist (provisioning changes)

**Date:** 2026-10-12
**Repo:** `C:\Users\Xander\Desktop\ops\jdd-ops`
**Companion:** `ops/juneau-digital-designs/PLAN-pricing-update.md` (the pricing/site/legal side). This document covers **provisioning only**.
**Status:** approved by the owner. Prices and tiers are already decided; do not relitigate them.

---

## 1. What changed and why this file exists

JDD's pricing changed on 2026-10-12. The one change that matters for provisioning:

> **Every tier now includes the AI receptionist.** Starter is no longer a website-only plan.

Tiers are now differentiated by **capability**, not by whether a receptionist exists:

| | Starter $197/mo | Growth $497/mo | Enterprise $1,097/mo |
|---|---|---|---|
| Website | 1 | 1 | 2 to 3 |
| Twilio number | **✓ (new)** | ✓ | ✓ per site |
| Retell agent + per-client LLM | **✓ (new)** | ✓ | ✓ per site |
| Airtable base + call log | **✓ (new)** | ✓ | ✓ (1 shared, `Site` column) |
| Post-call clone (text brief + log) | **✓ (new)** | ✓ | ✓ |
| Included minutes | **100 (new)** | 350 | 1,050 pooled |
| Overage | **$0.20/min (new)** | $0.20/min | $0.20/min |
| 60-second outbound callback | **✗** | ✓ | ✓ |
| `LEAD_DELIVERY_MODE` | `email` | `callback` | `callback` |

**The only remaining provisioning difference between Starter and Growth is `LEAD_DELIVERY_MODE`.** That variable already exists and is already set correctly per plan at `onboard.js:1299`. Everything else in the Starter branch has to come up to parity.

Positioning, for any copy you touch: *Starter tells you. Growth acts for you.* Starter's receptionist answers the calls the owner misses and reports them. Growth's also dials new web leads back within about a minute.

### 1.1 The one exception: web-only

A client may **refuse** to have AI on their phone line. That is the `web-only` variant: Starter price, Starter website, **no receptionist**. It is priced identically to Starter on purpose, so it is never the economically attractive choice, and it is **never shown on public pricing**. It is a sales concession and an onboarding decline path.

Web-only is **not a fourth plan**. It is `plan: "starter"` plus `receptionistMode: "declined"`. The old Starter provisioning path is exactly right for it, so **do not delete the no-voice branches. Re-key them from `plan === 'starter'` to the web-only condition.** That is the single most important instruction in this document.

---

## 2. Owner decisions (authoritative)

| # | Decision |
|---|---|
| P1 | Starter receives the **full Growth stack except the outbound callback**: Twilio number, two-hop human-first routing, Retell agent + per-client LLM, Airtable base, Make post-call clone. `LEAD_DELIVERY_MODE` stays `email`. |
| P2 | Starter overage **is billed**, at $0.20/min, same as every other tier. No special case. |
| P3 | The receptionist mode is **always explicitly stated by the writer**. No inferring it from the plan, no defaulting. Surface it as a deliberate check: a Starter client is either a full site with a receptionist, or without. "Without" will be rare. |
| P4 | A declining client signs **standard Starter terms**. Declining is an activation choice made after signing, under a clause that contemplates it. |
| P5 | A **web-only schedule is defined now** in the agency repo's legal module, so a receptionist-free agreement can actually be rendered for a sales-assisted path, even though the standard funnel does not use it. |
| P6 | The A2P 10DLC 30034 problem **is resolved**. Post-call SMS works. Starter may advertise and receive the post-call text brief. |

Reconciling P4 and P5: everyone on the public funnel signs the standard Starter agreement, because signing happens before the activation step. The web-only schedule exists for the sales-assisted case where a prospect refuses AI up front and the document should say so. Both paths produce `receptionistMode: "declined"` in provisioning; they differ only in which document was signed.

---

## 3. The Starter gates, enumerated

Nine places in `onboard.js` branch on `plan === 'starter'`, plus three in `@jdd/schema` and one stale doc. **Verify this list before you start**, since line numbers drift:

```
grep -n "starter" onboard.js
```

| # | Location | Current behaviour | Required change |
|---|---|---|---|
| G1 | `onboard.js:9` | Header doc: "starter → site only (no voice agent, no Airtable)" | Rewrite. Doc only, but this is the first thing the next reader sees. |
| G2 | `onboard.js:217-221` | Refuses to guess the plan on a legacy schema, because guessing wrong "provisions paid Twilio/Retell resources" for a Starter client | **Keep the refusal, update the reasoning.** The expensive wrong guess is now web-only vs receptionist, not Starter vs Growth. Extend it to refuse when the receptionist mode is unknown (see §4). |
| G3 | `onboard.js:553` | `writeClientEnvLocal` writes a Starter env template with **no** Retell/Twilio/Airtable keys | Starter needs the full template. See §5. |
| G4 | `onboard.js:1299` | `syncVercelEnv` sets `LEAD_DELIVERY_MODE: plan === 'starter' ? 'email' : 'callback'` | **Leave exactly as is.** This is now the only intended tier difference and it is already correct. |
| G5 | `onboard.js:1456` | `if (plan === 'starter') entry.retellAgentId = null;` | **Second, independent kill switch** for the agent id, duplicating the schema rule on purpose (see the comment at 1450-1454, written because jdd-ops pins a published tag). Re-key to web-only. Missing this means Starter agents are provisioned and then immediately nulled in the portal record. |
| G6 | `onboard.js:1717` | `printHandoff` gives Starter a 2-step "Next" list with no test call | Starter now needs the test-call and prompt-tuning checkpoints. Starter's list should match Growth's minus the callback step. |
| G7 | `onboard.js:1769-1805` | `preflight` requires only `RESEND_API_KEY` for Starter; the Retell/Twilio/Airtable/Anthropic block is in the `else` | Starter must satisfy the full voice block, **unless web-only**. This is the gate that keeps a run from failing after it has already bought a number, so it matters. |
| G8 | `onboard.js:1824` | `verifyA2pRegistered` early-returns for Starter | Must run for Starter, since Starter now texts. Per P6 the campaign is approved, so this should pass, but the check must not be skipped. |
| G9 | `onboard.js:1898` | Main loop: `console.log('Skipping voice provisioning (plan=starter)')` and skips agent, number, Airtable, post-call clone | Re-key to web-only. This is the actual provisioning skip. |
| S1 | `@jdd/schema` `src/account.ts` `buildPortalSiteEntries` | `if (plan === 'starter')` forces `airtableBaseId: null` **and** `retellAgentId: null` | Re-key to web-only. Until this lands, every console repair wipes a Starter agent. |
| S2 | `@jdd/schema` `src/account.ts` `siteFeature` | `feature === "calls" && site.plan === "starter"` returns `not-on-plan` | Re-key to web-only. |
| S3 | `@jdd/schema` `src/metering.ts` | `VoicePlan = "growth" \| "enterprise"`; `MinuteCaps` has no `starter`; `voiceSitesOf` filters Starter out | Starter must be meterable and billable per P2. Metered **per site**, like Growth, never pooled. |
| D1 | `jdd-ops/CLAUDE.md` "Plan tiers" table | States Starter gets no voice agent, no number, no Airtable | **Must be updated.** This file is read at the start of every session, so a stale table here will cause drift in work months from now. Treat it as code. |

`lib/reconcile-probes.js`, `lib/repair-ops.js`, and the console's `/manage` surfaces contain **no** `plan === 'starter'` branches. They key off the presence of env keys and ids, which is the right design: once Starter has those keys, they light up with no change. Verify this rather than assuming it.

---

## 4. Carrying the receptionist mode into provisioning (P3)

Today onboard.js knows the plan and nothing else. It must know the mode, and per P3 it must be **stated, never inferred**.

### 4.1 Schema

Add to `@jdd/schema` `src/intake.ts`, on both `Intake` and `IntakeEnvelope`, beside `plan`:

```ts
  /**
   * Whether this client's receptionist is active, and how the business line reaches it.
   *
   * Stated, never inferred. The wrong inference spends money: assuming a receptionist buys a
   * Twilio number and stands up a Retell agent for a client who refused one, and assuming the
   * opposite silently delivers a website to a client who paid for a receptionist.
   *
   * Envelope-level rather than per-site, matching `smsAlerts`: it is a decision about the
   * client's phone line, and an Enterprise client who wanted a receptionist on some sites but
   * not others is a conversation, not a code path.
   */
  receptionistMode: "forwarded" | "published" | "declined";
```

The agency-side plan already adds the same field to `PortalSite`, `zPortalSite`, `BrandIntakeSubmission`, and `zBrandIntakeSubmission`, plus an `isWebOnly(site)` helper. Reuse `isWebOnly`; do not write a second copy of the predicate here.

**`receptionistMode` must be required, not optional.** An optional field with a default is exactly the inference P3 forbids.

### 4.2 Validation

Extend the intake validation at `onboard.js:310-331`, alongside the existing `validPlans` check, to reject a missing or unrecognised `receptionistMode` with the same tone as the existing plan guard: name the three valid values, say that guessing is refused, and say why (paid Twilio/Retell resources). Fail before any provisioning runs.

### 4.3 Operator override

Add a CLI flag so a run can state the mode when the intake predates the field, mirroring how `--email` overrides the portal address:

```
node onboard.js --slug {slug} --receptionist forwarded|published|declined
```

Precedence: explicit flag wins over the intake value. If neither is present, **fail**. Do not default.

### 4.4 Console surface (P3)

P3 asks for a visible check. The console's `/manage/{slug}` already has a **Portal** section covering account attachment. Add the receptionist mode there as an explicit, auditable control showing the current mode and allowing a correction, since it decides both billing and what the client's portal shows.

Constraints from the existing design: `VERCEL_PROJECT_NAME`, `CLERK_USER_ID`, and `RETELL_LLM_ID` are read-only because onboard.js owns them. The receptionist mode is **not** in that category: it originates with the client, so the console may edit it. Every write must append to `console/.state/audit.ndjson` (key names, never values) like all other console writes. Note the console still has no auth of any kind.

---

## 5. The Starter env template (G3)

Starter currently writes six keys. It now needs the same keys as Growth, with `LEAD_DELIVERY_MODE=email` and the lead-email keys retained, because Starter still delivers web-form leads by Resend rather than by callback.

Target for a Starter **with** a receptionist, merging the two existing templates at `onboard.js:553-576`:

```
LEAD_DELIVERY_MODE=email
LEAD_TO_EMAIL={brand.email}
LEAD_BRAND_NAME={brand.name}
RESEND_API_KEY=...
RESEND_FROM_EMAIL=leads@juneaudigitaldesigns.com
RETELL_AGENT_ID=...
RETELL_LLM_ID=...
RETELL_API_KEY=...
RETELL_SIP_DOMAIN=...
TWILIO_NUMBER=...
CLIENT_FORWARD_PHONE={brand.phone}
CLIENT_FORWARD_RING_SECONDS=15
AIRTABLE_BASE_ID=...
RETELL_POST_CALL_WEBHOOK_URL=...
VERCEL_PROJECT_NAME={siteSlug}
```

A **web-only** client keeps today's six-key Starter template unchanged.

The cleanest structure is one template assembled from two parts, lead-delivery and voice, rather than three copy-pasted string literals. Preserve the existing behaviour exactly:

- `keep(k)` idempotency, so a re-run never wipes `RETELL_AGENT_ID` / `TWILIO_NUMBER` / `AIRTABLE_BASE_ID`
- the `CARRIED_KEYS` append for `AIRTABLE_SITE_TAG`, `CLERK_USER_ID`, `PORTAL_ACCOUNT_EMAIL`, which are written later in the run and silently dropped without it
- the `preserved:` log line

`CLIENT_FORWARD_PHONE` and `CLIENT_FORWARD_RING_SECONDS` are load-bearing for Starter now, since human-first routing is the entire pitch ("the AI never answers before you do"). Keep the ring window **below about 20 seconds**: if the forward rings long enough for the owner's carrier voicemail to answer, Twilio scores that as answered, the no-answer branch never fires, and the caller lands in voicemail instead of the agent. Default 15s stands.

---

## 6. Live-client regression you must fix

`scripts/link-external-client.js` linked two real, live, off-platform-billed sites as `plan: 'starter'`:

- `atlantic-compressor` (Atlantic Compressor)
- `air-service-florida` (Air Service of Florida)

Line 68's comment states the assumption outright: *"starter, no call data → no Airtable"*. They were never provisioned by onboard.js and have no agent, no number, no base.

Under the new rules, `siteFeature(site, "calls")` no longer short-circuits on plan. These sites are `status: 'live'` with no `airtableBaseId`, so calls now resolve to **`connecting`** instead of `not-on-plan`, and the portal will show two real clients a call-log tab that can never work. That reads as our breakage, which is precisely what the `FeatureAvailability` reason codes exist to prevent.

**Fix:** set `receptionistMode: 'declined'` on both sites, which makes them web-only and restores `not-on-plan`. Update the comment at line 68 and the `SITES` entries. The script is idempotent and audit-by-default, so re-run it with `--apply` once the schema tag carrying the field is installed.

Metering is already safe for them without any change: `voiceSitesOf` requires `Boolean(s.retellAgentId)`, and they have none, so they are excluded from minute accounting and overage billing regardless. Verify that rather than trusting it.

Also check `CONSOLE_INCLUDE_FIXTURES` handling and the `_e2e_test_growth` test client, which is deliberately retained. **Do not purge fixtures** while working through this.

---

## 7. Cost and risk

Starter's per-client COGS changes materially. It now carries a Twilio number (about $2/mo), Retell minutes, an Airtable base, and a Make post-call scenario clone, where previously it carried hosting and a Resend send.

Two things to confirm against the measured per-tier unit economics before this ships:

1. **Starter margin at $197** with the full voice stack. The earlier measurement was taken when Starter had no telephony at all, so it no longer applies.
2. **100 included minutes is roughly 20 short calls.** Per P2 overage is billed, so a busy Starter client will see overage on their invoice regularly. The cron already warns at 80% and 100%. Confirm those warnings read sensibly at a 100-minute cap, where a single long call is 10% of the allowance.

If either looks wrong, **stop and report it rather than changing a price.** Prices are the owner's call and were decided separately.

When reading Retell costs: `unit_price` is **cents per second**, not dollars per minute. Multiply by 60 or you will understate voice cost by roughly two thirds. And `list-agents` / `list-retell-llms` return **one row per version**, so dedupe by id before counting agents.

---

## 8. Order of work

1. **`@jdd/schema` v1.24.0** (S1, S2, S3, §4.1). Build, test, commit `src` **and** `dist` (dist is committed; a src-only change ships nothing), tag, push. Pushing needs the JDD GitHub account.
2. **Bump the pin to v1.24.0** in all three consumers: `jdd-ops/package.json:33`, `jdd-ops/console/package.json:19`, `juneau-digital-designs/package.json:12`. Install in each. Until this is done, `receptionistMode` is **silently stripped** by zod on read and nothing works. Verify against `node_modules/@jdd/schema/dist/`, never `src/`.
3. **onboard.js** G1-G9, plus §4.2 validation and §4.3 flag.
4. **`CLAUDE.md`** plan-tier table (D1), and the Twilio/lead-delivery sections that describe Starter as email-only.
5. **Console** receptionist control (§4.4).
6. **External-client fix** (§6).
7. **Verification** (§9).

Steps 1 and 2 are a hard gate. Do not start 3 before 2 is done.

---

## 9. Verification

A `--dry-run` must come first and must show, for a Starter client with a receptionist: a Twilio search and purchase, a Retell agent and per-client LLM creation, an Airtable base creation, a post-call clone, and a portal upsert carrying a non-null `retellAgentId`. For a web-only client it must show **none** of those.

Then, against a real test client (`_e2e_test_growth` is retained for this, but it is Growth; you may need a Starter equivalent):

- [ ] `receptionistMode` survives a round trip through KV and reads back from the portal
- [ ] Starter `.env.local` has the full key set; a re-run preserves ids and carried keys
- [ ] Starter's portal record keeps a non-null `retellAgentId` after a console repair (this is the G5 + S1 double-null regression)
- [ ] Inbound test call rings the owner's real phone **first**, and only reaches the agent on no-answer
- [ ] Post-call text brief actually delivers (P6 says A2P is fixed; prove it on a real call rather than trusting it)
- [ ] Lead email still arrives via Resend on a web-form submit, and no outbound callback fires for Starter
- [ ] Portal call log populates for the Starter site
- [ ] Usage tile shows the 100-minute cap, and the metering group is per site, not pooled
- [ ] A web-only site still reports `not-on-plan` for calls
- [ ] Atlantic and Air Service report `not-on-plan` for calls after the §6 fix
- [ ] `cd ../jdd-schema && npm test` green

When provisioning a number, remember Vercel **removes** characters invalid in a DNS label rather than substituting hyphens: `e2e_test_growth` serves at `e2etestgrowth.vercel.app`. Never re-derive that transform inline, import `vercelAppHost`. A wrong `voiceUrl` fails silently, with the number looking configured and the agent looking healthy.

---

## 10. Out of scope

- Changing prices, tiers, or included minutes. Decided separately; see the companion plan.
- The pricing page, agreement, checkout, or Stripe work. All in the companion plan.
- Removing or purging `_e2e_test_growth` or any fixture client.
- Retell prompt quality work beyond what provisioning a Starter agent requires.
- Adding auth to the console. Real gap, separate task.

If something blocks you, stop and report it rather than improvising a price, a plan mapping, or a provisioning default.
