# HANDOFF — A2P SIDs live in Redis, not in `.env.local`

**Repo:** `jdd-ops` (console + ops root)
**Date:** 2026-10-31
**Status:** correction to an existing handoff — act on this before `HANDOFF-console-onboarding-a2p.md` §6
**Decided by:** the operator, 2026-10-31, as part of `PLAN-console-a2p-registration.md` (decision 5)

---

## The correction

`HANDOFF-console-onboarding-a2p.md` §6 plans the A2P SIDs as read-only keys in
`console/src/lib/envFields.ts`, which means they land in `clients/{slug}/.env.local` and surface at
`/manage → Environment`:

> | `A2P_*` SIDs + `A2P_BRAND_TYPE` + `A2P_CAMPAIGN_STATUS` | integrations | read-only |

**Do not add those keys.** The registration chain's SIDs live in a single Redis record,
`jdd:a2p-registration:{slug}`, which the console owns and reads.

### Why

The chain produces roughly ten SIDs across four phases, each arriving at a different gate, plus a
field-level evaluation result that is a structured object rather than a string. `.env.local` is a
flat string store synced to Vercel; the evaluation result has nowhere to live in it, and ten
provisioned keys that no deployment reads would all be synced to a client's Vercel project for no
reason. The record also carries the chain's *state* — what has been filed, what is pending, what was
rejected — which is what the console's stepper reads to decide the next legal action. That is state,
not configuration.

---

## What to change

1. **`console/src/lib/envFields.ts`** — add no `A2P_*` keys. Leave a one-line comment saying why, or
   someone reading §6 of the sibling handoff will add them back. A key absent from this file is
   invisible at `/manage → Environment` by design here, not by omission.

2. **`/manage → Environment`** shows no A2P SIDs at all. Their only surface is the new
   **Messaging & A2P** section (`PLAN-console-a2p-registration.md` Phase 4), which renders them from
   the record alongside the status each one is waiting on.

3. **`CLIENT_MESSAGING_SERVICE_SID` is the exception and stays an env var.** It is operational client
   configuration rather than chain state: `onboard.js`, `lib/vercel-sync.js` and the reconcile probe
   read it, and the portal needs its own mirror in `PortalSite.messagingServiceSid` because the
   agency site cannot read a client's `.env.local`. Keep all of that exactly as the sibling handoff
   §5 describes. The record holds a copy for the chain's own use; `.env.local` remains the value
   anything operational reads.

4. **`lib/reconcile-probes.js`** — the A2P probe reads the Redis record, not env. Note this is
   *separate* from the existing fix that handoff already calls for: the master-pool probe currently
   flags a live number not in the master pool as drift, which is backwards now that Growth and
   Enterprise numbers join their own service.

5. **Teardown** (`lib/teardown-ops.js`, `lib/provisioned-fields.js`) — a torn-down client's
   `jdd:a2p-registration:{slug}` must be deleted too, **guarded on registration never having
   completed.** Deleting the TrustHub objects behind an approved brand breaks a live registration;
   deleting only our record orphans objects on Twilio's side with no way left to find them.
   `DELETE /v1/EndUsers/{sid}` is confirmed supported (204 No Content).

6. **`console/src/lib/goLive/preflight.ts`** — if an A2P assertion is added there, it reads the
   record. Keep the existing `MG` assertion on `CLIENT_MESSAGING_SERVICE_SID` as an env check.

---

## What does **not** change

- `PortalSite.a2pStatus` stays in `@jdd/schema` (v1.30.0, already shipped) and stays the only A2P
  value the client portal ever reads. The record is server-side state; the status is the summary.
- `onboard.js:2326` keeps initialising `a2pStatus` — `none` for growth/enterprise,
  `not-applicable` for starter/web-only. It is correct as written and this changes nothing about it.
- Nothing about the Make scenario, the notification number, or the two messaging lanes.

---

## One thing worth stating plainly

The sibling handoff's reasoning for `envFields.ts` was sound on its own terms — "`A2P_*` SIDs are
opaque references, not secrets, and should not be masked." That is still true. They are not being
moved out of `.env.local` because they are sensitive; they are being moved because they are state
with a shape, arriving at ten different moments, that one record models and a flat env file does not.
