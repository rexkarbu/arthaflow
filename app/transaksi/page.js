import { getExpenses, getAuthSession, seedRecurringExpenses, getCategories } from '@/app/actions';
import Link from 'next/link';
import ExpenseList from '@/components/ExpenseList';
import MonthPicker from '@/components/MonthPicker';
import LoginForm from '@/components/LoginForm';
import LogoutButton from '@/components/LogoutButton';
import ThemeToggle from '@/components/ThemeToggle';
import TransactionDialog from '@/components/TransactionDialog';
import '@/app/globals.css';

export const metadata = {
  title: 'Transaksi — ArthaFlow',
  description: 'Kelola seluruh riwayat transaksi pemasukan dan pengeluaran.',
};

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

export default async function TransactionsPage(props) {
  const userId = await getAuthSession();
  if (!userId) {
    return <LoginForm />;
  }

  const searchParams = await props.searchParams;
  const monthParam = searchParams?.month;

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const selectedMonth = monthParam || currentMonth;

  await seedRecurringExpenses(selectedMonth);

  const rawExpenses = await getExpenses();
  const expenseCategories = await getCategories('expense');
  const incomeCategories = await getCategories('income');

  const [year, month] = selectedMonth.split('-');
  const dateObj = new Date(parseInt(year), parseInt(month) - 1);
  const monthLabel = formatMonthLabel(dateObj);

  const expenses = rawExpenses
    .filter(e => e.date.startsWith(selectedMonth))
    .map(e => ({
      ...e,
      dateStr: formatWIB(e.date)
    }));

  return (
    <div className="wrap">
      {/* Header */}
      <header className="site-header">
        <div className="site-brand">
          <Link href={selectedMonth ? `/?month=${selectedMonth}` : '/'} className="site-title" style={{ textDecoration: 'none' }}>
            ArthaFlow<span>.</span>
          </Link>
        </div>
        <div className="site-header-right">
          <MonthPicker currentMonth={selectedMonth} />
          <ThemeToggle />
          <LogoutButton />
        </div>
      </header>

      {/* Back Navigation to Overview */}
      <div className="txn-back-nav">
        <Link href={selectedMonth ? `/?month=${selectedMonth}` : '/'} className="back-link">
          ← Overview
        </Link>
      </div>

      {/* Page Header */}
      <div className="txn-page-header">
        <div>
          <h1 className="section-title" style={{ fontSize: '1.15rem', marginBottom: '0.2rem' }}>Transaksi</h1>
          <p className="txn-page-subtitle">Kelola pemasukan dan pengeluaran bulan {monthLabel}.</p>
        </div>
        <TransactionDialog
          expenseCategories={expenseCategories}
          incomeCategories={incomeCategories}
        />
      </div>

      {/* Full Transaction Management List */}
      <ExpenseList
        expenses={expenses}
        expenseCategories={expenseCategories}
        incomeCategories={incomeCategories}
        mode="full"
      />
    </div>
  );
}
