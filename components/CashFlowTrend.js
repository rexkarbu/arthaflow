'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

function fmt(n) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? '-' : ''}${(abs / 1_000_000).toFixed(1)}jt`;
  if (abs >= 1_000) return `${n < 0 ? '-' : ''}${Math.round(abs / 1_000)}rb`;
  return String(n);
}

function formatRupiah(n) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
}

const NetTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0]?.payload || {};
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{label}</div>
      <div className="chart-tooltip-row">
        <span className="chart-tooltip-key">Pemasukan</span>
        <span className="chart-tooltip-value">{formatRupiah(d.income || 0)}</span>
      </div>
      <div className="chart-tooltip-row">
        <span className="chart-tooltip-key">Pengeluaran</span>
        <span className="chart-tooltip-value">{formatRupiah(d.expense || 0)}</span>
      </div>
      <div className="chart-tooltip-row chart-tooltip-row--net">
        <span className="chart-tooltip-key">Net</span>
        <span className="chart-tooltip-value">{formatRupiah(d.net || 0)}</span>
      </div>
    </div>
  );
};

export default function CashFlowTrend({ monthlySeries = [] }) {
  if (monthlySeries.length === 0) {
    return (
      <div className="analisis-section">
        <div className="analisis-section-title">Arus kas</div>
        <div className="analisis-empty-chart">Belum ada data arus kas di periode ini.</div>
      </div>
    );
  }

  return (
    <div className="analisis-section">
      <div className="analisis-section-header">
        <div className="analisis-section-title">Arus kas</div>
        <div className="analisis-section-subtitle">Net cash flow per bulan</div>
      </div>
      <div className="analisis-chart-area analisis-chart-area--primary">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={monthlySeries} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
            <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1} />
            <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} dy={8} />
            <YAxis
              stroke="var(--text-muted)"
              fontSize={11}
              tickFormatter={fmt}
              tickLine={false}
              axisLine={false}
              dx={-4}
            />
            <Tooltip content={<NetTooltip />} cursor={{ stroke: 'var(--border)', strokeWidth: 1, strokeDasharray: '4 4' }} />
            <Line
              type="monotone"
              dataKey="net"
              name="Net"
              stroke="var(--brand-muted)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3.5, strokeWidth: 0, fill: 'var(--brand-muted)' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
