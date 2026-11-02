# HANDOFF — dead chrome links on multi-page sites

**Status:** open. This is the unfinished remainder of a two-part bug report.
**Branch:** `feat/onboard-wizard-redesign` (all prior work uncommitted in the ops repo).
**Written:** 2026-10-23.

---

## 1. Why you are here

The operator reported two symptoms after provisioning a starter client:

1. *"The live site only shows the navbar and the footer."* — **FIXED.** Six separate defects;
   see §7. Not your problem, but read §7 anyway: it explains why this area had no working
   history to regress from.
2. *"When I click the links in the nav bar, they point to IDs rather than changing the route."*
   — **PARTIALLY FIXED. This is your job.**

What got fixed for #2: the exporter regenerates `SiteContent.nav` from the composition
(`content.nav = navLinksFor(composition)`, `console/src/app/api/build/export/route.ts:198`), so
the main nav now renders `/`, `/services`, `/about`, `/contact`.

What did **not** get fixed: every *other* link in the site chrome. Those are still single-page
`#anchor` hrefs, and on a multi-page site many of them point at nothing.

---

## 2. The live evidence

`_e2e_test_starter` is deployed at **https://e2eteststarter.vercel.app** and is a working
reproduction. All four routes return 200 and render real content. Measured on the live site:

| Route | Dead anchors (link exists, no matching `id=` on that page) |
|---|---|
| `/` | `#cta`, `#about` |
| `/services` | `#top`, `#about`, `#testimonials` |
| `/about` | `#top`, `#services`, `#faq` |
| `/contact` | `#top`, `#services`, `#about`, `#testimonials` |

Reproduce with:

```bash
for r in "" services about contact; do
  html=$(curl -s -m 25 "https://e2eteststarter.vercel.app/$r")
  dead=""
  for id in top cta services about testimonials faq work contact; do
    hl=$(printf '%s' "$html" | grep -coE "href=\"#$id\"")
    ht=$(printf '%s' "$html" | grep -coE "id=\"$id\"")
    [ "$hl" -gt 0 ] && [ "$ht" -eq 0 ] && dead="$dead #$id"
  done
  printf "/%-9s dead:%s\n" "$r" "${dead:- none}"
done
```

**The dead set is composition-dependent, not fixed.** `#cta` is dead on any page without a
`finalCta` section; `#about` is dead on any page without an `about` section. Note `/` has dead
links too — this is not purely a subpage problem, and a fix that only special-cases subpages is
wrong. (The deployed home composition happens to carry no `finalCta` and no `about` section,
which is a perfectly legal composition.)

---

## 3. The problem decomposes into three independent pieces

Confirm each before you start; they have different fixes and different blast radii.

### A. Content-data anchors in `footer.cols[].links[].href` — the big one

`FooterColumns.tsx:109` renders `href={link.href}` from `CONTENT.footer.cols[].links[]`. That
data is authored with single-page anchors and **nothing in the export path rewrites it**:

```bash
# nothing rewrites footer hrefs:
grep -rn "footer.cols" console/src/lib/ console/src/app/api/build/   # -> no hits
# navLinksFor is applied to content.nav and nothing else:
grep -n "navLinksFor" console/src/app/api/build/export/route.ts      # -> one hit, line 198
```

Live data in the deployed `src/data/site.ts`:

```json
"footer": { "cols": [
  { "h": "Services", "links": [
      { "label": "Furnace Repair", "href": "#services" },
      { "label": "AC Installation", "href": "#services" }, … ] },
  { "h": "Company",  "links": [
      { "label": "About Us", "href": "#about" },
      { "label": "Reviews",  "href": "#testimonials" },
      { "label": "FAQ",      "href": "#faq" },
      { "label": "Contact",  "href": "#cta" } ] } ] }
```

Authored in the vertical presets — `console/src/data/site.ts:297-300`,
`console/src/data/verticals/*.ts` (e.g. `car-detailing.ts:145-147`) — and carried into each
client's intake.

**This is data, not component code**, so the natural fix is the one that already exists for
`nav`: remap it in the exporter from the composition. That means no package release (see §4).

### B. Hardcoded anchors in the nav components

Only four, all in `nav/`:

| File:line | href | Dead when |
|---|---|---|
| `console/src/components/catalog/nav/NavMinimal.tsx:65` | `#top` (brand wordmark) | always, off-home — only `hero/*` emits `id="top"`, and heroes are home-only |
| `console/src/components/catalog/nav/NavMinimal.tsx:86` | `#cta` (desktop CTA) | any page with no `finalCta` |
| `console/src/components/catalog/nav/NavMinimal.tsx:141` | `#cta` (mobile CTA) | same |
| `console/src/components/catalog/nav/NavEmergencyBar.tsx:61` | `#cta` ("Book now") | same |

`FooterColumns.tsx:124` / `FooterMinimal.tsx:67` render `legalLinks[].href`, which is `"#"` in
the presets. Dead on every page including home — but that is a **pre-existing content gap,
unrelated to multi-page**. Out of scope unless you want it; don't let it widen this task.

