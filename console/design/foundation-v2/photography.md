# HVAC photography direction

Phase 5, Deliverable 3. The photography direction and the curated image set Phase 11 transcribes
into `console/src/data/image-placeholders.ts`'s `hvac` entry. Every URL below was verified to
return HTTP 200 on 2026-10-07 (see Verification at the bottom for the exact check).

## The tension, stated plainly so nobody later mistakes it for an endorsement

Decision 13 keeps shipping stock placeholders, with no go-live gate, while the research is
unambiguous that stock photography is the single largest cheapness and distrust signal in this
exact sector (authentic imagery lifts trust roughly 2.4x; a documented 45 percent conversion
improvement from replacing stock with real team photos). We ship stock anyway, as a considered
acceptance of that cost, because a curated placeholder beats a gray tile and because the preview
must match production.

Decision 15 is the only thing that makes that survivable: **enforced aspect ratios, focal crops,
and one subtle unified grade.** That is what makes mixed-quality source material read as a single
professional set, and it is also what stops curated stock from reading as stock. The grade and the
ratios below are therefore not polish, they are the mechanism. None of this is an endorsement of
stock over real photography; it is the floor, and the shot list exists so a client can rise off it.

## 1. The shot list (research section 4), as a client deliverable checklist

What the client should actually photograph, in priority order, to replace the stock below:

1. Team group photo in branded uniforms. (home, about)
2. Action shots on the job, including tight shots of hands working. (home, service pages)
3. Individual headshots, especially leadership. (about)
4. Branded truck and equipment. (home)
5. Before and after pairs. (service pages)
6. Customer handshake at job completion. (testimonials)
7. Smiling family with the finished work. (case studies)
8. Seasonal work. (blog)
9. Behind the scenes office and dispatch. (about)

## 2. The slots that exist in the schema, mapped to the shot list

Read from `@jdd/schema` `SiteImages` (dist/site.d.ts) and `console/src/data/image-placeholders.ts`:

| Slot | Shot-list item it should carry | Ratio key |
|---|---|---|
| `images.hero.portrait` | 4 branded truck/equipment, or 2 action shot | `hero` |
| `images.hero.slides[].url` | 2 action shots on the job | `hero` |
| `images.about.feature` | 1 team group photo in branded uniforms | `aboutFeature` |
| `services.items[].image.url` | 2 action shots, tight shots of hands working | `service` |
| `work.projects[].image.url` | 5 before/after and completed work (PREVIEW ONLY, never shipped to a client repo) | `work` |
| `images.testimonials.avatars[]` | 3 individual headshots, 6 customer handshake | `avatar` |
| `images.footer.logoImage` | the client's own logo (not a photograph) | n/a, skips crop and grade |

**Shots with no slot, a note for a future schema change and not a thing to add now:** item 7
(smiling family with finished work, the case-studies shot), item 8 (seasonal work, a blog shot),
and item 9 (behind the scenes office and dispatch). None has a dedicated image slot today. If a
later cycle wants them, that is a schema addition, not a curation task.

## 3. The curated HVAC set

Written as `slot | photo id | ratio key | alt`. Every id is a free `images.unsplash.com` photo
(no Unsplash+), verified 200 today. These are the four topical content photos the current `hvac`
entry already ships, re-confirmed and mapped to slots and ratios here, plus the three shared,
vertical-agnostic headshots used for avatars.

```
images.hero.portrait        | 1615309662243-70f6df917b59 | hero        | HVAC technician servicing an outdoor system (topical stock, not the client's own crew)
images.hero.slides[0]       | 1615309662243-70f6df917b59 | hero        | HVAC technician servicing an outdoor system (topical stock, not the client's own crew)
images.hero.slides[1]       | 1718203862467-c33159fdc504 | hero        | Air conditioning unit being installed (topical stock, not the client's own crew)
images.about.feature        | 1698479603408-1a66a6d9e80f | aboutFeature| An HVAC team on the job (topical stock, not the client's own team)
services.items[0].image     | 1615309662243-70f6df917b59 | service     | Heating and cooling service call (topical stock)
services.items[1].image     | 1718203862467-c33159fdc504 | service     | Air conditioning installation (topical stock)
services.items[2].image     | 1698479603408-1a66a6d9e80f | service     | System maintenance visit (topical stock)
services.items[3].image     | 1614447413576-b346c641c128 | service     | Ductwork and indoor air quality (topical stock)
work.projects[].image       | the four service ids above, cycled (PREVIEW ONLY)        | work | completed-work captions, never serialized to a client repo
images.testimonials.avatars | 1580489944761-15a19d654956, 1506863530036-1efeddceb993, 1438761681033-6461ffad8d80 | avatar | customer headshots (shared across verticals)
images.footer.logoImage     | none                        | n/a         | the client's own logo, no stock placeholder, skips crop and grade
```

