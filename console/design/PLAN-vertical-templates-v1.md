# PLAN — Vertical Standard Templates v1

One bespoke whole-site template per industry vertical, fed by per-vertical client input
collected on the agency site.

Status: **approved mockups, all open questions resolved. Execution runbook: `EXEC-vertical-templates-v1.md`.**
Scope: **four verticals** — roofing, plumbing, lawn-care, car-detailing.
Mockups: `design/vertical-templates-v1/home-mockups.html` (HVAC reference + 4 verticals)
Ground truth for HVAC: `design/northstar-standard/mockups.html` + the 12 `Hvac*` components
**Health is out of scope** — see `design/HANDOFF-health-vertical-research.md`.

---

## 0. Decisions already made

Recorded here because every phase below depends on one of them, and because three of these
reverse something the code currently does.

| # | Decision | Consequence |
|---|---|---|
| D1 | **Roofing loses the blue-grey family.** Bitumen `#241E1B` structural dark, warm grey ground, clay `#B4512A` accent, amber `#E8A33D` for urgency only | HVAC keeps sole ownership of navy + steel. Already applied to the mockup. |
| D2 | **Flat bespoke component files per vertical**, exactly like the existing `Hvac*` set | ~48 new files, ~60 total catalog components. No shared primitive layer. |
| D3 | **Per-vertical client input, driven by `industry`**, extending `industry-menu.ts` | Clients are asked only for what their own template renders. |
| D4 | **A statistic is NEVER generated.** Copy may be generated from facts; numbers may not | Needs an enforced guard, not just a convention. |
| D5 | **Missing slot → hide the slot, keep the section**, record in `_meta.missing_fields`, surface on the go-live checklist | Never a blank box, never an invented number, site always ships. |
| D6 | **HVAC renders the approved orange/navy/Oswald look** | Reverses the live `VERTICAL_LANGUAGES.hvac` override. |
| D7 | **Every CTA that is not a phone number routes to `/contact`** | Phone CTAs stay `tel:`. Buttons inside a lead form submit it. See §10.1. |
| D8 | **Lawn's frequency picker pre-fills the contact form's optional field** | Needs a new `initialMessage` prop on `LeadForm` in `@jdd/ui`. See §10.3. |
| D9 | **Roofing's storm card is a form, not a phone number** | An inline `<LeadForm>` with **plan-derived mode** — see §10.4 (D11). |
| D10 | **The lawn offer ribbon ("First mow free") is client-supplied** | New `extensions.offerBadge` slot, asked at onboarding. See §10.2. |
| D11 | **`LeadForm.mode` stays strictly plan-derived.** Starter → email, growth/enterprise → phone | No new field, no route change. A growth client's forms ask for a phone number, which is what the Retell callback needs. See §10.4. |
| D12 | **`VerticalLanguage` is the single palette + typography source** | `VERTICAL_LANGUAGES` is corrected to the approved values; `verticals/*.ts` palettes become vestigial. Four-axis contract intact. See §2.1. |
| D13 | **Health is removed from this programme** and gets its own research cycle | Decision 46 NOT taken. Mockup parked, handoff written. Four verticals in scope, not five. |
| D14 | **Lawn gets a conventional stat band; the season strip is demoted to a slim rail** | Trust numbers take the under-hero slot. Season content is client-supplied — no programme, no rail. See §10.6. |
| D15 | **Car detailing keeps home-page pricing**, degrading to tag-only per card | Price is a fact about the business, so D4 applies: client-supplied only. |
| D16 | **Detailing's "See packages →" routes to `/services`** | The one documented exception to D7, because a browse CTA that opens a form is a dead end. |

### The three reversals

- **D6a — palette.** `hvac.ts` carries the approved `accent #E0602C` / `bg #FFFFFF` / navy
  structure. `presetFor()` then layers `VERTICAL_LANGUAGES.hvac` over it, which is petrol teal
  `#16556A` on warm cream `#FAF7F2`. **What ships today is teal-on-cream, not the approved look.**
- **D6b — typography.** Same mechanism: `VERTICAL_LANGUAGES.hvac.pairingId` is `'instrument'`,
  so headings render Instrument Sans where the mockup and the preset both say Oswald + Inter.
- **D6c — section order.** The mockup is `… area → reviews → FAQ → CTA`; `hvacTemplate()` is
  `… area → FAQ → reviews → CTA`. Minor, but they disagree, so one is wrong.

---

## 1. BLOCKER — close the schema pin skew

This work edits `@jdd/schema`, the console, **and** the agency site in the same change. They are
currently on three different pins, so a schema field added for the agency form would be invisible
to the console (or vice versa) depending on which repo you looked at.

