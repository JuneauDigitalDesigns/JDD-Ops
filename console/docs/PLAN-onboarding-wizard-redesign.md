# PLAN — Onboarding wizard redesign + Starter-receptionist correctness + Vercel preview deploy

Status: ready for implementation (Sonnet). Authored 2026-10-21. **Revised** after a code-accuracy
pass (corrections marked ⟳).
Scope: the per-client onboarding route `/c/[slug]/onboard` in `console/`, plus `onboard.js`
and `lib/vercel-sync.js` at the `jdd-ops` root. Part A (`/setup`) is already separate and is
**not** moved — only guarded against reintroduction.

---

## 1. Why this work exists

Three problems, confirmed against the code:

1. **The console still models Starter as "website only."** `onboard.js` gates the voice stack on
   `isWebOnly` from `@jdd/schema` (`onboard.js:56,332,1976,2006`); Starter *with* a receptionist
   now provisions the full stack. The console never caught up — `ClientContext`
   (`src/lib/types.ts:62`) has no receptionist info, and `runbook-content.ts`, `run-plan.ts`,
   `clients.ts`, and `LaunchStage.tsx` all gate voice on `plan !== 'starter'`. This is the
   "still shows the old starter / only shows a website" complaint — a **gating bug**, not a
   display limit.

2. **"Deploys to the preview branch" is not true today.** `onboard.js` step 8 pushes `HEAD:main`
   (`onboard.js:1329`); step 9 `syncVercelEnv` (`onboard.js:1336`) only syncs env + firewall and
   triggers **no deploy at all**. Whatever deploy happens is Vercel's GitHub integration building
   `main` → **production**. `triggerRedeploy` (`lib/vercel-sync.js:592`) also always targets
   `'production'`. ⟳ Note the ordering: step 8 pushes `main` *before* step 9 creates the Vercel
   project (`ensureProject` in `syncVercelEnv`), so for a brand-new client the project may not
   exist at push time and nothing deterministically deploys — which is exactly why
   `triggerRedeploy` carries a "no previous deployment → deploy main from git" fallback
   (`vercel-sync.js:614-627`).

3. **The onboarding UI is a left-rail checklist, not a wizard.** `RunbookShell` →
   `StepRail` + `StepStage` + `LaunchStage`, driven by `OnboardTool`. The user wants a top
   breadcrumb + linear wizard (matching the go-live wizard chrome), a modern/cleaner look, the
   current action always front-and-center, and a full-width streamed log during the run.

---

## 2. Locked decisions (24-question discussion + follow-up)

| Topic | Decision |
|---|----------|
| Vercel target | **Preview-first.** onboard.js produces a *preview* deploy and reports it. |
| Production promotion | ⟳ **Manual, in the Vercel dashboard. No console promote UI, no promote endpoint.** |
| Deploy reporting | onboard.js **triggers** the preview deploy and **reports** its URL + status in the run stream. |
| Live deploy UI | Console **polls + shows** live deploy status (building → ready) + URL on the launch screen (read-only). |
| Vercel scope | **Both** onboard.js and console change. |
| Receptionist gating | **Mirror onboard.js:** read `receptionistMode`/`isWebOnly` from intake; gate all voice UI on `!isWebOnly`. |
| Unset mode | Legacy files with no mode → **display as full-stack**, badge **"unverified."** ⟳ But a real/dry run still requires a mode (see §5 C1). |
| Mode editable | **Allow setting** `receptionistMode` in the console before provisioning (thread `--receptionist`). |
| Web-only scope | **Starter-only.** Growth/Enterprise always full stack. |
| Step granularity | Show the **full phase set onboard.js actually runs** for this client's tier+mode. |
| Skipped phases | For web-only, show voice phases **greyed/struck as "skipped"** — do not hide. |
| `[step N/10]` | **Fix numbering in onboard.js** to be honest; keep the `run-plan.ts` mirror in step. |
| Enterprise sites | **Group phases per site.** |
| Breadcrumb level | **Phase-level crumbs** (Provision → Voice → Post-call → Portal). |
| Nav model | **Linear with jump-back.** |
| Chrome | **Match the go-live wizard chrome** (top bar + single stage, no rail). |
| Status + progress | Live **in the wizard header.** |
| Info demotion | Supporting info rendered **smaller, below the action, open** (no accordions). |
| Run centerpiece | **Raw streamed log full-width**; tracker a slim header. |
| Log parsing | **Both** — parse lines into the tracker AND show raw text live. |
| After run | **Outcome summary first**; log demoted. |
| Visual style | **New modern treatment**, still on console tokens. |
| Part A | **Stays at `/setup`** (already separate); do not reintroduce it in the wizard. |
| Dry-run | **Keep** the dry-run toggle + confirm modal. |

