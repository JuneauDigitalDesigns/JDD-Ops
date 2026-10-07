# Research: the visual design language of local service business websites

Compiled 2026-10-05. Purpose: ground the next upgrade of the console's page templates and
catalog components in observed reality rather than in generic front-end taste.

---

## 1. Method, and what is measured vs. reported

Two kinds of evidence are in here, and they are labelled so you can weigh them differently.

**Measured (I pulled the actual HTML/CSS myself):**
- Font stacks and dominant hex tokens from 4 live "best in class" local service sites
  (impetusplumbing.com, carinihome.com, bostonstandardplumbing.com, reddihvac.com).
- Font and tech-stack fingerprints from 8 premium construction/trades sites drawn from the
  Awwwards construction pool (havenconstructions.com.au, spenceltd.co.uk, jdavisgc.com,
  thetandemco.com, metriccivil.ca, arcprojects.build, berch.ch, bwconstructioncompany.com).
- A full inventory of our own console catalog, tokens, fonts and image defaults.

**Reported (agency write-ups, roundups, industry benchmarks):**
- Design teardowns of roughly 60 named HVAC, plumbing and roofing sites.
- Conversion benchmarks and photography studies from home-service marketing agencies.

Where I quote a conversion number it comes from an agency selling that service, so treat the
magnitude as directional and the direction as reliable.

---

## 2. The central finding

**There are two separate populations of "local service website," they have almost nothing in
common visually, and the gap between them is the entire opportunity.**

Every industry roundup of "best HVAC websites" or "best plumbing websites" is ranking inside
**Tier A**. Tier A is optimised for phone calls. It is almost universally WordPress with
Elementor or Divi, and its visual language is, bluntly, 2016. When I pulled the actual CSS of
the sites these roundups crown as the best in the trade, here is what was really there:

| Site | Type stack (measured) | Dominant colors (measured) |
|---|---|---|
| impetusplumbing.com (praised as "premium black and gold") | **Roboto + Teko** | `#fb8e28` orange, `#dfaa46` gold, white |
| carinihome.com | **Montserrat + Libre Baskerville + Open Sans** | `#486f19` / `#4c721d` green, `#b87726` ochre, `#e8e5d0` cream |
| bostonstandardplumbing.com | **Montserrat + Libre Baskerville + Roboto** | `#2563eb` blue, `#252f69` navy, `#f08d3c` orange |
| reddihvac.com | **Open Sans** only | near-default WordPress block palette |

That is the ceiling of the tier we are currently being compared against. Montserrat, Open
Sans, Roboto, Teko, Libre Baskerville. Elementor global typography variables. Google Fonts.

**Tier B** is premium trades: builders, civil contractors, remodelers, specialty
construction. Same customer psychology (high-ticket, trust-gated, local), completely
different visual language. What I measured there:

| Site | Stack / type (measured) | Signal |
|---|---|---|
| havenconstructions.com.au | Next.js, **Suisse Intl** self-hosted woff2 | licensed Swiss grotesque, not a Google font |
| spenceltd.co.uk | **Halyard Display + IvyPresto Headline** via Adobe Typekit | paid display serif paired with a geometric grotesque |
| berch.ch | Adobe Typekit | paid type |
| metriccivil.ca, arcprojects.build | Webflow + **Lenis** smooth scroll | deliberate motion layer |
| jdavisgc.com | Nuxt, component-level CSS (BigTestimonial, SmoothStats, ScrollingLogos) | bespoke components, not template sections |

**The synthesis, and it is the thesis of this whole document: we should be building Tier B's
visual language on top of Tier A's conversion architecture.** Neither tier does this. Tier A
converts but looks cheap. Tier B looks expensive but buries the phone number and has no
emergency path, no service area, no reviews above the fold. Nobody is serving the overlap,
and the overlap is exactly what a $300/mo local service client wants and cannot buy.

---

## 3. Tier A: the conversion architecture that must survive

This is the part of Tier A that is genuinely right and that we must not break while making
things prettier. It is remarkably consistent across all three trades.

**Above the fold, mobile, first ~600px, the non-negotiables:**
1. Business name and what they do, in plain language, one sentence.
2. **Where they serve**, named explicitly (city, not "the greater area").
3. Phone number as a tap-to-call target, not text.
4. One trust signal adjacent to the CTA (Google rating with review count, or
   "family owned since 1998", or a license number).
