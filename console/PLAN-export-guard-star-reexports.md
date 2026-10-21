# PLAN — teach `verifyCatalogImports` to read `export *` shims

Status: **IMPLEMENTED 2026-10-20.** Steps 1–6 done; Step 4.4's `npm run build` of
`_e2e_test_growth` is BLOCKED on an unrelated @jdd/schema bug — see "Outcome" at the bottom.
Owner file: `console/src/lib/export.ts` (+ one new module, one new test, one client repo).

---

## 0. The defect, established

An export of `_e2e_test_starter` (multipage composition) aborted at export step **2b** with 47
problems, all of the form:

```
src/components/catalog/nav/NavMinimal.tsx imports 'skinClasses' from '@/lib/skins',
which the repo's copy does not export.
```

**Every one of those 47 is a false positive. Nothing is missing from the template.**

`readExports()` (`console/src/lib/export.ts:384`, nested inside `verifyCatalogImports`) collects
named exports with two regexes:

```ts
/^export\s+(?:async\s+)?(?:const|function|type|interface|class|let)\s+(\w+)/gm
/^export\s*\{([^}]+)\}/gm
```

Neither matches `export * from '…'`. The template-fidelity-v2 work turned
`src/lib/{skins,motion,img,icons,LeadForm,merge,color,palette,cn}` into four-line re-export shims
of `@jdd/ui/*`, in **both** `console/src/lib` and `template/src/lib`. A shim's only export line is
`export * from '@jdd/ui/skins'`, so `readExports` returns an **empty Set** — not `null`, because the
file does exist — and `verifyCatalogImports` then flags every single imported symbol.

Measured, running the exact production regexes over the real files:

| file | parsed exports |
|---|---|
| `template/src/lib/skins.ts` | *(empty)* |
| `clients/_e2e_test_starter/repo/src/lib/skins.ts` | *(empty)* |
| `clients/_e2e_test_growth/repo/src/lib/skins.ts` (pre-migration, real impl) | `SkinId, SkinDef, SKINS, skinsFor, defaultSkin, isValidSkin, supportsSkin, SkinClasses, skinClasses` |

The import census confirms the mechanism. Catalog components import 8 libs:

```
43  @/lib/editable      <- NOT flagged (real file, real export declarations)
36  @/lib/skins         <- flagged (shim)
17  @/lib/motion        <- flagged (shim)
 6  @/lib/img           <- flagged (shim)
 6  @/lib/LeadForm      <- flagged (shim)
 3  @/lib/icons         <- flagged (shim)
 2  @/lib/useCountUp    <- NOT flagged (real file)
 1  @/lib/useScrolled   <- NOT flagged (real file)
```

The flagged set is exactly the shimmed set. The single most-imported lib is not flagged.

### Second defect in the same function

`staleRepo` (`export.ts:416`, `templateExportsOf`) is computed by running the same regexes over
`template/src/lib/<lib>` — also a shim, also empty — so it is **always `false`**. Therefore
`route.ts:264`'s `importProblems.every((p) => p.staleRepo)` can never be true. The route always
takes the "the template is out of date" branch and prints

> Fix: copy the missing export(s) from console/src/lib into template/src/lib

which is a no-op (the two files are byte-identical shims), while the branch that would have been
right for a stale repo ("export again with overwrite enabled") is unreachable dead code.

### Why nothing caught it

`grep -rn verifyCatalogImports console/test` → no hits. The function has no test. The shims each
carry the comment *"and so verifyCatalogImports still finds it"*, so the migration did consider the
guard — it just verified that the **file** existed, not that the guard could **read** it.

### The drift axis moved, and nothing watches the new one

`package.json` is deliberately excluded from `TEMPLATE_OWNED_FILES` (`export.ts:145`) because
reverting it once dropped `@vercel/speed-insights`. So an overwrite export refreshes `src/lib/` to
shims but leaves the repo's `@jdd/ui` pin untouched. Current state:

| | `@jdd/ui` pin |
|---|---|
| `console/package.json` | `#v1.0.7` |
| `template/package.json` | `#v1.0.7` |
| `clients/_e2e_test_starter/repo/package.json` | `#v1.0.7` |
| `clients/_e2e_test_growth/repo/package.json` | **`#v1.0.1`** (installed: 1.0.1) |