```
jdd-ops/console                 v1.27.0   ← ahead
jdd-ops (root / onboard.js)     v1.26.0
juneau-digital-designs          v1.26.0
```

`HvacFinalCta.tsx` already reads `finalCta.headlineEmphasis`, which only exists in v1.27.0 — it
degrades safely today only because `CtaHeadline` guards on a falsy emphasis.

**Do first, before anything else:**

1. Bump `jdd-ops` root and `juneau-digital-designs` to `v1.27.0`, reinstall, run both test suites.
2. Update `CLAUDE.md`, which still says "pin `@jdd/schema` v1.25.1 in console" — stale by two minors.
3. Adopt the rule: **schema ships first, then both consumers are re-pinned in the same session.**
   A partial re-pin is the failure mode this phase exists to prevent.

---

## 2. Phase 0 — repair the HVAC ground truth

Nothing else should be built on a reference that renders differently from the approved mockup.
Four new templates inheriting the same override mechanism would mean four more silent repaints.

**2.1 — `VerticalLanguage` is the single palette source (D12, RESOLVED).** It stays the
authority; `presetFor()` goes on composing it over the preset. What changes is that the language
entries are corrected to the approved values instead of contradicting them.

```
VERTICAL_LANGUAGES.hvac.palette = {
  accent: '#E0602C',  accentFg: '#FFFFFF',       // was #16556A petrol teal
  bg:     '#FFFFFF',  bgSoft:   '#F4F6F8',       // was #FAF7F2 / #F1EBE2 cream
  ink:    '#13293F',  inkSoft:  '#4C5E74',       // was #1A1512 / #584E45
  rule:   '#E2E8F0',                             // was #DFD6C9
}
VERTICAL_LANGUAGES.hvac.pairingId = 'oswald'     // was 'instrument'
```

The four-axis contract is untouched, so `vertical-language.test.mjs` needs no change to its key
assertion. **But its warmth/AA assertions DO need changes** — confirmed by running the real
`assertWarm`/`assertPaletteAA` helpers against the approved palettes: HVAC/roofing/plumbing use pure-white
grounds that `assertWarm` bans (decision 9), and HVAC's orange accent-fg lands at 4.15 vs the flat 4.5.
Resolved 2026-10-28 (test yields to the approved designs): `assertWarm` is scoped out for a documented
`WARMTH_EXEMPT` set (hvac, roofing, plumbing), and the `--accent-fg`-on-accent check drops to the WCAG
large-text bar of 3.0 (that token only renders as a bold button label). The four-axis KEY-SET assertion is
untouched. See EXEC §T2.2 for the exact edits. `verticals/hvac.ts`'s own palette becomes dead weight — **leave it in place for now**
and delete the vestigial preset palettes as a separate cleanup, so this phase stays a one-file
behavioural change that the §2.4 test can prove.

**2.2 — Same decision for `pairingId`.** Set HVAC's to `'oswald'`. The mockup, the preset, and
`RESEARCH-local-service-visual-design.md`'s Tier-A note all point the same way; only the
`VERTICAL-LANGUAGE-hvac.md` doc argues for Instrument, and it predates the Northstar mockup.

**2.3 — Fix the order disagreement.** Move `HvacReviews` above `HvacFaq` in `hvacTemplate()` to
match the mockup, and update the `vertical-templates.test.mjs` assertion that currently pins the
wrong order.

**2.4 — Add a regression test** asserting `presetFor('hvac').brand.palette.accent === '#E0602C'`
and `fontHeading` resolves to Oswald. This is the test that would have caught D6a/D6b: both
halves looked correct in isolation and disagreed only after composition.

**Gate:** HVAC in the Studio preview matches `design/northstar-standard/mockups.html`. Do not
start Phase 3 before this passes.

---

## 3. Phase 1 — schema: per-vertical template slots

All of this lands in `jdd-schema`, shipped as one minor (v1.28.0).

### 3.1 Extend `IndustryMenu` with `templateSlots`

`industry-menu.ts` is the right home: it already owns the per-vertical relationship and already
drives the form's branching. **Do not put this on `VerticalLanguage`** — that type is capped at
four axes and explicitly forbids naming anything template-specific, and
`vertical-language.test.mjs` enforces it.

