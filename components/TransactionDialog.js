'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, X } from 'lucide-react';
import ExpenseForm from './ExpenseForm';

export default function TransactionDialog({ expenseCategories, incomeCategories }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);

  const close = useCallback(() => {
    setOpen(false);
    // Return focus to trigger
    setTimeout(() => triggerRef.current?.focus(), 0);
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        close();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, close]);

  // Trap focus inside dialog
  useEffect(() => {
    if (!open || !dialogRef.current) return;

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
  }, [open]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        className="txn-add-btn"
        onClick={() => setOpen(true)}
        aria-label="Catat transaksi baru"
      >
        <Plus size={15} /> Catat transaksi
      </button>

      {open && (
        <div
          className="dialog-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
          aria-hidden="true"
        >
          <div 
            className="dialog-content" 
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Catat transaksi"
          >
            <button
              className="dialog-close"
              onClick={close}
              aria-label="Tutup"
            >
              <X size={18} />
            </button>
            <div className="dialog-title">Catat transaksi</div>
            <ExpenseForm
              expenseCategories={expenseCategories}
              incomeCategories={incomeCategories}
              onSuccess={close}
            />
          </div>
        </div>
      )}
    </>
  );
}
