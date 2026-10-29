# Plan — Onboard wizard v2 ("do this / this is what it looks like")

**Route:** `/c/{slug}/onboard` · **Branch:** `feat/onboard-wizard-redesign`
**Status:** agreed via 24-question narrowing on 2026-10-29. Mockup first, then build.
**Predecessor:** `HANDOFF-studio-condense-and-onboard-restructure.md` (that work is landed and built).

## The brief, in one line

The wizard currently *hands you the material*. It should *walk you through the job* — every step
leads with the action, shows a recognisable picture of the thing you are about to touch, and gets
out of the way once it is done.

---

## 1. Decisions (all 24 answers, as binding spec)

### Chrome and navigation

| # | Decision |
|---|---|
| 1 | **Back/Next move to their own sticky sub-bar** directly above the step content, pinned while scrolling. |
| 2 | **The footer nav is removed entirely.** Nothing navigational at the bottom of a step. |
| 3 | **Eyebrows are removed.** The header is one line: title, then `Step X of Y` and the status pill inline after it (wrapping beneath only at narrow widths). |
| 4 | **The phase trail stays and gets more room.** The `Onboard` kicker + client-name block is removed from the header bar to free that width. The trail must render every phase without clipping. |

### Completing a step

| # | Decision |
|---|---|
| 5 | **The action card and its `Complete step` button are gone.** |
| 6 | **Next both completes and advances.** On an actionable step the sticky bar reads `Done, next →`; reference/read-only steps keep a plain `Next →`. |
| 7 | **Nothing sits above the work.** Incomplete steps open straight into the numbered instructions. Launch steps keep a real launch button because it does something. |
| 8 | **The overlay appears any time you land on a completed step** — Back, Next or breadcrumb, one rule. |
| 9 | **It dims the content region only.** Header (title · Step X of Y · Done) and the sticky bar stay fully legible. |
| 10 | **Panel contents:** `✓ Step Completed`, `[Next →]` primary, quiet `[Mark incomplete]`. `View this step` bottom-right lifts the dim **for this visit only** — leave and return and it is dimmed again. |

### The Make mapping step

| # | Decision |
|---|---|
| 11 | **Pixel-faithful replicas** of Make's real panels — white, light-themed, exactly as Make looks: title row with `⋮ ⤢ ? ✕`, coloured header underline (Airtable blue / Twilio red), circular module badge with its number, `∨` collapsible field rows, grey rounded inputs, `Show advanced settings` + `Cancel`/`Save` footer. |
| 12 | **Scrollable panels, click any field to copy.** Each panel scrolls internally like Make's does so every field is reachable (Date → Priority; Twilio's full body). A copied field stays marked so you can see how far you got. |
| 13 | **Full expression-pill rendering:** dark pink chips for `1. call: …`, lighter outlined chips for dotted-path variables, green `=`, lavender `newline`, grey `if(` `;` `)` `parseDate(`. **Copy always yields the raw `{{…}}` text.** |
| 14 | **Airtable + Twilio only.** No webhook/filter replicas. |
| 15 | **Layout:** instructions sit **above** and are the first thing read; the two replicas sit **side by side** beneath, joined by a **trail of dots carrying a gradient from Airtable blue → Twilio red**. Stacks to one column on narrow widths. |

### The deployed-site step

| # | Decision |
|---|---|
| 16 | **Big URL hero + live preview frame.** `https://{slug}.vercel.app` in display type as the dominant element, with `[Open site ↗]` and copy, and a live iframe render of the real page beneath it. The review checklist sits below that. |

### Test-call & tune the agent

| # | Decision |
|---|---|
| 17 | **A full, purpose-built prompt editor inside the step** — editable pane, `[Save to disk]`, `[Push to Retell]`, live-vs-disk drift indicator, char count, version panel beside it. Built for the call → edit → push → call-again loop. |
| 18 | **A version is captured on every save and every push**, tagged with its trigger and timestamp. |
| 19 | **Version UI:** timeline list → preview → line diff against current → `[Restore]`, where restore **loads into the editor for review** rather than pushing to the live agent. |
| 20 | **Fix the stale Starter gate.** `/api/manage/agent-prompt` rejects `plan === 'starter'`, but since the 2026-10-12 reprice every tier except web-only has a receptionist. Gate on `ctx.isWebOnly` in both GET and POST, and sweep for siblings. |

### Reference

| # | Decision |
|---|---|
| 21 | **All reference material moves into one right-hand panel** — call routing (diagrams + the three callouts), the pipeline diagram, the env/ID crib sheet, troubleshooting. No reference-shaped content is left in the step flow. |
| 22 | **A thin `Reference` rail sits on the right edge.** Click → it slides left and fills the horizontal space **over** the stage (no reflow of the step underneath), with the collapse arrow pinned at its left edge. Smooth animation both ways. |

