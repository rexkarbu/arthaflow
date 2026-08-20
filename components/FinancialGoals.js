'use client';

import { useState } from 'react';
import Link from 'next/link';
import { X, Plus } from 'lucide-react';
import { addGoal, deleteGoal } from '@/app/actions';
import { toast } from 'sonner';

function formatRupiah(n) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(n);
}

export default function FinancialGoals({ goals = [], totalSavings = 0, mode = 'preview', currentMonth = '' }) {
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);

  const isPreview = mode === 'preview';
  const monthQuery = currentMonth ? `?month=${currentMonth}` : '';
  const visibleGoals = isPreview ? goals.slice(0, 2) : goals;

  async function handleAdd(e) {
    e.preventDefault();
    setLoading(true);

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

  return (
    <div className="goals-section">
      {/* Overview Preview Header: Section title + Kelola tujuan → */}
      {isPreview && (
        <div className="goals-header">
          <div className="section-title">Tujuan</div>
          <Link href={`/tujuan${monthQuery}`} className="txn-view-all-link">
            Kelola tujuan →
          </Link>
        </div>
      )}

      {/* Full Mode Header: '+ Tambah tujuan' button */}
      {!isPreview && !isAdding && goals.length > 0 && (
        <div className="goals-full-top">
          <button onClick={() => setIsAdding(true)} className="goals-add-btn">
            <Plus size={13} /> Tambah tujuan
          </button>
        </div>
      )}

      {/* Add Goal Form (Full Mode) */}
      {!isPreview && isAdding && (
        <form onSubmit={handleAdd} className="goal-form">
          <div className="field">
            <input
              type="text"
              name="name"
              className="input"
              placeholder="Nama tujuan (cth. Dana darurat, Liburan)"
              required
              autoFocus
            />
          </div>
          <div className="goal-form-row">
            <input
              type="number"
              name="target_amount"
              className="input"
              placeholder="Target dana (Rp)"
              required
              min="1"
            />
            <button type="submit" className="btn-submit btn-submit--sm" disabled={loading}>
              {loading ? '...' : 'Simpan'}
            </button>
            <button type="button" onClick={() => setIsAdding(false)} className="btn-cancel btn-cancel--sm">
              Batal
            </button>
          </div>
        </form>
      )}

      {/* Empty State */}
      {goals.length === 0 ? (
        <div className="goal-inline-empty">
          <span className="goal-empty-text">Belum ada target tabungan.</span>
          {!isPreview && !isAdding && (
            <button onClick={() => setIsAdding(true)} className="goal-create-btn">
              <Plus size={12} /> Tambah tujuan
            </button>
          )}
        </div>
      ) : (
        <div className="goal-list">
          {visibleGoals.map(goal => {
            const progressPercentage = Math.min(100, Math.max(0, (totalSavings / goal.target_amount) * 100));
            const isAchieved = progressPercentage >= 100;
            const remaining = Math.max(0, goal.target_amount - totalSavings);
            
            return (
              <div key={goal.id} className="goal-item">
                <div className="goal-top">
                  <span className={`goal-name ${isAchieved ? 'goal-name--achieved' : ''}`}>
                    {goal.name}
                  </span>
                  {/* Delete button only rendered in full mode on /tujuan */}
                  {!isPreview && (
                    <form action={async () => {
                      await deleteGoal(goal.id);
                      toast.success('Target dihapus');
                    }}>
                      <button
                        type="submit"
                        className="goal-delete-btn"
                        title={`Hapus target ${goal.name}`}
                        aria-label={`Hapus target ${goal.name}`}
                      >
                        <X size={13} />
                      </button>
                    </form>
                  )}
                </div>
                
                <div className="goal-amounts">
                  <span>{formatRupiah(totalSavings)}</span>
                  <span className="goal-amount-sep">/</span>
                  <span>{formatRupiah(goal.target_amount)}</span>
                </div>

                <div className="goal-track">
                  <div 
                    className={`goal-fill ${isAchieved ? 'goal-fill--achieved' : ''}`}
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
                
                <div className="goal-meta">
                  {isAchieved ? (
                    <span className="goal-status-achieved">Target tercapai</span>
                  ) : (
                    <span className="goal-remaining">Sisa {formatRupiah(remaining)}</span>
                  )}
                  <span className={`goal-pct ${isAchieved ? 'goal-pct--achieved' : ''}`}>
                    {progressPercentage.toFixed(0)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
