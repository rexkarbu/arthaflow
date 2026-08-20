'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export default function MonthPicker({ currentMonth }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <input
      type="month"
      value={currentMonth}
      onChange={(e) => {
        const params = new URLSearchParams(searchParams ? searchParams.toString() : '');
        if (e.target.value) {
          params.set('month', e.target.value);
        } else {
          params.delete('month');
        }
        const qs = params.toString();
        router.push(qs ? `${pathname}?${qs}` : pathname);
      }}
      className="month-input"
      aria-label="Pilih Bulan"
    />
  );
}
