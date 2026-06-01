# business-site-template

The JDD blank-slate site template. It is a **local** starting point: you copy it
per client, drop in catalog components, preview on a dev server, and then
`onboard.js` provisions it into a real client repo + deployment.

## How it fits the pipeline

```
template/  ──(npm run new-client)──▶  clients/{slug}/repo/  ──(onboard.js)──▶  GitHub repo + Vercel
   ▲                                       │
   │                                       ├─ drop in catalog components into the SLOTs
   └─ blank slate, fixed schema            └─ npm run dev to preview
```

- **Schema** lives in `src/data/site.ts` (`SiteContent`). It is fixed and identical
  for every client. The `CONTENT` export is a default placeholder; `onboard.js`
  splices the client's real content into it at provision time. **Never add fields**
  and never write code after the `CONTENT` export (see the contract in that file).
- **Palette + typography** come from `CONTENT.brand` via CSS variables that
  `src/app/layout.tsx` sets on `<body>`. Components use Tailwind tokens
  (`bg-accent`, `text-ink`, `border-rule`, `bg-bgSoft`, `font-heading`) — never
  hardcode colors.
- **Lead delivery** is `src/app/api/contact/route.ts`. It reads only the env vars
  `onboard.js` provides (`LEAD_DELIVERY_MODE`, `LEAD_TO_EMAIL`, `RESEND_API_KEY`,
  `RESEND_FROM_EMAIL`, `MAKE_WEBHOOK_URL`).

## The SLOT system

`src/app/page.tsx` has one labeled `SLOT` per section (nav, hero, services, faq,
testimonials, contact, footer) with a plain default block so the template renders
immediately. To use a catalog component:

1. Paste its file into `src/components/catalog/<category>/`.
2. Import it in `page.tsx` and replace the placeholder block inside the matching
   `SLOT`.

Browse and select components in the studio preview app (`studio/preview`), which
exports a folder you copy into `src/components/catalog/`.

## Local commands

```
npm install
npm run dev      # preview at http://localhost:3000
npm run build    # must pass before onboarding (onboard.js step 5 runs this)
```