---

## 3. Workstream A — Receptionist / web-only data model (console)

Goal: the console sees the same `isWebOnly` truth onboard.js does, and every voice gate keys off
it instead of `plan`.

⟳ **Verified fact (resolves the old §9 risk):** `isWebOnly` is literally
`site.plan === 'starter' && site.receptionistMode === 'declined'` (`@jdd/schema` `account.js:140`).
Undefined mode ⇒ `false` ⇒ full-stack. It does **not** throw. So unset-mode = full-stack is free.

⟳ **Verified type friction:** `isWebOnly(site: PortalSite)` and `PortalSite` requires
`slug`, `plan`, `status`, `addedAt`. onboard.js (plain JS) calls it with a bare
`{ plan, receptionistMode }`; the console (TS) **cannot** do that without a build error. Use an
assertion. Also import the mode union from the package rather than re-declaring it.

### A1. `src/lib/intake.ts`
- `import type { ReceptionistMode } from '@jdd/schema'` (the union
  `'forwarded'|'published'|'declined'`).
- Extend `RawIntake` with `receptionistMode?: ReceptionistMode`.
- `parseIntakeSource`: the `mod.INTAKE` path already returns the whole object
  (`return mod.INTAKE as RawIntake`), so `receptionistMode` flows through once it's on the type —
  no runtime change. The `mod.CONTENT` legacy fallback has no mode; leave it **undefined**.

### A2. `src/lib/types.ts`
- Add to `ClientContext`:
  - `receptionistMode?: ReceptionistMode` (import the type) — undefined = unverified.
  - `isWebOnly: boolean` — the single gate.
  - `receptionistModeVerified: boolean` — `false` when mode was absent from intake. Drives the
    "unverified" badge.
- Set all three on **both** return paths of `getClientContext` (real + no-intake stub). Stub:
  `isWebOnly:false`, `receptionistMode:undefined`, `receptionistModeVerified:false`.

### A3. `src/lib/clients.ts`
- `import { isWebOnly } from '@jdd/schema'` and `import type { PortalSite } from '@jdd/schema'`.
- Compute once per client:
  ```ts
  const mode = intake.receptionistMode;
  const webOnly = isWebOnly({ plan, receptionistMode: mode } as PortalSite); // ⟳ cast required
  ```
  (`plan` is the console `Plan`; the `as PortalSite` assertion is legal because the literal
  overlaps on `plan`. Do **not** build a full fake PortalSite, and do **not** re-implement the
  predicate locally — the package is the single definition.)
- Thread `webOnly` into the status helpers, replacing the `plan === 'starter'` branches:
  - `isProvisioned(webOnly, s)`: web-only ⇒ `Boolean(s.env.VERCEL_PROJECT_NAME)`; else
    `Boolean(RETELL_AGENT_ID && TWILIO_NUMBER && AIRTABLE_BASE_ID)`.
  - `isCallbackWired(webOnly, s)`: web-only ⇒ `true`; else `Boolean(RETELL_POST_CALL_WEBHOOK_URL)`.
  - `deriveStatus(webOnly, sites)`.
- Set `isWebOnly`, `receptionistMode: mode`, `receptionistModeVerified: mode != null` on the
  returned context.

### A4. `src/lib/runbook-content.ts`
Replace every `plan`-based voice gate with the flag:
- `provisionPhase`: `const voice = ctx.plan !== 'starter'` (≈line 120) → `const voice = !ctx.isWebOnly`.
- Checkpoint-1 Starter callout (≈line 188): condition `ctx.plan === 'starter'` → `ctx.isWebOnly`,
  and reword — a Starter *with* receptionist must NOT get the "no voice agent" copy; only a
  web-only client does.
- `clerkMetadataJson` `airtableBaseId` null rule (≈line 101): `ctx.plan === 'starter' ? null`
  → `ctx.isWebOnly ? null`.
