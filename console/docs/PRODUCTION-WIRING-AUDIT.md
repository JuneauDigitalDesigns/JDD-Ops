# Console production wiring audit

Date: 2026-10-07. Scope: every console route that mutates production or reads live money/customer data.
Method: static read of each route's credential source after Phase 1. No secret values appear here (hosts and key prefixes only).

## Root cause (fixed)

`console/.env.local` pinned `KV_REST_API_URL` to the TEST Upstash instance (`rich-eel-130612`) and, because Next auto-loads `.env.local` ahead of everything, every KV store read and wrote test data while `jdd-ops/.env` held the live pair (`tolerant-pug-147398`). Portal attach/repair "didn't create a record on production" because the KV record landed in `rich-eel`. (Attach/repair never writes to Clerk; the account-to-site mapping is a KV record.)

## What changed

- `src/lib/opsSecrets.ts`: new `loadKvCredentials()` (and read-only `opsKvHost()`); copies the KV pair from `jdd-ops/.env` into `process.env` without clobbering.
- Eight stores call it in `getRedis()` and in their `*Configured()` guard: `accountStore`, `intakeQueue`, `leadQueue`, `ticketStore`, `clientRecord`, `pendingKv`, `reconcileStore`, `cancelKv`.
- `console/.env.local`: `KV_REST_API_URL` and `KV_REST_API_TOKEN` removed (RESEND_* and CONSOLE_INCLUDE_FIXTURES kept).
- `src/lib/goLive/kvReset.ts`: NOT given the loader. Added a hard guard that refuses (before any SCAN/DEL, dry run included) when the resolved host is production (`tolerant-pug`, or equal to the host recorded in `jdd-ops/.env`).
- `src/lib/goLive/preflight.ts`: untouched (explicit agency creds).

## Credential-source rules

| Concern | Loader | Instance / account |
|---|---|---|
| KV stores | `loadKvCredentials()` | prod `tolerant-pug` |
| Vercel | `loadVercelCredentials()` | jdd-ops/.env |
| Retell | `loadRetellApiKey()` | jdd-ops/.env |
| GitHub | `loadGithubToken()` | jdd-ops/.env |
| Make | `loadMakeApiKey()` | jdd-ops/.env |
| Blob | `loadBlobToken()` | jdd-ops/.env |
| Stripe (read) | `loadStripeKey()` | `rk_live_` readonly, restricted, mode live |
| Twilio/Airtable/Clerk (teardown) | `loadTeardownCredentials()` | jdd-ops/.env (Clerk `sk_live_`) |
| Billing writes | `loadPortalOpsConfig()` | `PORTAL_BASE_URL` unset in both env files, so defaults to `https://juneaudigitaldesigns.com` (prod); `OPS_SHARED_SECRET` set |
| Email (Resend) | `process.env.RESEND_API_KEY` | `console/.env.local` (see note 2) |

## Route table

