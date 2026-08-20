import { getExpenses, getBudget, getAuthSession, seedRecurringExpenses } from '@/app/actions';
import AppShell from '@/components/AppShell';
import BudgetBar from '@/components/BudgetBar';
import LoginForm from '@/components/LoginForm';
import '@/app/globals.css';

export const metadata = {
  title: 'Budget — ArthaFlow',
  description: 'Pantau dan kelola anggaran pengeluaran bulanan.',
};

function formatMonthLabel(dateObj) {
  const longMonths = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return `${longMonths[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
}

export default async function BudgetPage(props) {
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

  const [year, month] = selectedMonth.split('-');
  const dateObj = new Date(parseInt(year), parseInt(month) - 1);
  const monthLabel = formatMonthLabel(dateObj);

  const rawExpenses = await getExpenses();
  const expenses = rawExpenses.filter(e => e.date.startsWith(selectedMonth));
  const monthSpent = expenses
    .filter(e => e.type !== 'income')
    .reduce((sum, e) => sum + e.amount, 0);

  const budget = await getBudget(selectedMonth);

  return (
    <AppShell currentMonth={selectedMonth}>
      <div className="budget-page-header">
        <div>
          <h1 className="section-title" style={{ fontSize: '1.15rem', marginBottom: '0.2rem' }}>Budget</h1>
          <p className="budget-page-subtitle">Pantau penggunaan budget bulan {monthLabel}.</p>
        </div>
      </div>

      <div className="budget-page-content">
        <BudgetBar
          month={selectedMonth}
          monthLabel={monthLabel}
          budget={budget}
          spent={monthSpent}
        />
      </div>
    </AppShell>
  );
}
