'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function formatRupiah(n) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(n);
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="chart-tooltip">
        <div className="chart-tooltip-label">{label}</div>
        {payload.map((entry, index) => (
          <div key={index} className="chart-tooltip-row">
            <span style={{ color: entry.color }}>{entry.name}</span>
            <span className="chart-tooltip-value" style={{ color: 'var(--text)' }}>
              {formatRupiah(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function TrendChart({ data }) {
  if (!data || data.length === 0) return null;

  return (
    <div className="chart-section">
      <div className="section-title">Arus kas</div>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
            <XAxis
              dataKey="month"
              stroke="var(--text-muted)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              dy={10}
            />
            <YAxis
              stroke="var(--text-muted)"
              fontSize={12}
              tickFormatter={(value) => `${value / 1000}k`}
              tickLine={false}
              axisLine={false}
              dx={-10}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: 'var(--surface-hover)', opacity: 1 }}
            />
            {/* Legend removed for a cleaner look, colors are intuitive (green=income, red=expense) */}
            <Bar dataKey="income" name="Pemasukan" fill="var(--income)" radius={[4, 4, 0, 0]} maxBarSize={40} />
            <Bar dataKey="expense" name="Pengeluaran" fill="var(--expense)" radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
