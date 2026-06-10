# jdd-ops

Provisioning orchestrator for Juneau Digital Designs. Local-only — never deployed.

## Layout

```
jdd-ops/
├── .env                # master creds (gitignored)
├── .env.example        # copy to .env and fill in
├── CLAUDE.md           # session context for Claude Code
├── RUNBOOK.md          # full operator runbook (read this for the end-to-end flow)
├── onboard.js          # provisioning orchestrator
├── template/           # blank-slate client site, copied per client (no GitHub template repo)
├── studio/             # drag-and-drop site builder (preview app) + component catalog
├── scripts/            # new-client, hydrate, update-agent-prompt, sync-vercel-env, teardown
└── clients/
    └── {slug}/         # one folder per client
        ├── site.ts     # intake schema (INTAKE / legacy CONTENT)
        ├── .env.local  # per-client secrets
        ├── agent-prompt.txt
        └── repo/       # local client site (gitignored)
```

## First-time setup

1. `cp .env.example .env` and fill in master credentials.
2. `npm install`.
3. Build the Make scenarios + portal master setup — see `RUNBOOK.md` Part A.

## Onboarding a client (summary — see RUNBOOK.md for the full flow)

1. **Build** the site in the studio (`npm run preview` → drag-drop → Export to
   `clients/{slug}/repo`), or scaffold manually with `npm run new-client -- --slug {slug}`.
2. **Provision**: `npm run onboard -- --schema clients/{slug}/site.ts`.
3. Walk the three human checkpoints:
   - **Checkpoint 1** — review the Vercel preview URL.
   - **Checkpoint 2** — call the Retell-provisioned number; tune `agent-prompt.txt`; `npm run update-prompt -- <agentId>`.
   - **Checkpoint 3** — clone the outbound Make scenario, submit the contact form with your phone, confirm the Airtable row.
4. **Portal**: create the client's GA4 property + Clerk user — see RUNBOOK.md Part E.

## Provisioning steps (onboard.js)

1. Load + validate the intake
2. Create an **empty** per-client GitHub repo; point local `clients/{slug}/repo` origin at it
3. Write `src/data/site.ts` into the local repo
4. Write `clients/{slug}/.env.local` (idempotent)
5. `npm install && npm run build` in the local repo
6. Claude generates the Retell agent prompt → `clients/{slug}/agent-prompt.txt`
7. Create the Retell agent
8. Provision a **Retell-managed** number, create the Airtable base, register the agent in the Make Data Store
9. Commit + push the client repo (Vercel auto-deploys); sync env to Vercel