```ts
/** What a vertical's template needs from the client that generic intake doesn't collect. */
export interface TemplateSlots {
  /** The stat band. ALWAYS client-supplied — see D4. `prompt` is the question, `example`
   *  is shown as placeholder text and is never submitted as a value. */
  stats: { key: string; prompt: string; example: string; unit?: string }[];
  /** Whether this template renders a review aggregate (score + count + sources). */
  reviewAggregate: boolean;
  /** Per-day hours rather than one free-text line (health's hours table). */
  hoursPerDay: boolean;
  /** Price-from figures per service tier (detailing packages). */
  priceFrom: boolean;
  /** A seasonal programme (lawn's four-season strip). */
  seasons: { key: string; label: string; prompt: string }[] | null;
  /** Mobile-service radius in miles (detailing). */
  serviceRadius: boolean;
  /** Whether this template has an offer-ribbon slot (D10, §10.2). Client-supplied or absent. */
  offerBadge: boolean;
}
```

Per-vertical content, read off the approved mockups:

| Vertical | stats (4) | reviewAgg | hoursPerDay | priceFrom | seasons | radius |
|---|---|---|---|---|---|---|
| hvac | emergency availability · years trading · rating+count · towns covered | ✓ | — | — | — | — |
| roofing | roofs replaced · warranty years · rating+count · typical job days | ✓ | — | — | — | — |
| plumbing | availability · avg arrival time · rating+count · years licensed | ✓ | — | — | — | — |
| lawn-care | lawns serviced weekly · years trading · rating+count · neighbourhoods | ✓ | — | ✓ (per visit) | 4 | — |
| car-detailing | vehicles detailed · coating durability · rating+count · mobile coverage | ✓ | — | ✓ (per package) | — | ✓ |
| ~~health~~ | *out of scope — see `HANDOFF-health-vertical-research.md`* | | | | | |

**Lawn care carries both** (D14): a conventional four-stat band for trust *and* a four-season
rail. Both are client-supplied — the stats because D4 forbids generating numbers, the seasons
because we will not describe a seasonal programme a client does not actually run. Either can be
absent independently; see §10.6.

The per-vertical-slot mechanism still earns its keep: a roofing client is never asked about
seasons, a lawn client is never asked for a mobile radius, and nobody answers a question their own
template has no room for.

### 3.2 Extend `BrandIntakeSubmission`

New optional fields, mirroring the slots. Optional because of the agency form's
"nothing blocks but activation" principle (§4.2):

```ts
stats?: { key: string; value: string; label: string }[];
reviewAggregate?: { score: string; count: string; sources?: {name,score,count}[] } | null;
hoursPerDay?: Record<'mon'|'tue'|…|'sun', string> | null;
servicePrices?: Record<string, string>;      // service label -> "from $249"
seasons?: Record<string, string>;            // season key -> what's included
serviceRadiusMiles?: string | null;
```

### 3.3 Map them in `mapBrandIntakeToIntake`

Replace the two stubs that make this necessary:

- `about.stats: repeat(S.stats, () => ({ n:"", l:"" }))` → map from `f.stats`, emitting
  **only entries the client actually filled.** An empty array is correct and expected.
- `extensions.reviewBadge: null` → map from `f.reviewAggregate`, still `null` when absent.

Then `flag()` each unsupplied slot into `_meta.missing_fields` so the console surfaces it (D5).

### 3.4 Mirror every new field into `SITE_TYPES_SOURCE`

**Easy to miss and fatal if missed.** `writeSiteContent` inlines `SITE_TYPES_SOURCE` as the
client repo's local `SiteContent` interface so the repo needs no `@jdd/schema` dependency. A
field present on the real type but absent from that string makes every exported client repo
fail `next build` with a type error pointing nowhere near the cause. There is precedent:
schema v1.25.1 is literally *"mirror the 4 drifted fields into SITE_TYPES_SOURCE"*.

### 3.5 Enforce D4 — statistics are never generated

A convention cannot hold this; the copy generator is an LLM and the instruction lives in a prompt.

- The copywriter prompt must state that `about.stats` and `extensions.reviewBadge` are
  **client-supplied only** and must be left untouched.
- Add a hard post-generation assertion in the console's copy path: if generated content
  introduces a `stats` entry or a `reviewBadge` that was absent from the intake, **reject the
  generation** rather than ship it.
- Test it by feeding a brief with empty stats and asserting the output still has empty stats.
  Per `CLAUDE.md`: a regression test that cannot fail is decoration — break the guard and watch
  it go red.

---

## 4. Phase 2 — agency site: ask the right questions per vertical

Repo: `juneau-digital-designs`, `app/components/onboarding/onboardingpageclient.tsx` (1,853 lines).

### 4.1 What already works — do not rebuild it

- `business` is step 1 and the industry pick there already drives every later step. Its own
  comment: *"the industry picked there decides what every later step offers."*
