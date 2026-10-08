# Conversion non-negotiables

Six things a local-service site must do to convert, drawn from
`RESEARCH-local-service-visual-design.md` (the conversion architecture the whole Tier-B upgrade sits
on top of). The fidelity work changes how the site LOOKS; these are what it must still DO.

**Decision 32: this list is hand-checked at go-live. There is deliberately no new build-time
enforcement machinery for it.** A lint that "proves" tap-to-call works by grepping for `phoneHref`
cannot tell whether the number is actually reachable with a thumb at 390px, and a green check that
means less than it claims is worse than an honest manual walk. So this is a checklist a person reads
against a real, built site, not a test that runs in CI.

**How to use it.** After building the reference site (or any client site) locally and serving it
(`npm run build && npm start` in the client repo, then open `http://localhost:3000`), walk all six
items by hand at a **390px** viewport and again at **1440px**. Items 1 and 2 (tap-to-call and the
sticky bar) are the two a resized desktop browser cannot fully answer, because touch targets, the
`tel:` handoff, and real scroll behaviour only exist on a phone; note them as inspected-not-verified
if you are reviewing on desktop, and if the review feels untrustworthy that is the signal to ask for
a deployed preview on a real device (a decision for the user, per decision 43).

| # | Non-negotiable | How to check | Owner file(s) |
|---|---|---|---|
| 1 | **Tap-to-call** | Every phone number on the page is a real `<a href={brand.phoneHref}>` (a `tel:` link), not plain text, so a tap dials. Check the nav, the hero, and the sticky bar. | `nav/*`, `hero/*`, `template/src/lib/StickyCallBar.tsx` |
| 2 | **Sticky mobile call bar** | At 390px, after the hero scrolls past `#top`, the sticky call bar is visible and fixed to the bottom with a 56px tap target. It must not cover the footer (a spacer reserves its height). | `template/src/lib/StickyCallBar.tsx` |
| 3 | **Named service area** | `extensions.serviceArea` is non-empty and a `trust/ServiceArea` section is actually placed on a page, so a visitor sees the towns served. | intake, `page-templates.tsx` |
| 4 | **Review aggregate above the fold** | `extensions.reviewBadge` is non-null and the hero renders it at EVERY breakpoint, not hidden behind a `lg:` breakpoint (SPEC §7). A rating a phone visitor cannot see is not above the fold. | intake, `hero/*` |
| 5 | **License displayed** | `brand.license` is non-null and the nav or the footer renders it, so the credential is visible without hunting. | intake, `nav/*`, `footer/*` |
| 6 | **Form at six fields or fewer** | The lead form asks for no more than six fields. `LeadForm` ships two (name, phone) plus one optional message; anything more is friction the research names as a drop-off cause. | `packages/ui/src/LeadForm.tsx` |

## Also at export: the navbar must link to the new pages (multi-page sites)

Not one of the six conversion non-negotiables, but an export-correctness check that belongs in the
same hand-walk. When a client site has more than one page (the default build is four: Home,
Services, About, Contact), the exported navbar must link to each of those pages, not behave like a
single-page anchor bar. The export regenerates `CONTENT.nav` from the composition's nav-visible
pages (see plan §9e), so after building the site, **click every navbar link and confirm each loads
its page** (`/services`, `/about`, `/contact`). Per-service pages (`services/<slug>`) are
intentionally NOT in the top nav; confirm they are instead reachable from the services section. If a
nav link is a `#anchor` instead of a route on a multi-page site, the nav regeneration did not run
(check that the export sent both `composition` and `content`).

When an item fails, the fix is in the owner file(s), not here: this document records the standard,
not the implementation.
