'use client';

import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import CurrencyInput from './CurrencyInput';
import { formatRupiah, parseCurrency } from '@/lib/currency';
import { addGoalFunds, withdrawGoalFunds } from '@/app/actions';

export default function GoalFundDialog({ goal, mode = 'add', isOpen, onClose }) {
  const [loading, setLoading] = useState(false);
  const formRef = useRef(null);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !goal) return null;

  const isAdd = mode === 'add';
  const title = isAdd ? `Tambah Dana: ${goal.name}` : `Kurangi Dana: ${goal.name}`;
  const currentSaved = goal.saved_amount || 0;

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    const form = e.currentTarget;
    const fd = new FormData(form);
    const amount = parseCurrency(fd.get('amount'));

    if (amount <= 0 || isNaN(amount)) {
      toast.error('Nominal harus lebih dari 0');
      setLoading(false);
      return;
    }

    if (!isAdd && amount > currentSaved) {
      toast.error('Dana yang dikurangi melebihi saldo tujuan');
      setLoading(false);
      return;
    }

    try {
      if (isAdd) {
        await addGoalFunds(fd);
        toast.success(`Berhasil menambah ${formatRupiah(amount)} ke ${goal.name}`);
      } else {
        await withdrawGoalFunds(fd);
        toast.success(`Berhasil mengurangi ${formatRupiah(amount)} dari ${goal.name}`);
      }
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Gagal memproses alokasi dana.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dialog-overlay" onClick={onClose} role="presentation">
      <div
        className="dialog-content goal-fund-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="goal-fund-dialog-title"
      >
        <div className="dialog-header">
          <div>
            <h2 id="goal-fund-dialog-title" className="dialog-title" style={{ marginBottom: '0.2rem' }}>
              {title}
            </h2>
            <p className="dialog-subtitle">
              Saldo saat ini: <strong className="text-secondary">{formatRupiah(currentSaved)}</strong>
            </p>
          </div>
          <button
            type="button"
            className="dialog-close"
            onClick={onClose}
            aria-label="Tutup modal"
          >
            <X size={16} />
          </button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="goal-fund-form">
          <input type="hidden" name="goal_id" value={goal.id} />

          <div className="field">
            <label className="field-label">Nominal (Rp)</label>
            <CurrencyInput
              name="amount"
              className="input"
              placeholder="0"
              required
              autoFocus
            />
          </div>

          <div className="field">
            <label className="field-label">Catatan (opsional)</label>
            <input
              type="text"
              name="note"
              className="input"
              placeholder="Cth. Alokasi gaji bulanan, Bonus"
              maxLength={100}
            />
          </div>

          <div className="dialog-footer">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={loading}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn-submit"
              disabled={loading}
            >
              {loading ? 'Menyimpan...' : isAdd ? 'Tambah Dana' : 'Kurangi Dana'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