5. Availability state: "24/7", "same-day", "open now".

**Observed conventions that recur in nearly every teardown:**
- Phone number large in the header, repeated after every service block.
- A sticky, always-visible call affordance on mobile. Reported lift of 30 to 50 percent over
  a form-first layout.
- License numbers displayed in the header itself (911hvac.com does this literally).
- Review aggregate as a header element, not a mid-page section (mcateellc.com puts 4.9 stars
  and the Google Guarantee badge in the header).
- Forms capped at six fields or fewer.
- A differentiator list as icons or bullets, very high on the page, before services.
- Service area communicated with a map plus named towns. The sequence is "where" then "what".
- Financing and rebate banners as a distinct persistent strip (carinihome.com runs a rebate
  and tax-credit banner; several HVAC sites do the same seasonally).

**Benchmark context:** median contractor site converts 2 to 4 percent of visitors to a
tracked call or form fill. The reported top decile hits 8 to 12 percent on identical traffic.
The delta is attributed to conversion architecture, not aesthetics. This matters for us:
**aesthetics is the axis we are improving, so the conversion architecture is the thing we
must hold constant and not regress.**

**Recommended homepage order, as it recurs across sources:**
headline and hero > differentiators > services > service areas > proof (reviews, badges,
real photos) > recent work or before/after > FAQ > contact. Our current page template order
(nav > hero > services > faq > testimonials > contact > footer) is missing
differentiators, service areas, and work, and it puts FAQ before proof, which inverts the
trust sequence.

---

## 4. Tier A's actual visual grammar, documented

Worth knowing precisely, because these are the moves that read as "local service website"
to a homeowner. Some are worth keeping as deliberate genre signals. Some are the cheap tells.

**Color, by trade.** The conventions are strong and the industry treats breaking them as
noteworthy:
- HVAC: blue plus red or orange, encoding cool and warm literally. Tundra's orange-and-blue
  is described as instantly communicating "heating and cooling." Smock's all-red was called
  out specifically as "departing from the cool-toned designs typical of the HVAC industry,"
  which tells you how rigid the default is.
- Plumbing: blue dominant, with a yellow, gold or red accent.
- Roofing: dark neutral plus intense orange, or patriotic red/white/blue. "Intense orange"
  on Clean Cut Roofing, red/white/blue on Alexander's Heating and Same Day.
- Green and earth tones are the outlier move, used to signal eco or premium (carinihome.com's
  `#486f19` plus `#b87726` plus `#e8e5d0` cream is the single most sophisticated palette I
  measured in Tier A).

**Typography.** Heavy, condensed, uppercase display for headlines (Teko, Oswald), humanist
sans for body (Open Sans, Montserrat). Serifs appear only as an accent for an "established,
trustworthy" note (Libre Baskerville on two of four measured sites).

**Imagery, and this is the single biggest lever.** The consistent finding across every
source: real photography of the actual crew, trucks and work. Reported figures: authentic
imagery increases trust roughly 2.4x over stock; 64 percent of consumers trust a business
more after seeing a real photo of the owner; a documented 45 percent conversion improvement
from replacing stock with real team photos; 35 percent lift from a real customer photo over
the best-performing stock alternative. The canonical shot list:
1. Team group photo, branded uniforms. Home and About.
2. Action shots on the job, including tight shots of hands working. Home and service pages.
3. Individual headshots, especially leadership. About.
4. Branded truck and equipment. Home.
5. Before and after pairs. Service pages.
6. Customer handshake at job completion. Testimonials.
7. Smiling family with the finished work. Case studies.
8. Seasonal work. Blog.
9. Behind the scenes office and dispatch. About.

Named sites that lead with a real hero photo of owners or crew in front of the service
vehicle (911hvac.com, coolmenow.com, samedaysd.com) are consistently praised; sites without
customer or crew faces above the fold (reddihvac.com, Standard Heating) are consistently
criticised for it even when the layout is otherwise clean.

**The decorative vocabulary of Tier A**, which is where the cheapness actually lives: soft
wave dividers, swooshes, circular image masks, rounded corners everywhere, generic line-art
service icons, mascots, drop shadows under cards, gradient overlays on hero photos, three or
four equal icon cards in a row.

