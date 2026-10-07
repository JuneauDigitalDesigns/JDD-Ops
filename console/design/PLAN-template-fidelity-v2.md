# Plan: template fidelity upgrade (v2)

> **This document supersedes `PLAN-template-fidelity-v2-part1.md` and
> `PLAN-template-fidelity-v2-part2.md`.** Those two halves disagreed with each other and with the
> decisions file in several places, which is the single biggest drift risk for an executor
> (decision 56). They are now deletable. Read this file only.
>
> **One document, four prerequisites and fourteen phases.** Prerequisites P1 to P4 come first and
> are not phases. Then section 0 (ground rules, cited by name from every phase), then Phases 0 to
> 13: documentation reconciliation, the token layer, the warm palette, the type pairings, the
> variety lints, the HTML mockup gate, chrome and smooth scroll, catalog wave 1, catalog wave 2,
> page structure, the multi-page copy review, the image pipeline, the HVAC vertical language and
> the reference site, and intake.
>
> Authored against `RESEARCH-local-service-visual-design.md` (gaps G1 to G8) and
> `DECISIONS-template-fidelity-v2.md` (decisions 1 to 56, in three parts: 1 to 38, the
> reconciliation addendum 39 to 52, and addendum 2's 53 to 56, plus the P1 to P4 prerequisite
> table). Decision numbers and gap numbers below refer to those two files. **All 56 decisions are
> settled: do not relitigate them and do not add scope they excluded. Where the decisions file and
> this plan ever disagree, the decisions file wins and this plan is wrong.**
>
> Decision 33: every phase is independently verifiable, ends in a build gate, and ends in
> something the user can look at. Decision 37: Phases 1 to 4 are the shared foundation, built
> once for all verticals. Decision 34: Phase 5 settles the visual language in standalone HTML
> before any component code is written, and is a hard user gate.
>
> **Read in this order:** the prerequisites section, then section 0 in full, then one phase at a
> time. Do not start a phase on a red gate from the previous one.

---

## Prerequisites: four fixes before Phase 0, in a fixed order

Every one of these invalidates a build gate this plan leans on, so none of them is optional and
none of them is a phase. They come from the decisions file's "Prerequisite summary, all four"
table (P1 to P4, decisions 40, 41, 53). All four were verified by direct inspection on
2026-10-05, not inferred.

**The order is P1, P4, P2, P3, and the P4-before-P2 ordering is load-bearing.** P2 converts the
console's `@jdd/schema` pin from `file:../../jdd-schema` to a github tag. The newest tag today is
`v1.19.1`, and `v1.19.1` does **not** contain the uncommitted v2.2 schema work the console is
actively using right now (`ServiceItem.detail`, `AboutContent.story`, `SectionStyle`,
`PageHeaderContent`, `SubpageContent`, `SiteContent.subpages`). The console only sees those
fields because its `file:` pin reads the working tree directly. Convert the pin before P4 has cut
a tag containing them and the console is stranded on `v1.19.1`, where `@jdd/schema`'s zod
**silently strips** every one of those keys on read, with no error: Phases 8 and 9 would then be
building against fields that vanish at runtime. So P4 must produce `v1.20.0` first, and only then
can P2 point the console at it.

### P1. Install `@jdd/ui` into `template/`

`C:\Users\Xander\Desktop\ops\jdd-ops\template\node_modules` predates the `@jdd/ui` dependency.
`template/package.json:19` requires `@jdd/ui#v1.0.2`, `template/node_modules/@jdd` does not
exist, and `template/package-lock.json` contains no `@jdd/ui` entry, so
`cd template && npm run build` fails today on an unresolved `@jdd/ui/palette` import from
`template/src/lib/palette.ts`. Every phase in this plan uses that build as a gate.

```
cd /c/Users/Xander/Desktop/ops/jdd-ops/template
npm install
npm ls @jdd/ui        # must print @jdd/ui@1.0.2, not "(empty)"
npm run build         # must pass BEFORE you change anything
```

`@jdd/ui` is a **private** GitHub repo, so confirm it actually resolves under the current `gh`
auth rather than assuming. If `npm install` 404s on the tarball, the fix is the auth, not the
pin: see the `github-account-switch` flow (the JDD org account owns `jdd-ui`).

**Verification:** `npm ls @jdd/ui` prints `@jdd/ui@1.0.2` and `npm run build` exits 0.

### P2 (run AFTER P4). Convert the console's `@jdd/schema` pin to the github tag

Decision 40. `console/package.json:19` pins `@jdd/schema` as `file:../../jdd-schema`; the jdd-ops
root `package.json:33` and the agency repo both pin `github:...#v1.18.0`.
`console/scripts/check-pins.mjs` compares the raw pin **strings**, so a `file:` spec can never
equal a `github:` spec and `npm run check-schema` can never go green while it stands. This is why
the check fails today, and it is a pre-existing failure, not something a phase caused.

Decision 40 accepts losing the `file:` local-iteration convenience in exchange for all three
consumers agreeing and exported client repos resolving reproducibly.

```
cd /c/Users/Xander/Desktop/ops/jdd-ops/console
npm install "github:JuneauDigitalDesigns/jdd-schema#v1.20.0"
npm run check-schema
```

**Verification:** `npm run check-schema` ends with
`@jdd/schema pinned and installed consistently at github:JuneauDigitalDesigns/jdd-schema#v1.20.0.`
and `grep '"@jdd/schema"' console/package.json` shows no `file:`.

### P3. Delete the uncommitted `sectionVars` from `@jdd/ui`

Decision 41. `packages/ui/src/palette.ts` carries an **uncommitted** 39-line addition exporting
`SectionStyleLike` and `sectionVars`. Note that `packages/ui/` is gitignored by jdd-ops
(`.gitignore:24`) **and is its own git repository**, so `git status` from the jdd-ops root reports
a misleadingly clean tree. Check from inside the package:

```
cd /c/Users/Xander/Desktop/ops/jdd-ops/packages/ui
git status --short         # expect ` M src/palette.ts`
git diff --stat
grep -n sectionVars /c/Users/Xander/Desktop/ops/jdd-ops/console/node_modules/@jdd/ui/src/palette.ts
# expect NO hits: it is absent from both HEAD and tag v1.0.2, so it has never been published
```

The deletion itself, and the full three-part rationale for deleting rather than publishing it, is
specified in **Phase 2's §2b**, which also cuts the `v1.0.3` tag that carries the deletion. Do not
duplicate that work here. **What P3 owns is only this: do not commit the working-tree addition,
and do not let any earlier step pick it up into a tag.** Record in `NOTES.md` that the dirty tree
was seen and is owned by Phase 2.

**Verification:** `cd packages/ui && git stash list` is empty and `git diff --stat` still shows
only `src/palette.ts` as modified, nothing staged, nothing committed.

### P4 (run FIRST, before P2). Commit and tag the v2.2 schema work as `v1.20.0`

Decision 53. **This moves the schema commit-and-tag out of the last phase and into a
prerequisite, because Phases 8 and 9 depend on it.** `PageHeaderContent` (the prop shape all four
page-header variants take) and `SectionStyle` (the per-section override `sectionStyles` keys off)
exist today only as uncommitted source in `jdd-schema`. A plan that tags the schema last would
have Phases 8 and 9 building against types that are not published to the repos that read `dist`.

`jdd-schema` has 33 lines of uncommitted, untagged v2.2 work on top of tag `v1.19.1`. The full
diff was read: it is entirely additive, every new field is optional, and it is coherent rather
than half-finished. Contents:

| Addition | Where |
|---|---|
| `detail?: string` (2 to 3 sentence expansion for the Services page) | `ServiceItem` |
| `story?: string[]` (multi-paragraph story for the About page) | `AboutContent` |
| `interface SectionStyle` (per-section accent/bg/bgSoft/headingWeight/scale override) | new |
| `interface PageHeaderContent` (eyebrow, title, sub, nullable cta) | new |
| `interface SubpageContent` (`header` plus per-page `seo`, nothing else) | new |
| `subpages` (per-route content for non-home pages) | `SiteContent` |

Who is affected, verified:

- **Console: unaffected today.** Its `file:` pin reads the uncommitted source directly, which is
  why none of this has surfaced. That is also exactly why P2 cannot run first.
- **Exported client repos: unaffected.** They define `SiteContent` locally and do not depend on
  `@jdd/schema` at all (see the comment at the top of `packages/ui/src/palette.ts`).
- **jdd-ops root `onboard.js` and the agency repo: affected.** Both pin `v1.18.0`, two tags behind
  `v1.19.1` and missing every v2.2 field, so zod silently strips them on read.

**This corrects decision 48.** Decision 48 said `services.items[].detail` needed no schema bump
because it already existed. It exists in `console/src/lib/copy-schema.ts:37` (the copy
*generation* schema, committed) and in `jdd-schema/src/site.ts` (the *site content* schema,
untagged). Those are two different schemas and conflating them was an error. `detail` is usable
by Phase 10's copy review and by the Services page, but only after this tag and re-pin.
`SubpageContent` carrying only `header` plus `seo` independently confirms that `subpages` has no
body copy, which is why `services.items[].detail` is the right home for service prose.

Run the §0.3b loop with no source changes of your own, tagging **v1.20.0**:

```
cd /c/Users/Xander/Desktop/ops/jdd-schema
git diff                 # read it; confirm it matches the table above and nothing else
npm run build            # rebuilds dist/, the ONLY thing consumers read
npm test
#  bump package.json "version" to 1.20.0 (edit the file; do not use `npm version`)
git add -A && git commit -m "feat: v2.2 content fields (detail, story, SectionStyle, PageHeaderContent, subpages)"
git tag v1.20.0
git push origin HEAD --tags

#  then re-pin ALL THREE consumers with an explicit tagged install
cd /c/Users/Xander/Desktop/ops/jdd-ops/console              && npm install "github:JuneauDigitalDesigns/jdd-schema#v1.20.0"
cd /c/Users/Xander/Desktop/ops/jdd-ops                       && npm install "github:JuneauDigitalDesigns/jdd-schema#v1.20.0"
cd /c/Users/Xander/Desktop/ops/juneau-digital-designs        && npm install "github:JuneauDigitalDesigns/jdd-schema#v1.20.0"
```

The console install above is the same command P2 runs; doing it here is what makes P2 a
verification step rather than new work. Both the jdd-ops root and the agency repo are on
`v1.18.0`, so this moves them forward two tags: expect that to surface fields they have been
silently dropping, which is the point.

**Verification, against `dist` and never against `src` (§0.2 rule 3):**

```
grep -nE "detail\?|story\?|SectionStyle|PageHeaderContent|SubpageContent|subpages" \
  /c/Users/Xander/Desktop/ops/jdd-schema/dist/site.d.ts     # all six present
cd /c/Users/Xander/Desktop/ops/jdd-ops/console && npm run check-schema
# must print: @jdd/schema pinned and installed consistently at github:...#v1.20.0.
cd /c/Users/Xander/Desktop/ops/jdd-ops && node onboard.js --schema clients/_e2e_test_growth/site.ts --dry-run   # exit 0
cd /c/Users/Xander/Desktop/ops/juneau-digital-designs && npm run build                                          # exit 0
```

**What P4 does NOT do.** It adds no new fields of its own. The decision-29 intake fields
(`ownerName`, `brandsCarried`, `responseTime`) are **not** part of this tag: they are Phase 13's
work and take their own later bump, **`v1.21.0`**, because `v1.20.0` is consumed here.

### Prerequisite summary

| # | Fix | Order | Verification |
|---|---|---|---|
| P1 | `npm install` in `template/`; confirm `@jdd/ui#v1.0.2` resolves under current `gh` auth | 1st | `npm ls @jdd/ui` prints 1.0.2; `npm run build` exits 0 |
| P4 | Commit and tag `jdd-schema` v2.2 work as `v1.20.0`; re-pin all three consumers | 2nd | all six additions in `dist/site.d.ts`; `check-schema` green at v1.20.0 |
| P2 | Convert the console's `@jdd/schema` pin from `file:` to `github:...#v1.20.0` | 3rd, **after P4** | `check-schema` green; no `file:` in `console/package.json` |
| P3 | Leave the uncommitted `sectionVars` alone for Phase 2 to delete; do not commit it | 4th | `packages/ui` tree still dirty on `src/palette.ts` only |

Record all four outcomes in `console/design/foundation-v2/NOTES.md` (Phase 0 creates it; if you
run the prerequisites first, create the folder and the file now and let Phase 0 append).

---

## Section 0: ground rules

Everything in this section is load-bearing for the whole plan. The seven subsections are
cited by name from Phases 0 to 13.

### 0.1 Repo map, and the known-green baseline

```
C:\Users\Xander\Desktop\ops\
├── jdd-ops\                     (git repo, never deployed)
│   ├── console\                 the operator app; HOSTS the catalog source of truth
│   ├── template\                the blank Next.js base exported into each client repo
│   ├── packages\ui\             @jdd/ui, ITS OWN GIT REPO (see §0.3)
│   ├── design\catalog-v2\SPEC.md     the catalog design spec (Phases 6 to 13 cite §4, §7, §9, §10a)
│   ├── studio\catalog\AUTHORING_CONTRACT.md   the component authoring rules
│   ├── PERF.md                  at the jdd-ops ROOT, not under console/
│   └── clients\<slug>\repo\     generated client repos
└── jdd-schema\                  @jdd/schema, its own git repo, THREE consumers
```

**Prerequisites P1 to P4 are already done by the time you read this.** They are in the
Prerequisites section above, not in any phase. What section 0.1 owns is the baseline you record
immediately after them and before Phase 0, so that no later phase mistakes a pre-existing failure
for a regression it caused:

```
cd /c/Users/Xander/Desktop/ops/jdd-ops/template && npm run build     # must pass (P1)
cd /c/Users/Xander/Desktop/ops/jdd-ops/console
npm test                 # must pass: 6 suites in console/test/
npm run build            # must pass
npm run check-schema     # must now be GREEN at v1.20.0 (P4 then P2)
```

All four must be green. If `check-schema` is still red, P2 or P4 did not complete: go back, do
not start Phase 0 on it, and do not "fix" it from inside a phase. If the template build fails for
any reason other than a missing `@jdd/ui`, stop and report the exact error. You are establishing
a known-green baseline; do not start Phase 0 without one. Write the four results into
`console/design/foundation-v2/NOTES.md`.

### 0.2 Hard constraints

1. **No em-dashes in any user-facing copy.** That means template copy, vertical presets
   (`console/src/data/verticals/*.ts`), component text, `alt` strings, labels, and console UI
   strings. Use commas, colons, or periods. When you edit a file for any other reason, strip the
   em-dashes you find in its user-facing strings as you go. Code comments are not user-facing and
   may keep theirs; do not churn comments for this.
2. **Never invent client values.** `jdd-ops/CLAUDE.md` forbids it. A missing or unknown field is
   flagged in `_meta.missingFields`, never filled with a plausible guess. This applies to every
   new field, preset value, and placeholder `alt` string in this plan.
3. **`@jdd/schema` zod strips unknown keys.** A field absent from the *reading* app's pinned tag
   is silently deleted on read, with no error. Verify any schema claim against
   `C:\Users\Xander\Desktop\ops\jdd-schema\dist\site.d.ts`, never against `src/`. A new field
   needs a version bump plus a re-pin of all three consumers (§0.3). **Only two things in this
   whole plan touch `@jdd/schema`: prerequisite P4, which tags the existing v2.2 work as
   `v1.20.0`, and Phase 13, which adds the three decision-29 intake fields and takes `v1.21.0`.
   Nothing in Phases 0 to 12 requires a schema change.** If you find yourself wanting one inside
   a phase, you have gone outside the plan: stop and escalate.
4. **Never round-trip a source file through PowerShell `Get-Content` / `Set-Content`.** It
   produces silent UTF-8 mojibake that `tsc` will not catch. Use the Write and Edit tools.
5. **Do not run `next dev --turbo` on the console.** Turbopack breaks `intake.ts` client-schema
   loading. A Turbopack stale CSS cache also survives a full restart; only deleting
   `console/.next` clears it. If a CSS change you just made is missing from the dev server,
   delete `console/.next` before investigating anything else.
6. **`console/src/lib/pages.ts` and `console/src/lib/verticals.ts` are imported by client
   components.** Never add `node:fs`, never add `server-only`, never import `@/lib/export` into
   either.
7. **Component `meta.id`, `meta.category`, `meta.consumes` and `meta.skins` must never change
   while restructuring a component.** The studio registry and the exporter read all four. You may
   ADD fields to `meta` (Phase 4 adds two).

### 0.3 The release-and-repin loop

Two shared packages live outside `jdd-ops` as far as npm is concerned, and both are consumed by
pinned git tags. Editing their source and running a build proves nothing until they are released
and re-pinned, because the consumers read `node_modules`, not the working tree.

#### 0.3a `@jdd/ui`

`C:\Users\Xander\Desktop\ops\jdd-ops\packages\ui` is a **separate git repository** nested inside
the `jdd-ops` working tree. Verified state on 2026-10-05:

- remote `origin` = `https://github.com/JuneauDigitalDesigns/jdd-ui.git`
- existing tags: `v1.0.0`, `v1.0.1`, `v1.0.2`
- `package.json` `"version": "1.0.2"`, `"files": ["src"]`, `"type": "module"`, subpath exports for
  `./color ./palette ./skins ./motion ./icons ./img ./merge ./LeadForm`
- the package ships **source**, not a compiled `dist`. Both `console/next.config.js` and
  `template/next.config.js` carry `transpilePackages: ['@jdd/ui']` because of this. Do not add a
  build step; do not add a `dist`.
- consumers: `console/package.json` and `template/package.json` both pin
  `"@jdd/ui": "github:JuneauDigitalDesigns/jdd-ui#v1.0.2"`. Every exported client repo inherits
  the template's pin through `mergePackageJson`.
- **the working tree is dirty**: `git diff` in `packages/ui` shows an uncommitted 39-line addition
  to `src/palette.ts` adding `SectionStyleLike` and `sectionVars`. Prerequisite P3 names it;
  **Phase 2's §2b deletes it** and the `v1.0.3` tag carries the deletion. Do not commit it, and
  do not let an earlier tag pick it up.
- because `packages/ui` is gitignored by jdd-ops (`.gitignore:24`) and is its own repo, `git
  status` from the jdd-ops root reports a misleadingly clean tree. Always check from inside the
  package.

**The loop. Run it exactly, every time a phase says "run the §0.3 loop and tag vX.Y.Z".**

```
# 1. typecheck the package on its own
cd /c/Users/Xander/Desktop/ops/jdd-ops/packages/ui
npm run typecheck

# 2. bump the version IN package.json to the tag you are about to cut (edit the file, do not
#    use `npm version`, which creates its own commit and tag with a different message shape)

# 3. commit and tag
git add -A
git commit -m "<what changed>"
git tag vX.Y.Z
git push origin HEAD --tags

# 4. re-pin BOTH consumers. The explicit tagged install is mandatory: a plain `npm install`
#    honours the lockfile, which already resolved the OLD tag to a commit sha, so package.json
#    would say the new version while node_modules stayed on the old one.
cd /c/Users/Xander/Desktop/ops/jdd-ops/console
npm install "github:JuneauDigitalDesigns/jdd-ui#vX.Y.Z"
cd /c/Users/Xander/Desktop/ops/jdd-ops/template
npm install "github:JuneauDigitalDesigns/jdd-ui#vX.Y.Z"

# 5. prove it landed in both trees
grep '"version"' /c/Users/Xander/Desktop/ops/jdd-ops/console/node_modules/@jdd/ui/package.json
grep '"version"' /c/Users/Xander/Desktop/ops/jdd-ops/template/node_modules/@jdd/ui/package.json
#    both must print X.Y.Z

# 6. both builds, in this order
cd /c/Users/Xander/Desktop/ops/jdd-ops/console  && npm test && npm run build
cd /c/Users/Xander/Desktop/ops/jdd-ops/template && npm run build
```

There is no `check-pins` script for `@jdd/ui`; step 5 is the check. If step 5 prints the old
version, the install did not re-resolve: delete the `@jdd/ui` entry from that repo's
`package-lock.json` and re-run step 4 for that repo only.

**The tag sequence this whole plan uses.** One release per phase that touches
`packages/ui/src/**`, and no others:

| Tag | Phase | What it carries |
|---|---|---|
| v1.0.3 | **Phase 2** | warm palette defaults, deletion of the unpublished `sectionVars` |
| v1.0.4 | Phase 6 | motion deprecations |
| v1.0.5 | Phase 7 | five new `SKINS` entries |
| v1.0.6 | Phase 8 | seven new `SKINS` entries |
| v1.0.7 | Phase 11 | the `img.ts` local-asset branch |

Phases 0, 1, 3, 4, 5, 9, 10, 12 and 13 do not touch `packages/ui/src` and must not cut a tag.

#### 0.3b `@jdd/schema`

`C:\Users\Xander\Desktop\ops\jdd-schema`, its own git repo. **Tag `v1.19.1` was the newest before
this upgrade; prerequisite P4 cuts `v1.20.0` and Phase 13 cuts `v1.21.0`. Those are the only two
schema releases in this plan.** It has **three** consumers, enumerated by
`console/scripts/check-pins.mjs`:

1. `C:\Users\Xander\Desktop\ops\jdd-ops\console\package.json`
2. `C:\Users\Xander\Desktop\ops\jdd-ops\package.json`
3. `C:\Users\Xander\Desktop\ops\juneau-digital-designs\package.json`

Unlike `@jdd/ui`, this package ships a compiled `dist` and consumers read only `dist`. So the loop
adds a build:

```
cd /c/Users/Xander/Desktop/ops/jdd-schema
npm run build            # rebuilds dist/, the only thing consumers read
npm test
#  bump package.json version, commit, tag vX.Y.Z, push with --tags
#  then, in EACH of the three consumer roots:
npm install "github:JuneauDigitalDesigns/jdd-schema#vX.Y.Z"
cd /c/Users/Xander/Desktop/ops/jdd-ops/console && npm run check-schema
```

`npm run check-schema` must end with
`@jdd/schema pinned and installed consistently at <spec>.`

**The failure the prerequisites fix, recorded so nobody re-diagnoses it.** Before P2 and P4,
`npm run check-schema` failed:

```
· console  file:../../jdd-schema  (installed 1.19.1)
· jdd-ops  github:JuneauDigitalDesigns/jdd-schema#v1.18.0  (installed 1.18.0)
· agency   github:JuneauDigitalDesigns/jdd-schema#v1.18.0  (installed 1.18.0)
✖ @jdd/schema pins diverge across 3 consumers.
```

The console was on a `file:` link to the local working copy at 1.19.1 while the other two were on
the v1.18.0 tag. `check-pins.mjs` compares the raw pin STRINGS, so a `file:` spec can never agree
with a `github:` spec and the check could never go green while it stood. **P4 then P2 fix this,
before Phase 0**, landing all three consumers on `github:...#v1.20.0`. From Phase 0 onward
`check-schema` is a live gate, not a known-red one: if it goes red inside a phase, that phase
broke it.

**The one schema release left in the plan is Phase 13's `v1.21.0`**, which adds `ownerName`,
`brandsCarried` and `responseTime` to `ExtensionsContent`. `v1.20.0` is consumed by P4 and must
not be reused. **Phases 0 to 12 do not touch the pin.**

**The tag sequence, complete:**

| Tag | Owner | What it carries |
|---|---|---|
| v1.19.1 | pre-existing | the state before this upgrade |
| **v1.20.0** | **prerequisite P4** | the uncommitted v2.2 work: `detail`, `story`, `SectionStyle`, `PageHeaderContent`, `SubpageContent`, `subpages` |
| **v1.21.0** | **Phase 13** | the three decision-29 intake fields |

### 0.4 The console preview pane is hidden, so screenshots lie

The console's browser preview (`PreviewFrame`, the `/c/<slug>/build` studio, and any screenshot
tool pointed at it) runs with `document.visibilityState === 'hidden'`. Consequences, all measured:

- **`framer-motion` animations never run.** Anything whose resting state is
  `initial={{ opacity: 0 }}` renders invisible and stays invisible. It is not a bug in your
  component.
- **CSS `transition` and `animation` do not advance.** Hover and entrance states freeze at their
  start value.
- **Screenshots of the preview pane are therefore not evidence.** A blank or half-rendered
  section in a preview screenshot tells you nothing about the exported site.

**Rules.**

1. Verify visual work by **DOM inspection** (read the rendered element's class list and computed
   styles) or by **`tsc` / `npm run build`**, never by a preview screenshot.
2. To read a settled value that a transition is holding hostage, inject
   `* { transition: none !important; animation: none !important; }` before reading.
3. For anything whose whole point is motion or scroll behaviour (the sticky call bar, smooth
   scroll, a pin-scroll section), verify in a **real browser against the template dev server**:
   `cd template && npm run dev`, then `http://localhost:3000`. That is the only surface where
   motion actually runs.
4. **Never run `next build` over a live dev server** in the same directory. The two fight over
   `.next` and you get a corrupted build with errors that describe nothing real. Stop the dev
   server first.

### 0.5 Every component-registration touchpoint

This is the complete list, derived by reading the code on 2026-10-05. When a phase says "register
per §0.5", it means walk this list and action every row that applies. A missed row does not fail
the build; it makes the studio offer something the exporter rejects, or makes a component
invisible in the studio, which is how the `*Starter` variants broke.

| # | File | What to change | When |
|---|---|---|---|
| 1 | `console\src\lib\export.ts` → `CATALOG` (line ~43) | add the component name to its category's array | **every new component** |
| 2 | `console\src\lib\export.ts` → `BODY_SLOTS` (line 64) | add the category id, in researched page order | **new category only** |
| 3 | `packages\ui\src\skins.ts` → `SKINS` | add `Name: [DEF, SOFT, …]`, then run the §0.3 loop | **only if the component takes a `skin` prop** |
| 4 | `console\src\app\c\[slug]\build\categories.tsx` | the default import plus `{ meta as xMeta }`, and one `VariantEntry` row inside the right `CategoryEntry.variants` array | **every new component** |
| 5 | same file, `CategoryEntry['id']` union (line 52) | add the new category id literal | **new category only** |
| 6 | same file, `iconName` union (line 54) | add the icon name literal | **new category only** |
| 7 | same file, a new `CategoryEntry` object in `buildCategories`' returned array, positioned in researched page order | the whole `{ id, label, iconName, variants }` object | **new category only** |
| 8 | `console\src\app\c\[slug]\build\page-order.ts` → `CANONICAL_ORDER` | add the category id in page order | **new category only** |
| 9 | `console\src\app\c\[slug]\build\nav-targets.ts` → `TARGETS` | add `{ categoryId, anchor, label }` | **only if the component renders a DOM `id` the site nav may link to** |
| 10 | `console\src\app\c\[slug]\build\page-templates.tsx` → `PAGE_TEMPLATES` | place the component in at least one template | **every new component**, or the studio never surfaces it outside the raw picker |
| 11 | `console\src\app\c\[slug]\build\compose-page.tsx` → `renderSection` | add a branch | **`pageHeader` variants only.** This function hardcodes `PageHeaderSimple` for the whole `pageHeader` category (line ~40), so a new page-header variant renders as `PageHeaderSimple` in the studio until this is changed |
| 12 | `console\src\lib\export.ts` → `wirePages`' `pageHeader` branch (line ~626) | construct the chosen variant, not a hardcoded one | **`pageHeader` variants only** |
| 13 | `console\src\lib\pages.ts` → `PageTypeId` | add the literal | **new page TYPE only**, not a new component |
| 14 | `template\src\lib\**` | if the component imports a helper from `@/lib/x`, that helper must exist in `template/src/lib/`, not only in `console/src/lib/` | **new shared helper only** |
| 15 | `console\tsconfig.json` → `include` | add the explicit `../template/src/...` path | **only when the CONSOLE imports a template-owned file directly** (currently only `structuredData.ts`) |
| 16 | `console\tailwind.config.ts` → `content` | ensure the glob covers the file | **only for template-owned files carrying Tailwind classes**; Phase 1 adds the `../template/src/lib/**` glob once |

**Things that look like touchpoints and are not.** Verified by grep, do not change these for a new
component or category:

- `console\src\app\api\build\source\route.ts` imports `CATALOG` from `@/lib/export`. No second copy.
- `console\src\lib\skins.ts` is a four-line re-export shim of `@jdd/ui/skins`, kept at that path so
  `verifyCatalogImports` finds it. Never add a `SKINS` literal here.
- `template\src\app\page.tsx` uses category-agnostic `@studio:imports` / `@studio:metadata` /
  `@studio:body:start` / `@studio:body:end` markers. No per-category edit.
- `console\src\lib\copy-schema.ts`, `console\src\lib\copy-brief\*`,
  `console\src\components\wizard\CopyWireframe.tsx` and `console\src\lib\section-labels.ts` are
  keyed by **content section** (the `SiteContent` slice), not by catalog category. A component that
  reads an existing schema slice needs no change in any of them.
- `console\src\app\c\[slug]\build\categories.tsx`'s `iconName` has **no resolver**. Grep for
  `Compass` across `console/src` returns only the union and the literals themselves. Extending the
  union is a type-only edit today; if a later phase tells you to "add the new cases to the icon resolver",
  the correct action is to note that no resolver exists.
- `console\test\catalog-invariants.test.mjs` derives its expectations from `CATALOG`, the registry
  file and the real `SKINS` object. You never edit it to register a component; it simply fails
  until rows 1, 3 and 4 agree.

### 0.6 The vertical-language escalation rule

Decisions 35 and 37 are in tension, and the Known Tensions section of
`DECISIONS-template-fidelity-v2.md` names the mitigation: a vertical's design language must stay a
**thin layer** over one shared foundation. The `VerticalLanguage` type (Phase 12) has exactly
four axes, deliberately: type pairing, palette, photography direction, rhythm preference. There is
no field that can name a component or a vertical-private page template.

**The tripwire.** If, while building a vertical, a section appears to need its own component, that
is a signal the shared foundation is too thin. It is not a signal to add a field.

**The rule, in priority order:**

1. **Stop.** Do not add a field to `VerticalLanguage`. Do not add a vertical-private page
   template. Do not create `components/catalog/<category>/<Vertical><Name>.tsx`.
2. Ask whether an existing archetype, re-skinned and fed this vertical's own content, does the
   job. In almost every case it does, because the content differs and the structure does not.
3. If it genuinely does not, the fix is to **generalise the needed thing into the shared catalog**
   as a new archetype available to every vertical, which means it belongs in a catalog wave
   (Phase 7 or 8), not in the vertical's phase.
4. **Escalate to the user** before doing step 3. Report: the vertical, the section, the archetype
   you tried, why it failed, and the shared component you propose instead. The user decides
   whether the foundation gets widened. This is a planning decision, not an implementation one.

