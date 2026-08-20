'use client';

import { useState } from 'react';
import { X, Plus } from 'lucide-react';
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
  const [expanded, setExpanded] = useState(false);

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
      toast.success('Target tabungan berhasil ditambahkan');
    } catch (err) {
      toast.error('Gagal menambahkan target.');
    } finally {
      setLoading(false);
    }
  }

  const visibleGoals = expanded ? goals : goals.slice(0, 2);
  const hiddenCount = goals.length - 2;

  return (
    <div className="goals-section">
      <div className="goals-header">
        <div className="section-title" style={{ marginBottom: 0 }}>Tujuan</div>
        {!isAdding && (
          <button onClick={() => setIsAdding(true)} className="goals-add-btn">
            <Plus size={14} /> Tambah
          </button>
        )}
      </div>

      {isAdding && (
        <form onSubmit={handleAdd} className="goal-form">
          <div className="field">
            <input type="text" name="name" className="input" placeholder="Tujuan (cth. Dana Darurat)" required autoFocus />
          </div>
          <div className="field" style={{ display: 'flex', gap: '0.5rem' }}>
            <input type="number" name="target_amount" className="input" placeholder="Jumlah (Rp)" required min="1" style={{ flex: 1 }} />
            <button type="submit" className="btn-submit" disabled={loading} style={{ width: 'auto', padding: '0 1rem' }}>
              {loading ? '...' : 'Simpan'}
            </button>
            <button type="button" onClick={() => setIsAdding(false)} className="btn-cancel" style={{ width: 'auto', padding: '0 1rem' }}>
              Batal
            </button>
          </div>
        </form>
      )}

      {goals.length === 0 ? (
        <div className="goal-empty">
          Belum ada target tabungan.
        </div>
      ) : (
        <div>
          {visibleGoals.map(goal => {
            const progressPercentage = Math.min(100, Math.max(0, (totalSavings / goal.target_amount) * 100));
            const isAchieved = progressPercentage >= 100;
            const remaining = Math.max(0, goal.target_amount - totalSavings);
            
            return (
              <div key={goal.id} className="goal-item">
                <div className="goal-top">
                  <div>
                    <div className={`goal-name ${isAchieved ? 'goal-name--achieved' : ''}`}>
                      {goal.name}
                    </div>
                  </div>
                  <form action={async () => {
                    await deleteGoal(goal.id);
                    toast.success('Target dihapus');
                  }}>
                    <button type="submit" className="goal-delete-btn" title="Hapus target">
                      <X size={14} />
                    </button>
                  </form>
                </div>
                
                <div className="goal-amounts">
                  {formatRupiah(totalSavings)} / {formatRupiah(goal.target_amount)}
                </div>

                <div className="goal-track">
                  <div 
                    className={`goal-fill ${isAchieved ? 'goal-fill--achieved' : ''}`}
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
                
                <div className="goal-meta">
                  <span className={`goal-pct ${isAchieved ? 'goal-pct--achieved' : ''}`}>
                    {progressPercentage.toFixed(1)}%
                  </span>
                  {!isAchieved && (
                    <span className="goal-remaining">
                      Sisa {formatRupiah(remaining)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          
          {!expanded && hiddenCount > 0 && (
            <button 
              type="button" 
              onClick={() => setExpanded(true)}
              style={{
                background: 'none', border: 'none', color: 'var(--text-muted)', 
                fontSize: '0.8rem', cursor: 'pointer', padding: '0.5rem 0', width: '100%',
                textAlign: 'left', marginTop: '0.5rem', fontFamily: 'inherit'
              }}
            >
              Lihat {hiddenCount} lainnya...
            </button>
          )}
        </div>
      )}
    </div>
  );
}
