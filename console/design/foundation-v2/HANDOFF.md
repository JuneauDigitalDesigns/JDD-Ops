# HANDOFF: template fidelity upgrade, resume point

Written 2026-10-07 to continue the build in a fresh chat with clean context. Read this first,
then `NOTES.md` in this folder (the running log, authoritative for what is actually on disk),
then `../PLAN-template-fidelity-v2.md` for the phase you are about to run.

## Model split (standing rule)

Opus authors plans and does the reasoning; Sonnet executes file changes. The plan is already
written, so execution is Sonnet's job. Each step in the plan carries exact paths and changes;
if you hit an ambiguity the plan did not resolve, that is a plan defect, so stop and surface it
rather than inventing. Do not relitigate any of the 56 decisions in
`../DECISIONS-template-fidelity-v2.md`.

## The five documents

All in `console/design/`:
- `PLAN-template-fidelity-v2.md`: the merged plan. Prerequisites P1 to P4, then Phases 0 to 13.
  THE source. The two old halves (`-part1`, `-part2`) are superseded and deletable.
- `DECISIONS-template-fidelity-v2.md`: 56 settled decisions (1-38, addendum 39-52, addendum-2
  53-56) plus the P1-P4 prerequisite table.
- `RESEARCH-local-service-visual-design.md`: evidence and gaps G1-G8.
- `foundation-v2/NOTES.md`: the running execution log, one section per phase. Read it for the
  real on-disk state and every deviation taken so far.
- `foundation-v2/HANDOFF.md`: this file.

## Done so far (Prerequisites + Phases 0 to 4, the shared foundation)

| Step | State |
|---|---|
| P1 install @jdd/ui into template | DONE. template builds. |
| P4 tag @jdd/schema v1.20.0, re-pin | DONE, but see DRIFT below: an out-of-band v1.21.0 landed after. |
| P2 console schema pin to github tag | DONE (as P4 side-effect). See DRIFT. |
| P3 leave uncommitted sectionVars for Phase 2 | DONE; Phase 2 deleted it. |
| Phase 0 reconcile DESIGN-LANGUAGE.md | DONE. 27-row archetype table, ghost refs removed. |
| Phase 1 template token layer | DONE. `template/src/styles/tokens.ts` + `rhythm.plugin.ts`, both tailwind configs import them. |
| Phase 2 warm palette, @jdd/ui v1.0.3 | DONE. Grounds warm, inks warm charcoal, contrast suite extended. |
| Phase 3 font pairings | DONE. `FONT_PAIRINGS` replaced `FONT_OPTIONS`; all presets on `instrument`. |
| Phase 4 variety rule + four bans | CODE + TESTS DONE, BUILD GATE NOT RUN (see below). |

Test state at stop: `cd console && npm test` = **182 tests, 181 pass, 1 skipped, 0 fail**.
The skip is `page-rhythm.test.mjs` test 3, intentional until Phase 9.

## IMMEDIATE NEXT ACTION: close Phase 4's build gate

The only thing left in Phase 4 is the two builds, which were interrupted. Run exactly:

```
cd /c/Users/Xander/Desktop/ops/jdd-ops/console  && npm run build > /tmp/p4-con.log 2>&1; echo $? ; tail -5 /tmp/p4-con.log
cd /c/Users/Xander/Desktop/ops/jdd-ops/template && npm run build > /tmp/p4-tpl.log 2>&1; echo $? ; grep -E "business-site-template|Compiled|Failed" /tmp/p4-tpl.log
```

Expect both exit 0. If console fails on a TYPE error in a file Phase 4 touched
(`src/lib/archetypes.ts`, any catalog meta, the two test files, `catalog-invariants.test.mjs`),
that is Phase 4 and must be fixed before closing. If it fails on `check-schema` or anything
ticket-related, that is the DRIFT below and is NOT Phase 4.

Then append the build result to NOTES.md's Phase 4 entry and move to Phase 5.

## THEN: Phase 5 is a HARD USER GATE. STOP there.

Phase 5 (decision 34) settles the visual language in standalone HTML mockups before any component
code. It produces `foundation-v2/mockups-sections.html`, `mockups-hvac-subpages.html`,
`photography.md`, `VERTICAL-LANGUAGE-hvac.md`. **The user must review and approve the mockups
before Phase 6.** Do not start Phase 6 on your own. Build the mockups, show them, wait.

## CRITICAL DRIFT to reconcile (not caused by this plan)

A support-tickets feature landed between sessions. Verified 2026-10-07:

- `@jdd/schema` is now **v1.21.0** (tag pushed). The plan's P4 used v1.20.0 and reserved v1.21.0
  for Phase 13. **That reservation is void: Phase 13 must now cut `v1.22.0`.** Every "v1.21.0" in
  the plan's Phase 13 is now v1.22.0.
  **SUPERSEDED 2026-10-08:** Phase 11 cut `v1.22.0` (ContentMeta.local_images), so **Phase 13 now
  cuts `v1.23.0`.**
