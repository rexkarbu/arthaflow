'use client';

import { LogOut } from 'lucide-react';
import { logout } from '@/app/actions';

export default function LogoutButton() {
  return (
    <button
      onClick={() => logout()}
      title="Keluar"
      style={{
        background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)',
        padding: '0.4rem 0.5rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', marginLeft: '0.5rem'
      }}
      onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--danger)'; e.currentTarget.style.color = 'var(--danger)' }}
      onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)' }}
    >
      <LogOut size={14} />
    </button>
  );
}