- `buildRunbook` (≈line 474): `if (ctx.plan !== 'starter')` → `if (!ctx.isWebOnly)`.
- `portalPhase` invite-client tab copy (≈line 449) `ctx.plan === 'starter'` → `ctx.isWebOnly`.
- Keep the **plan label** (`PLAN_LABEL`) plan-based — that is correct.
- Grep this file for any remaining `=== 'starter'` / `!== 'starter'` and re-key on `isWebOnly`.

### A5. `src/lib/run-plan.ts`
- `expectedPhases`: `const voice = ctx.plan !== 'starter'` (line 83) → `const voice = !ctx.isWebOnly`.
- ⟳ **Show-skipped behavior.** Per the "don't hide" decision, for a **web-only** client still
  emit the five voice phases (`prompt`, `agent`, `number`, `airtable`, `callLogging`) but with
  `status: 'skipped'`, so `PipelineFlow` renders them struck (`ROW_STYLE.skipped` already exists,
  `PipelineFlow.tsx:38`). For non-web-only clients, emit nothing extra (current behavior). Update
  the docstring at lines 65–79 — the gate is web-only, not starter, and the earlier "don't
  pre-mark skipped" note applied to *Growth looking empty*, which is a different case.
- ⟳ **`restingPhases` must preserve 'skipped'.** It currently recomputes status from disk and
  would flip the web-only voice phases back to `'pending'` (env is empty), implying they will
  run. Fix: if a planned phase arrives `status === 'skipped'`, keep it skipped; only derive
  done/pending for the rest.
- ⟳ If you add a new **Preview deploy** phase (§5 C2), its label needs a `DETAIL` entry — `DETAIL`
  is `Record<PhaseLabel, string>` (line 32), so a new `PHASE_LABELS` member without a `DETAIL`
  entry is a compile error. Add both.

### A6. `src/components/LaunchStage.tsx`
- Confirm-modal copy (≈line 263): `ctx.plan !== 'starter' && ', a Retell agent, …'` →
  `!ctx.isWebOnly && …`. (Further rework in Workstream D.)

**Verify A:** a Starter + `receptionistMode:'forwarded'` now shows Voice + Post-call phases and
the pipeline includes agent/number/Airtable/call-logging; a Starter + `'declined'` shows those
struck as skipped; a legacy CONTENT Starter (no mode) shows full stack + "unverified" badge.

---

## 4. Workstream B — onboard.js preview deploy + honest numbering

### B1. Preview-first deploy (`onboard.js` + `lib/vercel-sync.js`)
- ⟳ Add a **new** `triggerPreviewDeploy({ slug, log })` to `lib/vercel-sync.js`. Model it on the
  git branch of `triggerRedeploy` (`vercel-sync.js:621-627`) but **omit `target`** (Vercel treats
  a targetless deployment as a **preview**):
  ```js
  body = { name: projectName, gitSource: { type: 'github', repo: `${githubOrg}/${slug}`, ref: 'main' } };
  // POST /v13/deployments  → return { id, url: `https://${d.url}`, inspectorUrl }
  ```
  **Do not modify `triggerRedeploy`** — it is shared by the console env-sync / redeploy / go-live
  flows and must keep targeting production. **Do not add a promote function** — promotion is
  manual in the Vercel dashboard.
- In `syncVercelEnv` (step 9), after env + firewall sync, call `triggerPreviewDeploy` and emit a
  parser-friendly line, e.g. `Preview deploy: https://<slug>-<hash>.vercel.app (status: building)`.
  Keep it **best-effort** (warn, never fail the run) — same contract as the firewall block
  (`onboard.js:1365-1370`). The synced env already targets preview (`upsertEnvVar` sets
  `target: ['production','preview','development']`, `vercel-sync.js:659`), so the preview build
  has what it needs.
- ⟳ **Auto-deploy caveat — must be verified on the real account, cannot be settled from code.**
  The project is created linked to the GitHub repo (`vercel-sync.js:100-106`). Whether pushing
  `main` (step 8) *also* produces a competing **production** deploy depends on the org-level
  GitHub-integration setting (it is set to "All repositories" per CLAUDE.md). Two outcomes:
  - If no production deploy auto-fires (likely, since the project doesn't exist yet at push
    time), our explicit preview deploy is the only one — clean.
  - If the org integration auto-creates + deploys production, add a one-time project setting after
    create to disable git auto-deploy (so only explicit preview deploys exist), then re-verify.
  Implement `triggerPreviewDeploy` + reporting now; add a **verification task** (run a real
  onboard against a throwaway slug, confirm Vercel shows a *preview* and no unwanted production
  deploy). Do not hard-code an unverified project-settings API call.

