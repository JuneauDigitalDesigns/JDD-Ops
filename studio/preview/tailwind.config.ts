import type { Config } from 'tailwindcss';

// Brand tokens (bg-accent, text-ink, border-rule, etc.) bind to CSS variables
// set on <body> by layout.tsx from CONTENT.brand. Studio chrome uses plain
// Tailwind utilities (zinc, emerald, white) so it stays independent of brand vars.
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
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        heading: 'var(--font-heading)',
        chrome: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        chromeMono: ['var(--font-geist-mono)', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
