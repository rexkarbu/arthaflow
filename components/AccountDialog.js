'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Lock } from 'lucide-react';
import { toast } from 'sonner';
import CurrencyInput from './CurrencyInput';
import { parseCurrency } from '@/lib/currency';
import { createAccount, updateAccount } from '@/app/actions';

export default function AccountDialog({
  isOpen,
  account = null, // null for create, object for edit
  onClose
}) {
  if (!isOpen) return null;

  return (
    <AccountDialogContent
      key={account ? `edit-${account.id}` : 'create'}
      account={account}
      onClose={onClose}
    />
  );
}

function AccountDialogContent({ account, onClose }) {
  const [loading, setLoading] = useState(false);
  const [amountError, setAmountError] = useState('');
  const dialogRef = useRef(null);

  const isEdit = !!account;
  const isLocked = isEdit && Number(account.activity_count || 0) > 0;

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

  // Trap focus inside dialog
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
    return () => { document.body.style.overflow = ''; };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget;
    const fd = new FormData(form);

    const name = fd.get('name')?.trim();
    if (!name) {
      toast.error('Nama akun wajib diisi.');
      setLoading(false);
      return;
    }

    if (!isLocked) {
      const openingBal = parseCurrency(fd.get('opening_balance') || '0');
      if (openingBal < 0 || openingBal > 999_999_999_999) {
        setAmountError('Saldo awal tidak valid.');
        setLoading(false);
        return;
      }
    }

    try {
      let res;
      if (isEdit) {
        fd.append('id', account.id);
        res = await updateAccount(fd);
      } else {
        res = await createAccount(fd);
      }
      if (res && res.success === false) {
        toast.error(res.error || 'Gagal menyimpan akun.');
        return;
      }
      toast.success(isEdit ? `Akun "${name}" berhasil diperbarui.` : `Akun "${name}" berhasil ditambahkan.`);
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Gagal menyimpan akun.');
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
        aria-label={isEdit ? 'Edit Akun' : 'Tambah Akun Baru'}
      >
        <button
          className="dialog-close"
          onClick={onClose}
          aria-label="Tutup"
        >
          <X size={18} />
        </button>

        <div className="dialog-title">
          {isEdit ? 'Edit Akun' : 'Tambah Akun Baru'}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Account Name */}
          <div className="field">
            <label htmlFor="acc-name" className="label">Nama Akun</label>
            <input
              type="text"
              id="acc-name"
              name="name"
              className="input"
              defaultValue={account?.name || ''}
              placeholder="cth. BRImo, SeaBank, GoPay, Tunai"
              required
              autoFocus
            />
          </div>

          {/* Account Type */}
          <div className="field">
            <label htmlFor="acc-type" className="label">Jenis Akun</label>
            <select
              id="acc-type"
              name="type"
              className="input"
              defaultValue={account?.type || 'BANK'}
            >
              <option value="BANK">Bank</option>
              <option value="E_WALLET">E-wallet</option>
              <option value="CASH">Tunai</option>
              <option value="OTHER">Lainnya</option>
            </select>
          </div>

          {/* Opening Balance */}
          <div className="field">
            <label htmlFor="acc-opening-bal" className="label">
              Saldo Awal
              {isLocked && (
                <span style={{ marginLeft: '0.4rem', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                  <Lock size={10} style={{ verticalAlign: '-1px', marginRight: '2px' }} />
                  Terkunci
                </span>
              )}
            </label>
            <div className="amount-field">
              <span className="amount-prefix">Rp</span>
              <CurrencyInput
                id="acc-opening-bal"
                name="opening_balance"
                className="input amount-input"
                defaultValue={account ? account.opening_balance : ''}
                placeholder="0"
                disabled={isLocked}
                onChange={() => setAmountError('')}
              />
            </div>
            {isLocked ? (
              <div className="form-help-text" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Saldo awal dan tanggal mulai terkunci karena akun sudah memiliki aktivitas.
              </div>
            ) : (
              <div className="form-help-text" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Saldo awal adalah saldo sebelum aktivitas pada tanggal mulai pelacakan.
              </div>
            )}
            {amountError && (
              <div className="form-error">{amountError}</div>
            )}
          </div>

          {/* Opening Date */}
          <div className="field">
            <label htmlFor="acc-opening-date" className="label">
              Tanggal Mulai Pelacakan
              {isLocked && (
                <span style={{ marginLeft: '0.4rem', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                  <Lock size={10} style={{ verticalAlign: '-1px', marginRight: '2px' }} />
                  Terkunci
                </span>
              )}
            </label>
            <input
              type="date"
              id="acc-opening-date"
              name="opening_date"
              className="input"
              defaultValue={account?.opening_date ? String(account.opening_date).slice(0, 10) : new Date().toISOString().slice(0, 10)}
              disabled={isLocked}
              required
            />
            {!isLocked && (
              <div className="form-help-text" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Transaksi sebelum tanggal ini tidak akan mempengaruhi saldo akun.
              </div>
            )}
          </div>

          {/* Submit Actions */}
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
              {loading ? 'Menyimpan...' : (isEdit ? 'Simpan Perubahan' : 'Tambah Akun')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
