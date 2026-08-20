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
  const pct = hasBudget ? Math.min(Math.round((spent / budget) * 100), 100) : 0;
  const sisa = hasBudget ? budget - spent : 0;
  const isWarning = hasBudget && pct >= 75 && pct < 100;
  const isDanger = hasBudget && pct >= 100;

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
          {editing ? 'Batal' : 'Set Budget'}
        </button>
      </div>

      {editing && (
        <form action={formAction} className="budget-form">
          <input type="hidden" name="month" value={month} />
          <input
            type="number"
            name="budget"
            className="budget-input"
            placeholder="contoh: 1000000"
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
          <div className="budget-amounts">
            {isDanger ? (
              <span className="status-danger">
                Melewati budget!
              </span>
            ) : isWarning ? (
              <span className="status-warning">
                Mendekati limit budget
              </span>
            ) : (
              <span>
                <strong>{formatRupiah(spent)}</strong> digunakan dari <strong>{formatRupiah(budget)}</strong>
              </span>
            )}
          </div>

          <div className="budget-track">
            <div
              className={`budget-fill ${isDanger ? 'fill-danger' : isWarning ? 'fill-warning' : 'fill-ok'}`}
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="budget-numbers">
            <span>{pct}% terpakai</span>
            {isDanger ? (
              <span style={{ color: 'var(--expense)' }}>
                Lebih {formatRupiah(Math.abs(sisa))}
              </span>
            ) : (
              <span>Sisa {formatRupiah(sisa)}</span>
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