### B2. Honest step numbering (`onboard.js`) — ⟳ lowest-risk approach
- Today `TOTAL_STEPS = 10` (`onboard.js:67`); `log(step, msg)` prints `[step ${step}/${TOTAL_STEPS}${tag}]`
  (`onboard.js:87`). The numbers passed to `log()` are neither unique nor monotonic (step 3 ×2,
  step 8 ×5), and per the parser comment they are repeated/looped per site.
- ⟳ **Keep the `[step N/M tag]` format** so the console parser's `STEP_RE`
  (`onboard-parse.ts:92`) and `FAIL` handling need **no change**. Make `log()` use a
  module-level monotonic counter for `N` (ignore/deprecate the passed arg) and set `M` to the
  true planned count (or the running max). Add the new **Preview deploy** step through the same
  `log()` so it is numbered and tagged like the rest.
- ⟳ The numbers are **cosmetic for the console** (the parser keys on message text via
  `PHASE_MAP`, not on `N`), so this change cannot break phase detection as long as the bracket
  format is preserved. If you instead drop `/M`, you MUST relax `STEP_RE` to make the denominator
  optional — preferring to keep the format avoids that risk entirely.
- `fail()` (`onboard.js:93`) prints `[step ${step}/${TOTAL_STEPS}] FAIL:` — keep it matching
  whatever format `log()` uses so `onboard-parse.ts`'s `FAIL:` detector (line 140) still fires.

### B3. Mirror discipline
`run-plan.ts` is a hand-maintained mirror of onboard.js's loop (`run-plan.ts:8`). The new
Preview-deploy step must land in `PHASE_LABELS`, `PHASE_MAP`, `DETAIL`, and `expectedPhases()` in
the **same commit** as the onboard.js change.

---

## 5. Workstream C — console run plumbing (receptionist + deploy stream)

### C1. Thread `--receptionist` into the run — ⟳ mandatory when unverified
- ⟳ **Hard constraint:** `onboard.js` runs `validateIntake` (`onboard.js:1969`) **before** the
  `DRY_RUN` branches, and it *errors* when `receptionistMode` is not one of
  forwarded/published/declined (`onboard.js:347-354`). So a client with an unverified mode fails
  **both** dry and real runs unless `--receptionist` is supplied. The console must therefore
  **require a mode selection before launching either run** when `receptionistModeVerified` is
  false (and allow override otherwise).
- `src/app/api/runbook/onboard/route.ts`: accept `receptionist?: 'forwarded'|'published'|'declined'`
  in the POST body; validate against that set; when present, append `--receptionist <mode>` to the
  `args` (onboard.js accepts it, `onboard.js:1968`). Reject an invalid value with an `error` event
  before spawning. Leave the existing slug/gate checks intact.
- `src/lib/useOnboardRun.ts`: add `receptionist` to the hook input; include it in the fetch body;
  default to `ctx.receptionistMode` (omit when undefined).
- `src/components/LaunchStage.tsx` (or its D4 successor): a small forwarded/published/declined
  control, pre-filled from `ctx.receptionistMode`. When unverified, the run buttons are disabled
  until a mode is chosen.

### C2. Parse the deploy line + capture the URL
- `src/lib/onboard-parse.ts`:
  - Add `PHASE_LABELS.deploy = 'Preview deploy'` (keep the existing `vercel = 'Vercel deploy'` for
    the env-sync step) and a `PHASE_MAP` entry: `{ re: /Preview deploy:/i, label: PHASE_LABELS.deploy }`.
  - Add `previewUrl?: string` and `deployStatus?: string` to `RunState`; parse them from the
    `Preview deploy:` line (mirror how `vercelProject` is captured via `VERCEL_RE`, lines 94/189).
- `src/lib/run-plan.ts`: add the `deploy` label to `DETAIL` and push a `planned(PHASE_LABELS.deploy, tag, slug)`
  **per site**, right after the existing `vercel` phase in the `sites.forEach` loop
  (`run-plan.ts:110`). It is per-site because each site has its own Vercel project and its own
  `syncVercelEnv` call (`onboard.js:2038`, inside the loop).