- `menuFor()`, `differentiatorsFor()`, `customersFor()`, `palettesForVertical()` already branch.
- The step list is **keyed, not positional** — `lookIndex`, `onLook` and the colour sub-wizard
  all use `findIndex` on a key. Inserting a step is safe; its own comment says so.

### 4.2 Add one step: "Proof & details"

Inserted after `apart` and before `sound` — it is factual, and it belongs with the other
business facts rather than between two creative questions (the same reasoning the file already
applies to `activation`).

**The step renders only the slots `templateSlots[industry]` declares.** A roofer sees four stat
prompts; a lawn-care client sees the four-season strip and a per-visit price, and no stat
prompts at all; a wellness practice sees a per-day hours table.

**It must not block.** The form's stated principle is that a blank field is a follow-up email and
only `activation` blocks. Statistics are the most valuable thing on this step and the thing we
are forbidden from inventing — so the pressure is applied by *design*, not by a gate:

- Each stat row shows its `example` as placeholder text, so the client sees the shape of a good
  answer instead of a blank box.
- The step copy says plainly why we ask: *"We'll write your site copy for you. We won't make up
  numbers about your business — these come from you."*
- Unanswered slots increment `blankCount()` so the existing advisory hint covers them.
- Unanswered slots land in `_meta.missing_fields`, which is what the console chases.

### 4.3 Carry the fields into the payload

Extend `buildPayload()` to emit the new `BrandIntakeSubmission` fields, and add them to the
`review` step's summary so the client confirms what they gave us.

---

## 5. Phase 3 — console: four bespoke component sets

### 5.1 Naming and placement

Per D2, flat files mirroring `Hvac*`:

```
src/components/catalog/<category>/<Vertical><Section>.tsx
  RoofingHero.tsx   PlumbingHero.tsx   LawnHero.tsx   DetailHero.tsx
```

12 sections × 4 verticals = **48 new files**: `nav footer seo pageHeader hero stats services
trust faq testimonials finalCta contact`. (Health would have been a fifth set — it is parked,
see `HANDOFF-health-vertical-research.md`.)

One exception worth noting now rather than discovering mid-build:

- **`LawnStats` renders two things in one section** — the four-stat trust band *and* the slim
  season rail beneath it (D14, §10.6). They share a component because they share the `stats`
  slot in the composition; they degrade independently.

### 5.2 Non-negotiable per-component rules

Each of the 48 files must:

1. Export a `meta` with `verticalTemplate: true` — this is what exempts bespoke components from
   the anti-slop heuristics, and every `Hvac*` file carries it.
2. Carry **no `skin` prop.** These are fixed designs; `skinsFor()` returns nothing for them and
   `wirePages` only emits `skin=` when `supportsSkin` is true.
3. Import **only `@/lib/*` symbols that exist in `template/src/lib`.** `verifyCatalogImports`
   checks placed components against the *repo's* libs, and `verifyUiPins` fails the export when
   the repo's `@jdd/ui` pin is behind the template's. A new helper means: add it to `template/`,
   bump `@jdd/ui`, re-pin — or don't use it. This is how `parallaxY` broke a client build.
4. Wrap every editable string in `<E p="…">` and icons in `<Ico>`, or the Studio's inline
   editing silently does nothing for that field.
5. Use `<LeadForm mode={…}>` in the `finalCta`, with mode from `_meta.selectedPlan`
   (`starter → email`, else `phone`). This is the whole reason the final CTA is a form and not a
   phone box: it POSTs to the `/api/contact` route onboard.js provisions, and the posted field
   must match `LEAD_DELIVERY_MODE`.
6. **Implement D5 degradation** — see §6.

### 5.3 Registration — three places, all required

Miss any one and the failure is non-obvious:

| File | What breaks if skipped |
|---|---|
| `src/lib/export.ts` → `CATALOG` | `validateEntries` throws `Unknown component`; **export refuses** |
| `build/categories.tsx` | Studio preview can't render it; `compose-page` has no entry |
| `lib/skins.ts` | n/a here — these take no skin. Do **not** add them. |

`placeComponents` needs no change: it resolves
`process.cwd()/src/components/catalog/<cat>/<Name>.tsx` by convention.

### 5.4 `VERTICAL_TEMPLATES` — four builders, four pages each

Follow `hvacTemplate()` exactly:

- Home opens with the hero and has **no `pageHeader`**.
- Services / About / Contact each **must** open with a `pageHeader`, or `validateComposition`
  throws.
- `rhythm` stays **unset** on every section. Two reasons, both load-bearing: the bespoke
  components encode their own vertical padding and an `rh-*` wrapper would override it with
  `padding-block !important`; and leaving it unset keeps `validateComposition`'s uniform-rhythm
  ban (decision 30d) from firing, since it only triggers when every rhythm is set.
