import { 
  getAuthSession, 
  getRecurringRules, 
  getRecurringOccurrences, 
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

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const selectedMonth = monthParam || currentMonth;

  const [rules, occurrences, expenseCategories, incomeCategories, accounts] = await Promise.all([
    getRecurringRules(),
    getRecurringOccurrences(),
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
          categories={allCategories}
          accounts={accounts}
          currentMonth={selectedMonth}
        />
      </main>
    </AppShell>
  );
}