Notes, each traceable to a decision:

- **The set reuses four content photos across the hero, about, service and work slots.** That is
  the current working design: `fillImagePlaceholders` cycles a small verified set so each section
  still shows distinct images. The plan's ideal is one distinct photo per slot; moving to that
  would mean adding more Unsplash ids, and I will not write down an id I cannot see well enough to
  confirm its subject matter, because a 200 only proves the URL resolves, not that the photo is an
  HVAC scene. Expanding to distinct-per-slot photography is a safe optional refinement for Phase
  11, flagged here rather than faked now.
- **Lead with real working scenes, not posed studio people** (research section 4: sites without
  crew or customer faces above the fold are consistently criticised; sites leading with a real
  photo of crew in front of the service vehicle are consistently praised). The hero here is a
  technician at an outdoor unit, which is a working scene; the honest `alt` says it is not yet the
  client's own crew. The highest-value single upgrade a client can make is replacing the hero with
  their own branded-van-and-crew photo, which is why item 4 is in the shot list.
- **No AI-generated imagery** (decision 14). Every id above is a real photograph. No abstract AI
  texture or background plate is used in this set, so there is nothing in the AI-allowed category to
  note.
- **No em-dashes in any `alt` string.**

## 4. The ratios (Phase 11's `RATIOS` constant)

```
hero         16/10
aboutFeature  4/5
service       3/2
work          3/2
avatar        1/1
```

If a chosen photo cannot survive its ratio with a saliency crop, choose a different photo rather
than changing the ratio. Decision 15 says the ratios are enforced; they are half of what makes a
mixed set cohere.

## 5. The grade, one fixed recipe, two passes

Phase 11 applies this in order to every image except logos:

```
modulate({ saturation: 0.88, brightness: 1.02 })
linear(1.04, -6)
```

**There is no `tint()` pass. Decision 55 drops it.** An earlier draft of the plan ended the recipe
with `.tint('#FFF8F0')`; do not reinstate it. Decision 9 has already moved every page ground to a
warm unbleached neutral (`bg #FAF7F2`, `bgSoft #F1EBE2`) and the ink to warm charcoal, so a warm
tint laid over the photography on top of that pushes the whole page toward sepia. The saturation
pull and the contrast lift are what actually make mixed-quality photos cohere; the tint was only
ever adding warmth the palette now supplies.

There is exactly **one** grade. `grade: 'house'` is the only legal value in Phase 12's
`VerticalLanguage`, and the reason is the whole point of this file: one recipe is what makes mixed
sources read as one set. A per-vertical grade would defeat it.

**Logos skip the crop and the grade.** A logo must not be recoloured, so `images.footer.logoImage`
bypasses both passes.

A before-and-after of one image is rendered in `mockups-sections.html` (the grade cannot be settled
in prose, only seen), so the user can judge what the two passes actually do.

## 6. The `subjects` list (copied into `VERTICAL_LANGUAGES.hvac.photography.subjects`)

Four to six short noun phrases naming what an HVAC photograph should be of:

- a technician servicing an outdoor condenser unit
- a branded service van in a residential driveway
- a hand adjusting a wall thermostat
- clean ductwork in a finished mechanical room
- a technician inspecting a rooftop AC unit
- a furnace checked under a work light

## Verification

Every URL was checked with:

```
curl -s -o /dev/null -w '%{http_code}' "https://images.unsplash.com/photo-<id>?auto=format&fit=crop&w=800&q=80"
```

and returned `200` for all seven ids (the four HVAC content photos and the three shared avatars) on
2026-10-07.
