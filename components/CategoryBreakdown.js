'use client';

import Link from 'next/link';

function formatRupiah(n) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
}

const MAX_CATS = 8;

export default function CategoryBreakdown({ catTotals = {}, totalExpense = 0, endMonth, currentLabel = '' }) {
  let sorted = Object.entries(catTotals)
    .map(([cat, amt]) => ({ cat, amt }))
    .sort((a, b) => b.amt - a.amt);

  let displayRows = sorted;
  let lainnyaAmt = 0;

  if (sorted.length > MAX_CATS) {
    displayRows = sorted.slice(0, MAX_CATS);
    lainnyaAmt = sorted.slice(MAX_CATS).reduce((s, r) => s + r.amt, 0);
    if (lainnyaAmt > 0) displayRows.push({ cat: 'Lainnya (gabungan)', amt: lainnyaAmt });
  }

  const monthQuery = endMonth ? `?month=${endMonth}` : '';

  if (displayRows.length === 0) {
    return (
      <div className="analisis-section">
        <div className="analisis-section-title">Pengeluaran berdasarkan kategori</div>
        <div className="analisis-empty-chart">Belum ada pengeluaran di periode ini.</div>
      </div>
    );
  }

  return (
    <div className="analisis-section">
      <div className="analisis-section-header">
        <div className="analisis-section-title">Pengeluaran berdasarkan kategori</div>
        <div className="analisis-section-subtitle">{currentLabel}</div>
      </div>
      <div className="analisis-cat-list" role="list">
        {displayRows.map(({ cat, amt }) => {
          const pct = totalExpense > 0 ? Math.round((amt / totalExpense) * 100) : 0;
          const isOther = cat === 'Lainnya (gabungan)';
          return (
            <div key={cat} className="analisis-cat-row" role="listitem">
              <div className="analisis-cat-row-top">
                <span className="analisis-cat-name">{cat}</span>
                <div className="analisis-cat-row-right">
                  <span className="analisis-cat-amount">{formatRupiah(amt)}</span>
                  <span className="analisis-cat-pct">{pct}%</span>
                  {!isOther && (
                    <Link href={`/transaksi${monthQuery}`} className="analisis-cat-link">
                      Lihat txn →
                    </Link>
                  )}
                </div>
              </div>
              <div className="analisis-cat-bar-track">
                <div className="analisis-cat-bar-fill" style={{ width: `${Math.max(pct, 1)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
