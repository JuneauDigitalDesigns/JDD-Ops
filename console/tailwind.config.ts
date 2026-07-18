import type { Config } from 'tailwindcss';

// Unified token set for the JDD Console (merge of studio + runbook).
//   • Client-brand tokens (accent/bg/ink/rule…) bind to CSS vars set per-route by the
//     /build layout from CONTENT.brand — used only by catalog preview components.
//   • ui* tokens are the JDD studio chrome, bound to themed CSS vars (see globals.css
//     :root / [data-theme="dark"]) so /build chrome follows the light/dark toggle while
//     the client-brand preview above stays true to the client's own palette.
//   • Runbook chrome tokens (surface/panel/fg*/ok/warn/danger) bind to CSS vars from the
//     global :root in globals.css — used by /onboard + the home page.
// accent/bg/rule are shared keys that map to the same CSS var in both worlds; their value
// is resolved per-route by whichever layout sets the var (see globals.css + build/layout).
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
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
        panel: 'var(--panel)',
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
      boxShadow: {
        panel: '0 30px 80px -30px rgba(0,0,0,0.4)',
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
