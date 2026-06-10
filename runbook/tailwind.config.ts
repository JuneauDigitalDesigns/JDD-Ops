import type { Config } from 'tailwindcss';

// Runbook console — JDD "Aurora Glass / warm editorial" brand tokens bound to the
// CSS variables defined in globals.css. Keeps the internal tool visually cohesive
// with juneaudigitaldesigns.com (deep navy bg + warm parchment accent).
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        panel: 'var(--panel)',
        accent: 'var(--accent)',
        accentInk: 'var(--accent-ink)',
        fg: 'var(--fg)',
        fg2: 'var(--fg-2)',
        fg3: 'var(--fg-3)',
        rule: 'var(--rule)',
        ruleStrong: 'var(--rule-strong)',
        ok: 'var(--ok)',
        warn: 'var(--warn)',
        danger: 'var(--danger)',
      },
      fontFamily: {
        display: ['var(--font-cabinet)', 'Cabinet Grotesk', 'sans-serif'],
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