### C3. Live deploy status UI (read-only)
- Once `previewUrl` is known, poll a thin console route that wraps
  `listDeployments(slug, { target: 'preview', limit: 1 })` (already exists,
  `vercel-sync.js:283`, `target` is a param) and render building → ready + the clickable preview
  URL. A simple interval while `running || status !== 'ready'` is fine; reuse the Deployments
  section's polling if one exists.
- ⟳ **No promote button / no promote route.** Production promotion is done in the Vercel
  dashboard.

---

## 6. Workstream D — UI redesign (breadcrumb wizard, modern chrome, action-first)

Target chrome = `src/app/go-live/page.tsx`: a `shrink-0` top bar (progress strip) + a single
scrolling `<main>` stage, **no left rail**. Extend it with phase-level breadcrumbs + the status
control.

### D1. New wizard shell — replace the rail
- New `src/components/onboard/OnboardWizard.tsx` replacing `RunbookShell`'s rail+stage split for
  this route. **Reuse** the existing state model and nav helpers verbatim — `useRunbookState`,
  `buildRunbook`, and `runbook-nav.ts` (`flatten`, `firstIncomplete`, `nextActionable`,
  `progressOf`, `groupBySite`). Do not reinvent them.
- `OnboardTool.tsx` renders `OnboardWizard` instead of `RunbookShell`.
- ⟳ **Safe to delete** `RunbookShell.tsx` + `StepRail.tsx` after rewiring: grep confirms their
  only references are `OnboardTool` (the wiring), the files themselves, and a prose comment in
  `useOnboardRun.ts`. `StepStage` is **kept** (go-live + setup import it directly).

### D2. Top breadcrumb header (phase-level, linear + jump-back)
- New `src/components/onboard/PhaseBreadcrumbs.tsx`: one crumb per **phase** (`Phase[]` from
  `buildRunbook`) with done/active/upcoming states. A started/complete phase is clickable (jumps
  to its first step); upcoming phases are not. This is distinct from the global
  `shell/Breadcrumbs.tsx` (Home / Section) — do not conflate them.
- Header also carries: brand name (small), the **status pill** (move `StatusControl` out of the
  old rail footer) and the **progress bar** (`completed/total`, `pct`).

### D3. Step stage — action front and center
- New `src/components/onboard/OnboardStage.tsx` (new modern look). Rules:
  - The **primary action** (Complete step / Open provisioning run / in-app `run` block) is the
    dominant element at the top — a prominent action card, not buried under prose.
  - `why`, `diagram`, `context`, `verify`, etc. render **below, smaller, open** (no accordions).
    Keep using `BlockView` + the block DSL so `runbook-content.ts` authored content still renders;
    only hierarchy/scale change.
  - Keep Back / Next / Complete semantics from `runbook-nav`.

### D4. Launch screen — raw log centerpiece, outcome first
Rework `LaunchStage.tsx` into `src/components/onboard/OnboardLaunch.tsx` (or in place):
- Keep both gates (no intake / not built) and the dry-run toggle + confirm modal verbatim.
- Add the receptionist-mode control (C1); disable run buttons until a mode is set when unverified.
- During a run: **raw streamed log full-width and primary**; `PipelineFlow` becomes a **slim
  header strip** above it. Both update live.
- Show **live preview deploy status + URL** (C3) as it arrives.
- On completion: **outcome summary first** (`RunOutcomeCard` incl. preview URL + resources;
  `NextSteps` on failure); raw log **demoted** into `RunLogDrawer`.
- ⟳ **No promote button.**

### D5. Visual language (new modern treatment)
- Build on existing tokens (`--accent`, `--fg-2/3`, `panel`, `codechip`, `kicker`, `EASE`) with a
  cleaner, denser hierarchy: one prominent action card per step, quieter supporting blocks. No
  console-wide rebrand. Keep `framer-motion` entrances; respect `useReducedMotion` as
  `PipelineFlow` does.

### D6. Enterprise grouping
- Keep `groupBySite` (`runbook-nav.ts:68`) for per-site step grouping, and `PipelineFlow`'s
  per-site columns — together they satisfy "grouped per site."

---

## 7. Workstream E — Part A guard (already at `/setup`)

`buildPartA` renders at `src/app/setup/page.tsx` under `_one-time-setup`, outside
`buildRunbook`/the per-client route. No move needed; leave `/setup` untouched. Only ensure the
new `OnboardWizard` does not surface Part A.

