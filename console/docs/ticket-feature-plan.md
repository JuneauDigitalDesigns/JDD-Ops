# Implementation Plan: Client Support-Ticket System (Portal ↔ Console via KV)

> Drift-proof execution plan. All 24 design decisions are FINAL. Clone-sources and exact paths cited.

## A) Architecture
A ticket is a durable KV record `jdd:ticket:item:{id}` + a sorted-set index `jdd:ticket:index` (score = createdAt epoch ms), in the same Upstash instance already shared by `jdd:lead:*` / `jdd:account:*`. Bridged like the lead funnel: the **portal** (`ops/juneau-digital-designs`) is the client producer/consumer (create / add message / reopen / confirm-close, scoped server-side to one `accountEmail`+`siteSlug` via `resolvePortalRequest`); the **console** (`ops/jdd-ops/console`) is the operator consumer (full CRUD + any status, Kanban at `/tickets`, prominent Briefing section). Canonical shape + pure ops live in a new standalone `ticket.ts` in **`ops/jdd-schema`**, built to `dist/`, version-bumped, tagged, re-pinned by both apps. Strictly additive.

## B) Ticket data shape
Keys: `jdd:ticket:item:${id}` (`ticketKey(id)`), `jdd:ticket:index` (`TICKET_INDEX`). No reverse key.
```
TICKET_STATUSES = ['open','in_progress','waiting_on_client','resolved','closed'] as const
TICKET_CATEGORIES = ['billing','technical','content','voice_agent','other']  // CONFIRMED
```
zTicket fields:
- id: string (randomUUID)
- createdAt: number (epoch ms; = zset score)
- updatedAt?: number
- accountEmail: string (normalized, server-stamped)
- siteSlug: string (server-stamped)
- status: TicketStatus
- subject: string
- category: string (∈ TICKET_CATEGORIES)
- order?: number (optional — add if console board uses drag-reorder)
- activity: {at:number; kind:string; text:string}[]   // audit, server-stamped
- messages: {at:number; author:'client'|'operator'; text:string}[]  // thread

Pure ops in @jdd/schema (model on account.ts + console patchLead):
- ticketKey(id)
- createTicket({accountEmail,siteSlug,subject,category,body,now?}) → status 'open', seeds activity[{kind:'created'}] + messages[{author:'client',text:body}]
- applyTicketStatus(ticket,status,now?)
- appendTicketMessage(ticket,{author,text},now?)
- appendTicketActivity(ticket,entry|entries,now?)
I/O wrappers (get/list/save/delete) live in EACH app's store, not the package.

## C) Phases

