# Component Authoring Contract

**Read this in full before building any catalog component.** It is self-contained:
you do not need any prior conversation. Following it guarantees a component drops
into the template glue-free and survives `onboard.js` provisioning.

## 0. The system in one paragraph

JDD builds each client site from a fixed Next.js template (`template/`). Components
are visual **variants** that render slices of a **fixed schema** — variety comes
from design, never from new data fields. You author components here in
`studio/catalog/<category>/`. They are previewed/selected in `studio/preview`,
exported to a folder, and pasted into a client's `template/src/components/catalog/`.
At export time `copySiteData` copies the preview's `site.ts` (v2.1) into the new
client repo. At provision time `onboard.js` splices the client's real content into
`src/data/site.ts` and runs `npm run build` — which must pass for **any** client.

## 1. The fixed schema (`SiteContent`) — v2.1

Source of truth: `studio/preview/src/data/site.ts` (the preview carries the canonical
v2.1 schema; the template's `src/data/site.ts` is a minimal placeholder for standalone
builds and gets overwritten at export time). Do **not** add fields. Shape:

- `brand`: `name`, `short`, `long`, `established: string | null`, `tagline`,
  `phone`, `phoneHref`, `email`, `address`, `license: string | null`,
  `palette { accent, accentFg?, bg, bgSoft, ink, inkSoft, rule }`,
  `typography { fontSans, fontHeading, headingWeight, bodyWeight, headingTracking?, headingLineHeight? }`
