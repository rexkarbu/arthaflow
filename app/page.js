import { getExpenses, addExpense, getBudget, getAuthSession, seedRecurringExpenses, getCategories } from './actions';
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
  
  const [year, month] = selectedMonth.split('-');
  const dateObj = new Date(parseInt(year), parseInt(month) - 1);
  const monthLabel = dateObj.toLocaleString('id-ID', { month: 'long', year: 'numeric' });

  // Filter raw expenses by selected month
  const expenses = rawExpenses
    .filter(e => e.date.startsWith(selectedMonth))
    .map(e => ({
      ...e,
      dateStr: new Date(e.date).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
    }));

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

  return (
    <div className="wrap">

      {/* Header */}
      <header className="site-header">
        <div>
          <h1 className="site-title">ArthaFlow<span>.</span></h1>
          <span className="site-badge">Catatan Keuangan</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <MonthPicker currentMonth={selectedMonth} />
          <ThemeToggle />
          <LogoutButton />
        </div>
      </header>

      {/* Ringkasan */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="total-card" style={{ marginBottom: 0 }}>
          <div>
            <div className="total-label" style={{ color: '#28a745' }}>Total Pemasukan</div>
            <div className="total-amount"><span>Rp</span>{totalIncome.toLocaleString('id-ID')}</div>
          </div>
        </div>
        <div className="total-card" style={{ marginBottom: 0 }}>
          <div>
            <div className="total-label" style={{ color: 'var(--danger)' }}>Total Pengeluaran</div>
            <div className="total-amount"><span>Rp</span>{totalExpense.toLocaleString('id-ID')}</div>
          </div>
          <div className="total-meta" style={{ marginTop: '0.5rem' }}>
            <div>Hari ini: <strong>{formatRupiah(todayExpense)}</strong></div>
          </div>
        </div>
        <div className="total-card" style={{ marginBottom: 0, border: '1px solid var(--cyan)' }}>
          <div>
            <div className="total-label" style={{ color: 'var(--cyan)' }}>Saldo Sisa</div>
            <div className="total-amount"><span>Rp</span>{balance.toLocaleString('id-ID')}</div>
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

          <ExpenseChart expenses={expenses} />
          
          <TrendChart data={trendData} />

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
                      return (
                        <div key={cat} className="stat-item">
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
                        </div>
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
