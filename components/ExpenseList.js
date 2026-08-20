'use client';

import { useState, useMemo, useTransition } from 'react';
import { Trash2, Search, X, Edit2, Check, Download, Repeat } from 'lucide-react';
import { deleteExpense, updateExpense } from '@/app/actions';

function formatRupiah(n) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(n);
}

export default function ExpenseList({ expenses, expenseCategories = [], incomeCategories = [] }) {
  const [query, setQuery] = useState('');
  const [activeCat, setActiveCat] = useState('Semua');
  const [editId, setEditId] = useState(null);
  const [isPending, startTransition] = useTransition();

  const usedCategories = useMemo(() => {
    const cats = new Set(expenses.map(e => e.category || 'Lainnya'));
    return ['Semua', ...Array.from(cats).sort()];
  }, [expenses]);

  const filtered = useMemo(() => {
    return expenses.filter(e => {
      const matchCat = activeCat === 'Semua' || e.category === activeCat;
      const matchText = e.description.toLowerCase().includes(query.toLowerCase());
      return matchCat && matchText;
    });
  }, [expenses, query, activeCat]);

  const filteredExpense = filtered.filter(e => e.type !== 'income').reduce((s, e) => s + e.amount, 0);
  const filteredIncome = filtered.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);

  function handleEditSubmit(fd) {
    startTransition(async () => {
      await updateExpense(fd);
      setEditId(null);
    });
  }

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
    <div>
      {/* Filter bar */}
      <div className="filter-bar">
        <div className="search-box">
          <Search size={14} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Cari transaksi..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button className="search-clear" onClick={() => setQuery('')} aria-label="Hapus pencarian">
              <X size={12} />
            </button>
          )}
        </div>

        <select
          className="input"
          value={activeCat}
          onChange={(e) => setActiveCat(e.target.value)}
          style={{ width: 'auto', minWidth: '140px', padding: '0.45rem 2rem 0.45rem 0.65rem', cursor: 'pointer' }}
          aria-label="Filter kategori"
        >
          {usedCategories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Result info */}
      <div className="list-head">
        <span className="list-title">
          {activeCat !== 'Semua' || query ? 'Hasil filter' : 'Riwayat'}
        </span>
        <div className="list-actions">
          <span className="list-count">
            {filtered.length} entri
            {filteredIncome > 0 && (
              <span style={{ color: 'var(--income)' }}> · +{formatRupiah(filteredIncome)}</span>
            )}
            {filteredExpense > 0 && (
              <span style={{ color: 'var(--expense)' }}> · -{formatRupiah(filteredExpense)}</span>
            )}
          </span>
          {filtered.length > 0 && (
            <button onClick={exportToCSV} title="Export CSV" className="csv-btn">
              <Download size={12} /> CSV
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="empty">
          {expenses.length === 0
            ? 'Belum ada transaksi di bulan ini.'
            : 'Tidak ada transaksi yang cocok dengan pencarian.'}
        </div>
      ) : (
        <div className="expense-list">
          {filtered.map((exp) => {
            const isEditing = editId === exp.id;

            if (isEditing) {
              return (
                <div key={exp.id} className="edit-form">
                  <form action={handleEditSubmit}>
                    <input type="hidden" name="id" value={exp.id} />
                    <div className="edit-form-row">
                      <select
                        name="type"
                        className="input"
                        defaultValue={exp.type || 'expense'}
                        style={{ width: 'auto', padding: '0.35rem' }}
                      >
                        <option value="expense">Pengeluaran</option>
                        <option value="income">Pemasukan</option>
                      </select>
                      <input
                        type="text"
                        name="description"
                        className="input"
                        defaultValue={exp.description}
                        required
                        style={{ flex: 1, padding: '0.35rem' }}
                      />
                      <select
                        name="category"
                        className="input"
                        defaultValue={exp.category || 'Lainnya'}
                        style={{ width: 'auto', padding: '0.35rem' }}
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
                        className="input"
                        defaultValue={exp.notes || ''}
                        placeholder="Catatan (opsional)"
                        style={{ flex: 1, padding: '0.35rem' }}
                      />
                    </div>
                    <div className="edit-form-row" style={{ alignItems: 'center' }}>
                      <div className="recurring-field">
                        <input
                          type="checkbox"
                          name="is_recurring"
                          id={`rec-${exp.id}`}
                          defaultChecked={!!exp.is_recurring}
                        />
                        <label htmlFor={`rec-${exp.id}`}>
                          <Repeat size={11} style={{ marginRight: '0.15rem', verticalAlign: '-1px' }} /> Rutin
                        </label>
                      </div>
                      <input
                        type="number"
                        name="amount"
                        className="input"
                        defaultValue={exp.amount}
                        min="1"
                        required
                        style={{ flex: 1, padding: '0.35rem' }}
                      />
                      <button type="submit" className="budget-save-btn" disabled={isPending} style={{ padding: '0.35rem 0.6rem' }}>
                        <Check size={13} /> Simpan
                      </button>
                      <button type="button" className="btn-action" onClick={() => setEditId(null)}>
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
                    <span>&middot;</span>
                    <span>{exp.dateStr}</span>
                    {exp.is_recurring === 1 && (
                      <>
                        <span>&middot;</span>
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
                    <button type="button" className="btn-action" title="Edit" onClick={() => setEditId(exp.id)}>
                      <Edit2 size={13} />
                    </button>
                    <form action={deleteExpense.bind(null, exp.id)}>
                      <button type="submit" className="btn-action btn-action--danger" title="Hapus">
                        <Trash2 size={13} />
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
