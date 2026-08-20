'use client';

import { useState, useTransition } from 'react';
import { setCategoryBudget, deleteCategoryBudget } from '@/app/actions';
import { formatRupiah, parseCurrency } from '@/lib/currency';
import CurrencyInput from './CurrencyInput';

function formatCompact(amount) {
  if (amount >= 1_000_000) {
    const val = amount / 1_000_000;
    return `Rp ${val % 1 === 0 ? val : val.toFixed(1)}jt`;
  }
  if (amount >= 1_000) {
    const val = amount / 1_000;
    return `Rp ${val % 1 === 0 ? val : val.toFixed(0)}rb`;
  }
  return formatRupiah(amount);
}

function CategoryBudgetRow({ month, category, budget, spent, onEditStart, isEditing, onEditCancel }) {
  const [inputVal, setInputVal] = useState(budget ? String(budget) : '');
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();

  const hasBudget = budget != null;
  const pct = hasBudget && budget > 0 ? (spent / budget) * 100 : 0;
  const isOver = hasBudget && spent > budget;
  const isAtLimit = hasBudget && spent === budget && budget > 0;
  const isWarning = hasBudget && !isOver && !isAtLimit && pct >= 80;

  const barClass = isOver || isAtLimit ? 'cat-fill-danger' : isWarning ? 'cat-fill-warning' : 'cat-fill-ok';
  const pctDisplay = hasBudget && budget > 0 ? Math.round(pct) : 0;
  const overAmount = isOver ? spent - budget : 0;

  async function handleSave(fd) {
    const amount = parseCurrency(fd.get('budget'));
    if (isNaN(amount) || amount <= 0) return;
    startTransition(async () => {
      await setCategoryBudget(fd);
      onEditCancel();
    });
  }

  async function handleDelete() {
    const fd = new FormData();
    fd.append('month', month);
    fd.append('category', category);
    startDeleteTransition(async () => {
      await deleteCategoryBudget(fd);
    });
  }

  return (
    <div className={`cat-budget-row${isEditing ? ' cat-budget-row--editing' : ''}`}>
      <div className="cat-budget-row-top">
        <span className="cat-budget-cat-name">{category}</span>
        <div className="cat-budget-row-actions">
          {hasBudget && !isEditing && (
            <>
              <button type="button" className="cat-budget-action-btn" onClick={onEditStart}>Ubah</button>
              <button
                type="button"
                className="cat-budget-action-btn cat-budget-action-btn--danger"
                onClick={handleDelete}
                disabled={isDeleting}
              >{isDeleting ? '…' : 'Hapus'}</button>
            </>
          )}
          {!hasBudget && !isEditing && (
            <button type="button" className="cat-budget-set-btn" onClick={onEditStart}>Atur budget →</button>
          )}
        </div>
      </div>

      {!isEditing && (
        <>
          <div className="cat-budget-stats">
            {hasBudget ? (
              <span className="cat-budget-amount-line">
                <span className={`cat-budget-spent${isOver ? ' cat-text-danger' : isWarning ? ' cat-text-warning' : ''}`}>
                  {formatRupiah(spent)}
                </span>
                <span className="cat-budget-sep"> / </span>
                <span className="cat-budget-limit">{formatRupiah(budget)}</span>
              </span>
            ) : (
              <span className="cat-budget-unset-label">
                {formatRupiah(spent)} digunakan · <em>Tanpa target</em>
              </span>
            )}
            {hasBudget && (
              <span className={`cat-budget-pct${isOver ? ' cat-text-danger' : isWarning ? ' cat-text-warning' : ' cat-text-muted'}`}>
                {isOver ? `Melebihi ${formatCompact(overAmount)}` : isAtLimit ? 'Terpakai penuh' : `${pctDisplay}%`}
              </span>
            )}
          </div>
          {hasBudget && (
            <div className="cat-budget-track">
              <div className={`cat-budget-fill ${barClass}`} style={{ width: `${Math.min(pctDisplay, 100)}%` }} />
            </div>
          )}
        </>
      )}

      {isEditing && (
        <form action={handleSave} className="cat-budget-inline-form">
          <input type="hidden" name="month" value={month} />
          <input type="hidden" name="category" value={category} />
          <CurrencyInput
            name="budget"
            className="cat-budget-inline-input"
            placeholder="contoh: 1.500.000"
            value={inputVal}
            onChange={(raw, formatted) => setInputVal(formatted)}
            required
            autoFocus
          />
          <div className="cat-budget-inline-actions">
            <button type="submit" className="cat-budget-save-btn" disabled={isPending}>
              {isPending ? 'Menyimpan…' : 'Simpan'}
            </button>
            <button type="button" className="cat-budget-cancel-btn" onClick={onEditCancel}>Batal</button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function CategoryBudgetManager({ month, monthLabel, categoryRows, overallBudget }) {
  const [editingCategory, setEditingCategory] = useState(null);

  const totalAllocated = categoryRows
    .filter(r => r.budget != null)
    .reduce((sum, r) => sum + r.budget, 0);

  const hasOverallBudget = overallBudget != null && overallBudget > 0;
  const allocationExceeds = hasOverallBudget && totalAllocated > overallBudget;

  return (
    <div className="cat-budget-section">
      <div className="cat-budget-header">
        <div>
          <div className="cat-budget-title">Budget Kategori</div>
          {totalAllocated > 0 && (
            <div className={`cat-budget-allocation${allocationExceeds ? ' cat-text-warning' : ' cat-text-muted'}`}>
              {formatRupiah(totalAllocated)} dialokasikan
              {hasOverallBudget ? ` dari budget bulanan ${formatRupiah(overallBudget)}` : ''}
            </div>
          )}
        </div>
      </div>

      {categoryRows.length === 0 ? (
        <div className="cat-budget-empty">
          Belum ada pengeluaran kategori bulan {monthLabel}.
        </div>
      ) : (
        <div className="cat-budget-list">
          {categoryRows.map(({ category, budget, spent }) => (
            <CategoryBudgetRow
              key={category}
              month={month}
              category={category}
              budget={budget}
              spent={spent}
              isEditing={editingCategory === category}
              onEditStart={() => setEditingCategory(category)}
              onEditCancel={() => setEditingCategory(null)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