- Mint fresh section ids per build (`newSectionId()`), so re-applying a template is a clean
  structural reset.

Per-vertical home order, from the approved mockups:

```
roofing   hero · ledger(stats)        · services · area · FAQ     · reviews · CTA
plumbing  hero · stats                · services · area · reviews · FAQ     · CTA
lawn      hero · stats + season rail  · services · area · reviews · FAQ     · CTA
detail    hero · strip(stats)         · services · area · reviews · FAQ     · CTA
```

### 5.5 `VERTICAL_LANGUAGES` — four new entries

Four axes only, and now the single palette authority (D12, §2.1) — so these values are what
actually renders, not a suggestion the preset can contradict. Transcribe from the mockups:

| | pairingId | accent | ground | structural dark |
|---|---|---|---|---|
| roofing | `archivo` | `#B4512A` | `#FFFFFF` / `#F5F2EF` | `#241E1B` bitumen |
| plumbing | `schibsted` | `#1E6FA8` | `#FFFFFF` / `#EEF4F8` | `#0E2A3D` |
| lawn-care | `figtree` | `#2F7A33` | `#FCFCF8` / `#EFF3E9` | `#1E4028` forest |
| car-detailing | `bricolage` | `#C9A14B` | `#0D0E12` / `#14161C` | near-black |

Also needs, per vertical: a `photography.subjects` list, and an `image-placeholders.ts` curation.

`health` gets **no entry** until its research lands; `languageFor('health')` goes on falling
back to HVAC, which after §2.1 means a health client renders in HVAC's orange/navy. Wrong but
visible and harmless — not a reason to rush an unresearched entry in.

---

## 6. Phase 4 — missing-data behaviour (D5)

The pattern already exists — `HvacServices` returns `null` when `services.items` is empty.
Generalise it:

| Absent | Behaviour |
|---|---|
| `about.stats` empty | stat band / season strip / reassurance row **not rendered** |
| `extensions.reviewBadge` null | aggregate line omitted; **quote cards still render** |
| `extensions.serviceArea` empty | area section not rendered |
| `servicePrices[x]` absent | card footer shows the tag only, no price line |
| `seasons` empty | **season rail not rendered** — we do not describe a programme the client doesn't run (D14) |
| `offerBadge` null | offer ribbon not rendered (D10) |

Plus:
- Every omission is already in `_meta.missing_fields` from §3.3 — surface it on the go-live
  checklist alongside the existing consumers (`NextSteps.tsx`, `IntakeCard.tsx`, `IntakeStep.tsx`).
- **No operator-only placeholder text in component output.** A placeholder that escapes to a
  deployed preview URL is worse than a hidden section.

---

## 7. Phase 5 — tests

Extend, don't replace:

| Test | Change |
|---|---|
| `vertical-templates.test.mjs` | drop the `car-detailing → null` assertion (it will have a template); assert all six build, validate, and name only `CATALOG` components; fix the HVAC order assertion (§2.3) |
| `vertical-language.test.mjs` | assert all six entries exist and still have **exactly four** keys |
| `catalog-invariants.test.mjs` | 60 new components registered in all required places |
| `palette-contrast.test.mjs` | **explicit exemption for car-detailing's dark ground**, documented in-file the way `hvac.ts` documents its own |
| `composition-manifest` / `multipage-pages` | four routes per vertical, stale-route pruning |
| **new** `vertical-palette.test.mjs` | the §2.4 regression: `presetFor(v)` resolves to the approved accent + pairing for all six |
| **new** `no-generated-stats.test.mjs` | the D4 guard: empty stats in → empty stats out |
| `phase-contract.test.mjs` | **no change expected** — we add no `log()` calls to onboard.js |

---

## 8. Export / deploy / re-deploy safety

The thing you asked to be sure of. Every item below is a property this plan must not break.

- **New fields must be in `SITE_TYPES_SOURCE`** (§3.4) or every client repo fails `next build`.
- **`CONSOLE_CONTENT_MARKER`** must still be written by `writeSiteContent`, or onboard.js stops
  recognising console-authored content and step 3 reverts the operator's work on every run.
- **Provisioned-field carry-forward is untouched.** The repo's `brand.phone` holds the published
  Twilio number; `readRepoSiteContent` carries it over the intake's number. Nothing here touches
  that path — but the re-export test for each vertical must confirm the Twilio number survives.
- **`ONBOARD_OWNED` routes stay preserved/restored** — `contact`, `voice`, `voice/no-answer` are
  owned by `lib/site-routes/*`, not by `template/`.