| Route | Mutates / reads | Credential + instance | Result |
|---|---|---|---|
| `api/manage/link-portal` | KV portal account (write) | accountStore, prod KV | PASS (was FAIL: test KV) |
| `api/manage/repair-portal` | KV portal account (write) | accountStore, prod KV | PASS (was FAIL) |
| `api/manage/portal` | KV read | accountStore, prod KV | PASS |
| `api/manage/account`, `lifecycle`, `reconcile` | KV read (reconcile store write) | account/clientRecord/reconcile stores, prod KV | PASS |
| `api/manage/env` | disk + Vercel env + portal account airtable id | Vercel loader; accountStore prod KV | PASS |
| `api/manage/env/redeploy`, `env/sync-key`, `deployments`, `domains`, `domains/verify`, `firewall`, `probe`, `roster` | Vercel | `loadVercelCredentials()` | PASS |
| `api/manage/env/reveal` | disk read of one key | none (local) | PASS (localhost-only assumption, unchanged) |
| `api/manage/canonical` | disk + accountStore | prod KV | PASS |
| `api/manage/plan` | plan in KV + Retell + disk; `mirrorPlanToPortal` | Retell loader; prod KV. No Stripe write | PASS |
| `api/manage/plan/billing` | Stripe via portal delegation | `loadPortalOpsConfig()`, prod portal URL, no Stripe code in console | PASS |
| `api/manage/plan/downgrade{,/preview,/execute}` | Twilio/Retell/Clerk teardown ops + KV mirror | teardown/Retell loaders; prod KV | PASS (billing still needs the separate `plan/billing` sync) |
| `api/manage/teardown{,/preview}` | Vercel, GitHub, Retell, Make, Twilio, Airtable, Clerk, KV client record | all loaders; prod KV | PASS |
| `api/manage/repair{,/undo}` | Retell, Make, Twilio, Vercel, KV | loaders; prod KV | PASS |
| `api/manage/featured/{publish,unpublish}`, `featured` | agency Blob + cancelKv | `loadBlobToken()`; prod KV | PASS |
| `api/manage/agent-prompt` | Retell LLM write | `loadRetellApiKey()` | PASS |
| `api/manage/stripe-lookup` | Stripe read | `loadStripeKey()` (`rk_live_`, live) | PASS |
| `api/leads`, `leads/convert`, `leads/calls` | KV lead queue | prod KV | PASS (was test KV) |
| `api/intake/{import,inbox,[id]}` | KV intake queue + clientRecord | prod KV | PASS (was test KV) |
| `api/tickets` | KV ticket store, sends ticket email | prod KV; Resend (note 2) | PASS |
| `api/sms-consent` | portal delegation | `loadPortalOpsConfig()`, prod | PASS |
| `api/c/[slug]/welcome` | email + clientRecord | Resend (note 2); prod KV | PASS (KV), see note 2 |
| `api/c/[slug]/remind` | email + pendingKv | Resend (note 2); prod KV | PASS (KV), see note 2 |
| `api/briefing`, `orphans`, `runbook/pending` | reads across KV, Stripe, Retell, Vercel | loaders; prod KV | PASS |
| `api/go-live/preflight` | read-only checks of explicit agency creds | agency `.env` parsed explicitly | PASS (unchanged by design) |
| `api/go-live/kv-reset` | deletes `jdd:*` keys on AMBIENT KV | no loader; hard-refuses prod host | PASS (guarded) |
| `api/go-live/stripe-go-live`, `stripe-webhook` | Stripe write (live) | `STRIPE_LIVE_SECRET_KEY` else sk_live in `STRIPE_SECRET_KEY`, from jdd-ops/.env | Intentional one-time tools; see Stripe section |
| `api/go-live/env-sync`, `turnstile-provision` | edits jdd-ops/.env / Cloudflare | explicit | Intentional one-time tools |
| `api/build/*`, `api/runbook/{clients,onboard,state}` | local disk / Anthropic / git push | GitHub loader | Not production-data writes |

## Notes and residual items

1. Stale test-KV records are NOT migrated (decision). Re-run attach/repair per affected client against production.
2. `RESEND_API_KEY` lives only in `console/.env.local` and `lib/resend.ts` reads `process.env` directly; its error text still says console/.env.local. I could not tell from the file whether it is the production Resend account's key (the verified JDD domain). Flagged for the user: confirm it is the production-account key; a 403 "domain not verified" means wrong account, not DNS.
3. Several store error messages still say "set KV_REST_API_* in console/.env.local". That advice is now wrong (KV comes from jdd-ops/.env); cosmetic, left as is.
4. kv-reset is now unusable against production by design. The old `.env` documents the test instance only in a commented line.

## Stripe (Phase 3)

Observed in `jdd-ops/.env` (prefixes only): `STRIPE_LIVE_SECRET_KEY` (`sk_live_`), `STRIPE_READONLY_KEY` (`rk_live_`), four live `STRIPE_PRICE_*` ids and a `STRIPE_WEBHOOK_SECRET` (`whsec_`) are present, so the one-time live price/webhook creation has served its purpose. There is no `STRIPE_SECRET_KEY`. The console's read paths work on `rk_live_` alone; `go-live/preflight` check "Console Stripe key is live" passes via `STRIPE_READONLY_KEY` (`rk_live_`) by static evaluation.

Recommended end state (user applies; the console never edits jdd-ops/.env here), either:
- Rename `STRIPE_LIVE_SECRET_KEY` to `STRIPE_SECRET_KEY` (go-live stripePrices/stripeWebhook accept an `sk_live_` value there; `loadStripeKey()` prefers the readonly key and only falls back to it), or
- Delete `STRIPE_LIVE_SECRET_KEY` entirely, since the console only needs `rk_live_` and billing writes go through the portal.

Deleting is the lower-risk option (the console has no auth; a full-access live secret sitting in this process is a larger blast radius than any feature needs). Re-add only if the go-live Stripe tools must be rerun.
