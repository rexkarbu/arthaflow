'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ReceiptText, PieChart, Target } from 'lucide-react';

export default function MobileBottomNav({ currentMonth }) {
  const pathname = usePathname();
  const monthQuery = currentMonth ? `?month=${currentMonth}` : '';

  const navItems = [
    { href: `/${monthQuery}`, label: 'Overview', icon: LayoutDashboard, isActive: pathname === '/' },
    { href: `/transaksi${monthQuery}`, label: 'Transaksi', icon: ReceiptText, isActive: pathname.startsWith('/transaksi') },
    { href: `/budget${monthQuery}`, label: 'Budget', icon: PieChart, isActive: pathname.startsWith('/budget') },
    { href: `/tujuan${monthQuery}`, label: 'Tujuan', icon: Target, isActive: pathname.startsWith('/tujuan') },
  ];

  return (
    <nav className="mobile-bottom-nav" aria-label="Navigasi Mobile">
      <div className="mobile-bottom-nav-inner">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`mobile-nav-item ${item.isActive ? 'mobile-nav-item--active' : ''}`}
              aria-current={item.isActive ? 'page' : undefined}
            >
              <Icon size={18} className="mobile-nav-icon" />
              <span className="mobile-nav-label">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
