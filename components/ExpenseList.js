'use client';

import { useState, useMemo, useTransition, useEffect, useRef } from 'react';
import { Trash2, Search, X, Edit2, Check, Download, Repeat, ChevronLeft, ChevronRight } from 'lucide-react';
import { deleteExpense, updateExpense } from '@/app/actions';
import CurrencyInput from './CurrencyInput';
import { formatRupiah } from '@/lib/currency';

export default function ExpenseList({
  expenses = [],
  expenseCategories = [],
  incomeCategories = [],
  mode = 'full' // 'full' or 'preview'
}) {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'income' | 'expense'
  const [activeCat, setActiveCat] = useState('all');
  const [recurringFilter, setRecurringFilter] = useState('all'); // 'all' | 'recurring' | 'non-recurring'
  const [sortBy, setSortBy] = useState('date_desc'); // 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeRowIndex, setActiveRowIndex] = useState(null);
  const [editId, setEditId] = useState(null);
  const [isPending, startTransition] = useTransition();

  const searchInputRef = useRef(null);
  const isPreview = mode === 'preview';

  // Extract all unique categories present in the current dataset
  const usedCategories = useMemo(() => {
    const cats = new Set(expenses.map(e => e.category || 'Lainnya'));
    return Array.from(cats).sort();
  }, [expenses]);

  // 1. Filter and sort dataset
  const filteredAndSorted = useMemo(() => {
    if (isPreview) return expenses;

    // Filter pipeline: Search -> Type -> Category -> Recurring
    const result = expenses.filter(e => {
      // Search across description, category, and notes (case-insensitive)
      if (query.trim()) {
        const q = query.toLowerCase();
        const descMatch = (e.description || '').toLowerCase().includes(q);
        const catMatch = (e.category || '').toLowerCase().includes(q);
        const notesMatch = (e.notes || '').toLowerCase().includes(q);
        if (!descMatch && !catMatch && !notesMatch) return false;
      }

      // Type filter
      if (typeFilter === 'income' && e.type !== 'income') return false;
      if (typeFilter === 'expense' && e.type === 'income') return false;

      // Category filter
      if (activeCat !== 'all' && (e.category || 'Lainnya') !== activeCat) return false;

      // Recurring filter
      if (recurringFilter === 'recurring' && e.is_recurring !== 1) return false;
      if (recurringFilter === 'non-recurring' && e.is_recurring === 1) return false;

      return true;
    });

    // Sort pipeline
    result.sort((a, b) => {
      if (sortBy === 'date_desc') {
        const diff = new Date(b.date) - new Date(a.date);
        return diff !== 0 ? diff : b.id - a.id;
      }
      if (sortBy === 'date_asc') {
        const diff = new Date(a.date) - new Date(b.date);
        return diff !== 0 ? diff : a.id - b.id;
      }
      if (sortBy === 'amount_desc') {
        const diff = b.amount - a.amount;
        return diff !== 0 ? diff : new Date(b.date) - new Date(a.date);
      }
      if (sortBy === 'amount_asc') {
        const diff = a.amount - b.amount;
        return diff !== 0 ? diff : new Date(b.date) - new Date(a.date);
      }
      return 0;
    });

    return result;
  }, [expenses, query, typeFilter, activeCat, recurringFilter, sortBy, isPreview]);

  // 2. Metrics calculation across entire filtered dataset
  const filteredMetrics = useMemo(() => {
    let income = 0;
    let expense = 0;
    filteredAndSorted.forEach(e => {
      if (e.type === 'income') income += e.amount;
      else expense += e.amount;
    });
    return {
      count: filteredAndSorted.length,
      income,
      expense,
      net: income - expense
    };
  }, [filteredAndSorted]);

  // 3. Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / pageSize));
  const clampedPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedRows = useMemo(() => {
    if (isPreview) {
      return expenses.slice(0, 10);
    }
    const startIndex = (clampedPage - 1) * pageSize;
    return filteredAndSorted.slice(startIndex, startIndex + pageSize);
  }, [expenses, filteredAndSorted, clampedPage, pageSize, isPreview]);

  // Reset pagination to page 1 whenever search, filters, or sorting change
  const handleQueryChange = (val) => {
    setQuery(val);
    setCurrentPage(1);
    setActiveRowIndex(null);
  };

  const handleTypeChange = (val) => {
    setTypeFilter(val);
    setCurrentPage(1);
    setActiveRowIndex(null);
  };

  const handleCategoryChange = (val) => {
    setActiveCat(val);
    setCurrentPage(1);
    setActiveRowIndex(null);
  };

  const handleRecurringChange = (val) => {
    setRecurringFilter(val);
    setCurrentPage(1);
    setActiveRowIndex(null);
  };

  const handleSortChange = (val) => {
    setSortBy(val);
    setCurrentPage(1);
    setActiveRowIndex(null);
  };

  const handlePageSizeChange = (val) => {
    setPageSize(Number(val));
    setCurrentPage(1);
    setActiveRowIndex(null);
  };

  const handleResetFilters = () => {
    setQuery('');
    setTypeFilter('all');
    setActiveCat('all');
    setRecurringFilter('all');
    setSortBy('date_desc');
    setCurrentPage(1);
    setActiveRowIndex(null);
  };

  const isFiltered = query !== '' || typeFilter !== 'all' || activeCat !== 'all' || recurringFilter !== 'all' || sortBy !== 'date_desc';

  // Desktop keyboard shortcuts: '/', 'ArrowDown', 'ArrowUp', 'Escape', 'Enter'
  useEffect(() => {
    if (isPreview) return;

    function handleKeyDown(e) {
      const activeEl = document.activeElement;
      const isInputActive = activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.tagName === 'SELECT' ||
        activeEl.isContentEditable ||
        activeEl.closest('.dialog-overlay') ||
        activeEl.closest('.edit-form')
      );

      // '/' to focus search
      if (e.key === '/' && !isInputActive) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // Escape to blur search / clear keyboard row selection / close edit
      if (e.key === 'Escape') {
        if (activeEl === searchInputRef.current) {
          searchInputRef.current?.blur();
        }
        setActiveRowIndex(null);
        setEditId(null);
        return;
      }

      // If user is actively typing in an input, do not capture arrow keys or enter
      if (isInputActive) return;

      // ArrowDown
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveRowIndex(prev => {
          if (prev === null) return 0;
          return Math.min(prev + 1, paginatedRows.length - 1);
        });
        return;
      }

      // ArrowUp
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveRowIndex(prev => {
          if (prev === null) return 0;
          return Math.max(prev - 1, 0);
        });
        return;
      }

      // Enter to edit active row
      if (e.key === 'Enter' && activeRowIndex !== null && paginatedRows[activeRowIndex]) {
        e.preventDefault();
        setEditId(paginatedRows[activeRowIndex].id);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPreview, paginatedRows, activeRowIndex]);

  function handleEditSubmit(fd) {
    startTransition(async () => {
      await updateExpense(fd);
      setEditId(null);
    });
  }

  // Exports the ENTIRE filtered & sorted dataset across the month
  function exportToCSV() {
    const headers = ['ID,Tanggal,Tipe,Kategori,Keterangan,Catatan,Jumlah (Rp)'];
    const rows = filteredAndSorted.map(e =>
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

  const startRange = filteredAndSorted.length > 0 ? (clampedPage - 1) * pageSize + 1 : 0;
  const endRange = Math.min(startRange + pageSize - 1, filteredAndSorted.length);

  return (
    <div className="txn-register-section">
      {/* ─── FULL MODE: Filtered Metrics, Toolbar & Controls ─── */}
      {!isPreview && (
        <>
          {/* 1. Filtered Metrics Strip */}
          <div className="txn-metrics-strip">
            <div className="txn-metrics-count">
              <span>{filteredMetrics.count} transaksi</span>
            </div>
            <div className="txn-metrics-values">
              <div className="txn-metric-item">
                <span className="txn-metric-label">Pemasukan</span>
                <span className="txn-metric-val txn-metric-val--income">
                  +{formatRupiah(filteredMetrics.income)}
                </span>
              </div>
              <div className="txn-metric-item">
                <span className="txn-metric-label">Pengeluaran</span>
                <span className="txn-metric-val">
                  -{formatRupiah(filteredMetrics.expense)}
                </span>
              </div>
              <div className="txn-metric-item">
                <span className="txn-metric-label">Net</span>
                <span className={`txn-metric-val ${filteredMetrics.net < 0 ? 'txn-metric-val--expense' : ''}`}>
                  {filteredMetrics.net >= 0 ? '+' : ''}{formatRupiah(filteredMetrics.net)}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Search and Filters Toolbar */}
          <div className="filter-bar">
            {/* Search Box */}
            <div className="search-box">
              <Search size={14} className="search-icon" />
              <input
                ref={searchInputRef}
                type="text"
                className="search-input"
                placeholder="Cari transaksi... (tekan / untuk fokus)"
                value={query}
                onChange={e => handleQueryChange(e.target.value)}
                aria-label="Cari transaksi"
              />
              {query && (
                <button
                  type="button"
                  className="search-clear"
                  onClick={() => handleQueryChange('')}
                  aria-label="Hapus pencarian"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Filter Dropdowns Grid */}
            <div className="filter-controls-group">
              {/* Type Filter */}
              <select
                className="cat-select"
                value={typeFilter}
                onChange={(e) => handleTypeChange(e.target.value)}
                aria-label="Filter tipe transaksi"
              >
                <option value="all">Semua tipe</option>
                <option value="income">Pemasukan</option>
                <option value="expense">Pengeluaran</option>
              </select>

              {/* Category Filter */}
              <select
                className="cat-select"
                value={activeCat}
                onChange={(e) => handleCategoryChange(e.target.value)}
                aria-label="Filter kategori"
              >
                <option value="all">Semua kategori</option>
                {usedCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              {/* Recurring Status Filter */}
              <select
                className="cat-select"
                value={recurringFilter}
                onChange={(e) => handleRecurringChange(e.target.value)}
                aria-label="Filter status rutin"
              >
                <option value="all">Semua status</option>
                <option value="recurring">Rutin</option>
                <option value="non-recurring">Tidak rutin</option>
              </select>

              {/* Sort Order */}
              <select
                className="cat-select"
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value)}
                aria-label="Urutan transaksi"
              >
                <option value="date_desc">Terbaru dahulu</option>
                <option value="date_asc">Terlama dahulu</option>
                <option value="amount_desc">Jumlah terbesar</option>
                <option value="amount_asc">Jumlah terkecil</option>
              </select>

              {/* CSV Export Button */}
              {filteredAndSorted.length > 0 && (
                <button
                  type="button"
                  onClick={exportToCSV}
                  title={`Export ${filteredAndSorted.length} transaksi ke CSV`}
                  className="csv-btn"
                >
                  <Download size={11} /> CSV
                </button>
              )}
            </div>
          </div>

          {/* 3. Filter Result Feedback Bar */}
          <div className="txn-filter-feedback">
            <span className="txn-filter-count">
              {filteredAndSorted.length} hasil
            </span>
            {isFiltered && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="txn-reset-btn"
              >
                Reset filter
              </button>
            )}
          </div>
        </>
      )}

      {/* ─── TRANSACTION REGISTER ROWS ─── */}
      {paginatedRows.length === 0 ? (
        <div className="empty">
          {expenses.length === 0 ? (
            'Belum ada transaksi bulan ini.'
          ) : (
            <div className="empty-filter-state">
              <span>Tidak ada transaksi yang cocok dengan filter ini.</span>
              <button
                type="button"
                onClick={handleResetFilters}
                className="txn-reset-btn"
                style={{ marginTop: '0.5rem' }}
              >
                Reset filter
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="expense-list">
          {paginatedRows.map((exp, idx) => {
            const isEditing = editId === exp.id;
            const isKeyboardActive = !isPreview && activeRowIndex === idx;

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
                        aria-label="Tipe transaksi"
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
                        aria-label="Deskripsi"
                      />
                      <select
                        name="category"
                        className="input edit-input-sm"
                        defaultValue={exp.category || 'Lainnya'}
                        aria-label="Kategori"
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
                        aria-label="Catatan"
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
                      <CurrencyInput
                        name="amount"
                        className="input edit-input-sm"
                        value={exp.amount}
                        required
                        style={{ flex: 1 }}
                        aria-label="Jumlah transaksi"
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
              <div
                key={exp.id}
                className={`expense-item ${isKeyboardActive ? 'expense-item--active' : ''}`}
                onClick={() => !isPreview && setActiveRowIndex(idx)}
              >
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
                    <button
                      type="button"
                      className="btn-action"
                      title={`Edit transaksi ${exp.description}`}
                      aria-label={`Edit transaksi ${exp.description}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditId(exp.id);
                      }}
                    >
                      <Edit2 size={13} />
                    </button>
                    <form action={deleteExpense.bind(null, exp.id)} onClick={e => e.stopPropagation()}>
                      <button
                        type="submit"
                        className="btn-action btn-action--danger"
                        title={`Hapus transaksi ${exp.description}`}
                        aria-label={`Hapus transaksi ${exp.description}`}
                      >
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

      {/* ─── FULL MODE: Pagination Controls ─── */}
      {!isPreview && filteredAndSorted.length > 0 && (
        <div className="txn-pagination">
          <div className="txn-pagination-info">
            <span>Menampilkan {startRange}–{endRange} dari {filteredAndSorted.length}</span>
          </div>

          <div className="txn-pagination-controls">
            <select
              className="cat-select txn-page-size-select"
              value={pageSize}
              onChange={(e) => handlePageSizeChange(e.target.value)}
              aria-label="Jumlah transaksi per halaman"
            >
              <option value={25}>25 per halaman</option>
              <option value={50}>50 per halaman</option>
            </select>

            <div className="txn-pagination-nav">
              <button
                type="button"
                className="txn-page-btn"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={clampedPage <= 1}
                aria-label="Halaman sebelumnya"
              >
                <ChevronLeft size={13} /> Sebelumnya
              </button>
              <span className="txn-page-status">
                Halaman {clampedPage} dari {totalPages}
              </span>
              <button
                type="button"
                className="txn-page-btn"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={clampedPage >= totalPages}
                aria-label="Halaman berikutnya"
              >
                Berikutnya <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
