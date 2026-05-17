# jdd-ops

Provisioning orchestrator for Juneau Digital Designs. Local-only — never deployed.

## Layout

```
jdd-ops/
├── .env                # master creds (gitignored)
├── .env.example        # copy to .env and fill in
├── CLAUDE.md           # session context for Claude Code
├── onboard.js          # provisioning orchestrator
├── scripts/
│   └── update-agent-prompt.js   # re-upload Retell prompt after manual tuning
└── clients/
    └── {slug}/         # one folder per client
        ├── site.ts     # intake schema (SiteContent)
        ├── .env.local  # per-client secrets
        ├── agent-prompt.txt
        └── repo/       # cloned client site (gitignored)
```

## First-time setup

1. `cp .env.example .env` and fill in master credentials.
2. `npm install`.
3. Ensure `TEMPLATE_REPO` exists on GitHub and is accessible.

## Onboarding a client

1. Client submits onboarding form on juneau-digital-designs.
2. Make.com delivers the JSON to you.
3. Save it as `clients/{slug}/site.ts` (export `const CONTENT: SiteContent = { ... }`).
4. Run:
   ```
   npm run onboard -- --schema clients/{slug}/site.ts
   ```
5. Walk through the three human checkpoints from JDD_plan.pdf §12:
   - **Checkpoint 1 (~15 min)** — review Vercel preview URL.
   - **Checkpoint 2 (~20 min)** — call the Twilio number; tune `agent-prompt.txt`; run `npm run update-prompt -- <agentId>`.
   - **Checkpoint 3 (~15 min)** — submit contact form with your phone; confirm Airtable row.

## Provisioning steps (onboard.js)

1. Load + validate schema
2. Create per-client GitHub repo from `TEMPLATE_REPO`
3. Clone the new repo into `clients/{slug}/repo/`, write `src/data/site.ts`
4. Generate `.env.local` with placeholders
5. `npm install && npm run build` in the cloned repo
6. Claude generates Retell agent prompt → `clients/{slug}/agent-prompt.txt`
7. Create Retell agent, buy Twilio number, create Airtable base
8. Commit + push the client repo (Vercel auto-deploys preview)