> RELEASE ORDERING (per risk E#1): schema code + build + local-link done first so both apps
> can be developed/built against 1.21.0 WITHOUT the tag existing. The real commit + `git tag v1.21.0`
> + push + switch all pins to `#v1.21.0` happens LAST (Phase 6), after both apps build clean.
> Local dev uses the built dist synced into each app's node_modules/@jdd/schema (not a committed file: pin).

### Phase 1 — @jdd/schema
1. New `ops/jdd-schema/src/ticket.ts` — clone structure of `src/account.ts`; standalone, import nothing from account.ts; intra-pkg imports use `.js`.
2. Edit `src/index.ts` — append `export * from "./ticket.js";` (match version-comment style).
3. Edit `package.json` — bump version 1.20.0 → 1.21.0.
4. `npm run build` (regenerate dist/).
5. Commit, tag `v1.21.0`, push tags.
6. Re-pin BOTH apps + `jdd-ops` root to `#v1.21.0` via explicit `npm install "github:JuneauDigitalDesigns/jdd-schema#v1.21.0"`; run `npm run check-schema` (console) → must be green.
   NOTE: console deliberately keeps leadTypes local; tickets intentionally go in the package (standalone). Call out in PR.

### Phase 2 — Console API + audit
7. New `console/src/lib/ticketStore.ts` — clone consumer half of `src/lib/leadQueue.ts`: `ticketQueueConfigured()` (dual-env KV check), `getRedis()`, `listTickets()` (self-healing zrem prune + array guards), `getTicket`, `saveTicket` (set + zadd@createdAt), `patchTicket` (read-modify-write), `deleteTicket`. Re-export ticket types + TICKET_STATUSES from @jdd/schema.
8. New `console/src/app/api/tickets/route.ts` — clone `api/leads/route.ts`: runtime nodejs, force-dynamic, notConfigured (200+error GET / 503 mutations). GET=listTickets. POST=405/omit (tickets originate client-side — EXECUTOR DECISION). PATCH: validate status ∈ TICKET_STATUSES, operator may set ANY status; support `{message}` operator reply + status change w/ activity-diff; call patchTicket; append audit; trigger client email (step 8/23). DELETE: operator-only allowed; append audit.
9. Edit `console/src/lib/audit.ts` — add AuditAction members `ticket.status` / `ticket.reply` / `ticket.delete`; call `appendAudit({slug: ticket.siteSlug, action, ok, summary, detail})` — KEY NAMES ONLY, no message bodies.

### Phase 3 — Console /tickets UI + Briefing section
10. New `console/src/lib/ticket-meta.ts` — clone `lead-meta.ts`: TICKET_LABEL, TICKET_COLOR (reuse var(--accent/warn/ok/fg-3)), `TICKETS_LAST_SEEN_KEY='jdd:tickets:lastSeenAt'`, `isUnseen(ticket,lastSeenAt)` off createdAt.
11. New `console/src/app/tickets/page.tsx` — clone `app/leads/page.tsx` (force-dynamic, renders <TicketsView/>).
12. New `console/src/components/tickets/TicketsView.tsx` — clone `components/leads/LeadsView.tsx`: PageHeader/RefreshButton/WarnBanner, error discipline (keep last-known view), load() from /api/tickets, optimistic patch(), LAST_SEEN effect w/ TICKETS_LAST_SEEN_KEY. Drop Calls tab / createLead machinery.
13. New `console/src/components/tickets/TicketBoard.tsx` (+ TicketCard.tsx) — clone LeadBoard.tsx / LeadCard.tsx. Columns = TICKET_STATUSES; COLLAPSIBLE = {resolved,closed}. If drag-reorder kept, add `order?` to zTicket (Phase 1).
14. New `console/src/components/tickets/TicketModal.tsx` — clone LeadModal.tsx (OPEN IT FIRST): messages thread + activity trail + status selector (any) + operator reply box PATCHing {id,message}.
15. Edit `console/src/app/api/briefing/route.ts` — add `tickets` block to BriefingPayload: `{needsAttention:[{id,subject,siteSlug,status,createdAt}], openCount, waitingCount}`; guarded by ticketQueueConfigured(), listTickets() filtered to status open||waiting_on_client, capped ~8. Cheap/cached-free like the lead read.
16. Edit `console/src/components/BriefingView.tsx` — inject PROMINENT standalone <TicketsPanel> at TOP of main column (clone FunnelPanel/MoneyPanel pattern): .panel + Lifebuoy/ChatCircle header "{open} open · {waiting} waiting"; rows = StatusDot bullet + subject + site, link `/tickets` (optionally `?open={id}` if TicketsView reads it). Omit panel if queue unconfigured (never fake "0"). No ConsoleNav entry (matches /leads).

### Phase 4 — Portal API
17. New `juneau-digital-designs/app/lib/ticket-store.ts` — `import "server-only"`, `Redis.fromEnv()` (like account-store.ts — NOT the dual-env console style). `getTicket` (zTicket.safeParse), `listTicketsForScope(accountEmail,siteSlug)` (filter index to scope — SECURITY boundary), `saveTicket`, pure-op callers from @jdd/schema. No TTL.
18. New `juneau-digital-designs/app/api/portal/tickets/route.ts` — clone `api/portal/calls/route.ts` + profile route. Every handler: `const ctx = await resolvePortalRequest(request); if(!ctx.ok) return ctx.response;` Stamp accountEmail=ctx.account.email, siteSlug=ctx.site.slug.
    - GET: list for (email,slug) only.
    - POST: {subject,category,body} validated (trim/length/category∈enum) → createTicket → saveTicket.
    - PATCH: client ONLY add message (author:'client'), reopen (status:'open'), confirm-close (status:'closed'); reject any other status 400; ownership check (email+slug match ctx) else 403/404; no editing past messages.
    - No DELETE.
    - Guard unconfigured KV → clean error.

### Phase 5 — Portal Support tab + UI + client email
19. Edit `app/portal/types.ts` — add to PORTAL_TABS `{id:"support",label:"Support",shortLabel:"Support",href:"support",feature:null}`; add "support" to MOBILE_MORE_TABS (NOT MOBILE_BAR_TABS — keep 4-cap).
20. Edit `app/components/portal/PortalChrome.tsx` — add `support: Lifebuoy` to TAB_ICON (import from @phosphor-icons/react). Mandatory or runtime crash.
21. New `app/portal/(dash)/support/page.tsx` — clone `(dash)/calls/page.tsx`: force-dynamic, currentSite(searchParams), PortalNoAccess fallback, render <SupportSection key={site.slug} site={site}/>.
22. New `app/components/portal/SupportSection.tsx` ("use client") — mirror useCachedFetch/useInvalidate (PortalDataProvider): add `tickets` TTL to CLIENT_TTL; fetch /api/portal/tickets?site=slug. Submit form (SectionCard/FieldRow/inputStyle from ui/FormPrimitives: subject + category select + body textarea) POST. List via DataTable (subject primary, status badge via StatusDot, createdAt meta, onRowClick→drawer). Detail Drawer: messages thread + activity trail + StatusDot + reply box + Reopen/Confirm-close PATCH. Map TicketStatus→Status union (open→warn, waiting_on_client→pending, resolved/closed→ok — EXECUTOR DECISION).
23. New `app/lib/ticket-email.ts` — clone CLIENT-directed `agreement-email.ts` (NOT operator notification-email.ts). `sendTicketClientEmail({accountEmail,subject,deepLink,kind})`: Resend, from=QUOTE_FROM_EMAIL||onboarding@resend.dev, recipient=ticket.accountEmail, brandedEmailHtml, deepLink=https://juneaudigitaldesigns.com/portal/support?site={slug}[&open={id}], never throws.
    WHO SENDS: operator writes via console, so actual send happens in the CONSOLE tickets route via `console/src/lib/resend.ts` getResend() (console can't import portal app/lib). This portal file is the HTML/shape reference; duplicate minimal HTML in console. Document in PR.

### Phase 6 — Verification
24. Per-app builds + typecheck + check-schema. Manual: portal create → confirm jdd:ticket:item:* + index; shows in /tickets board + Briefing section; operator reply/status → client email fires + activity + audit.ndjson (key names only); client reopen/confirm-close → server rejects other statuses.

## D) Build / Verify
- @jdd/schema: `npm run build`, `npm run typecheck`, `npm test`; then commit + `git tag v1.21.0` + `git push --tags`.
- Re-pin (explicit, lock won't move otherwise): `npm install "github:JuneauDigitalDesigns/jdd-schema#v1.21.0"` in console, juneau-digital-designs, and jdd-ops root; console `npm run check-schema` must be green.
- Console: dev on port 3040; `npm run build`. DO NOT build over a live `next dev` (shared .next). tsc noisy — filter to touched files.
- Agency site: `npm run build` (Next 16); don't build over running dev; `npm run lint`.
- No workspace symlink — apps import @jdd/schema from a pushed git tag in node_modules. Local iteration: temp `npm install "file:../../jdd-schema"` then switch back to `#v1.21.0` before committing (never commit a file:/link pin).

## E) Risk / drift guards
1. dist-vs-src + un-pushed-tag deadlock → iterate locally with file: pin, switch back to #v1.21.0 before commit.
2. stale lockfile defeats pin → always explicit github install + check-schema green.
3. KV env differs: portal Redis.fromEnv() (throws if unset); console new Redis({url,token}) + configured() gate → clone each side's exact pattern; portal route degrades gracefully.
4. PORTAL_TABS 4-cap → Support to MOBILE_MORE_TABS only; must add TAB_ICON.support or PortalChrome crashes.
5. zod strips unknown keys → keep ticket.ts standalone; every written field must be in zTicket (incl. order? if used).
6. shared-pkg rebuild → verify dist/ticket.js exports before tagging.
7. audit = key names only, never message bodies.
8. client email sent from CONSOLE route (operator writes there), recipient=accountEmail, mirror client-directed agreement-email shape.
