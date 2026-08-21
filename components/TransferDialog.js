'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { X, ArrowRight, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import CurrencyInput from './CurrencyInput';
import { parseCurrency, formatRupiah } from '@/lib/currency';
import { createAccountTransfer } from '@/app/actions';

export default function TransferDialog({
  isOpen,
  accounts = [],
  defaultFromId = null,
  onClose
}) {
  if (!isOpen) return null;

  return (
    <TransferDialogContent
      accounts={accounts}
      defaultFromId={defaultFromId}
      onClose={onClose}
    />
  );
}

function TransferDialogContent({ accounts, defaultFromId, onClose }) {
  const initialFrom = defaultFromId ? String(defaultFromId) : (accounts[0] ? String(accounts[0].id) : '');
  const [fromId, setFromId] = useState(initialFrom);
  const [toId, setToId] = useState(() => {
    const otherAccount = accounts.find(a => String(a.id) !== initialFrom);
    return otherAccount ? String(otherAccount.id) : '';
  });
  const [amountStr, setAmountStr] = useState('');
  const [loading, setLoading] = useState(false);
  const dialogRef = useRef(null);

  const selectedFromAccount = useMemo(() => {
    return accounts.find(a => String(a.id) === String(fromId)) || null;
  }, [accounts, fromId]);

  const parsedAmount = useMemo(() => {
    return parseCurrency(amountStr);
  }, [amountStr]);

  const isOverdrawing = useMemo(() => {
    if (!selectedFromAccount || parsedAmount <= 0) return false;
    return parsedAmount > selectedFromAccount.balance;
  }, [selectedFromAccount, parsedAmount]);

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

    if (focusable.length > 0) {
      focusable[0].focus();
    }

    function trapFocus(e) {
      if (e.key !== 'Tab') return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    dialog.addEventListener('keydown', trapFocus);
    return () => dialog.removeEventListener('keydown', trapFocus);
  }, []);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget;
    const fd = new FormData(form);

    const amount = parseCurrency(fd.get('amount'));
    if (amount <= 0) {
      toast.error('Jumlah transfer harus lebih besar dari Rp0.');
      setLoading(false);
      return;
    }

    if (fromId === toId) {
      toast.error('Akun asal dan akun tujuan harus berbeda.');
      setLoading(false);
      return;
    }

    try {
      const res = await createAccountTransfer(fd);
      if (res && res.success === false) {
        toast.error(res.error || 'Gagal melakukan transfer dana.');
        return;
      }
      toast.success('Transfer dana berhasil dicatat.');
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Gagal melakukan transfer dana.');
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
        aria-label="Transfer Dana Antar Akun"
      >
        <button
          className="dialog-close"
          onClick={onClose}
          aria-label="Tutup"
        >
          <X size={18} />
        </button>

        <div className="dialog-title">
          Transfer Dana
        </div>

        <form onSubmit={handleSubmit}>
          {/* Source and Destination Accounts Grid */}
          <div className="transfer-accounts-grid">
            {/* From Account */}
            <div className="field">
              <label htmlFor="transfer-from" className="label">Dari Akun</label>
              <select
                id="transfer-from"
                name="from_account_id"
                className="input"
                value={fromId}
                onChange={(e) => {
                  const newFrom = e.target.value;
                  setFromId(newFrom);
                  if (newFrom === toId) {
                    const alt = accounts.find(a => String(a.id) !== newFrom);
                    if (alt) setToId(String(alt.id));
                  }
                }}
                required
              >
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.type_label || a.type})
                  </option>
                ))}
              </select>
              {selectedFromAccount && (
                <div className="form-help-text" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Saldo saat ini: <strong style={{ color: 'var(--text)' }}>{formatRupiah(selectedFromAccount.balance)}</strong>
                </div>
              )}
            </div>

            <div className="transfer-direction-icon">
              <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
            </div>

            {/* To Account */}
            <div className="field">
              <label htmlFor="transfer-to" className="label">Ke Akun</label>
              <select
                id="transfer-to"
                name="to_account_id"
                className="input"
                value={toId}
                onChange={(e) => setToId(e.target.value)}
                required
              >
                {accounts.filter(a => String(a.id) !== String(fromId)).map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.type_label || a.type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Amount */}
          <div className="field" style={{ marginTop: '0.75rem' }}>
            <label htmlFor="transfer-amount" className="label">Jumlah Transfer</label>
            <div className="amount-field">
              <span className="amount-prefix">Rp</span>
              <CurrencyInput
                id="transfer-amount"
                name="amount"
                className="input amount-input"
                placeholder="0"
                value={amountStr}
                onChange={(raw, formatted) => setAmountStr(formatted)}
                required
                autoFocus
              />
            </div>
            {isOverdrawing && (
              <div className="transfer-overdraw-warning" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.74rem', color: 'var(--warning)', marginTop: '0.35rem' }}>
                <AlertTriangle size={12} />
                <span>Jumlah melebihi saldo akun asal saat ini.</span>
              </div>
            )}
          </div>

          {/* Date */}
          <div className="field">
            <label htmlFor="transfer-date" className="label">Tanggal Transfer</label>
            <input
              type="date"
              id="transfer-date"
              name="transfer_date"
              className="input"
              defaultValue={new Date().toISOString().slice(0, 10)}
              required
            />
          </div>

          {/* Note */}
          <div className="field">
            <label htmlFor="transfer-note" className="label">
              Catatan <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opsional)</span>
            </label>
            <input
              type="text"
              id="transfer-note"
              name="note"
              className="input"
              placeholder="cth. Tabungan bulanan, top-up e-wallet"
            />
          </div>

          {/* Actions */}
          <div className="dialog-actions">
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
              {loading ? 'Memproses...' : 'Transfer Dana'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