### C. `isDanglingLink` is single-page-only and is never consulted at export

`console/src/app/c/[slug]/build/nav-targets.ts` is the existing registry of category → anchor
and already has exactly the right concept:

```ts
/** True when `href` points at a KNOWN section anchor that is NOT currently on the page */
export function isDanglingLink(href: string, order: string[]): boolean
```

Two gaps: it takes a single flat `order` (one page), and its only consumer is
`build/brand/NavLinksPane.tsx` — the Studio's nav editor. It is not applied to `footer.cols`,
and it is not consulted by the export route. **Read its header comment before changing it**: it
documents why `finalCta` is `#cta` and not `#finalCta` (live client repos already ship that
anchor), and why `#top` is deliberately not policed.

---

## 4. Correction to an earlier assessment — read this

My previous summary said fixing this "means a `@jdd/ui` package bump and re-pin in both
`package.json` files." **That is too pessimistic and you should not plan around it.**

It came from noting that `console/src/lib/skins.ts` and `template/src/lib/skins.ts` are both
`export * from '@jdd/ui/skins'` shims, so a *new shared lib helper* imported by catalog
components would need a release. True as far as it goes — but neither piece actually needs one:

- **Piece A is data.** The remap belongs in `console/src/lib/pages.ts` next to `navLinksFor`
  and is called from the export route. `pages.ts` is console-only and client-safe. No package,
  no catalog change, no `verifyCatalogImports` exposure.
- **Piece B needs no new import.** Both nav components already destructure `nav` from
  `CONTENT` (`NavMinimal.tsx:49`, `NavEmergencyBar.tsx:30`), and `NavEmergencyBar.tsx:37`
  **already branches on it** — `const showLinks = nav.length > 1`. Deriving "this is a
  multi-page site" from `nav` (e.g. any `href` starting with `/`) follows a pattern that is
  already in these files.

Only reach for a `@jdd/ui` release if you decide the derivation deserves to be a shared
helper. If you do, the dance is: add the export, tag, then bump `"@jdd/ui"` in **both**
`template/package.json` and `console/package.json` — `verifyUiPins` fails the export if the
client repo's pin is behind the template's.

---

## 5. The open decision — ask the operator, don't invent it

**Where should a footer service link point on a multi-page site?**

- `/services` (the services index), or
- the decision-20 per-service route `services/<slug>` (see `servicePageRoutes()` in
  `console/src/lib/pages.ts:125`), which is generated per service item and is `navVisible:
  false`.

The second is more useful and is what those links semantically are ("Furnace Repair" →
the Furnace Repair page). But per-service pages are optional and may not exist in a given
composition, so it needs a fallback to `/services`, and `/services` needs a fallback to the
anchor for genuinely single-page sites. Get the call made before building it.

Secondary, cheaper question: should a dangling link **fail** the export (like
`validateComposition` now does for empty pages) or just **warn** on the NDJSON stream? Dead
chrome links are cosmetic, not lead-losing, so warn is probably right — but `validateEntries`
precedent is to refuse. Worth one sentence of confirmation.

---

## 6. Conventions you must follow

From `CLAUDE.md`, and they are enforced:

- **Every test encodes a bug that actually shipped**, not a hypothetical. A regression test
  that cannot fail is decoration — **break the fix and watch it go red before you trust it.**
  (All six fixes in §7 were verified this way; 11 perturbations, each confirmed red.)
- `node:test` + `node:assert/strict`, files named `*.test.mjs`. Root suite needs no
  devDependencies; console suite runs under `tsx`.
- **Import real implementations, never mocks.**
- Keep both suites green: `npm test` (root, 122) and `cd console && npm test` (console, 338).
- **Do not import `console/src/lib/export.ts` from a console test.** It pulls `server-only`
  (throws under the tsx loader) and `@jdd/schema` (unresolvable there). The standing workaround
  is to read it as text — see `console/test/export-guard.test.mjs`'s header,
  `section-styles.test.mjs`, and `composition-manifest.test.mjs`. If you need to test new
  logic, put it in a module that does not import those (as `readback-parse.ts` and
  `composition-manifest.ts` were split out for exactly this reason).
- Import `isValidSkin`/`supportsSkin`/`SKINS` from `@jdd/ui/skins`, **not** through
  `../src/lib/skins.ts` — tsx will not surface named exports through a star re-export of a
  `.ts` source inside `node_modules`.

Where your tests probably belong:
- Piece A → a new `console/test/footer-links.test.mjs`, or extend `multipage-pages.test.mjs`.
- Piece B → `console/test/catalog-invariants.test.mjs` (it already has the two newest
  invariants, including the `use client` one from §7.6).
- Piece C → alongside `nav-targets.ts`'s consumers.

---

## 7. Context: the six defects already fixed

Worth skimming, because together they explain why multi-page had **never once worked** — your
piece has no working history to regress from, and you should not assume any of this path is
battle-tested.

