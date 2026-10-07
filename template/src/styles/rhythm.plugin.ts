/**
 * The section-rhythm utilities, `rh-bleed | rh-tight | rh-normal | rh-loose | rh-text`.
 *
 * Decision 24 of console/design/DECISIONS-template-fidelity-v2.md: rhythm is decided by the PAGE
 * TEMPLATE, never by the component. Research §6 item 8 names uniform section rhythm as one of the
 * eight things that make a site read as AI-made, and decision 30(d) bans it outright. A component
 * cannot see a whole page, so it cannot be the thing that varies.
 *
 * How it is applied: console/src/lib/export.ts's wirePages wraps a section in
 * `<div className="rh-loose">`, and PageStudio's SectionShell applies the same class so the
 * preview and the export agree. The wrapper has exactly one child, which is the component's root
 * element (a <section>, or <header>/<footer> for chrome), hence the `> *` selector.
 *
 * The `!important` is deliberate and is the only one in the system: catalog components carry their
 * own `py-14 lg:py-20`, and the page template has to win. Only padding-block is forced; nothing
 * else about the component is touched.
 */
import plugin from 'tailwindcss/plugin';
import { spacing } from './tokens';

export default plugin(({ addUtilities }) => {
  const band = (v: string) => ({ paddingBlock: `${v} !important` });
  addUtilities({
    // Full-bleed: the component owns its own edges, so the wrapper contributes nothing vertically
    // and lets the child's media reach the viewport edge.
    '.rh-bleed > *': { paddingBlock: '0 !important' },
    '.rh-bleed > * > div': { maxWidth: 'none', paddingInline: '0' },

    '.rh-tight > *':  band(spacing['section-tight']),
    '.rh-normal > *': band(spacing['section-normal']),
    '.rh-loose > *':  band(spacing['section-loose']),

    // Text-dominant: normal band, but the content column is narrowed so the section reads as
    // prose against its neighbours. This is the "alternating text-dominant sections against
    // full-bleed photography" rhythm from research §5.
    '.rh-text > *': band(spacing['section-normal']),
    '.rh-text > * > div': { maxWidth: '60rem', marginInline: 'auto' },
  });
});
