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
- **Voice routing** (Growth/Enterprise) is `src/app/api/voice/route.ts` +
  `src/app/api/voice/no-answer/route.ts`. The Twilio number's voiceUrl points at
  `/api/voice`, which `<Dial>`s `CLIENT_FORWARD_PHONE` (normalized to E.164) for
  `CLIENT_FORWARD_RING_SECONDS` (default 25). On no-answer, `/api/voice/no-answer`
  calls Retell `POST /v2/register-phone-call` (`RETELL_API_KEY`) and returns
  `<Dial><Sip>sip:{call_id}@{RETELL_SIP_DOMAIN}</Sip></Dial>` (default
  `sip.retellai.com`) to connect the Retell agent (`RETELL_AGENT_ID`) over SIP.
  Do **not** import the number into Retell or set up Retell SIP trunking — that
  bypasses `/api/voice` and breaks the human-first ring.

## Voice routing env vars (Growth/Enterprise)

`onboard.js` writes these into each client `.env.local` and Vercel sync pushes them:

| Var | Purpose |
|---|---|
| `RETELL_AGENT_ID` | which Retell agent answers on no-answer |
| `RETELL_API_KEY` | authorizes the register-phone-call request (server-side only) |
| `RETELL_SIP_DOMAIN` | SIP host to dial; default `sip.retellai.com` |
| `CLIENT_FORWARD_PHONE` | the client's real phone, rung first |
| `CLIENT_FORWARD_RING_SECONDS` | ring window before AI fallback; default 25 |

## The SLOT system

`src/app/page.tsx` has one labeled `SLOT` per section (nav, hero, services, faq,
testimonials, contact, footer) with a plain default block so the template renders
immediately. To use a catalog component:

1. Paste its file into `src/components/catalog/<category>/`.
2. Import it in `page.tsx` and replace the placeholder block inside the matching
   `SLOT`.

Browse and select components in the studio preview app (`console`), which
exports a folder you copy into `src/components/catalog/`.

## Local commands

```
npm install
npm run dev      # preview at http://localhost:3000
npm run build    # must pass before onboarding (onboard.js step 5 runs this)
```
