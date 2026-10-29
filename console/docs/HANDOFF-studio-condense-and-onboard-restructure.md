# Handoff — Build-studio condense + Onboard restructure

**Repo:** `C:\Users\Xander\Desktop\ops\jdd-ops` (console lives at `console/` inside this same repo
— it is not a separate git repo; `git status`/`git diff` from the jdd-ops root shows `console/...`
paths).
**Branch:** `feat/onboard-wizard-redesign` (work was done in place on this branch — no new branch
created, nothing committed).
**Full spec this session executed:** `console/docs/PLAN-studio-condense-and-onboard-restructure.md`
— read that file for exact rationale/anchors on every edit. This handoff is the status + what's
left, not a re-explanation of the design.

## What this work is

Two independent workstreams, both requested by the user in the same conversation:

- **Workstream A** — condense the vertical chrome on the Build **Studio** step
  (`/c/{slug}/build`) so the live preview gets more height. Merged the step-pill strip into the
  PageStudio toolbar, turned the "Templates" band into a popover, tightened preview padding.
  Intake step and the top `ConsoleNav` were explicitly **out of scope** and untouched.
- **Workstream B** — restructure the onboard runbook (`/c/{slug}/onboard`) into two macro-phases,
  **Onboarding** (all manual work) then **Review** (all checkpoints + reference), per the user's
  explicit instruction. Removed two steps that are no longer real ("Enable SMS" — now automatic;
  "Invite the client" — portal signup now happens during onboarding itself) and added a new
  manual step for mapping the cloned Make.com post-call scenario's fields, using exact
  copy-paste values the user supplied (Airtable field expressions + Twilio SMS body).
- **Workstream C** — small surgical sync of `RUNBOOK.md` (the markdown source of truth) for the
  two step changes above. **Not** a full reconciliation — see "Known pre-existing issue" below.

## Current state — DONE but build not yet verified

### Code changes applied (all per the spec file, verbatim)
| File | Status |
|---|---|
| `console/src/app/c/[slug]/build/BuildWizard.tsx` | Edited. Step pills extracted into a `stepNav` node; `NavSlot` now only renders on the Intake step; `stepNav` passed as a prop to `PageStudio`. |
| `console/src/app/c/[slug]/build/PageStudio.tsx` | Edited. Accepts `stepNav` prop, renders it in its toolbar. Templates band removed; replaced with a "Templates" toolbar button + a `createPortal`-based popover (transient, no persisted state, closed on outside-click). Preview card padding `p-5` → `p-2`. |
| `console/src/lib/runbook-content.ts` | Edited. Removed `vercelVoiceUrl` import (dead after removing the SMS step). Added `group?: 'onboarding' \| 'review'` to the `Phase` interface (optional — `go-live-content.ts` borrows this type without a group and must keep compiling). Replaced `provisionPhase`/`voicePhase`/`callbackStepsForSite`/`callbackPhase`/`portalPhase`/`buildRunbook` with: `provisionPhase`, `callLoggingSetupPhase` (new manual Make-mapping step), `analyticsPhase`, `siteReviewPhase`, `voiceReviewPhase`, `callLoggingReviewPhase`, and a reordered `buildRunbook` that emits all `onboarding` phases then all `review` phases. |
| `console/src/components/onboard/PhaseBreadcrumbs.tsx` | Edited. Breadcrumb now prints a muted macro-group label ("Onboarding" / "Review") before the first crumb of each group, with a hairline divider between groups. Per-phase reachability/complete logic unchanged. |
| `RUNBOOK.md` (jdd-ops root) | Edited. Part E's "Invite the client" step rewritten to describe portal signup as part of onboarding (no invite action). Added a new "C-checkpoint" section after Part C with the per-client Make field-mapping procedure (same values as the console step). |

### Tests — both green
```
cd jdd-ops && npm test          # 122/122 pass
cd console && npm test          # 387/387 pass (includes phase-contract.test.mjs, unaffected —
                                 # it only parses onboard.js stdout via run-plan.ts, which this
                                 # work never touched)
```

### Build — NOT YET RUN successfully
`npm run build` inside `console/` was attempted twice and hung both times (~16+ min) because the
console's own dev server (`npm run console`, port 3040) was running and holding `.next` locked
(`EPERM: operation not permitted, scandir '.next\trace\clients'`). This is an environment issue,
**not evidence of a code problem** — the test suites above already prove the TypeScript/logic is
sound; `next build` is the remaining gate (type-checking across the whole app + production
bundling).

**Resolved just before this handoff:** the user authorized stopping the dev server; I stopped it
(PIDs `31340` `next dev -p 3040` and `34848` `start-server.js`) via `Stop-Process`, confirmed both
gone, and confirmed no console-related node processes remain running. **The user said they would
run `npm run build` themselves next** — so the next session should ask the user for that build's
result rather than assume it passed, and should NOT re-run `npm run console` (the dev server) in
a way that would re-lock `.next` while a build might still be in flight.