---

## 8. File-by-file index

Console — edit:
- `src/lib/intake.ts` (A1) · `src/lib/types.ts` (A2) · `src/lib/clients.ts` (A3) ·
  `src/lib/runbook-content.ts` (A4) · `src/lib/run-plan.ts` (A5, B3, C2) ·
  `src/lib/onboard-parse.ts` (C2) · `src/app/api/runbook/onboard/route.ts` (C1) ·
  `src/lib/useOnboardRun.ts` (C1) · `src/components/client/OnboardTool.tsx` (D1)

Console — new:
- `src/components/onboard/OnboardWizard.tsx` (D1) · `src/components/onboard/PhaseBreadcrumbs.tsx` (D2)
  · `src/components/onboard/OnboardStage.tsx` (D3) · `src/components/onboard/OnboardLaunch.tsx` (D4)
  · one thin preview-deploy status route for C3 (wraps `listDeployments`).

Console — delete after rewiring (grep-confirmed safe):
- `src/components/RunbookShell.tsx` · `src/components/StepRail.tsx`

jdd-ops root — edit:
- `onboard.js` (B1 preview deploy in step 9; B2 numbering; new numbered Preview-deploy step) ·
  `lib/vercel-sync.js` (B1 **new** `triggerPreviewDeploy` only — `triggerRedeploy` untouched)

Keep as-is: `src/app/setup/page.tsx`, `src/app/go-live/page.tsx`, `src/lib/runbook-nav.ts`,
`src/components/StepStage.tsx`, `src/components/flow/PipelineFlow.tsx` (reused as slim tracker).

---

## 9. Risks & verification (⟳ updated)

- **TS cast for `isWebOnly`.** `PortalSite` has required fields; call with
  `isWebOnly({ plan, receptionistMode: mode } as PortalSite)`. Resolved risk: the predicate
  returns `false` (never throws) for undefined mode, so unset = full-stack is correct by default.
- **Unverified mode blocks runs.** The launch UI must force a mode choice before dry *or* real
  run when `receptionistModeVerified === false`, or onboard.js's `validateIntake` fails the run.
- **`restingPhases` must preserve `skipped`** for web-only voice phases, else they wrongly show as
  "will run" before any run.
- **New `PHASE_LABELS` member ⇒ `DETAIL` entry** (compile error otherwise).
- **Parser/plan drift.** onboard.js step change + `PHASE_LABELS`/`PHASE_MAP`/`DETAIL`/`expectedPhases`
  in one commit (`run-plan.ts:8`). Keep the `[step N/M]` bracket format so `STEP_RE` is untouched.
- **Do not touch `triggerRedeploy`** — shared production path; add `triggerPreviewDeploy` only.
- **Vercel auto-deploy** — verify on a throwaway run whether pushing `main` also fires a
  production deploy; if so, disable git auto-deploy on the project. Cannot be settled from code.
- **Deleting the rail** — grep reconfirmed before deleting (`OnboardTool` is the only live
  importer).
- **Build:** `npm run build` in `console/` must pass; fix all type errors from the new
  `ClientContext` fields.
- **Tests:** console has **no existing tests** for the parser/plan (`test/` dir doesn't exist yet;
  jdd-ops root has no `test` script), so nothing breaks — but **add** coverage under
  `console/test/**/*.test.mjs` (the configured `node --import tsx --test` runner): `parseRun` over
  a Preview-deploy line, `expectedPhases` for Starter-with-receptionist / Starter-declined /
  Growth / Enterprise, and the new numbering.
- **Dry-run checkpoint** across all four configurations (Starter+receptionist, Starter-declined,
  Growth, Enterprise) is the behavioral guard for the gating change — confirm each phase list
  matches onboard.js's actual loop.

---

## 10. Suggested commit sequence

1. **A** — data-model gating fix (types, intake, clients, runbook-content, run-plan skipped
   handling, LaunchStage confirm text). Self-contained correctness fix; shippable alone and the
   highest-value change.
2. **B** — onboard.js preview deploy + numbering + `triggerPreviewDeploy` (+ run-plan/parse mirror
   for the deploy phase). Includes the Vercel auto-deploy verification task.
3. **C** — console run plumbing: mandatory `--receptionist` thread + deploy-status parse/stream
   (read-only).
4. **D** — UI redesign (wizard shell, breadcrumbs, stage, launch rework, visual language).
