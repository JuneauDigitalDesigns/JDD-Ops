'use client';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from '@phosphor-icons/react';

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = resolvedTheme === 'dark';
  return (
    <button
      type="button"
      aria-label="Toggle light/dark theme"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border transition-colors hover:text-[var(--accent-2)]"
      style={{ borderColor: 'var(--rule-strong)', color: 'var(--fg-2)' }}
    >
      {mounted ? (isDark ? <Sun size={16} /> : <Moon size={16} />) : <span style={{ width: 16, height: 16 }} />}
    </button>
  );
}
