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
        // Availability / emergency cues only ("24/7", "same-day"). A fixed alert red,
        // AA-adjusted per client background — see urgentTone() in lib/palette.ts.
        urgent: 'var(--urgent)',
      },
      // `text-accent` resolves to the ACCESSIBLE accent; every other utility keeps the raw
      // brand color. Tailwind consults `theme.textColor` before falling back to
      // `theme.colors`, so this remaps the text utility only — `bg-accent` and
      // `border-accent` still paint the authored hex, which is what the client picked it for.
      //
      // Measured 2026-08-18: accent-as-text was one of three color-contrast failures holding
      // Lighthouse Accessibility at 96 (#e08b29 on #ffffff = 2.66:1; AA needs 4.5). There are
      // ~159 `text-accent` call sites across the catalog — fixing it here fixes all of them,
      // hover states included, without editing a single component.
      // The `var(--accent)` fallback keeps this safe if a component ever renders outside the
      // <body> that carries paletteVars() — it degrades to the authored brand color rather
      // than to an undefined var. Mirrors the console's twin, which needs it load-bearingly.
      textColor: {
        accent: 'var(--accent-text, var(--accent))',
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
