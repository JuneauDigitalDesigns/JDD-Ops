# HANDOFF — Health &amp; Wellness vertical needs its own research pass

**Status:** open. Parked out of the vertical-templates-v1 programme on 2026-10-28.
**Owner:** unassigned. This is a fresh session's worth of work; it was deliberately not
attempted in the session that produced the other templates.

---

## Why this exists

`src/data/vertical-language.ts` carries this note, written before any health work was done:

> **VERTICAL ROTATION NOTE (decision 46):** Health and Wellness reuses this system as-is, with
> NO separate research pass. `RESEARCH-local-service-visual-design.md` is trades-only evidence,
> so this is an **UNTESTED BET**. If the health vertical's first build looks wrong, the cause is
> decision 46, not the shared foundation: do NOT widen `VerticalLanguage`, add a health-only
> component, or re-open the token layer. Escalate per §0.6 and let the user decide whether
> health gets its own research.

A speculative health homepage *was* produced in the vertical-templates-v1 mockup pass — that was
the first build the note anticipates. The note was escalated as instructed, and the decision was:

**Health gets its own research pass. Decision 46 is NOT taken. Health is removed from the
vertical-templates-v1 build queue entirely.**

So this is not a bug report. The escalation mechanism worked exactly as designed, on the first
occasion it was needed.

---

## What already exists

| Artefact | What it is | How to treat it |
|---|---|---|
| `design/vertical-templates-v1/PARKED-health-mockup.html` | A full speculative health homepage, in the house style, built in one pass alongthe approved four | **Input to the research, not a design to implement.** Not approved. |
| `design/vertical-templates-v1/home-mockups.html` | The four approved verticals + the HVAC reference. **Health is not in it.** | The quality bar and the house conventions to match |
| `design/PLAN-vertical-templates-v1.md` | The build plan for the other verticals | The pipeline work health will eventually reuse verbatim |
| `design/RESEARCH-local-service-visual-design.md` | The existing research | **Trades-only.** This is the gap. |
| `src/data/verticals/health.ts` | A content preset with real copy | Still valid; copy is not the thing in question |
| `src/data/vertical-language.ts` | Has no `health` entry; `languageFor('health')` falls back to HVAC | Leave alone until the research lands |

### The parked mockup's central assumption

Worth stating plainly, because it is the thing the research should accept or reject:

> **Health is the trades foundation minus the urgency devices.**

The parked mockup implements exactly that, by subtraction rather than addition:

- no scrim-over-photo hero (soft tinted ground, copy left, photo in a rounded frame right)
- no emergency band, no "24/7" claim, no live-dispatch signalling
- no oversized aggregate score — stars and a count only
- hairlines instead of shadows; 112px sections instead of 84px; pill buttons
- the only template in the set with no dark band above the footer
- service tags in sentence case rather than shouted uppercase
- the service-area section replaced by an hours table + telehealth panel

Notably it needed **no new `VerticalLanguage` axis, no health-only component, and no token-layer
change** — which is a point in favour of decision 46, and is why this is a genuine judgement call
rather than an obvious failure.

---

## What the research actually has to answer

The trades research does not transfer on these points, and each one changes layout, not just colour:

1. **Is the conversion event the same?** Trades convert on *call now*. Health converts on *book an
   appointment*, and often on *verify my insurance first*. If booking is the primary action, the
   whole CTA architecture (phone-first, `tel:` hero button, `/api/voice` two-hop) may be wrong
   for this vertical — and that reaches into provisioning, not just design.
2. **What is proof, for a practice?** Trades use job counts, years, review aggregates. Health
   proof is credentials, licensure, modalities, practitioner bios, insurance networks. A
   four-stat band may be the wrong instrument entirely.
3. **Does a stat band belong at all?** See above. The parked mockup already replaced it with four
   non-numeric reassurances. Confirm or reject.
4. **Regulatory and ethical constraints.** Testimonials for healthcare services are restricted in
   some jurisdictions and for some modalities; HIPAA shapes what a contact form may collect, and
   the current `LeadForm` posts a free-text message field to an owner email. **Check this before
   any build** — it may constrain the lead path, which is the one part of the stack that touches
   provisioning.
5. **Who is "health &amp; wellness"?** The label currently spans a chiropractor, a med-spa, a
   therapist, and a yoga studio. Those do not share a visual register or a conversion path. The
   research may conclude the vertical should be **split**, or narrowed to one definition.
6. **Imagery.** `photography.subjects` for health has never been curated, and stock wellness
   photography is the single most clichéd category in the entire set. Needs its own direction.

---

## Suggested shape of the work

Mirrors the cycle the trades verticals went through, per decision 37:

1. `design/RESEARCH-health-wellness-visual-design.md` — real evidence, not inference from trades
2. Answer the six questions above explicitly, each as a recorded decision
3. A Phase-5 mockup repeat for health — compare against `PARKED-health-mockup.html` and say which
   of its assumptions survived
4. A `VERTICAL_LANGUAGES.health` entry (four axes; **if a fifth is needed, that is a finding
   about the foundation — escalate, do not widen the type**)
5. `src/data/verticals/health.ts` palette revision + an `image-placeholders.ts` curation
6. Only then: the 12 components, registration, and a `VERTICAL_TEMPLATES.health` builder,
   following `PLAN-vertical-templates-v1.md` §5 unchanged

---

## Guardrails for whoever picks this up

- **Do not register the parked components.** They do not exist as files; the parked artefact is a
  single standalone HTML page.
- **Do not add `health` to `VERTICAL_TEMPLATES`** until the research is accepted. Until then
  `applyVerticalTemplate('health')` correctly returns `null` and the Studio falls back to
  `defaultCompositionFor()` — a health client can still be built today, just not from a bespoke
  template.
- **Do not widen `VerticalLanguage`.** It is capped at exactly four axes by decision 35 and
  `vertical-language.test.mjs` enforces the key set. A health requirement that does not fit is a
  finding to escalate, not a fifth field.
- **`languageFor('health')` currently falls back to HVAC.** Once HVAC's palette is corrected per
  `PLAN-vertical-templates-v1.md` §2, a health client will render in HVAC's orange/navy. That is
  wrong but harmless and visible; it is not a reason to rush a half-researched entry in.
- The four approved verticals ship without this. **Nothing in the vertical-templates-v1 programme
  blocks on this handoff**, and nothing in this handoff blocks on that programme finishing.
