import { getExpenses, getAuthSession, getCategories, getAccounts } from '@/app/actions';
import AppShell from '@/components/AppShell';
import ExpenseList from '@/components/ExpenseList';
import LoginForm from '@/components/LoginForm';
import TransactionDialog from '@/components/TransactionDialog';
import { formatDateTime, formatMonthLabel } from '@/lib/format';
import Link from 'next/link';
import { Repeat } from 'lucide-react';
import '@/app/globals.css';

export const metadata = {
  title: 'Transaksi — ArthaFlow',
  description: 'Kelola seluruh riwayat transaksi pemasukan dan pengeluaran.',
};

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

  const rawExpenses = await getExpenses();
  const expenseCategories = await getCategories('expense');
  const incomeCategories = await getCategories('income');
  const accounts = await getAccounts(selectedMonth);

  const [year, month] = selectedMonth.split('-');
  const dateObj = new Date(parseInt(year), parseInt(month) - 1);
  const monthLabel = formatMonthLabel(dateObj);

  const expenses = rawExpenses
    .filter(e => e.date.startsWith(selectedMonth))
    .map(e => ({
      ...e,
      dateStr: formatDateTime(e.date)
    }));

  return (
    <AppShell currentMonth={selectedMonth}>
      {/* Page Header */}
      <div className="txn-page-header">
        <div>
          <h1 className="page-heading">Transaksi</h1>
          <p className="txn-page-subtitle">Kelola pemasukan dan pengeluaran bulan {monthLabel}.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <Link
            href={`/rutin?month=${selectedMonth}`}
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem', padding: '0.45rem 0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Repeat size={14} /> Kelola rutin
          </Link>
          <TransactionDialog
            expenseCategories={expenseCategories}
            incomeCategories={incomeCategories}
            accounts={accounts}
          />
        </div>
      </div>

      {/* Full Transaction Management List */}
      <ExpenseList
        expenses={expenses}
        expenseCategories={expenseCategories}
        incomeCategories={incomeCategories}
        accounts={accounts}
        mode="full"
      />
    </AppShell>
  );
}