`console/test/vertical-language.test.mjs` (Phase 12) makes clauses 1 and 3 mechanical: it
asserts that `Object.keys(VERTICAL_LANGUAGES.hvac)` is exactly
`['pairingId','palette','photography','rhythm']`, and that the set of page-template ids referenced
by all verticals is a subset of `PAGE_TEMPLATES`. Both fail the moment someone widens the type or
adds a private template.

### 0.7 Phase hygiene

- **`P1` to `P4` always mean the four PREREQUISITES in this document, never phases.** Phases are
  always written out as `Phase 4`, `Phase 11`, and so on. The old shorthand where `P7` meant
  Phase 7 is gone, because it collided with the prerequisite numbering the moment the schema tag
  became P4.
- Prerequisites P1 to P4 run first, in the order P1, P4, P2, P3. Then Phase 0.
- Work one phase at a time, in order, except where the dependency graph at the end of this
  document marks two as parallel (Phase 4 alongside Phases 1 to 3; Phase 11 alongside Phases 7
  and 8).
- Every phase ends with the build gate written in its Verification block. Do not start the next
  phase on a red gate.
- `cd` paths in this plan are written in the Git Bash form (`/c/Users/Xander/...`). The Bash tool
  takes them verbatim. If you use the PowerShell tool instead, convert to `C:\Users\Xander\...`.
- When a phase says "the user looks at X", say so explicitly in your report and name the URL,
  file path, or screen. Decision 33 requires something lookable-at per phase.

---

## Phase 0: make the documentation true before anything is built from it

**Goal:** remove the single highest hallucination risk in the codebase, so no later phase can be
told to "match a file that does not exist".
**Discharges:** G5, decision 42; research §8 item 9. Prepares decisions 21, 23.

`console/DESIGN-LANGUAGE.md` cites seven reference implementations that are **not in the repo**,
and claims five services variants where three exist. An executor told to match
`services/ServicesShowcase.tsx` will invent it. This phase is documentation only: no `.tsx`
changes, no token changes, no build behaviour changes.

### 0.A Verify the claim before you edit (do this first, do not trust this plan)

```
cd /c/Users/Xander/Desktop/ops/jdd-ops/console/src/components/catalog
ls services/ work/ testimonials/
```
Expected on 2026-10-05, and what the rest of this plan assumes: **30 components in 15
categories**, specifically

```
about/        AboutFeature, AboutStory
contact/      ContactCardOverlap, ContactInlineStrip, ContactSplit
faq/          FaqAccordion, FaqStickyAside
finalCta/     FinalCtaBanner, FinalCtaSimple, FinalCtaSplit
footer/       FooterColumns, FooterMinimal
hero/         HeroFormFocus, HeroOverlap, HeroSplit
nav/          NavEmergencyBar, NavMinimal
pageHeader/   PageHeaderSimple
seo/          SeoDefault, SeoLocalBusiness
services/     ServicesAccordion, ServicesGrid, ServicesPanel
testimonials/ TestimonialsCarousel, TestimonialsGrid
trust/        ServiceArea, TrustBadges, TrustReviewsAggregate
work/         BeforeAfter, RecentJobsGrid
```
and these seven files **absent**: `services/ServicesShowcase.tsx`,
`services/ServicesSpotlight.tsx`, `work/WorkSpotlight.tsx`, `work/WorkGrid.tsx`,
`work/WorkMasonry.tsx`, `testimonials/TestimonialsRotator.tsx`, and any testimonials marquee.

If the listing differs from the above, **stop and report the difference**. The archetype table you
are about to write, and Phase 4's lint that enforces it, both depend on this exact set.

### Files modified

#### `C:\Users\Xander\Desktop\ops\jdd-ops\console\DESIGN-LANGUAGE.md`

Rewrite the **Structural archetypes** table and the **Per-category guidance** section so every
reference points at a file that exists today, and every archetype id matches the vocabulary
Phase 4 introduces. Keep the opening principle ("recompose the layout, don't decorate the grid")
verbatim: it is correct and matches Tier B.

Replace the existing archetype table with the following **reconciled archetype table**. The
`Status` column is the only honest way to carry the aspiration without lying about the present.
`Built by` names the phase, which is why this table can only be written now.

| Archetype id | What it is | Reference implementation | Status |
|---|---|---|---|
| `asymmetric-split` | Dominant panel bleeding off-edge against a constrained column | `hero/HeroSplit.tsx` | built |
| `form-led-split` | Split whose dominant side is the lead form, not media | `hero/HeroFormFocus.tsx` | built |
| `full-bleed-overlay` | Edge-to-edge photograph with copy laid over a flat scrim | `hero/HeroOverlap.tsx` | built |
| `card-grid` | Uniform cards over the client's full, variable-length list | `services/ServicesGrid.tsx` | built |
| `sticky-swap` | Controlled list on one side, a sticky panel that follows the active item | `services/ServicesAccordion.tsx`, `faq/FaqStickyAside.tsx` | built |
| `dense-mosaic` | Multi-column `grid-flow-dense` with deliberately varied spans | `services/ServicesPanel.tsx`, `testimonials/TestimonialsGrid.tsx` | built |
| `accordion` | Disclosure list, no media panel | `faq/FaqAccordion.tsx` | built |
| `snap-carousel` | Horizontal scroll with `scroll-snap`, user-driven only | `testimonials/TestimonialsCarousel.tsx` | built |
| `count-up-centerpiece` | Centred statement plus media plus stats that count on view | `about/AboutFeature.tsx` | built |
| `before-after` | Paired comparison of one job | `work/BeforeAfter.tsx` | built |
| `overlap-split` | Two panels overlapping via negative margin | `contact/ContactCardOverlap.tsx`, `finalCta/FinalCtaSplit.tsx` | built |
| `inline-strip` | A single-row band of short facts, no cards | `trust/TrustBadges.tsx`, `contact/ContactInlineStrip.tsx`, `footer/FooterMinimal.tsx` | built |
| `aggregate-badge` | One rating plus count plus locality, as the whole section | `trust/TrustReviewsAggregate.tsx` | built |
| `map-list` | Named places as a list beside a locality graphic | `trust/ServiceArea.tsx` | built |
| `full-bleed-band` | One edge-to-edge statement plus one action | `finalCta/FinalCtaBanner.tsx` | built |
| `centered-statement` | Centred heading plus sentence, no media | `finalCta/FinalCtaSimple.tsx`, `pageHeader/PageHeaderSimple.tsx` | built |
| `column-grid` | Link columns, footer only | `footer/FooterColumns.tsx` | built |
| `sticky-bar` | Scroll-reactive top bar | `nav/NavMinimal.tsx` | built |
| `stacked-bars` | Two stacked bars, availability strip over nav | `nav/NavEmergencyBar.tsx` | built |
| `editorial-index` | Full-width numbered rows on hairline rules, imagery revealing on hover | `services/ServicesShowcase.tsx` | **not built, Phase 7** |
| `stacked-panels` | Full-width horizontal panels, one column, hierarchy from panel height | `services/ServicesSpotlight.tsx` | **not built, Phase 7** |
| `feature-rail` | Large feature panel plus a rail of all items; picking one swaps the feature | `work/WorkSpotlight.tsx` | **not built, Phase 7** |
| `horizontal-pin` | Section pins to the viewport while content scrolls sideways | `work/WorkMasonry.tsx` | **not built, Phase 7** |
| `marquee` | A drag and scroll driven rail, no autoplay | `testimonials/TestimonialsMarquee.tsx` | **not built, Phase 7** |
| `hero-first-grid` | CSS grid whose first cell spans two rows and two columns | `work/RecentJobsGrid.tsx` | **recomposed in Phase 7**; today it is `card-grid` |
| `numbered-ledger` | Figures as a numbered ledger on rules, not as cards | `stats/StatsLedger.tsx` | **not built, Phase 8** |
| `none` | Non-visual; emits metadata or JSON-LD only | `seo/SeoDefault.tsx`, `seo/SeoLocalBusiness.tsx` | built |

Then make these specific corrections in the same file:

1. **Delete the claim of "five services variants."** The line currently reads "the five services
   variants are Feature+Rail, Editorial Index, Stacked Panels, Dense Mosaic, Split Accordion."
   Replace with: "Today services carries three variants: `card-grid` (`ServicesGrid`),
   `sticky-swap` (`ServicesAccordion`) and `dense-mosaic` (`ServicesPanel`). Phase 7 of
   `design/PLAN-template-fidelity-v2.md` adds `editorial-index` and `stacked-panels`."
2. **Delete the `work/WorkGrid.tsx` and `testimonials/TestimonialsRotator.tsx` rows entirely.**
   **This is decision 42, and it is a deletion, not a deferral: neither component is ever built
   by this plan.** `RecentJobsGrid` is recomposed into the `hero-first-grid` archetype in Phase 7,
   so a `WorkGrid` would be a second `card-grid` in `work`; `TestimonialsCarousel` already fills
   the rotator slot as `snap-carousel`, so a `TestimonialsRotator` would be a second one in
   `testimonials`. Either would be a **duplicate archetype within a category, which is exactly
   what Phase 4's collision lint rejects**: the build would fail, not merely look redundant. Phase
   7 ships `TestimonialsMarquee` as the third testimonials archetype instead of a rotator.

   Add a one-line note in `DESIGN-LANGUAGE.md` saying so, next to the archetype table, so a
   future reader does not re-add them:

   ```
   `WorkGrid` and `TestimonialsRotator` were cited here before 2026-10-05 and are deliberately
   NOT in the table: decision 42. RecentJobsGrid became `hero-first-grid` and
   TestimonialsCarousel already owns `snap-carousel`, so either one would collide within its
   category and fail console/test/catalog-invariants.test.mjs.
   ```

   **Then check the reconciled table against reality.** Every row whose Status is "built" must
   name a file that exists today, and every row whose Status is "not built" or "recomposed" must
   name a file some phase in this plan actually creates or rewrites. The table above is already
   reconciled that way: the six "not built" rows are `ServicesShowcase`, `ServicesSpotlight`,
   `WorkSpotlight`, `WorkMasonry`, `TestimonialsMarquee` (all Phase 7) and `StatsLedger` (Phase
   8), plus `RecentJobsGrid` recomposed in Phase 7. There is **no row for `WorkGrid`, no row for
   `TestimonialsRotator`, and no row for any component no phase builds.** If you find one, that is
   the bug this step exists to catch.
3. **Remove `Rotator` from the per-category guidance for testimonials.** The three testimonials
   archetypes after Phase 7 are `dense-mosaic`, `snap-carousel`, `marquee`.
4. **Correct the Feature+Rail reference.** It currently points at `services/ServicesGrid.tsx`,
   which was recomposed away from Feature+Rail on 2026-08-19 (its own file header says so).
   `feature-rail`'s only reference is `work/WorkSpotlight.tsx`, built in Phase 7.
5. **Update the Motion & interactivity section** to match decisions 26 and 28: the budget is
   **one or two signature moments per PAGE**, not per section; micro-reveals stay free; cursor
   glow and `parallaxY` are **cut** as ornamental. Note that `parallaxY` stays exported from
   `@jdd/ui/motion` for back-compat (decision 3) but must not be used in new components.
6. **Update the editorial-print signature section** for decision 10: the hairline eyebrow's rule
   and the heavy numerals go **neutral**, not accent. Accent is reserved for the primary CTA and
   for genuine urgency. Replace `bg-accent` with `bg-rule` in the eyebrow snippet and "dim
   inactive, accent active" with "dim inactive, full-ink active".
7. **Delete the `tracking-[-0.03em]` and `tracking-[0.24em]` snippets.** Both are already banned:
   `console/test/catalog-invariants.test.mjs` fails any file containing `tracking-[0.2`, and
   SPEC §3 sets display tracking at `-0.015em`. Point at Phase 1's `tracking-tight` and
   `tracking-display` tokens instead.
8. **Add a header block at the top of the file**:

   ```
   > Reconciled 2026-10-05 against the files actually in the repo (Phase 0 of
   > `design/PLAN-template-fidelity-v2.md`). Before this pass, seven of the reference
   > implementations named here did not exist. If you are about to "match" a file this document
   > names, `ls` it first. Archetype ids are the same vocabulary as `src/lib/archetypes.ts` and
   > each component's `meta.archetype`; `console/test/catalog-invariants.test.mjs` enforces that
   > no two variants in one category share an archetype.
   ```

#### `C:\Users\Xander\Desktop\ops\jdd-ops\design\catalog-v2\SPEC.md`

Add, at the end of §9 (Motion), a **decision-18 amendment note**, verbatim:

```
### §9 amendment, 2026-10-05 (decision 18)

The "Cut entirely" list above bans count-up stats. Decision 18 of
`console/design/DECISIONS-template-fidelity-v2.md` reverses that for ONE case: a dedicated stats
band is now a first-class section category and it DOES count up. The reasoning for the original
cut was that `AboutFeature`'s count-up fired above the fold and competed with LCP; a stats band
sits mid-page, below the fold, so that reasoning does not apply to it.

Scope of the amendment, which is narrow on purpose:
  • `stats/StatsBand.tsx` may count up. It is the only component that may.
  • It must gate on `stillFor(skin, reduce)` and render the final value immediately when still.
  • Everything else in §9 stands, including the autoplay ban: `testimonials/TestimonialsMarquee`
    is drag and scroll driven, with no `setInterval`.
  • Nothing above the fold animates on load. That rule is measured (see PERF.md) and is not
    amended.
```

Do not edit any other part of SPEC.md. §1, §4, §7, §10 and §10a are cited by later phases and must stay
as they are.

#### `C:\Users\Xander\Desktop\ops\jdd-ops\studio\catalog\COMPONENTS.md`

This file still describes a 16-component, 2-variants-per-category v1 target and a File System
Access API export flow that no longer exists. Replace its body with a six-line pointer so nobody
builds from it:

```
# Component backlog (superseded)

The live catalog is `console/src/components/catalog/**`, registered per
`design/PLAN-template-fidelity-v2.md` §0.5. The authoring rules are in
`AUTHORING_CONTRACT.md` in this folder. The archetype vocabulary and per-category coverage targets
are in `console/DESIGN-LANGUAGE.md`. The build-out plan is
`console/design/PLAN-template-fidelity-v2.md`.

This file described a 16-component v1 and an export flow that no longer exists. Kept as a stub so
its path does not 404 from older notes.
```

Leave `AUTHORING_CONTRACT.md` alone. It is correct, it is self-contained, and later phases cite its §0,
§5 and §10 by number.

### Files created

#### `C:\Users\Xander\Desktop\ops\jdd-ops\console\design\foundation-v2\NOTES.md`

The running record for this upgrade. Create the folder. Seed it with:

- **the outcome of all four prerequisites**, one line each, including the `v1.20.0` tag sha and
  the `check-schema` output after P2 (if you have not already written these while running them);
- the four-command known-green baseline from §0.1 and its results;
- the verified catalog inventory from step 0.A, as a fenced block;
- the reconciled archetype table (copy it, so Phase 4 has a single place to transcribe from);
- the decision-18 amendment note and where it was filed;
- the decision-42 note that `WorkGrid` and `TestimonialsRotator` are deleted, not deferred;
- a one-line entry per phase as you complete it, recording the `@jdd/ui` tag cut (if any) and
  anything you had to decide that this plan did not specify. The smooth-scroll library is **not**
  one of those things: decision 54 settles it as Lenis and Phase 6 has exactly one path.

### Verification

```
cd /c/Users/Xander/Desktop/ops/jdd-ops/console && npm test && npm run build
```
Both must still pass: this phase changes no code, so a failure means you edited a `.tsx` by
mistake. Then prove the doc is true:

```
cd /c/Users/Xander/Desktop/ops/jdd-ops
# every .tsx path named in DESIGN-LANGUAGE.md must exist OR be marked "not built"
grep -oE '`[a-zA-Z]+/[A-Za-z]+\.tsx`' console/DESIGN-LANGUAGE.md | tr -d '`' | sort -u | \
  while read p; do [ -f "console/src/components/catalog/$p" ] && echo "OK   $p" || echo "MISS $p"; done
```
Every `MISS` line must correspond to a row whose Status column says "not built, Phase 7" or
"not built, Phase 8". There must be no `MISS` for a row marked "built".

**User looks at:** `console/DESIGN-LANGUAGE.md` rendered, specifically the archetype table's
Status column, and `console/design/foundation-v2/NOTES.md`.

### Out of scope

Any `.tsx` change. Any token, palette or font change. Building any of the seven missing components
(Phase 7 and Phase 8 own those). Trimming the aspiration out of `DESIGN-LANGUAGE.md`: decision 21
says the doc becomes true by the components being built, not by the ambition being deleted.

---

## Phase 1: the exported template gets a real token layer

**Goal:** the thing we ship to clients gains a type scale, spacing scale, radius scale, shadow
scale and tracking scale, from one source that both the preview and the export read, so they
cannot drift.
**Discharges:** G2; decisions 4, 8, 24. Prepares 30(d).

This is decision 4's first move and research §8 item 4 calls it the highest-leverage single change.
`template/tailwind.config.ts` currently extends **only** `colors`, `textColor.accent`, `fontFamily`
(sans, heading) and one `backgroundImage` (`accent-grad`). There is no `fontSize`, `spacing`,
`borderRadius`, `boxShadow`, `letterSpacing` or `maxWidth`. Every size, gutter and radius in the
catalog is an inline arbitrary value decided per component, which is the mechanical reason
components drift as they are edited.

**Read before editing:** `template/tailwind.config.ts`, `console/tailwind.config.ts` (both in
full, including the comment blocks, which explain the two token worlds), and
`design/catalog-v2/SPEC.md` §3 and §5, which contain the measured scale this phase encodes.

**The two token worlds, which you must not conflate.** `console/tailwind.config.ts`'s header says
it and it is still true:

- **Client-brand tokens** (`accent`, `bg`, `bgSoft`, `ink`, `inkSoft`, `rule`, `accent050`,
  `inkPanel`, `onInk`, `urgent`, and the `font-sans` / `font-heading` families) bind to CSS
  variables set per previewed route from `CONTENT.brand`. They are reserved for catalog preview
  components. A client may have a dark palette and that must keep rendering.
- **Console chrome tokens** (`surface`, `panel`, `fg*`, `ui*`, `font-chrome`, `font-display`,
  `shadow-raised|panel|overlay|floating`, `rounded-xl2|panel`, and the whole `fontSize` scale with
  its 14px body floor) are the console's own UI. The console is light-only warm cream. Never unify.

The new sizing tokens this phase adds are a **third** set: they belong to the client-brand world,
they are named so they cannot collide with the chrome `fontSize` keys (`sm`, `base`, `lg`, `xl`,
`label`, `kicker`, `meta`), and they are consumed only by catalog components. The console must gain
them so the studio preview renders the same sizes the export will.

**Note on `textColor.accent`.** Both configs remap `text-accent` to
`var(--accent-text, var(--accent))`. In the **console** the `var(--accent)` fallback is
load-bearing: `--accent-text` is only set where `paletteVars()` is applied (the `/build` preview
subtree), but console chrome also uses `text-accent` (the icon picker), so without the fallback
those chrome elements resolve an undefined var. In the **template** every element that can use
`text-accent` is inside the `<body>` that carries `paletteVars()`, so the fallback is belt and
braces rather than load-bearing. Leave both exactly as they are.

### Files created

#### `C:\Users\Xander\Desktop\ops\jdd-ops\template\src\styles\tokens.ts`

The shared token source. **Both** `template/tailwind.config.ts` and `console/tailwind.config.ts`
import from it, which is the whole point: preview and export cannot drift because there is one
file. It lives under `template/src/styles/` because `TEMPLATE_OWNED_PREFIXES` in
`console/src/lib/export.ts` is `['src/lib/', 'src/styles/']`, so an export with `overwrite: true`
refreshes it into every client repo. `tailwind.config.ts` is in `TEMPLATE_OWNED_FILES`, so the
config that imports it is refreshed in the same pass and the pair can never land half-updated.

The module must be **dependency-free**: no imports at all, no `type { Config }`, plain exported
object literals. It is loaded by Tailwind's config loader (jiti) from two directories and by `tsc`
in two projects.

```ts
/**
 * THE shared design tokens for every client site.
 *
 * Imported by BOTH template/tailwind.config.ts and console/tailwind.config.ts, so the studio
 * preview and the exported site resolve identical sizes. Before this file existed, the template
 * had no scale at all (only fontFamily and one backgroundImage), so every size, gutter, radius and
 * shadow in the catalog was an inline arbitrary value decided per component. That is gap G2 in
 * design/RESEARCH-local-service-visual-design.md and it is the mechanical reason components drift
 * as they are edited.
 *
 * Lives under src/styles/ so TEMPLATE_OWNED_PREFIXES refreshes it into client repos on an
 * `overwrite` export, in the same pass as the tailwind.config.ts that imports it.
 *
 * DEPENDENCY-FREE on purpose: loaded by Tailwind's jiti config loader from two different
 * directories. No imports, no types from tailwindcss.
 *
 * Numbers come from design/catalog-v2/SPEC.md §3 (type) and §5 (buttons), which are measured
 * against a 390px phone and a 1000px+ desktop, not invented here.
 */

/* ── Type scale ───────────────────────────────────────────────────────────────
   Fluid clamp() per decision 8, with negative tracking baked into the large steps so a display
   size is never set without its tracking. Tailwind fontSize entries are
   [size, { lineHeight, letterSpacing, fontWeight? }].

   Key names are deliberately NOT Tailwind's sm/base/lg/xl: the console's own chrome owns those
   keys with a 14px body floor, and these two scales must not collide. */
export const fontSize = {
  // 36px at 390 -> 58px at 1000+, capped. SPEC §3's h1. "Names the service and the city."
  'display-1': ['clamp(2.25rem, 1.42rem + 3.60vw, 3.625rem)', { lineHeight: '1.02', letterSpacing: '-0.022em' }],
  // 32px -> 42px. SPEC §3's h2.
  'display-2': ['clamp(2rem, 1.62rem + 1.65vw, 2.625rem)',    { lineHeight: '1.06', letterSpacing: '-0.018em' }],
  // 24px -> 28px. Sub-section headings, and the large half of a two-step hierarchy inside a
  // stacked-panels or editorial-index row.
  'display-3': ['clamp(1.5rem, 1.35rem + 0.65vw, 1.75rem)',   { lineHeight: '1.12', letterSpacing: '-0.014em' }],
  // 21px fixed. SPEC §3's h3. A card title does not need to grow with the viewport.
  'card-title': ['1.3125rem', { lineHeight: '1.25', letterSpacing: '-0.010em' }],
  // 19px -> 21px. One step above body: the sticky call bar's digits, a hero sub, a pull quote.
  lead:  ['clamp(1.1875rem, 1.13rem + 0.25vw, 1.3125rem)', { lineHeight: '1.42', letterSpacing: '-0.005em' }],
  // 17px fixed. SPEC §3's body. THE workhorse.
  body:  ['1.0625rem', { lineHeight: '1.55' }],
  // 15px fixed. SPEC §3's small / proof text.
  small: ['0.9375rem', { lineHeight: '1.50' }],
  // 13px. The floor. Legal lines, the assurance line under the phone digits, meta.
  // Nothing below this, ever: the next step down is unreadable on a phone in sunlight.
  fine:  ['0.8125rem', { lineHeight: '1.45', letterSpacing: '0.010em' }],
} as const;

/* ── Tracking ─────────────────────────────────────────────────────────────────
   The old `tracking-[-0.03em]` and `tracking-[0.24em]` are both CUT (SPEC §3; the second is
   already enforced by console/test/catalog-invariants.test.mjs). These four are the whole set. */
export const letterSpacing = {
  display: '-0.022em',  // only on text already set at display-1
  tight:   '-0.015em',  // SPEC §3's heading default
  snug:    '-0.010em',
  wide:    '0.010em',   // the ONLY positive step. Not a wide-tracked uppercase eyebrow.
} as const;

/* ── Spacing ──────────────────────────────────────────────────────────────────
   Added to Tailwind's default spacing scale, not replacing it. Only the named steps a component
   should reach for; everything else stays on the stock 4px ramp.

   The `section-*` steps are consumed by rhythm.plugin.ts, which is the ONLY thing that should use
   them: section padding is decided by the page template, never by the component (decision 24). */
export const spacing = {
  gutter:        'clamp(1.25rem, 0.90rem + 1.60vw, 2rem)',  // 20px -> 32px page gutter
  'section-tight':  'clamp(1.75rem, 1.40rem + 1.60vw, 2.75rem)', // 28px -> 44px
  'section-normal': 'clamp(3rem, 2.30rem + 3.20vw, 5rem)',       // 48px -> 80px
  'section-loose':  'clamp(4.50rem, 3.30rem + 5.40vw, 8rem)',    // 72px -> 128px
} as const;

/* ── Radius ───────────────────────────────────────────────────────────────────
   SPEC §5: buttons are 8px. "Nothing is a pill; nothing is rounded-sm."
   `rounded-control` is the single radius for every button, input and tappable chip, so a client
   site cannot end up with three button shapes. */
export const borderRadius = {
  control: '8px',
  panel:   '14px',   // cards, media frames
  slab:    '2px',    // a near-square corner, for a deliberately hard-edged panel
} as const;

/* ── Elevation ────────────────────────────────────────────────────────────────
   One ladder, warm-tinted to match decision 9's warm charcoal ink. The light-surface values are
   byte-for-byte what services/ServicesGrid.tsx already inlines, so adopting the token is a visual
   no-op on that component and a correction everywhere else.

   `shadow-slab` is the card default. `shadow-slab-lift` is its hover twin. `shadow-slab-ink` is
   the inverted-surface twin, because a warm shadow is invisible on a dark panel. */
export const boxShadow = {
  slab:        '0 1px 2px rgba(28,16,9,.05), 0 14px 30px -12px rgba(28,16,9,.22)',
  'slab-lift': '0 2px 4px rgba(28,16,9,.06), 0 22px 42px -14px rgba(28,16,9,.28)',
  'slab-ink':  '0 14px 30px -12px rgba(0,0,0,.50)',
  // The offset-shadow primary CTA from DESIGN-LANGUAGE.md's editorial signature, as a token
  // rather than an inline arbitrary value. Light and inverted variants.
  offset:      '4px 4px 0 rgba(28,16,9,.85)',
  'offset-ink':'4px 4px 0 rgba(255,255,255,.12)',
} as const;

/* ── Measure ──────────────────────────────────────────────────────────────────
   Tier B's "left-aligned ragged-right text with generous margins and controlled max-widths"
   (research §5). `max-w-measure` is the one correct width for a paragraph. */
export const maxWidth = {
  measure: '46ch',
  content: '72rem',   // the page container, matching the catalog's existing max-w-6xl
} as const;
```

#### `C:\Users\Xander\Desktop\ops\jdd-ops\template\src\styles\rhythm.plugin.ts`

A Tailwind plugin emitting the five rhythm classes that Phase 9 applies. Decision 24:
**section rhythm is encoded at the page-template level, not inside components.** The exporter wraps
each section in a `<div className="rh-*">`; this plugin is what makes that wrapper mean something.

Why a plugin and not utilities in `tokens.ts`: the padding has to **override** the component's own
`py-14 lg:py-20`. Tailwind utilities and plugin utilities sit in the same layer with unreliable
source order, so the override is explicit `!important` on the padding only, which is correct here:
the page template is the higher authority over the component, and that is exactly what decision 24
says.

```ts
/**
 * The section-rhythm utilities, `rh-bleed | rh-tight | rh-normal | rh-loose | rh-text`.
 *
 * Decision 24 of console/design/DECISIONS-template-fidelity-v2.md: rhythm is decided by the PAGE
 * TEMPLATE, never by the component. Research §6 item 8 names uniform section rhythm as one of the
 * eight things that make a site read as AI-made, and decision 30(d) bans it outright. A component
 * cannot see a whole page, so it cannot be the thing that varies.
 *
 * How it is applied: console/src/lib/export.ts's wirePages wraps a section in
 * `<div className="rh-loose">`, and PageStudio's SectionShell applies the same class so the
 * preview and the export agree. The wrapper has exactly one child, which is the component's root
 * element (a <section>, or <header>/<footer> for chrome), hence the `> *` selector.
 *
 * The `!important` is deliberate and is the only one in the system: catalog components carry their
 * own `py-14 lg:py-20`, and the page template has to win. Only padding-block is forced; nothing
 * else about the component is touched.
 */
import plugin from 'tailwindcss/plugin';
import { spacing } from './tokens';

export default plugin(({ addUtilities }) => {
  const band = (v: string) => ({ paddingBlock: `${v} !important` });
  addUtilities({
    // Full-bleed: the component owns its own edges, so the wrapper contributes nothing vertically
    // and lets the child's media reach the viewport edge.
    '.rh-bleed > *': { paddingBlock: '0 !important' },
    '.rh-bleed > * > div': { maxWidth: 'none', paddingInline: '0' },

    '.rh-tight > *':  band(spacing['section-tight']),
    '.rh-normal > *': band(spacing['section-normal']),
    '.rh-loose > *':  band(spacing['section-loose']),

    // Text-dominant: normal band, but the content column is narrowed so the section reads as
    // prose against its neighbours. This is the "alternating text-dominant sections against
    // full-bleed photography" rhythm from research §5.
    '.rh-text > *': band(spacing['section-normal']),
    '.rh-text > * > div': { maxWidth: '60rem', marginInline: 'auto' },
  });
});
```

### Files modified

#### `C:\Users\Xander\Desktop\ops\jdd-ops\template\tailwind.config.ts`

Add the imports and splice the new scales into `theme.extend`. **Keep every existing key exactly as
it is**: `colors` (all of it, including the derived tones and `urgent`), `textColor.accent`,
`fontFamily.sans`, `fontFamily.heading`, and `backgroundImage['accent-grad']`.

```ts
import type { Config } from 'tailwindcss';
import {
  fontSize, letterSpacing, spacing, borderRadius, boxShadow, maxWidth,
} from './src/styles/tokens';
import rhythm from './src/styles/rhythm.plugin';
```

and inside `theme.extend`, after the existing `fontFamily` block:

```ts
      fontSize,
      letterSpacing,
      spacing,
      borderRadius,
      boxShadow,
      maxWidth,
```

and change `plugins: []` to `plugins: [rhythm]`.

Leave `backgroundImage['accent-grad']` in place. Decision 3: back-compat is additive and deprecated
tokens keep resolving, and already-exported client repos have `bg-accent-grad` baked into their
page files. Add a one-line comment above it:
`// DEPRECATED by decision 30(b): no new component may use it. Kept so shipped repos still build.`

