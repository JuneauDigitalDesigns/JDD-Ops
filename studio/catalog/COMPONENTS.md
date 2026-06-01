# Component backlog

The master list of catalog components to build (in later sessions). Read
`AUTHORING_CONTRACT.md` in this folder **before** building any of them — it defines
the rules every component must follow to drop in cleanly and survive `onboard.js`.

Each component is one self-contained `.tsx` under `studio/catalog/<category>/`,
named `{Category}{Variant}.tsx`, with a default export named identically and a
`meta` named export. Target: **2 variants per category** for v1.

| Category | Schema consumed | Variants to build | Status |
|---|---|---|---|
| Nav | `brand.name`, `brand.short`, `brand.phone`, `brand.phoneHref` | `NavMinimal`, `NavCentered` | ☐ ☐ |
| Hero | `brand.name`, `brand.long`, `brand.tagline`, `brand.phone`, `seo.description` | `HeroSplit`, `HeroCentered` | ☐ ☐ |
| Services | `services.items[] {n,t,d,tag}` | `ServicesGrid`, `ServicesAccordion` | ☐ ☐ |
| FAQ | `faq.items[] {q,a}` | `FaqAccordion`, `FaqTwoColumn` | ☐ ☐ |
| Testimonials | `testimonials?.items[] {q,a,r,company,stars}` (optional) | `TestimonialsCarousel`, `TestimonialsGrid` | ☐ ☐ |
| Contact / CTA | `brand.phone`, `brand.phoneHref`, `brand.email`, `brand.address` → POSTs `/api/contact` | `ContactSplit`, `CtaBanner` | ☐ ☐ |
| Footer | `brand.name`, `brand.long`, `brand.license`, `brand.established`, `brand.address`, `brand.phone`, `brand.email` | `FooterColumns`, `FooterMinimal` | ☐ ☐ |
| SEO head | `seo {title,description,canonical}` + `brand` (JSON-LD) | `SeoDefault`, `SeoLocalBusiness` | ☐ ☐ |

## Notes per category

- **Testimonials** is optional in the schema. Both variants MUST return `null` when
  `CONTENT.testimonials` is absent or `items` is empty.
- **Footer** `license` and `established` are nullable — render conditionally.
- **SEO** variants feed Next `metadata` (export `generateMetadata`) rather than
  rendering visible markup; `SeoLocalBusiness` adds JSON-LD from `brand` + `seo`.
- **Contact** variants POST form data to `/api/contact`; do not add new env vars.

## Maps to page slots

`template/src/app/page.tsx` has SLOTs in this order: nav → hero → services → faq →
testimonials → contact → footer. SEO is wired through `layout.tsx` /
`generateMetadata`, not a visible slot.