- `nav[]`: `{ label, href }` — primary navigation links
- `announcement: string | null` — optional dismissible banner
- `trust`: `{ label: string; logos: string[] }` — partner/trust logo strip
- `hero`: `{ eyebrow, headline, headlineEmphasis: string | null, sub, formLabel, placeholder, cta, secondaryCta, trust, badge: string | null, frictionReducers[], heroBullets[], rotatingImages[] }`
- `about`: `{ eyebrow, title, body, pillars[{ k, t, d }], stats[{ n, l }] }`
- `services`: `{ eyebrow, title, sub, items[{ n, t, d, tag, image? }] }`
- `work`: `{ eyebrow, title, sub, projects[{ t, loc, yr, scope, size, caption, image? }], hidden }`
- `testimonials`: `{ eyebrow, title, items[{ q, a, r, company?, stars }] }`
- `faq`: `{ eyebrow, title, sub, items[{ q, a }] }`
- `finalCta`: `{ eyebrow, headline, sub, cta, secondary: string | null, frictionReducers[] }`
- `footer`: `{ blurb, cols[{ h, links[{ label, href }] }], social[{ label, href }], legalLinks[{ label, href }], legal }`
- `seo`: `{ title, description, canonical, googleAnalyticsId: string | null, facebookPixelId: string | null }`
- `extensions`: `{ trustBadges: string[] | null, reviewBadge: { rating, count, url } | null, contactDetails: { address, mapsUrl: string | null } | null, hours: Record<string,string> | null, bookingUrl: string | null, portalUrl: string | null }`
- `images`: `{ hero: { portrait?, slides? }, about: { feature? }, work: { cards[] }, testimonials: { avatars? }, footer: { logoImage? } }`
- `_meta`: provisioning metadata (don't render)

**Optional / nullable fields you MUST guard:** `work.hidden` (return null if true),
`announcement` (null), `brand.license`, `brand.established`, `hero.badge`,
`hero.headlineEmphasis`, `finalCta.secondary`, `testimonials.company`,
every `image?.url`, `images.*` subfields, `extensions.*`.

## 2. Import contract

A component may import **only**:

```ts
import { CONTENT } from '@/data/site';          // and/or its types
import { cn } from '@/lib/cn';                   // optional
import { paletteVars, typographyVars } from '@/lib/palette'; // rarely needed
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'; // permitted
import { /* icons */ } from '@phosphor-icons/react'; // permitted
```

- **No cross-component imports** (each file is copy-paste-portable).
- No other npm dependencies. No new env vars.
- Every component using `motion.*` must have `'use client'` at the top.

## 3. Styling contract

Palette + typography are already applied to `<body>` by `layout.tsx`. Use Tailwind
tokens that map to the brand CSS variables:

- colors: `bg-accent`, `text-accent`, `bg-bg`, `bg-bgSoft`, `text-ink`,
  `text-inkSoft`, `border-rule`. On-accent text: `text-bg`.
- fonts: `font-sans`, `font-heading`

Never hardcode hex values and never re-read `brand.palette` to inline colors.

**Image rule:** Use plain `<img>` (not `next/image`). Always pair with a fallback:

```tsx
{img?.url ? (
  <img src={img.url} alt={img.alt} loading="lazy"
       className="h-full w-full object-cover" />
) : (
  <div className="flex h-full w-full items-center justify-center bg-bgSoft
                  bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.03)_10px,rgba(0,0,0,0.03)_20px)]">
    <span className="font-sans text-xs uppercase tracking-widest text-inkSoft">{caption}</span>
  </div>
)}
```

## 4. Motion contract

Use `framer-motion` for entrance reveals, crossfades, and marquees. Always gate on
`useReducedMotion()`:

```tsx
const reduce = useReducedMotion();
<motion.div
  initial={reduce ? false : { opacity: 0, y: 20 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, amount: 0.3 }}
  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
>
```

Stagger lists with `transition={{ delay: i * 0.06 }}`. Never animate layout props
via scroll window listeners. Hover/active/focus states: plain Tailwind transitions.

## 5. Optional-field guarding (the onboarding-correctness rule)

The build runs against every client's content. A component that assumes data some
client omits breaks `onboard.js` step 5. Rules:

- `work.hidden === true` → `return null`
- `announcement === null` → don't render the bar
- `brand.license` / `brand.established` → render only when truthy
- `hero.badge`, `hero.headlineEmphasis`, `finalCta.secondary` → guard null
- `extensions.*` (any sub-field) → guard null before use
- `images.*` (any sub-field) → guard undefined before use
- Never index `items[0]` without checking length

## 6. File + export shape

- Path: `studio/catalog/<category>/{Category}{Variant}.tsx`
- Default export: a React component named identically to the file.
- Named `meta` export (used by the preview/export tooling):

```ts
export const meta = {
  id: 'hero-split',            // kebab, unique
  category: 'hero',            // nav|hero|trust|about|services|work|testimonials|faq|finalCta|contact|footer|seo
  label: 'Hero / Split',       // human label for the gallery
  consumes: ['brand.name', 'hero.headline', 'images.hero.slides'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react'],
} as const;
```

## 7. Slot-wiring contract

`template/src/app/page.tsx` has labeled SLOT regions in this order:
`nav → hero → trust → about → services → work → testimonials → faq → finalCta → contact → footer`.
A component is used by pasting its file in and replacing the placeholder block in
the matching SLOT.

- **Contact / CTA** components POST form data to `/api/contact` (JSON body:
  `{ name, phone, message?, email? }`). Include loading/success/error states.
- **SEO** components export `generateMetadata` from the page rather than rendering
  markup; `SeoLocalBusiness` adds a JSON-LD `<script>` from `brand` + `seo` + `extensions`.
- **Export** copies the preview's `site.ts` into the new client repo so all v2.1
  fields are available to components at build time.

## 8. The marker rule (never break)

`template/src/data/site.ts` ends with the `CONTENT` export. `onboard.js` replaces
everything from that declaration onward. Do not add code after it, and do not edit
the template's `site.ts` from a component. Only the type definitions live above it.

The canonical v2.1 schema lives in `studio/preview/src/data/site.ts`. The export
pipeline copies it into each new client repo via `copySiteData`.

## 9. Env-var contract

The Contact route reads exactly: `LEAD_DELIVERY_MODE`, `LEAD_TO_EMAIL`,
`RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `MAKE_WEBHOOK_URL`. Components must not read
or invent other env vars, and must never reference master secrets
(`RETELL_API_KEY`, `TWILIO_AUTH_TOKEN`, `AIRTABLE_API_KEY`).

## 10. Per-component acceptance checklist

Before a component is "done":

- [ ] `cd template && npm run build` passes with it wired into a SLOT.
- [ ] Renders correctly in the preview against every fixture, **including** ones
      with empty/omitted optional fields.
- [ ] Imports resolve with zero edits after copy-paste (only `@/data/site`,
      `@/lib/*`, `framer-motion`, `@phosphor-icons/react`).
- [ ] `meta` export present and accurate.
- [ ] No hardcoded colors, no new env vars, no cross-component imports.
- [ ] No em-dashes in text (headlines, copy, alt, labels).
- [ ] `useReducedMotion()` gated — motion collapses to static when reduced.
- [ ] Images use the `<img>` + fallback pattern from §3.
- [ ] Every optional field guarded per §5.

## 11. Reference skeleton

```tsx
'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { ShieldCheck } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';

export const meta = {
  id: 'about-pillars',
  category: 'about',
  label: 'About / Pillars + stats',
  consumes: ['about.eyebrow', 'about.title', 'about.pillars', 'about.stats'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react'],
} as const;

export default function AboutPillars() {
  const reduce = useReducedMotion();
  const { about } = CONTENT;
  if (!about.pillars.length) return null;
  return (
    <section className="px-6 py-20">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">{about.eyebrow}</p>
      <motion.h2
        className="mt-3 font-heading text-3xl text-ink"
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        {about.title}
      </motion.h2>
      {/* pillars grid … */}
    </section>
  );
}
```
