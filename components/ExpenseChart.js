'use client';

import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const COLORS = {
  'Makanan': 'var(--cat-1)',
  'Transportasi': 'var(--cat-2)',
  'Hiburan': 'var(--cat-3)',
  'Belanja': 'var(--cat-4)',
  'Lainnya': 'var(--cat-5)'
};

function formatRupiah(n) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(n);
}

const CustomTooltip = ({ active, payload }) => {
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
        {payload.map((entry, index) => (
          <div key={index} style={{ color: entry.color, display: 'flex', justifyContent: 'space-between', gap: '1.5rem', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: entry.color, display: 'inline-block' }}></span>
              {entry.name}
            </span> 
            <span style={{ fontWeight: 600, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{formatRupiah(entry.value)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function ExpenseChart({ expenses }) {
  const data = useMemo(() => {
    const onlyExpenses = expenses.filter(e => e.type !== 'income');
    const byCategory = onlyExpenses.reduce((acc, e) => {
      const c = e.category || 'Lainnya';
      acc[c] = (acc[c] || 0) + e.amount;
      return acc;
    }, {});
    
    return Object.entries(byCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  if (data.length === 0) return null;

  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <div className="card-head">Persebaran Pengeluaran</div>
      <div className="card-body" style={{ height: '240px', padding: '1rem 0 0' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
              stroke="var(--bg-card)"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[entry.name] || COLORS.Lainnya} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend 
               wrapperStyle={{ fontSize: '0.75rem' }} 
               iconType="circle"
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
