'use client';

import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch: only render icon after mounted client-side
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div style={{ width: '32px', height: '28px' }} />;

  const isDark = theme === 'dark';

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title={isDark ? 'Mode Terang' : 'Mode Gelap'}
      style={{
        background: 'transparent',
        border: '1px solid var(--border)',
        color: 'var(--text-dim)',
        padding: '0.3rem 0.45rem',
        borderRadius: '4px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        marginLeft: '0.5rem',
        transition: 'border-color 0.2s, color 0.2s',
      }}
      onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--cyan)'; e.currentTarget.style.color = 'var(--cyan)'; }}
      onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)'; }}
    >
      {isDark ? <Sun size={14} /> : <Moon size={14} />}
    </button>
  );
}