---

## 5. Tier B: the visual grammar we should be importing

From direct inspection of the premium construction set.

**Type as the primary signal of money spent.** Licensed type, self-hosted or Typekit. The
recurring pairing is a **display serif for headlines against a neutral grotesque for
everything else** (Spence: IvyPresto Headline over Halyard Display), or a **single
high-quality grotesque carrying the whole site** (Haven: Suisse Intl alone). Both read
expensive. Neither uses a free font. Tight negative tracking on display sizes.

**Color: restraint, with accent coming from photography.** Haven and Spence both run
neutral-to-off-white grounds with charcoal or black type and effectively no chromatic accent.
Spence's palette notes read "accent colors via photography rather than chromatic elements."
This is the exact inverse of Tier A, where brand color is sprayed across buttons, icons,
dividers and headings.

**2026 color trend data supports moving this direction for this sector specifically.** Warm
browns, clay reds, forest greens and deep teals are called out as rising specifically in home
services as signals of stability and real-world grounding. Pure white grounds are being
replaced by "unbleached" neutrals (paper, limestone, sand, warm gray). Pure black is being
replaced by charcoal, deep navy and warm off-blacks. Pantone's 2026 color of the year is
Cloud Dancer, a warm neutral. All of this is a mandate to move our default grounds off
`#ffffff` and our default inks off `#000000`.

**Layout: asymmetry, numbered indices, and alternating rhythm.**
- Spence numbers its five services `01 - 05` with small-caps labels. This is precisely the
  "Editorial Index" archetype already in our DESIGN-LANGUAGE.md, which is reassuring: the
  console is already aiming at the right tier.
- Haven places brand descriptors ("EST. 1990 MELBOURNE", "Bespoke", "Luxury")
  **asymmetrically around** the hero statement rather than stacking them. Noted as creating
  "visual tension that signals sophistication without excess."
- Both alternate text-dominant sections against full-bleed photography breaks to create
  rhythm. Neither uses a repeated card grid as its primary structure.
- Left-aligned ragged-right text with generous margins and controlled max-widths.
- Restrained type scale. Haven is described as favoring "clarity over decorative variation,"
  with one very large statement and everything else small and refined. Tier A, by contrast,
  has four or five competing sizes all shouting.

**Motion: present, expensive, and quiet.** Lenis smooth scroll on two of the Webflow sites.
Scroll-triggered reveals. Numbered carousels ("1/5"). Haven's motion is described as
"deliberately restrained, consistent with the brand's emphasis on quiet excellence." The
premium signal is not more animation, it is fewer, better-executed moments plus a smoothed
scroll surface.

**Components are bespoke, not sectional.** jdavisgc.com ships named component CSS:
`BigTestimonial`, `SmoothStats`, `ScrollingLogos`. These are designed objects, not template
slots filled with content.

---

## 6. What specifically makes a site read as AI-made or cheap

This is well documented and it is worth being precise, because several of these are in our
catalog right now.

The failure mode is statistical averaging. A model asked for "a modern site" emits the modal
layout from its training data. The named tells:
1. **Hero with a confident headline over a soft gradient.**
2. **Three equal feature cards in a row**, fading in on scroll.
3. **Indigo or violet accent, rounded corners, soft shadows.** Named explicitly as the
   Tailwind-default aesthetic the model regresses to.
4. **Generic stock photography**, especially of people who are obviously not the business.
5. **A "trusted by" logo strip** with no real logos.
6. **Vague copy that says nothing specific about the actual business.** Inspirational quote
   blocks. No named towns, no named equipment brands, no license numbers, no owner name.
7. **Identical navigation patterns** across every section and page.
8. **Uniform section rhythm.** Every section the same height, same padding, same alignment.

The counter-move named in the sources is "intentional choices that AI typically avoids due to
its reliance on statistical averages": memorable color, custom icon styles, expressive
typography, original photography, subtle graphic detail. In other words, specificity and
asymmetry are the antidotes, and both are things a template system *can* encode if the
template's defaults are themselves specific and asymmetric.

---

## 7. Gap analysis against what we have today

Measured from the console source, 2026-10-05.

