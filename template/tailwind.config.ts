import type { Config } from 'tailwindcss';

// Colors + fonts are bound to CSS variables that `app/layout.tsx` sets on <body>
// from CONTENT.brand.palette / .typography. Components use portable tokens like
// `bg-accent`, `text-ink`, `border-rule` and never hardcode hex.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: 'var(--accent)',
        accentFg: 'var(--accent-fg)',
        bg: 'var(--bg)',
        bgSoft: 'var(--bg-soft)',
        ink: 'var(--ink)',
        inkSoft: 'var(--ink-soft)',
        rule: 'var(--rule)',
        // Derived brand tones (runtime, from palette.ts) — richer editorial palette
        // + on-brand dark "contrast" skin.
        accentStrong: 'var(--accent-strong)',
        accent050: 'var(--accent-050)',
        accent100: 'var(--accent-100)',
        accent200: 'var(--accent-200)',
        inkPanel: 'var(--ink-panel)',
        inkPanel2: 'var(--ink-panel-2)',
        onInk: 'var(--on-ink)',
        onInkSoft: 'var(--on-ink-soft)',
        ruleInk: 'var(--rule-ink)',
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        heading: 'var(--font-heading)',
      },
      backgroundImage: {
        'accent-grad': 'var(--accent-grad)',
      },
    },
  },
  plugins: [],
};

export default config;
