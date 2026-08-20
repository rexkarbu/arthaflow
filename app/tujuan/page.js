import { getExpenses, getAuthSession, getGoals } from '@/app/actions';
import AppShell from '@/components/AppShell';
import FinancialGoals from '@/components/FinancialGoals';
import LoginForm from '@/components/LoginForm';
import '@/app/globals.css';

export const metadata = {
  title: 'Tujuan — ArthaFlow',
  description: 'Pantau dan kelola target tabungan keuangan.',
};

export default async function GoalsPage(props) {
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
  const goals = await getGoals();

  let allTimeIncome = 0;
  let allTimeExpense = 0;
  rawExpenses.forEach(e => {
    if (e.type === 'income') allTimeIncome += e.amount;
    else allTimeExpense += e.amount;
  });
  const totalSavings = allTimeIncome - allTimeExpense;

  return (
    <AppShell currentMonth={selectedMonth}>
      <div className="goals-page-header">
        <div>
          <h1 className="section-title" style={{ fontSize: '1.15rem', marginBottom: '0.2rem' }}>Tujuan</h1>
          <p className="goals-page-subtitle">Pantau target keuangan yang sedang kamu capai.</p>
        </div>
      </div>

      <div className="goals-page-content">
        <FinancialGoals goals={goals} totalSavings={totalSavings} mode="full" currentMonth={selectedMonth} />
      </div>
    </AppShell>
  );
}
