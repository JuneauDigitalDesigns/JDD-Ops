# HVAC vertical language

Phase 5, Deliverable 4. The HVAC vertical's design language on exactly the four axes Phase 12
types into `VERTICAL_LANGUAGES.hvac`. Written here in prose, before it is typed, so it stays thin:
a fifth axis would be obvious as prose and invisible as a type field. Phase 12's
`vertical-language.test.mjs` asserts
`Object.keys(VERTICAL_LANGUAGES.hvac) === ['pairingId','palette','photography','rhythm']`.

All contrast numbers below were produced by `console/test/helpers/contrast.mjs`'s real derivation
(`paletteVars` + `contrast` from `@jdd/ui/palette`), not estimated. The bar is WCAG AA, 4.5:1.

---

## 1. `pairingId`: `'instrument'`

Instrument Sans, carrying the whole site as a single grotesque (decision 7): display and body are
the same family, separated by weight, size and tracking. Against the other four pairings in Phase
3's `FONT_PAIRINGS`:

- **`instrument` (chosen).** The quietest of the five. Its own `note` is the reason: "the one that
  gets out of the way of photography." HVAC's premium read (research §5) comes from restraint and
  from the imagery, not from the letterforms announcing themselves, so the face that recedes is the
  correct one. It ships 400/500/600/700; 700 at `--display-1` with `-0.022em` tracking reads as
  heavy as an 800 at a looser track, so the lack of an 800 costs nothing here.
- **`schibsted` (rejected).** Editorial and newspaper-built. A good face, but its voice competes
  with the photography rather than framing it. Hold it for a vertical whose story is the headline.
- **`bricolage` (rejected).** "Has a voice. Pick it when the business has one too." A generic HVAC
  contractor does not, and the template must read well before any brand personality is supplied.
- **`figtree` (rejected).** Warm and humanist. Pleasant, but softness is not the HVAC signal; the
  signal is competence and cool precision, which `instrument` carries more neutrally.
- **`archivo` (rejected).** Tight and industrial, the closest to a trade condensed face. Tempting
  for a trade, but "industrial" tips toward the Tier A register (Teko, Oswald) that this whole
  upgrade is moving away from. Reserve it for a vertical where the industrial note is the point.

---

## 2. `palette`: seven slots

```
bg       #FAF7F2    bgSoft   #F1EBE2    ink      #1A1512
inkSoft  #584E45    rule     #DFD6C9
accent   #16556A    accentFg #FFFFFF
```

`bg`, `bgSoft`, `ink`, `inkSoft`, `rule` are the Phase 2 shared warm set, unchanged. Only `accent`
and `accentFg` are the HVAC decision.

**The accent, governed by decision 11.** The HVAC colour convention is blue plus red or orange,
encoding cool and warm literally, and the research notes the industry treats breaking it as
noteworthy. Decision 11 says honour that convention and execute it at a higher level: a
sophisticated, desaturated tone of the coding, not a saturated primary.

The current preset accent `#E05C2A` is a saturated orange, which is exactly the Tier A register
this upgrade leaves behind, and it sits on the warm side of the coding, which is the side that
collides with `--urgent` (a fixed alert red). Proposed replacement: **`#16556A`, a deep petrol
teal-blue** on the cool side of the HVAC coding. Cool is HVAC's dominant and most legible signal
(the research: an orange-and-blue scheme "instantly communicates heating and cooling"), the petrol
depth reads premium rather than corporate-generic, and a blue is unmistakably a different hue from
the urgency red, so urgency still reads as a separate thing from the brand.

Measured, as the derivation produces them on the warm set:

| Derived token | Value | on `bg` #FAF7F2 | on `bgSoft` #F1EBE2 |
|---|---|---|---|
| `--accent-text` | `#16556A` | **7.73** | **6.97** |
| `--accent-fg` (on the accent fill) | `#FFFFFF` | 8.26 (on `#16556A`) | n/a |
| `--urgent` | `#B3251A` | 6.15 | 5.54 |

