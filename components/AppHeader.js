'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import MonthPicker from './MonthPicker';
import ThemeToggle from './ThemeToggle';
import LogoutButton from './LogoutButton';

export default function AppHeader({ currentMonth }) {
  const pathname = usePathname();
  const monthQuery = currentMonth ? `?month=${currentMonth}` : '';

  const navItems = [
    { href: `/${monthQuery}`, label: 'Overview', isActive: pathname === '/' },
    { href: `/transaksi${monthQuery}`, label: 'Transaksi', isActive: pathname.startsWith('/transaksi') },
    { href: `/analisis${monthQuery}`, label: 'Analisis', isActive: pathname.startsWith('/analisis') },
    { href: `/budget${monthQuery}`, label: 'Budget', isActive: pathname.startsWith('/budget') },
    { href: `/tujuan${monthQuery}`, label: 'Tujuan', isActive: pathname.startsWith('/tujuan') },
  ];

  return (
    <header className="site-header">
      <div className="site-header-left">
        <Link href={currentMonth ? `/?month=${currentMonth}` : '/'} className="site-brand" style={{ textDecoration: 'none' }}>
          <span className="site-title">ArthaFlow<span>.</span></span>
        </Link>
        <nav className="desktop-nav" aria-label="Navigasi Utama">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`nav-link ${item.isActive ? 'nav-link--active' : ''}`}
              aria-current={item.isActive ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="site-header-right">
        <MonthPicker currentMonth={currentMonth} />
        <ThemeToggle />
        <LogoutButton />
      </div>
    </header>
  );
}
