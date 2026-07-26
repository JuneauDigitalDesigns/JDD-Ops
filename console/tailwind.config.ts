import type { Config } from 'tailwindcss';

// Token set for the JDD Console. TWO worlds, deliberately:
//   • CLIENT-BRAND tokens (accent/bg/ink/rule/accent050…) bind to CSS vars set per-route
//     by the /build layout from CONTENT.brand — used ONLY by catalog preview components.
//     A client may have a dark palette; that must keep rendering correctly. Never unify
//     these with chrome.
//   • CHROME tokens are the console's own UI. The console is LIGHT-ONLY (warm cream);
//     there is no dark theme. `surface/panel/fg*/rule*` are canonical. The `ui*` keys are
//     retained ALIASES of the same underlying vars (globals.css maps --ui-* → canonical)
//     so /build and /onboard can no longer drift apart. Prefer the canonical names in new
//     code; the ui* spellings are migrated opportunistically.
//
// SIZING LIVES HERE. fontSize and spacing below are the single source of truth — the app
// previously had no scale at all, so sizes were re-typed inline in ~23 files. Change the
// scale here, not in components.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Type scale — ~15-20% larger than stock Tailwind at the small end, which is where
      // this app actually lives (text-sm/text-xs are the workhorses). Bumping these grows
      // the whole console without touching every file. [size, lineHeight] pairs.
      fontSize: {
        '2xs': ['12px', { lineHeight: '1.45' }],   // smallest legal size; badges only
        xs: ['13px', { lineHeight: '1.5' }],       // secondary / meta
        sm: ['15px', { lineHeight: '1.55' }],      // BASE BODY — the workhorse
        base: ['16px', { lineHeight: '1.6' }],
        lg: ['18px', { lineHeight: '1.5' }],
        xl: ['20px', { lineHeight: '1.4' }],       // section headers
        '2xl': ['24px', { lineHeight: '1.25' }],
        '3xl': ['28px', { lineHeight: '1.15' }],   // screen titles
        '4xl': ['36px', { lineHeight: '1.1' }],
        '5xl': ['46px', { lineHeight: '1.05' }],
        // Semantic sizes for chrome — use these instead of arbitrary values.
        label: ['14px', { lineHeight: '1.4' }],    // form field labels
        kicker: ['11.5px', { lineHeight: '1.4' }], // section eyebrows only
      },
      colors: {
        // Client-brand tokens — bound to CSS vars set per previewed site. Reserved
        // for catalog components; never used by studio chrome.
        accent: 'var(--accent)',
        accentFg: 'var(--accent-fg)',
        accentInk: 'var(--accent-ink)',
        bg: 'var(--bg)',
        bgSoft: 'var(--bg-soft)',
        ink: 'var(--ink)',
        inkSoft: 'var(--ink-soft)',
        rule: 'var(--rule)',
        // Derived brand tones (runtime, from palette.ts) — richer editorial palette
        // + on-brand dark "contrast" skin. Reserved for catalog preview components.
        accentStrong: 'var(--accent-strong)',
        accent050: 'var(--accent-050)',
        accent100: 'var(--accent-100)',
        accent200: 'var(--accent-200)',
        inkPanel: 'var(--ink-panel)',
        inkPanel2: 'var(--ink-panel-2)',
        onInk: 'var(--on-ink)',
        onInkSoft: 'var(--on-ink-soft)',
        ruleInk: 'var(--rule-ink)',
        // Runbook chrome tokens — bound to global :root vars (JDD light/dark palette).
        surface: 'var(--surface)',
        surface2: 'var(--surface-2)',
        panel: 'var(--panel)',
        panel2: 'var(--panel-2)',
        bgDeep: 'var(--bg-deep)',
        fg: 'var(--fg)',
        fg2: 'var(--fg-2)',
        fg3: 'var(--fg-3)',
        ruleStrong: 'var(--rule-strong)',
        ok: 'var(--ok)',
        warn: 'var(--warn)',
        danger: 'var(--danger)',
        // Studio-chrome tokens — themed CSS vars, ui* = chrome only, kept separate
        // from the client-brand vars above so previews stay true.
        uiBg: 'var(--ui-bg)',
        uiBgSoft: 'var(--ui-bg-soft)',
        uiSurface: 'var(--ui-surface)',
        uiSurface2: 'var(--ui-surface-2)',
        uiFg: 'var(--ui-fg)',
        uiFg2: 'var(--ui-fg-2)',
        uiFg3: 'var(--ui-fg-3)',
        uiAccent: 'var(--ui-accent)',
        uiAccentInk: 'var(--ui-accent-ink)',
        uiRule: 'var(--ui-rule)',
        uiRuleStrong: 'var(--ui-rule-strong)',
        uiCanvas: 'var(--ui-canvas)',
        uiInk: 'var(--ui-ink)',
        uiInkSoft: 'var(--ui-ink-soft)',
        uiCardRule: 'var(--ui-card-rule)',
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        heading: 'var(--font-heading)',
        // Studio chrome fonts (JDD): Hanken Grotesk body, Big Shoulders display,
        // DM Mono for kickers/labels.
        chrome: ['var(--font-hanken)', 'system-ui', 'sans-serif'],
        display: ['var(--font-big-shoulders)', 'var(--font-hanken)', 'sans-serif'],
        chromeMono: ['var(--font-dm-mono)', 'ui-monospace', 'monospace'],
        // Runbook chrome fonts.
        body: ['var(--font-hanken)', 'Hanken Grotesk', 'sans-serif'],
        mono: ['var(--font-dm-mono)', 'DM Mono', 'monospace'],
      },
      letterSpacing: {
        tightest: '-0.04em',
        tightish: '-0.02em',
        wideish: '0.08em',
        widest2: '0.14em',
      },
      // Elevation ladder — layering is what makes the console read as an app rather
      // than a page. Ascending: raised (cards) → panel (drawers) → overlay (catalog
      // picker) → floating (contextual toolbars pinned over the canvas).
      boxShadow: {
        raised: '0 1px 2px rgba(20,18,12,0.04), 0 4px 12px -4px rgba(20,18,12,0.10)',
        panel: '0 2px 6px rgba(20,18,12,0.05), 0 24px 60px -28px rgba(20,18,12,0.32)',
        overlay: '0 8px 20px rgba(20,18,12,0.10), 0 48px 100px -32px rgba(20,18,12,0.42)',
        floating: '0 2px 8px rgba(20,18,12,0.10), 0 12px 32px -10px rgba(20,18,12,0.28)',
        glow: '0 12px 40px -10px var(--accent-glow)',
      },
      borderRadius: {
        xl2: '22px',
      },
      backgroundImage: {
        'accent-grad': 'var(--accent-grad)',
      },
    },
  },
  plugins: [],
};

export default config;
