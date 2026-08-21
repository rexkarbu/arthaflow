'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Calendar, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import CurrencyInput from './CurrencyInput';
import { parseCurrency, formatRupiah } from '@/lib/currency';
import { formatCompactDate } from '@/lib/format';
import { extendAccountHistory } from '@/app/actions';

export default function ExtendHistoryDialog({
  isOpen,
  account = null,
  suggestedDate = null,
  unassignedTransactions = [],
  onClose,
  onSuccess
}) {
  if (!isOpen || !account) return null;

  return (
    <ExtendHistoryDialogContent
      key={`extend-${account.id}`}
      account={account}
      suggestedDate={suggestedDate}
      unassignedTransactions={unassignedTransactions}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}

function getPreviousDay(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return '';
  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  d.setDate(d.getDate() - 1);
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${dy}`;
}

function ExtendHistoryDialogContent({
  account,
  suggestedDate,
  unassignedTransactions,
  onClose,
  onSuccess
}) {
  const currentOpeningDateStr = account.opening_date ? String(account.opening_date).slice(0, 10) : '';
  const maxAllowedDate = getPreviousDay(currentOpeningDateStr);
  const initialNewDate = suggestedDate && suggestedDate < currentOpeningDateStr
    ? suggestedDate
    : maxAllowedDate;

  const [newDate, setNewDate] = useState(initialNewDate);
  const [openingBalanceVal, setOpeningBalanceVal] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const dialogRef = useRef(null);

  const parsedOpeningBalance = parseCurrency(openingBalanceVal || '0');

  // Count unassigned transactions that fall between newDate and current opening_date
  const eligibleCount = unassignedTransactions.filter(tx => {
    if (tx.account_id != null) return false;
    const txDate = String(tx.date || '').slice(0, 10);
    return txDate >= newDate && txDate < currentOpeningDateStr;
  }).length;

  // Close on Escape
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        onClose();
      }
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

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    if (!newDate) {
      setErrorMsg('Tanggal mulai baru wajib diisi.');
      setLoading(false);
      return;
    }

    if (newDate >= currentOpeningDateStr) {
      setErrorMsg('Tanggal mulai baru harus lebih awal dari tanggal mulai saat ini.');
      setLoading(false);
      return;
    }

    const fd = new FormData();
    fd.append('account_id', String(account.id));
    fd.append('opening_date', newDate);
    fd.append('opening_balance', openingBalanceVal || '0');

    try {
      const res = await extendAccountHistory(fd);
      if (res && res.success === false) {
        setErrorMsg(res.error || 'Gagal memperluas riwayat akun.');
        toast.error(res.error || 'Gagal memperluas riwayat akun.');
        return;
      }
      toast.success(`Riwayat akun "${account.name}" berhasil diperluas.`);
      if (onSuccess) onSuccess(account, newDate);
      onClose();
    } catch (err) {
      const msg = err?.message || 'Gagal memperluas riwayat akun.';
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
        aria-label={`Perluas riwayat ${account.name}`}
        style={{ maxWidth: '440px' }}
      >
        <button
          className="dialog-close"
          onClick={onClose}
          aria-label="Tutup"
        >
          <X size={18} />
        </button>

        <div className="dialog-title">
          Perluas riwayat {account.name}
        </div>

        <p className="dialog-desc" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.45 }}>
          Untuk memasukkan transaksi yang lebih lama, tentukan tanggal mulai pelacakan baru dan saldo akun sebelum aktivitas pada tanggal tersebut.
        </p>

        <form onSubmit={handleSubmit}>
          {/* New Opening Date */}
          <div className="field">
            <label htmlFor="extend-date" className="label">
              Tanggal mulai baru
            </label>
            <input
              type="date"
              id="extend-date"
              name="opening_date"
              className="input"
              value={newDate}
              max={maxAllowedDate}
              onChange={(e) => {
                setNewDate(e.target.value);
                setErrorMsg('');
              }}
              required
              autoFocus
            />
          </div>

          {/* New Opening Balance */}
          <div className="field">
            <label htmlFor="extend-opening-bal" className="label">
              Saldo awal pada tanggal tersebut
            </label>
            <div className="amount-field">
              <span className="amount-prefix">Rp</span>
              <CurrencyInput
                id="extend-opening-bal"
                name="opening_balance"
                className="input amount-input"
                placeholder="0"
                value={openingBalanceVal}
                onChange={(e) => {
                  setOpeningBalanceVal(e.target.value);
                  setErrorMsg('');
                }}
              />
            </div>
            <div className="form-help-text" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Saldo awal adalah saldo {account.name} sebelum aktivitas pada tanggal mulai baru.
            </div>
          </div>

          {/* Restrained Comparison Preview */}
          <div className="extend-history-preview">
            <div className="extend-preview-card">
              <div className="extend-preview-tag">Sebelum</div>
              <div className="extend-preview-row">
                <span className="extend-preview-label">Mulai pelacakan</span>
                <span className="extend-preview-val">{formatCompactDate(account.opening_date)}</span>
              </div>
              <div className="extend-preview-row">
                <span className="extend-preview-label">Saldo awal</span>
                <span className="extend-preview-val">{formatRupiah(account.opening_balance || 0)}</span>
              </div>
            </div>

            <div className="extend-preview-card extend-preview-card--new">
              <div className="extend-preview-tag">Sesudah</div>
              <div className="extend-preview-row">
                <span className="extend-preview-label">Mulai pelacakan</span>
                <span className="extend-preview-val">{newDate ? formatCompactDate(newDate) : '—'}</span>
              </div>
              <div className="extend-preview-row">
                <span className="extend-preview-label">Saldo awal</span>
                <span className="extend-preview-val">{formatRupiah(parsedOpeningBalance)}</span>
              </div>
            </div>
          </div>

          {/* Eligible Transactions Indicator */}
          {eligibleCount > 0 && (
            <div className="extend-eligible-notice">
              <span>Transaksi yang dapat dialokasikan: <strong>{eligibleCount} transaksi</strong></span>
            </div>
          )}

          {errorMsg && (
            <div className="form-error" style={{ marginTop: '0.75rem' }}>
              {errorMsg}
            </div>
          )}

          {/* Submit Actions */}
          <div className="dialog-actions" style={{ marginTop: '1.25rem' }}>
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
              {loading ? 'Memperbarui...' : 'Perbarui riwayat'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