Export-surface diff 1.0.1 → 1.0.7 is one symbol: **`responsivePicture`** in `img`, imported by
`HeroOverlap` and `HeroSplit`. `_e2e_test_growth/repo` has `hero/HeroSplit.tsx` placed. Once the
symbol guard is fixed, a version-pin check is the only thing that can catch this class of failure.

---

## Decisions taken (do not relitigate)

1. **Resolve the star.** Follow `export * from '@jdd/ui/<sub>'` through the package's `exports` map
   and parse the real file. The guard keeps its purpose; a genuinely missing symbol still fails.
2. **Check the `@jdd/ui` pin, report only.** Never rewrite a client repo's `package.json`
   automatically — that is the `@vercel/speed-insights` regression.
3. **Fix `_e2e_test_growth/repo` in this pass.**

### One finding that arrived after those decisions

All 12 catalog components placed in `_e2e_test_growth/repo` also differ from the console's current
catalog (`diff -q` → DIFF on all 12). That repo is wholly pre-migration: old components, old libs,
old pin. Refreshing only `src/lib` would leave pre-migration components compiling against
post-migration libs — a combination nobody designed and nobody has built. So Step 4 does the pin
bump by hand (no export will ever touch `package.json`) and then refreshes components and libs
*together* through the normal overwrite-export path. Same intent, executed through the real path,
and it exercises the Step 1–3 fix end to end.

---

## Step 1 — extract the parser into a testable module

**Why a new module:** a test cannot import `export.ts`. Verified —
`node --import tsx --test` on a probe importing `../src/lib/export.ts` dies with
`ERR_PACKAGE_PATH_NOT_EXPORTED: No "exports" main defined in …/node_modules/@jdd/schema/package.json`.
`export.ts` imports `@jdd/schema`, `@/data/site` and `@/lib/pages`; Next's bundler resolves that,
the node/tsx ESM loader does not. The new module must import **only** `node:fs` and `node:path`,
which is how `console/test/catalog-invariants.test.mjs` already imports `../src/lib/archetypes.ts`
successfully.

Create **`console/src/lib/libExports.ts`**. Move `readExports` out of `verifyCatalogImports` into
it, renamed and extended:

```ts
// Parse the named exports a `src/lib/<lib>` file provides, following `export * from` shims.
//
// The catalog's shared helpers live in @jdd/ui; `src/lib/*` keeps four-line re-export shims at
// the old paths so components can import '@/lib/…' unchanged. The previous parser had no case
// for `export * from`, so every shim read as zero exports and verifyCatalogImports flagged all
// 71 catalog lib imports as missing — see PLAN-export-guard-star-reexports.md §0.

export interface LibExports {
  /** Named exports, or null when the lib file itself does not exist. */
  names: Set<string> | null;
  /** True when a star re-export could not be followed — caller must not treat names as complete. */
  unresolved: string[];
}

export function readLibExports(libDir: string, lib: string, uiRoot: string): LibExports
```

Rules it must implement:

- Try `<libDir>/<lib>.ts` then `<libDir>/<lib>.tsx`; first one that exists wins, then stop. (Same
  as today — keep the `break`.)
- File missing entirely → `{ names: null, unresolved: [] }`. Callers keep today's distinct
  "`@/lib/x` does not exist in the client repo" message.
- Keep both existing regexes unchanged. They are correct for real files.
- **New:** for each `/^export\s*\*\s*(?:as\s+\w+\s+)?from\s*'([^']+)'/gm` match, resolve the
  specifier and merge in its exports:
  - starts with `.` → resolve against `libDir`, recurse (`.ts`/`.tsx`), depth cap 4, and keep a
    visited set so a cycle cannot hang the export route.
  - bare specifier → split into package name (`@jdd/ui`) and subpath (`./skins`), read
    `<uiRoot>/../<pkg>/package.json`, look up `exports[subpath]`; a string value is a
    package-relative path; resolve it, parse it, recurse. Handle an object value by taking
    `.default` / `.import` if present.
  - anything that cannot be resolved (package absent, subpath absent from the `exports` map,
    object form with no usable key) → push the specifier onto `unresolved`. **Do not** silently
    return a partial set; a caller that sees `unresolved` must not report missing symbols for that
    lib (that is exactly the false-positive this plan exists to kill), but must say it could not
    verify it.
  - `export * as ns from '…'` contributes a namespace binding, not individual names — record the
    alias as a name and do not recurse.
