'use client';

import { useState, useTransition } from 'react';
import { setBudget } from '@/app/actions';

function formatRupiah(n) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(n);
}

export default function BudgetBar({ month, monthLabel, budget, spent }) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(budget ? String(budget) : '');
  const [isPending, startTransition] = useTransition();

  const hasBudget = budget !== null;
  const pct = hasBudget && budget > 0 ? Math.min(Math.round((spent / budget) * 100), 100) : 0;
  const sisa = hasBudget ? budget - spent : 0;
  const isWarning = hasBudget && spent / budget >= 0.75 && spent <= budget;
  const isDanger = hasBudget && spent > budget;

  async function formAction(fd) {
    const amount = parseFloat(fd.get('budget'));
    if (isNaN(amount) || amount <= 0) return;

    startTransition(async () => {
      await setBudget(fd);
      setEditing(false);
    });
  }

  return (
    <div className="budget-section">
      <div className="budget-top">
        <div className="budget-label">Budget {monthLabel}</div>
        <button
          type="button"
          className="budget-edit-btn"
          onClick={() => setEditing(prev => !prev)}
        >
          {editing ? 'Batal' : (hasBudget ? 'Ubah budget' : 'Set budget')}
        </button>
      </div>

      {editing && (
        <form action={formAction} className="budget-form">
          <input type="hidden" name="month" value={month} />
          <input
            type="number"
            name="budget"
            className="budget-input"
            placeholder="contoh: 5000000"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            min="1"
            required
            autoFocus
          />
          <button type="submit" className="budget-save-btn" disabled={isPending}>
            {isPending ? 'Menyimpan...' : 'Simpan'}
          </button>
        </form>
      )}

      {hasBudget && !editing && (
        <>
          <div className="budget-primary-stat">
            {isDanger ? (
              <div className="budget-status-danger">
                Melebihi budget sebesar <strong>{formatRupiah(Math.abs(sisa))}</strong>
              </div>
            ) : isWarning ? (
              <div className="budget-status-warning">
                <strong>{formatRupiah(sisa)}</strong> tersisa
              </div>
            ) : (
              <div className="budget-status-ok">
                <strong>{formatRupiah(sisa)}</strong> tersisa
              </div>
            )}
            <div className="budget-supporting">
              {formatRupiah(spent)} digunakan dari {formatRupiah(budget)}
            </div>
          </div>

          <div className="budget-track">
            <div
              className={`budget-fill ${isDanger ? 'fill-danger' : isWarning ? 'fill-warning' : 'fill-ok'}`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>

          <div className="budget-numbers">
            <span>{hasBudget && budget > 0 ? Math.round((spent / budget) * 100) : 0}% digunakan</span>
            {isDanger ? (
              <span className="status-danger-text">
                Lebih {formatRupiah(Math.abs(sisa))}
              </span>
            ) : (
              <span>{formatRupiah(sisa)} tersisa</span>
            )}
          </div>
        </>
      )}

      {!hasBudget && !editing && (
        <div className="budget-empty-hint">
          Belum ada budget untuk bulan ini.
        </div>
      )}
    </div>
  );
}
