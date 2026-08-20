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
      className="month-input"
      aria-label="Pilih Bulan"
    />
  );
}
