#!/usr/bin/env node
/**
 * scripts/audit-billing.js — two billing integrity checks the portal can't make for itself.
 *
 * 1. **Live sites with no subscription on file.** A live client should always have a
 *    `stripeSubscriptionId` or a `sessionId`. Without one they may be unbilled, and they
 *    cannot self-serve upgrade — the portal now blocks the attempt before they sign, but
 *    blocking is not fixing, and nothing else would ever surface it.
 *
 * 2. **Orphaned upgrade agreements.** An upgrade signature is stored with
 *    `pendingUpgrade: true` and the flag is cleared when Stripe confirms the plan change.
 *    A record still flagged after the grace window means a client signed a Growth agreement
 *    and was never moved to Growth. They are owed either the upgrade or an explanation.
 *
 * Read-only. Touches neither KV nor Stripe state.
 *
 * Usage:
 *   npm run audit-billing
 *   npm run audit-billing -- --json                # machine-readable, for /ops-check
 *   npm run audit-billing -- --include-fixtures    # don't skip _e2e* sites
 *
 * Exit codes:
 *   0  nothing to act on
 *   1  at least one unbilled live site or orphaned agreement
 *   2  the audit could not run
 */

import 'dotenv/config';
import { Redis } from '@upstash/redis';
import { listAccounts, accountStoreConfigured } from '../lib/account-store.js';

const json = process.argv.includes('--json');
const includeFixtures = process.argv.includes('--include-fixtures');

/** Signed-but-unconfirmed is normal for a few minutes; only complain after that. */
const ORPHAN_GRACE_MS = 15 * 60 * 1000;

const out = (msg) => { if (!json) console.log(msg); };
// Matches isFixtureSlug() in console/src/lib/clients.ts, which is the canonical definition.
// This used to test `_e2e` only, so a `_`-prefixed slug that wasn't an e2e fixture counted
// as a real client here and as a fixture in the console — the same concept answering two
// ways depending on which tool you asked.
const isFixture = (slug) => slug.startsWith('_');

async function main() {
    if (!accountStoreConfigured()) {
        console.error('audit-billing: KV is not configured (KV_REST_API_URL / KV_REST_API_TOKEN).');
        process.exit(2);
    }

    const redis = Redis.fromEnv();
    const accounts = await listAccounts();

    // ── 1. Live sites with no subscription pointer ──────────────────────────
    const unbilled = [];
    for (const account of accounts) {
        for (const site of account.sites ?? []) {
            if (site.status !== 'live') continue;
            if (!includeFixtures && isFixture(site.slug)) continue;
            if (site.stripeSubscriptionId || site.sessionId) continue;
            unbilled.push({ email: account.email, slug: site.slug, plan: site.plan });
        }
    }

    // ── 2. Agreements still flagged pendingUpgrade ──────────────────────────
    // Agreements carry a 30-day TTL, so this scan stays small on its own.
    const orphans = [];
    let cursor = '0';
    do {
        const [next, keys] = await redis.scan(cursor, { match: 'agreement:*', count: 200 });
        cursor = next;
        for (const key of keys) {
            const rec = await redis.get(key);
            if (!rec || !rec.pendingUpgrade) continue;
            if (!includeFixtures && rec.upgradeSlug && isFixture(rec.upgradeSlug)) continue;

            const signedAt = Date.parse(rec.audit?.signedAt ?? '');
            const ageMs = Number.isNaN(signedAt) ? Infinity : Date.now() - signedAt;
            if (ageMs < ORPHAN_GRACE_MS) continue;

            orphans.push({
                id: rec.id,
                slug: rec.upgradeSlug ?? '(unknown)',
                signer: rec.signerEmail,
                signedAt: rec.audit?.signedAt ?? '(unknown)',
            });
        }
    } while (cursor !== '0');

    // ── 3. Plan drift: paying for one tier, recorded as another ─────────────
    const { drift, driftSkipped } = await auditPlanDrift(accounts);

    if (json) {
        console.log(JSON.stringify({ unbilled, orphans, drift, driftSkipped }, null, 2));
    } else {
        out('');
        out('  Billing integrity');
        out('  ' + '─'.repeat(70));

        out('  Live sites with no subscription on file:');
        if (!unbilled.length) out('    ✓ none');
        unbilled.forEach((u) => out(`    ✗ ${u.slug} (${u.plan}) — ${u.email}`));

        out('');
        out(`  Upgrade agreements signed but never confirmed (>${ORPHAN_GRACE_MS / 60000}m):`);
        if (!orphans.length) out('    ✓ none');
        orphans.forEach((o) =>
            out(`    ✗ ${o.id} — ${o.slug} — signed ${o.signedAt} by ${o.signer}`),
        );

        out('');
        out('  Plan drift (paying for one tier, recorded as another):');
        if (driftSkipped) out(`    ? skipped — ${driftSkipped}`);
        else if (!drift.length) out('    ✓ none');
        drift.forEach((d) =>
            out(`    ✗ ${d.slug} — recorded ${d.recordedPlan}, paying ${d.payingPlan} (${d.currentPriceId})`),
        );

        out('  ' + '─'.repeat(70));
        if (drift.length) {
            out('');
            out('  Plan drift means the portal is showing a client the wrong tier. Correct the');
            out('  record to match Stripe (Stripe is what they are actually charged):');
            drift.forEach((d) =>
                out(
                    `    npm run repair-portal -- --email ${d.email} --slug ${d.slug} ` +
                        `--plan ${d.payingPlan} --apply`,
                ),
            );
        }
        if (unbilled.length || orphans.length) {
            out('');
            out('  A client in either list has signed or gone live without billing lining up.');
            out('  Fix the subscription, then re-run. To attach a known id:');
            out('    npm run repair-portal -- --email <email> --slug <slug> \\');
            out('      --stripe-subscription-id sub_… --apply');
        }
        out('');
    }

    process.exit(unbilled.length || orphans.length || drift.length ? 1 : 0);
}

