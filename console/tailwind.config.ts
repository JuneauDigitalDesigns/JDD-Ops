import type { Config } from 'tailwindcss';

// Unified token set for the JDD Console (merge of studio + runbook).
//   • Client-brand tokens (accent/bg/ink/rule…) bind to CSS vars set per-route by the
//     /build layout from CONTENT.brand — used only by catalog preview components.
//   • ui* tokens are the JDD "Aurora Glass" studio chrome (literal hex, route-independent).
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
        // Runbook chrome tokens — bound to global :root vars (dark Aurora-Glass console).
        surface: 'var(--surface)',
        panel: 'var(--panel)',
        fg: 'var(--fg)',
        fg2: 'var(--fg-2)',
        fg3: 'var(--fg-3)',
        ruleStrong: 'var(--rule-strong)',
        ok: 'var(--ok)',
        warn: 'var(--warn)',
        danger: 'var(--danger)',
        // Studio-chrome tokens — JDD "Aurora Glass" brand. ui* = chrome only,
        // kept separate from the client-brand vars above so previews stay true.
        uiBg: '#07101e',          // deep navy — dark rails (sidebar + top nav)
        uiBgSoft: '#0b1525',
        uiSurface: 'rgba(255,255,255,0.04)',
        uiSurface2: 'rgba(255,255,255,0.07)',
        uiFg: '#F4F6FB',
        uiFg2: 'rgba(244,246,251,0.74)',
        uiFg3: 'rgba(244,246,251,0.48)',
        uiAccent: '#F5EDD6',      // parchment — highlights on dark, fills on light
        uiAccentInk: '#06121a',   // text on parchment
        uiRule: 'rgba(244,246,251,0.10)',
        uiRuleStrong: 'rgba(244,246,251,0.24)',
        uiCanvas: '#f1f0ec',      // warm light grey — content working area
        uiInk: '#0F1B2D',         // navy — action/selected color on the light canvas
        uiInkSoft: '#52504a',
        uiCardRule: '#e3e0d8',    // warm hairline on light cards
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        heading: 'var(--font-heading)',
        // Studio chrome fonts (JDD): IBM Plex Sans body, Cabinet Grotesk display,
        // JetBrains Mono for kickers/labels.
        chrome: ['var(--font-ibm-plex-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-cabinet)', 'var(--font-ibm-plex-sans)', 'sans-serif'],
        chromeMono: ['var(--font-jetbrains-mono)', 'ui-monospace', 'monospace'],
        // Runbook chrome fonts.
        body: ['var(--font-ibm-plex-sans)', 'IBM Plex Sans', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'JetBrains Mono', 'monospace'],
      },
      letterSpacing: {
        tightest: '-0.04em',
        tightish: '-0.02em',
        wideish: '0.08em',
        widest2: '0.14em',
      },
      boxShadow: {
        panel: '0 30px 80px -30px rgba(0,0,0,0.6)',
        glow: '0 12px 40px -10px var(--accent-glow)',
      },
      borderRadius: {
        xl2: '22px',
      },
    },
  },
  plugins: [],
};

export default config;
