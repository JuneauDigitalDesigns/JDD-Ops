// Curated industry font registry (client-safe: no next/font import here so it can be used in
// the Brand drawer dropdowns). Each `stack` references a CSS variable that both the console
// and template layouts define via next/font (see fonts.loader.ts). The Brand drawer writes
// the full `stack` string into brand.typography.fontHeading / fontSans, so it flows through
// typographyVars → --font-heading / --font-sans and resolves on any page that loads the vars.

export interface FontOption {
  id: string;
  label: string;
  varName: string;
  stack: string;
  role: 'sans' | 'heading' | 'both';
}

export const FONT_OPTIONS: FontOption[] = [
  { id: 'inter',      label: 'Inter',             varName: '--font-inter',    stack: 'var(--font-inter), system-ui, sans-serif',    role: 'both' },
  { id: 'manrope',    label: 'Manrope',           varName: '--font-manrope',  stack: 'var(--font-manrope), system-ui, sans-serif',  role: 'both' },
  { id: 'poppins',    label: 'Poppins',           varName: '--font-poppins',  stack: 'var(--font-poppins), system-ui, sans-serif',  role: 'heading' },
  { id: 'sora',       label: 'Sora',              varName: '--font-sora',     stack: 'var(--font-sora), system-ui, sans-serif',     role: 'heading' },
  { id: 'worksans',   label: 'Work Sans',         varName: '--font-worksans', stack: 'var(--font-worksans), system-ui, sans-serif', role: 'both' },
  { id: 'jakarta',    label: 'Plus Jakarta Sans', varName: '--font-jakarta',  stack: 'var(--font-jakarta), system-ui, sans-serif',  role: 'both' },
  { id: 'robotoslab', label: 'Roboto Slab',       varName: '--font-slab',     stack: 'var(--font-slab), Georgia, serif',            role: 'heading' },
  { id: 'playfair',   label: 'Playfair Display',  varName: '--font-playfair', stack: 'var(--font-playfair), Georgia, serif',        role: 'heading' },
];
