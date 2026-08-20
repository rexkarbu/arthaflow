'use client';

import { useState, useRef } from 'react';
import { addExpense, addCategory } from '@/app/actions';
import { Repeat } from 'lucide-react';
import { toast } from 'sonner';

export default function ExpenseForm({ expenseCategories = [], incomeCategories = [], onSuccess }) {
  const [type, setType] = useState('expense');
  const [loading, setLoading] = useState(false);
  const [showNewCat, setShowNewCat] = useState(false);
  const [amountError, setAmountError] = useState('');
  const formRef = useRef(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget;
    const fd = new FormData(form);

    const MAX_AMOUNT = 999_999_999_999;
    const amount = parseFloat(fd.get('amount'));
    if (amount > MAX_AMOUNT) {
      toast.error('Jumlah maksimal adalah Rp 999.999.999.999');
      setAmountError('Jumlah maksimal adalah Rp 999.999.999.999');
      setLoading(false);
      return;
    }
    setAmountError('');

    if (showNewCat) {
      const newCat = fd.get('new_category')?.trim();
      if (newCat) {
        fd.set('category', newCat);
        const catFd = new FormData();
        catFd.append('name', newCat);
        catFd.append('type', type);
        await addCategory(catFd);
      } else {
        fd.set('category', 'Lainnya');
      }
    }

    try {
      await addExpense(fd);
      form.reset();
      setShowNewCat(false);
      toast.success(type === 'expense' ? 'Pengeluaran berhasil dicatat' : 'Pemasukan berhasil dicatat');
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error('Gagal menyimpan data.');
    } finally {
      setLoading(false);
    }
  }

  const activeCategories = type === 'expense' ? expenseCategories : incomeCategories;

  return (
    <form onSubmit={handleSubmit} ref={formRef}>
      <input type="hidden" name="type" value={type} />

      {/* Type toggle */}
      <div className="type-tabs">
        <button
          type="button"
          className={`type-tab type-tab--expense ${type === 'expense' ? 'type-tab--active' : ''}`}
          onClick={() => setType('expense')}
        >
          Pengeluaran
        </button>
        <button
          type="button"
          className={`type-tab type-tab--income ${type === 'income' ? 'type-tab--active' : ''}`}
          onClick={() => setType('income')}
        >
          Pemasukan
        </button>
      </div>

      {/* Amount */}
      <div className="field">
        <label htmlFor="amount" className="label">Jumlah</label>
        <div className="amount-field">
          <span className="amount-prefix">Rp</span>
          <input
            type="number"
            id="amount"
            name="amount"
            className="input amount-input"
            placeholder="0"
            min="1"
            max="999999999999"
            onChange={() => setAmountError('')}
            required
          />
        </div>
        {amountError && (
          <div className="form-error">{amountError}</div>
        )}
      </div>

      {/* Description */}
      <div className="field">
        <label htmlFor="description" className="label">Keterangan</label>
        <input
          type="text"
          id="description"
          name="description"
          className="input"
          placeholder={type === 'expense' ? 'cth. Makan siang' : 'cth. Gaji bulanan'}
          required
        />
      </div>

      {/* Category */}
      <div className="field">
        <label htmlFor="category" className="label">Kategori</label>
        {!showNewCat ? (
          <select
            id="category"
            name="category"
            className="input"
            onChange={(e) => {
              if (e.target.value === '__NEW__') setShowNewCat(true);
            }}
          >
            {activeCategories.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
            <option value="__NEW__">+ Tambah kategori baru</option>
          </select>
        ) : (
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <input
              type="text"
              name="new_category"
              className="input"
              placeholder="Ketik kategori baru..."
              autoFocus
              required
            />
            <input type="hidden" name="category" value="__NEW__" />
            <button
              type="button"
              className="btn-cancel"
              onClick={() => setShowNewCat(false)}
              style={{ padding: '0.4rem 0.7rem', width: 'auto' }}
            >
              Batal
            </button>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="field">
        <label htmlFor="notes" className="label">
          Catatan <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opsional)</span>
        </label>
        <input
          type="text"
          id="notes"
          name="notes"
          className="input"
          placeholder="Tambahan keterangan"
        />
      </div>

      {/* Recurring */}
      <div className="field recurring-field">
        <input
          type="checkbox"
          id="is_recurring"
          name="is_recurring"
        />
        <label htmlFor="is_recurring">
          <Repeat size={12} style={{ marginRight: '0.2rem', verticalAlign: '-1px' }} />
          Tandai sebagai {type === 'expense' ? 'pengeluaran' : 'pemasukan'} rutin
        </label>
      </div>

      {/* Submit */}
      <div className="dialog-actions">
        <button type="submit" className="btn-submit" disabled={loading}>
          {loading ? 'Menyimpan...' : 'Simpan'}
        </button>
      </div>
    </form>
  );
}