Finally, extend `content` so the plugin's own module and the tokens file are not treated as
scannable source noise, and so a client repo that gains `src/lib/StickyCallBar.tsx` in Phase 6 has its classes generated. Current value is `['./src/**/*.{ts,tsx}']`, which already covers
both; **no change needed here**. Confirm by reading it rather than assuming.

#### `C:\Users\Xander\Desktop\ops\jdd-ops\console\tailwind.config.ts`

Three changes, each surgical.

1. **Import the shared tokens from the template**, so the preview resolves the same sizes:

```ts
import {
  fontSize as brandFontSize, letterSpacing as brandTracking, spacing as brandSpacing,
  borderRadius as brandRadius, boxShadow as brandShadow, maxWidth as brandMaxWidth,
} from '../template/src/styles/tokens';
import rhythm from '../template/src/styles/rhythm.plugin';
```

2. **Merge, do not replace.** The console's own `fontSize`, `letterSpacing`, `boxShadow` and
   `borderRadius` keys are chrome and must survive. Spread the brand tokens FIRST so a name
   collision resolves in favour of chrome, and add a comment saying why:

```ts
      // CLIENT-BRAND sizing, shared with the exported template via ../template/src/styles/tokens.
      // Spread first so the console's own CHROME keys below always win a name collision: the
      // chrome scale has a 14px body floor that must not be overwritten by a client-site scale.
      // The two sets use disjoint key names on purpose (display-1/card-title/lead/body/small/fine
      // vs sm/base/lg/xl/label/kicker/meta), so no collision is expected; the ordering is a guard.
      fontSize: { ...brandFontSize, /* …the existing console chrome fontSize entries, unchanged… */ },
      letterSpacing: { ...brandTracking, /* …existing tightest/tightish/wideish/widest2… */ },
      spacing: { ...brandSpacing },
      boxShadow: { ...brandShadow, /* …existing raised/panel/overlay/floating/glow… */ },
      borderRadius: { ...brandRadius, /* …existing xl2/panel… */ },
      maxWidth: { ...brandMaxWidth },
```

   **Watch `borderRadius.panel`.** The console already defines `panel: '12px'` (matching `.panel`
   in `globals.css`) and `tokens.ts` defines `panel: '14px'`. The spread order above makes the
   console's 12px win, which is correct: `rounded-panel` in console chrome must keep matching
   `.panel`. Add a comment at that key recording the collision and that it is intentional, so
   nobody "fixes" it later. Catalog preview components must therefore use `rounded-[14px]` only if
   they genuinely need the template value; prefer `rounded-control` and `rounded-slab`, which do
   not collide.

3. **Add the template content glob and the plugin.**

```ts
  content: [
    './src/**/*.{ts,tsx}',
    // Template-owned code the console RENDERS (Phase 6 imports
    // @template/lib/StickyCallBar into PageStudio). Without this glob its Tailwind classes are
    // never generated in the console build and the preview renders an unstyled bar.
    '../template/src/lib/**/*.{ts,tsx}',
  ],
  ...
  plugins: [rhythm],
```

### Files NOT modified, and why

- `template/src/styles/globals.css`: Phase 2 owns it (the `:root` default palette).
- Any catalog component: migrating the ~30 components off inline arbitrary values onto these
  tokens is later work, done as each component is touched in Phases 7, 8 and 9. This phase only
  makes the tokens exist. **Do not do a sweeping find-and-replace across the catalog here**; it
  would be a large untestable diff in a phase whose gate cannot detect visual regressions.
- `console/tsconfig.json`: `include` is `["next-env.d.ts", "**/*.ts", "**/*.tsx",
  ".next/types/**/*.ts", "../template/src/lib/structuredData.ts"]`. `tailwind.config.ts` matches
  `**/*.ts` and `tsc` follows its imports, so the two new template files typecheck without an
  `include` entry. Phase 6 adds an explicit entry for `StickyCallBar.tsx` because that one
  is imported by a `.tsx` component, not by the config.

### Verification

```
cd /c/Users/Xander/Desktop/ops/jdd-ops/console  && npm run build && npm test
cd /c/Users/Xander/Desktop/ops/jdd-ops/template && npm run build
```
A Tailwind config that fails to load the `.ts` token module fails the build loudly, so a green
build is the proof that both configs resolve the shared file.

Then prove the utilities actually generate, which a build alone does not. Add a throwaway element
carrying every new token to `template/src/app/page.tsx` inside the `@studio:body` region:

```tsx
<div className="rh-loose">
  <section className="px-gutter max-w-content mx-auto">
    <h1 className="text-display-1 tracking-display">display-1</h1>
    <h2 className="text-display-2">display-2</h2>
    <h3 className="text-display-3">display-3</h3>
    <p className="text-card-title">card-title</p>
    <p className="text-lead">lead</p>
    <p className="text-body">body</p>
    <p className="text-small">small</p>
    <p className="text-fine">fine</p>
    <button className="rounded-control shadow-slab bg-accent text-accentFg px-6 py-4">control</button>
    <div className="rounded-panel shadow-slab-lift max-w-measure">panel</div>
  </section>
</div>
```

```
cd /c/Users/Xander/Desktop/ops/jdd-ops/template && npm run build
grep -c 'rh-loose' .next/static/css/*.css        # must be >= 1
grep -o 'clamp(2.25rem[^)]*)' .next/static/css/*.css | head -1   # display-1 is in the sheet
```
Then `npm run dev` and look at `http://localhost:3000` in a real browser at 390px and at 1440px:
the eight type steps must visibly step, and `display-1` must grow between the two widths while
`card-title` does not. **Delete the throwaway block before closing the phase** and re-run the
template build.

**User looks at:** the eight type steps at 390px and 1440px side by side in a real browser, and
`template/src/styles/tokens.ts` as a document, since it is now the spec.

### Out of scope

Changing any colour (Phase 2). Changing any font (Phase 3). Migrating components onto the tokens
(Phases 7 to 9). Adding a `rhythm` field to `SectionRef` or emitting the wrapper from
`wirePages`: that is Phase 9a, and this phase deliberately ships the classes before
anything applies them so the two changes can be verified separately.

---

## Phase 2: grounds go warm and unbleached, inks go warm charcoal

**Goal:** move every default ground off `#ffffff` and every default ink off `#000000` / cool navy,
re-derive the whole palette, and prove AA still holds for every accent a client can pick.
**Discharges:** decisions 9, 10 (token side), 3, 41; research §8 item 1. Cuts `@jdd/ui` v1.0.3.

Decision 9 shifts **every derived token**, because `paletteVars()` computes a tint ramp,
`--accent-text` (an AA loop), `--urgent`, `--ink-panel`, `--on-ink`, `--on-ink-soft` and
`--rule-ink` from the seven authored ones. It also ends `@jdd/ui` tag **v1.0.3**.

**Read before editing:** `packages/ui/src/palette.ts` in full (every comment block records a
shipped defect, so none of them is decorative), `packages/ui/src/color.ts`,
`console/test/palette-contrast.test.mjs`, `template/src/styles/globals.css`,
`console/src/data/site.ts` lines 20 to 50, and all six `console/src/data/verticals/*.ts` palettes.

### 2a. The two hardcoded cool defaults in `@jdd/ui`

#### `C:\Users\Xander\Desktop\ops\jdd-ops\packages\ui\src\palette.ts`

Four edits. Nothing else in the file changes.

1. **Add the two warm anchors** near the top, above `paletteVars`:

```ts
/**
 * The warm anchors. Decision 9 of console/design/DECISIONS-template-fidelity-v2.md moves every
 * default ground off pure white and every default ink off pure black / cool navy: research §5
 * records that both 2026 trend data and every Tier B measurement point the same way, and that
 * pure-white grounds plus indigo accents are a named AI-sameness tell (research §6 item 3).
 *
 * These are the fallbacks the derivation reaches for when the client's own ink is unusable, so
 * they have to be concrete values, not a hue rotation of something.
 */
const WARM_INK = '#1A1512';    // warm charcoal. Replaces the old cool navy '#0f1b2d'.
const WARM_PAPER = '#FBF8F4';  // warm off-white. Replaces pure '#ffffff' as a FOREGROUND.
```

2. **`readableOn`** currently signs as `readableOn(bg: string, dark = '#0f1b2d')` and returns
   `'#ffffff'` for the light option, comparing against `contrastRatio(1, lb)` (a hardcoded
   luminance of 1 for pure white). Change the default and the light candidate:

```ts
/** The warm off-white or `dark` (brand ink), whichever contrasts better against `bg`.
 *  Neither candidate is a pure value any more (decision 9): pure white on a dark panel is the
 *  cheap tell, and the warm off-white is 18:1 on the ink panel, so nothing is lost. */
export function readableOn(bg: string, dark = WARM_INK): string {
  try {
    const lb = relLuminance(bg);
    const lightC = contrastRatio(relLuminance(WARM_PAPER), lb);
    const darkC = contrastRatio(relLuminance(dark), lb);
    return darkC > lightC ? dark : WARM_PAPER;
  } catch {
    return WARM_PAPER;
  }
}
```

3. **`accentText`'s direction targets.** It currently steps `toward = isDarkHex(primary) ?
   '#ffffff' : '#000000'`. Change to `WARM_PAPER` and a warm near-black:

```ts
    const toward = isDarkHex(primary) ? WARM_PAPER : '#181310';
```
   Keep the 24-iteration bound, the 8%-per-step `mix`, the "must clear AA on EVERY surface"
   loop over `bgs`, and the `readableOn(primary)` bailout, all unchanged. Those three properties
   are each load-bearing and each documented in the file.

4. **`--accent-fg`'s fallback.** The line is currently
   `readableOn(accent, isDarkHex(ink) ? ink : '#0f1b2d')`. Change the literal to `WARM_INK`:

```ts
    '--accent-fg': passesAA(p.accentFg, accent)
      ? (p.accentFg as string)
      : readableOn(accent, isDarkHex(ink) ? ink : WARM_INK),
```
   Do not change the `passesAA` guard. It exists because a client set `#FFFFFF` on `#e08b29`
   (2.66:1) and the old `??` skipped the computed answer entirely. `paletteVars`' line 50
   `const onInk = readableOn(inkPanel, dark ? ink : '#0f1b2d')` gets the same treatment: replace
   that literal with `WARM_INK` too.

5. **`--accent-grad`.** Leave the token. Decision 3 is additive back-compat and shipped client
   repos use `bg-accent-grad`. Add above it:
   `// DEPRECATED by decision 30(b). Still derived so shipped repos keep rendering; no new component may use it.`

### 2b. Delete the unpublished `sectionVars` from `@jdd/ui`

`packages/ui/src/palette.ts` has an **uncommitted** 39-line addition (verify with
`cd packages/ui && git diff --stat`) exporting `SectionStyleLike` and `sectionVars`. It is not in
the published v1.0.2: `grep -n sectionVars console/node_modules/@jdd/ui/src/palette.ts` returns
nothing.

**Delete both the type and the function from `packages/ui/src/palette.ts`.** Reasons, all three
real:

1. Nothing imports them from `@jdd/ui`. Verified: every `sectionVars` consumer
   (`console/src/app/c/[slug]/build/PageStudio.tsx`, `console/src/lib/export.ts`'s generated
   `import { sectionVars } from '@/lib/palette'`) resolves to the **local** definition in
   `console/src/lib/palette.ts` or `template/src/lib/palette.ts`.
2. Publishing it creates a star-export collision. `template/src/lib/palette.ts` begins
   `export * from '@jdd/ui/palette';` and then defines its own `sectionVars`. A local export
   shadows a star re-export so it compiles, but it is ambiguous to every reader and one refactor
   away from resolving to the wrong implementation.
3. `template/src/lib/palette.ts`'s own header states the correct rationale for where it lives:
   "@jdd/ui is a pinned GitHub dependency; defining it in this template-owned lib means an
   `overwrite` export refreshes it into client repos without republishing @jdd/ui." Publishing it
   would invert that deliberate decision.

After deleting, add a short note in its place:

```ts
/* `sectionVars` is intentionally NOT in this package. It is defined in template/src/lib/palette.ts
   (and its console twin) because those are TEMPLATE-OWNED files: an `overwrite` export refreshes
   them into every client repo with no @jdd/ui release. A copy here was added and never published;
   it was deleted rather than published, to avoid a star-export collision with the template's own
   definition. Keep the two twins byte-identical to each other. */
```

Then **confirm the two twins are still byte-identical** in their `sectionVars` bodies:

```
cd /c/Users/Xander/Desktop/ops/jdd-ops
diff <(sed -n '/export function sectionVars/,/^}/p' console/src/lib/palette.ts) \
     <(sed -n '/export function sectionVars/,/^}/p' template/src/lib/palette.ts)
```
The only expected difference is `_paletteVars` versus `paletteVars` naming; if the bodies differ
otherwise, align the console's to the template's and say so in `NOTES.md`. Do **not** unify
`typographyVars`: the console's version deliberately also applies `fontFamily` and `fontWeight` to
the preview subtree so the brand drawer's font picker does something visible, and a real site must
not have that. Its own comment calls this "the same class of intentional seam as editable.tsx."

### 2c. Release `@jdd/ui` v1.0.3

Run the **§0.3a loop** and tag **v1.0.3**, commit message
`feat: warm palette anchors (decision 9); drop the unpublished sectionVars`. Step 5 of the loop
must print `1.0.3` from **both** `console/node_modules` and `template/node_modules`.

### 2d. The seven authored palettes

One shared warm neutral ground applies to all of them. **Each file keeps its own `accent` and
`accentFg` untouched**: the per-vertical accent is Phase 12 work for HVAC and a later
cycle for the rest, and decision 11 (honour the trade colour conventions at a higher level) is a
design decision that belongs in a vertical's own phase, not here.

The shared set, used verbatim in all seven files:

```
bg:      "#FAF7F2"   // paper
bgSoft:  "#F1EBE2"   // limestone
ink:     "#1A1512"   // warm charcoal
inkSoft: "#584E45"
rule:    "#DFD6C9"
```

Measured before writing them down, so they are not a guess: `inkSoft #584E45` on `bg #FAF7F2` is
**7.59:1**, and on `bgSoft #F1EBE2` is **6.84:1**. Both clear AA for normal text with margin.
`ink #1A1512` on `bg` is above 15:1.

Files to edit, all seven, `brand.palette` only:

1. `C:\Users\Xander\Desktop\ops\jdd-ops\console\src\data\site.ts` (lines ~34 to 41). This one also
   currently has **no `accentFg`**; leave it absent, the derivation supplies it.
2. `C:\Users\Xander\Desktop\ops\jdd-ops\console\src\data\verticals\hvac.ts`
3. `...\verticals\roofing.ts`
4. `...\verticals\plumbing.ts`
5. `...\verticals\lawn-care.ts`
6. `...\verticals\car-detailing.ts`
7. `...\verticals\health.ts`

While in each of those seven files, also **strip em-dashes from user-facing strings** per §0.2.
`hvac.ts` has at least two, both at the point where the sentence breaks: `announcement`
("24/7 emergency HVAC service U+2014 call us any time") and `hero.sub` ("Fast, reliable HVAC
service U+2014 from emergency repairs"), where "U+2014" above stands for the literal em-dash
character in the file. Replace each with a comma or a colon. Do not reword beyond the punctuation.

#### `C:\Users\Xander\Desktop\ops\jdd-ops\template\src\styles\globals.css`

The `:root` block is the pre-hydration fallback and the standalone-template palette. It is
currently a cool default set (`--bg: #ffffff`, `--ink: #0f1b2d`, `--accent: #1e6fbf`). Replace the
colour values with the warm set plus a sophisticated, trade-coded accent rather than the generic
blue:

```css
:root {
  /* Decision 9: warm unbleached ground, warm charcoal ink. Decision 11: the accent is a
     sophisticated tone of the expected HVAC blue coding, not a saturated primary. This block is
     the pre-hydration fallback and the standalone-template palette; layout.tsx overrides all of
     it per client from CONTENT.brand. */
  --accent: #1F5C7A;
  --accent-fg: #FBF8F4;
  --bg: #FAF7F2;
  --bg-soft: #F1EBE2;
  --ink: #1A1512;
  --ink-soft: #584E45;
  --rule: #DFD6C9;
  /* font vars unchanged here; Phase 3 owns them */
}
```
Leave the `body` and `h1..h6` rules alone.

#### Decision 10's token side

Decision 10 demotes the accent to the primary CTA and urgency only; eyebrows, rules, icons and
numerals go neutral. The **component** side of that is later work, as each file is touched. The
**token** side is here, and it is one change: in `packages/ui/src/skins.ts`'s `skinClasses`, the
`eyebrow` key is `'text-accent'` for `soft`, `default` and `editorial`, and `'text-accent200'` for
`inverted` / `contrast`.

**Do not change `skinClasses`.** Changing `eyebrow` would silently restyle every already-exported
client repo on its next `overwrite`, and the eyebrows themselves are being removed from components
rather than recoloured (SPEC §3 cuts wide-tracked uppercase eyebrows; the h2 carries that job).
Instead, add a comment above the `eyebrow` entries recording the direction:

```ts
        // Decision 10 demotes the accent to the primary CTA and urgency only. `eyebrow` keeps
        // text-accent for back-compat (decision 3: a shipped repo must keep rendering), but NO NEW
        // component should use s.eyebrow as a colour cue. Eyebrows are being removed, not
        // recoloured: SPEC §3 gives the h2 that job and puts a plain sentence under it.
```

### 2e. The AA contrast suite

`C:\Users\Xander\Desktop\ops\jdd-ops\console\test\palette-contrast.test.mjs` **already exists**
(verified) and runs the real `@jdd/ui` implementation against seven awkward accents on three
surface sets. **Extend it, do not replace it.** Phase 12 reuses its helpers, so the
helpers have to be importable without re-running its tests.

#### `C:\Users\Xander\Desktop\ops\jdd-ops\console\test\helpers\contrast.mjs` (NEW)

Extract the reusable machinery into a plain module with no `node:test` import, so importing it does
not execute any test:

```js
// Shared contrast assertions. Lives outside *.test.mjs on purpose: console/test/
// vertical-language.test.mjs (Phase 12) imports these, and importing a test file would
// re-run its tests. Runs the REAL implementation from @jdd/ui rather than restating the maths,
// because a test that reimplements the thing it is testing proves nothing.
import assert from 'node:assert/strict';
import { paletteVars, contrast } from '@jdd/ui/palette';

export const AA = 4.5;
export const TYPO = { fontSans: 'x', fontHeading: 'x', headingWeight: 700, bodyWeight: 400 };

/** paletteVars() for one palette object (the 7 authored slots). */
export function varsFor(palette) {
  return paletteVars({ palette, typography: TYPO });
}

/**
 * Every derived token that renders as TEXT clears AA on every surface it can land on.
 * `label` is prefixed to each failure so a caller with many palettes can tell them apart.
 */
export function assertPaletteAA(palette, label) {
  const v = varsFor(palette);
  const on = (fg, bg, what) =>
    assert.ok(contrast(fg, bg) >= AA, `${label}: ${what} ${fg} on ${bg} = ${contrast(fg, bg).toFixed(2)}`);
  on(v['--accent-text'], palette.bg, '--accent-text');
  on(v['--accent-text'], palette.bgSoft, '--accent-text');
  on(v['--accent-fg'], palette.accent, '--accent-fg');
  on(v['--urgent'], palette.bg, '--urgent');
  on(v['--urgent'], palette.bgSoft, '--urgent');
  on(v['--on-ink'], v['--ink-panel'], '--on-ink');
  on(palette.inkSoft, palette.bg, 'inkSoft');
  on(palette.inkSoft, palette.bgSoft, 'inkSoft');
}

/** Decision 9: no authored surface or ink may be a pure value. */
export function assertWarm(palette, label) {
  const pure = new Set(['#ffffff', '#fff', '#000000', '#000']);
  for (const slot of ['bg', 'bgSoft', 'ink', 'inkSoft', 'rule']) {
    assert.ok(
      !pure.has(String(palette[slot]).toLowerCase()),
      `${label}: ${slot} is ${palette[slot]}; decision 9 moves grounds off pure white and inks off pure black`,
    );
  }
}
```

#### `palette-contrast.test.mjs` (MODIFIED)

1. Replace its local `AA`, `TYPO` and `varsFor` with imports from `./helpers/contrast.mjs`. Keep
   `contrast` and `paletteVars` imported directly where its own bespoke assertions need them.
2. **Replace the `LIGHT` and `DEEP_SOFT` bases with the Phase 2d warm set**, and keep `DARK` as is
   (a client may still author a dark palette and that path has a documented history of breaking):

```js
const WARM     = { bg: '#FAF7F2', bgSoft: '#F1EBE2', ink: '#1A1512', inkSoft: '#584E45', rule: '#DFD6C9' };
const WARM_DEEP = { ...WARM, bgSoft: '#E8DFD2' };   // a deeper soft band, the case that nearly failed before
const DARK = { bg: '#0e1116', bgSoft: '#161b22', ink: '#f5f5f5', inkSoft: '#b9b9b9', rule: '#2a2f36' };
```

3. **Extend `ACCENTS`** with the six shipped vertical accents, so the suite is testing the colours
   that actually go out, not only adversarial ones. Keep all seven existing entries:

```js
  ['#E05C2A', 'hvac preset'],          // already present, keep
  ['#475569', 'roofing preset'],
  ['#1E6FA8', 'plumbing preset'],
  ['#3D8E40', 'lawn-care preset'],
  ['#1A1A2E', 'car-detailing preset'],
  ['#0E9C8A', 'health preset'],
  ['#1F5C7A', 'the new globals.css default'],
```

4. **Add three new tests:**

```js
test('every shipped palette is warm and clears AA', async () => {
  // The seven authored palettes as they exist on disk, read rather than restated, so a future
  // edit to a preset is caught here instead of in a browser.
  //  (import CONTENT from ../src/data/site.ts and the six verticals via ../src/lib/verticals.ts's
  //   VERTICAL_PRESETS, which is client-safe and has no node:fs)
});

test('the pre-hydration :root defaults in globals.css are warm', () => {
  // Parse template/src/styles/globals.css's :root block with a regex and run assertWarm on it.
  // This is the one palette no TypeScript import can reach, and it is what a visitor sees for
  // the first paint of every client site.
});

test('a warm ground never resolves a pure-white foreground', () => {
  // readableOn's light candidate is WARM_PAPER, not #ffffff (decision 9). Assert that
  // paletteVars on the DARK base yields an --on-ink that is not '#ffffff'.
});
```

5. **The two existing `accentFg` tests must still pass unchanged.** Check them explicitly, because
   they assert against `'#ffffff'`:
   - `'an illegible accentFg from the schema is REJECTED'` asserts `notEqual(..., '#ffffff')`. After
     the change `readableOn` returns `#FBF8F4` for the light case, so this still passes.
   - `'a legible accentFg from the schema IS honoured'` sets accent `#1C1009` with accentFg
     `#FFFFFF` and asserts `equal(..., '#ffffff')`. That path goes through `passesAA` and returns
     the schema value verbatim, so it is unaffected. **Do not "modernise" this assertion**: it is
     testing that we honour a client who chose correctly, including a client who chose pure white.
   - `'an already-legible accent is passed through unchanged'` uses `#1f6f78` on the old `LIGHT`
     base. On the new `WARM` base recompute: if `#1f6f78` no longer clears 4.5 on `#F1EBE2`, the
     assertion `equal(v['--accent-text'], '#1f6f78')` will fail legitimately. Compute it, and if it
     fails, change the accent in that one test to a value that does pass and note the new ratio in
     the test's comment. Do not weaken the assertion.

### Verification

```
cd /c/Users/Xander/Desktop/ops/jdd-ops/packages/ui && npm run typecheck
cd /c/Users/Xander/Desktop/ops/jdd-ops/console && npm test && npm run build
cd /c/Users/Xander/Desktop/ops/jdd-ops/template && npm run build
grep '"version"' /c/Users/Xander/Desktop/ops/jdd-ops/console/node_modules/@jdd/ui/package.json
grep '"version"' /c/Users/Xander/Desktop/ops/jdd-ops/template/node_modules/@jdd/ui/package.json
# both: 1.0.3
grep -rn "0f1b2d\|'#ffffff'\|#FFFFFF" /c/Users/Xander/Desktop/ops/jdd-ops/packages/ui/src/palette.ts
# expect ZERO hits for 0f1b2d; any #ffffff hit must be inside a comment quoting a historic value
grep -rn 'sectionVars' /c/Users/Xander/Desktop/ops/jdd-ops/packages/ui/src/
# expect only the explanatory comment, no `export function`
```

Then look at it, which no test can do:

```
cd /c/Users/Xander/Desktop/ops/jdd-ops/template && npm run dev
```
Open `http://localhost:3000`. The page ground must be warm paper, not white, and the body ink must
be warm charcoal, not navy. Then start the console (`cd console && npm run dev`, port 3040, **not
`--turbo`**) and open a client's `/c/<slug>/build`: the preview must show the same warm ground, and
the Brand drawer's palette pane must read the new hexes.

**User looks at:** the template dev server and the console preview side by side at the same zoom.
The question is whether the ground reads as paper rather than as a screen, and whether the ink
reads warm. A side-by-side against the old pure-white screenshot is the clearest way to see it.

### Out of scope

Per-vertical accents (Phase 12 for HVAC; a later cycle for the other five). Removing
`text-accent` from any component (later, as each file is touched). Deleting `--accent-grad` or the
three deprecated skin ids: decision 3 keeps both resolving, and `skins.ts`'s own header explains
that `editorial` / `contrast` / `quiet` must stay in `SkinId` and in `skinClasses` so an
already-exported repo with `skin="editorial"` baked into its `page.tsx` keeps rendering.

---

## Phase 3: the font registry is replaced by curated pairings

**Goal:** the operator picks one curated pairing instead of two independent fonts from a list that
is, verbatim, the AI-tell font list.
**Discharges:** G1; decisions 5, 6, 7. Supplies `FONT_PAIRINGS` and `pairingFor(id)` including the
`'instrument'` pairing that Phase 12 names.

Research §7 G1: `console/src/lib/fonts.ts` offers exactly Inter, Manrope, Poppins, Sora, Work Sans,
Plus Jakarta Sans, Roboto Slab, Playfair Display. Six of eight are the canonical
statistically-average web fonts, and no combination out of that list reads Tier B. Decision 6 says
replace it entirely; decision 7 sets the model (single high-quality grotesque, display and body the
same family, differentiated by weight, size and tracking); decision 5 sets the licensing (best
free and open faces, self-hosted woff2, no paid regime).

### 3a. Trace the chain before you change it

The whole chain, verified 2026-10-05. Read every file in it before editing any of it.

```
console/src/lib/fonts.ts          FONT_OPTIONS[] : { id, label, varName, stack, role }
  ├─ console/src/app/c/[slug]/build/brand/TypographyPane.tsx   line 6, line 50
  │     FontSpecimenList filters by role, writes o.stack via setField(path, o.stack)
  │     into brand.typography.fontHeading and brand.typography.fontSans
  └─ console/src/components/fields/index.tsx                   line 14, line 149
        FontSelect: the same list as a <select>, same two paths

brand.typography.{fontSans,fontHeading}  (the full `stack` STRING, e.g.
  "var(--font-inter), system-ui, sans-serif")
  ├─ console/src/lib/palette.ts  typographyVars()  -> --font-sans / --font-heading
  │     (plus fontFamily + fontWeight on the preview subtree, console-only, intentional)
  ├─ template/src/lib/palette.ts -> @jdd/ui/palette typographyVars() -> the same two vars
  └─ tailwind: fontFamily.sans = var(--font-sans), fontFamily.heading = var(--font-heading)
        in BOTH tailwind.config.ts files

the CSS variables the stacks NAME must be defined by a loaded next/font:
  ├─ console/src/lib/fonts.loader.ts    industryFontVars  (ALL EIGHT, always)
  │     consumed by console/src/app/layout.tsx line 7 and line 47
  └─ template/src/lib/fonts.loader.ts   fontVarsFor(...stacks)  (SELECTIVE)
        consumed by template/src/app/layout.tsx line 7 and the <html className=...>
```

**The asymmetry between the two loaders is deliberate and must survive this phase.**
`template/src/lib/fonts.loader.ts`'s header records the measurement: it used to export a single
`industryFontVars` string attached unconditionally, `next/font` preloads by default, and every
client site therefore shipped **12 `<link rel="preload" as="font">` tags and 292KB of woff2**, the
largest byte category on the page. LCP was 4.2s of which 3519ms (84%) was Render Delay, on a text
element. Lighthouse Performance 84. Two fixes were needed and both must be preserved:

1. `preload: false` on **every** family in the template loader.
2. `fontVarsFor()` attaches only the families the brand's stacks actually name, so an unreferenced
   `@font-face` never matches an element and is never downloaded.

The console's loader deliberately still loads everything and does **not** set `preload: false`,
because it is the font picker and preview surface and needs every family resolvable at once. Its
own comment says "Do not sync the two." Honour that.

### 3b. The five pairings

All five exist in the installed Next's Google font list (verified against
`console/node_modules/next/dist/compiled/@next/font/dist/google/index.d.ts`), all are open-licensed,
`next/font/google` self-hosts the woff2 so decision 5 is satisfied with no licensing regime, and
none is on the AI-tell list.

| id | Family | Weights available | Display weight | Body weight | Why it reads premium |
|---|---|---|---|---|---|
| `instrument` | Instrument Sans | 400 to 700 | **700** | 400 | Neutral-modern grotesque with real aperture control. The closest free analogue to the Suisse Intl that Haven Constructions self-hosts. **The default.** |
| `schibsted` | Schibsted Grotesk | 400 to 900 | 800 | 400 | Editorial grotesque, built for a newspaper. Carries an 800 without going generic. |
| `bricolage` | Bricolage Grotesque | 200 to 800 | 800 | 400 | Characterful display grotesque. Has a voice, which is the documented antidote to statistical averaging. |
| `figtree` | Figtree | 300 to 900 | 800 | 400 | Warm humanist. The right register for a trade whose language is reassurance. |
| `archivo` | Archivo | 100 to 900 | 800 | 500 | Grotesque with real width range; the closest free analogue to a condensed trade face without being Teko. |

**`instrument` caps at 700.** That is why a pairing carries its own display weight rather than
inheriting SPEC §3's blanket 800: Instrument Sans has no 800, and asking `next/font` for one is a
build error. Record this in the pairing's own comment.

### Files created

#### `C:\Users\Xander\Desktop\ops\jdd-ops\console\src\lib\fonts.ts` (REPLACED, same path)

Keep the path. Two call sites import `@/lib/fonts` and the file must stay client-safe (no
`next/font` import), which its current header already states.