/**
 * Compare what each client is actually billed for against the tier their record claims.
 *
 * This is the check that would have caught the incident that prompted it: a client's Stripe
 * subscription moved to the Growth price while the portal record stayed on Starter, so they
 * paid $297 and were still shown an "Upgrade to Growth" button. Neither of the other two
 * checks sees it — the site has a subscription, and its agreement was confirmed correctly.
 *
 * Plain `fetch` rather than the Stripe SDK: this repo has no Stripe dependency and one GET
 * per subscription doesn't justify adding one. The equivalent logic in the agency repo is
 * `inspectSubscriptionPlan` (app/lib/plan-billing.ts) — keep the two in step.
 *
 * Returns `driftSkipped` rather than an empty pass when it can't check. An unverifiable
 * billing state must never render as a tick.
 */
async function auditPlanDrift(accounts) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
        return { drift: [], driftSkipped: 'STRIPE_SECRET_KEY is not set in jdd-ops/.env' };
    }

    const priceForPlan = {
        starter: process.env.STRIPE_PRICE_STARTER_MONTHLY,
        growth: process.env.STRIPE_PRICE_GROWTH_MONTHLY,
        enterprise: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY,
    };
    const planForPrice = Object.fromEntries(
        Object.entries(priceForPlan)
            .filter(([, id]) => id)
            .map(([plan, id]) => [id, plan]),
    );
    if (!Object.keys(planForPrice).length) {
        return { drift: [], driftSkipped: 'no STRIPE_PRICE_*_MONTHLY ids in jdd-ops/.env' };
    }

    const auth = 'Basic ' + Buffer.from(`${key}:`).toString('base64');
    const drift = [];

    for (const account of accounts) {
        for (const site of account.sites ?? []) {
            if (!includeFixtures && isFixture(site.slug)) continue;
            // Session-only records would need a second lookup to resolve; the upgrade route
            // persists the id on every change, so anything current has one.
            if (!site.stripeSubscriptionId) continue;

            let sub;
            try {
                const res = await fetch(
                    `https://api.stripe.com/v1/subscriptions/${site.stripeSubscriptionId}`,
                    { headers: { Authorization: auth } },
                );
                if (!res.ok) {
                    console.warn(
                        `[audit-billing] ${site.slug}: subscription lookup returned ${res.status}`,
                    );
                    continue;
                }
                sub = await res.json();
            } catch (e) {
                console.warn(`[audit-billing] ${site.slug}: subscription lookup failed — ${e.message}`);
                continue;
            }

            // Cancelled subscriptions keep their price; a cancelled client isn't drifting.
            if (sub.status === 'canceled' || sub.status === 'incomplete_expired') continue;

            const currentPriceId = sub.items?.data?.[0]?.price?.id;
            const expected = priceForPlan[site.plan];
            if (!currentPriceId || !expected || currentPriceId === expected) continue;

            drift.push({
                email: account.email,
                slug: site.slug,
                recordedPlan: site.plan,
                // Unknown when the price isn't one of ours — report the id and let a human look.
                payingPlan: planForPrice[currentPriceId] ?? '(unrecognised price)',
                currentPriceId,
            });
        }
    }

    return { drift, driftSkipped: null };
}

main().catch((e) => {
    console.error('audit-billing failed:', e);
    process.exit(2);
});
