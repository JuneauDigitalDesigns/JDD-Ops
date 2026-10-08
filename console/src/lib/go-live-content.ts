// The production go-live walk, as data. One source of truth for the /go-live wizard, in the
// same block DSL the per-client runbook uses (runbook-content.ts) — plus the `run` block,
// which fires the guarded /api/go-live/* actions.
//
// Account-wide, not per-client, so this is a plain builder with no ClientContext. Ordering is
// deliberate: lead-time items first (Clerk prod + DNS is the critical path), the destructive/
// automated steps in the middle behind dry-run guards, the green preflight gate near the end,
// and the Vercel Pro compliance upgrade last because it blocks nothing you can sell without.

import type { Phase } from './runbook-content';

const DOMAIN = 'juneaudigitaldesigns.com';
const SITE_URL = `https://${DOMAIN}`;

export function buildGoLive(): Phase[] {
  return [
    {
      id: 'lead-time',
      title: 'Lead-time first',
      subtitle: 'The things with clocks outside your control — start these before anything else.',
      steps: [
        {
          id: 'clerk-prod',
          title: 'Create the Clerk production instance + DNS',
          why: 'Your portal auth is on the Clerk Development instance today. Production is a separate instance with its own keys and its own domain, and its DNS records take time to propagate — this is the one step that can outrun a same-day launch, so it goes first.',
          est: '~20 min + DNS wait',
          blocks: [
            { t: 'link', label: 'Clerk dashboard', href: 'https://dashboard.clerk.com' },
            {
              t: 'substeps',
              items: [
                { text: 'Create a Production instance for the app, cloning the Development instance.', detail: 'Match the same sign-in methods your dev instance has enabled.' },
                { text: `Set the application domain to ${DOMAIN}.` },
                { text: 'Clerk shows a set of DNS records — add each one at your DNS (Vercel → Domains), then click Verify.' },
                { text: 'Once verified, copy the production API keys and set them in the agency env.' },
                { text: 'Recreate the user.created webhook against the production instance and copy its signing secret.' },
              ],
            },
            {
              t: 'fields',
              caption: 'The CNAMEs Clerk asks for (exact targets come from the Clerk dashboard — copy them there):',
              rows: [
                { label: 'clerk', value: 'CNAME → (from Clerk)', pending: true },
                { label: 'accounts', value: 'CNAME → (from Clerk)', pending: true },
                { label: 'clkmail', value: 'CNAME → (from Clerk)', pending: true },
                { label: 'clk._domainkey', value: 'CNAME → (from Clerk)', pending: true },
                { label: 'clk2._domainkey', value: 'CNAME → (from Clerk)', pending: true },
              ],
            },
            {
              t: 'env',
              file: 'agency env (Vercel + .env.local)',
              vars: [
                { key: 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', value: 'pk_live_…', pending: true },
                { key: 'CLERK_SECRET_KEY', value: 'sk_live_…', pending: true },
                { key: 'CLERK_WEBHOOK_SIGNING_SECRET', value: 'whsec_…', pending: true },
              ],
            },
            {
              t: 'callout',
              tone: 'warn',
              title: 'DNS is the long pole',
              body: 'Propagation can take from minutes to a day. Add the records early and move on to the other steps while they verify.',
            },
          ],
        },
        {
          id: 'retell-verify',
          title: 'Verify the Retell plan',
          why: "This is the one service I can't check from code. Confirm you're on a paid plan with enough concurrency for real call volume, that billing is on file, and that the master agent/LLM config is the one you want answering live calls.",
          est: '~5 min',
          blocks: [
            { t: 'link', label: 'Retell dashboard', href: 'https://dashboard.retellai.com' },
            {
              t: 'verify',
              title: 'Confirm before launch',
              items: [
                { text: 'Billing/payment method on file (not a trial).' },
                { text: 'Concurrency limit is enough for your expected simultaneous calls.' },
                { text: 'The master LLM/agent prompt is production-final.' },
              ],
            },
          ],
        },
        {
          id: 'stripe-tax',
          title: 'Finish Stripe Tax setup',
          why: 'Your account is activated and the bank is attached; the remaining "set up tax collection" subsections just need finishing so live invoices calculate tax. The "create a live customer/invoice" prompt is satisfied automatically by your first real checkout — no Payment Link needed.',
          est: '~5 min',
          blocks: [
            { t: 'link', label: 'Stripe Tax settings', href: 'https://dashboard.stripe.com/settings/tax' },
          ],
        },
      ],
    },

    {
      id: 'provision',
      title: 'Provision production services',
      steps: [
        {
          id: 'upstash-prod',
          title: 'Swap the test Upstash for a fresh production one',
          why: 'The repo is wired to the TEST Upstash today (the Vercel integration injected these same env var names). Disconnect it, then connect a clean production database so no test artifacts (dead test subscription IDs, fixture accounts) leak into live. The app reads the UPSTASH_ pair via Redis.fromEnv(); the KV_ pair is the Vercel-KV compatibility naming a startup guard still checks.',
          est: '~5 min',
          blocks: [
            {
              t: 'callout',
              tone: 'warn',
              title: 'Clear the test data BEFORE you repoint',
              body: 'The "Clear test data from the old instance" step (below, in Cut over) wipes whatever KV the console currently resolves to. Right now that is the test instance — so if you want it cleared, run that step, or skip it, before you disconnect and `vercel env pull`. Once you pull production creds locally, that step would target the empty production database instead.',
            },
            {
              t: 'callout',
              tone: 'info',
              title: 'Disconnect the test store first',
              body: 'Two stores cannot inject the same env var names into one project, so the test store has to come off before the production one goes on. Disconnecting also removes its stale KV_REST_API_* / UPSTASH_REDIS_REST_* values from the project.',
            },
            {
              t: 'substeps',
              items: [
                { text: 'Vercel → the agency project → Storage tab → the connected test Upstash store → Disconnect from project.', detail: 'Equivalently, Storage (team) → the store → Connected Projects → remove the agency project. This is a disconnect, not a delete — the test database stays in Upstash.' },
                { text: 'Confirm the four KV_REST_API_* / UPSTASH_REDIS_REST_* vars are gone from Project → Settings → Environment Variables.' },
                { text: 'Then Storage → Upstash (Redis) → Create a new database — Vercel provisions it and re-injects all four env vars onto the project automatically. No tokens to copy by hand.' },
                { text: 'Run `vercel env pull` in the agency repo to mirror the production creds into .env.local for local dev.' },
              ],
            },
            { t: 'link', label: 'Vercel Storage', href: 'https://vercel.com/dashboard/stores' },
            {
              t: 'env',
              file: 'agency env — injected by the new Vercel integration (`vercel env pull` for .env.local)',
              vars: [
                { key: 'KV_REST_API_URL', value: 'https://…upstash.io', pending: true },
                { key: 'KV_REST_API_TOKEN', value: '…', pending: true },
                { key: 'UPSTASH_REDIS_REST_URL', value: 'https://…upstash.io (same database)', pending: true },
                { key: 'UPSTASH_REDIS_REST_TOKEN', value: '… (same database)', pending: true },
              ],
            },
          ],
        },
        {
          id: 'turnstile-prod',
          title: 'Create production Turnstile keys',
          why: 'The forms are gated by Cloudflare Turnstile. Dev likely uses the always-pass test keys; production needs a real widget bound to your domain, or the anti-bot check is meaningless.',
          est: '~3 min',
          blocks: [
            {
              t: 'callout',
              tone: 'info',
              title: 'Automated',
              body: 'Add CLOUDFLARE_API_TOKEN (Account › Turnstile › Edit) + CLOUDFLARE_ACCOUNT_ID to jdd-ops/.env, then run below — it creates a managed widget bound to juneaudigitaldesigns.com and returns both keys. Cloudflare shows the secret only at creation, so capture it from the run before leaving. Dry run works without the keys. Or do it by hand in the dashboard.',
            },
            { t: 'run', action: 'turnstile-provision', label: 'Create Turnstile widget', destructive: true },
            { t: 'link', label: 'Cloudflare Turnstile', href: 'https://dash.cloudflare.com/?to=/:account/turnstile' },
            {
              t: 'env',
              file: 'agency env (Vercel + .env.local)',
              vars: [
                { key: 'NEXT_PUBLIC_TURNSTILE_SITE_KEY', value: '0x… (from the run above)', pending: true },
                { key: 'TURNSTILE_SECRET_KEY', value: '0x… (from the run above — shown once)', pending: true },
              ],
            },
          ],
        },
        {
          id: 'stripe-prices',
          title: 'Create the live Stripe prices',
          why: 'Test price IDs do not work in live mode. This clones your test products/prices into live exactly (Starter keeps its one-time onboarding fee), and returns the four live price IDs to paste into the env. Idempotent — a re-run reports the existing IDs rather than duplicating.',
          est: '~2 min',
          blocks: [
            {
              t: 'callout',
              tone: 'info',
              title: 'One-time key',
              body: 'For the real run, add STRIPE_LIVE_SECRET_KEY (your live secret key) to jdd-ops/.env alongside the existing test key. Dry run works without it. Remove it after.',
            },
            { t: 'run', action: 'stripe-go-live', label: 'Create live prices', destructive: true },
            {
              t: 'env',
              file: 'agency env (Vercel + .env.local)',
              vars: [
                { key: 'STRIPE_PRICE_STARTER_MONTHLY', value: 'price_… (from the run above)', pending: true },
                { key: 'STRIPE_PRICE_STARTER_ONBOARDING', value: 'price_…', pending: true },
                { key: 'STRIPE_PRICE_GROWTH_MONTHLY', value: 'price_…', pending: true },
                { key: 'STRIPE_PRICE_ENTERPRISE_MONTHLY', value: 'price_…', pending: true },
              ],
            },
          ],
        },
        {
          id: 'stripe-webhook',
          title: 'Wire the live Stripe keys + webhook',
          why: 'Set the live secret and publishable keys, and create a live webhook endpoint so subscription events reach the app (account creation, featured unpublish on cancel). Also mint a restricted read-only live key for the console, which never needs write access.',
          est: '~8 min',
          blocks: [
            { t: 'link', label: 'Stripe webhooks', href: 'https://dashboard.stripe.com/webhooks' },
            {
              t: 'copy',
              label: 'Endpoint URL',
              value: `${SITE_URL}/api/webhooks/stripe`,
            },
            {
              t: 'callout',
              tone: 'info',
              title: 'The endpoint is automated',
              body: 'Reusing the STRIPE_LIVE_SECRET_KEY you added for the live prices, the run below creates the webhook endpoint with exactly the events the handler branches on (checkout.session.completed, customer.subscription.updated/deleted) and returns STRIPE_WEBHOOK_SECRET. The live secret + publishable keys below still come from the dashboard by hand — there is no API to mint a full-access live key.',
            },
            { t: 'run', action: 'stripe-webhook', label: 'Create live webhook endpoint', destructive: true },
            {
              t: 'env',
              file: 'agency env (Vercel + .env.local)',
              vars: [
                { key: 'STRIPE_SECRET_KEY', value: 'sk_live_… (dashboard → API keys)', pending: true },
                { key: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', value: 'pk_live_… (dashboard → API keys)', pending: true },
                { key: 'STRIPE_WEBHOOK_SECRET', value: 'whsec_… (from the run above)', pending: true },
              ],
            },
            {
              t: 'env',
              file: 'jdd-ops/.env (console + scripts)',
              vars: [
                { key: 'STRIPE_READONLY_KEY', value: 'rk_live_… (Restricted key, read-only)', pending: true, note: 'least privilege — the console never writes to Stripe' },
              ],
            },
          ],
        },
      ],
    },

    {
      id: 'cutover',
      title: 'Cut over',
      steps: [
        {
          id: 'env-cutover',
          title: 'Set the remaining prod env + sync to ops',
          why: 'Vercel is the source of truth. Set the last production values on the agency project by hand, then pull the shared subset (the four Stripe price IDs and OPS_SHARED_SECRET) down into jdd-ops/.env so audit-billing and the console never drift from the app.',
          est: '~10 min',
          blocks: [
            {
              t: 'callout',
              tone: 'info',
              title: 'Set these by hand',
              body: 'Enter these in the Vercel dashboard under the agency project, Production scope. The values below show the format to expect, not literal values: paste your real secret. Nothing on this step writes to Vercel.',
            },
            {
              t: 'env',
              file: 'agency env (Vercel, Production scope)',
              vars: [
                { key: 'NEXT_PUBLIC_SITE_URL', value: SITE_URL },
                { key: 'OPS_SHARED_SECRET', value: '(a long random value, same in jdd-ops/.env)', pending: true },
              ],
            },
            {
              t: 'callout',
              tone: 'info',
              title: 'Not TWILIO_MESSAGING_SERVICE_SID',
              body: 'The agency project does not need TWILIO_MESSAGING_SERVICE_SID unless you turn on double opt-in checkout SMS (SMS_DOUBLE_OPTIN=true). It otherwise lives only in jdd-ops/.env as a master Twilio credential and is not synced from the app.',
            },
            {
              t: 'callout',
              tone: 'info',
              title: 'Then sync',
              body: 'Run env-sync to copy the shared subset (Stripe price IDs and OPS_SHARED_SECRET) into jdd-ops/.env. It previews a masked diff first, writes only jdd-ops/.env, never Vercel, and never touches master credentials or the Stripe secret key.',
            },
            { t: 'run', action: 'env-sync', label: 'Sync to jdd-ops/.env', destructive: true },
          ],
        },
        {
          id: 'github-vercel',
          title: 'Verify the GitHub↔Vercel integration',
          why: 'New client repos are auto-detected and deployed via the org-level GitHub↔Vercel integration. Confirm it is authorized so a new client project builds on push, and that client repos are created private.',
          est: '~5 min',
          blocks: [
            { t: 'link', label: 'Vercel Git integration', href: 'https://vercel.com/account/integrations' },
            {
              t: 'verify',
              items: [
                { text: 'The GitHub app is installed on the JDD org and can access new repos.' },
                { text: 'A test client repo (or a re-check of an existing one) shows a linked Vercel project.' },
                { text: 'Client repos default to private.' },
              ],
            },
          ],
        },
        {
          id: 'kv-reset',
          title: 'Clear test data from the old instance',
          why: 'The fresh production instance is empty, so this is about the old/test instance — clearing its jdd:* keys so nothing test lingers. Previews the exact keys and the host it targets before deleting anything.',
          est: '~2 min',
          blocks: [
            {
              t: 'callout',
              tone: 'danger',
              title: 'Reads the KV this console points at',
              body: 'The dry run names the target host. Make sure it is the test instance you mean to clear, not production, before you confirm.',
            },
            { t: 'run', action: 'kv-reset', label: 'Delete jdd:* keys', destructive: true },
          ],
        },
      ],
    },

    {
      id: 'verify-comply',
      title: 'Verify & comply',
      steps: [
        {
          id: 'preflight',
          title: 'Preflight gate',
          why: 'The green gate. This reads both env surfaces on this machine and checks every service is configured for production — live Stripe/Clerk keys, a real site URL, non-test Turnstile, KV reachable, the A2P service, and cross-surface parity. Everything should be green before you take real customers.',
          est: '~1 min',
          blocks: [
            { t: 'run', action: 'preflight', label: 'Run preflight' },
            {
              t: 'callout',
              tone: 'info',
              body: 'It reads the local env files (the agency .env.local and jdd-ops/.env). After env-sync those mirror the Vercel source; if you set a value only in the Vercel dashboard, pull it locally (vercel env pull) before trusting a green result.',
            },
            {
              t: 'callout',
              tone: 'info',
              title: 'Also hand-check the conversion non-negotiables',
              body: 'Preflight checks services, not conversion. Before launching a built client site, walk the six items in console/design/CONVERSION-NON-NEGOTIABLES.md against the site at a 390px viewport and 1440px (tap-to-call, sticky call bar, named service area, review aggregate above the fold, license shown, form of six fields or fewer). Decision 32 keeps this a manual walk on purpose, so no green check here can stand in for it.',
            },
          ],
        },
        {
          id: 'vercel-pro',
          title: 'Upgrade Vercel to Pro',
          why: "Last, because it blocks nothing you can sell — it's compliance (commercial use requires Pro) and it makes the every-3-days metering cron run on schedule instead of once a day. Do it once preflight is green.",
          est: '~2 min',
          blocks: [
            { t: 'link', label: 'Vercel plans', href: 'https://vercel.com/account/plans' },
            {
              t: 'verify',
              items: [
                { text: 'The team (all projects) is on Pro.' },
                { text: 'The retell-usage cron shows its true */3-day schedule.' },
              ],
            },
          ],
        },
      ],
    },
  ];
}
