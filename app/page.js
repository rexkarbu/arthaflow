import { getExpenses, getBudget, getAuthSession, seedRecurringExpenses, getCategories, getGoals } from './actions';
import { cookies } from 'next/headers';
import Link from 'next/link';
import ExpenseList from '@/components/ExpenseList';
import BudgetBar from '@/components/BudgetBar';
import TrendChart from '@/components/TrendChart';
import MonthPicker from '@/components/MonthPicker';
import LoginForm from '@/components/LoginForm';
import LogoutButton from '@/components/LogoutButton';
import ThemeToggle from '@/components/ThemeToggle';
import TransactionDialog from '@/components/TransactionDialog';
import FinancialGoals from '@/components/FinancialGoals';
import './globals.css';

export const metadata = {
  title: 'ArthaFlow',
  description: 'Catatan keuangan pribadi',
};

function formatRupiah(n) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(n);
}

function formatWIB(isoString) {
  const d = new Date(isoString);
  d.setUTCHours(d.getUTCHours() + 7);
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const day = d.getUTCDate();
  const month = months[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  
  return `${day} ${month} ${year}, ${hours}:${minutes}`;
}

function formatMonthLabel(dateObj) {
  const longMonths = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return `${longMonths[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
}

export default async function Home(props) {
  const userId = await getAuthSession();
  if (!userId) {
    return <LoginForm />;
  }

  const searchParams = await props.searchParams;
  const monthParam = searchParams?.month;
  const isPrintMode = searchParams?.print === '1';

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const selectedMonth = monthParam || currentMonth;

  await seedRecurringExpenses(selectedMonth);

  const rawExpenses = await getExpenses();
  const expenseCategories = await getCategories('expense');
  const incomeCategories = await getCategories('income');
  const goals = await getGoals();
  
  let allTimeIncome = 0;
  let allTimeExpense = 0;
  rawExpenses.forEach(e => {
    if (e.type === 'income') allTimeIncome += e.amount;
    else allTimeExpense += e.amount;
  });
  const totalSavings = allTimeIncome - allTimeExpense;
  
  const [year, month] = selectedMonth.split('-');
  const dateObj = new Date(parseInt(year), parseInt(month) - 1);
  const monthLabel = formatMonthLabel(dateObj);

  const reportDate = new Date(parseInt(year), parseInt(month) - 2, 1);
  const reportMonth = `${reportDate.getFullYear()}-${String(reportDate.getMonth() + 1).padStart(2, '0')}`;
  const reportMonthLabel = formatMonthLabel(reportDate);

  const compareDate = new Date(parseInt(year), parseInt(month) - 3, 1);
  const compareMonth = `${compareDate.getFullYear()}-${String(compareDate.getMonth() + 1).padStart(2, '0')}`;
  const compareMonthLabel = formatMonthLabel(compareDate);

  const expenses = rawExpenses
    .filter(e => e.date.startsWith(selectedMonth))
    .map(e => ({
      ...e,
      dateStr: formatWIB(e.date)
    }));

  const reportExpenses = rawExpenses.filter(e => e.date.startsWith(reportMonth));
  const compareExpenses = rawExpenses.filter(e => e.date.startsWith(compareMonth));

  const reportIncome = reportExpenses.reduce((sum, e) => e.type === 'income' ? sum + e.amount : sum, 0);
  const reportExpense = reportExpenses.reduce((sum, e) => e.type === 'income' ? sum : sum + e.amount, 0);
  const reportBalance = reportIncome - reportExpense;

  const previousExpense = compareExpenses.reduce((sum, e) => e.type === 'income' ? sum : sum + e.amount, 0);
  const expenseDiff = reportExpense - previousExpense;
  const expenseDiffPct = previousExpense > 0 ? Math.round((expenseDiff / previousExpense) * 100) : 0;

  const budget = await getBudget(selectedMonth);

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
  const monthSpent = totalExpense;

  const budgetAmount = budget || 0;
  const budgetUsagePct = budgetAmount > 0 ? Math.round((monthSpent / budgetAmount) * 100) : 0;
  const budgetStatusLabel = budgetUsagePct > 100
    ? 'Over Budget'
    : budgetUsagePct >= 80
      ? 'Mendekati Batas'
      : 'Dalam Batas';
  const avgExpensePerTransaction = expenses.length > 0 ? Math.round(monthSpent / expenses.length) : 0;

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

  const trendDataMap = {};
  rawExpenses.forEach(e => {
    const monthKey = e.date.slice(0, 7);
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
    // Using manual format array for month names instead of toLocaleString to avoid Vercel ICU issues
    const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const monthName = `${shortMonths[parseInt(m) - 1]} '${y.slice(2)}`;
    return {
      month: monthName,
      income: trendDataMap[key].income,
      expense: trendDataMap[key].expense
    };
  });

  // Calculate monthly insight text
  let insightText = '';
  if (previousExpense > 0) {
    if (expenseDiff < 0) {
      insightText = `Pengeluaran bulan lalu turun ${Math.abs(expenseDiffPct)}% dibanding bulan sebelumnya.`;
    } else if (expenseDiff > 0) {
      insightText = `Pengeluaran bulan lalu naik ${Math.abs(expenseDiffPct)}% dibanding bulan sebelumnya.`;
    } else {
      insightText = `Pengeluaran bulan lalu sama dengan bulan sebelumnya.`;
    }
  } else {
    insightText = `Belum cukup data untuk membandingkan pengeluaran dengan bulan sebelumnya.`;
  }

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

  const reportTemplate = (
    <div className="print-report-template">
      {/* ... [PRINT TEMPLATE REMAINS EXACTLY THE SAME] ... */}
      <div className="print-report-header">
        <div className="print-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/arthaflow-brand.svg" alt="ArthaFlow official brand" className="print-brand-logo-image" />
          <div className="print-brand-body">
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

      <div className="print-report-context">
        <div className="print-report-context-card">
          <span>Kategori Terboros</span>
          <strong>{topReportCategory ? topReportCategory[0] : 'Belum ada data'}</strong>
          <small>{topReportCategory ? formatRupiah(topReportCategory[1]) : '-'}</small>
        </div>
        <div className="print-report-context-card">
          <span>Persentase Hemat</span>
          <strong>{Math.abs(savingPct)}%</strong>
          <small>{savingTrendLabel}</small>
        </div>
        <div className="print-report-context-card">
          <span>Perbandingan Bulan Lalu</span>
          <strong>{spendingTrendLabel}</strong>
          <small>{compareMonthLabel}</small>
        </div>
      </div>

      <div className="print-report-extra">
        <div className="print-report-extra-card">
          <span>Jumlah Transaksi</span>
          <strong>{expenses.length}</strong>
          <small>Seluruh entri bulan {monthLabel}</small>
        </div>
        <div className="print-report-extra-card">
          <span>Rata-rata Pengeluaran</span>
          <strong>{formatRupiah(avgExpensePerTransaction)}</strong>
          <small>Per transaksi</small>
        </div>
        <div className="print-report-extra-card">
          <span>Budget Terpakai</span>
          <strong>{budgetUsagePct}%</strong>
          <small>{formatRupiah(monthSpent)} dari {formatRupiah(budgetAmount)}</small>
        </div>
        <div className="print-report-extra-card">
          <span>Status Budget</span>
          <strong>{budgetStatusLabel}</strong>
          <small>{budgetUsagePct > 100 ? 'Melebihi target' : 'Pencapaian anggaran berjalan'}</small>
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
          <div>
            <span>Periode Laporan</span>
            <strong>{monthLabel}</strong>
          </div>
        </div>
        <div className="print-footer-notes">
          <span>Catatan</span>
          <div className="print-notes-value">Laporan disiapkan untuk keperluan audit internal dan arsip akuntansi.</div>
        </div>
      </div>
    </div>
  );

  if (isPrintMode) {
    return (
      <div className="wrap">
        {reportTemplate}
      </div>
    );
  }

  return (
    <div className="wrap">
      {/* Header */}
      <header className="site-header">
        <div>
          <h1 className="site-title">ArthaFlow<span>.</span></h1>
        </div>
        <div className="site-header-right">
          <MonthPicker currentMonth={selectedMonth} />
          <ThemeToggle />
          <LogoutButton />
        </div>
      </header>

      {/* Financial Overview (replaces the 3 cards) */}
      <div className="fin-summary">
        <div className="fin-balance-label">Saldo bulan ini</div>
        <div className="fin-balance">
          <span className="currency">Rp</span>
          {balance.toLocaleString('id-ID')}
        </div>
        
        <div className="fin-detail-row">
          <div className="fin-detail-item">
            <span className="label">Pemasukan</span>
            <span className="fin-income-val">+{formatRupiah(totalIncome)}</span>
          </div>
          <div className="fin-detail-item">
            <span className="label">Pengeluaran</span>
            <span className="fin-expense-val">-{formatRupiah(totalExpense)}</span>
          </div>
        </div>
      </div>

      {/* Budget Integration */}
      <BudgetBar
        month={selectedMonth}
        monthLabel={monthLabel}
        budget={budget}
        spent={monthSpent}
      />

      {/* Monthly Insight (replaces large Laporan Bulanan card) */}
      <div className="monthly-insight" style={{ borderLeft: '1px solid var(--border)', paddingLeft: '1rem', marginTop: '1rem' }}>
        <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Ringkasan</div>
        <div>{insightText}</div>
      </div>

      <div className="analytics-grid">
        {/* Primary Analytics (Trend/Cash flow) */}
        <TrendChart data={trendData} />

        {/* Category Breakdown (Replaces Donut Chart) */}
        {expenses.length > 0 ? (
          <div className="category-breakdown">
            <div className="section-title">Pengeluaran terbesar</div>
            <div>
              {Object.entries(byCategory)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5) // Show top 5
                .map(([cat, amt]) => {
                  const pct = totalExpense > 0 ? Math.round((amt / totalExpense) * 100) : 0;
                  const categorySlug = encodeURIComponent(cat);
                  
                  return (
                    <div key={cat} className="cat-item">
                      <div className="cat-item-top">
                        <Link href={`/kategori/${categorySlug}`} className="cat-item-name">
                          {cat}
                        </Link>
                        <div className="cat-item-values">
                          <span className="cat-item-amount">{formatRupiah(amt)}</span>
                          <span className="cat-item-pct">{pct}%</span>
                        </div>
                      </div>
                      <div className="cat-bar-track">
                        <div 
                          className="cat-bar-fill" 
                          style={{ width: `${Math.max(pct, 2)}%`, background: 'var(--text-muted)' }} 
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        ) : <div />}
      </div>

      {/* Financial Goals Preview */}
      <FinancialGoals goals={goals} totalSavings={totalSavings} />

      {/* Transactions */}
      <div>
        <div className="txn-header">
          <div className="section-title" style={{ marginBottom: 0 }}>Transaksi</div>
          <TransactionDialog
            expenseCategories={expenseCategories}
            incomeCategories={incomeCategories}
          />
        </div>
        <ExpenseList 
          expenses={expenses} 
          expenseCategories={expenseCategories} 
          incomeCategories={incomeCategories} 
        />
      </div>
      
    </div>
  );
}
