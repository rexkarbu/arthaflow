import { getAuthSession, getGoals } from '@/app/actions';
import AppShell from '@/components/AppShell';
import FinancialGoals from '@/components/FinancialGoals';
import LoginForm from '@/components/LoginForm';
import '@/app/globals.css';

export const metadata = {
  title: 'Tujuan — ArthaFlow',
  description: 'Pantau dan kelola target tabungan keuangan secara independen.',
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

  const goals = await getGoals();

  return (
    <AppShell currentMonth={selectedMonth}>
      <div className="goals-page-header">
        <div>
          <h1 className="page-heading">Tujuan</h1>
          <p className="goals-page-subtitle">Kelola alokasi dana untuk target keuangan yang ingin kamu capai.</p>
        </div>
      </div>

      <div className="goals-page-content">
        <FinancialGoals goals={goals} mode="full" currentMonth={selectedMonth} />
      </div>
    </AppShell>
  );
}
