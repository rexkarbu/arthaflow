'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function formatRupiah(n) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(n);
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '0.8rem', borderRadius: '8px', fontSize: '0.85rem' }}>
        <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text)' }}>{label}</div>
        {payload.map((entry, index) => (
          <div key={index} style={{ color: entry.color, marginBottom: '0.2rem' }}>
            {entry.name}: {formatRupiah(entry.value)}
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
    <div className="card">
      <div className="card-head">Trend Bulanan</div>
      <div className="card-body" style={{ height: '300px', padding: '1rem 0' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="month" stroke="var(--text-dim)" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--text-dim)" fontSize={12} tickFormatter={(value) => `${value / 1000}k`} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg)', opacity: 0.5 }} />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
            <Bar dataKey="income" name="Pemasukan" fill="#28a745" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expense" name="Pengeluaran" fill="var(--danger)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
