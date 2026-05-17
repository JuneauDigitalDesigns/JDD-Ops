# JDD — End-to-end testing playbook

Three layers, cheapest first.

## Layer A — Dry-run validation (no API calls)

Fastest sanity check. Confirms plan-tier branching, slug derivation, file
paths, and env-var plumbing without spending Twilio inventory or Retell quota.

```
cd jdd-ops
node onboard.js --schema clients/_e2e-starter/site.ts    --dry-run
node onboard.js --schema clients/_e2e-growth/site.ts     --dry-run
node onboard.js --schema clients/_e2e-enterprise/site.ts --dry-run
```

Expected:

| Fixture | Expected output |
|---|---|
| `_e2e-starter` | Steps 2-5 + 9 only; logs "Skipping voice provisioning (plan=starter)"; writes `LEAD_DELIVERY_MODE=email`. |
| `_e2e-growth` | All 9 steps; 1 Airtable base; webhook mode. |
| `_e2e-enterprise` | Loops twice (`site 1/2`, `site 2/2`); creates Airtable base on iteration 1, reuses on iteration 2 with `AIRTABLE_SITE_TAG`. |

Exit code must be 0 for all three.

## Layer B — Mock-API integration tests via webhook.site

Validates the JSON wire format end-to-end without hitting Retell / Twilio /
Airtable. Run before every release.

### B-1: Onboarding form → Make webhook payload

1. Create a free webhook.site URL.
2. In `C:\Users\Xander\Desktop\juneau-digital-designs\.env.local`, set
   `MAKE_WEBHOOK_URL=<your webhook.site URL>`.
3. `cd C:\Users\Xander\Desktop\juneau-digital-designs && npm run dev`.
4. Visit `http://localhost:3000/pricing` and click each tier in turn; for each,
   fill out `/onboarding` end-to-end and submit.
5. Confirm at webhook.site:
   - 3 separate POSTs received.
   - Each body is `{ plan, siteCount, sites: SiteContent[] }`.
   - `plan` reflects the selected tier exactly (`"starter"` / `"growth"` /
     `"enterprise"` — not the old `"premium"` downgrade bug).
   - For Enterprise, `sites.length` matches `1 + (number of "+ Add another
     site" entries you added)`, and each entry has a unique `brand.short`.

### B-2: Deployed client site → /api/contact → webhook.site

After a client is provisioned, validate the lead-capture path.

1. In the Vercel project for the test client, set `MAKE_WEBHOOK_URL` to a
   webhook.site URL (override the real Make scenario temporarily).
2. Trigger a redeploy.
3. On the live site, submit the inline hero LeadForm, the final-CTA LeadForm,
   and the floating callback modal — all with name + phone.
4. webhook.site should receive 3 payloads:
   - Two with `type: "form"` and the right `brand.short`.
   - One with `type: "callback"`.
5. Honeypot test: in DevTools, fill the hidden `website` input and submit.
   The API returns 200 but webhook.site receives nothing.

### B-3: Starter email mode

Validates that Starter sites deliver leads via Resend, not via Make.

1. Provision a Starter client (or temporarily set `LEAD_DELIVERY_MODE=email`
   on a Growth deployment with `LEAD_TO_EMAIL=` + `RESEND_API_KEY=`).
2. Submit the lead form.
3. Confirm an email arrives at `LEAD_TO_EMAIL` containing the lead's name,
   phone, and `type`.

## Layer C — Live end-to-end with disposable resources

The full real-world test. Burns small amounts of Twilio/Retell quota; cleaned
up by `npm run teardown`.

### C-1: Live Starter provisioning

```
cd C:\Users\Xander\Desktop\jdd-ops
node onboard.js --schema clients/_e2e-starter/site.ts
```

Expected handoff: 1 GitHub repo created, 1 Vercel project, **no** Retell/Twilio/
Airtable. Submit a lead on the live site; confirm Resend email arrives at the
fixture's `brand.email`. Run `npm run teardown -- --slug _e2e-starter`.

### C-2: Live Growth provisioning

```
node onboard.js --schema clients/_e2e-growth/site.ts
```

Expected handoff: 1 repo, 1 Vercel project, 1 Retell agent, 1 Twilio number,
1 Airtable base.

Manual validation:
- [ ] Handoff prints the Twilio number purchased.
- [ ] Vercel preview URL renders correctly (palette, hero, services).
- [ ] Call the Twilio number from your phone — Retell agent answers with the
      brand's greeting, qualifies you, hangs up. Transcript appears in Airtable
      within 60 seconds.
- [ ] Paste a real Make scenario webhook URL into
      `clients/_e2e-growth/.env.local`, then `npm run sync-env -- --slug _e2e-growth`.
- [ ] Trigger a redeploy on Vercel; submit the live `/` lead form with your
      personal phone number. Retell calls your phone within 60 seconds with
      the brand's greeting.

Teardown: `npm run teardown -- --slug _e2e-growth`.

### C-3: Live Enterprise provisioning (2 sites)

```
node onboard.js --schema clients/_e2e-enterprise/site.ts
```

Expected handoff: 2 repos (`_e2e-enterprise-1`, `_e2e-enterprise-2`), 2 Vercel
projects, 2 Retell agents, 2 Twilio numbers, **1 shared Airtable base** with a
`Site` singleSelect column.

Manual validation:
- [ ] Both Vercel previews render with the shared palette.
- [ ] Each Twilio number, when called, answers with the matching site's brand
      name (Anchorage vs. Juneau).
- [ ] Submitting the lead form on each deployed site triggers a Retell call
      from the correct number with the correct greeting.
- [ ] Airtable shows rows from both sites in the same base, distinguished by
      the `Site` field.

Teardown: `npm run teardown -- --slug _e2e-enterprise` (removes both repos,
both Vercel projects, both Retell agents, both Twilio numbers, the shared
Airtable base, and the local folder).

## Manual checklist for every live E2E pass

- [ ] Schema validation rejects missing required fields with a clear error.
- [ ] `/api/onboarding` rejects requests without a valid Turnstile token.
- [ ] Honeypot drops with 200 silently.
- [ ] Enterprise: distinct Twilio numbers per site, distinct repos, **shared**
      Airtable base with the right `Site` column choices.
- [ ] Starter sites: `LEAD_DELIVERY_MODE=email` is set on Vercel; no Retell /
      Twilio / Airtable resources exist for the slug.
- [ ] `sync-env` is idempotent (re-running doesn't error and doesn't duplicate
      env-var rows in Vercel).
- [ ] `teardown` leaves zero orphaned resources (re-running is a no-op).

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Step 2 fails: `Bad credentials` | `GITHUB_TOKEN` missing `repo` scope | Regenerate PAT with `repo` + `delete_repo` |
| Step 8 fails: `No numbers available in area code XXX` | Twilio doesn't have inventory there | Pick a different area code in the fixture's `brand.phone`, or fall back to toll-free |
| Step 9 fails: project lookup 404 | GitHub-Vercel integration not authorized at the org level | One-time: install Vercel's GitHub app on `GITHUB_ORG` |
| Lead form 500s in production | `MAKE_WEBHOOK_URL` (or `RESEND_API_KEY` for Starter) missing on Vercel | Run `npm run sync-env -- --slug {slug}` |
| Enterprise: only first site provisions | `intake.sites.length < 2` | Verify `additionalSites` in the form payload populated correctly |
