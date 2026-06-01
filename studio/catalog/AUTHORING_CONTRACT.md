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
At provision time `onboard.js` splices the client's real content into
`src/data/site.ts` and runs `npm run build` — which must pass for **any** client.

## 1. The fixed schema (`SiteContent`)

Source of truth: `template/src/data/site.ts`. Do **not** add fields. Shape:

- `brand`: `name`, `short`, `long`, `established: string | null`, `tagline`,
  `phone`, `phoneHref`, `email`, `address`, `license: string | null`,
  `palette { accent, bg, bgSoft, ink, inkSoft, rule }`,
  `typography { fontSans, fontHeading, headingWeight, bodyWeight }`
- `services.items[]`: `{ n, t, d, tag }`
- `faq.items[]`: `{ q, a }`
- `testimonials?.items[]`: `{ q, a, r, company: string | null, stars }` — **optional**
- `seo`: `{ title, description, canonical }`
- `_meta`: provisioning metadata (don't render)

**Optional / nullable fields you MUST guard:** `testimonials` (whole key may be
absent), `brand.license`, `brand.established`, `company` on a testimonial.

## 2. Import contract

A component may import **only**:

```ts
import { CONTENT } from '@/data/site';          // and/or its types
import { cn } from '@/lib/cn';                   // optional
import { paletteVars, typographyVars } from '@/lib/palette'; // rarely needed
```

- **No cross-component imports** (each file is copy-paste-portable).
- No new npm dependencies. No new env vars.

## 3. Styling contract

Palette + typography are already applied to `<body>` by `layout.tsx`. Use Tailwind
tokens that map to the brand CSS variables:

- colors: `bg-accent`, `text-accent`, `bg-bg`, `bg-bgSoft`, `text-ink`,
  `text-inkSoft`, `border-rule`
- fonts: `font-sans`, `font-heading`

Never hardcode hex values and never re-read `brand.palette` to inline colors.

## 4. Optional-field guarding (the onboarding-correctness rule)

The build runs against every client's content. A component that assumes data some
client omits breaks `onboard.js` step 5. Rules:

- Testimonials variants: `if (!CONTENT.testimonials?.items?.length) return null;`
- `brand.license` / `brand.established`: render only when truthy.
- Never index `items[0]` without checking length.

## 5. File + export shape

- Path: `studio/catalog/<category>/{Category}{Variant}.tsx`
- Default export: a React component named identically to the file.
- Named `meta` export (used by the preview/export tooling — **never** written into
  `site.ts`):

```ts
export const meta = {
  id: 'hero-split',            // kebab, unique
  category: 'hero',            // nav|hero|services|faq|testimonials|contact|footer|seo
  label: 'Hero — Split',       // human label for the gallery
  consumes: ['brand.name', 'brand.tagline', 'brand.phoneHref'],
  sharedDeps: ['@/lib/cn'],    // any @/lib/* it imports
} as const;
```

## 6. Slot-wiring contract

- `template/src/app/page.tsx` has labeled `SLOT` regions: nav → hero → services →
  faq → testimonials → contact → footer. A component is used by pasting its file in
  and replacing the placeholder block in the matching SLOT.
- **Contact / CTA** components POST form data to `/api/contact` (JSON body).
- **SEO** components export `generateMetadata` from the page rather than rendering
  markup; `SeoLocalBusiness` adds a JSON-LD `<script>` from `brand` + `seo`.

## 7. The marker rule (never break)

`template/src/data/site.ts` ends with the `CONTENT` export. `onboard.js` replaces
everything from that declaration onward. Do not add code after it, and do not edit
`site.ts` from a component. Only the type definitions live above it.

## 8. Env-var contract

The Contact route reads exactly: `LEAD_DELIVERY_MODE`, `LEAD_TO_EMAIL`,
`RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `MAKE_WEBHOOK_URL`. Components must not read
or invent other env vars, and must never reference master secrets
(`RETELL_API_KEY`, `TWILIO_AUTH_TOKEN`, `AIRTABLE_API_KEY`).

## 9. Per-component acceptance checklist

Before a component is "done":

- [ ] `cd template && npm run build` passes with it wired into a SLOT.
- [ ] Renders correctly in the preview against every fixture, **including** ones
      with empty/omitted optional fields (e.g. a starter site with no testimonials).
- [ ] Imports resolve with zero edits after copy-paste (only `@/data/site`,
      `@/lib/*`).
- [ ] `meta` export present and accurate.
- [ ] No hardcoded colors, no new env vars, no cross-component imports.

## 10. Reference skeleton

```tsx
// studio/catalog/services/ServicesGrid.tsx
import { CONTENT } from '@/data/site';

export const meta = {
  id: 'services-grid',
  category: 'services',
  label: 'Services — Grid',
  consumes: ['services.items'],
  sharedDeps: [],
} as const;

export default function ServicesGrid() {
  const { items } = CONTENT.services;
  if (!items.length) return null;
  return (
    <section className="px-6 py-16">
      <h2 className="font-heading text-2xl text-ink">Services</h2>
      <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((s) => (
          <li key={s.n} className="rounded border border-rule p-5">
            <span className="text-sm text-accent">{s.n} · {s.tag}</span>
            <h3 className="mt-2 text-lg text-ink">{s.t}</h3>
            <p className="mt-1 text-inkSoft">{s.d}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
```
