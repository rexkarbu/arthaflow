import { getExpenses, addExpense, getBudget, getAuthSession, seedRecurringExpenses, getCategories, getGoals } from './actions';
import { cookies } from 'next/headers'; // used internally by getAuthSession
import { Utensils, Bus, Gamepad2, ShoppingBag, MoreHorizontal } from 'lucide-react';
import ExpenseList from '@/components/ExpenseList';
import BudgetBar from '@/components/BudgetBar';
import ExpenseChart from '@/components/ExpenseChart';
import TrendChart from '@/components/TrendChart';
import MonthPicker from '@/components/MonthPicker';
import LoginForm from '@/components/LoginForm';
import LogoutButton from '@/components/LogoutButton';
import ThemeToggle from '@/components/ThemeToggle';
import ExpenseForm from '@/components/ExpenseForm';
import AnimatedNumber from '@/components/AnimatedNumber';
import FinancialGoals from '@/components/FinancialGoals';
import ExportPdfButton from '@/components/ExportPdfButton';
import './globals.css';

export const metadata = {
  title: 'Pengeluaran',
  description: 'Catatan pengeluaran pribadi',
};

function formatRupiah(n) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(n);
}

function CategoryIcon({ category, size = 16 }) {
  const props = { size };
  switch (category) {
    case 'Makanan':      return <Utensils {...props} />;
    case 'Transportasi': return <Bus {...props} />;
    case 'Hiburan':      return <Gamepad2 {...props} />;
    case 'Belanja':      return <ShoppingBag {...props} />;
    default:             return <MoreHorizontal {...props} />;
  }
}