- No `@jdd/ui` version logic lives here. This module answers "what does this file expose", nothing
  more.

`uiRoot` is the directory holding the resolvable `node_modules`, passed in by the caller so the
module stays path-pure and the test can point it at a fixture.

## Step 2 — rewrite `verifyCatalogImports` on top of it

In `console/src/lib/export.ts`, lines 365–443:

- Keep the exported signature `verifyCatalogImports(repoRoot, slug, written)` and the
  `CatalogImportProblem` shape — `route.ts:259` is the only caller and should not change.
- Delete the nested `readExports`; import `readLibExports` from `@/lib/libExports`.
- Resolve shims from **`console/node_modules`** — i.e. `uiRoot = resolve(process.cwd(), 'node_modules')`.
  `process.cwd()` is the console dir during an export; `placeComponents` (`export.ts:337`) already
  relies on that, so this introduces no new assumption. The client repo's own `node_modules` is
  not an option: step 2b runs *before* step 4's `npm install`, and
  `clients/_e2e_test_starter/repo` has no `node_modules` at all right now. The version-pin checks
  in Step 3 are what make resolving against the console's copy sound.
- `staleRepo` stays on the interface but is now set from the **pin** comparison of Step 3, not
  from parsing `template/src/lib`. Delete `templateExportsOf` and the `templateByLib` map — with
  both sides shimmed they can only ever return an empty set, which is what makes the flag dead
  today.
- When `readLibExports` returns a non-empty `unresolved`, emit one problem per lib (not per
  symbol):
  `"${rel} imports from '@/lib/${lib}', which re-exports ${spec} — that package could not be resolved from the console, so its exports could not be checked."`
  and set `staleRepo: false`. This is an "I could not verify" signal, deliberately loud, because a
  silent pass here is how the original bug class reaches a client repo.

## Step 3 — add the two pin checks, and make both error branches real

New in `console/src/lib/libExports.ts` (pure, testable, `node:fs` only):

```ts
/** The `#vX.Y.Z` tag off a `github:owner/repo#vX.Y.Z` dependency spec, or null. */
export function pinnedTag(spec: string | undefined): string | null

/** -1 / 0 / 1, or null when either side is not a vX.Y.Z tag (branch or commit pin). */
export function compareTags(a: string, b: string): number | null

export interface PinProblem { message: string; staleRepo: boolean }

/** Compare the @jdd/ui pin across console, template and the client repo. */
export function verifyUiPins(args: {
  consolePkg: string; templatePkg: string; repoPkg: string;
}): PinProblem[]
```

Two comparisons, mapping onto the two error branches `route.ts:264` already has:

| comparison | meaning | `staleRepo` |
|---|---|---|
| repo pin **older than** template pin | this client repo carries older shared libs | `true` |
| template pin **older than** console pin | the template genuinely is out of date | `false` |

That is the first time either branch has had real signal behind it. Rules:

- Read `dependencies['@jdd/ui']` from each `package.json`. Missing from the repo → one problem,
  `staleRepo: true`, message naming the template's pin as the one to adopt.
- `compareTags` returns `null` (a branch or commit pin, not a tag) → **no problem, no crash**; add
  a note to the step log that the pin could not be compared. Do not guess.
- Repo pin *newer* than the template's → not a problem. A repo may legitimately run ahead.

Then in `console/src/app/api/build/export/route.ts` around 258–277:

- Call `verifyUiPins` alongside `verifyCatalogImports` and concatenate the problem lists before the
  `if (problems.length > 0)` gate, so one abort reports everything.
- `const stale = problems.every((p) => p.staleRepo)` keeps working and now actually fires.
- Extend the stale-branch fix text, because overwrite alone is no longer sufficient:
  `'Fix: bump "@jdd/ui" in the client repo's package.json to match template/package.json, then export again with "overwrite" enabled (which refreshes src/lib) — package.json is not template-owned, so the export will not change the pin for you.'`
