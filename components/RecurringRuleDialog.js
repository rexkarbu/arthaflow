'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { createRecurringRule, updateRecurringRule } from '@/app/actions';
import CurrencyInput from './CurrencyInput';
import { parseCurrency } from '@/lib/currency';
import { toast } from 'sonner';

export default function RecurringRuleDialog({
  isOpen,
  onClose,
  rule = null, // if provided, editing mode
  categories = [],
  accounts = [],
  onSuccess
}) {
  if (!isOpen) return null;

  return (
    <RecurringRuleDialogContent
      key={rule ? `edit-rule-${rule.id}` : 'create-rule'}
      onClose={onClose}
      rule={rule}
      categories={categories}
      accounts={accounts}
      onSuccess={onSuccess}
    />
  );
}

const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Senin' },
  { value: 2, label: 'Selasa' },
  { value: 3, label: 'Rabu' },
  { value: 4, label: 'Kamis' },
  { value: 5, label: 'Jumat' },
  { value: 6, label: 'Sabtu' },
  { value: 7, label: 'Minggu' },
];

function RecurringRuleDialogContent({
  onClose,
  rule,
  categories,
  accounts,
  onSuccess
}) {
  const isEdit = !!rule;
  const todayStr = new Date().toISOString().slice(0, 10);

  const [type, setType] = useState(rule?.type || 'expense');
  const [frequency, setFrequency] = useState(rule?.frequency || 'monthly');
  const [dayOfMonth, setDayOfMonth] = useState(rule?.day_of_month != null ? String(rule.day_of_month) : '1');
  const [dayOfWeek, setDayOfWeek] = useState(rule?.day_of_week != null ? String(rule.day_of_week) : '1');
  const [startDate, setStartDate] = useState(rule?.start_date ? String(rule.start_date).slice(0, 10) : todayStr);
  const [endDate, setEndDate] = useState(rule?.end_date ? String(rule.end_date).slice(0, 10) : '');
  const [selectedCategory, setSelectedCategory] = useState(rule?.category || 'Lainnya');
  const [selectedAccountId, setSelectedAccountId] = useState(
    rule?.account_id != null ? String(rule.account_id) : '__UNASSIGNED__'
  );
  const [amountVal, setAmountVal] = useState(rule?.amount != null ? String(rule.amount) : '');
  const [note, setNote] = useState(rule?.note || '');
  const [name, setName] = useState(rule?.name || '');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const dialogRef = useRef(null);

  // Filter categories by type
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
    if (!name.trim()) {
      setErrorMsg('Nama jadwal rutin wajib diisi.');
      setLoading(false);
      return;
    }
    if (parsedAmount <= 0) {
      setErrorMsg('Jumlah harus lebih besar dari Rp0.');
      setLoading(false);
      return;
    }
    if (!startDate) {
      setErrorMsg('Tanggal mulai wajib diisi.');
      setLoading(false);
      return;
    }
    if (endDate && endDate < startDate) {
      setErrorMsg('Tanggal selesai tidak boleh lebih awal dari tanggal mulai.');
      setLoading(false);
      return;
    }

    const fd = new FormData();
    if (isEdit) {
      fd.append('id', String(rule.id));
    }
    fd.append('name', name.trim());
    fd.append('type', type);
    fd.append('amount', String(parsedAmount));
    fd.append('category', selectedCategory);
    fd.append('account_id', selectedAccountId);
    fd.append('frequency', frequency);
    if (frequency === 'monthly') {
      fd.append('day_of_month', dayOfMonth);
    } else {
      fd.append('day_of_week', dayOfWeek);
    }
    fd.append('start_date', startDate);
    if (endDate) {
      fd.append('end_date', endDate);
    }
    fd.append('note', note.trim());

    try {
      const res = isEdit
        ? await updateRecurringRule(fd)
        : await createRecurringRule(fd);

      if (res && res.success === false) {
        setErrorMsg(res.error || 'Gagal menyimpan jadwal rutin.');
        toast.error(res.error || 'Gagal menyimpan jadwal rutin.');
        return;
      }

      toast.success(isEdit ? 'Jadwal rutin berhasil diperbarui.' : 'Jadwal rutin berhasil dibuat.');
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
        aria-label={isEdit ? 'Edit Jadwal Rutin' : 'Tambah Jadwal Rutin'}
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
          {isEdit ? 'Edit Jadwal Rutin' : 'Tambah Jadwal Rutin'}
        </div>
        <p className="dialog-desc" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          Jadwal rutin adalah template transaksi yang jatuh tempo secara berkala dan siap dicatat saat tanggalnya tiba.
        </p>

        <form onSubmit={handleSubmit}>
          {/* Transaction Type Segmented Toggle */}
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

          {/* Name / Description */}
          <div className="field">
            <label htmlFor="recurring-name" className="label">
              Nama Jadwal
            </label>
            <input
              type="text"
              id="recurring-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Spotify, Langganan Internet, Gaji"
              required
              autoFocus
            />
          </div>

          {/* Amount */}
          <div className="field">
            <label htmlFor="recurring-amount" className="label">
              Jumlah Estimasi
            </label>
            <CurrencyInput
              id="recurring-amount"
              name="amount"
              className="input"
              placeholder="Rp 0"
              defaultValue={amountVal}
              onChange={(val) => setAmountVal(val)}
              required
            />
          </div>

          {/* Category & Account Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="field">
              <label htmlFor="recurring-category" className="label">
                Kategori
              </label>
              <select
                id="recurring-category"
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
              <label htmlFor="recurring-account" className="label">
                Akun (Opsional)
              </label>
              <select
                id="recurring-account"
                className="input"
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
              >
                <option value="__UNASSIGNED__">Belum dialokasikan</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id} disabled={acc.archived}>
                    {acc.name} {acc.archived ? '(Diarsipkan)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Frequency Selector */}
          <div className="field">
            <label className="label">Frekuensi</label>
            <div className="type-toggle-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <button
                type="button"
                className={`btn-type-toggle ${frequency === 'monthly' ? 'btn-type-toggle--active-neutral' : ''}`}
                onClick={() => setFrequency('monthly')}
              >
                Bulanan
              </button>
              <button
                type="button"
                className={`btn-type-toggle ${frequency === 'weekly' ? 'btn-type-toggle--active-neutral' : ''}`}
                onClick={() => setFrequency('weekly')}
              >
                Mingguan
              </button>
            </div>
          </div>

          {/* Schedule Detail depending on frequency */}
          {frequency === 'monthly' ? (
            <div className="field">
              <label htmlFor="recurring-day-month" className="label">
                Tanggal Jatuh Tempo Setiap Bulan
              </label>
              <input
                type="number"
                id="recurring-day-month"
                className="input"
                min="1"
                max="31"
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(e.target.value)}
                required
              />
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Jika suatu bulan lebih pendek (mis. Februari), digunakan hari terakhir bulan tersebut.
              </div>
            </div>
          ) : (
            <div className="field">
              <label htmlFor="recurring-day-week" className="label">
                Hari Jatuh Tempo Setiap Minggu
              </label>
              <select
                id="recurring-day-week"
                className="input"
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value)}
              >
                {WEEKDAY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    Setiap {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Start Date & End Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="field">
              <label htmlFor="recurring-start-date" className="label">
                Mulai Berlaku
              </label>
              <input
                type="date"
                id="recurring-start-date"
                className="input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="recurring-end-date" className="label">
                Selesai (Opsional)
              </label>
              <input
                type="date"
                id="recurring-end-date"
                className="input"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="Tanpa batas"
              />
            </div>
          </div>

          {/* Note */}
          <div className="field">
            <label htmlFor="recurring-note" className="label">
              Catatan (Opsional)
            </label>
            <input
              type="text"
              id="recurring-note"
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Keterangan tambahan"
            />
          </div>

          {errorMsg && (
            <div className="form-error" style={{ marginTop: '0.5rem' }}>
              {errorMsg}
            </div>
          )}

          {/* Form Actions */}
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
              {loading ? 'Menyimpan...' : (isEdit ? 'Simpan Perubahan' : 'Buat Jadwal')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
