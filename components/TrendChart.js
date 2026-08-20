'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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
            <span className="chart-tooltip-key" style={{ color: entry.color }}>{entry.name}</span>
            <span className="chart-tooltip-value">
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
    <div className="trend-chart-section">
      <div className="chart-header">
        <div className="section-title">Arus kas</div>
        <div className="chart-legend">
          <div className="chart-legend-item">
            <span className="legend-indicator legend-indicator--income" />
            <span>Pemasukan</span>
          </div>
          <div className="chart-legend-item">
            <span className="legend-indicator legend-indicator--expense" />
            <span>Pengeluaran</span>
          </div>
        </div>
      </div>
      
      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 10, right: 8, left: -24, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
            <XAxis
              dataKey="month"
              stroke="var(--text-muted)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              dy={8}
            />
            <YAxis
              stroke="var(--text-muted)"
              fontSize={11}
              tickFormatter={(value) => `${value >= 1000000 ? `${(value / 1000000).toFixed(1)}jt` : `${value / 1000}k`}`}
              tickLine={false}
              axisLine={false}
              dx={-6}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: 'var(--border)', strokeWidth: 1, strokeDasharray: '4 4' }}
            />
            <Line
              type="monotone"
              dataKey="income"
              name="Pemasukan"
              stroke="var(--income)"
              strokeWidth={2}
              dot={data.length === 1 ? { r: 3, fill: 'var(--income)' } : false}
              activeDot={{ r: 3, strokeWidth: 0, fill: 'var(--income)' }}
            />
            <Line
              type="monotone"
              dataKey="expense"
              name="Pengeluaran"
              stroke="var(--expense)"
              strokeWidth={2}
              dot={data.length === 1 ? { r: 3, fill: 'var(--expense)' } : false}
              activeDot={{ r: 3, strokeWidth: 0, fill: 'var(--expense)' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