1. `parseExportedPage` returned a valid-but-empty composition for the bare template (it carries
   the `@studio:body` markers but no catalog imports). Non-null sent `BuildWizard` down its
   "already exported, disk wins" branch, which **discarded the operator's saved composition in
   favour of nothing**. → `console/src/lib/readback-parse.ts`.
2. `b.selections || b.order` — `{}` and `[]` are truthy, so that empty readback lifted to a
   one-page site with zero sections instead of the 4-page default. →
   `compositionFromBundle` in `pages.ts`.
3. No server-side guard: `validateEntries` only checks the catalog allowlist and chrome alone
   fills it with three valid entries, while `validateComposition` **had zero callers anywhere**.
   → now called from the export route, plus an empty-body rule.
4. `onboard.js` step 3 spliced the raw intake over the console's `site.ts` on every run — the
   actual source of the reported `#about` nav. → field-level ownership via
   `lib/provisioned-fields.js`; see §8.
5. `home-standard` assigned `skin="inverted"` to `FinalCtaBanner`, which has no `skin` prop, so
   `validateEntries` refused it — **the default 4-page site was not exportable at all.**
6. No `pageHeader` component declared `'use client'` while three import
   `@phosphor-icons/react`, whose module scope calls `createContext`. Every subpage build died
   with `(0 , l.createContext) is not a function`. Only reachable on a multi-page export, which
   because of #5 had never completed.

New files from that work: `lib/provisioned-fields.js`,
`console/src/lib/{composition-manifest,readback-parse,provisionedFields}.ts`, and five
`console/test/*.test.mjs` plus `test/schema-ownership.test.mjs`.

---

## 8. Two things not to break

**The provisioned-field contract.** `applyTwilioNumberToSite` (`onboard.js:726` at time of
writing — grep the name, the §7 work is uncommitted so line numbers in `onboard.js`,
`pages.ts`, `export.ts` and the export route will drift) writes the
published JDD Twilio number into `brand.phone`/`phoneHref`; the console's export payload
carries the *owner's* intake number in those same fields. The exporter now snapshots the repo's
`site.ts` **before `copyTemplate`** (which reverts it, as it is in `TEMPLATE_OWNED_FILES`) and
overlays `PROVISIONED_FIELDS` back on. Revert that and the site republishes the owner's line,
every caller bypasses `/api/voice`, and there is no error anywhere — CLAUDE.md's "Twilio
ownership" section explains the full failure. `console/test/provisioned-fields.test.mjs` and
`test/schema-ownership.test.mjs` guard it. **If you touch `footer` or `nav` content in the
export path, do not reorder that snapshot.**

**The composition manifest.** `.studio/composition.json` in each client repo is now the record
of what the exporter wrote, and `reconcileRoutes` (`composition-manifest.ts`) **deletes page
directories** based on it. It replaced the inference that collapsed four-page sites to one. If
you add a content remap, it must not change the manifest's contents.

---

## 9. State of the tree when this was written

- **Ops repo:** branch `feat/onboard-wizard-redesign`, **all §7 work uncommitted** (12 modified,
  8 new files, plus pre-existing unrelated changes from the wizard redesign). Root 122 pass,
  console 338 pass, `npx tsc --noEmit` clean, `node scripts/record-dry-runs.js --check` current
  (phase contract stable).
- **Client repo `clients/_e2e_test_starter/repo`:** clean, and `4c2c174 studio: update E2E
  Starter Test Co. (no changes)` is **committed and pushed to `origin/main`** — this is what is
  live. Be aware: **I did not make that commit.** Both of my export runs sent `deploy:false`
  and reported `pushed:null` with no commit/push step in the stream; the message matches
  `DeployDialog`'s auto-generated format, so it was deployed from the console UI left running
  on `localhost:3040`. The deployed composition is therefore the operator's own (home uses
  `HeroFormFocus`/`TrustBadges`/`DifferentiatorsRail`/`ServicesSpotlight`/
  `TestimonialsCarousel`/`FaqIndex`/`ContactSplit`), **not** the `defaultCompositionFor()` I
  exported for testing. Do not assume the live site matches the default templates.
- Two dev servers may still be running: console on **3040**, a built client preview on **3055**.
  Stop them before you start, but **do not** use a blanket `taskkill //IM node.exe` — it will
  take unrelated node processes with it.

---

## 10. Suggested order

1. Reproduce §2 against the live URL — confirm the dead set yourself before changing anything.
2. Get the §5 decision from the operator.
3. Piece A (data remap in the exporter) — highest value, lowest risk, no package release.
4. Piece B (four hardcoded nav hrefs) — derive multi-page from `nav`, as `NavEmergencyBar`
   already does.
5. Piece C (extend `isDanglingLink` per-page; warn on the export stream).
6. Re-export `_e2e_test_starter` with `deploy:false`, re-run the §2 probe locally, then ask
   before pushing. The repo is live and wired to a real Twilio number.
