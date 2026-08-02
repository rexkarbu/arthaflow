'use client';

import { useState, useMemo, useTransition } from 'react';
import { Trash2, Search, X, Edit2, Check, Download, Utensils, Car, Gamepad2, ShoppingBag, Wallet, Receipt } from 'lucide-react';
import { deleteExpense, updateExpense } from '@/app/actions';

function getCategoryIcon(cat, type) {
  if (type === 'income') return <Wallet size={16} />;
  switch(cat) {
    case 'Makanan': return <Utensils size={16} />;
    case 'Transportasi': return <Car size={16} />;
    case 'Hiburan': return <Gamepad2 size={16} />;
    case 'Belanja': return <ShoppingBag size={16} />;
    default: return <Receipt size={16} />;
  }
}

// Static categories removed, using dynamic categories

function formatRupiah(n) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(n);
}

export default function ExpenseList({ expenses, expenseCategories = [], incomeCategories = [] }) {
  const [query, setQuery]       = useState('');
  const [activeCat, setActiveCat] = useState('Semua');
  const [editId, setEditId]     = useState(null);
  const [isPending, startTransition] = useTransition();

  const usedCategories = useMemo(() => {
    const cats = new Set(expenses.map(e => e.category || 'Lainnya'));
    return ['Semua', ...Array.from(cats).sort()];
  }, [expenses]);

  const filtered = useMemo(() => {
    return expenses.filter(e => {
      const matchCat  = activeCat === 'Semua' || e.category === activeCat;
      const matchText = e.description.toLowerCase().includes(query.toLowerCase());
      return matchCat && matchText;
    });
  }, [expenses, query, activeCat]);

  const filteredExpense = filtered.filter(e => e.type !== 'income').reduce((s, e) => s + e.amount, 0);
  const filteredIncome  = filtered.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);

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
    link.setAttribute('download', `ArthaFlow_Pengeluaran_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }


  return (
    <main>
      {/* Filter bar */}
      <div className="filter-bar">
        {/* Search */}
        <div className="search-box">
          <Search size={14} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Cari pengeluaran..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button className="search-clear" onClick={() => setQuery('')}>
              <X size={12} />
            </button>
          )}
        </div>

        {/* Category tabs */}
        <div className="cat-tabs" style={{ overflowX: 'auto', paddingBottom: '0.5rem' }}>
          {usedCategories.map(cat => (
            <button
              key={cat}
              className={`cat-tab ${activeCat === cat ? 'active' : ''}`}
              onClick={() => setActiveCat(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Result info */}
      <div className="list-head">
        <span className="list-title">
          {activeCat !== 'Semua' || query ? 'Hasil Filter' : 'Riwayat'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span className="list-count">
          {filtered.length} entri
            {filteredIncome > 0 && (
              <span style={{ color: '#28a745' }}> · +{formatRupiah(filteredIncome)}</span>
            )}
            {filteredExpense > 0 && (
              <span style={{ color: 'var(--danger)' }}> · -{formatRupiah(filteredExpense)}</span>
            )}
          </span>
          {filtered.length > 0 && (
            <button
              onClick={exportToCSV}
              title="Download CSV"
              style={{
                background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)',
                padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem'
              }}
              onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--cyan)'; e.currentTarget.style.color = 'var(--cyan)' }}
              onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)' }}
            >
              <Download size={13} /> Export
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
          {filtered.map(exp => {
            const isEditing = editId === exp.id;
            
            if (isEditing) {
              return (
                <div key={exp.id} className={`expense-item c-${exp.category || 'Lainnya'}`} style={{ padding: '0.75rem', display: 'block' }}>
                  <form action={handleEditSubmit} className="edit-inline-form">
                    <input type="hidden" name="id" value={exp.id} />
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <select
                        name="type"
                        className="input"
                        defaultValue={exp.type || 'expense'}
                        style={{ padding: '0.4rem', fontSize: '0.85rem', width: 'auto' }}
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
                        style={{ padding: '0.4rem', fontSize: '0.85rem' }}
                      />
                      <select
                        name="category"
                        className="input"
                        defaultValue={exp.category || 'Lainnya'}
                        style={{ padding: '0.4rem', fontSize: '0.85rem', width: 'auto' }}
                      >
                        {/* We add the current category in case it was deleted from db */}
                        <option value={exp.category}>{exp.category}</option>
                        <optgroup label="Pengeluaran">
                          {expenseCategories.filter(c => c.name !== exp.category).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </optgroup>
                        <optgroup label="Pemasukan">
                          {incomeCategories.filter(c => c.name !== exp.category).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </optgroup>
                      </select>
                    </div>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <input
                      type="text"
                      name="notes"
                      className="input"
                      defaultValue={exp.notes || ''}
                      placeholder="Catatan (opsional)"
                      style={{ padding: '0.4rem', fontSize: '0.82rem', width: '100%' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <input
                      type="checkbox"
                      name="is_recurring"
                      id={`rec-${exp.id}`}
                      defaultChecked={!!exp.is_recurring}
                      style={{ width: '14px', height: '14px', accentColor: 'var(--cyan)', cursor: 'pointer' }}
                    />
                    <label htmlFor={`rec-${exp.id}`} style={{ fontSize: '0.78rem', color: 'var(--text-dim)', cursor: 'pointer' }}>🔄 Rutin tiap bulan</label>
                  </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="number"
                        name="amount"
                        className="input"
                        defaultValue={exp.amount}
                        min="1"
                        required
                        style={{ padding: '0.4rem', fontSize: '0.85rem', flex: 1 }}
                      />
                      <button type="submit" className="budget-save-btn" disabled={isPending} style={{ padding: '0.4rem 0.8rem' }}>
                        <Check size={14} /> Simpan
                      </button>
                      <button type="button" className="btn-del" onClick={() => setEditId(null)}>
                        Batal
                      </button>
                    </div>
                  </form>
                </div>
              );
            }

            return (
              <div key={exp.id} className={`expense-item c-${exp.category || 'Lainnya'}`}>
                <div className="expense-icon">
                  {getCategoryIcon(exp.category, exp.type)}
                </div>
                <div className="expense-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <div className="expense-desc">{exp.description}</div>
                    {exp.is_recurring === 1 && (
                      <span title="Pengeluaran Rutin" style={{ fontSize: '0.7rem', background: 'var(--accent-muted)', color: 'var(--text-sub)', padding: '0.1rem 0.35rem', borderRadius: '3px', whiteSpace: 'nowrap' }}>🔄 Rutin</span>
                    )}
                  </div>
                  {exp.notes && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.15rem', fontStyle: 'italic' }}>
                      📝 {exp.notes}
                    </div>
                  )}
                  <div className="expense-meta">
                    {exp.category || 'Lainnya'} &middot; {exp.dateStr}
                  </div>
                </div>
                <div className="expense-right">
                  <div className="expense-amount" style={{ color: exp.type === 'income' ? '#28a745' : '' }}>
                    {exp.type === 'income' ? '+' : ''}{formatRupiah(exp.amount)}
                  </div>
                  <div style={{ display: 'flex', gap: '0.2rem' }}>
                    <button type="button" className="btn-del" title="Edit" onClick={() => setEditId(exp.id)}>
                      <Edit2 size={14} />
                    </button>
                    <form action={deleteExpense.bind(null, exp.id)}>
                      <button type="submit" className="btn-del" title="Hapus">
                        <Trash2 size={14} />
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