**What we have:** 30 catalog components across 15 categories, a surface-role skin system
(`default` / `soft` / `inverted`), a derived palette with real accessibility work
(`--accent-text` AA loop, `urgentTone`, `readableOn`), a two-tier motion system with
`stillFor` reduced-motion gating, and a `DESIGN-LANGUAGE.md` whose stated principle
("recompose the layout, don't decorate the grid") is correct and matches Tier B.

The architecture is good. The problem is the defaults and the coverage. Specific gaps:

**G1. The font registry is the AI-tell font list, verbatim.**
`console/src/lib/fonts.ts` offers exactly: Inter, Manrope, Poppins, Sora, Work Sans, Plus
Jakarta Sans, Roboto Slab, Playfair Display. Six of eight are the canonical
"statistically-average" web fonts. There is no editorial grotesque, no display serif of the
IvyPresto class, no condensed trade face, and no licensed or self-hosted option. A client
cannot pick a combination out of this list that reads Tier B.

**G2. The exported template has no type scale, no spacing scale, no radius or shadow tokens.**
`template/tailwind.config.ts` extends only `fontFamily` (sans, heading) and one
`backgroundImage`. The console's own chrome has a carefully reasoned scale; the thing we ship
to clients has none. Every size, every gutter and every radius is an inline arbitrary value
decided per component. This is the mechanical root cause of inconsistent fidelity, and it is
why components drift as they are edited.

**G3. The default imagery is Unsplash stock, and it ships.**
`console/src/data/image-placeholders.ts` fills empty image slots with curated
`images.unsplash.com` URLs, and the file's own header says "THESE URLS SHIP." The reasoning
is sound (a placeholder beats a gray tile, and preview must match production), and the
provenance tracking at `_meta.placeholder_images` is genuinely well designed. But the
research is unambiguous that stock photography is the single largest cheapness and distrust
signal in this exact sector. Our default state is the worst-performing option, and there is
no pressure anywhere in the flow that converts it to real photography.

**G4. Our page order does not match the researched trust sequence.**
Current: nav > hero > services > faq > testimonials > contact > footer.
Researched: hero > differentiators > services > service areas > proof > work > faq > contact.
We have `trust/TrustBadges`, `trust/ServiceArea`, `trust/TrustReviewsAggregate`,
`work/BeforeAfter` and `work/RecentJobsGrid` built, but the default home template does not
place them, so the default build omits the entire trust layer.

**G5. DESIGN-LANGUAGE.md cites seven reference implementations that do not exist.**
The doc points to `services/ServicesShowcase.tsx`, `services/ServicesSpotlight.tsx`,
`work/WorkSpotlight.tsx`, `work/WorkGrid.tsx`, `work/WorkMasonry.tsx`,
`testimonials/TestimonialsRotator.tsx` and a testimonials marquee as the canonical examples
of five of its eleven archetypes. **None of these files are in the repo.** It also claims
"five services variants" where three exist. This is the single highest drift risk in the
codebase: any executor told to "match ServicesShowcase.tsx" will invent it. This must be
fixed before any implementation plan is handed to an executor.

**G6. Coverage is too thin for the archetype-variety rule to hold.**
The rule is that every variant in a category must be a different structural archetype. With
two variants in nav, about, work, testimonials, faq and footer, and one in pageHeader, there
is not enough catalog for two sites built from it to look like different sites. Two clients
in the same vertical will land on the same composition.

**G7. No smoothed scroll surface and no page-level motion layer.**
Motion exists per component. Both premium Webflow references run Lenis. There is no
equivalent global layer, which is a cheap, high-yield fidelity win.

**G8. The accent token is applied Tier-A style.**
The palette system derives a rich accent ramp and the skins put `text-accent` on every
eyebrow. Tier B's move is the opposite: neutral ground, near-monochrome type, accent reserved
for the single primary CTA and for genuine urgency. We already have `--urgent` separated
correctly, which is the right instinct; the accent itself needs the same discipline.

---

## 8. What this implies, stated as design direction

Not decisions, just what the evidence points at. These are the things worth arguing about
next.

1. **Default grounds move off pure white to warm unbleached neutrals; inks move off pure
   black to warm charcoal.** Supported by both the 2026 trend data and every Tier B
   measurement.
