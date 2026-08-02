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
      <div style={{ 
        background: 'rgba(10, 10, 10, 0.85)', 
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.1)', 
        padding: '0.875rem 1rem', 
        borderRadius: '8px', 
        fontSize: '0.8rem',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        color: '#fff'
      }}>
        <div style={{ fontWeight: 600, marginBottom: '0.6rem', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.7rem' }}>{label}</div>
        {payload.map((entry, index) => (
          <div key={index} style={{ color: entry.color, marginBottom: index === payload.length - 1 ? 0 : '0.3rem', display: 'flex', justifyContent: 'space-between', gap: '1.5rem' }}>
            <span>{entry.name}</span> 
            <span style={{ fontWeight: 600, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{formatRupiah(entry.value)}</span>
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