export default async function Home(props) {
  const userId = await getAuthSession();
  if (!userId) {
    return <LoginForm />;
  }

  const searchParams = await props.searchParams;
  const monthParam = searchParams?.month;

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const selectedMonth = monthParam || currentMonth;

  // Seed recurring expenses for selected month (auto-populate from previous month)
  await seedRecurringExpenses(selectedMonth);

  const rawExpenses = await getExpenses();
  const expenseCategories = await getCategories('expense');
  const incomeCategories = await getCategories('income');
  const goals = await getGoals();
  
  // Calculate all-time total savings (for goals progress)
  let allTimeIncome = 0;
  let allTimeExpense = 0;
  rawExpenses.forEach(e => {
    if (e.type === 'income') allTimeIncome += e.amount;
    else allTimeExpense += e.amount;
  });
  const totalSavings = allTimeIncome - allTimeExpense;
  
  const [year, month] = selectedMonth.split('-');
  const dateObj = new Date(parseInt(year), parseInt(month) - 1);
  const monthLabel = dateObj.toLocaleString('id-ID', { month: 'long', year: 'numeric' });

  const reportDate = new Date(parseInt(year), parseInt(month) - 2, 1);
  const reportMonth = `${reportDate.getFullYear()}-${String(reportDate.getMonth() + 1).padStart(2, '0')}`;
  const reportMonthLabel = reportDate.toLocaleString('id-ID', { month: 'long', year: 'numeric' });

  const compareDate = new Date(parseInt(year), parseInt(month) - 3, 1);
  const compareMonth = `${compareDate.getFullYear()}-${String(compareDate.getMonth() + 1).padStart(2, '0')}`;
  const compareMonthLabel = compareDate.toLocaleString('id-ID', { month: 'long', year: 'numeric' });

  // Filter raw expenses by selected month
  const expenses = rawExpenses
    .filter(e => e.date.startsWith(selectedMonth))
    .map(e => ({
      ...e,
      dateStr: new Date(e.date).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
    }));

  const reportExpenses = rawExpenses.filter(e => e.date.startsWith(reportMonth));
  const compareExpenses = rawExpenses.filter(e => e.date.startsWith(compareMonth));

  const reportIncome = reportExpenses.reduce((sum, e) => e.type === 'income' ? sum + e.amount : sum, 0);
  const reportExpense = reportExpenses.reduce((sum, e) => e.type === 'income' ? sum : sum + e.amount, 0);
  const reportBalance = reportIncome - reportExpense;

  const previousExpense = compareExpenses.reduce((sum, e) => e.type === 'income' ? sum : sum + e.amount, 0);
  const expenseDiff = reportExpense - previousExpense;
  const expenseDiffPct = previousExpense > 0 ? Math.round((expenseDiff / previousExpense) * 100) : 0;

  const reportByCategory = reportExpenses.reduce((acc, e) => {
    if (e.type === 'income') return acc;
    const c = e.category || 'Lainnya';
    acc[c] = (acc[c] || 0) + e.amount;
    return acc;
  }, {});

  const topReportCategory = Object.entries(reportByCategory)
    .sort(([, a], [, b]) => b - a)[0];

  const savingPct = reportIncome > 0 ? Math.round((reportBalance / reportIncome) * 100) : 0;
  const savingTrendLabel = reportBalance >= 0 ? 'Hemat' : 'Boros';
  const spendingTrendLabel = expenseDiff > 0
    ? `Naik ${Math.abs(expenseDiffPct)}%`
    : expenseDiff < 0
      ? `Turun ${Math.abs(expenseDiffPct)}%`
      : 'Tetap sama';

  // Budget
  const budget = await getBudget(selectedMonth);

  // Hitung total keseluruhan berdasarkan filter
  let totalIncome = 0;
  let totalExpense = 0;
  
  expenses.forEach(e => {
    if (e.type === 'income') {
      totalIncome += e.amount;
    } else {
      totalExpense += e.amount;
    }
  });

  const balance = totalIncome - totalExpense;

  // Hitung pengeluaran untuk budget bar
  const monthSpent = totalExpense;

  // Total khusus hari ini
  const todayStr = now.toISOString().slice(0, 10);
  const todayExpense = expenses
    .filter(e => e.date.startsWith(todayStr) && e.type !== 'income')
    .reduce((sum, e) => sum + e.amount, 0);

  const byCategory = expenses.reduce((acc, e) => {
    if (e.type === 'income') return acc;
    const c = e.category || 'Lainnya';
    acc[c] = (acc[c] || 0) + e.amount;
    return acc;
  }, {});

  // Data for Trend Chart
  const trendDataMap = {};
  rawExpenses.forEach(e => {
    const monthKey = e.date.slice(0, 7); // YYYY-MM
    if (!trendDataMap[monthKey]) {
      trendDataMap[monthKey] = { income: 0, expense: 0 };
    }
    if (e.type === 'income') {
      trendDataMap[monthKey].income += e.amount;
    } else {
      trendDataMap[monthKey].expense += e.amount;
    }
  });

  const trendData = Object.keys(trendDataMap).sort().map(key => {
    const [y, m] = key.split('-');
    const dateObj = new Date(parseInt(y), parseInt(m) - 1);
    const monthName = dateObj.toLocaleString('id-ID', { month: 'short', year: '2-digit' });
    return {
      month: monthName,
      income: trendDataMap[key].income,
      expense: trendDataMap[key].expense
    };
  });

  const printReportDate = new Date().toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  const printCategoryRows = Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .map(([cat, amt]) => ({
      category: cat,
      amount: amt,
      pct: totalExpense > 0 ? Math.round((amt / totalExpense) * 100) : 0
    }));

  const printTransactionRows = [...expenses]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map(e => ({
      ...e,
      typeLabel: e.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
      amountLabel: e.type === 'income' ? `+${formatRupiah(e.amount)}` : `-${formatRupiah(e.amount)}`
    }));

  return (
    <div className="wrap">

      {/* Header */}
      <header className="site-header">
        <div>
          <h1 className="site-title">ArthaFlow<span>.</span></h1>
          <span className="site-badge">Catatan Keuangan</span>
        </div>
        <div className="site-header-right">
          <MonthPicker currentMonth={selectedMonth} />
          <ExportPdfButton />
          <ThemeToggle />
          <LogoutButton />
        </div>
      </header>

      <div className="print-report-header">
        <div className="print-brand">
          <img src="/arthaflow-brand.svg" alt="ArthaFlow" className="print-brand-logo-image" />
          <div>
            <div className="print-brand-title">Laporan Keuangan Bulanan</div>
            <div className="print-company-name">ArthaFlow</div>
            <div className="print-brand-subtitle">Periode: {monthLabel}</div>
          </div>
        </div>
        <div className="print-report-meta">
          <div>
            <span>Filter Bulan</span>
            <strong>{monthLabel}</strong>
          </div>
          <div>
            <span>Tanggal Cetak</span>
            <strong>{printReportDate}</strong>
          </div>
        </div>
      </div>

      <div className="print-report-summary">
        <div className="print-summary-card">
          <span>Pemasukan</span>
          <strong>{formatRupiah(totalIncome)}</strong>
        </div>
        <div className="print-summary-card">
          <span>Pengeluaran</span>
          <strong>{formatRupiah(totalExpense)}</strong>
        </div>
        <div className="print-summary-card">
          <span>Saldo</span>
          <strong>{formatRupiah(balance)}</strong>
        </div>
      </div>

      <div className="print-report-table">
        <div className="print-section-title">Ringkasan Kategori</div>
        <table>
          <thead>
            <tr>
              <th>Kategori</th>
              <th>Jumlah</th>
              <th>Persentase</th>
            </tr>
          </thead>
          <tbody>
            {printCategoryRows.map(row => (
              <tr key={row.category}>
                <td>{row.category}</td>
                <td>{formatRupiah(row.amount)}</td>
                <td>{row.pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="print-report-detail">
        <div className="print-section-title">Detail Transaksi Per Bulan</div>
        <table>
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Kategori</th>
              <th>Deskripsi</th>
              <th>Jenis</th>
              <th>Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {printTransactionRows.map(row => (
              <tr key={`${row.id}-${row.date}`}>
                <td>{new Date(row.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                <td>{row.category || 'Lainnya'}</td>
                <td>{row.description || 'Tanpa deskripsi'}</td>
                <td>{row.typeLabel}</td>
                <td>{row.amountLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="print-report-footer">
        <div className="print-footer-grid">
          <div>
            <span>Disetujui oleh</span>
            <strong className="print-approved-by-value">Manajer Keuangan</strong>
          </div>
          <div>
            <span>Dibuat pada</span>
            <strong>{printReportDate}</strong>
          </div>
        </div>
        <div className="print-footer-notes">
          <span>Catatan</span>
          <div className="print-notes-value">Laporan disiapkan untuk keperluan audit internal dan arsip akuntansi.</div>
        </div>
      </div>

      {/* Ringkasan */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="total-card" style={{ marginBottom: 0 }}>
          <div>
            <div className="total-label" style={{ color: 'var(--success)' }}>Total Pemasukan</div>
            <div className="total-amount">
              <span>Rp</span>
              <AnimatedNumber value={totalIncome} />
            </div>
          </div>
        </div>
        <div className="total-card" style={{ marginBottom: 0 }}>
          <div>
            <div className="total-label" style={{ color: 'var(--danger)' }}>Total Pengeluaran</div>
            <div className="total-amount">
              <span>Rp</span>
              <AnimatedNumber value={totalExpense} />
            </div>
          </div>
          <div className="total-meta" style={{ marginTop: '0.5rem' }}>
            <div>Hari ini: <strong>{formatRupiah(todayExpense)}</strong></div>
          </div>
        </div>
        <div className="total-card" style={{ marginBottom: 0 }}>
          <div>
            <div className="total-label" style={{ color: 'var(--text-sub)' }}>Saldo Sisa</div>
            <div className="total-amount">
              <span>Rp</span>
              <AnimatedNumber value={balance} />
            </div>
          </div>
          <div className="total-meta" style={{ marginTop: '0.5rem' }}>
            <div>Total entri: <strong>{expenses.length}</strong></div>
          </div>
        </div>
      </div>

      {/* Budget bulan ini */}
      <BudgetBar
        month={selectedMonth}
        monthLabel={monthLabel}
        budget={budget}
        spent={monthSpent}
      />

      {/* Main */}
      <div className="main-grid">

        {/* Sidebar */}
        <aside>
          {/* Form */}
          <ExpenseForm expenseCategories={expenseCategories} incomeCategories={incomeCategories} />

          <div className="card report-card">
            <div className="card-head">Laporan Bulanan Otomatis</div>
            <div className="card-body">
              <div className="report-header">
                <div>
                  <div className="report-period">{reportMonthLabel}</div>
                  <div className="report-pill">{savingTrendLabel}</div>
                </div>
                <div className="report-percent">{Math.abs(savingPct)}%</div>
              </div>

              <div className="report-grid">
                <div>
                  <div className="report-label">Kategori terboros</div>
                  <div className="report-value">
                    {topReportCategory ? topReportCategory[0] : 'Belum ada data'}
                  </div>
                </div>
                <div>
                  <div className="report-label">Pengeluaran</div>
                  <div className="report-value">{formatRupiah(reportExpense)}</div>
                </div>
                <div>
                  <div className="report-label">Pemasukan</div>
                  <div className="report-value">{formatRupiah(reportIncome)}</div>
                </div>
                <div>
                  <div className="report-label">Selisih</div>
                  <div className={`report-value ${reportBalance >= 0 ? 'report-positive' : 'report-negative'}`}>
                    {reportBalance >= 0 ? '+' : '-'}{formatRupiah(Math.abs(reportBalance))}
                  </div>
                </div>
              </div>

              <div className="report-compare">
                <span>Bandingkan dengan {compareMonthLabel}</span>
                <strong>{spendingTrendLabel}</strong>
              </div>
            </div>
          </div>

          <ExpenseChart expenses={expenses} />
          
          <TrendChart data={trendData} />

          <FinancialGoals goals={goals} totalSavings={totalSavings} />

          {/* Stats */}
          {expenses.length > 0 && (
            <div className="card">
              <div className="card-head">Breakdown</div>
              <div className="card-body">
                <div className="stat-row">
                  {Object.entries(byCategory)
                    .sort(([,a],[,b]) => b - a)
                    .map(([cat, amt]) => {
                      const pct = totalExpense > 0 ? Math.round((amt / totalExpense) * 100) : 0;
                      const categorySlug = encodeURIComponent(cat);
                      return (
                        <a key={cat} className="stat-item stat-link" href={`/kategori/${categorySlug}`}>
                          <div className="stat-top">
                            <div className={`stat-name icon-${cat}`}>
                              <CategoryIcon category={cat} size={13} />
                              <span>{cat}</span>
                            </div>
                            <span className="stat-pct">{pct}%</span>
                          </div>
                          <div className="bar-track">
                            <div className={`bar-fill fill-${cat}`} style={{ width: `${pct}%` }} />
                          </div>
                        </a>
                      );
                    })}
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* List */}
        <ExpenseList expenses={expenses} expenseCategories={expenseCategories} incomeCategories={incomeCategories} />

      </div>
    </div>
  );
}
