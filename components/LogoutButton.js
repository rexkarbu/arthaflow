'use client';

import { LogOut } from 'lucide-react';
import { logout } from '@/app/actions';

export default function LogoutButton() {
  return (
    <button
      onClick={() => logout()}
      title="Keluar"
      aria-label="Keluar"
      className="header-control header-control--danger"
    >
      <LogOut size={15} />
    </button>
  );
}
