# PLAN — Console production wiring audit & fix

**Author:** Opus (planning) · **Executor:** Sonnet · **Date:** 2026-10-07
**Repo:** `jdd-ops/console` (local-only Next.js app, no auth) · **Never deployed.**

---

## 0. Why this plan exists (root cause — already diagnosed, do not re-investigate)

When JDD moved to production, **`jdd-ops/.env`** was updated to live credentials
(`CLERK_SECRET_KEY=sk_live_…`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_…`,
`STRIPE_READONLY_KEY=rk_live_…`, prod KV `tolerant-pug-147398.upstash.io`).

**The console's own `console/.env.local` was never updated.** Next.js auto-loads
`.env.local` and it **overrides** everything, so the console is still pinned to the
**TEST** Upstash instance:

| Source | KV host |
|---|---|
| `console/.env.local` | `https://rich-eel-130612.upstash.io`  ← **TEST** |
| `jdd-ops/.env` (prod) | `https://tolerant-pug-147398.upstash.io`  ← **PROD** |

`jdd-ops/.env` even documents this: `# TEST_KV_REST_API_URL="https://rich-eel-130612.upstash.io"`.

**Consequence:** every KV read/write the console does (portal accounts, leads, intake,
tickets, client records, reconcile, cancel/featured) hits the **test** instance.
That is exactly why portal **attach/repair** "didn't create a record on production":
the record was written to `rich-eel`.

Clarification on the user's mental model: attach/repair does **not** write to Clerk.
The portal account→site mapping is a **KV record** (`accountStore.ts`, via `@jdd/schema`);
the Clerk *user* is created by `onboard.js` step 10. So "no record on production Clerk"
= "the KV record landed in the test instance."

### Secondary findings to fold in
1. **KV is read only from `console/.env.local`**, not from `jdd-ops/.env` the way Vercel/
   Stripe/Clerk/Retell keys are (those go through `src/lib/opsSecrets.ts`). That split is
   the structural reason this drifted. **Fix = centralize KV in `jdd-ops/.env`.**
2. **Stripe key naming drift.** `jdd-ops/.env` has `STRIPE_LIVE_SECRET_KEY=sk_live_…` +
   `STRIPE_READONLY_KEY=rk_live_…` but **no `STRIPE_SECRET_KEY`**. The go-live design
   intended `STRIPE_LIVE_SECRET_KEY` to be *temporary* (create live prices/webhook, then
   move the live key into `STRIPE_SECRET_KEY` and delete the temp). Reads still work via
   `rk_live` readonly, but this is a live full-access secret left sitting in the file and a
   latent null for any path expecting `STRIPE_SECRET_KEY`. Hygiene item.

---

## 1. Decisions locked (from user, do not revisit)

1. **KV wiring:** Centralize in `jdd-ops/.env` (read via `opsSecrets.ts`); remove the KV
   override from `console/.env.local`.
2. **Stale test-KV records:** Do **not** migrate. After the fix, re-run attach/repair for
   affected clients against production.
3. **Audit scope:** Full write-path audit of every console feature that mutates production.
4. **Guardrail:** Add a production-mode indicator (banner) + confirm-before-write on
   production/destructive actions.

---

## 2. Ground rules for the executor

- **Do not touch `jdd-ops/.env` values.** They are correct (live). This plan changes
  *console code* and *`console/.env.local`* only.
- **Never print secret values** in code, logs, audit entries, or responses. Prefix-only
  (`sk_live_…`) is the existing convention — keep it.
- The console has **no auth** and will now act on **live customer data**. Prefer additive,
  reversible changes. Every KV write already appends to `console/.state/audit.ndjson` —
  preserve that.
- After each phase run `npm run build` (or `npx tsc --noEmit`) and fix type errors in
  **touched files only** — the repo baseline is noisy (see memory). Do **not** run
  `next build` over a live dev server.
- PowerShell mangles UTF-8: edit files with the Edit/Write tools, never round-trip through
  `Get-Content | Set-Content`.

---

## 3. Phase 1 — Centralize KV on production (the core fix)

### 3.1 Add a KV credential loader to `opsSecrets.ts`
File: `src/lib/opsSecrets.ts` — mirror the existing `loadVercelCredentials()` pattern.

```ts
/**
 * KV (Upstash) credentials for every console store (accounts, leads, intake, tickets,
 * client records, reconcile, cancel/featured). Copies the production pair out of
 * jdd-ops/.env into process.env without clobbering an existing value, so the console reads
 * the SAME instance as the agency site. Idempotent; safe to call per request.
 *
 * This is the single source of truth: console/.env.local must NOT define KV_* anymore,
 * or it would re-introduce the test/prod drift this replaced.
 */
export function loadKvCredentials(): boolean {
  const ops = parseEnvFile(resolve(opsRoot(), '.env'));
  const keys = ['KV_REST_API_URL', 'KV_REST_API_TOKEN', 'KV_REST_API_READ_ONLY_TOKEN'] as const;
  for (const key of keys) {
    if (!process.env[key] && ops[key]) process.env[key] = ops[key];
  }
  return Boolean(
    (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) &&
      (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN),
  );
}
```

### 3.2 Call the loader at every KV client choke point
Each of these modules has a lazy `getRedis()` (or equivalent) that reads `process.env`
**inside the function** (verified lazy — none read KV at module top). Add
`loadKvCredentials();` as the **first line** inside that function, and add the import
`import { loadKvCredentials } from './opsSecrets';` (adjust relative path).

Modules to patch (all under `src/lib/`):
- `accountStore.ts` — `getRedis()` (line ~35)
- `intakeQueue.ts` — `getRedis()` (line ~38 area)
- `leadQueue.ts` — `getRedis()` (line ~42)
- `ticketStore.ts` — `getRedis()` (line ~58)
- `clientRecord.ts` — `getRedis()` (line ~53)
- `pendingKv.ts` — `getRedis()` (line ~27)
- `reconcileStore.ts` — `getRedis()` (line ~50)
- `cancelKv.ts` — `getRedis()` (line ~30)

Also update the `*Configured()` guards (e.g. `accountStoreConfigured()`,
`pendingKvConfigured()`) to call `loadKvCredentials()` before testing `process.env`, so a
route that gates on "configured" before touching the client sees prod creds too.

**Go-live KV code — handle with care, the two files differ:**
- `src/lib/goLive/preflight.ts` — **leave as-is.** It reads the **agency** site's env
  explicitly (`agency.KV_REST_API_URL`, parsed from the agency repo's `.env`), pings it, and
  does not use ambient `process.env`. Do **not** add the loader here.
- `src/lib/goLive/kvReset.ts` — **⚠ this one reads AMBIENT `process.env.KV_*`** via
  `getRedisOrNull()` and **destructively deletes `jdd:*` keys** (route
  `/api/go-live/kv-reset`, labeled "Delete jdd:* keys"). Before Phase 1 the console pointed
  at the test instance, so this wiped **test**. **After Phase 1 it would resolve to
  PRODUCTION (`tolerant-pug`) and wipe live data.** This is the single most dangerous
  interaction in this change.
  - Do **not** add `loadKvCredentials()` to `kvReset.ts`.
  - **Add a hard guard:** `runKvReset` must refuse (return `{ ok:false }` with a clear error)
    when the resolved KV host is the production host. Derive "is production" from the same
    signal Phase 4 uses (host `tolerant-pug` / `envMode === 'production'`). The cutover is
    already done, so wiping prod via this tool is never the intent — a refusal is correct.
  - Keep its existing dry-run-first + host-naming behavior; the guard is additive.

### 3.3 Remove the KV override from `console/.env.local`
Delete these lines from `console/.env.local` (leave `RESEND_*`, `CONSOLE_INCLUDE_FIXTURES`):
```
KV_REST_API_URL=…
KV_REST_API_TOKEN=…
```
(If a read-only token line exists there, remove it too.)

> Verify `RESEND_API_KEY` in `console/.env.local` is the **production** Resend key (the one
> that sends from the verified JDD domain). If unsure, flag it — do not guess. Per memory,
> Resend 403s are usually the wrong API-key *account*, not DNS.

### 3.4 Phase 1 acceptance check
- Start the dev server. Open `/manage` → a client → **Portal**. The read side
  (`/api/manage/portal`) must resolve the account from **prod** KV.
- Add a temporary server log (or use `/api/manage/portal` response) to confirm the resolved
  KV host is `tolerant-pug` — e.g. one-off: log `process.env.KV_REST_API_URL` host in a
  dev-only route, then remove it. **Never log the token.**
- `accountStoreConfigured()` returns true with `console/.env.local` KV removed.

---

## 4. Phase 2 — Full production write-path audit

Produce `console/docs/PRODUCTION-WIRING-AUDIT.md`: a table of every route/feature that
**mutates production** (or reads live money/customer data), the credential + instance it
uses, and PASS/FAIL after Phase 1. The credential-source rules are deterministic:

- **KV stores** → must come from `loadKvCredentials()` (prod `tolerant-pug`) after Phase 1.
- **Vercel** (`VERCEL_TOKEN`/`TEAM_ID`) → `loadVercelCredentials()` from `jdd-ops/.env`.
- **Retell** → `loadRetellApiKey()`. **GitHub** → `loadGithubToken()`. **Make** →
  `loadMakeApiKey()`. **Blob** → `loadBlobToken()`. **Stripe read** → `loadStripeKey()`
  (expect `restricted:true, mode:'live'`). **Teardown creds (Twilio/Airtable/Clerk)** →
  `loadTeardownCredentials()`. **Portal delegated writes** → `loadPortalOpsConfig()`
  (`PORTAL_BASE_URL` should point at production + `OPS_SHARED_SECRET`).

Routes/features to cover (enumerated — verify each, don't rediscover):

**Portal:** `api/manage/link-portal`, `api/manage/repair-portal`, `api/manage/portal` (read)
**Env:** `api/manage/env`, `api/manage/env/redeploy`, `api/manage/env/reveal`,
`api/manage/env/sync-key`
**Plan/billing (money):** `api/manage/plan`, `api/manage/plan/billing`,
`api/manage/plan/downgrade{,/preview,/execute}` — confirm writes go through the **portal
delegation** (`loadPortalOpsConfig`), not a local Stripe write, and `PORTAL_BASE_URL` = prod.
**Lifecycle/teardown:** `api/manage/teardown{,/preview}`, `api/manage/repair{,/undo}`,
`api/manage/reconcile`, `api/manage/lifecycle`
**Domains:** `api/manage/domains{,/verify}`, `api/manage/canonical`
**Featured (writes to agency blob + KV):** `api/manage/featured/{publish,unpublish}`
**Agent:** `api/manage/agent-prompt` (Retell LLM write)
**Leads/intake/tickets (KV writes):** `api/leads`, `api/leads/convert`, `api/leads/calls`,
`api/intake/{import,inbox,[id]}`, `api/tickets`, `api/sms-consent`
**Client welcome/remind (sends email):** `api/c/[slug]/{welcome,remind}`
**Go-live (one-time migration tools):** `api/go-live/*` — verify, but these are
intentionally special; note their instance handling rather than "fixing" it.

For each: **PASS** if it resolves the production credential/instance via the correct loader;
**FAIL** + remediation note otherwise. Expected residual FAILs feed Phase 3.

---

## 5. Phase 3 — Stripe key hygiene

Goal: the console's canonical live Stripe key lives in `STRIPE_SECRET_KEY`, and the
temporary `STRIPE_LIVE_SECRET_KEY` is retired — matching the go-live design in
`src/lib/goLive/stripePrices.ts` / `stripeWebhook.ts`.

1. Confirm live prices + webhook already exist in the **live** Stripe dashboard (the
   `price_…` ids in `jdd-ops/.env` and `STRIPE_WEBHOOK_SECRET=whsec_…` are present — they
   are). If confirmed, the one-time `STRIPE_LIVE_SECRET_KEY` has served its purpose.
2. **Recommend to the user** (do not edit `jdd-ops/.env` without confirmation) one of:
   - Rename `STRIPE_LIVE_SECRET_KEY` → `STRIPE_SECRET_KEY` (so `loadStripeKey()` fallback
     and any `process.env.STRIPE_SECRET_KEY` reader resolve a live key), **or**
   - Delete `STRIPE_LIVE_SECRET_KEY` entirely if the console only ever needs the
     `rk_live_` readonly key (current read paths work on readonly alone).
3. Re-run `/api/go-live/preflight` and confirm Stripe checks report **live**, not "still test".
4. Audit doc: record the chosen end state.

> This phase only *recommends* `jdd-ops/.env` edits and verifies behavior; the user applies
> the env change. Everything else in this plan is code.

---

## 6. Phase 4 — Production-mode guardrail

### 6.1 Compute a non-secret `envMode` in `opsConfig.ts`
Add `envMode: 'production' | 'test' | 'mixed'` to the `OpsConfig` interface
(**`src/lib/types.ts:108`** — the type lives there, imported by `opsConfig.ts`) and compute
it in `readOpsConfig()` (`src/lib/opsConfig.ts:42`, which already parses `jdd-ops/.env` into
`ops` and the agency env into `agency`). Derive from **prefixes/hosts only** (never the
values):
- KV host: `tolerant-pug` ⇒ prod, `rich-eel` ⇒ test
- `CLERK_SECRET_KEY` starts `sk_live_` ⇒ prod, `sk_test_` ⇒ test
- Stripe: `STRIPE_READONLY_KEY`/`STRIPE_SECRET_KEY`/`STRIPE_LIVE_SECRET_KEY` `*_live_` ⇒ prod
- All-prod ⇒ `production`; all-test ⇒ `test`; any disagreement ⇒ `mixed` (this is the state
  that must shout — it is the bug class we just fixed).

### 6.2 Banner in the manage shell
File: `src/app/c/[slug]/manage/layout.tsx` (server component — call `readOpsConfig()` here).
Render a thin banner above `<ManageNavChrome />` inside the `.manage-chrome` wrapper:
- `production` → a clear "PRODUCTION — live customer data" bar.
- `mixed` → a loud warning bar naming which signal disagrees.
- Follow `DESIGN-LANGUAGE.md`; **no em-dashes** in copy (memory rule) — use commas/periods.
- Also surface it on the roster `src/app/manage/page.tsx` so it's visible before entering a client.

### 6.3 Confirm-before-write on production/destructive actions
Add one shared client confirm modal (new `src/components/manage/ConfirmWrite.tsx` — there is
no existing confirm pattern) and gate the **mutating** actions in these components so that,
when `envMode !== 'test'`, the action requires an explicit confirm naming the client + the
effect. **`ManageProvider` currently accepts only `ctx` (`ManageContext.tsx` ~line 72) and
`ManageContextValue` has no `envMode` field** — add an `envMode` prop to `ManageProvider`,
add it to `ManageContextValue`/`useManage()`, and pass it from the layout
(`readOpsConfig().envMode`). The layout is already a server component that can call
`readOpsConfig()`.

Wrap the write triggers in:
- `PortalSection.tsx` / `PortalRepairPanel.tsx` (attach/repair)
- `EnvironmentSection.tsx` + `SaveBar.tsx` (push env + redeploy)
- `DangerSection.tsx` (teardown)
- `PlanControl.tsx` / `BillingSyncPanel.tsx` / `PlanDowngradePanel.tsx` (money)
- `DomainSection.tsx` (domain/canonical changes)
- `FeaturedSection.tsx` (publish/unpublish)
- `VoiceAgentSection.tsx` (Retell LLM push)

Read-only panels (Overview, Deployments list, roster) get **no** confirm.

### 6.4 Guardrail acceptance check
- With prod creds, the banner reads **PRODUCTION** on both roster and client shell.
- A destructive action shows the confirm modal; cancel aborts with no network call;
  confirm proceeds and still writes the `audit.ndjson` entry.
- Temporarily point `console/.env.local` KV back at `rich-eel` → banner flips to `mixed`
  (Clerk/Stripe prod but KV test) — then restore. This proves `mixed` detection works.

---

## 7. Phase 5 — Verify the original symptom is fixed

1. With Phase 1 live, go to `/manage` → the client the user tried to attach → **Portal** →
   run **attach/repair**.
2. Confirm the response reports success and the write targeted prod.
3. Read the record back from **production** KV to prove it landed:
   - Via the console: reload Portal; the account/site now resolves.
   - Independent check (optional, read-only): a one-off script using `@upstash/redis` with
     the **prod** creds from `jdd-ops/.env`, `GET` on `accountKey(email)` (key helper from
     `@jdd/schema`). Print the record (no secrets). Put the script in the scratchpad, not the repo.
4. Confirm the agency site's portal (production) now shows the client's site on sign-in.
5. Spot-check that leads/intake/tickets in the console now reflect **production** data
   (they will differ from the test data shown before — expected).

---

## 8. Done / acceptance summary

- [ ] `loadKvCredentials()` added; all 8 KV store modules + their `*Configured()` guards call it.
- [ ] KV lines removed from `console/.env.local`; console reads `tolerant-pug` (prod).
- [ ] `goLive/preflight.ts` left as-is (explicit agency creds).
- [ ] `goLive/kvReset.ts` NOT given the loader, AND guarded to refuse against the prod host
      (so `/api/go-live/kv-reset` can never wipe production).
- [ ] `docs/PRODUCTION-WIRING-AUDIT.md` written; every write path PASS or noted.
- [ ] Stripe hygiene verified; end-state recommended to user; preflight says "live".
- [ ] `envMode` computed; PRODUCTION/mixed banner on roster + manage shell.
- [ ] Confirm-before-write on all listed mutating panels; read-only panels unaffected.
- [ ] Original symptom reproduced-then-fixed: attach writes to prod KV and is read back.
- [ ] `npm run build` clean for touched files; no secrets printed anywhere.

## 9. Rollback
- All code changes are additive/guarded; revert the touched files to roll back.
- `console/.env.local`: re-adding the `rich-eel` KV lines restores the prior (test) behavior
  instantly, since they override the loader.
- No `jdd-ops/.env` values are changed by code in this plan (Stripe change is user-applied).
