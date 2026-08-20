'use client';

import { useState } from 'react';
import Link from 'next/link';
import { X, Plus, PlusCircle, MinusCircle } from 'lucide-react';
import { addGoal, deleteGoal } from '@/app/actions';
import { toast } from 'sonner';
import CurrencyInput from './CurrencyInput';
import GoalFundDialog from './GoalFundDialog';
import ConfirmDialog from './ConfirmDialog';
import { formatRupiah, parseCurrency } from '@/lib/currency';

export default function FinancialGoals({ goals = [], mode = 'preview', currentMonth = '' }) {
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeFundGoal, setActiveFundGoal] = useState(null);
  const [fundDialogMode, setFundDialogMode] = useState('add');
  const [deletingGoal, setDeletingGoal] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isPreview = mode === 'preview';
  const monthQuery = currentMonth ? `?month=${currentMonth}` : '';
  const visibleGoals = isPreview ? goals.slice(0, 2) : goals;

  // Aggregate total saved across all independent goals
  const totalAllocated = goals.reduce((sum, g) => sum + (Number(g.saved_amount) || 0), 0);

  async function handleAdd(e) {
    e.preventDefault();
    setLoading(true);

    const form = e.currentTarget;
    const fd = new FormData(form);
    const name = fd.get('name')?.trim();
    const amount = parseCurrency(fd.get('target_amount'));

    if (!name) {
      toast.error('Nama tujuan tabungan tidak boleh kosong');
      setLoading(false);
      return;
    }

    if (amount <= 0 || amount > 999_999_999_999) {
      toast.error('Jumlah target harus antara Rp 1 - Rp 999.999.999.999');
      setLoading(false);
      return;
    }

    try {
      await addGoal(fd);
      form.reset();
      setIsAdding(false);
      toast.success('Target tabungan berhasil ditambahkan');
    } catch (err) {
      toast.error(err?.message || 'Gagal menambahkan target.');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deletingGoal) return;
    setIsDeleting(true);

    try {
      await deleteGoal(deletingGoal.id);
      toast.success(`Target "${deletingGoal.name}" berhasil dihapus`);
      setDeletingGoal(null);
    } catch (err) {
      toast.error(err?.message || 'Gagal menghapus target.');
    } finally {
      setIsDeleting(false);
    }
  }

  function openFundDialog(goal, mode) {
    setActiveFundGoal(goal);
    setFundDialogMode(mode);
  }

  function closeFundDialog() {
    setActiveFundGoal(null);
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

      {/* Full Mode Header & Summary */}
      {!isPreview && (
        <div className="goals-full-header-container">
          <div className="goals-summary-strip">
            <span className="goals-summary-count">{goals.length} tujuan</span>
            <span className="goals-summary-dot" aria-hidden="true">&middot;</span>
            <span className="goals-summary-total">
              {formatRupiah(totalAllocated)} tersimpan di semua tujuan
            </span>
          </div>
          {!isAdding && goals.length > 0 && (
            <button
              onClick={() => setIsAdding(true)}
              className="goals-add-btn"
              type="button"
            >
              <Plus size={13} /> Tambah tujuan
            </button>
          )}
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
              placeholder="Nama tujuan (cth. Dana darurat, Liburan, Laptop)"
              required
              autoFocus
            />
          </div>
          <div className="goal-form-row">
            <CurrencyInput
              name="target_amount"
              className="input"
              placeholder="Target dana (Rp)"
              required
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
            <button onClick={() => setIsAdding(true)} className="goal-create-btn" type="button">
              <Plus size={12} /> Tambah tujuan
            </button>
          )}
        </div>
      ) : (
        <div className="goal-list" role="list">
          {visibleGoals.map(goal => {
            const saved = Number(goal.saved_amount) || 0;
            const target = Number(goal.target_amount) || 1;
            const percentage = Math.round((saved / target) * 100);
            const visualPercentage = Math.min(100, Math.max(0, percentage));
            const isAchieved = saved >= target;
            const isOverfunded = saved > target;
            const remaining = Math.max(0, target - saved);
            const overAmount = saved - target;

            return (
              <div key={goal.id} className="goal-item" role="listitem">
                <div className="goal-top">
                  <span className={`goal-name ${isAchieved ? 'goal-name--achieved' : ''}`}>
                    {goal.name}
                  </span>
                  {/* Delete button only in full mode on /tujuan */}
                  {!isPreview && (
                    <button
                      type="button"
                      onClick={() => setDeletingGoal(goal)}
                      className="goal-delete-btn"
                      title={`Hapus target ${goal.name}`}
                      aria-label={`Hapus target ${goal.name}`}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                <div className="goal-amounts">
                  <span>{formatRupiah(saved)}</span>
                  <span className="goal-amount-sep">dari</span>
                  <span>{formatRupiah(target)}</span>
                </div>

                <div
                  className="goal-track"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={target}
                  aria-valuenow={saved}
                  aria-label={`Progres ${goal.name}`}
                >
                  <div
                    className={`goal-fill ${isAchieved ? 'goal-fill--achieved' : ''}`}
                    style={{ width: `${visualPercentage}%` }}
                  />
                </div>

                <div className="goal-meta">
                  {saved === 0 ? (
                    <span className="goal-remaining goal-remaining--zero">Belum ada dana dialokasikan</span>
                  ) : isOverfunded ? (
                    <span className="goal-status-achieved">
                      Target tercapai &middot; Lebih {formatRupiah(overAmount)}
                    </span>
                  ) : isAchieved ? (
                    <span className="goal-status-achieved">Target tercapai</span>
                  ) : (
                    <span className="goal-remaining">Sisa {formatRupiah(remaining)}</span>
                  )}
                  <span className={`goal-pct ${isAchieved ? 'goal-pct--achieved' : ''}`}>
                    {percentage}%
                  </span>
                </div>

                {/* Fund Management Actions (Full Mode on /tujuan) */}
                {!isPreview && (
                  <div className="goal-actions">
                    <button
                      type="button"
                      className="goal-action-btn goal-action-btn--add"
                      onClick={() => openFundDialog(goal, 'add')}
                      aria-label={`Tambah dana ke ${goal.name}`}
                    >
                      <PlusCircle size={13} />
                      <span>Tambah dana</span>
                    </button>
                    {saved > 0 && (
                      <button
                        type="button"
                        className="goal-action-btn goal-action-btn--withdraw"
                        onClick={() => openFundDialog(goal, 'withdraw')}
                        aria-label={`Kurangi dana dari ${goal.name}`}
                      >
                        <MinusCircle size={13} />
                        <span>Kurangi dana</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Fund Add/Withdraw Modal */}
      {!isPreview && activeFundGoal && (
        <GoalFundDialog
          goal={activeFundGoal}
          mode={fundDialogMode}
          isOpen={!!activeFundGoal}
          onClose={closeFundDialog}
        />
      )}

      {/* Destructive Confirm Delete Modal */}
      <ConfirmDialog
        isOpen={!!deletingGoal}
        title={`Hapus tujuan "${deletingGoal?.name}"?`}
        description="Riwayat dana yang dialokasikan ke tujuan ini juga akan dihapus. Transaksi, budget, dan analisis tidak berubah. Tindakan ini tidak dapat dibatalkan."
        confirmLabel="Hapus tujuan"
        cancelLabel="Batal"
        isDestructive={true}
        isPending={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingGoal(null)}
      />
    </div>
  );
}