- Leave the step wording at 258 as is. It is accurate.

## Step 4 — fix `clients/_e2e_test_growth/repo`

In order:

1. Edit `clients/_e2e_test_growth/repo/package.json`: `@jdd/ui` `#v1.0.1` → `#v1.0.7`. By hand —
   nothing in the export path will ever do this. Change that one line only; leave every other
   dependency alone (that is the `@vercel/speed-insights` lesson).
2. `npm install` in that repo so `node_modules/@jdd/ui` becomes 1.0.7 (currently 1.0.1).
3. Re-export the client from the console **with overwrite enabled**, so the 12 placed components
   and `src/lib` are refreshed together. All 12 currently differ from the console catalog; a
   lib-only refresh would leave pre-migration components against post-migration libs. This export
   also serves as the end-to-end test of Steps 1–3: before the fix it fails with the same 47-style
   false positives, after the fix it must reach `npm install`.
4. `npm run build` in `clients/_e2e_test_growth/repo`. Must pass. `HeroSplit` is placed there and
   needs `responsivePicture`, which exists only in `@jdd/ui` ≥ 1.0.2 — so a green build here is
   also the proof that the pin bump in (1) was necessary and sufficient.
5. Do **not** push or deploy. Per the Phase 12c gate this is a local build + real-browser review
   only.

## Step 5 — the test that should have existed

New file `console/test/export-guard.test.mjs`, in the house style of
`catalog-invariants.test.mjs` (`node:test`, `node:assert/strict`, fixtures under
`console/test/helpers/`, no new dependency). It imports `../src/lib/libExports.ts` directly —
never `../src/lib/export.ts`, which is unimportable under the tsx loader for the reason in Step 1.

Cases, each one a defect this plan found:

1. **The regression itself.** A fixture lib dir whose `skins.ts` is `export * from '@jdd/ui/skins'`,
   with a fixture `node_modules/@jdd/ui` whose `package.json` maps `./skins` and whose `skins.ts`
   declares `skinClasses`. Assert `readLibExports(...).names` contains `skinClasses` and
   `unresolved` is empty. **This test fails against today's code.** Confirm that before writing the
   fix.
2. **Real files still parse.** A lib file with plain `export const` / `export function` /
   `export type` / `export { X }` / `export { Y as Z }` — all names present. Guards against the
   rewrite regressing the case that works today.
3. **A genuinely missing symbol still fails.** Same shim fixture, but the `@jdd/ui` stub does not
   declare `parallaxY`; assert it is absent from `names`. This is the `parallaxY` incident the
   guard was originally written for — it must still be caught through a shim.
4. **Unresolvable star is reported, not swallowed.** Shim pointing at a package that is not in the
   fixture `node_modules`: `unresolved` contains the specifier. Assert the caller contract by also
   asserting `names` is not silently treated as complete.
5. **Missing lib file** → `names === null`, so the distinct "does not exist in the client repo"
   message is preserved.
6. **Relative star** → `export * from './skins-impl'` resolves, and a two-file cycle terminates
   instead of hanging.
7. **Pin comparison:** `pinnedTag('github:JuneauDigitalDesigns/jdd-ui#v1.0.1')` → `'v1.0.1'`;
   `compareTags('v1.0.1','v1.0.7')` < 0; `compareTags('v1.0.10','v1.0.7')` > 0 (string compare
   would get this one wrong); a branch pin → `null`; `verifyUiPins` with repo 1.0.1 / template 1.0.7
   yields one problem with `staleRepo: true`, and with template 1.0.1 / console 1.0.7 yields one
   with `staleRepo: false`.

## Step 6 — verify

```
cd console && npm test                     # new suite green, existing suites still green
cd console && npx tsc -p tsconfig.json --noEmit
```

Then the real proof, in this order:

1. Export `_e2e_test_starter` from the console. Step 2b must pass and the run must reach
   `Installing dependencies…` — the 47 problems are gone. That repo has no `node_modules`, so this
   is also a first-install path.
