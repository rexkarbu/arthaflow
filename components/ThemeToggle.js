'use client';

import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return <button className="header-control" style={{ width: '32px', height: '32px' }} aria-hidden="true" />;

  return (
    <button
      className="header-control"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      title="Ubah Tema"
      aria-label="Ubah Tema"
    >
      {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
