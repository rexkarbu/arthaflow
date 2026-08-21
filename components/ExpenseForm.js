'use client';

import { useState, useRef } from 'react';
import { addExpense, addCategory } from '@/app/actions';
import { Repeat } from 'lucide-react';
import { toast } from 'sonner';
import CurrencyInput from './CurrencyInput';
import { parseCurrency } from '@/lib/currency';
import { formatCompactDate } from '@/lib/format';

export default function ExpenseForm({
  expenseCategories = [],
  incomeCategories = [],
  accounts = [],
  initialType = 'expense',
  initialAccountId = null,
  onSuccess
}) {
  const [type, setType] = useState(initialType || 'expense');
  const [loading, setLoading] = useState(false);
  const [showNewCat, setShowNewCat] = useState(false);
  const [amountError, setAmountError] = useState('');
  const [accountError, setAccountError] = useState('');
  const formRef = useRef(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setAccountError('');
    const form = e.currentTarget;
    const fd = new FormData(form);

    const MAX_AMOUNT = 999_999_999_999;
    const amount = parseCurrency(fd.get('amount'));
    if (amount <= 0 || amount > MAX_AMOUNT) {
      toast.error('Jumlah maksimal adalah Rp 999.999.999.999');
      setAmountError('Jumlah harus lebih besar dari 0 dan maksimal Rp 999.999.999.999');
      setLoading(false);
      return;
    }
    const desc = fd.get('description')?.trim();
    if (!desc) {
      toast.error('Keterangan transaksi tidak boleh kosong');
      setLoading(false);
      return;
    }

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
      const res = await addExpense(fd);
      if (res && res.success === false) {
        setAccountError(res.error || 'Gagal menyimpan data.');
        toast.error(res.error || 'Gagal menyimpan data.');
        return;
      }
      form.reset();
      setShowNewCat(false);
      setAccountError('');
      toast.success(type === 'expense' ? 'Pengeluaran berhasil dicatat' : 'Pemasukan berhasil dicatat');
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error(err?.message || 'Gagal menyimpan data.');
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
          <CurrencyInput
            id="amount"
            name="amount"
            className="input amount-input"
            placeholder="0"
            onChange={() => setAmountError('')}
            required
            autoFocus
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

      {/* Account */}
      <div className="field">
        <label htmlFor="account_id" className="label">
          Akun <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opsional)</span>
        </label>
        <select
          id="account_id"
          name="account_id"
          className="input"
          defaultValue={initialAccountId ? String(initialAccountId) : '__UNASSIGNED__'}
          onChange={() => setAccountError('')}
        >
          <option value="__UNASSIGNED__">Belum dialokasikan</option>
          {accounts.map(acc => {
            const todayStr = new Date().toISOString().slice(0, 10);
            const isBeforeOpening = acc.opening_date && String(acc.opening_date).slice(0, 10) > todayStr;
            let label = acc.name;
            if (acc.archived) {
              label += ' (Diarsipkan)';
            } else if (isBeforeOpening) {
              label += ` — mulai ${formatCompactDate(acc.opening_date)}`;
            }

            return (
              <option key={acc.id} value={acc.id} disabled={isBeforeOpening || acc.archived}>
                {label}
              </option>
            );
          })}
        </select>
        {accounts.some(a => a.opening_date && String(a.opening_date).slice(0, 10) > new Date().toISOString().slice(0, 10)) && (
          <div className="form-help-text" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Akun yang mulai dilacak setelah tanggal transaksi tidak dapat dipilih.
          </div>
        )}
        {accountError && (
          <div className="form-error" style={{ marginTop: '0.35rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span>{accountError}</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Ubah tanggal mulai pelacakan akun atau pilih akun lain.
            </span>
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