- **`npm run check-schema` is RED right now**: console and jdd-ops root pin `v1.20.0`, agency pins
  `v1.21.0`. This is the tickets feature mid-landing, not a fidelity regression. The console's
  installed schema is v1.21.0 while its pin reads v1.20.0 (a shim). Do not "fix" this from inside
  a fidelity phase; it belongs to the tickets work (MEMORY.md: "JDD support tickets", PR #21 open,
  console side uncommitted). Just do not be alarmed by it, and do not let a fidelity phase depend
  on check-schema being green until the tickets owner reconciles the pins.
- `@jdd/ui` is UNAFFECTED: console and template both pinned and installed at v1.0.3. Phase 2's
  work is intact.
- `console/src/lib/audit.ts` has `firewall.apply` (my Phase 0 detour, below) plus three ticket
  actions (the tickets feature). Both intentional; leave them.

## Pre-existing issues already surfaced, still open

- **lawn-care accent `#3D8E40` cannot reach WCAG AA as a button fill with any foreground**
  (best 4.43 vs 4.5 bar). Pre-existing, pre-dates decision 9. Encoded in
  `palette-contrast.test.mjs` as a named exception (`UNREACHABLE_FG`) with a test pinning it as
  the ONLY such vertical. **User decision pending**: darken that green now, or wait for lawn-care's
  own vertical cycle (decision 11 reserves per-vertical accents for that).
- A Phase 0 detour fixed a pre-existing broken console build: `audit.ts` needed `firewall.apply`
  in its `AuditAction` union, and `firewall/route.ts` needed `detail: { ...result }` for a spread.
  Both landed, unrelated to fidelity, one-session-old in-progress work finished.

## Owed-to-user real-browser reviews, deferred (not blockers)

Phases 1, 2, 3 each produced a thing best judged in a real browser that no test can check: the
eight type steps at 390px vs 1440px (P1), the warm ground vs old white side-by-side (P2), the
five pairings in the Brand drawer (P3). All deferred to Phase 5's mockups or Phase 12's reference
site, both of which are real user gates with real pages. Listed here so they are not lost.

## Hard constraints (from the plan's §0.2, do not drift)

- No em-dashes in user-facing copy (template copy, vertical presets, console UI strings). Comments
  may keep theirs. Strip existing em-dashes from user strings when editing a file.
- Never invent client values; a missing field is flagged, not filled.
- `@jdd/schema` zod strips unknown keys: verify against `jdd-schema/dist/site.d.ts`, never `src/`.
- Never round-trip source files through PowerShell `Get-Content`/`Set-Content` (silent UTF-8
  mojibake). Use Edit/Write.
- Do not run `next dev --turbo` on console. Delete `console/.next` if a CSS change goes missing.
- `console/src/lib/pages.ts` and `verticals.ts` are client-imported: no `node:fs`, no `server-only`.

## Execution lessons learned (worth keeping)

- **Never pipe a build through `tail` when the exit code matters.** `cmd | tail; echo $?` reports
  tail's exit, not the build's. A 3-hour "hang" early on was a wrong-exit-code false read. Capture
  to a file: `cmd > log 2>&1; echo $?`.
- **The Bash tool's working directory persists between calls.** A build meant for `template/` ran
  in `console/` once. Always `cd` explicitly and confirm the package name in the log header
  (`business-site-template@0.1.0` vs `jdd-console@0.1.0`).
- **A grep that reports 0 hits may be in the wrong directory** for the same reason; confirm `pwd`.
- **For any @jdd/ui change, the release must land before its tests can pass**, because consumers
  read the pinned GitHub tag, not local source. Expect the first post-edit test run to fail
  against the old installed version; re-pin, then re-run.
- next/font fetches at build time: a flaky network can fail a client export with a cryptic
  null-dereference from `google/loader.js`. Retry before diagnosing.

## @jdd/ui tag ledger (corrected for the drift)

| Tag | Phase | Carries | State |
|---|---|---|---|
| v1.0.3 | Phase 2 | warm palette anchors, sectionVars deletion | CUT |
| v1.0.4 | Phase 6 | motion deprecations (parallaxY, cursor glow cut) | pending |
| v1.0.5 | Phase 7 | 5 new SKINS entries | pending |
| v1.0.6 | Phase 8 | 7 new SKINS entries | pending |
| v1.0.7 | Phase 11 | img.ts local-asset branch | pending |

Schema: v1.20.0 CUT (P4), v1.21.0 (tickets), **v1.22.0 CUT (Phase 11, ContentMeta.local_images)**.
Phase 13 now needs **v1.23.0**.

@jdd/ui: v1.0.3 (P2), v1.0.4 (P6), v1.0.5 (P7), v1.0.6 (P8), **v1.0.7 CUT (Phase 11, img.ts local
asset branch + responsivePicture)**. No further @jdd/ui tag until a later phase touches its src.
