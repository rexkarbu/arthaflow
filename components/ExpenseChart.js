'use client';

import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const COLORS = {
  'Makanan': '#e07840',
  'Transportasi': '#4098c8',
  'Hiburan': '#9058d0',
  'Belanja': '#c8a030',
  'Lainnya': '#507890'
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
            <Tooltip 
              formatter={(value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value)}
              contentStyle={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem' }}
              itemStyle={{ color: 'var(--text)' }}
            />
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