- **`copyTemplate({overwrite:true})` must keep preserving client-evolved files.** Only
  `TEMPLATE_OWNED_PREFIXES` / `_FILES` are refreshed.
- **`reconcileRoutes` prunes** routes a new composition drops — relevant when a client is
  re-exported after a template change.
- **`mergePackageJson` adds, never removes.** If a bespoke component needs a dependency, it must
  reach `template/package.json`.
- **Per-vertical acceptance, run for each of the four:**
  1. export to a scratch slug → `npm run build` in the client repo passes
  2. re-export with `overwrite: true` → client-evolved files preserved, `brand.phone` still the
     Twilio number, routes still the `lib/site-routes` versions
  3. `npm run onboard -- --dry-run` reports no new `FAIL:` (the token aborts the UI's narration)

---

## 9. Build order

Deliberately one-vertical-first. The pipeline risk is front-loaded, and finding it once beats
finding it four times.

All open questions are resolved, so this is now a straight sequence.

```
 1. BLOCKER  close the schema pin skew                        (§1)
 2. Phase 0  repair HVAC ground truth: correct
             VERTICAL_LANGUAGES.hvac palette + pairingId,
             fix the order swap, add the regression test      (§2)   ← GATE
 3. Phase 1a @jdd/ui: LeadForm.initialMessage → ship minor,
             re-pin template/ + console                       (§10.3)
 4. Phase 1b schema: templateSlots (stats, seasons, priceFrom,
             offerBadge, reviewAggregate, serviceRadius),
             submission, mapper, SITE_TYPES_SOURCE,
             D4 guard → ship v1.28.0                          (§3)
 5. Re-pin console + jdd-ops + agency site in one session     (§1)
 6. ROOFING end-to-end: 12 components, registration, builder,
             language entry, CTA routing, storm-card form,
             export, build, re-export, deploy                 (§5–8, §10) ← GATE
 7. LAWN     the other three new behaviours: picker pre-fill,
             offer ribbon, stat band + season rail            (§10.3, §10.2, §10.6) ← GATE
 8. Phase 2  agency site "Proof & details" step               (§4)
 9. PLUMBING, then CAR DETAILING
10. Phase 5  full test sweep, both suites green               (§7, §10.5)
```

**Roofing first** — it carries CTA routing and the storm-card form, so the gate at step 6 proves
the pipeline and two new behaviours at once rather than four times over.

**Lawn second** — it owns the remaining three new behaviours. After step 7 every novel mechanism
in this programme has shipped once, and plumbing and detailing are then straightforward repeats.

**Health is not in this sequence.** See `design/HANDOFF-health-vertical-research.md`; nothing
above blocks on it, and it does not block on any of this.

Roofing first because it is the most-reviewed design and now the most visually distinct, so a
pipeline problem shows up as a pipeline problem rather than a design question.

---

## 10. CTA routing and lead capture (D7–D11, D14, D16)

Added 2026-10-28 after mockup review. All four are applied to
`design/vertical-templates-v1/home-mockups.html` already.

### 10.1 One routing rule, three cases

| CTA kind | Destination | Examples |
|---|---|---|
| Phone | `tel:+1…` | nav phone, hero phone button, area phone |
| Any other conversion CTA | **`/contact`** | "Book a visit", "Free inspection", "Get a quote", "Book a detail", "Book a first visit" |
| Button inside a lead form | **submits the form** — never navigates | final-CTA submit, plumbing hero intake, roofing storm card |

Applied across all six panes: 10 anchors now point at `/contact`, 6 are `tel:` links, and every
in-form button is a submit. Audited mechanically — no `.btn` anchor is left without a
destination.

**One exception, CONFIRMED (D16).** Detailing's hero **"See packages →"** routes to `/services`,
not `/contact`, because it is a browse action rather than a conversion — a browse CTA that opens
a form is a dead end. This is the only non-phone CTA in the set that does not go to `/contact`,
so `cta-routing.test.mjs` carries a one-entry allowlist rather than an absolute rule.

**Implementation note.** `wirePages` already special-cases `HvacNav` to receive
`currentPath={navHref(page.route)}`. The per-vertical navs will need the same treatment, so the
`comp.chrome.nav.name === 'HvacNav'` check in `export.ts` must become a set membership test
covering all five navs (HVAC + four) — otherwise four of the five lose their active-link state.

### 10.2 `extensions.offerBadge` — the offer ribbon (D10)

The lawn mockup's gold "First mow free" ribbon is a **promotional promise**, so by D4's logic it
cannot be ours to write — it commits the client to something. Same category as a statistic.

- New field: `extensions.offerBadge: string | null`.
- Collected on the agency site's new "Proof & details" step (§4.2) as a short per-vertical pick
  list plus a free-text box — the same chip-plus-escape-hatch pattern `industry-menu.ts` already
  uses everywhere else. Suggested starters per vertical, e.g. lawn: *"First mow free"*,
  *"No contract"*, *"Free estimate"*; roofing: *"Free inspection"*, *"We handle your claim"*.
- `null` → **the ribbon is not rendered** (D5). No placeholder, no default offer.
- Add to `templateSlots` as `offerBadge: boolean` so only templates with a ribbon slot ask.

### 10.3 `LeadForm.initialMessage` — the lawn pre-fill (D8)

`LeadForm` already renders the optional field we want to pre-fill: `withMessage` produces a
*"What do you need? (optional)"* textarea. What it lacks is any way to seed it —
`const [message, setMessage] = useState('')` is hardcoded.

**This is a `@jdd/ui` change, and that package is shared by the console, `template/`, and every
exported client repo.** Per §5.2 rule 3, that means:

1. Add `initialMessage?: string` to `LeadForm`, defaulting to `''` so all existing call sites
   are unaffected: `useState(initialMessage ?? '')`.
2. Ship a `@jdd/ui` minor.
3. Bump the pin in **`template/package.json` and the console**, and let `mergePackageJson` carry
   it into client repos. `verifyUiPins` fails the export if the repo's pin is behind the
   template's — which is the guard that makes this safe, and the one that caught
   `responsivePicture` sitting on v1.0.1 against v1.0.7.

**The flow, end to end:**

```
lawn hero picker (Weekly | Bi-weekly | One-time)
  └─ "See my price →"  →  /contact?frequency=weekly
       └─ contact page reads the param
            └─ <LeadForm withMessage initialMessage="Weekly mowing — quarter-acre" />
                 └─ user adds name + email, submits → /api/contact
```

Two things to get right:
- **The param must be whitelisted, not echoed.** Map `?frequency=weekly` through a fixed lookup
  to a fixed string. Interpolating a query param straight into a form field is a reflected-input
  bug waiting to happen, and this content ends up in an email we send the owner.
- **The field stays editable.** Pre-filled, not locked — the client said "pre-fill the optional
  part where the user can put their input", so the user must be able to overwrite it.

### 10.4 Lead mode vs "email form" — RESOLVED (D11)

This is the one place D7/D9 collide with how provisioning works, so it needs resolving before
Phase 3 rather than during it.

`LeadForm`'s `mode` is **not cosmetic**. It decides which field is posted to `/api/contact`, and
the provisioned route branches on `LEAD_DELIVERY_MODE` to match:

| Plan | `mode` | What `/api/contact` does |
|---|---|---|
| starter | `email` | Resend emails the owner the lead |
| growth / enterprise | `phone` | Retell `create-phone-call` **dials the lead back** |

So forcing an email field on a growth client would collect an address and hand it to a route
that wants a number to dial — the callback never happens, and nothing errors. That is precisely
the silent-lead-loss failure `CLAUDE.md` catalogues (`LeadForm`'s own header comment exists
because thirteen components used to swallow a failed POST).

**RESOLVED (D11): `mode` stays strictly plan-derived.** `LeadForm` is not modified. Starter
clients see an email field; growth and enterprise see a phone field, because that is what
`create-phone-call` needs to dial the lead back.

What this means in practice, and it is worth being explicit because it differs from the mockup:

- The roofing storm card **is a form, not a `tel:` link** — that was the substance of D9 and it
  holds. What is plan-dependent is only the *field*: "Email address" on starter, "Phone number"
  on growth/enterprise.
- **The mockups show the starter variant.** Most clients are growth, so most deployed sites will
  show a phone field where the approved mockup shows an email one. Accepted knowingly.
- Nothing is built, nothing is bumped, and the lead path is untouched. This removes option (b)'s
  extra field from every form and removes the `/api/contact` question entirely.

Each per-vertical component therefore does exactly what `HvacFinalCta` already does:

```ts
const mode = _meta?.selectedPlan === 'starter' ? 'email' : 'phone';
```

Better still, use `leadModeFor` from `@jdd/schema` (added in v1.25.0 as "the single
starter/email vs growth-enterprise/phone mapping") rather than re-deriving the ternary in 48
files. **Verified reachable from the barrel** on the console's pinned v1.27.0:
`leadModeFor('growth') === 'phone'`.

### 10.5 Test additions for this section

| Test | Asserts |
|---|---|
| **new** `cta-routing.test.mjs` | in all 5 templates, every non-phone CTA href is `/contact` (or the whitelisted `/services`), and no CTA anchor is href-less |
| **new** `lead-form-prefill.test.mjs` | `initialMessage` seeds the textarea, the field remains editable, and an unmapped `?frequency=` value yields an empty message rather than echoing the param |
| `catalog-invariants.test.mjs` | `offerBadge` absent → ribbon not in output; `seasons` absent → no rail; `stats` absent → no band (D14) |
| `export-guard.test.mjs` | the nav `currentPath` special-case covers all six navs, not just `HvacNav` (§10.1) |

### 10.6 Lawn: stat band restored, season strip demoted (D14)

The four big season cards used to own the under-hero slot. That slot is the page's best proof
real estate, and a lawn buyer needs to see the business is established before they care what
happens in October — so the conventional stat band takes it back, and seasons drop to a slim rail.

```
HERO (plan picker + price anchor)

stat band        4 warm tiles, icon ABOVE the numeral      ~150px
                 (HVAC: steel top-notch · roofing: dark
                  ledger bar · detailing: hairline strip)

season rail      4 nodes on a hairline timeline,           ~110px
                 label + one line each, no cards,          (was ~240px)
                 no icon tiles

SERVICES ...
```

The rail stays directly beneath the stat band rather than moving down the page, because it is the
same subject as the hero's frequency picker — it just reads as supporting detail now instead of a
headline.

**Both halves are client-supplied, for different reasons:**

| | Why client-supplied | Absent → |
|---|---|---|
| the four stats | D4 — a statistic is never generated | that tile is not rendered; all four absent → no band |
| the four seasons | we will not describe a seasonal programme the client does not actually run | **the whole rail is not rendered** |

That second one is a genuine extension of D4's logic rather than a restatement of it: inventing
"Fall: core aeration and overseeding" for a client who only mows is not a fabricated *number*,
but it is still a fabricated *claim about their service* — and it is the kind a customer can turn
up and ask for.

So `templateSlots['lawn-care']` carries **both** `stats` (4 prompts) and `seasons` (4 prompts),
and the onboarding step asks for both, neither blocking.

---

## 11. Resolution log

Every item that was open on 2026-10-28 is now closed. Kept as a record of what was decided and
why, because four of these reverse or constrain something the code currently does.

| Was open | Resolved as | Recorded |
|---|---|---|
| §2.1 palette conflict | `VerticalLanguage` is the single palette + typography source; its HVAC entry is corrected to the approved orange/navy/Oswald | D12, §2.1 |
| §10.4 lead mode vs "email form" | `LeadForm.mode` stays **strictly plan-derived**. The storm card becomes a form, but its field is email on starter and phone on growth/enterprise | D11, §10.4 |
| §10.1 detailing "See packages →" | Stays `/services` — a browse CTA that opens a form is a dead end. The one documented exception to D7 | D16, §10.1 |
| Lawn has no stat band | **Reversed.** Lawn gets a conventional stat band for trust; the season strip is demoted to a slim rail, and its content is client-supplied too | D14, §10.6 |
| Detailing prices on the home page | Kept, degrading to tag-only per card. Price is a fact about the business, so D4 applies | D15, §6 |
| Health vs decision 46 | **Decision 46 NOT taken.** Health gets its own research cycle and is removed from this programme; mockup parked, handoff written | D13, §0 |
| Northstar mockup untracked | Commit the HVAC reference, the mockups, the parked health page, the handoff and this plan together | §11.1 |

### 11.1 Note on the "ground truth" file

Two files have been offered as the HVAC ground truth, and a third turned out to be a red herring:

| File | What it actually is |
|---|---|
| `design/northstar-standard/mockups.html` | **The ground truth.** The `cta-form` revision — a white `<LeadForm>` capture card in the final CTA |
| an uploaded `mockups.html` | A superseded revision of the same page, differing only in the final CTA (`cta-box`: a gold phone number and "— or —") |
| `C:\Users\Xander\Desktop\home-mockups.html` | **Not a ground truth at all.** A copy of this programme's own multi-vertical mockup file, three `PLAN §` reference edits stale |

The `cta-form` revision wins on evidence, not recency: `HvacFinalCta.tsx` implements exactly it,
down to the "Tell us what's going on — we'll call you right back" subcopy, and its header comment
explains the form exists so `<LeadForm>` can POST to the provisioned `/api/contact` route. A
phone-number-only final CTA has no lead path at all.

**Committing these artefacts is what stops this recurring.** The ambiguity existed only because
the reference was untracked, leaving file mtimes as the only arbiter.