2. Step 4's overwrite export + `npm run build` of `_e2e_test_growth`.
3. A deliberate negative: temporarily edit a fixture or a scratch copy so a component imports a
   symbol `@jdd/ui` does not export, and confirm step 2b still aborts with a real message. A guard
   that cannot fail is the state we are leaving, not the one we are entering.

Record the Step 4 outcome in `console/design/foundation-v2/NOTES.md`, which is the authoritative
log for the template-fidelity-v2 rebuild.

---

## Out of scope

- Making `package.json` template-owned, in whole or in part. Decision 2 was report-only.
- Replacing the regex parser with a real typecheck (`tsc --noEmit` on the repo). It needs
  `node_modules`, so it would have to move after step 4's install and would cost the fail-fast
  property step 2b exists for. Revisit only if the parser needs a third extension.
- The `_e2e_test_starter` repo's own content/components beyond re-running the export.
- Anything in `@jdd/ui` itself. Its source is correct; only the console's reading of it was wrong.

---

## Outcome (2026-10-20)

Implemented as planned, with one deliberate change of mind and one blocker found downstream.

**Changed from the plan: `staleRepo` keeps its symbol-level signal.** The plan said to delete
`templateExportsOf` and drive `staleRepo` purely from the pin comparison. That was wrong, and the
first real export proved it within minutes: a non-overwrite export of `_e2e_test_growth` correctly
flagged `HeroSplit` importing `responsivePicture` from a pre-migration `img.ts`, but — with the
pins equal after the bump — reported it as "the template is out of date" when the truth was a
stale repo. The symbol comparison against `template/` was only ever dead because the parser
stopped at a shim; following the star revives it. Both signals are now live: the per-symbol
template comparison, plus `verifyUiPins`. The symbol loop moved into `verifyLibImports` in
`libExports.ts` (as the plan's Step 1 sketched) so the verdict is unit-testable, and a template
whose own read is incomplete can never produce a stale-repo verdict.

**Also changed:** the route's non-stale fix text. The plan only corrected the stale branch, but
"copy the missing export(s) from console/src/lib into template/src/lib" is a no-op for a shim; it
now names @jdd/ui, the tag and the pin bump first, with the real-file case second. And
`console/tsconfig.json` excludes `test/helpers/lib-fixtures/**` — the fixtures deliberately
contain an unresolvable star and a re-export cycle, which `tsc` would fail on.

**Results.** `npm test` 265/265 (23 new). `npx tsc --noEmit` exit 0. `_e2e_test_starter`'s 28
placed components: **0 problems**, where the same inputs produced 47. `_e2e_test_growth` bumped to
@jdd/ui v1.0.7 and re-exported with overwrite: step 2b passed straight into `npm install`, and its
`src/lib` is now the shims rather than the pre-migration snapshot. Negative test (one repo lib
re-staled to drop `responsivePicture`, overwrite off): aborted at step 2b **before** npm install,
named the symbol, chose the stale-repo branch, printed the pin+overwrite remedy. Restored after.

**Blocker for Step 4.4 / Phase 12c, outside this plan.** With the guard fixed, the
`_e2e_test_growth` build now reaches `✓ Compiled successfully` and fails at type-check:

```
./src/components/catalog/about/AboutStory.tsx:44:32
Type error: Property 'ownerName' does not exist on type 'ExtensionsContent'.
```

@jdd/schema v1.24.0 added the decision-29 fields (`ownerName`, `brandsCarried`, `responseTime`) to
`src/site.ts` but not to `src/site-types-source.ts` — the hand-mirrored string constant that every
exported client repo inlines as the types of its `src/data/site.ts`. The header of `site.ts` says
"Keep the two in sync" and nothing enforces it. The export writes `"ownerName": null` as *data*
into a file whose *types* omit it, so the console compiles and every client repo does not. This is
the same drift family this plan addressed, one layer deeper: not a `@/lib/*` import, but the
generated schema type surface, which no guard covers.

Fixing it is a jdd-schema change plus a release: mirror the three fields into `SITE_TYPES_SOURCE`,
tag, bump the pin in `console/package.json`. Worth adding a check-pins-style assertion that the
two files agree, since this will otherwise recur on the next schema field.
