# PLAN — Console production wiring: leftover cleanup

**Author:** Opus (planning) · **Date:** 2026-10-07
**Follows:** `PLAN-production-wiring-audit.md` (Phases 1–4 implemented & verified).
**Repo:** `jdd-ops/console` (local-only, never deployed).

Covers the discoveries left open after the main fix. Decisions below are locked by the user.

## Decisions locked
- **Stripe:** delete `STRIPE_LIVE_SECRET_KEY` (user-applied env edit).
- **Clerk key exposure:** **accept, do NOT rotate.** No step in this plan touches Clerk.
- **Cleanup in scope:** gate the Deployments redeploy; fix misleading KV error strings.
- **Live attach re-run:** **manual** — documented here, the user performs the production write.

## Explicitly OUT of scope (by decision)
- Clerk secret-key rotation.
- `app/clients/page.tsx` roster layout visual check.
- `RESEND_API_KEY` production verification.
(If any of these change, add them later — not here.)

## Ground rules
- Do **not** edit `jdd-ops/.env` from code. The Stripe change is the user's manual edit.
- Never print secret values. Edit files with Edit/Write (PowerShell mangles UTF-8).
- After code phases run `npx tsc --noEmit`, fix errors in **touched files only**.

---

## Phase A — Stripe: retire the live full-access secret (user-applied)

**This is a manual `jdd-ops/.env` edit by the user, not code.**

1. In `jdd-ops/.env`, **delete the `STRIPE_LIVE_SECRET_KEY=sk_live_…` line.** Leave
   `STRIPE_READONLY_KEY` (`rk_live_`), the four `STRIPE_PRICE_*` ids, and `STRIPE_WEBHOOK_SECRET`.
2. Why it's safe: the console's Stripe use is **read-only** via `loadStripeKey()`, which prefers
   `STRIPE_READONLY_KEY` (`rk_live_`). Billing *writes* are delegated to the portal
   (`loadPortalOpsConfig()` → production). Nothing the console runs normally needs a full-access
   live key.
3. Caveat to remember (not an action): the one-time go-live Stripe tools
   (`lib/goLive/stripePrices.ts`, `stripeWebhook.ts`) look for `STRIPE_LIVE_SECRET_KEY`. Live
   prices + webhook already exist, so these shouldn't need to run again. If they ever do,
   re-add the key temporarily, then delete it again.

**Verify after the edit:** open `/manage` → a client → Account/Billing (or the briefing MRR)
and confirm Stripe figures still load (proves `rk_live_` reads work without the deleted key).

---

## Phase B — Gate the Deployments redeploy (code)

The confirm-before-write guard was added to the *Environment* redeploy but not the one in the
*Deployments* section. Same action (`POST /api/manage/env/redeploy`), same risk → same gate.

File: `src/components/manage/DeploymentsSection.tsx`
- Line ~38: `const { ctx, site } = useManage();` → add `confirmWrite`:
  `const { ctx, site, confirmWrite } = useManage();`
- In `async function redeploy()` (line ~68), add the guard as the **first statement**, mirroring
  `EnvironmentSection.tsx:43–55`:
  ```ts
  if (
    !(await confirmWrite({
      title: 'Redeploy to production',
      // match the body/confirm-label copy EnvironmentSection uses; name the client/site.
    }))
  ) return;
  ```
- Copy rules: **no em-dashes**; name the client + that this triggers a live deploy.
- `confirmWrite` resolves true immediately in test mode, so test-mode behavior is unchanged.

**Acceptance:** in production mode the Deployments "Redeploy" button shows the confirm dialog;
cancel makes no network call; confirm proceeds and still writes the audit entry.

---

## Phase C — Fix misleading KV "not configured" error strings (code)

After centralization, KV comes from `jdd-ops/.env` (via `loadKvCredentials()`), not
`console/.env.local`. These store error strings still tell the operator to set KV in
`console/.env.local`, which is now wrong and would send them to the wrong file during an outage.

Update the message in each of these to point at **`jdd-ops/.env`** (wording e.g.:
`"KV not configured — set KV_REST_API_URL and KV_REST_API_TOKEN in jdd-ops/.env."`). Keep each
module's existing extra context; only correct the file location:

- `src/lib/accountStore.ts:43` (add the `jdd-ops/.env` location — currently names no file)
- `src/lib/cancelKv.ts:29`
- `src/lib/clientRecord.ts:52–53`
- `src/lib/intakeQueue.ts:37`
- `src/lib/leadQueue.ts:41`
- `src/lib/pendingKv.ts:26`
- `src/lib/reconcileStore.ts:49–50`
- `src/lib/ticketStore.ts:57`

**Do NOT change** (these references are still correct):
- `src/lib/resend.ts:9` — `RESEND_API_KEY` genuinely still lives in `console/.env.local`.
- `src/lib/fixtures.ts:29` — `CONSOLE_INCLUDE_FIXTURES` still lives in `console/.env.local`.
- `src/lib/opsSecrets.ts` comments — accurate (they explain the override semantics).
- `planChange.ts:78`, `teardownPlan.ts:244` — generic "KV not configured", no file named.

**Acceptance:** `grep -rn "console/.env.local" src/lib/*.ts` returns only the resend/fixtures/
opsSecrets lines above; no KV store points at `console/.env.local`. `tsc` clean on touched files.

---

## Phase D — Manual verification runbook (user performs; one real production write)