```ts
// Curated TYPE PAIRINGS, replacing the old loose FONT_OPTIONS list (decision 6 of
// console/design/DECISIONS-template-fidelity-v2.md).
//
// WHY A PAIRING AND NOT TWO DROPDOWNS. The old registry offered eight families across two
// independent selects, which is 64 combinations, of which roughly four were any good and most
// read as the statistically-average web (gap G1: six of the eight were Inter / Manrope / Poppins /
// Sora / Work Sans / Plus Jakarta Sans). An operator cannot be expected to know which pairing is
// premium. So the operator picks ONE pairing and gets a whole typographic position.
//
// THE MODEL (decision 7): a single high-quality grotesque carries the whole site. Display and body
// are the SAME family, differentiated by weight, size and tracking. This is Haven Constructions'
// move (Suisse Intl alone) rather than Spence's (a paid display serif over a paid grotesque), and
// it is the one of the two that is reachable with open faces.
//
// LICENSING (decision 5): every family here is open-licensed and served by next/font/google, which
// SELF-HOSTS the woff2 at build time. No Typekit, no paid regime, no runtime third-party request.
//
// CLIENT-SAFE: no next/font import here, so the Brand drawer can use it. The families are loaded
// in fonts.loader.ts (console) and template/src/lib/fonts.loader.ts (template). A `varName` that
// no loader defines means that font silently never loads, so the two loaders' VAR_TO_CLASS keys
// must stay in step with `varName` below. console/test/fonts.test.mjs asserts that they do.

/** One curated typographic position. `display` and `body` are treatments of ONE family. */
export interface FontPairing {
  id: string;
  label: string;
  /** The CSS variable both loaders define via next/font. */
  varName: string;
  /** The full font-family stack written into brand.typography. */
  stack: string;
  /** Display treatment. `weight` must be a weight the family actually ships. */
  display: { weight: number; tracking: string; lineHeight: number };
  body: { weight: number };
  /** One sentence for the operator, shown under the specimen. No em-dashes. */
  note: string;
}

export const FONT_PAIRINGS: FontPairing[] = [
  {
    id: 'instrument',
    label: 'Instrument',
    varName: '--font-instrument',
    stack: 'var(--font-instrument), system-ui, sans-serif',
    // Instrument Sans ships 400 to 700 ONLY. SPEC §3 asks for 800 headings; this family has no
    // 800, and requesting one from next/font is a build error. 700 at display-1 with -0.022em
    // tracking reads as heavy as an 800 at a looser track.
    display: { weight: 700, tracking: '-0.022em', lineHeight: 1.02 },
    body: { weight: 400 },
    note: 'Neutral and modern. The quietest of the five, and the one that gets out of the way of photography.',
  },
  {
    id: 'schibsted',
    label: 'Schibsted Grotesk',
    varName: '--font-schibsted',
    stack: 'var(--font-schibsted), system-ui, sans-serif',
    display: { weight: 800, tracking: '-0.020em', lineHeight: 1.02 },
    body: { weight: 400 },
    note: 'Editorial. Built for a newspaper, so it holds a heavy weight without looking generic.',
  },
  {
    id: 'bricolage',
    label: 'Bricolage Grotesque',
    varName: '--font-bricolage',
    stack: 'var(--font-bricolage), system-ui, sans-serif',
    display: { weight: 800, tracking: '-0.018em', lineHeight: 1.00 },
    body: { weight: 400 },
    note: 'Has a voice. Pick it when the business has one too.',
  },
  {
    id: 'figtree',
    label: 'Figtree',
    varName: '--font-figtree',
    stack: 'var(--font-figtree), system-ui, sans-serif',
    display: { weight: 800, tracking: '-0.020em', lineHeight: 1.04 },
    body: { weight: 400 },
    note: 'Warm and humanist. The friendliest of the five without being soft.',
  },
  {
    id: 'archivo',
    label: 'Archivo',
    varName: '--font-archivo',
    stack: 'var(--font-archivo), system-ui, sans-serif',
    display: { weight: 800, tracking: '-0.024em', lineHeight: 0.98 },
    // Archivo's 400 is slightly light at 17px, so its body steps up one notch.
    body: { weight: 500 },
    note: 'Tight and industrial. The closest to a trade condensed face without the 2016 register.',
  },
];

export const DEFAULT_PAIRING_ID = 'instrument';

const BY_ID = new Map(FONT_PAIRINGS.map((p) => [p.id, p]));

/** The pairing for an id, falling back to the default. Guarded because a draft or a client record
 *  can carry an id from a registry revision that no longer exists, and a missing pairing must not
 *  crash the Brand drawer. */
export function pairingFor(id: string | null | undefined): FontPairing {
  return (id ? BY_ID.get(id) : undefined) ?? BY_ID.get(DEFAULT_PAIRING_ID)!;
}

/**
 * A pairing as `brand.typography`. Exactly the six fields the schema's typography object carries,
 * so a caller can splat it: `brand.typography = typographyFor('instrument')`.
 *
 * This is what makes a pairing ONE choice: the operator picks an id and all six fields move
 * together, instead of two font strings moving independently of three numeric treatments.
 */
export function typographyFor(id: string | null | undefined) {
  const p = pairingFor(id);
  return {
    fontSans: p.stack,
    fontHeading: p.stack,
    headingWeight: p.display.weight,
    bodyWeight: p.body.weight,
    headingTracking: p.display.tracking,
    headingLineHeight: p.display.lineHeight,
  };
}

/** The pairing whose `stack` matches an authored brand.typography value, or null for a system
 *  stack or a stack from the retired FONT_OPTIONS registry. The Brand drawer uses this to show
 *  which pairing is selected without storing a separate id in the schema. */
export function pairingIdFromStack(stack: string | null | undefined): string | null {
  if (!stack) return null;
  return FONT_PAIRINGS.find((p) => p.stack === stack)?.id ?? null;
}
```

**Note on where the id is stored.** `pairingIdFromStack` exists so this phase needs **no
`@jdd/schema` change**: the selected pairing is recovered from the `stack` string already in
`brand.typography.fontSans`, which the exporter already writes. Do not add a `pairingId` field to
the schema. That would be a version bump, a re-pin of three consumers, and a silent-data-loss
window, to store something derivable.

#### `C:\Users\Xander\Desktop\ops\jdd-ops\console\test\fonts.test.mjs` (NEW)

Four assertions. This is the phase's real gate, because a `varName` with no loader entry fails
silently rather than loudly.

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FONT_PAIRINGS, DEFAULT_PAIRING_ID, pairingFor, typographyFor, pairingIdFromStack }
  from '../src/lib/fonts.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OPS = path.resolve(ROOT, '..');

test('every pairing varName is defined by BOTH loaders', () => {
  // A varName the loader does not map means that font silently never loads: the stack resolves to
  // its system fallback and the site looks like it was never styled. There is no error.
  const consoleLoader = readFileSync(path.join(ROOT, 'src/lib/fonts.loader.ts'), 'utf8');
  const tplLoader = readFileSync(path.join(OPS, 'template/src/lib/fonts.loader.ts'), 'utf8');
  for (const p of FONT_PAIRINGS) {
    assert.ok(consoleLoader.includes(`'${p.varName}'`), `console loader is missing ${p.varName}`);
    assert.ok(tplLoader.includes(`'${p.varName}'`), `template loader is missing ${p.varName}`);
  }
});

test('the template loader keeps preload:false on every family', () => {
  // Measured: blanket preload cost 292KB of woff2 and 84% of a 4.2s LCP in Render Delay.
  // See the header of template/src/lib/fonts.loader.ts and PERF.md.
  const tpl = readFileSync(path.join(OPS, 'template/src/lib/fonts.loader.ts'), 'utf8');
  const families = tpl.match(/=\s*[A-Z][A-Za-z_]*\(\{[^}]*\}\)/g) ?? [];
  assert.equal(families.length, FONT_PAIRINGS.length);
  for (const f of families) assert.match(f, /preload:\s*false/, f);
});

test('the default pairing resolves and every id is unique', () => {
  assert.equal(pairingFor(DEFAULT_PAIRING_ID).id, DEFAULT_PAIRING_ID);
  assert.equal(pairingFor('nope').id, DEFAULT_PAIRING_ID);
  assert.equal(pairingFor(null).id, DEFAULT_PAIRING_ID);
  assert.equal(new Set(FONT_PAIRINGS.map((p) => p.id)).size, FONT_PAIRINGS.length);
  assert.ok(FONT_PAIRINGS.some((p) => p.id === 'instrument'), 'Phase 12 names this id');
});

test('typographyFor round-trips through pairingIdFromStack', () => {
  for (const p of FONT_PAIRINGS) {
    const t = typographyFor(p.id);
    assert.equal(pairingIdFromStack(t.fontSans), p.id);
    assert.equal(t.fontHeading, t.fontSans, 'decision 7: one family, two treatments');
  }
  assert.equal(pairingIdFromStack('-apple-system, sans-serif'), null);
});
```

### Files modified

#### `C:\Users\Xander\Desktop\ops\jdd-ops\console\src\lib\fonts.loader.ts`

Replace the eight imports and eight constructions with the five pairings' families. Keep
`industryFontVars` as the exported name and its shape (a single space-joined string), because
`console/src/app/layout.tsx` line 47 interpolates it into `<html className>` alongside the chrome
fonts. Keep the absence of `preload: false`, and add the reason as a comment so a future reader
does not "sync" it with the template.

```ts
import { Instrument_Sans, Schibsted_Grotesk, Bricolage_Grotesque, Figtree, Archivo }
  from 'next/font/google';

// Explicit weight arrays, not 'variable': loading the variable axis costs materially more bytes
// and the pairings use exactly two weights each. See lib/fonts.ts for which.
const instrument = Instrument_Sans({ subsets: ['latin'], variable: '--font-instrument', weight: ['400', '700'], display: 'swap' });
const schibsted  = Schibsted_Grotesk({ subsets: ['latin'], variable: '--font-schibsted', weight: ['400', '800'], display: 'swap' });
const bricolage  = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage', weight: ['400', '800'], display: 'swap' });
const figtree    = Figtree({ subsets: ['latin'], variable: '--font-figtree', weight: ['400', '800'], display: 'swap' });
const archivo    = Archivo({ subsets: ['latin'], variable: '--font-archivo', weight: ['500', '800'], display: 'swap' });

// The CONSOLE loads all five unconditionally and WITHOUT preload:false, unlike the template's
// twin. It is the pairing picker and the preview surface, so every family has to be resolvable at
// once and the bytes are an operator-machine cost, not a client-site cost. Do not sync the two.
export const industryFontVars = [
  instrument.variable, schibsted.variable, bricolage.variable, figtree.variable, archivo.variable,
].join(' ');
```

#### `C:\Users\Xander\Desktop\ops\jdd-ops\template\src\lib\fonts.loader.ts`

Same five families, with `preload: false` on each, and `VAR_TO_CLASS` rekeyed. **Keep the entire
header comment block**: it is the record of the 292KB measurement and the reason this file is
selective. Update only the sentence that says "all eight" to "all five", and update the note about
the console's twin.

```ts
const instrument = Instrument_Sans({ subsets: ['latin'], variable: '--font-instrument', weight: ['400', '700'], display: 'swap', preload: false });
// …the other four, same shape, each with preload: false…

const VAR_TO_CLASS: Record<string, string> = {
  '--font-instrument': instrument.variable,
  '--font-schibsted': schibsted.variable,
  '--font-bricolage': bricolage.variable,
  '--font-figtree': figtree.variable,
  '--font-archivo': archivo.variable,
};
```

Keep `fontVarsFor(...stacks)` and its word-boundary regex (`${varName}(?![\\w-])`) exactly as they
are. The boundary matters: `--font-archivo` must not match inside a hypothetical
`--font-archivo-expanded`.

#### `C:\Users\Xander\Desktop\ops\jdd-ops\console\src\app\c\[slug]\build\brand\TypographyPane.tsx`

The pane currently shows two `FontSpecimenList`s (heading, body) plus two `WeightPicker`s plus two
sliders. Decision 6 collapses the two font lists into **one pairing list**, and the pairing already
carries weight, tracking and line height, so the pickers and sliders become overrides rather than
primary controls.

Changes:

1. `import { FONT_PAIRINGS, pairingIdFromStack, typographyFor } from '@/lib/fonts';` and drop the
   `FONT_OPTIONS` import.
2. Delete `FontSpecimenList` and replace it with a `PairingList` that renders one button per
   pairing. Each button:
   - is `aria-pressed` when `pairingIdFromStack(str(content,'brand.typography.fontSans')) === p.id`;
   - renders the client's own `brand.name` (falling back to the existing `SPECIMEN_FALLBACK`,
     `'Aa Hamburgefons'`) at `fontFamily: p.stack`, `fontWeight: p.display.weight`,
     `letterSpacing: p.display.tracking`, so the specimen shows the actual display treatment, not
     just the family;
   - shows `p.label` above and `p.note` below at the pane's existing small sizes;
   - **on click writes all six fields**, each through the existing `setField` so each lands on the
     undo stack as one logical change:
     ```ts
     const t = typographyFor(p.id);
     setField('brand.typography.fontSans', t.fontSans);
     setField('brand.typography.fontHeading', t.fontHeading);
     setField('brand.typography.headingWeight', t.headingWeight);
     setField('brand.typography.bodyWeight', t.bodyWeight);
     setField('brand.typography.headingTracking', t.headingTracking);
     setField('brand.typography.headingLineHeight', t.headingLineHeight);
     ```
3. Keep both `WeightPicker`s and both sliders below the pairing list, under a small heading reading
   `Overrides`, with one line of helper copy: `A pairing sets all of these. Change one only if the
   client asks.` Keep `headingTracking`'s string-with-em-suffix write exactly as it is; the pane's
   own comment notes that the slider is numeric and must write the suffix back or the schema shape
   silently changes.
4. Keep the isolated specimen block at the bottom unchanged.
5. Keep the whole header comment block about what actually reaches the live preview. It is accurate
   and it is the only place that explains why a hero's own `leading-[0.95]` outranks the brand
   value.

#### `C:\Users\Xander\Desktop\ops\jdd-ops\console\src\components\fields\index.tsx`

`FontSelect` (line ~144) is the second, simpler picker: a `<select>` over `FONT_OPTIONS` filtered
by `role`, used wherever a generic field list is rendered. Replace it with a `PairingSelect` over
`FONT_PAIRINGS`, writing the same six fields on change. Drop the `filter: 'sans' | 'heading'` prop
(there is no role axis any more) and update every call site; grep for `FontSelect` to find them.
Keep the "System (current)" escape option for a brand whose stack matches no pairing, so an
existing client's authored system stack is not silently reassigned by opening the drawer.

#### The seven authored `brand.typography` objects

All seven currently carry a plain system stack:
`"-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"` for both `fontSans` and
`fontHeading`, `headingWeight: 700`, `bodyWeight: 400`, `headingTracking: "-0.01em"`,
`headingLineHeight: 1.2`. Set each to `typographyFor('instrument')`'s values, written out as
literals (these are data files, not code that can call a function):

```ts
    typography: {
      fontSans:          "var(--font-instrument), system-ui, sans-serif",
      fontHeading:       "var(--font-instrument), system-ui, sans-serif",
      headingWeight:     700,
      bodyWeight:        400,
      headingTracking:   "-0.022em",
      headingLineHeight: 1.02,
    },
```

Files: `console/src/data/site.ts` and the six `console/src/data/verticals/*.ts`. Per-vertical
pairings are Phase 12 (`VerticalLanguage.pairingId`); everything starts on `instrument`.

**This changes the byte profile of every client site**, from zero font bytes (a system stack ships
nothing) to one self-hosted family at two weights. That is the intended trade: G1 says a client
cannot currently pick a combination that reads Tier B, and a system stack is the most average
possible answer. The template loader's selectivity means it is **one** family, not five, and
`preload: false` means it is fetched after CSS has established it is wanted. Record the measured
cost in `NOTES.md` after the Phase 3 verification run.

### Verification

```
cd /c/Users/Xander/Desktop/ops/jdd-ops/console  && npm test && npm run build
cd /c/Users/Xander/Desktop/ops/jdd-ops/template && npm run build
grep -rn "FONT_OPTIONS" /c/Users/Xander/Desktop/ops/jdd-ops/console/src
# expect ZERO hits. Any hit is a call site you missed and the build will have caught it.
```

Then prove only one family ships, which is the part the build cannot tell you:

```
cd /c/Users/Xander/Desktop/ops/jdd-ops/template && npm run build
ls .next/static/media/*.woff2 | wc -l      # expect 2 (one family, two weights), not 10
grep -ro 'font-instrument' .next/static/css/ | head -1   # the chosen family is in the sheet
grep -ro 'font-schibsted'  .next/static/css/ | wc -l     # expect 0: an unchosen family is absent
```

Then look at it:

```
cd /c/Users/Xander/Desktop/ops/jdd-ops/template && npm run dev   # http://localhost:3000
cd /c/Users/Xander/Desktop/ops/jdd-ops/console  && npm run dev   # http://localhost:3040
```
In the console, open a client's `/c/<slug>/build`, open the Brand drawer, and click through all
five pairings. The live preview to the left must change family, weight, tracking and line height on
each click. In DevTools Network, filter to `font`: a single pairing must fetch two woff2 files and
no more.

**User looks at:** the five specimens in the Brand drawer, each rendering the client's own business
name at that pairing's display treatment, and the live preview changing as each is clicked. The
question is whether any of the five reads like the Tier A font list, and whether `instrument`
carries a 58px `display-1` convincingly at 700.

### Out of scope

Self-hosting a woff2 outside `next/font/google` (decision 5 accepts Google-served open faces, which
`next/font` self-hosts at build time anyway). A display serif paired against a grotesque: decision
7 settled on one family. A `pairingId` field in `@jdd/schema`. Per-vertical pairings (Phase 12). Changing any component's typography classes (Phases 7 to 9).

---

## Phase 4: the variety rule and the four bans become mechanical

**Goal:** archetype variety stops being prose in a markdown file and becomes a failing test, and
the four named AI tells become lints rather than good intentions.
**Discharges:** decisions 23, 30(a), 30(b), 30(c), 26, 12; research §6 items 1, 2, 3, 8. Prepares
30(d) for Phase 9.

This phase is **independent of Phases 1 to 3** and can run alongside them (see the dependency graph at the end of this document). It touches 30 component files but each change is one or two lines, and the new tests are
what make the change safe.

**Read before editing:** `console/test/catalog-invariants.test.mjs` in full (every existing test
corresponds to a defect that shipped and passed typecheck, build and Lighthouse, so none is
ceremonial), `studio/catalog/AUTHORING_CONTRACT.md` §6 for the `meta` shape, and the reconciled
archetype table you wrote in Phase 0.

### 4a. The archetype vocabulary as a module

#### `C:\Users\Xander\Desktop\ops\jdd-ops\console\src\lib\archetypes.ts` (NEW)

Dependency-free so a `.mjs` test can import it by relative path, and client-safe so the studio can
show an archetype label in the picker later.

```ts
/**
 * The structural-archetype vocabulary. Decision 23 of
 * console/design/DECISIONS-template-fidelity-v2.md: every component DECLARES its archetype in
 * `meta.archetype`, and console/test/catalog-invariants.test.mjs fails when two variants in one
 * category share one. The variety rule becomes mechanical instead of prose.
 *
 * WHY THIS MATTERS. Research §6 item 7 names "identical navigation patterns across every section
 * and page" and item 8 names "uniform section rhythm" as two of the eight things that make a site
 * read as AI-made. Gap G6 is that with two variants in six categories there is not enough catalog
 * for two sites built from it to look like different sites: two clients in the same vertical land
 * on the same composition. The collision lint is what stops a THIRD variant being added as a
 * decorated copy of an existing one, which is the cheap way to grow a count without growing
 * variety.
 *
 * DEPENDENCY-FREE on purpose: imported by relative path from a .mjs test.
 * Keep in step with the archetype table in console/DESIGN-LANGUAGE.md.
 */
export const ARCHETYPES = [
  'accordion',
  'aggregate-badge',
  'asymmetric-split',
  'before-after',
  'card-grid',
  'centered-statement',
  'column-grid',
  'count-up-centerpiece',
  'dense-mosaic',
  'editorial-index',
  'feature-rail',
  'form-led-split',
  'full-bleed-band',
  'full-bleed-overlay',
  'hero-first-grid',
  'horizontal-pin',
  'inline-strip',
  'map-list',
  'marquee',
  'numbered-ledger',
  'overlap-split',
  'snap-carousel',
  'stacked-bars',
  'stacked-panels',
  'sticky-bar',
  'sticky-swap',
  /** Non-visual. SEO variants emit metadata or JSON-LD and render nothing, so they have no
   *  structure to vary and are exempt from the collision rule. */
  'none',
] as const;

export type Archetype = typeof ARCHETYPES[number];

/** Categories exempt from the collision rule, because their members have no structure. */
export const COLLISION_EXEMPT_CATEGORIES = ['seo'] as const;
```

### 4b. `archetype` and `signature` on all 30 metas

Add exactly two fields to each component's existing `meta` object. **Do not touch `id`, `category`,
`label`, `consumes`, `sharedDeps` or `skins`** (§0.2 rule 7).

```ts
  /** Structural archetype, from src/lib/archetypes.ts. Unique within the category. */
  archetype: 'card-grid',
  /** True if this component owns a SIGNATURE motion moment (a scroll-linked transform, a pin,
   *  a count-up). Decision 26 budgets these per PAGE, not per section: at most two on a page,
   *  enforced by console/test/page-rhythm.test.mjs. Micro-reveals are free and do not count. */
  signature: false,
```

The assignment, all 30 files, under `console/src/components/catalog/`. Every value is the archetype
the component **is today**, not the one it will be: a `meta` that lies is worse than no `meta`.

| File | `archetype` | `signature` |
|---|---|---|
| `nav/NavMinimal.tsx` | `sticky-bar` | false |
| `nav/NavEmergencyBar.tsx` | `stacked-bars` | false |
| `pageHeader/PageHeaderSimple.tsx` | `centered-statement` | false |
| `hero/HeroSplit.tsx` | `asymmetric-split` | false |
| `hero/HeroFormFocus.tsx` | `form-led-split` | false |
| `hero/HeroOverlap.tsx` | `full-bleed-overlay` | false |
| `trust/TrustBadges.tsx` | `inline-strip` | false |
| `trust/TrustReviewsAggregate.tsx` | `aggregate-badge` | false |
| `trust/ServiceArea.tsx` | `map-list` | false |
| `about/AboutFeature.tsx` | `count-up-centerpiece` | **true** |
| `about/AboutStory.tsx` | `asymmetric-split` | false |
| `services/ServicesGrid.tsx` | `card-grid` | false |
| `services/ServicesAccordion.tsx` | `sticky-swap` | false |
| `services/ServicesPanel.tsx` | `dense-mosaic` | false |
| `work/RecentJobsGrid.tsx` | `card-grid` | false |
| `work/BeforeAfter.tsx` | `before-after` | false |
| `testimonials/TestimonialsGrid.tsx` | `dense-mosaic` | false |
| `testimonials/TestimonialsCarousel.tsx` | `snap-carousel` | false |
| `faq/FaqAccordion.tsx` | `accordion` | false |
| `faq/FaqStickyAside.tsx` | `sticky-swap` | false |
| `finalCta/FinalCtaBanner.tsx` | `full-bleed-band` | false |
| `finalCta/FinalCtaSimple.tsx` | `centered-statement` | false |
| `finalCta/FinalCtaSplit.tsx` | `overlap-split` | false |
| `contact/ContactSplit.tsx` | `asymmetric-split` | false |
| `contact/ContactCardOverlap.tsx` | `overlap-split` | false |
| `contact/ContactInlineStrip.tsx` | `inline-strip` | false |
| `footer/FooterColumns.tsx` | `column-grid` | false |
| `footer/FooterMinimal.tsx` | `inline-strip` | false |
| `seo/SeoDefault.tsx` | `none` | false |
| `seo/SeoLocalBusiness.tsx` | `none` | false |

Three things to notice, because each is a judgement the executor must not re-make:

- **`work/RecentJobsGrid.tsx` is `card-grid` today**, not `hero-first-grid`. Its grid is
  `grid gap-4 sm:grid-cols-2 lg:grid-cols-3` with no span variation. Phase 7 recomposes it
  and changes this value to `hero-first-grid` in the same commit as the recompose. Declaring the
  aspiration now would make the collision lint green against a layout that does not exist.
- **`about/AboutFeature.tsx` is the one `signature: true`.** It uses `useCountUp`. SPEC §9 cut
  count-up and decision 18 restored it for a stats band only; `AboutFeature` still has it today, so
  it is declared honestly. Phase 8 adds `stats/StatsBand` as a second one, and Phase 9 places them on different page templates for exactly this reason.
- **`card-grid` appears twice** (services and work) and `inline-strip` three times (trust, contact,
  footer) and `asymmetric-split`, `overlap-split`, `centered-statement`, `dense-mosaic`,
  `sticky-swap` twice each. All legal: the rule is uniqueness **within a category**, not globally.
  Two categories using the same structure for different content is fine; two variants in one
  category doing it is the failure the rule exists to catch.

### 4c. Decision 30(b): remove the gradients

Nine occurrences in eight files, found by `grep -rn "gradient\|accent-grad"
console/src/components/catalog/`. Each substitution is specified so no design decision is made
mid-implementation.

| File, line | Today | Replace with | Why |
|---|---|---|---|
| `hero/HeroOverlap.tsx` ~64 | `bg-gradient-to-r from-ink/70 via-ink/30 to-transparent` | `bg-ink/55` | **The named tell.** Research §6 item 1 is "hero with a confident headline over a soft gradient." A flat scrim at a measured opacity does the same legibility job and reads as a deliberate plate, not a feather. |
| `services/ServicesPanel.tsx` ~83 | `bg-gradient-to-t from-ink/90 via-ink/45 to-ink/10` | `bg-ink/60` | Same tell, over a photo. |
| `contact/ContactCardOverlap.tsx` ~42 | inline `radial-gradient(120% 80% at 100% 0%, color-mix(...), transparent 60%), var(--ink-panel)` | `background: 'var(--ink-panel)'` | A soft accent glow is decoration, not structure. |
| `finalCta/FinalCtaSplit.tsx` ~45 | `bg-accent-grad p-10 text-white` | `bg-accent p-10 text-accentFg` | Two fixes in one line: the gradient goes, and `text-white` becomes the derived `--accent-fg`. `text-white` on an authored accent is the exact shipped defect `palette-contrast.test.mjs` exists to catch (`#ffffff` on `#e08b29` is 2.66:1). |
| `about/AboutFeature.tsx` ~82 | `bg-accent-grad` | `bg-accent` | Flat accent panel. |
| `hero/HeroSplit.tsx` ~169 | `bg-accent-grad` on the image-absent placeholder panel | the AUTHORING_CONTRACT §3 fallback (below) | A placeholder should read as a placeholder, not as a branded gradient slab. |
| `services/ServicesAccordion.tsx` ~104 | `bg-accent-grad` image fallback | the §3 fallback | same |
| `work/BeforeAfter.tsx` ~19 | `bg-accent-grad` image fallback | the §3 fallback | same |
| `work/RecentJobsGrid.tsx` ~62 | `bg-accent-grad` image fallback | the §3 fallback | same |

The AUTHORING_CONTRACT §3 fallback, verbatim, so all four image-absent cases are identical:

```tsx
<div className="flex h-full w-full items-center justify-center bg-bgSoft
                bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.03)_10px,rgba(0,0,0,0.03)_20px)]">
  <span className="font-sans text-fine uppercase tracking-wide text-inkSoft">{caption}</span>
</div>
```

**Two patterns that stay and are allowed by name in the lint**, because neither is a gradient in
the sense the decision bans:

- `repeating-linear-gradient(45deg, …)`: the 45-degree hatch. It has hard stops, it is the
  contract's own mandated placeholder, and it reads as a technical fill. Occurrences:
  `hero/HeroOverlap.tsx` ~61 and the four fallbacks above.
- `radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)` with a `backgroundSize`, the dot
  grid. Also hard-stopped; it is a halftone, not a feather. Occurrences:
  `about/AboutFeature.tsx` ~85 and `finalCta/FinalCtaSplit.tsx` ~54.

`--accent-grad` itself stays derived in `packages/ui/src/palette.ts` and `bg-accent-grad` stays
registered in both Tailwind configs (decision 3: a shipped client repo has it baked into its
`page.tsx`). Phase 2 already added the deprecation comments. After this phase, **zero catalog
components use it**, which is the point.

### 4d. The tests

#### `C:\Users\Xander\Desktop\ops\jdd-ops\console\test\catalog-invariants.test.mjs` (MODIFIED)

Keep every existing test. Add an `ARCHETYPES` import and four new tests. The existing
`components()` helper already gives `{ name, category, rel, src }` for every file, so all four read
from `ALL`.

```js
import { ARCHETYPES, COLLISION_EXEMPT_CATEGORIES } from '../src/lib/archetypes.ts';
```

**Test: `every component declares a known archetype and a signature flag`**
```js
// Decision 23. A component without these is invisible to the collision lint and to
// page-rhythm.test.mjs's motion budget, so a missing field is a silent hole in both.
for (const c of ALL) {
  const a = /archetype:\s*'([a-z-]+)'/.exec(c.src);
  assert.ok(a, `${c.rel}: meta has no archetype`);
  assert.ok(ARCHETYPES.includes(a[1]), `${c.rel}: unknown archetype '${a[1]}'`);
  assert.match(c.src, /signature:\s*(true|false)/, `${c.rel}: meta has no signature flag`);
}
```

**Test: `no two variants in a category share an archetype`**
```js
// THE variety rule, decision 23, mechanical at last. Gap G6: the rule was prose in
// DESIGN-LANGUAGE.md and the catalog grew variants that were decorated copies of their siblings.
const byCat = new Map();
for (const c of ALL) {
  if (COLLISION_EXEMPT_CATEGORIES.includes(c.category)) continue;   // seo renders nothing
  const a = /archetype:\s*'([a-z-]+)'/.exec(c.src)[1];
  const seen = byCat.get(c.category) ?? new Map();
  assert.ok(!seen.has(a), `${c.category}: ${c.name} and ${seen.get(a)} are both '${a}'. ` +
    `Recompose one into a different structure (see console/DESIGN-LANGUAGE.md), do not decorate it.`);
  seen.set(a, c.name);
  byCat.set(c.category, seen);
}
```

