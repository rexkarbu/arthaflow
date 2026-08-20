'use client';

import { useEffect, useRef } from 'react';
import { X, AlertTriangle } from 'lucide-react';

export default function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = 'Hapus',
  cancelLabel = 'Batal',
  isDestructive = true,
  isPending = false,
  onConfirm,
  onCancel,
}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e) {
      if (e.key === 'Escape' && !isPending) {
        onCancel();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPending, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPending) {
          onCancel();
        }
      }}
    >
      <div className="dialog-content dialog-content--sm confirm-dialog-box" ref={dialogRef}>
        <div className="confirm-dialog-header">
          <h2 id="confirm-dialog-title" className="confirm-dialog-title">
            {title}
          </h2>
          <button
            type="button"
            className="dialog-close"
            onClick={onCancel}
            disabled={isPending}
            aria-label="Tutup konfirmasi"
          >
            <X size={16} />
          </button>
        </div>

        <div className="confirm-dialog-body">
          {typeof description === 'string' ? (
            <p className="confirm-dialog-desc">{description}</p>
          ) : (
            description
          )}
        </div>

        <div className="confirm-dialog-footer">
          <button
            type="button"
            className="btn-secondary btn--sm"
            onClick={onCancel}
            disabled={isPending}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`${isDestructive ? 'btn-destructive' : 'btn-primary'} btn--sm`}
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? 'Menghapus...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
