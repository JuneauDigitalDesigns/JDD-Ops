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
        bg: 'var(--bg)',
        bgSoft: 'var(--bg-soft)',
        ink: 'var(--ink)',
        inkSoft: 'var(--ink-soft)',
        rule: 'var(--rule)',
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        heading: 'var(--font-heading)',
      },
    },
  },
  plugins: [],
};

export default config;
