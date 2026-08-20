'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function fmt(n) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(abs / 1_000_000).toFixed(1)}jt`;
  if (abs >= 1_000) return `${Math.round(abs / 1_000)}rb`;
  return String(n);
}

function formatRupiah(n) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
}

const IncExpTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{label}</div>
      {payload.map((entry, i) => (
        <div key={i} className="chart-tooltip-row">
          <span className="chart-tooltip-key" style={{ color: entry.color }}>{entry.name}</span>
          <span className="chart-tooltip-value">{formatRupiah(entry.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function IncomeExpenseChart({ monthlySeries = [] }) {
  if (monthlySeries.length === 0) {
    return (
      <div className="analisis-section">
        <div className="analisis-section-title">Pemasukan vs Pengeluaran</div>
        <div className="analisis-empty-chart">Belum ada data di periode ini.</div>
      </div>
    );
  }

  return (
    <div className="analisis-section">
      <div className="analisis-section-header">
        <div className="analisis-section-title">Pemasukan vs Pengeluaran</div>
        <div className="analisis-legend-inline">
          <span className="analisis-legend-dot analisis-legend-dot--income" />
          <span className="analisis-legend-text">Pemasukan</span>
          <span className="analisis-legend-dot analisis-legend-dot--expense" />
          <span className="analisis-legend-text">Pengeluaran</span>
        </div>
      </div>
      <div className="analisis-chart-area analisis-chart-area--secondary">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={monthlySeries} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} barGap={2} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
            <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} dy={8} />
            <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={fmt} tickLine={false} axisLine={false} dx={-4} />
            <Tooltip content={<IncExpTooltip />} cursor={{ fill: 'var(--border-subtle)', opacity: 0.5 }} />
            <Bar dataKey="income" name="Pemasukan" fill="var(--income)" radius={[2, 2, 0, 0]} maxBarSize={28} />
            <Bar dataKey="expense" name="Pengeluaran" fill="var(--expense)" radius={[2, 2, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