**Test: `no uniform three-up card row (decision 30a)`**
```js
// Research §6 item 2: "three equal feature cards in a row, fading in on scroll." The tell is
// THREE EQUAL CARDS, not a 3-column grid over a client's real variable-length list:
// services/ServicesGrid renders every service the client has, commonly six, and is legitimate.
// So the ban is precise, and it is three clauses rather than a blanket grid-cols-3 regex:
const SPANNED = /col-span-|row-span-|grid-flow-dense/;
const ICON_CARD_CATEGORIES = ['differentiators', 'about', 'trust'];
const bad = [];
for (const c of ALL) {
  if (!/\bgrid-cols-3\b/.test(c.src)) continue;            // matches sm:/md:/lg: prefixes too
  if (/\.slice\(0,\s*3\)/.test(c.src)) { bad.push(`${c.rel}: grid-cols-3 over a hard-capped three`); continue; }
  if (!/\.map\(/.test(c.src))          { bad.push(`${c.rel}: grid-cols-3 with three literal children`); continue; }
  if (ICON_CARD_CATEGORIES.includes(c.category) && !SPANNED.test(c.src)) {
    bad.push(`${c.rel}: a uniform three-up in '${c.category}', which is where the tell lives`);
  }
}
assert.deepEqual(bad, [], 'get presence from span variation or from a different archetype entirely');
```
Verified against the catalog as it stands: `services/ServicesGrid.tsx`,
`work/RecentJobsGrid.tsx` and `testimonials/TestimonialsGrid.tsx` are the only three files
containing `lg:grid-cols-3`, and all three pass. `TestimonialsGrid` passes on span variation
(`col-span-2` plus `grid-flow-dense`); the other two pass because they map over the client's full
list in a category where the tell does not live. **No baseline allowlist is needed**, which is why
the rule is phrased this way rather than as a blanket ban with exceptions.

**Test: `no gradients (decision 30b)`**
```js
// Research §6 items 1 and 3. Two hard-stopped patterns are allowed by name because neither is a
// feather: the 45-degree hatch (AUTHORING_CONTRACT §3's own mandated image placeholder) and the
// 1px dot grid. Everything else, including bg-accent-grad, is out.
const ALLOWED = [/repeating-linear-gradient\(/g, /radial-gradient\(circle at 1px 1px/g];
const bad = [];
for (const c of ALL) {
  let src = c.src;
  for (const a of ALLOWED) src = src.replace(a, '');
  for (const m of src.matchAll(/bg-accent-grad|bg-gradient-to-|linear-gradient\(|radial-gradient\(/g)) {
    bad.push(`${c.rel}: ${m[0]}`);
  }
}
assert.deepEqual(bad, [], 'flat scrims and flat accent fills; --accent-grad is deprecated (decision 3 keeps it resolving for shipped repos only)');
```

**Test: `icons are solid and weighty (decision 30c)`**
```js
// SPEC §6: "Solid, weighty, literal." Research §4 names "generic line-art service icons" as part
// of the decorative vocabulary where the cheapness lives. Phosphor's thin/light/regular weights
// ARE line art. Measured on 2026-10-05 the catalog uses only bold and fill, so this test locks in
// a property the catalog already has rather than asking for a migration.
const bad = [];
for (const c of ALL) {
  for (const m of c.src.matchAll(/weight="(\w+)"/g)) {
    if (!['bold', 'fill'].includes(m[1])) bad.push(`${c.rel}: weight="${m[1]}"`);
  }
}
assert.deepEqual(bad, []);
```

#### `C:\Users\Xander\Desktop\ops\jdd-ops\console\test\page-rhythm.test.mjs` (NEW)

Three tests. **Tests 1 and 2 run now. Test 3 ships SKIPPED** and Phase 9 un-skips it,
because nothing applies a rhythm until that phase adds the `rhythm` field to `SectionRef`.

```js
import { test, skip } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGE_TEMPLATES } from '../src/app/c/[slug]/build/page-templates.tsx';

// PAGE-LEVEL invariants. Everything here is a property of a WHOLE PAGE, which is why it cannot
// live in catalog-invariants.test.mjs: a component cannot see the page it is placed on, and that
// is exactly why decision 24 puts rhythm at the template level.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_DIR = path.join(ROOT, 'src/components/catalog');

/** component name -> meta.signature, read from the file rather than restated. */
const SIGNATURE = new Map();
for (const cat of readdirSync(CATALOG_DIR)) {
  for (const f of readdirSync(path.join(CATALOG_DIR, cat))) {
    if (!f.endsWith('.tsx')) continue;
    const src = readFileSync(path.join(CATALOG_DIR, cat, f), 'utf8');
    SIGNATURE.set(f.replace('.tsx', ''), /signature:\s*true/.test(src));
  }
}

test('at most one inverted section per page (decision 12)', () => {
  // "One dark anchor section per page, maximum." Two dark bands on one page stops either of them
  // being an anchor, and the page reads as striped rather than as having a centre of gravity.
  for (const t of PAGE_TEMPLATES) {
    const inverted = t.sections.filter((s) => s.skin === 'inverted');
    assert.ok(inverted.length <= 1,
      `${t.id} has ${inverted.length} inverted sections: ${inverted.map((s) => s.name).join(', ')}`);
  }
});

test('at most two signature motion moments per page (decision 26)', () => {
  // Decision 26 TIGHTENS the old rule from one-per-section to one-or-two-per-PAGE. Research §5:
  // "the premium signal is not more animation, it is fewer, better-executed moments."
  // Micro-reveals (reveal/revealItem/revealStagger) are free and are not counted.
  for (const t of PAGE_TEMPLATES) {
    const sig = t.sections.filter((s) => SIGNATURE.get(s.name) === true);
    assert.ok(sig.length <= 2,
      `${t.id} places ${sig.length} signature components: ${sig.map((s) => s.name).join(', ')}`);
  }
});

// UN-SKIP THIS IN PHASE 9, which is the phase that adds `rhythm` to SectionRef and sets
// it on every template. It is written now, and skipped, so that phase has a test to turn on rather
// than a test to invent, and so the rule is reviewable before anything is built against it.
skip('section rhythm is never uniform (decision 30d)', () => {
  for (const t of PAGE_TEMPLATES) {
    const rhythms = t.sections.map((s) => s.rhythm);
    assert.ok(rhythms.every(Boolean), `${t.id}: every section needs an explicit rhythm`);
    assert.ok(new Set(rhythms).size >= 3,
      `${t.id}: only ${new Set(rhythms).size} distinct rhythms. Research §6 item 8 names uniform ` +
      `section rhythm as an AI-sameness tell and decision 30(d) bans it.`);
    for (let i = 2; i < rhythms.length; i++) {
      assert.ok(!(rhythms[i] === rhythms[i - 1] && rhythms[i] === rhythms[i - 2]),
        `${t.id}: three consecutive '${rhythms[i]}' sections at index ${i - 2}`);
    }
  }
});
```

Verified that tests 1 and 2 pass against the 11 templates as they stand: no current template sets
any `skin`, so test 1 counts zero; the only `signature: true` component is `about/AboutFeature`,
which no current template places, so test 2 counts zero. Both are therefore green on arrival and
become meaningful as Phase 9 fills the templates in.

#### `C:\Users\Xander\Desktop\ops\jdd-ops\console\DESIGN-LANGUAGE.md`

One addition, since Phase 0 wrote the archetype table and this phase makes it enforceable: under
the table, add

```
Archetype ids are declared in each component's `meta.archetype` and validated against
`src/lib/archetypes.ts`. `console/test/catalog-invariants.test.mjs` fails when two variants in one
category share an archetype, so "add a variant" means "add a structure", not "restyle a sibling".
`meta.signature` marks a component that owns a scroll-linked or count-up moment;
`console/test/page-rhythm.test.mjs` caps those at two per page (decision 26).
```

### Verification

```
cd /c/Users/Xander/Desktop/ops/jdd-ops/console && npm test && npm run build
```
`npm test` must now report **8** suites (the six that existed, plus `fonts.test.mjs` from Phase 3
and `page-rhythm.test.mjs`), with the one skipped test reported as skipped, not as passed.

Then prove the lints actually bite, which a green run does not. Make each failure happen on purpose
and confirm the message, then revert:

```
cd /c/Users/Xander/Desktop/ops/jdd-ops/console
# 1. collision lint
sed -i "s/archetype: 'accordion'/archetype: 'sticky-swap'/" src/components/catalog/faq/FaqAccordion.tsx
npm test 2>&1 | grep -i "are both 'sticky-swap'"     # must match
git checkout src/components/catalog/faq/FaqAccordion.tsx

# 2. gradient lint
#    add `className="bg-gradient-to-b"` to any catalog file, run npm test, expect the gradient
#    failure naming that file, then revert.

# 3. the three-up lint
#    add `.slice(0, 3)` next to an existing grid-cols-3, run npm test, expect the
#    "hard-capped three" failure, then revert.
```
Do all three. A lint nobody has seen fail is a lint nobody knows works.

Then confirm the gradients are gone for real:

```
grep -rn "bg-accent-grad\|bg-gradient-to-" /c/Users/Xander/Desktop/ops/jdd-ops/console/src/components/catalog/
# expect ZERO hits
grep -rn "text-white" /c/Users/Xander/Desktop/ops/jdd-ops/console/src/components/catalog/
# expect ZERO hits: on-accent text is text-accentFg, on-ink text is text-onInk
```

**User looks at:** `hero/HeroOverlap` and `services/ServicesPanel` in the console preview, before
and after, at the same viewport. The question is whether the flat scrim reads as a deliberate plate
rather than as a cheaper version of the gradient. Also `finalCta/FinalCtaSplit`, whose panel went
from a branded gradient to a flat accent fill, and whose label went from `text-white` to the
derived AA-correct foreground.

### Out of scope

Decision 30(d), uniform section padding: the test is written and skipped here, and Phase 9
turns it on when `SectionRef` gains `rhythm`. Building any new component. Changing any component's
layout beyond the nine gradient substitutions. Migrating components onto Phase 1's tokens. Removing
`parallaxY` from `@jdd/ui/motion` or adding the cut-effects lint, both of which are Phase 6 and depend on tag v1.0.4.

---

## Phase 5: settle the visual language in standalone HTML. USER GATE.

**Goal:** every visual decision Phases 6 to 13 implement is made and approved here, in HTML that is cheap
to throw away, before a single component is written.
**Discharges:** decisions 34, 37, 38, 1, 11, 13, 14, 15, 35 (HVAC only); research §8 items 2, 5, 7.

**This phase ends in a hard stop.** Nothing after this phase begins until the user has looked at the
mockups and said yes. Decision 34 exists because visual decisions made inside component code are
expensive to reverse and get defended rather than redone, and because an executor handed "build
`ServicesShowcase`" with no specimen will invent one. The four deliverables below are what turn
Phases 7 and 8 from design work into transcription.

**Use the `design-template` skill flow** (decision 34 names it). Its wireframe and mockup stages
produce exactly the tabbed single-file HTML this phase needs. If the skill's own flow conflicts with
the file names or contents specified below, the names and contents below win: later phases reference them by path.

### Inputs you must read first, and build the mockups ON

- `C:\Users\Xander\Desktop\ops\jdd-ops\design\catalog-v2\SPEC.md` in full. §3 (type), §4 (phone is
  the primary action), §5 (buttons), §6 (icons), §7 (trust is in the hero and repeats), §8
  (mobile-first at 390px, breakpoints 700 and 1000), §10 (images), §10a (never opacity on text),
  §11 (focus) are all binding on the mockups, not just on the components.
- `C:\Users\Xander\Desktop\ops\jdd-ops\console\design\RESEARCH-local-service-visual-design.md` §3
  (the Tier A conversion architecture that must survive), §4 (Tier A's decorative vocabulary, which
  is the list of things to avoid), §5 (the Tier B grammar to import), §6 (the eight AI tells).
- `C:\Users\Xander\Desktop\ops\jdd-ops\template\src\styles\tokens.ts` from Phase 1. **The mockups
  must use these exact values**, declared as CSS custom properties at the top of each file, so a
  specimen cannot be drawn at a size the components cannot reproduce.
- The Phase 2 warm palette, the Phase 3 `instrument` pairing, and the Phase 0 archetype table.
- `C:\Users\Xander\Desktop\ops\jdd-ops\console\design\home-premium-v1\mockups.html` and
  `...\multipage-v1\client-site-mockups.html` as format precedent only. Do not copy their palette
  or type; both predate decisions 9 and 6.

### Deliverable 1: `C:\Users\Xander\Desktop\ops\jdd-ops\console\design\foundation-v2\mockups-sections.html`

One self-contained HTML file, no build step, no external CSS or JS beyond the Google Fonts link for
Instrument Sans. A tab or anchor bar at the top to jump between specimens. Every specimen rendered
twice, at **390px** and at **1280px**, side by side or on adjacent tabs, because SPEC §8 composes
at 390 first and "desktop breakpoints may only add room, never add meaning."

Declare the token layer once, at the top, copied from Phase 1 and Phase 2:

```html
<style>
  :root{
    --accent:/* the HVAC accent you choose in Deliverable 4 */; --accent-fg:#FBF8F4;
    --bg:#FAF7F2; --bg-soft:#F1EBE2; --ink:#1A1512; --ink-soft:#584E45; --rule:#DFD6C9;
    --font: 'Instrument Sans', system-ui, sans-serif;
    --display-1: clamp(2.25rem, 1.42rem + 3.60vw, 3.625rem);
    --display-2: clamp(2rem, 1.62rem + 1.65vw, 2.625rem);
    --display-3: clamp(1.5rem, 1.35rem + 0.65vw, 1.75rem);
    --card-title: 1.3125rem; --lead: clamp(1.1875rem,1.13rem + .25vw,1.3125rem);
    --body: 1.0625rem; --small: .9375rem; --fine: .8125rem;
    --radius-control: 8px; --radius-panel: 14px;
    --shadow-slab: 0 1px 2px rgba(28,16,9,.05), 0 14px 30px -12px rgba(28,16,9,.22);
    --rh-tight: clamp(1.75rem,1.40rem + 1.60vw,2.75rem);
    --rh-normal: clamp(3rem,2.30rem + 3.20vw,5rem);
    --rh-loose: clamp(4.50rem,3.30rem + 5.40vw,8rem);
  }
</style>
```

**Fourteen specimens, one per thing a later phase builds.** Each must be labelled with its archetype id,
its target file path, and the phase that builds it, so transcription is unambiguous.