### Manual UI acceptance checks — NOT YET DONE
The spec's acceptance checklists (A3 and B5 in the plan doc) have not been walked yet:
- Studio: confirm the step-pill strip above the toolbar is gone, pills now sit in the PageStudio
  toolbar, Templates is a popover (not a band), preview sits ~150px higher, Intake step unchanged.
- Onboard: confirm the breadcrumb shows `Onboarding | Review` macro grouping, the Make field-map
  step shows the 10-row Airtable table + Twilio JSON body block, no SMS/invite steps appear,
  `call-routing` is last (Reference-badged) under "Test-call the agent", and a web-only client
  only shows `Provision the stack › Enable analytics | Review the site`.

## Decisions made autonomously this session (auto-mode active, user said proceed on both workstreams)

The original plan doc flagged three open items. They were resolved as follows rather than asked
again (auto-mode: make the reasonable call, user can redirect):

1. **Twilio From/To wording** — resolved using the master scenario's documented design (CLAUDE.md
   / `a-make-post-build`): **From = client's `TWILIO_NUMBER`, To = the owner's consented alert
   number.** Both the console step and the RUNBOOK.md step say this explicitly now.
2. **Automation-vs-manual contradiction** — **left unresolved on purpose, and still worth
   revisiting.** CLAUDE.md and `jdd-ops/lib` (`cloneAndWirePostCall` / `patchPostCallBlueprint`,
   guarded by `npm run verify-post-call`) claim onboard.js **automatically** remaps the clone's
   Airtable columns and Twilio From/To. The user's actual operating description was that they do
   this by hand per client. This work followed the user (added a manual step, did **not** touch
   `jdd-ops/lib/` or `onboard.js` — explicitly out of scope per the spec's guardrails). **A real
   open question for a future session:** is the `lib/` automation broken/partial (should be
   fixed), or is it the docs/tests that are stale (should be corrected to describe reality)? Either
   way, right now the console UI says "do this by hand" while the code claims to do it for you —
   that mismatch should eventually be closed.
3. **Branch + RUNBOOK scope** — stayed on `feat/onboard-wizard-redesign` (confirmed by user).
   RUNBOOK.md got the two surgical edits only, **not** a full reconciliation. RUNBOOK.md's Part
   A4/Part D/Part F sections still describe the **superseded shared-Data-Store post-call design**
   and the deprecated Make outbound-callback clone — they already contradicted CLAUDE.md and
   `runbook-content.ts` independent of this session's work. That's flagged in the new
   "C-checkpoint" section's header callout but not fixed. Worth a dedicated pass if the user wants
   RUNBOOK.md fully trustworthy again.

## Known pre-existing issue found during handoff prep (not caused by this session)

`console/src/components/onboard/PhaseBreadcrumbs.tsx` is **untracked by git** (`git status` shows
`??`, and `git show HEAD:...` confirms it doesn't exist in any prior commit on this branch) —
despite being a real, substantial, already-imported file that long predates this session (it was
read and referenced throughout the original planning). This means:
- It was never `git add`ed on this branch at any point before now.
- When this branch's changes eventually get committed, **this file must be explicitly staged**
  (`git add console/src/components/onboard/PhaseBreadcrumbs.tsx`) or a plain `git add -A`-style
  commit will silently include it as a "new file" rather than a tracked modification — which is
  fine functionally, but worth knowing so nobody is surprised by a "new file" in the diff that is
  actually a pre-existing, heavily-used component.
- This is **not something this session broke** — the file existed and worked before any edits
  here; it was simply never committed. Flagging it so it isn't mistaken for drift.

## Not yet done / next steps for the next session

1. **Get the `npm run build` result from the user** (they said they'd run it). If it fails, the
   likely surface area is `console/src/app/c/[slug]/build/PageStudio.tsx` (new `stepNav` prop
   type, `createPortal` import, `Cards`/`VERTICAL_TEMPLATES` still-used-imports) or
   `console/src/lib/runbook-content.ts` (the `Phase.group` optional field interacting with
   `go-live-content.ts`, which borrows the `Phase` type — check `cd console && npx tsc --noEmit`
   if `next build` output is noisy).
2. **Run the manual acceptance checklists** (Studio UI + Onboard UI) listed above — `npm run
   console`, open a real client's `/build` and `/onboard`.
3. **Do not re-run `npm run console` (the dev server)** until the user confirms their own
   `npm run build` has finished — the whole reason the build hung earlier was the dev server
   holding `.next` locked.
4. **Ask the user whether to commit.** Nothing has been committed yet per the standing rule
   (only commit when explicitly asked). Remember the untracked `PhaseBreadcrumbs.tsx` file above.
5. **Revisit the two flagged open items** (automation-vs-manual contradiction in post-call
   wiring; RUNBOOK.md's stale A4/Part D/F sections) if/when the user wants them addressed — they
   are real, not resolved, just explicitly deferred.
