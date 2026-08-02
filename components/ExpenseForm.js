'use client';

import { useState, useRef } from 'react';
import { addExpense, addCategory } from '@/app/actions';

export default function ExpenseForm({ expenseCategories = [], incomeCategories = [] }) {
  const [type, setType] = useState('expense'); // 'expense' | 'income'
  const [loading, setLoading] = useState(false);
  const [showNewCat, setShowNewCat] = useState(false);
  const formRef = useRef(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget;
    const fd = new FormData(form);
    
    // If adding a new category
    if (showNewCat) {
      const newCat = fd.get('new_category')?.trim();
      if (newCat) {
        fd.set('category', newCat); // replace the '__NEW__' value
        const catFd = new FormData();
        catFd.append('name', newCat);
        catFd.append('type', type);
        await addCategory(catFd); // save category to DB
      } else {
        fd.set('category', 'Lainnya');
      }
    }

    await addExpense(fd);
    form.reset();
    setShowNewCat(false);
    setLoading(false);
  }

  const activeCategories = type === 'expense' ? expenseCategories : incomeCategories;

  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <div className="card-head">
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button 
            type="button"
            onClick={() => setType('expense')}
            style={{ 
              background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem',
              color: type === 'expense' ? 'var(--text)' : 'var(--text-dim)',
              borderBottom: type === 'expense' ? '2px solid var(--danger)' : '2px solid transparent',
              paddingBottom: '0.2rem'
            }}
          >
            Pengeluaran
          </button>
          <button 
            type="button"
            onClick={() => setType('income')}
            style={{ 
              background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem',
              color: type === 'income' ? 'var(--text)' : 'var(--text-dim)',
              borderBottom: type === 'income' ? '2px solid #28a745' : '2px solid transparent',
              paddingBottom: '0.2rem'
            }}
          >
            Pemasukan
          </button>
        </div>
      </div>
      <div className="card-body">
        <form onSubmit={handleSubmit}>
          <input type="hidden" name="type" value={type} />

          <div className="field">
            <label htmlFor="description" className="label">Keterangan</label>
            <input
              type="text"
              id="description"
              name="description"
              className="input"
              placeholder={type === 'expense' ? "cth. Makan siang" : "cth. Gaji bulanan"}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="category" className="label">Kategori</label>
            {!showNewCat ? (
              <select 
                id="category" 
                name="category" 
                className="input" 
                onChange={(e) => {
                  if (e.target.value === '__NEW__') setShowNewCat(true);
                }}
              >
                {activeCategories.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
                <option value="__NEW__" style={{ fontWeight: 'bold', color: 'var(--cyan)' }}>+ Tambah Baru...</option>
              </select>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="text" 
                  name="new_category" 
                  className="input" 
                  placeholder="Ketik kategori baru..." 
                  autoFocus 
                  required
                />
                <input type="hidden" name="category" value="__NEW__" />
                <button 
                  type="button" 
                  className="btn-del" 
                  onClick={() => setShowNewCat(false)}
                  style={{ padding: '0 0.8rem' }}
                >
                  Batal
                </button>
              </div>
            )}
          </div>

          <div className="field">
            <label htmlFor="amount" className="label">Jumlah (Rp)</label>
            <input
              type="number"
              id="amount"
              name="amount"
              className="input"
              placeholder="50000"
              min="1"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="notes" className="label">Catatan <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>(opsional)</span></label>
            <input
              type="text"
              id="notes"
              name="notes"
              className="input"
              placeholder="Tambahan keterangan"
            />
          </div>

          <div className="field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              id="is_recurring"
              name="is_recurring"
              style={{ width: '16px', height: '16px', accentColor: 'var(--cyan)', cursor: 'pointer' }}
            />
            <label htmlFor="is_recurring" style={{ fontSize: '0.82rem', color: 'var(--text-dim)', cursor: 'pointer', marginBottom: 0 }}>
              🔄 Tandai sebagai {type === 'expense' ? 'pengeluaran' : 'pemasukan'} rutin
            </label>
          </div>

          <button type="submit" className="btn-submit" disabled={loading} style={{ background: type === 'income' ? '#28a745' : '' }}>
            {loading ? 'Menyimpan...' : `+ Tambah ${type === 'expense' ? 'Pengeluaran' : 'Pemasukan'}`}
          </button>
        </form>
      </div>
    </div>
  );
}