| # | Specimen | Archetype | Built by | What this specimen has to settle |
|---|---|---|---|---|
| 1 | **Sticky call bar** | n/a | Phase 6, `template/src/lib/StickyCallBar.tsx` | Decision 27: this gets the most design attention of anything. Settle: the digits at `--lead` weight 700 (SPEC §4 says digits, not the word "Call"), the assurance line at `--fine` under it, the 56px minimum tap target, the upward slab shadow, whether the availability badge reads urgent or neutral, and what it looks like sitting over the footer's last row. |
| 2 | `ServicesShowcase` | `editorial-index` | Phase 7 | Full-width numbered rows on hairline rules. Settle: numeral size and that numerals are **neutral ink, not accent** (decision 10); the rule weight; the hover image reveal's geometry; row height at 390 where there is no room for a reveal. |
| 3 | `ServicesSpotlight` | `stacked-panels` | Phase 7 | Full-width horizontal panels, one column, **no cursor glow** (decision 28 cuts it, and it was this component's entire identity in the old catalog). Settle: how hierarchy comes from panel height variation plus `--display-3` against `--card-title`, with no decoration doing that job. |
| 4 | `WorkSpotlight` | `feature-rail` | Phase 7 | Large feature panel plus a rail. Settle: the feature-to-rail ratio, the active-item cue (ink, not accent), and the 390px fallback where a side rail cannot exist. |
| 5 | `WorkMasonry` | `horizontal-pin` | Phase 7, **the only `signature: true` in wave 1** | Settle: how many cards are visible mid-pin, the scroll-to-translate ratio, and critically what the **reduced-motion fallback** looks like, which is an `overflow-x-auto` scroll-snap rail. Draw both. |
| 6 | `TestimonialsMarquee` | `marquee` | Phase 7 | **Drag and scroll driven, no autoplay** (SPEC §9 survives decision 21). Settle: the visible scroll affordance, because a rail with no affordance that also does not autoplay looks broken. |
| 7 | `RecentJobsGrid` recomposed | `hero-first-grid` | Phase 7 | Settle: the first cell spanning two rows and two columns, how it degrades to one column at 390, and what happens with four jobs versus nine. |
| 8 | `DifferentiatorsIndex` | `editorial-index` | Phase 8 | Reads `about.pillars`. Settle how this differs visibly from specimen 2, since they share an archetype across categories. |
| 9 | `DifferentiatorsPanels` | `stacked-panels` | Phase 8 | Same, against specimen 3. |
| 10 | `DifferentiatorsRail` | `inline-strip` | Phase 8 | The high-on-the-page differentiator strip research §3 says recurs in nearly every teardown. Settle: how it carries four claims in one band without becoming four equal icon cards (decision 30a). |
| 11 | `StatsBand` | `count-up-centerpiece` | Phase 8, `signature: true` | Reads `about.stats`. Settle: the figure size, that the figures are **neutral** (decision 10), and the still state, which must render the final value immediately. |
| 12 | `StatsLedger` | `numbered-ledger` | Phase 8 | Settle how figures-as-a-ledger-on-rules differs from specimen 11 structurally, not decoratively. |
| 13 | `AboutSticky` | `sticky-swap` | Phase 8 | Settle the sticky panel's offset and its 390px collapse. |
| 14 | `FaqIndex` | `editorial-index` | Phase 8 | Third use of `editorial-index`, in a third category. Settle: a question index with no media reveal. |

**Rules binding on every specimen, each traceable to a decision or a measured defect:**

- **Mobile first.** Compose at 390. If an element appears only above a breakpoint it is decoration
  and must be cut, not hidden (SPEC §8). The old catalog hid its review badge behind
  `hidden lg:block`; SPEC §7 bans that explicitly.
- **No accent on eyebrows, rules, icons or numerals** (decision 10). Accent appears on the primary
  CTA and on genuine urgency. Colour interest comes from photography. If a specimen looks flat
  without accent, the structure is too weak and that is the finding, not a reason to add accent.
- **No gradients** (decision 30b). Flat scrims over photography.
- **No three equal cards in a row** (decision 30a).
- **No wide-tracked uppercase eyebrows, no `-rotate-90` edge labels, no ghost numerals, no hairline
  section dividers** (SPEC §3's cut list; the first is already a failing lint).
- **No opacity on text** (SPEC §10a). Hierarchy from size and weight.
- **Every `<img>` carries `width` and `height`** matching its wrapper ratio (SPEC §10; omitting it
  measured CLS 0.193).
- **Nothing above the fold animates on load** (SPEC §9; measured, 84% of a 4.2s LCP).
- **Focus: `3px solid var(--accent-text)` at `outline-offset: 3px`** on every focusable element,
  including inside inverted sections (SPEC §11). Draw a focused state for at least one button and
  one input.
- **No em-dashes in any copy in the file** (§0.2).
- **Copy must be specific, and must not invent client facts.** Research §6 item 6 names vague copy
  as a tell and decision 29 makes specificity an intake demand. Use the `hvac` preset's own strings
  from `console/src/data/verticals/hvac.ts` where they exist, and where a specimen needs a fact the
  preset does not have (an owner name, a license number), write a visibly bracketed placeholder
  like `[owner name, from intake]` rather than a plausible invention. That bracket is the point: it
  shows the user which fields Phase 13 has to add to intake.

### Deliverable 2: `C:\Users\Xander\Desktop\ops\jdd-ops\console\design\foundation-v2\mockups-hvac-subpages.html`

Same token header, same dual-width treatment. Decision 19: several distinct page-header
archetypes, so subpages stop opening identically on every client site.

Six specimens:

1. `PageHeaderSimple` as it is today (`centered-statement`), as the baseline to differ from. Read
   `console/src/components/catalog/pageHeader/PageHeaderSimple.tsx` and reproduce it honestly.
2. `PageHeaderEditorial` (`editorial-index`).
3. `PageHeaderOverlap` (`overlap-split`).
4. `PageHeaderMinimal` (`inline-strip`).
5. A full **`service-standard`** page, top to bottom: `PageHeaderOverlap` at `rh-bleed`,
   `ServicesAccordion` at `rh-normal`, `BeforeAfter` at `rh-loose`, `FaqStickyAside` at `rh-normal`,
   `FinalCtaBanner` at `rh-tight`. This is the specimen that settles **rhythm**, which is the one
   thing no single-section mockup can show.
6. A full **`service-proof`** page: `PageHeaderEditorial` at `rh-normal`,
   `DifferentiatorsIndex` at `rh-loose`, `TestimonialsGrid` at `rh-normal`, `ServiceArea` at
   `rh-tight`, `ContactInlineStrip` at `rh-tight`.

For 5 and 6, annotate each section with its `rh-*` class in a visible margin label, and include
**one inverted section and no more** (decision 12). These two specimens are what the user is
actually approving when they approve "the rhythm", so the vertical spacing must be drawn to the
real `--rh-*` values, not eyeballed.

All four page headers must take the same data shape, because `compose-page.tsx` and `wirePages`
both construct them by prop name: `{ data: PageHeaderContent; editPrefix?: string }` where
`PageHeaderContent` is `{ eyebrow, title, sub, cta }`. Read `PageHeaderSimple.tsx` and match. A
header archetype that needs a fifth field is out of scope, because the field does not exist in the
schema and §0.2 rule 3 applies.

### Deliverable 3: `C:\Users\Xander\Desktop\ops\jdd-ops\console\design\foundation-v2\photography.md`

The photography direction, and the curated image set Phase 11 transcribes into
`console/src/data/image-placeholders.ts`'s `hvac` entry.

Decision 13 is deliberate and uncomfortable: we keep shipping stock placeholders, with no go-live
gate, while the research says stock is the single largest cheapness and distrust signal in this
exact sector. Decision 15 is what makes it survivable: **enforced aspect ratios, focal crops, and
one subtle unified grade**, which is what makes mixed-quality source material read as one
professional set and is also what stops curated stock reading as stock. State that tension at the
top of the file, in those terms, so nobody later mistakes the policy for an endorsement.

Contents:

1. **The shot list**, from research §4, as a client deliverable checklist: team group photo in
   branded uniforms (home, about); action shots on the job including tight shots of hands working
   (home, service pages); individual headshots especially leadership (about); branded truck and
   equipment (home); before and after pairs (service pages); customer handshake at job completion
   (testimonials); smiling family with the finished work (case studies); seasonal work (blog);
   behind the scenes office and dispatch (about).
2. **The slots that actually exist in the schema**, mapped to shot-list items. Read
   `console/src/data/image-placeholders.ts` and list exactly: `images.hero.portrait`,
   `images.hero.slides[].url`, `images.about.feature`, `services.items[].image.url`,
   `work.projects[].image.url`, `images.testimonials.avatars[]`, `images.footer.logoImage`. A shot
   with no slot is a note for a future schema change, not a thing to add now.
3. **The curated HVAC set.** One `images.unsplash.com` photo id per slot, each chosen against the
   shot list, each with the `alt` string Phase 11 will ship. Rules:
   - **Verify every URL returns 200 before writing it down.** A dead placeholder ships a broken
     image, and `image-placeholders.ts`'s own header says "THESE URLS SHIP."
   - Prefer real working scenes over posed studio people. Research §4: sites without crew or
     customer faces above the fold are consistently criticised; sites leading with a real photo of
     owners or crew in front of the service vehicle are consistently praised. Choose accordingly,
     while being honest in the `alt` that this is not yet the client's own crew.
   - **No AI-generated imagery for people, crew, or completed work** (decision 14). AI is allowed
     only for abstract texture or a background plate where nothing is claimed. Note which, if any,
     of the chosen plates are in that category.
   - **No em-dashes in any `alt` string** (§0.2).
   - Write each entry as `slot | photo id | ratio key | alt`.
4. **The ratios**, one per slot, which Phase 11 encodes as its `RATIOS` constant:
   `hero 16/10`, `aboutFeature 4/5`, `service 3/2`, `work 3/2`, `avatar 1/1`. If a chosen photo
   cannot survive its ratio with a saliency crop, choose a different photo rather than changing the
   ratio: decision 15 says the ratios are enforced.
5. **The grade, as one fixed recipe, and it is two passes, not three.** Phase 11 applies, in this
   order, to every image except logos: `modulate({ saturation: 0.88, brightness: 1.02 })`, then
   `linear(1.04, -6)`. **There is no `tint()` pass. Decision 55 drops it.** An earlier draft of
   this plan ended the recipe with `.tint('#FFF8F0')`; do not reinstate it. The reason is that
   decision 9 has already moved every page ground to a warm unbleached neutral (`bg #FAF7F2`,
   `bgSoft #F1EBE2`) and the ink to warm charcoal, so a warm tint laid over the photography on top
   of that pushes the whole page toward sepia. The saturation and contrast passes are what
   actually make mixed-quality photos cohere; the tint was only ever adding warmth the palette now
   supplies. State explicitly that there is exactly **one** grade (`grade: 'house'` is the
   only legal value in Phase 12's `VerticalLanguage`), and why: one recipe is what makes mixed
   sources read as one set. Include a before and after of one image in the mockup file so the user
   can see what the grade does, since no amount of prose settles it. Logos skip the crop and the
   grade, because a logo must not be recoloured.
6. **The `subjects` list** Phase 12 copies into `VERTICAL_LANGUAGES.hvac.photography`:
   four to six short noun phrases naming what an HVAC photograph should be of. No em-dashes.

### Deliverable 4: `C:\Users\Xander\Desktop\ops\jdd-ops\console\design\foundation-v2\VERTICAL-LANGUAGE-hvac.md`

The HVAC vertical's design language, on exactly the four axes Phase 12 types. Writing it
here, in prose, before it is typed, is what keeps it thin: a fifth axis would be obvious as prose
and is invisible as a type field.

Structure the file as the four axes and nothing else. **Do not add a fifth.** §0.6 is the rule, and
Phase 12's `vertical-language.test.mjs` asserts
`Object.keys(VERTICAL_LANGUAGES.hvac) === ['pairingId','palette','photography','rhythm']`.

1. **`pairingId`**: `'instrument'`. State why against the other four from Phase 3's table.
2. **`palette`**: the seven slots, as hexes. `bg`, `bgSoft`, `ink`, `inkSoft`, `rule` are the Phase
   2 shared warm set; `accent` and `accentFg` are the HVAC decision. **Decision 11 governs the
   accent**: honour the trade colour convention and execute it at a higher level. The convention is
   blue plus red or orange, encoding cool and warm literally, and the research notes the industry
   treats breaking it as noteworthy. So: a sophisticated, desaturated tone of that coding, not a
   saturated primary. The current `hvac.ts` accent is `#E05C2A`, a saturated orange that is exactly
   the Tier A register. Propose a replacement and **justify it with measured contrast**:
   - run it through `console/test/helpers/contrast.mjs`'s `assertPaletteAA` before writing it down;
   - record `--accent-text`, `--accent-fg` and `--urgent` as the derivation produces them, and the
     ratio of each on `bg` and `bgSoft`;
   - remember `--urgent` is a fixed alert red pulled only as far as legibility requires, and that a
     brand accent close to red collides with it. If the proposed accent is within sight of
     `#B3251A`, say so and pick differently: urgency only works as a signal if it reads as a
     different thing from the brand.
3. **`photography`**: `subjects` (from Deliverable 3 item 6), `grade: 'house'` (the only value),
   `ratioBias`: one of `'wide' | 'tall' | 'square'`, with one sentence of reasoning.
4. **`rhythm`**: `homeTemplateId` (which of Phase 9's three home templates HVAC defaults to; the
   plan expects `'home-standard'`) and `proofSkin` (which skin the proof section takes; Phase 12 expects
   `'soft'`). Both must be values that exist: `homeTemplateId` must name a real `PAGE_TEMPLATES` id
   with `pageType === 'home'`, and `proofSkin` must be a real `SkinId`.

Close the file with a short section headed **"What HVAC does NOT get"**, listing: no HVAC-only
component, no HVAC-only page template, no second grade, no extra axis. Quote §0.6's escalation
rule. This section is cheap to write now and is the thing a future vertical cycle will read when it
is tempted.

### Verification

Mockups are HTML with no build step, so the code gate is the two repos still being green plus the
files existing and being self-contained:

```
cd /c/Users/Xander/Desktop/ops/jdd-ops/console  && npm test && npm run build
cd /c/Users/Xander/Desktop/ops/jdd-ops/template && npm run build
ls -la /c/Users/Xander/Desktop/ops/jdd-ops/console/design/foundation-v2/
# mockups-sections.html, mockups-hvac-subpages.html, photography.md,
# VERTICAL-LANGUAGE-hvac.md, NOTES.md

# self-contained: the only external reference may be the Google Fonts stylesheet
grep -oE '(src|href)="https?://[^"]+' console/design/foundation-v2/mockups-sections.html | sort -u
grep -oE '(src|href)="https?://[^"]+' console/design/foundation-v2/mockups-hvac-subpages.html | sort -u
# expect only fonts.googleapis.com / fonts.gstatic.com and images.unsplash.com

# no em-dashes in the deliverables. U+2014 is the em-dash, written here as a regex escape so
# this command contains none itself.
grep -rnP '\x{2014}' console/design/foundation-v2/
# expect ZERO hits

# every curated photo URL resolves
# (for each id in photography.md)
curl -s -o /dev/null -w '%{http_code} %{url_effective}\n' "https://images.unsplash.com/photo-<id>?w=800"
# every line must start 200
```

Then open both HTML files **directly in a real browser** (`file://`), not in the console preview
pane: §0.4 means the preview pane freezes CSS transitions and framer-motion, and these mockups have
hover states and a pinned scroll specimen that must actually run. Check each specimen at 390px and
1280px using DevTools device emulation.

### The user gate

Stop here and present, explicitly:

- the two HTML files, by `file://` path, with a one-line note of what each tab is;
- the proposed HVAC accent, with its measured `--accent-text` / `--accent-fg` / `--urgent` ratios;
- the grade before-and-after;
- any bracketed `[from intake]` placeholder you had to use, as the list of fields Phase 13
  must add;
- anything you could not resolve without a design decision this plan did not make.

**The three questions the user is answering**, and they should be asked in these terms:

1. **Does it look expensive?** Research §2: the thesis is Tier B's visual language on Tier A's
   conversion architecture, and nobody is serving that overlap. If a specimen still reads like a
   WordPress trades template, say which and why.
2. **Does it still convert?** Walk SPEC §4 and §7 and research §3's non-negotiables against
   specimen 1 and the two full page specimens: tap-to-call, sticky mobile call, named service area,
   review aggregate above the fold at every breakpoint, license displayed, form at six fields or
   fewer. Aesthetics is the axis being improved, so the conversion architecture is the thing that
   must not regress.
3. **Is each specimen a different structure, or the same structure restyled?** This is gap G6 and
   decision 23. Specimens 2, 8 and 14 all claim `editorial-index`; 3 and 9 both claim
   `stacked-panels`; 11 and 12 are both figures. If any pair reads as one treatment twice, the
   catalog will not deliver variety no matter how many variants it has, and the fix is here, not in
   the later phases.

**Do not begin any later phase until the user has answered.** If the answer is "not yet", iterate
in HTML. That is the entire reason this phase exists and it is far cheaper than iterating in
components, in two repos, behind a `@jdd/ui` release.

**User looks at:** `console/design/foundation-v2/mockups-sections.html` and
`mockups-hvac-subpages.html` in a real browser at 390px and 1280px, plus the proposed HVAC accent
and the graded image pair.

### Out of scope

Any `.tsx` file. Any registration (§0.5). The other five verticals: decision 37 makes each its own
later cycle, and each is a Phase 5 repeat plus a `VERTICAL_LANGUAGES` entry plus a
`console/src/data/verticals/<id>.ts` palette plus an `image-placeholders.ts` curation, with **no
new components** (§0.6). Any change to `console/src/data/image-placeholders.ts` itself: that is
Phase 11a, which transcribes Deliverable 3.

---

## What the foundation phases leave behind

Phases 0 to 5 are the shared foundation (decision 37). Everything from Phase 6 onward consumes
this table, so if an artifact here is missing or wrong, the phase that consumes it will produce a
plausible-looking wrong answer rather than an error:

| Artifact | Created by | Consumed by |
|---|---|---|
| Prerequisite P4's `@jdd/schema` v1.20.0 (`PageHeaderContent`, `SectionStyle`, `detail`, `subpages`) | prerequisites | Phases 8, 9, 10, 13 |
| §0.3 release-and-repin loop | this document | Phases 6, 7, 8, 11, 13 |
| §0.4 hidden-preview constraint | this document | every phase with a visual gate |
| §0.5 registration touchpoint list | this document | Phases 7, 8 |
| §0.6 escalation rule | this document | Phase 12 |
| Reconciled archetype table, SPEC §9 amendment | Phase 0 | Phases 7, 8 |
| `template/src/styles/tokens.ts`, `rhythm.plugin.ts`, the `../template/src/lib/**` glob | Phase 1 | Phases 6, 7, 8, 9 |
| `@jdd/ui` v1.0.3, `console/test/helpers/contrast.mjs` | Phase 2 | Phases 6, 12 |
| `FONT_PAIRINGS`, `pairingFor`, the `'instrument'` pairing | Phase 3 | Phase 12 |
| `meta.archetype` / `meta.signature`, `catalog-invariants` bans, `page-rhythm.test.mjs` with test 3 skipped | Phase 4 | Phases 6, 7, 8, 9 |
| `foundation-v2/mockups-sections.html`, `mockups-hvac-subpages.html`, `photography.md`, `VERTICAL-LANGUAGE-hvac.md` | Phase 5 | Phases 7, 8, 11, 12 |
| `foundation-v2/NOTES.md` | Phase 0, appended every phase | the whole upgrade |

The dependency graph, the `@jdd/ui` tag sequence and the critical-files list are at the end of
this document. Continue below, at Phase 6, once the Phase 5 user gate is passed.

---

## Phase 6: Page chrome, the sticky call bar and the scroll layer

**Goal:** the highest-ROI conversion element becomes a designed component, and the page gains a
smooth-scroll surface.
**Discharges:** G7; decisions 25, 26, 27, 28, 54.

### Files created

**`C:\Users\Xander\Desktop\ops\jdd-ops\template\src\lib\StickyCallBar.tsx`** (NEW, `'use client'`)

Decision 27: this is on screen constantly and is the highest-ROI conversion element, so it gets
the most design attention of anything on the site.

- Mobile only (`lg:hidden`). It is noise on desktop where the nav already carries a tappable
  number (SPEC §4 requires the nav phone at every breakpoint, so a desktop duplicate is noise).
- Appears only after the hero has scrolled past: a single `IntersectionObserver` on `#top` (the
  id `HeroSplit` already sets on its `<section>`), not a scroll listener. Falls back to
  always-visible when `#top` is absent, so a hero variant without that id never hides the bar.
- Renders **the digits**, not the word "Call" (SPEC §4), at `text-lead font-extrabold`, with the
  assurance line beneath at `text-fine`. Minimum 56px tap target.
- `bg-accent text-accentFg`, `rounded-control` on the inner button, `shadow-slab` upward.
  **No gradient** (decision 30b). No opacity on any text sitting on the accent (SPEC §10a, and
  the existing `catalog-invariants` opacity lint).
- `urgent` tone only if `badge` is supplied and reads as availability ("24/7", "Open now");
  otherwise neutral.
- Adds `padding-bottom` to `<body>` equal to its own height while visible, via a sibling spacer
  div, so it can never cover the footer's last row.
- Entrance: a single CSS transform transition, gated on
  `window.matchMedia('(prefers-reduced-motion: reduce)')`, when it matches, the bar appears
  with no transition. Do **not** import `stillFor` here: it takes a `SkinId` and this element
  has no skin.
- `aria`: the `<a>` carries `aria-label={`Call ${phone}`}`; the bar is a
  `<div role="region" aria-label="Call us">`.

**`C:\Users\Xander\Desktop\ops\jdd-ops\template\src\lib\SmoothScroll.tsx`** (NEW, `'use client'`)

Decisions 25 and 54. **Lenis ships. There is exactly one path here and no fork to decide.**
Decision 25 left the library as "Lenis or equivalent" and an earlier draft of this plan offered a
zero-dependency `scroll-behavior: smooth` fallback "if lenis is rejected for bytes". **Decision 54
closes that: the CSS-only fallback is not taken.** Do not add it, do not evaluate it, do not note
a choice in `NOTES.md`. At ~10KB gzipped behind a dynamic import with `ssr: false`, it is not in
the first-paint critical path at all.

Renders nothing; a single `useEffect` that:
- returns immediately if `window.matchMedia('(prefers-reduced-motion: reduce)').matches`: Lenis
  is never constructed, not merely stopped;
- returns immediately if `window.self !== window.top`. **Load-bearing**: the console preview
  runs inside `PreviewFrame`'s iframe, and a smooth-scroll hijack there would fight the studio's
  own scroll container. The preview pane freezes animation anyway (§0.4), so there is nothing to
  see and everything to break;
- otherwise dynamically `await import('lenis')`, constructs with
  `{ duration: 1.05, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)) }`, drives it from
  `requestAnimationFrame`, and destroys it in the cleanup.

Import it from the layout with `next/dynamic` and `ssr: false` so it is never in the first-paint
critical path. `PERF.md` and `template/src/lib/fonts.loader.ts` both document how expensive
blanket byte additions have been here; `lenis` is ~10KB gzipped and the four guards above are
what make it acceptable.

**All four guards are mandatory and none is optional:** the dynamic `import('lenis')`, the
`ssr: false` on the `next/dynamic` call, the `prefers-reduced-motion` early return that never
constructs Lenis at all, and the `window.self !== window.top` iframe check. Dropping any one of
them is a regression, not a simplification.

### Files modified

**`C:\Users\Xander\Desktop\ops\jdd-ops\template\package.json`**: add `"lenis": "^1.1.18"` to
`dependencies`. The export route's `mergePackageJson` (`console/src/lib/export.ts` line ~290)
unions new template deps into an existing client repo without dropping the client's own, so
existing repos pick it up on the next export.

**`C:\Users\Xander\Desktop\ops\jdd-ops\console\package.json`**: add the same `lenis` entry, only
so the console typechecks the dynamic import.

**`C:\Users\Xander\Desktop\ops\jdd-ops\template\src\app\layout.tsx`**
- `import StickyCallBar from '@/lib/StickyCallBar';`
- `const SmoothScroll = dynamic(() => import('@/lib/SmoothScroll'), { ssr: false });`
- Inside `<body>`, after `{children}` and before `<Analytics />`:
```tsx
<SmoothScroll />
<StickyCallBar
  phone={CONTENT.brand.phone}
  phoneHref={CONTENT.brand.phoneHref}
  assurance={CONTENT.hero.trust || null}
  badge={CONTENT.announcement || null}
/>
```
Guard both brand fields: render `null` from `StickyCallBar` when `phoneHref` is empty, so a client
mid-intake does not ship a dead `tel:` link.

**`C:\Users\Xander\Desktop\ops\jdd-ops\console\src\app\c\[slug]\build\PageStudio.tsx`**
The preview must show the bar or the operator cannot design it. Inside the `mode="flow"`
`PreviewFrame` (line ~234), after `editableNodes`, render `<StickyCallBar ... />` imported from
`@template/lib/StickyCallBar`. It will self-disable inside the iframe only for `SmoothScroll`,
not for the bar: the bar's `window.self !== window.top` check does not exist, by design. Its
`IntersectionObserver` works inside the iframe.

**`C:\Users\Xander\Desktop\ops\jdd-ops\console\tsconfig.json`**: add
`"../template/src/lib/StickyCallBar.tsx"` to `include`. The `../template/src/lib/**` content glob
added in Phase 1 is what makes its Tailwind classes generate; this is what makes tsc see it.

### Files modified: the motion-budget cleanup (decisions 26, 28)

**`C:\Users\Xander\Desktop\ops\jdd-ops\packages\ui\src\motion.ts`**
- Mark `parallaxY` `@deprecated` in its JSDoc with "Cut by decision 28 (ornamental). Retained so
  an already-exported client repo keeps compiling; `verifyCatalogImports` reads this module's
  exports, and removing a symbol a shipped component imports is exactly the `parallaxY` failure
  this file's history records. Do not use in new components."
- Keep `clipReveal`, `reveal`, `revealItem`, `revealStagger`, `stillFor`, `EASE`, `viewportOnce`
  unchanged.
- Add a header note: "**Motion budget is per PAGE, not per section** (decision 26): at most two
  sections on a page may own a signature moment, enforced by
  `console/test/page-rhythm.test.mjs`. Micro-reveals are free."

Then run the §0.3 `@jdd/ui` loop and tag **v1.0.4**.

**`C:\Users\Xander\Desktop\ops\jdd-ops\console\test\catalog-invariants.test.mjs`**: add
`no component uses the cut signature effects`: ban `parallaxY` and any `onMouseMove`-driven
CSS-variable cursor glow (`--mx`/`--my` set from a pointer handler) in the catalog. Grep first to
see which files currently use them; if `services/ServicesPanel.tsx` or `services/ServicesSpotlight`
patterns appear, strip them in this phase rather than deferring.

### Verification
```
cd /c/Users/Xander/Desktop/ops/jdd-ops/console  && npm run build && npm test
cd /c/Users/Xander/Desktop/ops/jdd-ops/template && npm run build
cat console/node_modules/@jdd/ui/package.json | grep '"version"'   # 1.0.4
```
Then a real-browser check, which the console preview cannot give you:
`cd template && npm run dev`, open `http://localhost:3000` at a 390px viewport, scroll past the
hero, confirm the bar slides in and the number dials. Set `prefers-reduced-motion: reduce` in
DevTools Rendering and confirm the bar appears instantly and the scroll is native.

**User looks at:** the sticky call bar on a phone-width window of the template dev server, and
the scroll feel.

### Out of scope
Making the call bar operator-configurable or skinnable. Lenis inside the console preview. Any
catalog component change beyond stripping cut effects.

---

## Phase 7: Catalog wave 1, the archetypes DESIGN-LANGUAGE.md promised

**Goal:** make Phase 0's archetype table true.
**Discharges:** G5 (completion), G6 (partly); decisions 21, 22, 23, 28.

Transcribe from `console/design/foundation-v2/mockups-sections.html`. Every file follows
`studio/catalog/AUTHORING_CONTRACT.md` and its §10 checklist, uses Phase 1 tokens instead of
arbitrary values, and declares `archetype` + `signature`.

| New / changed file | archetype | signature | skins | notes |
|---|---|---|---|---|
| `console/src/components/catalog/services/ServicesShowcase.tsx` (new) | `editorial-index` | false | `[DEF, SOFT]` | Full-width numbered rows on hairline rules; image reveals on hover via CSS only. Numerals **neutral**, not accent (decision 10). Numbers come from `services.items[].n`. |
| `console/src/components/catalog/services/ServicesSpotlight.tsx` (new) | `stacked-panels` | false | `[SOFT, DEF, INV]` | Full-width horizontal panels, one column. **No cursor glow** (decision 28): that was this component's entire identity in the old catalog and it is cut. Hierarchy from panel height variation and `display-3` vs `card-title`. |
| `console/src/components/catalog/work/WorkSpotlight.tsx` (new) | `feature-rail` | false | `[DEF, INV]` | Large feature panel + rail of `work.projects`; `useState` + `AnimatePresence` swap. Must `return null` when `work.hidden === true` and when `projects.length === 0`. |
| `console/src/components/catalog/work/WorkMasonry.tsx` (new) | `horizontal-pin` | **true** | `[DEF, SOFT]` | `position: sticky` section + a framer-motion `useScroll` horizontal transform. **No GSAP.** When `stillFor(skin, reduce)` is true, render as `overflow-x-auto` + `scroll-snap-type: x mandatory` and bind no scroll transform. The only `signature: true` component in wave 1. |
| `console/src/components/catalog/testimonials/TestimonialsMarquee.tsx` (new) | `marquee` | false | `[SOFT, DEF]` | A **drag/scroll-driven** rail: `overflow-x-auto`, `scroll-snap`, visible scroll affordance. **No `setInterval`, no autoplay** (SPEC §9 survives decision 21). |
| `console/src/components/catalog/work/RecentJobsGrid.tsx` (recompose) | `hero-first-grid` | false | unchanged `[DEF, INV]` | Recompose to a CSS grid whose first cell spans 2 rows and 2 cols. **Do not rename the file** and **do not change `meta.id`, `category` or `consumes`**: `CATALOG`, `SKINS`, `categories.tsx`, `PAGE_TEMPLATES` and two shipped client repos all key off the name. |

Resulting counts: services 5, work 4, testimonials 3, which matches Phase 0's reconciled note.

### Registration (per §0.5, for the five new files)
1. `CATALOG` in `console/src/lib/export.ts` line 43:
   `services: ['ServicesGrid','ServicesAccordion','ServicesPanel','ServicesShowcase','ServicesSpotlight']`,
   `work: ['RecentJobsGrid','BeforeAfter','WorkSpotlight','WorkMasonry']`,
   `testimonials: ['TestimonialsGrid','TestimonialsCarousel','TestimonialsMarquee']`.
2. `SKINS` in `packages/ui/src/skins.ts`: five new entries. Then the §0.3 loop, tag **v1.0.5**.
   Batch all five into this one release.
3. `categories.tsx`: five imports with their metas, five `VariantEntry` rows. No union changes
   (no new categories).
4. `PAGE_TEMPLATES`: Phase 9 places them; for now add each to at least one existing template so
   the studio shows them.

### Verification
```
cd /c/Users/Xander/Desktop/ops/jdd-ops/console && npm test && npm run build
```
`catalog-invariants` proves `CATALOG`/registry/`SKINS` agree, every `<img>` has width+height, no
gradients, no `grid-cols-3`, no archetype collisions. Then a real export: pick a template
containing each new component in the console and run Launch against a scratch slug: the export
route runs `npm install` + `npm run build` **inside the client repo**, which is the only thing
that proves the files are copy-paste portable.

**User looks at:** each new component in the console catalog picker, against the HVAC vertical,
compared side by side with its specimen in `mockups-sections.html`.

### Out of scope
`differentiators`, `stats`, page-header variants, `about`/`faq` third variants (Phase 8). Page
reordering (Phase 9).

---

## Phase 8: Catalog wave 2, new categories and coverage

**Goal:** the two new section categories, the page-header archetypes, and 3-4 variants in every
major category.
**Discharges:** G4 (prep), G6 (completion); decisions 18, 19, 22, 23.

### The schema decision that keeps this cheap

**`differentiators` reads `about.pillars` (`{k,t,d}[]`) and `stats` reads `about.stats`
(`{n,l}[]`).** Both already exist in `@jdd/schema`'s `SiteContent`, are already generated by the
copywriter (`console/src/lib/copy-schema.ts` `CopyResult.about.pillars` / `.stats`), and are
already editable in the Brand drawer. **Therefore, for these two new categories: no `@jdd/schema`
change, no version bump, no re-pin, no `copy-schema.ts` change, no `CopyWireframe.tsx` change for
them, and no `section-labels.ts` change.** This honours `AUTHORING_CONTRACT.md` §0's rule that
variety comes from design, never from new data fields.

Both must `return null` on an empty array (§5 of the contract).

**The one schema dependency this phase does have, and it is already satisfied.** The three new
page-header variants take `PageHeaderContent`, which is a **prerequisite P4** type: it was
uncommitted source in `jdd-schema` until P4 tagged it as `v1.20.0`. Confirm before you start that
it is published, because a missing type here fails as a `tsc` error rather than silently, which is
the good case:

```
grep -n 'PageHeaderContent' /c/Users/Xander/Desktop/ops/jdd-schema/dist/site.d.ts   # must hit
```

If it does not hit, P4 did not complete. Stop and finish the prerequisite; do not define a local
copy of the interface.

**Note on `CopyWireframe.tsx`:** Phase 10 restructures it (page grouping, the `subpages` case,
re-keyed verdicts). That is Phase 10's work and not this phase's, and the two do not conflict:
this phase adds no content section, so it adds no review surface.

### Files created

| File | archetype | signature | skins |
|---|---|---|---|
| `console/src/components/catalog/differentiators/DifferentiatorsIndex.tsx` | `editorial-index` | false | `[DEF, SOFT]` |
| `console/src/components/catalog/differentiators/DifferentiatorsPanels.tsx` | `stacked-panels` | false | `[SOFT, DEF, INV]` |
| `console/src/components/catalog/differentiators/DifferentiatorsRail.tsx` | `inline-strip` | false | `[DEF, SOFT]` |
| `console/src/components/catalog/stats/StatsBand.tsx` | `count-up-centerpiece` | **true** | `[INV, DEF]` |
| `console/src/components/catalog/stats/StatsLedger.tsx` | `numbered-ledger` | false | `[DEF, SOFT]` |
| `console/src/components/catalog/pageHeader/PageHeaderEditorial.tsx` | `editorial-index` | false | none (skinless, like `PageHeaderSimple`) |
| `console/src/components/catalog/pageHeader/PageHeaderOverlap.tsx` | `overlap-split` | false | none |
| `console/src/components/catalog/pageHeader/PageHeaderMinimal.tsx` | `inline-strip` | false | none |
| `console/src/components/catalog/about/AboutSticky.tsx` | `sticky-swap` | false | `[DEF, SOFT]` |
| `console/src/components/catalog/faq/FaqIndex.tsx` | `editorial-index` | false | `[DEF, SOFT, INV]` |

`StatsBand` uses `@/lib/useCountUp`, which exists in **both** `console/src/lib/useCountUp.ts` and
`template/src/lib/useCountUp.ts`, so `verifyCatalogImports` passes. Confirm the two are in sync
before relying on it (`diff console/src/lib/useCountUp.ts template/src/lib/useCountUp.ts`).
Decision 18 explicitly ships count-up, overriding SPEC §9; Phase 0 already recorded that
amendment. Gate it on `stillFor(skin, reduce)`: when still, render the final value immediately.

The three new page headers take the same `{ data: PageHeaderContent; editPrefix?: string }` props
as `PageHeaderSimple`. Read that file and match the signature exactly, because
`compose-page.tsx` line 40 and `wirePages`' `pageHeader` branch (`export.ts` line 626) both
construct them positionally by prop name.

### Registration (two new categories, the full §0.5 list)

- `console/src/lib/export.ts`: add `differentiators: [...]` and `stats: [...]` to `CATALOG`; add
  both ids to `BODY_SLOTS` (line 64) **between `trust` and `about`** for `differentiators` and
  after it for `stats`, matching the researched order.
- `console/src/app/c/[slug]/build/categories.tsx`: extend the `CategoryEntry['id']` union
  (line 52) with `'differentiators' | 'stats'`; extend `iconName` (line 54) with
  `'Lightning' | 'ChartBar'`; add two `CategoryEntry` objects; add the ten imports and variant
  rows. Check the icon name resolver wherever `iconName` is consumed and add the two new cases.
- `console/src/app/c/[slug]/build/page-order.ts`: `CANONICAL_ORDER` becomes
  `['nav','hero','trust','differentiators','services','work','stats','testimonials','faq','finalCta','contact','footer']`.
- `console/src/app/c/[slug]/build/nav-targets.ts`: no new anchors (neither category is a nav
  destination).
- `packages/ui/src/skins.ts`: the seven skinned new components. §0.3 loop, tag **v1.0.6**.
- Then: `grep -rn "'finalCta'" /c/Users/Xander/Desktop/ops/jdd-ops/console/src --include=*.ts --include=*.tsx`
  and resolve every hit not already covered. Known safe hits (no change needed):
  `copy-schema.ts`, `copy-brief/*`, `CopyWireframe.tsx`, `section-labels.ts`, all keyed by
  **content section**, not by catalog category.

### Verification
```
cd /c/Users/Xander/Desktop/ops/jdd-ops/console && npm test && npm run build
```
Then export a scratch client whose home template carries `differentiators` + `stats` and confirm
the client repo's own `npm run build` passes (this is what proves the new `BODY_SLOTS` ids wire
correctly through `wirePages`).

**User looks at:** the two new categories in the studio picker with three and two variants, and
all four page headers side by side against `mockups-hvac-subpages.html`.

### Out of scope
Any `@jdd/schema` change. A third nav/footer/seo variant (decision 22 caps chrome at two).
Process-steps and financing-strip sections: decision 18 considered and **did not select** them.

---

## Phase 9: Page structure, researched order, encoded rhythm, per-service pages

**Goal:** the default build stops omitting the trust layer, section rhythm stops being uniform,
and every service gets a page.
**Discharges:** G4; decisions 17, 19, 20, 24, 12, 30(d).

### 9a. Rhythm becomes a field on the section ref

**`console/src/lib/pages.ts`** (CLIENT-SAFE: no `node:fs`, no `server-only`, no `@/lib/export`):
```ts
/** Where a section sits in the page's vertical rhythm. Decided by the PAGE TEMPLATE, never by
 *  the component (decision 24), which is what makes decision 30d's non-uniform-padding ban
 *  enforceable at the only level that can see a whole page. Classes come from
 *  template/src/styles/rhythm.plugin.ts. */
export type SectionRhythm = 'bleed' | 'tight' | 'normal' | 'loose' | 'text';
export type SectionRef = { id?: string; categoryId: string; name: string; skin?: SkinId; rhythm?: SectionRhythm };
export const rhythmClass = (r?: SectionRhythm): string => (r ? `rh-${r}` : '');
```
Add to `validateComposition`: a page whose sections all share one rhythm throws
(`Page "<route>" uses a uniform section rhythm; decision 30d bans it.`), and a page with more
than one `skin === 'inverted'` throws (decision 12). Both run on the client, in the studio,
before an export request is built.

**`console/src/lib/export.ts`, `wirePages` (line 549)**: the `emit()` helper currently wraps a
section in a `sectionVars` div only when it carries a style. Extend it so a ref with a `rhythm`
also gets `rhythmClass(ref.rhythm)` on that wrapper, and so a ref with a rhythm but no style
still gets a `<div className="rh-loose">` wrapper. Keep the existing byte-identical output for a
ref with neither, so an unstyled legacy page's generated file does not change. Import
`rhythmClass` from `@/lib/pages` (already imported for `styleKeyFor`/`routePath`).

**`console/src/app/c/[slug]/build/PageStudio.tsx`, `SectionShell`**: apply
`rhythmClass(ref.rhythm)` to the inner `<div style={style}>` so the preview and the export agree.

**`console/test/page-rhythm.test.mjs`**: un-skip test 3 from Phase 4.

### 9b. The three home templates and the researched order

**`console/src/app/c/[slug]/build/page-templates.tsx`**: extend the `S()` helper to
`S(categoryId, name, rhythm?, skin?)` and replace the two home templates, adding a third. One
section per category, so the interim `homeLegacyView` flattening cannot lose one:

- **`home-standard`**, hero `HeroSplit` `bleed` → differentiators `DifferentiatorsIndex` `normal`
  → services `ServicesGrid` `loose` → trust `ServiceArea` `tight` → testimonials
  `TestimonialsGrid` `normal` → work `RecentJobsGrid` `bleed` → faq `FaqAccordion` `loose` →
  finalCta `FinalCtaBanner` `tight` + `skin: 'inverted'`
- **`home-bold`**, hero `HeroOverlap` `bleed` → stats `StatsBand` `tight` + `skin: 'inverted'` →
  differentiators `DifferentiatorsPanels` `loose` → services `ServicesShowcase` `normal` → trust
  `TrustReviewsAggregate` `tight` → work `WorkSpotlight` `bleed` → testimonials
  `TestimonialsMarquee` `normal` → finalCta `FinalCtaSplit` `loose`
- **`home-quiet`** (new), hero `HeroFormFocus` `normal` → trust `TrustBadges` `tight` →
  differentiators `DifferentiatorsRail` `text` → services `ServicesSpotlight` `loose` →
  testimonials `TestimonialsCarousel` `normal` → faq `FaqIndex` `text` → contact `ContactSplit`
  `loose` + `skin: 'inverted'`

Each satisfies research §3's order (hero → differentiators → services → service areas → proof →
work → faq → contact), one inverted section, at most one `signature: true` component, and at
least three distinct rhythms with no three consecutive repeats.

Also add rhythms to the existing nine non-home templates, and swap `PageHeaderSimple` for a
different page-header archetype in the second template of each page type (decision 19's point is
that subpages stop opening identically). Add a third template per core page type using the
wave-1 and wave-2 components.

**`console/src/app/c/[slug]/build/nav-targets.ts`**: the anchor table predates multi-page
routing; confirm `navLinksFor` is what actually feeds `content.nav` (export route line 162) and
that the anchor table is only used for dangling-link detection. Add `differentiators` and `stats`
only if that detection needs them.

### 9c. One page per service (decision 20)

**`console/src/lib/pages.ts`:**
- Add `'service'` to `PageTypeId`.
- Widen `isValidRoute` to allow exactly one slash: `/^[a-z0-9-]+(\/[a-z0-9-]+)?$/` and keep the
  `RESERVED_ROUTES` check against the **first** segment. `routePath()` already produces
  `src/app/services/ac-repair/page.tsx` from `'services/ac-repair'` with no change, and
  `navHref()` already yields `/services/ac-repair`.
- Raise `MAX_PAGES` from 7 to **16** (4 core + up to 3 optional + up to 9 services) and update
  the error message.
- Add:
```ts
/** One page per service (decision 20). Routes are services/<slug of item.t>. navVisible is
 *  false: these are linked from the services section, not the top nav, which would otherwise
 *  overflow. Header copy is derived from the client's own service item, never invented. */
export function servicePageRoutes(items: { t: string }[]): string[]
```
using `slugify` from `console/src/lib/slugify.ts`.

**`console/src/app/c/[slug]/build/page-templates.tsx`:**
- `PAGE_META.service = { route: '', label: 'Service' }`: the route is per-instance, so
  `pageFromType('service')` must not be used; add `servicePageFrom(item, route)` instead and make
  `pageFromType` throw for `'service'` with a message pointing at it.
- Two templates: `service-standard` (pageHeader `PageHeaderOverlap` `bleed` → services
  `ServicesAccordion` `normal` → work `BeforeAfter` `loose` → faq `FaqStickyAside` `normal` →
  finalCta `FinalCtaBanner` `tight`) and `service-proof` (pageHeader `PageHeaderEditorial`
  `normal` → differentiators `DifferentiatorsIndex` `loose` → testimonials `TestimonialsGrid`
  `normal` → trust `ServiceArea` `tight` → contact `ContactInlineStrip` `tight`).
- Add `'service'` to neither `OPTIONAL_PAGE_TYPES` nor `CORE_ADD_PAGE_TYPES`; service pages are
  generated, not operator-added one at a time.

**Header copy without inventing values:** the export route must ensure
`content.subpages[route].header` exists for every service route, derived as
`{ eyebrow: item.tag, title: item.t, sub: item.d, cta: null }`. All four come from the client's
own `services.items[]`. Add this next to the existing "ensure `content.pageHeaders` covers every
subpage route (fill gaps, never invent)" step the multipage plan describes, in
`console/src/app/api/build/export/route.ts` after line 162.

**A generate-pages affordance** in `console/src/app/c/[slug]/build/PagesMenu.tsx`: one button,
"Generate a page for each service", that calls a new `onGenerateServicePages()` handler in
`BuildWizard.tsx` which appends `servicePageFrom(item, route)` for each
`effective.services.items`, skipping routes already present. Idempotent.

### 9d. The interim-bridge hazard you must check first

`PageStudio` still builds `legacy`/`exportEntries` via `homeLegacyView` for Launch and Deploy, and
`homeLegacyView` flattens to **one component per category** (last wins). Before changing any home
template, **read the `fetch` body in `console/src/app/c/[slug]/build/LaunchDialog.tsx` and
`DeployDialog.tsx`** and confirm both send `composition`. The export route prefers `composition`
when present (`route.ts` lines 116-118, 157, 262), so if both send it, `wirePages` runs and the
legacy flattening is cosmetic. **If either sends only `selections`, fix that before Phase 9
proceeds**. Otherwise an eight-section home page silently exports as five.

### Verification
```
cd /c/Users/Xander/Desktop/ops/jdd-ops/console && npm test && npm run build
```
`page-rhythm.test.mjs` now enforces decisions 12, 26 and 30(d) across every template. Then export
a scratch client with `home-standard` + generated service pages and confirm: the client repo's
`npm run build` passes; `clients/<slug>/repo/src/app/services/<slug>/page.tsx` exists for each
service; each wraps its sections in `rh-*` divs; each subpage's header shows that service's own
title.

**User looks at:** the console preview of all three home templates, and the generated service
page files on disk.

### Out of scope
Any new component. A nav dropdown for service pages (`navVisible: false` is the decision).
Changing `MIN_PAGES`. The copy that fills those service pages: Phase 10 owns the review surface
for it, and Phase 10 comes next for exactly that reason.

---

## Phase 10: the multi-page copy review

**Goal:** every piece of generated copy on every page, including the per-service pages Phase 9
just created, becomes visible and individually approvable before the operator can leave the
Intake step.
**Discharges:** decisions 45, 47, 48, 49, 50, 51; research §6 item 6. Closes the verified
review-surface gap the decisions file records as "new work the plan does not cover".

**Why it sits here.** It is sequenced **after Phase 9 and before Phase 11** because it depends on
the per-service routes existing (there is nothing to group by page until then), and because the
Phase 12 reference site should carry reviewed copy rather than raw model output. It also depends
on prerequisite P4: `services.items[].detail` only exists in a published `@jdd/schema` from
`v1.20.0` onward.

### The gap, verified, and why it is already a live problem

**Subpage copy is generated today and has no review surface at all.** Traced end to end on
2026-10-05:

| Stage | File | State |
|---|---|---|
| Declared | `console/src/lib/copy-schema.ts:56` | `subpages?: { items: { route, eyebrow, title, sub, ctaLabel?, ctaHref?, seoTitle, seoDescription }[] }`, and `'subpages'` is in `ALL_SECTIONS` (line 74) and in `SECTION_SCHEMAS` (line 131) |
| Requested | `console/src/app/api/build/generate-copy/route.ts:62, 66-68` | included whenever `body.subpages` is non-empty, dropped otherwise |
| Instructed | `console/src/lib/copy-brief/compile.ts:105` `subpagesInstruction()` | one item per route, each header and SEO must be distinct per page |
| Applied | `console/src/lib/copy-brief/apply-generated.ts:164-182` | route-keyed merge into `SiteContent.subpages[route]` |
| **Reviewed** | **nothing** | `console/src/components/wizard/CopyWireframe.tsx`'s `WIREFRAME_ORDER` (line 21) is `brand, announcement, hero, trust, about, services, work, testimonials, faq, finalCta, footer, seo` and **omits `subpages` entirely**. `grep -rn subpages console/src/components/wizard/` returns **no hits in any file.** |

So model-written page headers and per-page SEO titles and descriptions reach client sites
unreviewed **today**, before decision 20 multiplies them by up to nine service routes. That is
the thing this phase fixes. `console/src/lib/section-labels.ts:16` already has a label for it
(`subpages: 'Page headers'`), which is the clearest evidence this was an omission rather than a
decision.

Read all of these before specifying a single line of code:
`console/src/components/wizard/CopyWireframe.tsx`,
`console/src/components/wizard/IntakeStep.tsx`,
`console/src/components/wizard/copy-primitives.tsx`,
`console/src/lib/copy-schema.ts`, `console/src/lib/copy-brief/*` (`resolve.ts`, `compile.ts`,
`compile-brief.ts`, `mutations.ts`, `apply-generated.ts`, `types.ts`),
`console/src/app/api/build/generate-copy/route.ts`, and `console/src/lib/draft.ts`.

### 10a. The verdict key becomes per section per page instance

Decision 50: **a section placed on two pages is approved independently**, so the verdict key must
carry the route or the per-instance section id. This mirrors machinery that already exists:
`SiteContent.sectionStyles` keys off the stable per-instance `ref.id` minted by
`newSectionId()`, resolved through `styleKeyFor(ref)` in `console/src/lib/pages.ts:70` (chrome
keys off the slot name `nav`/`footer`, body sections off `ref.id`). Copy review should key the
same way so the two never disagree about what "this section on this page" means.

**The persistence finding that decides the shape.** Verdicts are not a separate store. The
"ticked for regeneration" state lives in `brief.tickedSections`, and it is persisted in **two**
places:

1. `clients/<slug>/.draft.json`, written by `console/src/lib/draft.ts`'s `writeDraft` as an
   untyped `Record<string, unknown>` bundle that includes `brief` (`BuildWizard.tsx` line ~261,
   read back at line ~404);
2. durably in `clients/<slug>/site.ts` at `_meta.copyBrief`, via its own debounced
   `/api/build/save-brief` call (`BuildWizard.tsx` lines ~283-299), explicitly so the brief
   survives past launch.

**So old key shapes will be read back indefinitely, and a migration is not optional.** The good
news, verified: `CopyBrief.tickedSections` is typed `string[]` in `jdd-schema/src/copy-brief.ts:67`
(the console narrows it to `Section[]` with a cast at `IntakeStep.tsx:105`). **A composite string
key therefore needs no `@jdd/schema` change and no re-pin.**

**`console/src/lib/copy-schema.ts`** gains the key type and its two helpers, next to `Section` so
every consumer imports one definition:

```ts
/** A review verdict addresses ONE section on ONE page instance (decision 50). Home sections and
 *  site-wide content use the bare section id; anything that exists per route is prefixed with
 *  that route. A section placed on two pages is approved independently, exactly the way
 *  SiteContent.sectionStyles keys off the per-instance section id (lib/pages.ts styleKeyFor). */
export type VerdictKey = string;              // `${section}` | `${route}:${section}`

export const verdictKey = (section: Section, route?: string): VerdictKey =>
  route ? `${route}:${section}` : section;

/** Split a key back into its parts. A key with no ':' is a home/site-wide section. */
export function parseVerdictKey(k: VerdictKey): { route?: string; section: Section } {
  const i = k.indexOf(':');
  return i < 0
    ? { section: k as Section }
    : { route: k.slice(0, i), section: k.slice(i + 1) as Section };
}
```

**The migration, in `console/src/lib/copy-brief/mutations.ts`.** Add a normaliser and call it
wherever a brief is loaded, not where it is saved, so a brief written by an older console still
behaves:

```ts
/** Normalise a brief read from .draft.json or site.ts's _meta.copyBrief. Entries written before
 *  the copy review was per-page are bare section ids. THE SAFE DEFAULT IS TO KEEP THEM AS
 *  HOME/SITE-WIDE KEYS, which is what they meant: before Phase 10 there was no per-route review,
 *  so every verdict a bare id carries was about the home page or about site-wide content. Do NOT
 *  fan a bare id out across every route: that would silently mark nine unreviewed service pages
 *  as reviewed, which is the exact failure decision 51's gate exists to prevent. */
export function normalizeVerdicts(brief: CopyBrief): CopyBrief
```

Wire it into both read paths in `BuildWizard.tsx`: the `applyBundle` path (line ~404,
`b.brief ?? seed?._meta.copyBrief ?? emptyCopyBrief()`) and the `freshBundle(seed)` path
(line ~121). Add a case to the existing `console/test/` suite asserting that a brief whose
`tickedSections` is `['hero','services']` round-trips unchanged and does **not** gain
`services/ac-repair:services`.

**`console/src/components/wizard/CopyWireframe.tsx`** changes `SectionVerdict`'s lookup from
`(section: Section) => SectionVerdict` to `(key: VerdictKey) => SectionVerdict`. Keep the
`SectionVerdict` shape itself (`ticked`, `canRevert`, `onAccept`, `onReroll`, `onRevert`)
unchanged; only the addressing changes.

### 10b. The review is grouped by page

Decision 49, and the order is fixed: **home sections first, then Services, then About, then
Contact, then each service page.** `CopyWireframe` stops being one flat `WIREFRAME_ORDER.map()`
and becomes a list of page groups, each with its own heading and its own ordered sections.

**`console/src/components/wizard/CopyWireframe.tsx`:**

- Keep `SectionBody` exactly as it is. Every `case` in it is correct and each one is the only
  honest wireframe of that content slice. **Do not rewrite it**; it gains two new cases (below)
  and nothing else.
- Keep `EditProvider` / `E` click-to-edit wiring. The `p=` paths it writes are `setField` paths
  into `SiteContent`, so a per-route section must pass a per-route path prefix (for example
  `subpages.services/ac-repair.header.title`), the same way `compose-page.tsx:40` passes
  `editPrefix={`subpages.${page.route}.header`}` to `PageHeaderSimple`.
- Replace `WIREFRAME_ORDER` with a page-grouped structure:

```ts
/** One reviewable page in the copy review. Order within a group is page order; order OF the
 *  groups is decision 49: home first, then Services, About, Contact, then one group per service
 *  page. `route` is '' for home. */
type ReviewGroup = { route: string; label: string; sections: Section[] };

/** Home carries the generatable site content; everything else carries its page header + SEO,
 *  plus (Services only) the per-service body copy that services.items[].detail holds. */
const HOME_SECTIONS: Section[] = [
  'brand', 'announcement', 'hero', 'trust', 'about', 'services', 'work',
  'testimonials', 'faq', 'finalCta', 'footer', 'seo',
];
```

- Derive the groups from the live composition rather than hardcoding routes, so a client with
  four services gets four groups and a client with nine gets nine. `CopyWireframe` takes a new
  prop `pages: { route: string; label: string; pageType: string }[]`, which `IntakeStep` passes
  through from the same place `generate-copy`'s request body already gets its `subpages` array
  (`console/src/lib/copy-brief/types.ts:180`). Sort with core page types first in the decision-49
  order and `pageType === 'service'` last, alphabetically by route inside that.
- Each group renders a sticky group header showing the label, the route, and a count of
  unreviewed sections in it, so a nine-service site is navigable. The existing
  `labelFor(section)` from `console/src/lib/section-labels.ts` still names each card.

### 10c. Two new `SectionBody` cases

**`subpages`** (decision 47 and 49's per-page headers). For a group whose `route` is not `''`,
render `content.subpages?.[route]` as:

- the header: `eyebrow`, `title`, `sub` through `Eyebrow` / `Headline` / `Prose` from
  `copy-primitives.tsx`, each wrapped in `<E p={`subpages.${route}.header.${field}`}>`;
- the cta as a `CtaChip` when both `label` and `href` are present (matching
  `apply-generated.ts:176`, which only writes a cta when both are given);
- the per-page SEO as two `KV` rows (`subpages.<route>.seo.title`, `.description`), since a
  model-written SEO title on nine pages is exactly the kind of thing that ships unread;
- `NotSet` for every absent field, never a fabricated placeholder (§0.2 rule 2).

**`services` gains `detail`** (decision 48). `services.items[].detail` is the 2 to 3 sentence
service body copy, and it is now available because prerequisite P4 tagged it into
`@jdd/schema v1.20.0`. It is already in the generation schema at `copy-schema.ts:37`
(`items: arr(obj({ t, d, tag, detail }, ['t','d','tag']))`), so it is already being generated and
is already reaching client sites unread.

In the existing `case 'services'` block, inside each item's `Card`, add below the `d` paragraph:

```tsx
{hasText(it.detail)
  ? <p className="mt-2 text-sm leading-relaxed text-uiFg2"><E p={`services.items.${i}.detail`}>{it.detail}</E></p>
  : <p className="mt-2 text-xs italic text-uiFg3">No service detail generated. The service page will fall back to the short description.</p>}
```

Decision 45 governs what `detail` may contain: **generated from client facts and flagged for
review, never fabricated and never left thin.** `console/src/lib/copy-brief/facts.ts` is already
the place that enforces "only ever populated when grounded in website notes or operator details";
confirm `detail` is covered by it and add it if not.

In the **Services page group** (route `services`), render each item's `detail` again alongside
that page's header, because that is the page the prose actually appears on, and give each its own
verdict row keyed `verdictKey('services', 'services')`. One rendering for sanity-checking the
list, one for reviewing the page.

### 10d. The gate: unreviewed copy blocks leaving Intake

Decision 51, and it must be a **hard block**, not a warning. The decisions file is explicit that
this gate is load-bearing: decisions 45 and 51 together put a model's prose on a client site
contingent on an operator actually reading it, and a soft gate makes that contingency fictional.

**`console/src/components/wizard/IntakeStep.tsx`:**

- `verdictFor` changes signature to `verdictFor(key: VerdictKey): SectionVerdict`. Its body keeps
  the existing `preRunGenerated` snapshot logic (lines ~119-142) verbatim, including the comment
  explaining why the snapshot is taken in `handleGenerated` rather than read from the `generated`
  prop; resolve `{ route, section }` with `parseVerdictKey` and look the prior/current value up
  under the section as it does today.
- Compute the gate:

```ts
/** Every key that has generated copy behind it and has not been accepted. Decision 51: leaving
 *  the Intake step is BLOCKED while this is non-empty. `ticked` means "queued for regeneration",
 *  so a ticked key is by definition not yet approved; Accept is what clears it (it removes the
 *  key from brief.tickedSections, which is the existing semantics, unchanged). */
const unreviewed: VerdictKey[] = /* every group/section key with generated copy, still ticked */;
```

- The **Approve and continue to Studio** button (line ~238) becomes `disabled` while
  `unreviewed.length > 0`, with a `title` naming the count and the first few page labels, and a
  one-line explanation rendered next to it rather than only in a tooltip. `approve()` itself
  (line ~144) also returns early if `unreviewed.length > 0`, so the block holds even if something
  calls it directly.
- The **Next** button between sub-stages is **not** gated: Brief to Prompt to Review must stay
  freely navigable, and the Review sub-stage is where the reviewing happens. Only `onDone()`, the
  exit from the Intake step into Studio, is blocked.
- The stage rail's Review pill gains the unreviewed count as a badge, so the reason the button is
  disabled is visible from the Brief stage without hunting for it.

**Escape hatch, deliberately narrow.** The existing JSON editor (`openJson` / `saveJson`, lines
~155-190) stays and is not gated: it is the operator's own hand-authored content, not model
output, and gating it would make a stuck draft unrecoverable. Note this in a comment so nobody
"closes the loophole" and traps an operator.

### Registration and files

No §0.5 touchpoints: this phase adds no catalog component and no category. No `@jdd/schema`
change: `tickedSections` is already `string[]` (§10a). Files in scope, and nothing outside this
list:

| File | Change |
|---|---|
| `console/src/lib/copy-schema.ts` | add `VerdictKey`, `verdictKey()`, `parseVerdictKey()` |
| `console/src/lib/copy-brief/mutations.ts` | add `normalizeVerdicts()`; `setTickedSections` keeps its signature, now carrying composite keys |
| `console/src/components/wizard/CopyWireframe.tsx` | page groups, the new `pages` prop, key-based `verdictFor`, the `subpages` case, `detail` in the `services` case |
| `console/src/components/wizard/copy-primitives.tsx` | only if a group header needs a primitive that is not already there; prefer reusing `Group` / `Card` / `KV` / `NotSet` |
| `console/src/components/wizard/IntakeStep.tsx` | the gate, the key-based `verdictFor`, passing `pages` through |
| `console/src/app/c/[slug]/build/BuildWizard.tsx` | call `normalizeVerdicts()` on both brief read paths |
| `console/src/lib/copy-brief/facts.ts` | confirm `detail` is grounded-facts-only per decision 45 |
| `console/src/app/api/build/generate-copy/route.ts` | no behaviour change expected; confirm `subpages` is requested for service routes too, not only the core non-home pages |
| `console/test/copy-review.test.mjs` (NEW) | the tests below |

### Verification

```
cd /c/Users/Xander/Desktop/ops/jdd-ops/console && npm test && npm run build
```

`console/test/copy-review.test.mjs` must assert, at minimum:

1. `verdictKey('hero')` is `'hero'` and `verdictKey('subpages','services/ac-repair')` is
   `'services/ac-repair:subpages'`, and `parseVerdictKey` round-trips both, **including a route
   that contains a slash**, which every service route does;
2. `normalizeVerdicts` leaves a legacy `['hero','services']` untouched and adds nothing;
3. the group order is home, Services, About, Contact, then service routes, for a composition with
   three service pages;
4. `subpages` is present in whatever `CopyWireframe` now uses in place of `WIREFRAME_ORDER`. Make
   this a real assertion against the module, because its absence is the entire bug this phase
   fixes and a regression here is silent.

Then the thing a test cannot check. Start the console (`npm run dev`, port 3040, **not
`--turbo`**, §0.2 rule 5), open a client's `/c/<slug>/build` with service pages generated by
Phase 9, run a copy generation, and walk the Review stage:

- every page has a group, including every service page;
- the Approve button is disabled and says why;
- accepting every section enables it;
- editing a service page's header title in place writes to
  `subpages.<route>.header.title` and the change survives a reload (the draft round-trip).

**User looks at:** the Review stage of `/build` Intake for a client with at least three service
pages, grouped by page, with the Approve button visibly blocked until every group is accepted.
This is the phase's lookable-at artifact and the gate decision 51 asks for.

### Out of scope

Changing what the copywriter generates, or its prompt (`copy-brief/compile*.ts` instructions are
not touched beyond confirming service routes are included). Adding body copy to
`SubpageContent`: it carries `header` plus `seo` only, by design, and `services.items[].detail` is
where service prose lives (decision 48, as corrected by P4). Any `@jdd/schema` change. Making the
review a separate wizard step: decision 47 puts it on the Intake step. Reviewing images: decision
13 declines a go-live gate on photography. Automating approval, or persisting a reviewer identity.

---

## Phase 11: The build-time image pipeline

**Goal:** fetch each image once at export, emit four WebP widths (plus AVIF for the hero) into
`/public`, kill the Unsplash hotlink, enforce one ratio and one grade, and keep placeholder
provenance working after the URLs stop being URLs.
**Discharges:** G3 (partly); decisions 15, 16, 13, 39, 44, 52, 55.

### 11a. Apply the curated HVAC set

**`console/src/data/image-placeholders.ts`**: replace the four photo ids in the `hvac` entry's
`heroSlides`, `aboutFeature` and `serviceImages` with the curated ids from
`console/design/foundation-v2/photography.md`, and rewrite each `alt` against research §4's shot
list. Leave the other five verticals until their cycles. **Do not touch** `opts.includeWork` or
the `filled` reporting: `KNOWN_PLACEHOLDER_URLS` is derived from the table so it updates itself,
and the `filled` reporting is the provenance machinery decision 13 explicitly preserves.

**`isOwnPlaceholder` and `needsFill` DO change, and §11c below is why.** An earlier draft of this
plan said not to touch them. That was wrong, and §11c is the correctness fix.

### 11b. The pipeline

**`console/src/lib/image-pipeline.ts`** (NEW, server-only). `import 'server-only'` at the top; it
is only ever called from the export route.

```ts
export const RATIOS = { hero: 16/10, aboutFeature: 4/5, service: 3/2, work: 3/2, avatar: 1 } as const;

/**
 * FOUR widths, WebP for every slot, AVIF for the HERO slot only (decision 44).
 *
 * This is deliberately NOT five widths in both formats. Vercel is on **Pro** (decision 52
 * corrects an earlier note that said Hobby) and the Sep 2026 bandwidth spike was AI bot scraping
 * of client sites plus a stalled deploy, both already fixed in code and in Vercel config. So
 * EGRESS IS NOT THE CONSTRAINT and there is no reason to shave bytes with a second format
 * everywhere.
 *
 * EXPORT DURATION is the constraint. The export route already runs `npm install` plus a full
 * `npm run build` inside the client repo, and AVIF encode is by far the slowest step in this
 * pipeline: five widths in two formats is 10 encodes per image across ~12 image slots, and the
 * AVIF half of that dominates the wall clock. AVIF is therefore reserved for the hero, which is
 * the LCP element and the one place its better compression actually pays for itself.
 */
export const WIDTHS = [640, 1024, 1536, 2048] as const;
/** The only slot that also gets AVIF. Keyed by RATIOS key, not by path, so hero.portrait and
 *  hero.slides[] both qualify. */
export const AVIF_RATIO_KEYS = ['hero'] as const;

export async function materializeImages(
  repoRoot: string, slug: string, content: SiteContent,
  step: (m: string) => void,
): Promise<{ content: SiteContent; localized: string[]; failed: string[] }>
```
Behaviour:
- Walk exactly the slots `fillImagePlaceholders` writes: `images.hero.portrait`,
  `images.hero.slides[].url`, `images.about.feature`, `services.items[].image.url`,
  `work.projects[].image.url`, `images.testimonials.avatars[]`, `images.footer.logoImage`. Each
  slot declares which `RATIOS` key it uses.
- For each absolute `http(s)` URL: `fetch` once, `sha256` the bytes, and for each width in
  `WIDTHS` not exceeding the source width, emit
  `clients/<slug>/repo/public/img/<hash>-<w>.webp`. **Additionally emit `-<w>.avif` only when the
  slot's ratio key is in `AVIF_RATIO_KEYS`**, which today means the hero and nothing else.
- **Crop:** `sharp(buf).resize(w, Math.round(w / ratio), { fit: 'cover', position: 'attention' })`.
  `attention` is sharp's saliency crop, which gives decision 15's focal crop with no per-image
  metadata to author.
- **Grade (one fixed recipe, decision 15, and it is TWO passes, decision 55):**
  `.modulate({ saturation: 0.88, brightness: 1.02 }).linear(1.04, -6)` applied before the format
  encode, in that order, for **every** image. One recipe is what makes mixed sources read as one
  set.

  **There is no `.tint()` pass. Do not add one.** An earlier draft of this plan ended the recipe
  with `.tint('#FFF8F0')`. Decision 55 drops it: decision 9 has already moved every page ground to
  a warm unbleached neutral and the ink to warm charcoal, so a warm tint on the photography on top
  of that pushes the whole page toward sepia. The saturation and contrast passes are what actually
  make mixed-quality photos cohere; the tint was only adding warmth the palette now supplies.
- Rewrite the slot value to `/img/<hash>` (the base, **no width and no extension**, which is what
  the `img.ts` branch below keys off) and record
  `_meta.local_images: Record<originalUrl, '/img/<hash>'>`.
- **Never throw.** On any fetch or encode failure, leave the original URL in place, push it to
  `failed`, and `step()` a warning. A placeholder photo must never fail a deploy.
- Logo images (`images.footer.logoImage`) skip the crop and the grade: a logo must not be
  recoloured. Resize on the long edge only.

**`console/package.json`**: add `"sharp": "^0.33.5"` to **devDependencies**. The pipeline runs in
the console at export time; client repos only serve the emitted files, so they stay
dependency-free. Note this in the module header.

**`template/public/img/.gitkeep`** (NEW): run
`ls /c/Users/Xander/Desktop/ops/jdd-ops/template/public` first; create the directory if it is
absent. `public/` is not in `TEMPLATE_OWNED_PREFIXES`, so a first export copies it and
`overwrite` leaves a client's own emitted images alone, which is correct.

**`packages/ui/src/img.ts`**: add a second entry to `HOSTS`' logic: before the URL parse, if
`url` starts with `/img/` and has no extension, return
``{ src: `${url}-1024.webp`, srcSet: WIDTHS.map(w => `${url}-${w}.webp ${w}w`).join(', ') }``. Keep
the Unsplash branch and the "do not add a host on the assumption it supports `?w=`" warning
(decision 3). **Update `WIDTHS` here to the pipeline's four, `[640, 1024, 1536, 2048]`, and keep
the two in step**: this constant and `image-pipeline.ts`'s are the same list in two repos, and a
width in the `srcSet` that the pipeline never emitted is a 404 on a real client site. Add a
comment in both files naming the other. Then the §0.3 loop, tag **v1.0.7**.

**`responsivePicture`, and AVIF is hero-only.** Since `responsiveImage` returns a plain object and
~every component calls it, do not change its shape. Add a sibling:

```ts
/**
 * A <picture>-shaped result. `avifSrcSet` is present ONLY for the hero (decision 44): the export
 * pipeline emits AVIF for the hero slot alone, because egress is not the constraint on Vercel Pro
 * but export duration is, and AVIF encode is the slow step. A component that renders a non-hero
 * image gets `avifSrcSet: undefined` and must then emit no <source type="image/avif"> at all.
 * Emitting one anyway points the browser at files that were never written.
 */
export function responsivePicture(
  url: string,
  opts?: { avif?: boolean },
): { avifSrcSet?: string; webpSrcSet?: string; src: string }
```

The `opts.avif` flag is the caller's declaration that this is the hero slot; default it to
`false`. Only `hero/HeroSplit`, `hero/HeroOverlap` and `hero/HeroFormFocus` pass `true`, and only
for the hero image itself, not for anything else they render.

### 11c. Placeholder provenance after the URLs stop being URLs

**This is the most important change in the phase, and it is a correctness fix, not a refinement.**
Decision 39.

**What breaks, verified by reading the file.**
`console/src/data/image-placeholders.ts:218` is

```ts
function isOwnPlaceholder(v: unknown): boolean {
  if (typeof v === 'string') return KNOWN_PLACEHOLDER_URLS.has(v);
  if (Array.isArray(v)) {
    return v.length > 0 && v.every((x) => typeof x === 'string' && KNOWN_PLACEHOLDER_URLS.has(x));
  }
  return false;
}
```

an **exact set membership test against `KNOWN_PLACEHOLDER_URLS`**, which is derived at line 203
from the table's `images.unsplash.com` URLs. And line 262 is

```ts
const needsFill = (path: string, v: unknown): boolean =>
  needsPlaceholder(v) || (prior.has(path) && isOwnPlaceholder(v));
```

`needsPlaceholder` (line 197) returns true only for an empty value or a `picsum.photos` seed.

§11b rewrites every localized slot to `/img/<hash>`. After that, for a slot holding stock:
`needsPlaceholder('/img/abc123')` is **false** (it is present and not picsum), and
`isOwnPlaceholder('/img/abc123')` is **false** (it is not in the Unsplash set). So `needsFill` is
false forever. **A stock placeholder becomes permanently indistinguishable from a real client
photo on the next export.**

That destroys the exact property decision 13 was chosen to preserve, and the one the file's own
header calls deliberate:

> Every slot filled here is reported back in `filled` and recorded at `_meta.placeholder_images`
> by the export route, so a placeholder stays distinguishable from a real client photo, and so a
> later re-export re-evaluates it instead of mistaking it for one.

Concretely, without this fix: change a client's vertical from HVAC to plumbing after one export
and the hero keeps the HVAC stock photo forever, because the refresh path cannot tell it is stock.
And the `_meta.placeholder_images` list drifts into a record of what *used to be* true.

**The fix: detection reads `_meta`, never the URL string.**

`fillImagePlaceholders` already receives the whole `effective: SiteContent`, so both `_meta` maps
are in hand. Change the two predicates to consult provenance instead of pattern-matching a value:

```ts
/**
 * True when the value is stock THIS MODULE wrote, rather than a real client image.
 *
 * Reads PROVENANCE, not the URL (decision 39). Before Phase 11 of the template-fidelity upgrade
 * every placeholder was a literal images.unsplash.com URL, so an exact match against
 * KNOWN_PLACEHOLDER_URLS was sufficient. The build-time image pipeline now rewrites every slot to
 * `/img/<hash>`, after which neither needsPlaceholder() nor a URL match can recognise it, and a
 * stock photo would become permanently indistinguishable from a client's own, which is precisely
 * the property decision 13 was chosen to keep.
 *
 * `_meta.local_images` maps originalUrl -> '/img/<hash>', so its VALUES are the localized forms
 * of URLs this module (or the operator) put there; `_meta.placeholder_images` says which SLOTS we
 * filled. A slot is still ours when it is listed in placeholder_images AND its current value is
 * either a known placeholder URL (not yet localized) or the localization of one.
 */
function isOwnPlaceholder(v: unknown, meta: SiteMeta | undefined): boolean
```

The shape of the change, concretely:

1. Build the localized-stock set once per call, next to `prior`:

   ```ts
   const prior = new Set(effective._meta?.placeholder_images ?? []);
   /** '/img/<hash>' values whose ORIGINAL url was one of ours. This is the whole point: the hash
    *  carries no provenance, so the mapping is the only thing that can answer the question. */
   const localizedOwn = new Set(
     Object.entries(effective._meta?.local_images ?? {})
       .filter(([original]) => KNOWN_PLACEHOLDER_URLS.has(original))
       .map(([, localized]) => localized),
   );
   ```

2. `isOwnPlaceholder` tests `KNOWN_PLACEHOLDER_URLS.has(v) || localizedOwn.has(v)`, keeping the
   array branch (`every`) for `images.testimonials.avatars`, and keeping the `v.length > 0`
   guard, which is what stops an empty array being read as "all ours".

3. `needsFill` is otherwise **unchanged**, including the `prior.has(path)` conjunct. Keep it: a
   slot the operator has since replaced by hand is not in `localizedOwn`, so a genuine photo still
   always wins, and `prior.has(path)` keeps the whole refresh path scoped to slots we actually
   filled.

4. **`_meta.local_images` must be written on every export, including the exports where nothing
   needed filling**, or the mapping goes stale and step 1 silently returns an empty set. §11b's
   export-route change already merges `localized` into `_meta` alongside `placeholder_images`;
   make sure it merges rather than replaces, so a slot localized two exports ago keeps its entry.

5. Strip nothing from `KNOWN_PLACEHOLDER_URLS`. It is still needed, now as the thing that decides
   which `local_images` entries are ours.

**The test, in `console/test/` (extend the existing image-placeholder suite or add
`image-provenance.test.mjs`).** The assertion that matters, because it is the one a URL-matching
implementation fails:

```js
test('a LOCALIZED placeholder is still recognised as a placeholder on re-export', () => {
  // The regression decision 39 exists to prevent. Run fillImagePlaceholders once to get stock in,
  // simulate what the Phase 11 pipeline does to the content (rewrite the slot to /img/<hash> and
  // record _meta.local_images), then run fillImagePlaceholders AGAIN for a DIFFERENT vertical and
  // assert the slot was refreshed rather than treated as the client's own photograph.
  const first = fillImagePlaceholders(bareContent, 'hvac');
  const hvacUrl = first.content.images.hero.portrait;
  assert.ok(first.filled.includes('images.hero.portrait'));

  const localized = {
    ...first.content,
    images: { ...first.content.images, hero: { ...first.content.images.hero, portrait: '/img/deadbeef' } },
    _meta: {
      ...first.content._meta,
      placeholder_images: first.filled,
      local_images: { [hvacUrl]: '/img/deadbeef' },
    },
  };

  const second = fillImagePlaceholders(localized, 'plumbing');
  assert.ok(
    second.filled.includes('images.hero.portrait'),
    'a localized placeholder must stay refreshable; if this fails, detection has gone back to ' +
    'string-matching the URL and stock is now permanently indistinguishable from a client photo',
  );
  assert.notEqual(second.content.images.hero.portrait, '/img/deadbeef');
});

test('a REAL client photo is never refreshed, localized or not', () => {
  // The other half of the property. A slot listed in placeholder_images whose value is NOT in
  // local_images-of-ours is the operator's own image and must survive untouched.
  const withReal = {
    ...bareContent,
    images: { ...bareContent.images, hero: { ...bareContent.images.hero, portrait: '/img/clientphoto' } },
    _meta: { placeholder_images: ['images.hero.portrait'], local_images: { 'https://client.example/x.jpg': '/img/clientphoto' } },
  };
  const out = fillImagePlaceholders(withReal, 'plumbing');
  assert.equal(out.content.images.hero.portrait, '/img/clientphoto');
  assert.ok(!out.filled.includes('images.hero.portrait'));
});
```

Both tests must exist. The first one alone would pass a naive implementation that treats every
`/img/` value as stock, which would then destroy client photographs instead of placeholders.

**`console/src/app/api/build/export/route.ts`**: call `materializeImages` inside
`withPlaceholders`' caller, **after** `resolveUploads` and **after** `fillImagePlaceholders`,
**before** `writeSiteContent`, for both the `content` branch (line 218) and the `vertical` branch
(line 219-224). Merge `localized`/`failed` into the existing `_meta` write alongside
`placeholder_images`. `step()` a line naming how many images were localized and how many were
left hotlinked.

### Verification
```
cd /c/Users/Xander/Desktop/ops/jdd-ops/console && npm install && npm test && npm run build
```
Then export a scratch HVAC client and check on disk:
```
R=/c/Users/Xander/Desktop/ops/jdd-ops/clients/<slug>/repo
ls $R/public/img | head -20
ls $R/public/img/*.webp | wc -l      # 4 widths x every image slot
ls $R/public/img/*.avif | wc -l      # HERO ONLY: expect 4 x (portrait + slides), not 4 x everything
ls $R/public/img | grep -c -- '-480\.'   # expect 0: 480 is NOT in the four widths any more
grep -c 'images.unsplash.com' $R/src/data/site.ts   # expect 0
grep -n 'local_images' $R/src/data/site.ts          # must be present and non-empty
grep -n 'placeholder_images' $R/src/data/site.ts    # must still be present: §11c depends on it
```
The AVIF count is the decision-44 check and it is easy to get wrong in the permissive direction:
if `*.avif` and `*.webp` counts are equal, AVIF was emitted for every slot and the export-duration
reason for decision 44 has been thrown away. Also time the export and record it in `NOTES.md`,
since export duration is the whole constraint this trade was made against.

Then `cd clients/<slug>/repo && npm run build && npm start` and confirm in DevTools Network that
the hero serves a local `.avif` at a width appropriate to the viewport, that a non-hero image
serves a local `.webp` and requests **no** `.avif`, and that no request leaves for
`images.unsplash.com`.

Then the provenance round-trip, which is §11c's real gate: export the same client **twice**, with
the vertical changed between runs, and confirm the stock imagery actually changes. If it does not,
§11c is not working regardless of what the unit tests say.

**User looks at:** the hero photograph in a real browser at phone and desktop width, the uniform
grade across hero / about / service / work images (and specifically that it reads warm-neutral
rather than sepia, which is decision 55's check), and a Network panel with zero third-party image
requests.

### Out of scope
A go-live gate on stock photography (decision 13 explicitly declines one). AI-generated imagery
of any kind (decision 14). Re-curating the other five verticals. A fifth width or AVIF beyond the
hero: decision 44 is a settled trade against export duration, not a placeholder for "optimise
later". Sizing anything as though egress were scarce: decision 52, Vercel is on Pro and the bot
scraping that caused the Sep 2026 spike is already mitigated.

---

## Phase 12: The HVAC vertical language, and the reference site

**Goal:** make decision 35's per-vertical layer a typed, thin, enforced thing, and look at a
finished HVAC site.
**Discharges:** decisions 35, 37, 38, 11, 31, 32, 43, 46; §0.6. Carries the logged 43-versus-31 tension.

### 12a. The thin layer, typed

**`console/src/data/vertical-language.ts`** (NEW; client-safe, no `node:fs`):
```ts
/**
 * A vertical's design language: EXACTLY four axes (decision 35), layered over the one shared
 * foundation (decision 37). There is deliberately NO field here that can name a component or a
 * vertical-private page template. If a vertical ever needs one, the foundation is too thin and
 * the fix is to generalise that component into the shared catalog, not to widen this type.
 * See the Known tensions section of DECISIONS-template-fidelity-v2.md.
 */
export type VerticalLanguage = {
  pairingId: string;                                   // a FONT_PAIRINGS id
  palette: { accent: string; accentFg: string | null; bg: string; bgSoft: string; ink: string; inkSoft: string; rule: string };
  photography: { subjects: string[]; grade: 'house'; ratioBias: 'wide' | 'tall' | 'square' };
  rhythm: { homeTemplateId: string; proofSkin: SkinId };
};
export const VERTICAL_LANGUAGES: Record<string, VerticalLanguage>;
export function languageFor(id: VerticalId): VerticalLanguage;   // guarded, falls back to hvac
```
Populate **only** `hvac`, transcribed from
`console/design/foundation-v2/VERTICAL-LANGUAGE-hvac.md`: `pairingId: 'instrument'`, the
Phase 2/3 palette, `subjects` from `photography.md`, `grade: 'house'` (there is exactly one
grade, decision 15), `homeTemplateId: 'home-standard'`, `proofSkin: 'soft'`. Honour decision 11:
a sophisticated tone of the expected HVAC blue-plus-warm coding, not a saturated primary.

**`console/src/lib/verticals.ts`**: `presetFor(id)` composes the language onto the preset so the
two cannot disagree: merge `languageFor(id).palette` into `brand.palette` and
`pairingFor(language.pairingId)` into `brand.typography`. Keep the existing guarded-fallback
behaviour and the client-safe constraint.

**The vertical rotation, and one untested bet in it.** Decision 37 makes each remaining vertical
its own later cycle: a Phase 5 mockup repeat, a `VERTICAL_LANGUAGES` entry, a
`console/src/data/verticals/<id>.ts` palette, and an `image-placeholders.ts` curation. Five remain
after HVAC: roofing, plumbing, lawn-care, car-detailing, and **health**.

**Health and Wellness reuses this system as-is, with no separate research pass** (decision 46). It
is treated as a premium trade, and the Tier B language this upgrade installs (neutral unbleached
grounds, restrained accent, editorial type, photography-led colour) arguably suits it better than
it suits roofing.

**Record this as an untested bet, because it is one.** Every palette, photography-direction and
proof decision in `RESEARCH-local-service-visual-design.md` is **trades-only**: the teardowns, the
conversion architecture, the colour conventions in decision 11, the shot list in research §4, and
the distrust signals in §6 were all measured against home-service trades. None of it was gathered
against health or wellness, where the trust vocabulary (credentials, privacy, bedside manner,
regulatory language) and the photography register are genuinely different. So:

> **If the health vertical's first build looks wrong, the cause is decision 46 and not the shared
> foundation.** Do not respond by widening `VerticalLanguage`, adding a health-only component, or
> re-opening the token layer. Escalate per §0.6 and let the user decide whether health gets its
> own research pass. Put this sentence in
> `console/design/foundation-v2/VERTICAL-LANGUAGE-hvac.md`'s "What HVAC does NOT get" section's
> neighbour, the rotation note, so whoever runs the health cycle reads it first.

**`console/test/vertical-language.test.mjs`** (NEW), the §0.6 enforcement:
1. every `VERTICAL_LANGUAGES[v].pairingId` exists in `FONT_PAIRINGS`;
2. every `rhythm.homeTemplateId` exists in `PAGE_TEMPLATES` **and has `pageType === 'home'`**;
3. the set of template ids referenced across all verticals is a **subset** of `PAGE_TEMPLATES`
   ids, so no vertical can carry a private template;
4. every palette runs clean through the Phase 2 contrast assertions (reuse the helpers from
   `palette-contrast.test.mjs` rather than restating the maths);
5. `Object.keys(VERTICAL_LANGUAGES.hvac)` is exactly
   `['pairingId','palette','photography','rhythm']`, a structural assertion that fails the
   moment someone widens the type.

### 12b. The conversion checklist (decision 32)

**`console/design/CONVERSION-NON-NEGOTIABLES.md`** (NEW). Decision 32 is explicit that this is
**hand-checked at go-live, with no new build-time enforcement machinery.** Six items, each with
how to check it and which file owns it:

| # | Non-negotiable | How to check | Owner |
|---|---|---|---|
| 1 | Tap-to-call | every phone number is an `<a href={brand.phoneHref}>` | `nav/*`, `hero/*`, `StickyCallBar` |
| 2 | Sticky mobile call bar | visible at 390px after the hero scrolls past | `template/src/lib/StickyCallBar.tsx` |
| 3 | Named service area | `extensions.serviceArea` is non-empty and `trust/ServiceArea` is placed | intake, `page-templates.tsx` |
| 4 | Review aggregate above the fold | `extensions.reviewBadge` is non-null and the hero renders it **not** behind a breakpoint (SPEC §7) | intake, `hero/*` |
| 5 | License displayed | `brand.license` is non-null and the nav or footer renders it | intake, `nav/*`, `footer/*` |
| 6 | Form at six fields or fewer | `LeadForm` ships two, plus one optional message | `packages/ui/src/LeadForm.tsx` |

Add a line to `console/src/lib/go-live-content.ts`'s checklist pointing at this file, so it
surfaces in the operator's go-live flow rather than only on disk.

### 12c. The reference site (decisions 31 and 43)

**The reference site is `_e2e_test_growth`, exported and built LOCALLY, not deployed.** Decision
43 settles this. Do not create a scratch `_ref_hvac` slug and do not run `vercel deploy`.
`_e2e_test_growth` is the permanent HVAC fixture decision 38 names, it already has a client record
so `console/src/lib/onboardingGate.ts`'s `lockedReason()` will not refuse it (the export route
calls it at line 155 and refuses any slug with no client record), and reusing it means there is
nothing to tear down afterwards.

**Operational note: use the roster toggle, do not flip the env flag.**
`CONSOLE_INCLUDE_FIXTURES=0` at `console/.env.local:7` hides `_e2e_test_growth` from the roster by
default. Per `console/src/lib/fixtures.ts`, the roster's **`?fixtures=1` query toggle wins outright
over the env flag**, so the reference build is reachable without touching `.env.local` at all:

```
# reach the fixture client without changing any env
http://localhost:3040/?fixtures=1      # then open _e2e_test_growth from the roster
```

Do **not** set `CONSOLE_INCLUDE_FIXTURES=1`. Per the external-managed-clients work,
`_e2e_test_growth` is deliberately kept as the test client while the flag stays at 0, and flipping
the flag changes what every other surface in the console shows.

Then:

```
# in the console UI at ?fixtures=1: open _e2e_test_growth, select the HVAC vertical,
# apply home-standard, generate service pages, review the copy (Phase 10's gate), Launch
cd /c/Users/Xander/Desktop/ops/jdd-ops/clients/_e2e_test_growth/repo
npm run build        # must pass. This is the gate.
npm start            # then open http://localhost:3000 in a REAL browser
```

Walk `CONVERSION-NON-NEGOTIABLES.md` against `http://localhost:3000` by hand, at a 390px viewport
and at 1440px. No teardown: the fixture client is permanent.

**The logged tension, 43 against 31, which you should read before trusting the review.** Decision
31 says fidelity is judged by a person looking at a real site, and decision 27 makes the sticky
mobile call bar the most design-attended element on the whole site. But decision 43 declines a
deploy, so **this first fidelity review happens in a desktop browser at a 390px viewport rather
than on a phone**. That is exactly where two constraints this plan documents already bite: §0.4's
hidden preview pane (`visibilityState === 'hidden'` freezes framer-motion and CSS transitions) and
the fact that touch behaviour, real tap targets, and the `tel:` handoff cannot be judged from a
resized desktop window at all.

Two consequences, both practical:

1. **Review against `npm start` at `localhost:3000`, never against the console preview pane.** The
   template dev/prod server is a real browser context where motion actually runs; the preview pane
   is not. This is the same rule as §0.4 rule 3.
2. **Record in `NOTES.md` which of the six non-negotiables you could genuinely verify and which
   you could only inspect statically.** Items 1 and 2 (tap-to-call and the sticky bar) are the two
   that a desktop browser cannot really answer. If the local review feels untrustworthy, that is
   the signal to revisit decision 43 and ask for a deploy, which is a decision for the user, not
   for the executor.

**Decision 36 is absolute: Atlantic and Air Service are untouched.** They are `externalManaged`
starter shims, not built from this template. No redeploys, no re-exports, no `overwrite`.

### Verification
```
cd /c/Users/Xander/Desktop/ops/jdd-ops/console && npm test && npm run build
cd /c/Users/Xander/Desktop/ops/jdd-ops/clients/_e2e_test_growth/repo && npm run build
```
plus a completed hand-check of the six `CONVERSION-NON-NEGOTIABLES.md` items against
`http://localhost:3000`, with the two you could not fully verify named.

**User looks at:** the locally built and served `_e2e_test_growth` HVAC site at
`http://localhost:3000`, at a 390px viewport and at 1440px. This is the real gate for the whole
upgrade: does it look expensive, and does it still convert. Present it as a local URL, not a
deploy, and say so: decision 43 declines the deploy.

### Out of scope
**Deploying the reference site.** Decision 43 is explicit: exported and built locally, not
deployed. No `vercel deploy`, no preview URL. The other five vertical languages: each is its own
later cycle (decision 37), and each is a Phase 5 mockup plus a `VERTICAL_LANGUAGES` entry plus a
`console/src/data/verticals/<id>.ts` palette and `image-placeholders.ts` curation. **No new
components.** If one appears to be needed, stop and escalate per §0.6. A research pass for Health
and Wellness: decision 46 declines one, with the bet recorded in §12a. Flipping
`CONSOLE_INCLUDE_FIXTURES`.

---

## Phase 13: Intake demands the specifics (cross-repo)

**Goal:** the documented antidote to looking AI-made is specificity, and the no-inventing rule
means it must come from intake.
**Discharges:** decision 29; research §6 item 6. Cuts `@jdd/schema` v1.21.0 (NOT v1.20.0, which prerequisite P4 owns).

Last because it is the only **phase** that spans three repos. Everything before it is
self-contained in `jdd-ops`.

**What this phase no longer owns.** An earlier draft of this plan put all of the `@jdd/schema`
work here, including the commit and tag of the v2.2 content fields, and numbered that tag
`v1.20.0`. Decision 53 moved that out into **prerequisite P4**, because Phases 8 and 9 depend on
`PageHeaderContent` and `SectionStyle`, which existed only as uncommitted source: schema-last was
simply the wrong ordering. **P4 owns `v1.20.0`. This phase owns only the three decision-29 intake
fields and takes its own later bump, `v1.21.0`.** Do not re-tag `v1.20.0` and do not re-add
`detail`, `story`, `SectionStyle`, `PageHeaderContent`, `SubpageContent` or `subpages`: they are
already published and already re-pinned, and adding them again is how a tag ends up with a diff
that does not match its message.

Confirm that before you start:

```
grep -nE "detail\?|story\?|SectionStyle|PageHeaderContent|SubpageContent|subpages" \
  /c/Users/Xander/Desktop/ops/jdd-schema/dist/site.d.ts    # all six must ALREADY be here (P4)
cd /c/Users/Xander/Desktop/ops/jdd-ops/console && npm run check-schema
# must already be green at github:...#v1.20.0 before this phase adds anything
```

### 13a. What already exists (do not re-add)

- `brand.license`: exists, nullable. Currently marked "no longer asked" in
  `jdd-schema/src/brand-intake.ts`.
- `brand.established`: exists, nullable. Same note.
- `extensions.serviceArea?: string[] | null`, **exists in `dist/site.d.ts`**, so a client site
  receives it today. The intake field `serviceArea` exists and maps at `brand-intake.ts` line 290.
- Equipment brands carried → **`trust.logos: string[]` with `trust.label`**. The HVAC preset
  already sets `label: "Certified by"` with an empty list and a comment saying logos must come
  from the client. Relabel to "Brands we install" in the HVAC preset and map intake's existing
  `notableClients`/`certifications` plus a new field into it. No schema change for this one.
- Response-time commitment → `hero.frictionReducers[]` and `hero.heroBullets[]` already carry it
  ("Same-day availability", "24/7"). A structured field is still worth having for the stats band
  and the sticky bar's assurance line.

### 13b. What needs the bump

**`@jdd/schema` v1.21.0**, not v1.20.0: prerequisite P4 consumed `v1.20.0`. In
`jdd-schema/src/site.ts` `ExtensionsContent` (all optional and nullable, so no existing reader
breaks):
```ts
ownerName?: string | null;      // for the About page and the owner photo caption
brandsCarried?: string[] | null;
responseTime?: string | null;   // e.g. "under 60 minutes", client's own words
```
and in `jdd-schema/src/brand-intake.ts` `BrandIntakeSubmission`: `ownerName?: string`,
`brandsCarried?: string` (comma/newline list, use the existing `splitList`),
`responseTime?: string`. Move `established`, `license` and `serviceArea` back to **asked**, and in
`buildScaffold`'s flags list add every one of the six that is unsupplied to `missing_fields`, which
is the whole mechanism by which the no-inventing rule becomes visible in the console.

Then the §0.3b `@jdd/schema` loop: `npm run build` (rebuilds `dist`, the only thing consumers
read), commit, tag **`v1.21.0`**, push, re-pin **all three** consumers with an explicit
`npm install "github:JuneauDigitalDesigns/jdd-schema#v1.21.0"`, and
`cd console && npm run check-schema` until it prints "pinned and installed consistently at
github:JuneauDigitalDesigns/jdd-schema#v1.21.0". Because P2 already moved the console off `file:`,
this is a plain three-consumer re-pin with no special case.

**Verify against `dist`, not `src`:**
`grep -n "ownerName\|brandsCarried\|responseTime" /c/Users/Xander/Desktop/ops/jdd-schema/dist/site.d.ts`.

### 13c. jdd-ops side

- `console/src/lib/intake-path-map.ts`: add the three new form paths to `FORM_PATH_MAP`
  (`ownerName` → `extensions.ownerName`, `brandsCarried` → `trust.logos`, `responseTime` →
  `extensions.responseTime`) and remove nothing. Add a
  `console/test/intake-path-map.test.mjs` case for each (the file already exists).
- `console/src/lib/field-labels.ts`: add the three to `KEY_FIELDS` so they appear in the curated
  "All fields" section.
- `console/src/data/site.ts` and `console/src/data/verticals/hvac.ts`: add the three
  `extensions` keys as `null`. **Never a sample value.**
- `console/src/lib/copy-brief/facts.ts`: add the three to the facts the copywriter is allowed to
  use and forbidden to invent. Read the file first; it is the place that already enforces "only
  ever populated when grounded in website notes or operator details".
- The components that read them: `about/AboutStory` and `about/AboutSticky` (owner name, guarded),
  `trust/TrustBadges` (brands carried, guarded, `return null` when empty),
  `template/src/lib/StickyCallBar.tsx` (`responseTime` as the assurance line, falling back to
  `hero.trust`). All guarded per `AUTHORING_CONTRACT.md` §5.

### 13d. Agency repo (separate task, separate gate)

The onboarding form lives at `C:\Users\Xander\Desktop\ops\juneau-digital-designs`. **The planner
did not inspect that repo**, so locate the form before editing:
`grep -rln "serviceArea\|notableClients" --include=*.tsx <that repo>/src`. Add six inputs (owner
name, license number, year established, named towns, brands carried, response-time commitment),
each clearly marked as the thing that stops the site looking generic. Then `npm run build` in that
repo as its own gate.

### Verification
```
cd /c/Users/Xander/Desktop/ops/jdd-schema && npm test && npm run build
cd /c/Users/Xander/Desktop/ops/jdd-ops/console && npm run check-schema && npm test && npm run build
cd /c/Users/Xander/Desktop/ops/jdd-ops && node onboard.js --schema clients/_e2e_test_growth/site.ts --dry-run   # exit 0
cd /c/Users/Xander/Desktop/ops/juneau-digital-designs && npm run build
```
**User looks at:** the onboarding form's six new fields, and the console's Intake checklist
flagging each one that a client leaves blank.

### Out of scope
Generating any of the six from a model. Making any of them required (a new business genuinely has
no `established`, and the honest outcome is a flagged blank, not an invention).

---

## Dependency order and what can run in parallel

`P1` to `P4` below are the four **prerequisites**. Phases are written out in full. The two are
never abbreviated the same way (§0.7).

```
  PREREQUISITES, strictly ordered, before anything else
  ─────────────────────────────────────────────────────
  P1 (npm install in template/)
        │
        v
  P4 (jdd-schema v2.2 -> tag v1.20.0, re-pin 3 consumers)   <- MUST precede P2
        │
        v
  P2 (console @jdd/schema pin: file: -> github:#v1.20.0)
        │
        v
  P3 (leave packages/ui sectionVars uncommitted for Phase 2)
        │
        v
  §0.1 known-green baseline: template build, console test + build, check-schema
        │
        v
  PHASES
  ──────
  Phase 0 (docs) ─┬─> Phase 1 (tokens) ─> Phase 2 (palette, @jdd/ui v1.0.3) ─> Phase 3 (type) ─┐
                  └─> Phase 4 (archetype meta + lints) ─────────────────────────────────────────┤
                                                                                               v
                                                                        Phase 5 (HVAC mockups)  <- USER GATE
                                                                                               │
                                             ┌─────────────────────────────┬───────────────────┴──────────────┐
                                             v                             v                                  v
                                   Phase 6 (chrome, v1.0.4)      Phase 7 (catalog w1, v1.0.5)      Phase 11 (image pipeline, v1.0.7)
                                             │                             │                                  │
                                             │                             v                                  │
                                             │                   Phase 8 (catalog w2, v1.0.6)                  │
                                             │                             │                                  │
                                             └─────────────────────────────┤                                  │
                                                                           v                                  │
                                                            Phase 9 (page structure, per-service pages)        │
                                                                           │                                  │
                                                                           v                                  │
                                                            Phase 10 (multi-page copy review)                  │
                                                                           │                                  │
                                                                           └──────────────┬───────────────────┘
                                                                                          v
                                                      Phase 12 (HVAC language + reference site)  <- USER GATE
                                                                                          │
                                                                                          v
                                                               Phase 13 (intake, cross-repo, v1.21.0)
```

**The edges that matter, and why each one exists:**

- **P4 before P2.** Converting the console off `file:` before the `v1.20.0` tag exists strands it
  on `v1.19.1`, which lacks every v2.2 field the console actively uses. See the Prerequisites
  section.
- **P4 before Phases 8, 9, 10 and 13.** Phase 8's four page-header variants all take
  `PageHeaderContent`; Phase 9's rhythm work sits alongside `SectionStyle` and writes
  `content.subpages[route].header`; Phase 10 reviews `services.items[].detail`; Phase 13 re-pins
  on top of P4's tag. None of those types is published before P4.
- **Phase 4 is independent of Phases 1 to 3** and can run alongside them: it touches component
  `meta` and tests, not tokens, palette or fonts.
- **Phase 5 is a hard user gate** (decision 34). Nothing after it starts until the user has
  answered the three questions in that phase.
- **Phase 11 (the image pipeline) is independent of Phases 7 and 8** and can run alongside them:
  it touches the export route, `image-placeholders.ts` and `img.ts`, not the catalog. It must
  land before Phase 12, which looks at the finished site.
- **Phase 10 strictly follows Phase 9.** There is nothing to group the copy review by page for
  until the per-service routes exist, and the Phase 12 reference site should carry reviewed copy
  rather than raw model output.
- **Phase 12 is the second user gate** and the real gate for the whole upgrade.
- **Phase 13 is last** because it is the only phase that spans three repos, and because its
  schema bump should land on a system that is otherwise finished and green.

`@jdd/ui` tag sequence, one release per phase that touches `packages/ui/src`: **v1.0.3** (Phase 2,
palette warmth plus removing the unpublished `sectionVars`), **v1.0.4** (Phase 6, motion
deprecations), **v1.0.5** (Phase 7, five `SKINS` entries), **v1.0.6** (Phase 8, seven `SKINS`
entries), **v1.0.7** (Phase 11, the `img.ts` local-asset branch and the four-width `WIDTHS`).
Re-pin console **and** template each time, with an explicit tagged `npm install`. Phases 0, 1, 3,
4, 5, 9, 10, 12 and 13 must not cut a tag.

`@jdd/schema` tag sequence: **v1.20.0** (prerequisite P4, the v2.2 content fields), **v1.21.0**
(Phase 13, the three decision-29 intake fields). Re-pin all three consumers each time.

---

## Critical files for implementation

The files where a mistake is either expensive or silent. Read each one before you change it.

- `C:\Users\Xander\Desktop\ops\jdd-schema\src\site.ts` **and `dist\site.d.ts`**: prerequisite P4
  commits and tags the uncommitted v2.2 work here as `v1.20.0`, and Phase 13 adds three intake
  fields as `v1.21.0`. **Always verify a schema claim against `dist/site.d.ts`, never `src/`**
  (§0.2 rule 3): a field absent from the reading app's pinned tag is silently stripped by zod on
  read, with no error. This is the single highest-consequence file in the plan, because its
  failure mode is data quietly disappearing rather than a build going red.
- `C:\Users\Xander\Desktop\ops\jdd-ops\template\tailwind.config.ts`: the exported token world;
  Phase 1's whole purpose, and the file that makes preview and export agree once it and
  `console/tailwind.config.ts` both import `template/src/styles/tokens.ts`
- `C:\Users\Xander\Desktop\ops\jdd-ops\packages\ui\src\palette.ts`: every derived token
  (`--accent-text` AA loop, `urgentTone`, `--ink-panel`, `--on-ink`) shifts under decision 9;
  carries two hardcoded cool defaults (`readableOn`'s `#0f1b2d`, `accentText`'s `#000000`) that
  must go warm, and is gated by `console\test\palette-contrast.test.mjs`. It is also the file
  carrying the uncommitted `sectionVars` that P3 preserves and Phase 2's §2b deletes, in its own
  git repo that `git status` from jdd-ops does not see.
- `C:\Users\Xander\Desktop\ops\jdd-ops\packages\ui\src\motion.ts`: `parallaxY` is **deprecated in
  place and never deleted**. `verifyCatalogImports` reads this module's exports, and shipped
  client repos import it, so removing the symbol breaks already-exported sites. Phase 6 marks it
  `@deprecated` and bans it in new components via the lint; it stays exported forever (decision 3).
- `C:\Users\Xander\Desktop\ops\jdd-ops\console\src\lib\export.ts`: `CATALOG` (line 43) is the
  server-side allowlist, `BODY_SLOTS` (line 64) gates new categories, `TEMPLATE_OWNED_PREFIXES`
  (line 143) decides what `overwrite` refreshes, `verifyCatalogImports` (line 370) is the drift
  gate, and `wirePages` (line 549) is where decision 24's rhythm wrapper is emitted. Its
  `pageHeader` branch (line ~626) hardcodes `PageHeaderSimple`.
- `C:\Users\Xander\Desktop\ops\jdd-ops\console\src\app\c\[slug]\build\compose-page.tsx`:
  `renderSection` (line ~40) **also** hardcodes `PageHeaderSimple`, for the whole `pageHeader`
  category. **Phase 8's three new page headers are invisible unless BOTH this and `wirePages`
  change.** One without the other gives a studio that shows the wrong header or an export that
  emits the wrong one, and neither fails the build.
- `C:\Users\Xander\Desktop\ops\jdd-ops\console\src\app\c\[slug]\build\LaunchDialog.tsx` and
  `DeployDialog.tsx`: **check these before Phase 9 changes any home template.** `PageStudio`
  still derives the export payload through `homeLegacyView`, which flattens to one component per
  category, last wins. Both dialogs must send `composition`, not `selections`. If either sends
  only `selections`, an eight-section home page silently exports as five. This is Phase 9d and it
  is a read-first check, not a change.
- `C:\Users\Xander\Desktop\ops\jdd-ops\console\src\app\c\[slug]\build\categories.tsx`: the studio
  registry; every new component and both new categories land here, including the `CategoryEntry`
  `id` and `iconName` unions. **`iconName` has no resolver**: grep for `Compass` across
  `console/src` returns only the union and the literals, so extending it is a **type-only** edit.
  If any instruction tells you to "add the new cases to the icon resolver", the correct action is
  to record that no resolver exists.
- `C:\Users\Xander\Desktop\ops\jdd-ops\console\test\catalog-invariants.test.mjs`: where the
  archetype-collision lint (decision 23) and the four hard bans (decision 30 a-c) run, and the one
  test that proves `CATALOG`, the studio registry and `SKINS` still agree. **Decision 30(a) is
  three precise clauses, not a blanket `grid-cols-3` ban**: `services/ServicesGrid`,
  `work/RecentJobsGrid` and `testimonials/TestimonialsGrid` all legitimately carry
  `lg:grid-cols-3` and all three pass with **no baseline allowlist**. Do not simplify the rule
  into a blanket ban with exceptions.
- `C:\Users\Xander\Desktop\ops\jdd-ops\console\src\app\c\[slug]\build\page-templates.tsx`:
  decisions 17, 19, 20 and 24 all land here, and it is what `console\test\page-rhythm.test.mjs`
  reads to enforce decisions 12, 26 and 30(d)
- `C:\Users\Xander\Desktop\ops\jdd-ops\console\src\data\image-placeholders.ts`: `isOwnPlaceholder`
  (line 218) and `needsFill` (line 262) are the provenance machinery decision 13 exists to
  preserve, and **Phase 11c rewrites both** so detection reads `_meta.placeholder_images` and
  `_meta.local_images` instead of exact-matching a URL. Left alone, Phase 11's `/img/<hash>`
  rewrite makes every stock placeholder permanently indistinguishable from a real client photo.
- `C:\Users\Xander\Desktop\ops\jdd-ops\console\src\components\wizard\CopyWireframe.tsx`: the only
  review surface for generated copy, and it omits `subpages` today. Phase 10 regroups it by page
  and re-keys its verdicts. `brief.tickedSections` is `string[]` in `@jdd/schema`, so composite
  keys need no schema bump, but it is persisted in **two** places (`.draft.json` and
  `site.ts`'s `_meta.copyBrief`), so a key-shape change needs a read-time normaliser.
- `C:\Users\Xander\Desktop\ops\jdd-ops\console\src\lib\fonts.ts` plus the two
  `fonts.loader.ts` twins: **the two loaders are deliberately asymmetric and must stay that way.**
  The template loader sets `preload: false` on every family and attaches only the families the
  brand's stacks name; the console loader loads everything and does not set `preload: false`,
  because it is the pairing picker. Blanket preloading here previously cost 292KB of woff2 and
  84% of a 4.2s LCP in Render Delay. Also: **the `instrument` pairing caps at weight 700**, which
  is why a pairing carries its own display weight instead of inheriting SPEC §3's blanket 800.
  Asking `next/font` for an 800 from Instrument Sans is a build error.
- `C:\Users\Xander\Desktop\ops\jdd-ops\console\src\lib\pages.ts` and
  `console\src\lib\verticals.ts`: **both are imported by client components.** Never add
  `node:fs`, never add `server-only`, never import `@/lib/export` into either (§0.2 rule 6).
- `C:\Users\Xander\Desktop\ops\jdd-ops\console\design\foundation-v2\NOTES.md`: the running record.
  Every prerequisite outcome, every tag cut, every measurement, and anything this plan did not
  specify that you had to decide.