### Scope

| # | Decision |
|---|---|
| 23 | **The Web Analytics step stays.** Investigated during narrowing: `portal-traffic.ts:23` really does call `api.vercel.com/v1/query/web-analytics/visits/aggregate` keyed by `vercelProjectId` — PageSpeed powers the separate *Performance* section, not *Traffic*. Removing the step alone would leave every new client's Traffic tab permanently empty, so it is left in place and the Traffic tab's future is decided separately. |
| 24 | **Deliverable order:** standalone interactive HTML mockup in `console/docs/` first, reviewed and redlined, before any app code is touched. |

### Redline after mockup review (2026-10-29)

| # | Decision |
|---|---|
| 25 | **The content column is CENTRED on the page.** In the mockup the instructions sat hard against the left edge of a wide container while the Make replicas spanned the full width — two different left margins in one column. Prose, instructions, callouts and verify lists are capped at a readable measure and centred; wide blocks break out to the full stage width underneath them. This is expressed through the existing `isWideBlock` predicate, which now covers `diagram`, `make-module`, `site-hero` and `prompt-tuner`. The mockup was **not** updated — the redline went straight into the implementation. |

---

## 2. Resulting step order

The call-routing reference step leaves the flow, which also fixes the ordering complaint — the
post-call checkpoint now follows the test-call checkpoint with no reference wedged between them.

**Onboarding**
1. Launch onboard.js — *Provision the stack*
2. Map the cloned call-log scenario — *Map the call log (Make)* · per site
3. Enable Web Analytics — *Enable analytics*

**Review**
4. Checkpoint 1 — review the deployed site
5. Checkpoint 2 — test-call & tune the agent · per site
6. Checkpoint — post-call log + owner SMS · per site

**Reference panel** (not steps): call routing · provisioning pipeline · IDs & env · troubleshooting.

Web-only clients still collapse to `Launch onboard.js → Enable Web Analytics → Review the site`.

---

## 3. Build order

1. `OnboardStage` — header rewrite, action card removal, sticky nav bar, completed-step overlay.
2. `OnboardWizard` — drop the identity block, widen the trail, move completion onto Next.
3. New `MakeModule` block type + renderer (`make-module`) with the pill parser and copy behaviour.
4. New `site-hero` block (URL + preview frame) for the deployed-site step.
5. New `prompt-tuner` block — editor + versions. New `/api/manage/agent-prompt/versions` route;
   snapshots under `console/.state/prompt-versions/{slug}/{site}/`.
6. `isWebOnly` gate fix in `/api/manage/agent-prompt`.
7. `ReferencePanel` — rail, slide-over, collapse arrow; reference content pulled out of
   `runbook-content.ts` into a `reference-content.ts`.
8. `runbook-content.ts` — delete `routingStep` from `voiceReviewPhase`, restructure the Make step
   around the new block, rewrite copy to imperative "do this" voice throughout.

## 4. Found during implementation (fixed in the same pass)

Three stale-assumption bugs of the same family as #20, all authorised by the "sweep for the same
stale test elsewhere" half of that decision.

| Where | Was | Why it mattered |
|---|---|---|
| `src/lib/reconcile.ts` | `const isStarter = ctx.plan === 'starter'`, gating **all** voice *and* Airtable checks | The reconcile engine silently skipped every voice and Airtable probe for every Starter client who kept their receptionist — the exact class of failure the engine exists to catch, hidden by the engine itself. Now `ctx.isWebOnly`. |
| `src/lib/portalSignals.ts` | `portalSite.plan !== 'starter'` gating the "on a paid plan but no agent provisioned" finding | Excused exactly the clients most likely to have been provisioned as though they had no voice stack. `isWebOnly` is now threaded in through `PortalSignalInput`. |
| `src/lib/runbook-content.ts` | ring window written as `~25s` in the test-call copy and `?? '25'` in the post-call step | The stale 25 CLAUDE.md warns about, in prose that tells the operator to expect a window the system clamps away (default 15, max 20). Both now derive from `ENV_FIELDS`, the copy `ring-window.test.mjs` already pins to `lib/client-env.js`. |

## 5. Guardrails

- `npm test` (root, 122) and `cd console && npm test` (387) stay green.
- `console/test/phase-contract.test.mjs` parses onboard.js stdout only — untouched by this work,
  but re-run it, since step **removal** changes `expectedPhases()` if any phase disappears.
- `go-live-content.ts` borrows the `Phase`/`Block` types — every new block variant must be optional
  and unknown variants must stay inert in the shared `BlockView`.
- `npm run build` in `console/` is the final gate. Do not leave the dev server running during it
  (it locks `.next`).
- Nothing in `jdd-ops/lib/` or `onboard.js` is touched.
