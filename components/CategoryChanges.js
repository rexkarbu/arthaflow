'use client';

function formatRupiah(n) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
}

function pctLabel(curr, prev) {
  if (prev === 0 && curr === 0) return { text: '\u2014', cls: 'change-neutral' };
  if (prev === 0 && curr > 0) return { text: 'Baru di periode ini', cls: 'change-neutral' };
  if (curr === 0 && prev > 0) return { text: 'Tidak ada pengeluaran', cls: 'change-neutral' };
  const pct = Math.round(((curr - prev) / prev) * 100);
  return {
    text: pct >= 0 ? `+${pct}%` : `${pct}%`,
    cls: pct > 0 ? 'change-expense' : 'change-income',
  };
}

function absLabel(curr, prev) {
  const abs = curr - prev;
  if (abs === 0) return { text: '\u2014', cls: 'change-neutral' };
  const formatted = formatRupiah(Math.abs(abs));
  return {
    text: abs > 0 ? `+${formatted}` : `-${formatted}`,
    cls: abs > 0 ? 'change-expense' : 'change-income',
  };
}

export default function CategoryChanges({ categoryChanges = [], period = 6 }) {
  if (categoryChanges.length === 0) return null;

  return (
    <div className="analisis-section analisis-section--last">
      <div className="analisis-section-header">
        <div className="analisis-section-title">Perubahan kategori</div>
        <div className="analisis-section-subtitle">dibanding {period} bulan sebelumnya</div>
      </div>
      <div className="analisis-change-list" role="list">
        {categoryChanges.map(({ category, current, previous, absoluteChange }) => {
          const absl = absLabel(current, previous);
          const pctl = pctLabel(current, previous);
          return (
            <div key={category} className="analisis-change-row" role="listitem">
              <span className="analisis-change-cat">{category}</span>
              <div className="analisis-change-values">
                <span className="analisis-change-current">{formatRupiah(current)}</span>
                <span className={`analisis-change-abs ${absl.cls}`}>{absl.text}</span>
                <span className={`analisis-change-pct ${pctl.cls}`}>{pctl.text}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
