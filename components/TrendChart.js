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

export default function TrendChart({ data = [], periodLabel = '', hideHeader = false }) {
  // Empty state: no data at all
  if (!data || data.length === 0) {
    return (
      <div className="trend-chart-section">
        {!hideHeader && (
          <div className="chart-header">
            <div className="section-title">Arus kas</div>
          </div>
        )}
        <div className="trend-empty">
          Belum ada data arus kas.
        </div>
      </div>
    );
  }

  // Single month state: compact comparison summary with derived spending ratio (no duplicate balance)
  if (data.length === 1) {
    const item = data[0];
    const monthIncome = item.income || 0;
    const monthExpense = item.expense || 0;
    const maxVal = Math.max(monthIncome, monthExpense, 1);
    const incomeBarPct = Math.round((monthIncome / maxVal) * 100);
    const expenseBarPct = Math.round((monthExpense / maxVal) * 100);

    let ratioText = '';
    if (monthIncome > 0) {
      const ratioPct = Math.round((monthExpense / monthIncome) * 100);
      ratioText = `${ratioPct}% dari pemasukan`;
    } else if (monthExpense > 0) {
      ratioText = 'Belum ada pemasukan periode ini';
    } else {
      ratioText = 'Belum ada transaksi';
    }

    return (
      <div className="trend-chart-section trend-chart-section--compact">
        {!hideHeader && (
          <div className="chart-header">
            <div className="section-title">Arus kas</div>
            <span className="chart-period-text">{periodLabel || item.month}</span>
          </div>
        )}
        <div className="trend-single-container">
          <div className="trend-single-row">
            <div className="trend-single-meta">
              <span className="trend-single-label">Pemasukan</span>
              <span className="trend-single-val trend-single-val--income">+{formatRupiah(monthIncome)}</span>
            </div>
            <div className="cat-bar-track">
              <div className="cat-bar-fill cat-bar-fill--income" style={{ width: `${Math.max(incomeBarPct, 2)}%` }} />
            </div>
          </div>

          <div className="trend-single-row">
            <div className="trend-single-meta">
              <span className="trend-single-label">Pengeluaran</span>
              <span className="trend-single-val trend-single-val--expense">-{formatRupiah(monthExpense)}</span>
            </div>
            <div className="cat-bar-track">
              <div className="cat-bar-fill cat-bar-fill--muted" style={{ width: `${Math.max(expenseBarPct, 2)}%` }} />
            </div>
          </div>

          <div className="trend-single-footer">
            <span className="trend-single-label">Rasio pengeluaran</span>
            <span className="trend-single-ratio">{ratioText}</span>
          </div>
        </div>
      </div>
    );
  }

  // 2+ months state: Restrained LineChart
  return (
    <div className="trend-chart-section">
      {!hideHeader && (
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
      )}
      
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
              dot={false}
              activeDot={{ r: 3.5, strokeWidth: 0, fill: 'var(--income)' }}
            />
            <Line
              type="monotone"
              dataKey="expense"
              name="Pengeluaran"
              stroke="var(--expense)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3.5, strokeWidth: 0, fill: 'var(--expense)' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
