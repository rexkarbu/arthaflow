'use client';

import { useState } from 'react';
import { Target, Plus, Trash2, Trophy } from 'lucide-react';
import { addGoal, deleteGoal } from '@/app/actions';
import { toast } from 'sonner';

function formatRupiah(n) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(n);
}

export default function FinancialGoals({ goals, totalSavings }) {
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [amountError, setAmountError] = useState('');

  async function handleAdd(e) {
    e.preventDefault();
    setLoading(true);
    setAmountError('');

    const form = e.currentTarget;
    const fd = new FormData(form);
    const amount = parseFloat(fd.get('target_amount'));

    if (amount <= 0 || amount > 999_999_999_999) {
      toast.error('Jumlah target tidak valid');
      setLoading(false);
      return;
    }

    try {
      await addGoal(fd);
      form.reset();
      setIsAdding(false);
      toast.success('Target tabungan berhasil ditambahkan!');
    } catch (err) {
      toast.error('Gagal menambahkan target.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Trophy size={18} color="var(--cyan)" />
          Target Tabungan
        </div>
        {!isAdding && (
          <button onClick={() => setIsAdding(true)} style={{ background: 'none', border: 'none', color: 'var(--cyan)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.8rem' }}>
            <Plus size={14} /> Tambah
          </button>
        )}
      </div>

      <div className="card-body">
        {isAdding && (
          <form onSubmit={handleAdd} style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
            <div className="field">
              <input type="text" name="name" className="input" placeholder="Tujuan (cth. Macbook Pro)" required autoFocus />
            </div>
            <div className="field" style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="number" name="target_amount" className="input" placeholder="Jumlah (Rp)" required min="1" style={{ flex: 1 }} />
              <button type="submit" className="btn-submit" disabled={loading} style={{ width: 'auto', padding: '0 1rem', marginTop: 0 }}>
                {loading ? '...' : 'Simpan'}
              </button>
              <button type="button" onClick={() => setIsAdding(false)} className="btn-del" style={{ width: 'auto', padding: '0 1rem', marginTop: 0 }}>
                Batal
              </button>
            </div>
          </form>
        )}

        {goals.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.85rem', padding: '1rem 0' }}>
            Belum ada target tabungan.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {goals.map(goal => {
              const progressPercentage = Math.min(100, Math.max(0, (totalSavings / goal.target_amount) * 100));
              const isAchieved = progressPercentage >= 100;
              const remaining = Math.max(0, goal.target_amount - totalSavings);
              
              return (
                <div key={goal.id} style={{ padding: '1rem', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: isAchieved ? 'var(--success)' : 'var(--text)' }}>
                        {goal.name} {isAchieved && '🎉'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>
                        {formatRupiah(totalSavings)} / {formatRupiah(goal.target_amount)}
                      </div>
                    </div>
                    <form action={async () => {
                      await deleteGoal(goal.id);
                      toast.success('Target dihapus');
                    }}>
                      <button type="submit" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0.2rem', opacity: 0.6 }} title="Hapus target">
                        <Trash2 size={14} />
                      </button>
                    </form>
                  </div>
                  
                  {/* Progress Bar Container */}
                  <div style={{ width: '100%', height: '8px', background: 'var(--bg-hover)', borderRadius: '4px', overflow: 'hidden', marginTop: '0.8rem' }}>
                    <div style={{ 
                      height: '100%', 
                      width: `${progressPercentage}%`, 
                      background: isAchieved ? 'var(--success)' : 'var(--cyan)',
                      transition: 'width 1s cubic-bezier(0.16, 1, 0.3, 1)'
                    }}></div>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.7rem' }}>
                    <span style={{ color: isAchieved ? 'var(--success)' : 'var(--cyan)', fontWeight: 600 }}>
                      {progressPercentage.toFixed(1)}%
                    </span>
                    {!isAchieved && (
                      <span style={{ color: 'var(--text-dim)' }}>
                        Kurang {formatRupiah(remaining)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