2. **Accent gets demoted.** Reserved for the primary CTA and urgency. Eyebrows, rules and
   icons go neutral. Color interest comes from photography.
3. **The font registry gets replaced, not extended.** Target the editorial grotesque plus
   display serif pairing. Needs a licensing decision, since the premium references all use
   paid type.
4. **The exported template gets a real token layer**: type scale with tight display
   tracking, spacing scale, radius scale, shadow scale. This is the prerequisite for
   consistency and probably the highest-leverage single change.
5. **Photography becomes a gated, first-class part of the build**, not a placeholder
   backfill. The shot list in section 4 is a client deliverable checklist.
6. **The default home template is re-ordered to the researched trust sequence** and places
   the trust and work sections that already exist.
7. **Section rhythm becomes deliberately uneven**: alternating text-dominant sections against
   full-bleed photography, varied heights, asymmetric hero composition.
8. **Conversion architecture is held constant and treated as a regression suite**:
   tap-to-call, sticky mobile call, named service area, review aggregate above the fold,
   license display, six-field form cap.
9. **DESIGN-LANGUAGE.md is reconciled with reality** before anything is built from it.

---

## Sources

Agency teardowns and example galleries:
[Hook Agency HVAC](https://hookagency.com/blog/hvac-websites/) ·
[Hook Agency roofing](https://hookagency.com/blog/best-roofing-websites/) ·
[SiteBuilderReport HVAC (25+ examples)](https://www.sitebuilderreport.com/inspiration/hvac-websites) ·
[CI Web Group best HVAC design](https://ciwebgroup.com/guides/best-hvac-website-design) ·
[HubSpot plumbing websites](https://blog.hubspot.com/website/plumbing-websites) ·
[WebFX plumber examples](https://www.webfx.com/industries/home-repair/plumbers/website-examples/) ·
[Colorlib plumbing](https://colorlib.com/wp/plumbing-websites-design/) ·
[ServiceTitan roofing](https://www.servicetitan.com/blog/roofing-websites) ·
[Cinch Local award-winning roofing](https://www.cinchlocal.com/top-roofing-company-websites-best-designs-for-2026)

Premium tier:
[Awwwards construction pool](https://www.awwwards.com/inspiration_search/construction/) ·
[Spence](https://spenceltd.co.uk) ·
[Haven Constructions](https://havenconstructions.com.au)

Photography:
[Hook Agency on stock photos](https://hookagency.com/blog/why-stock-photos-are-costing-contractors-jobs-and-what-to-use-instead/) ·
[Hook Agency contractor shot list](https://hookagency.com/blog/contractor-photo-shoot-ideas/) ·
[CXL stock vs real photography](https://cxl.com/blog/stock-photography-vs-real-photos-cant-use/) ·
[Estland professional photography lead impact](https://estland.us/professional-photography-over-stock-photography-increases-leads/)

Conversion architecture:
[Contractor conversion rate benchmarks](https://www.garrethandley.com/contractor-website-conversion-rate-in-2026-why-most-sites-convert-under-3-and-what-to-fix) ·
[High Point Digital contractor essentials](https://gohighpointdigital.com/guide/what-every-contractor-website-needs-to-convert-visitors-into-calls/) ·
[Grow With BA local design](https://growwithba.com/blog/local-business-website-design) ·
[Best HVAC homepage sections](https://instantsite.app/blogs/best-website-sections-for-hvac) ·
[BizIQ dual plumbing/HVAC structure](https://biziq.com/blog/how-your-pages-fit-together-the-web-structure-guide-for-dual-plumbing-and-hvac-contractors/)

Trends and the AI-sameness problem:
[Hook Agency color schemes 2026](https://hookagency.com/blog/website-color-schemes-2026/) ·
[Logoworks 2026 trust trends](https://logoworks.com/website-design-trends-2026/) ·
[Shuffle.dev on AI website sameness](https://shuffle.dev/blog/2026/01/why-do-most-ai-generated-websites-look-the-same/) ·
[AXE-WEB on AI design sameness](https://axe-web.com/insights/ai-website-design-sameness/) ·
[DEV: why AI sites feel generic](https://dev.to/samareshdas/why-most-ai-generated-websites-still-feel-generic-and-what-actually-makes-a-product-feel-premium-33p2)
