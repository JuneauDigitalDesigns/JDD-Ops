#!/usr/bin/env node
/**
 * scripts/audit-analytics.js — is Vercel Web Analytics actually collecting, per client?
 *
 * Enabling Web Analytics is a dashboard-only action: the Vercel API exposes the state but
 * offers no setter, and `onboard.js` can only print a reminder. When that reminder is
 * skipped there is no symptom until a client opens the portal's Traffic tab months later
 * and finds it empty, with nothing anywhere naming the cause.
 *
 * This is the check that closes that gap. It reads every portal account record from KV and
 * asks Vercel about each site that has a `vercelProjectId`.
 *
 * Read-only. It never writes to KV or to Vercel.
 *
 * Usage:
 *   npm run audit-analytics
 *   npm run audit-analytics -- --json     # machine-readable, for /ops-check
 *
 * Exit codes:
 *   0  every live site with a project id is collecting
 *   1  at least one live site has analytics off (actionable)
 *   2  the audit could not run, or a live site's state is unknown (not a pass)
 */

import 'dotenv/config';
import { listAccounts, accountStoreConfigured } from '../lib/account-store.js';
import { getProjectAnalytics, sanitizeProjectName } from '../lib/vercel-sync.js';

const json = process.argv.includes('--json');

function out(msg) {
    if (!json) console.log(msg);
}

async function main() {
    if (!accountStoreConfigured()) {
        console.error('audit-analytics: KV is not configured (KV_REST_API_URL / KV_REST_API_TOKEN).');
        process.exit(2);
    }
    if (!process.env.VERCEL_TOKEN) {
        console.error('audit-analytics: VERCEL_TOKEN is not set — cannot check any project.');
        process.exit(2);
    }

    const accounts = await listAccounts();
    const rows = [];

    for (const account of accounts) {
        for (const site of account.sites ?? []) {
            // A site with no project id isn't a failure — it hasn't been provisioned that
            // far yet, and the portal already reports that as "finishing your setup".
            if (!site.vercelProjectId) {
                rows.push({
                    email: account.email,
                    slug: site.slug,
                    status: site.status,
                    project: null,
                    verdict: 'no-project',
                    detail: 'no vercelProjectId on the account record',
                });
                continue;
            }

            // Pass the stored id: the account record is authoritative, and a project renamed
            // after provisioning would make a slug-derived lookup 404.
            const res = await getProjectAnalytics(site.slug, site.vercelProjectId);
            const verdict =
                res.analyticsEnabled === true ? 'on'
                : res.analyticsEnabled === false ? 'off'
                : 'unknown';

            rows.push({
                email: account.email,
                slug: site.slug,
                status: site.status,
                project: sanitizeProjectName(site.slug),
                verdict,
                detail: res.reason ?? null,
            });
        }
    }

    // Only *live* sites can fail. A site still building has no visitors to measure, so
    // flagging it would train the operator to ignore this check.
    const live = rows.filter((r) => r.status === 'live');
    const off = live.filter((r) => r.verdict === 'off');
    const unknown = live.filter((r) => r.verdict === 'unknown');

    if (json) {
        console.log(JSON.stringify({ rows, summary: { off: off.length, unknown: unknown.length, total: rows.length } }, null, 2));
    } else {
        const mark = { on: '✓', off: '✗', unknown: '?', 'no-project': '·' };
        out('');
        out('  Web Analytics — per client site');
        out('  ' + '─'.repeat(70));
        for (const r of rows) {
            const label = `${r.slug} (${r.status})`.padEnd(38);
            out(`  ${mark[r.verdict]} ${label} ${r.verdict}${r.detail ? ` — ${r.detail}` : ''}`);
        }
        out('  ' + '─'.repeat(70));
        if (off.length) {
            out(`\n  ${off.length} live site(s) not collecting. Enable each in the dashboard:`);
            off.forEach((r) => out(`     Vercel → ${r.project} → Analytics → Enable`));
        }
        if (unknown.length) {
            out(`\n  ${unknown.length} live site(s) could not be checked — treat as unverified.`);
        }
        if (!off.length && !unknown.length) {
            out(`\n  All ${live.length} live site(s) collecting.`);
        }
        out('');
    }

    if (off.length) process.exit(1);
    if (unknown.length) process.exit(2);
    process.exit(0);
}

main().catch((e) => {
    console.error('audit-analytics failed:', e);
    process.exit(2);
});
