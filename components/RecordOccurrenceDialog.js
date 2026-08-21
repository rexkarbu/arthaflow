'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertCircle } from 'lucide-react';
import { recordRecurringOccurrence } from '@/app/actions';
import CurrencyInput from './CurrencyInput';
import { parseCurrency } from '@/lib/currency';
import { formatCompactDate, formatFullDate } from '@/lib/format';
import { toast } from 'sonner';

export default function RecordOccurrenceDialog({
  isOpen,
  onClose,
  occurrence,
  categories = [],
  accounts = [],
  onSuccess
}) {
  if (!isOpen || !occurrence) return null;

  return (
    <RecordOccurrenceDialogContent
      key={`record-occ-${occurrence.id}`}
      onClose={onClose}
      occurrence={occurrence}
      categories={categories}
      accounts={accounts}
      onSuccess={onSuccess}
    />
  );
}

function RecordOccurrenceDialogContent({
  onClose,
  occurrence,
  categories,
  accounts,
  onSuccess
}) {
  // Snapshot prefill
  const [description, setDescription] = useState(occurrence.name || '');
  const [type, setType] = useState(occurrence.type || 'expense');
  const [amountVal, setAmountVal] = useState(occurrence.amount ? String(occurrence.amount) : '');
  const [selectedCategory, setSelectedCategory] = useState(occurrence.category || 'Lainnya');
  const [txDate, setTxDate] = useState(occurrence.due_date || new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState(occurrence.note || '');

  // Account snapshot handling
  const isAccountArchived = !!occurrence.account_archived;
  const initialAccountId = (!isAccountArchived && occurrence.account_id != null)
    ? String(occurrence.account_id)
    : '__UNASSIGNED__';
  const [selectedAccountId, setSelectedAccountId] = useState(initialAccountId);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const dialogRef = useRef(null);

  const availableCategories = categories.filter(c => (c.type || 'expense') === type);

  // Close on Escape
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Trap focus
  useEffect(() => {
    if (!dialogRef.current) return;
    const dialog = dialogRef.current;
    const focusable = dialog.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length > 0) focusable[0].focus();

    function trapFocus(e) {
      if (e.key !== 'Tab') return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    dialog.addEventListener('keydown', trapFocus);
    return () => dialog.removeEventListener('keydown', trapFocus);
  }, []);

  // Prevent background scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const parsedAmount = parseCurrency(amountVal || '0');
    if (!description.trim()) {
      setErrorMsg('Deskripsi transaksi wajib diisi.');
      setLoading(false);
      return;
    }
    if (parsedAmount <= 0) {
      setErrorMsg('Jumlah harus lebih besar dari Rp0.');
      setLoading(false);
      return;
    }
    if (!txDate) {
      setErrorMsg('Tanggal transaksi wajib diisi.');
      setLoading(false);
      return;
    }

    // Check account opening date
    if (selectedAccountId !== '__UNASSIGNED__' && selectedAccountId !== '') {
      const selectedAcc = accounts.find(a => String(a.id) === selectedAccountId);
      if (selectedAcc) {
        if (selectedAcc.archived) {
          setErrorMsg(`Akun "${selectedAcc.name}" telah diarsipkan. Pilih akun aktif.`);
          setLoading(false);
          return;
        }
        if (selectedAcc.opening_date && txDate < String(selectedAcc.opening_date).slice(0, 10)) {
          const formattedOpening = formatFullDate(selectedAcc.opening_date);
          setErrorMsg(`Tanggal transaksi terjadi sebelum tanggal mulai ${selectedAcc.name} (${formattedOpening}).`);
          setLoading(false);
          return;
        }
      }
    }

    const fd = new FormData();
    fd.append('occurrence_id', String(occurrence.id));
    fd.append('description', description.trim());
    fd.append('type', type);
    fd.append('amount', String(parsedAmount));
    fd.append('category', selectedCategory);
    fd.append('account_id', selectedAccountId);
    fd.append('date', txDate);
    fd.append('notes', notes.trim());

    try {
      const res = await recordRecurringOccurrence(fd);
      if (res && res.success === false) {
        setErrorMsg(res.error || 'Gagal mencatat transaksi rutin.');
        toast.error(res.error || 'Gagal mencatat transaksi rutin.');
        return;
      }

      toast.success(`Transaksi "${description}" berhasil dicatat.`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      const msg = err?.message || 'Terjadi kesalahan sistem.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="dialog-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-hidden="true"
    >
      <div
        className="dialog-content"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Catat Transaksi: ${occurrence.name}`}
        style={{ maxWidth: '480px' }}
      >
        <button
          className="dialog-close"
          onClick={onClose}
          aria-label="Tutup"
        >
          <X size={18} />
        </button>

        <div className="dialog-title">
          Catat Transaksi Rutin
        </div>
        <p className="dialog-desc" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Jatuh tempo: <strong>{formatCompactDate(occurrence.due_date)}</strong>. Anda dapat menyesuaikan rincian sebelum mencatat ke buku kas.
        </p>

        {isAccountArchived && (
          <div
            style={{
              padding: '0.6rem 0.8rem',
              background: 'var(--surface-sunken)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              marginBottom: '1rem',
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'flex-start'
            }}
          >
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--brand)' }} />
            <div>
              Akun <strong>{occurrence.account_name}</strong> yang dijadwalkan telah diarsipkan. Silakan pilih akun aktif untuk mencatat transaksi ini.
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Type Toggle */}
          <div className="field">
            <label className="label">Jenis Transaksi</label>
            <div className="type-toggle-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <button
                type="button"
                className={`btn-type-toggle ${type === 'expense' ? 'btn-type-toggle--active-expense' : ''}`}
                onClick={() => setType('expense')}
              >
                Pengeluaran
              </button>
              <button
                type="button"
                className={`btn-type-toggle ${type === 'income' ? 'btn-type-toggle--active-income' : ''}`}
                onClick={() => setType('income')}
              >
                Pemasukan
              </button>
            </div>
          </div>

          {/* Description */}
          <div className="field">
            <label htmlFor="record-desc" className="label">
              Deskripsi
            </label>
            <input
              type="text"
              id="record-desc"
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              autoFocus
            />
          </div>

          {/* Amount */}
          <div className="field">
            <label htmlFor="record-amount" className="label">
              Jumlah
            </label>
            <CurrencyInput
              id="record-amount"
              name="amount"
              className="input"
              placeholder="Rp 0"
              defaultValue={amountVal}
              onChange={(val) => setAmountVal(val)}
              required
            />
          </div>

          {/* Category & Account */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="field">
              <label htmlFor="record-category" className="label">
                Kategori
              </label>
              <select
                id="record-category"
                className="input"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                {availableCategories.length > 0 ? (
                  availableCategories.map(c => (
                    <option key={c.id || c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))
                ) : (
                  <option value="Lainnya">Lainnya</option>
                )}
              </select>
            </div>

            <div className="field">
              <label htmlFor="record-account" className="label">
                Akun
              </label>
              <select
                id="record-account"
                className="input"
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
              >
                <option value="__UNASSIGNED__">Belum dialokasikan</option>
                {accounts.map(acc => {
                  const isBeforeOpening = acc.opening_date && String(acc.opening_date).slice(0, 10) > txDate;
                  let label = acc.name;
                  if (acc.archived) {
                    label += ' (Diarsipkan)';
                  } else if (isBeforeOpening) {
                    label += ` — mulai ${formatCompactDate(acc.opening_date)}`;
                  }

                  return (
                    <option key={acc.id} value={acc.id} disabled={acc.archived || isBeforeOpening}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Transaction Date */}
          <div className="field">
            <label htmlFor="record-date" className="label">
              Tanggal Transaksi
            </label>
            <input
              type="date"
              id="record-date"
              className="input"
              value={txDate}
              onChange={(e) => setTxDate(e.target.value)}
              required
            />
          </div>

          {/* Notes */}
          <div className="field">
            <label htmlFor="record-notes" className="label">
              Catatan (Opsional)
            </label>
            <input
              type="text"
              id="record-notes"
              className="input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Keterangan transaksi"
            />
          </div>

          {errorMsg && (
            <div className="form-error" style={{ marginTop: '0.5rem' }}>
              {errorMsg}
            </div>
          )}

          {/* Actions */}
          <div className="dialog-actions" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Mencatat...' : 'Catat Transaksi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
