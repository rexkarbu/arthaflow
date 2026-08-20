'use client';

import { useState, useMemo, useTransition } from 'react';
import { Trash2, Search, X, Edit2, Check, Download, Repeat } from 'lucide-react';
import { deleteExpense, updateExpense } from '@/app/actions';

function formatRupiah(n) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(n);
}

export default function ExpenseList({
  expenses = [],
  expenseCategories = [],
  incomeCategories = [],
  mode = 'full' // 'full' or 'preview'
}) {
  const [query, setQuery] = useState('');
  const [activeCat, setActiveCat] = useState('Semua');
  const [editId, setEditId] = useState(null);
  const [displayLimit, setDisplayLimit] = useState(10);
  const [isPending, startTransition] = useTransition();

  const isPreview = mode === 'preview';

  const usedCategories = useMemo(() => {
    const cats = new Set(expenses.map(e => e.category || 'Lainnya'));
    return ['Semua', ...Array.from(cats).sort()];
  }, [expenses]);

  // In full mode: filter across all transactions for the selected month
  const filtered = useMemo(() => {
    if (isPreview) return expenses;
    return expenses.filter(e => {
      const matchCat = activeCat === 'Semua' || e.category === activeCat;
      const matchText = e.description.toLowerCase().includes(query.toLowerCase());
      return matchCat && matchText;
    });
  }, [expenses, query, activeCat, isPreview]);

  // In preview mode: maximum 10 items. In full mode: progressive slice (10 per batch)
  const visibleExpenses = useMemo(() => {
    if (isPreview) {
      return expenses.slice(0, 10);
    }
    return filtered.slice(0, displayLimit);
  }, [expenses, filtered, displayLimit, isPreview]);

  const filteredExpense = filtered.filter(e => e.type !== 'income').reduce((s, e) => s + e.amount, 0);
  const filteredIncome = filtered.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);

  function handleQueryChange(val) {
    setQuery(val);
    setDisplayLimit(10); // Reset visible count on search change
  }

  function handleCategoryChange(val) {
    setActiveCat(val);
    setDisplayLimit(10); // Reset visible count on category change
  }

  function handleEditSubmit(fd) {
    startTransition(async () => {
      await updateExpense(fd);
      setEditId(null);
    });
  }

  // Exports the entire filtered dataset across the month
  function exportToCSV() {
    const headers = ['ID,Tanggal,Tipe,Kategori,Keterangan,Catatan,Jumlah (Rp)'];
    const rows = filtered.map(e =>
      `${e.id},"${e.dateStr}","${e.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}","${e.category || 'Lainnya'}","${e.description}","${e.notes || ''}",${e.amount}`
    );
    const csvContent = headers.concat(rows).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ArthaFlow_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="txn-register-section">
      {/* Full Mode Toolbar (Search, Category Select, CSV Export) */}
      {!isPreview && (
        <>
          <div className="filter-bar">
            <div className="search-box">
              <Search size={14} className="search-icon" />
              <input
                type="text"
                className="search-input"
                placeholder="Cari transaksi..."
                value={query}
                onChange={e => handleQueryChange(e.target.value)}
              />
              {query && (
                <button className="search-clear" onClick={() => handleQueryChange('')} aria-label="Hapus pencarian">
                  <X size={12} />
                </button>
              )}
            </div>

            <select
              className="cat-select"
              value={activeCat}
              onChange={(e) => handleCategoryChange(e.target.value)}
              aria-label="Filter kategori"
            >
              <option value="Semua">Semua kategori</option>
              {usedCategories.filter(c => c !== 'Semua').map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            {filtered.length > 0 && (
              <button onClick={exportToCSV} title="Export CSV" className="csv-btn">
                <Download size={11} /> CSV
              </button>
            )}
          </div>

          {/* Result info header */}
          <div className="list-head">
            <span className="list-title">
              {filtered.length > 10 ? (
                `Menampilkan ${visibleExpenses.length} dari ${filtered.length} transaksi`
              ) : (
                `${filtered.length} transaksi`
              )}
            </span>
            <div className="list-actions">
              <span className="list-count">
                {filteredIncome > 0 && (
                  <span className="list-count-income">+{formatRupiah(filteredIncome)}</span>
                )}
                {filteredIncome > 0 && filteredExpense > 0 && <span> · </span>}
                {filteredExpense > 0 && (
                  <span className="list-count-expense">-{formatRupiah(filteredExpense)}</span>
                )}
              </span>
            </div>
          </div>
        </>
      )}

      {/* Transaction Register Rows */}
      {visibleExpenses.length === 0 ? (
        <div className="empty">
          {expenses.length === 0
            ? 'Belum ada transaksi di bulan ini.'
            : 'Tidak ada transaksi yang cocok dengan pencarian.'}
        </div>
      ) : (
        <div className="expense-list">
          {visibleExpenses.map((exp) => {
            const isEditing = editId === exp.id;

            if (isEditing) {
              return (
                <div key={exp.id} className="edit-form">
                  <form action={handleEditSubmit}>
                    <input type="hidden" name="id" value={exp.id} />
                    <div className="edit-form-row">
                      <select
                        name="type"
                        className="input edit-input-sm"
                        defaultValue={exp.type || 'expense'}
                      >
                        <option value="expense">Pengeluaran</option>
                        <option value="income">Pemasukan</option>
                      </select>
                      <input
                        type="text"
                        name="description"
                        className="input edit-input-sm"
                        defaultValue={exp.description}
                        required
                        style={{ flex: 1 }}
                      />
                      <select
                        name="category"
                        className="input edit-input-sm"
                        defaultValue={exp.category || 'Lainnya'}
                      >
                        <option value={exp.category}>{exp.category}</option>
                        <optgroup label="Pengeluaran">
                          {expenseCategories.filter(c => c.name !== exp.category).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </optgroup>
                        <optgroup label="Pemasukan">
                          {incomeCategories.filter(c => c.name !== exp.category).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </optgroup>
                      </select>
                    </div>
                    <div className="edit-form-row">
                      <input
                        type="text"
                        name="notes"
                        className="input edit-input-sm"
                        defaultValue={exp.notes || ''}
                        placeholder="Catatan (opsional)"
                        style={{ flex: 1 }}
                      />
                    </div>
                    <div className="edit-form-row edit-form-row--actions">
                      <div className="recurring-field">
                        <input
                          type="checkbox"
                          name="is_recurring"
                          id={`rec-${exp.id}`}
                          defaultChecked={!!exp.is_recurring}
                        />
                        <label htmlFor={`rec-${exp.id}`}>
                          <Repeat size={11} className="rec-icon" /> Rutin
                        </label>
                      </div>
                      <input
                        type="number"
                        name="amount"
                        className="input edit-input-sm"
                        defaultValue={exp.amount}
                        min="1"
                        required
                        style={{ flex: 1 }}
                      />
                      <button type="submit" className="budget-save-btn btn-save-sm" disabled={isPending}>
                        <Check size={12} /> Simpan
                      </button>
                      <button type="button" className="btn-cancel btn-cancel-sm" onClick={() => setEditId(null)}>
                        Batal
                      </button>
                    </div>
                  </form>
                </div>
              );
            }

            return (
              <div key={exp.id} className="expense-item">
                <div className="expense-info">
                  <div className="expense-desc">
                    {exp.description}
                  </div>
                  {exp.notes && (
                    <div className="expense-notes">{exp.notes}</div>
                  )}
                  <div className="expense-meta">
                    <span>{exp.category || 'Lainnya'}</span>
                    <span className="expense-meta-sep">&middot;</span>
                    <span>{isPreview ? (exp.shortDateStr || exp.dateStr) : exp.dateStr}</span>
                    {exp.is_recurring === 1 && (
                      <>
                        <span className="expense-meta-sep">&middot;</span>
                        <span className="recurring-badge">
                          <Repeat size={10} /> Rutin
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="expense-right">
                  <div className={`expense-amount ${exp.type === 'income' ? 'expense-amount--income' : ''}`}>
                    {exp.type === 'income' ? '+' : '-'}{formatRupiah(exp.amount)}
                  </div>
                  <div className="expense-actions">
                    <button type="button" className="btn-action" title="Edit transaksi" onClick={() => setEditId(exp.id)}>
                      <Edit2 size={13} />
                    </button>
                    <form action={deleteExpense.bind(null, exp.id)}>
                      <button type="submit" className="btn-action btn-action--danger" title="Hapus transaksi">
                        <Trash2 size={13} />
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Full Mode: Load More Pagination Controls */}
          {!isPreview && filtered.length > displayLimit && (
            <div className="txn-load-more">
              <button
                type="button"
                className="txn-load-more-btn"
                onClick={() => setDisplayLimit(prev => prev + 10)}
              >
                Lihat 10 lainnya ↓
              </button>
            </div>
          )}

          {!isPreview && filtered.length > 10 && visibleExpenses.length >= filtered.length && (
            <div className="txn-load-more">
              <span className="txn-all-loaded-text">Semua {filtered.length} transaksi ditampilkan</span>
              <button
                type="button"
                className="txn-collapse-btn"
                onClick={() => setDisplayLimit(10)}
              >
                Tampilkan lebih sedikit ↑
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