`--accent-text` is the accent itself: it is already dark enough to clear AA on both grounds without
the derivation having to darken it, with comfortable margins (7.73 and 6.97, well over 4.5). The
button label is pure white at 8.26:1 on the fill. `--urgent` is unaffected by the accent (it is a
fixed red pulled only as far as legibility needs) and is a clearly different hue, so the
red-collision the plan warns about does not arise: a petrol blue is not "within sight of" `#B3251A`.

`accentFg` stays `#FFFFFF`, matching every other vertical preset; the derivation honours it because
white clears AA on this fill by a wide margin. (Note: Deliverable 1's token header writes
`--accent-fg` as the same value used here.)

The warm side of the coding (a refined clay or terracotta) was considered and rejected: it is the
Tier A register we are leaving, and any sufficiently saturated warm tone drifts toward the urgency
red and muddies the one signal that must stay distinct.

---

## 3. `photography`

- **`subjects`** (copied into `VERTICAL_LANGUAGES.hvac.photography.subjects`, and the source for
  Deliverable 3 item 6): a technician servicing an outdoor condenser unit; a branded service van in
  a residential driveway; a hand adjusting a wall thermostat; clean ductwork in a finished
  mechanical room; a technician inspecting a rooftop AC unit; a furnace checked under a work light.
- **`grade`**: `'house'`. This is the only legal value. One fixed recipe is what makes mixed-quality
  sources read as a single professional set; a per-vertical grade would defeat that. See
  Deliverable 3 for the two-pass recipe and the dropped tint (decision 55).
- **`ratioBias`**: `'wide'`. HVAC's real scenes are environmental, equipment in a driveway, on a
  roof, in a mechanical room, which sit in a landscape frame; a wide bias crops them with the
  context that makes them read as real work rather than studio product shots.

---

## 4. `rhythm`

- **`homeTemplateId`**: `'home-standard'`. HVAC defaults to the standard home template of Phase 9's
  three. (Forward reference: `'home-standard'` is created in Phase 9 as a `PAGE_TEMPLATES` entry
  with `pageType === 'home'`; it does not exist yet at Phase 5. Phase 12's
  `vertical-language.test.mjs` will enforce that this id is real, so Phase 9 must land first. Recorded
  here as the intended default, not as an existing id.)
- **`proofSkin`**: `'soft'`. The proof section (reviews, badges, service area) takes the `soft`
  skin, a real `SkinId` (`'default' | 'soft' | 'inverted'`), so the trust layer sits on the warmer
  `bgSoft` ground and reads as a distinct band without needing the inverted dark anchor, which
  decision 12 budgets to one per page and the home template spends elsewhere.

---

## What HVAC does NOT get

- **No HVAC-only component.** If a section looks like it needs one, the foundation is too thin, not
  the vertical. Re-skin an existing archetype with HVAC content first.
- **No HVAC-only page template.** HVAC uses the shared `PAGE_TEMPLATES`.
- **No second grade.** `grade: 'house'` is the only value, for every vertical.
- **No extra axis.** The four above are the whole language. A fifth field is forbidden by §0.6 and
  by the Phase 12 test.

Quoting §0.6's escalation rule, which a future vertical cycle will read when it is tempted:

> **The rule, in priority order:**
> 1. **Stop.** Do not add a field to `VerticalLanguage`. Do not add a vertical-private page
>    template. Do not create `components/catalog/<category>/<Vertical><Name>.tsx`.
> 2. Ask whether an existing archetype, re-skinned and fed this vertical's own content, does the
>    job. In almost every case it does, because the content differs and the structure does not.
> 3. If it genuinely does not, the fix is to **generalise the needed thing into the shared catalog**
>    as a new archetype available to every vertical, which means it belongs in a catalog wave
>    (Phase 7 or 8), not in the vertical's phase.
> 4. **Escalate to the user** before doing step 3. The user decides whether the foundation gets
>    widened. This is a planning decision, not an implementation one.
