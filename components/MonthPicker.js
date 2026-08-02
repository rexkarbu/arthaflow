'use client';

import { useRouter } from 'next/navigation';

export default function MonthPicker({ currentMonth }) {
  const router = useRouter();

  return (
    <input
      type="month"
      value={currentMonth}
      onChange={(e) => {
        if (e.target.value) {
          router.push(`/?month=${e.target.value}`);
        } else {
          router.push('/');
        }
      }}
      style={{
        padding: '0.3rem 0.6rem',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        color: 'var(--text)',
        fontFamily: 'Outfit, sans-serif',
        fontSize: '0.8rem',
        borderRadius: '4px',
        cursor: 'pointer',
        outline: 'none',
        marginLeft: '1rem',
        minWidth: '140px',
        flexShrink: 0,
      }}
    />
  );
}
