import { 
  getAuthSession, 
  getRecurringRules, 
  getRecurringOccurrences, 
  getUpcomingRecurringSchedule,
  getCategories, 
  getAccounts 
} from '@/app/actions';
import AppShell from '@/components/AppShell';
import LoginForm from '@/components/LoginForm';
import RecurringWorkspace from '@/components/RecurringWorkspace';
import '@/app/globals.css';

export const metadata = {
  title: 'Transaksi Rutin — ArthaFlow',
  description: 'Kelola jadwal pemasukan dan pengeluaran berulang serta tagihan berkala.',
};

export default async function RutinPage(props) {
  const userId = await getAuthSession();
  if (!userId) {
    return <LoginForm />;
  }

  const searchParams = await props.searchParams;
  const monthParam = searchParams?.month;
  const horizonParam = searchParams?.horizon;
  const parsedHorizon = parseInt(horizonParam, 10);
  const horizon = [7, 30, 60].includes(parsedHorizon) ? parsedHorizon : 30;

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const selectedMonth = monthParam || currentMonth;

  const [rules, occurrences, upcomingSchedule, expenseCategories, incomeCategories, accounts] = await Promise.all([
    getRecurringRules(),
    getRecurringOccurrences(),
    getUpcomingRecurringSchedule({ horizonDays: horizon }),
    getCategories('expense'),
    getCategories('income'),
    getAccounts(selectedMonth)
  ]);

  const allCategories = [...expenseCategories, ...incomeCategories];

  return (
    <AppShell currentMonth={selectedMonth}>
      <main className="main-content" id="main-content">
        <RecurringWorkspace
          rules={rules}
          occurrences={occurrences}
          upcomingSchedule={upcomingSchedule}
          horizon={horizon}
          categories={allCategories}
          accounts={accounts}
          currentMonth={selectedMonth}
        />
      </main>
    </AppShell>
  );
}