Do these in a running dev server (`npm run dev` in `console/`). The attach step writes to
**production** KV — that is the intended outcome (it's the record that was missing).

1. **Original symptom fix (the point of all this):**
   - Go to `/manage` → the client that failed before → **Portal**.
   - Run **attach/repair**. The production-mode **confirm dialog** should appear; confirm.
   - Reload Portal: the account/site now resolves. The record is in production
     (`tolerant-pug`), not the test instance.
   - Re-run for any other clients whose attach/repair was attempted on the test KV (these were
     deliberately **not** migrated).

2. **Banner shows PRODUCTION** on both the roster (`/clients`) and inside a client's manage shell.

3. **`mixed` detection (optional):** temporarily re-add the `rich-eel` KV pair to
   `console/.env.local`, reload → banner flips to `mixed` (KV test, Clerk/Stripe live) → remove
   the lines again. Proves the drift this whole effort fixed would now be caught loudly.

4. **Cancel is inert (optional):** on any gated action, open the confirm dialog and cancel;
   confirm no network request fired (browser Network tab).

5. **Go-live preflight (optional):** hit `/api/go-live/preflight` and confirm the Stripe checks
   report **live** (and, post-Phase-A, that nothing depends on the deleted key).

---

## Phase E — Detach a site from a portal account from the manage view (code)

New feature. The lib function already exists and is proven — `detachSiteFromAccount(email, slug)`
in `src/lib/accountStore.ts:145` (used by teardown at `api/manage/teardown/route.ts:250`). It
removes one site from an account's `sites[]`, preserving every other site, and returns the
updated `PortalAccount` (or `null` if the account didn't exist — which is success for a detach).
This phase exposes it as a manual action: a new route + a Detach button. It is the inverse of the
existing attach (`link-portal`).

**Scope note (intentional):** detach removes the **site → account mapping** only. It does NOT
scrub `CLERK_USER_ID` from the client's disk `.env.local`, and does NOT delete the Clerk user or
the `jdd:account-by-user:` index. That's deliberate and reversible: after detaching, the Portal
read shows "account linked, site not attached", so you can re-attach the site to the correct
email. (Full removal is what `teardown` is for.)

### E.1 Audit action
`src/lib/audit.ts:23` — add `| 'portal.detach'` to the `AuditAction` union, alongside the
existing `'portal.attach'` / `'portal.repair'`.

### E.2 New route — `src/app/api/manage/detach-portal/route.ts`
Model it on `link-portal/route.ts` (same imports, guards, audit shape):
- `POST` with body `{ email: string; siteSlug: string }`. Validate both are non-empty strings;
  `400` otherwise.
- Guard `if (!accountStoreConfigured()) …` (returns the same "not configured" shape link-portal
  uses) — this also runs `loadKvCredentials()` under the hood (Phase 1), so it targets production.
- Call `await detachSiteFromAccount(email, siteSlug)`.
  - `null` → account didn't exist: return `{ ok: true, detached: false, note: 'No account for <email>.' }`.
  - otherwise → `{ ok: true, detached: true, email, siteSlug, sitesRemaining: account.sites.length }`.
- `appendAudit({ slug: <client slug from body or siteSlug>, siteSlug, action: 'portal.detach', ok, summary })`
  — key names/slugs only, never values, matching the other portal routes.
- Wrap in try/catch; on error append the audit with `ok: false` and return `500` with the message,
  exactly as `repair-portal/route.ts:167–169` does.
- Import `detachSiteFromAccount` (add it to the existing `accountStore` import used by the portal routes).

### E.3 UI — Detach button in `src/components/manage/PortalSection.tsx`
The account record (`/api/manage/portal`) already renders the attached sites. For each attached
site, add a **Detach** control:
- Use the existing `confirmWrite` from `useManage()` (already imported, line 40). Detach is
  destructive, so gate it: title names the **site** and the **account email**, body states the
  site will stop appearing in that account's portal, confirm label e.g. "Detach site".
- On confirm, `POST /api/manage/detach-portal` with `{ email, siteSlug }`, then re-run the
  existing `load()` so the panel refreshes to the post-detach state. Mirror the fetch/error
  handling of `attach()` (line 74).
- Place it with the per-site display, visually subordinate to Attach/Repair (it's the rarer,
  destructive path). No em-dashes in any copy.
- Test-mode: `confirmWrite` resolves true immediately, so detach still works without a dialog
  in test.

**Acceptance (E):**
- A new `POST /api/manage/detach-portal` removes one site and leaves the account's other sites
  intact (verify `sitesRemaining` and a re-read of the account).
- The Portal panel shows a Detach button per attached site; in production mode it prompts via
  `confirmWrite`; cancel makes no request.
- Detaching a site the account doesn't have, or an account that doesn't exist, returns a clean
  non-error result (no 500).
- `portal.detach` appears in `console/.state/audit.ndjson` (names only).
- `npx tsc --noEmit` clean for touched files.

---

## Acceptance summary
- [ ] (A) `STRIPE_LIVE_SECRET_KEY` deleted from `jdd-ops/.env`; Stripe figures still load.
- [ ] (B) Deployments redeploy gated by `confirmWrite`; test-mode unchanged.
- [ ] (C) All 8 KV store error strings point at `jdd-ops/.env`; resend/fixtures left as-is.
- [ ] (E) Detach route + button work; other sites preserved; audited; confirm-gated in prod.
- [ ] `npx tsc --noEmit` clean for touched files.
- [ ] (D) Attach re-run writes to production and reads back; banner reads PRODUCTION.

## Rollback
- Phase A: re-add the `STRIPE_LIVE_SECRET_KEY` line.
- Phases B/C/E: revert the touched component/lib/route files (additive, low-risk). Phase E adds a
  new route + button and one union member; deleting them fully reverts it.
