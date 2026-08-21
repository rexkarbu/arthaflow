import { getAuthSession, getAccounts, getArchivedAccounts, getAccountTransfers, getExpenses, getCategories } from '@/app/actions';
import AppShell from '@/components/AppShell';
import LoginForm from '@/components/LoginForm';
import AccountWorkspace from '@/components/AccountWorkspace';
import '@/app/globals.css';

export const metadata = {
  title: 'Akun & Saldo — ArthaFlow',
  description: 'Pantau tempat uang disimpan dan mutasi transfer antar akun.',
};

export default async function AccountsPage(props) {
  const userId = await getAuthSession();
  if (!userId) {
    return <LoginForm />;
  }

  const searchParams = await props.searchParams;
  const monthParam = searchParams?.month;

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const selectedMonth = monthParam || currentMonth;

  // Load all accounts with balances derived as of the selected month
  const accounts = await getAccounts(selectedMonth);
  const archivedAccounts = await getArchivedAccounts();
  const transfers = await getAccountTransfers(selectedMonth);
  const allExpenses = await getExpenses();
  const expenseCategories = await getCategories('expense');
  const incomeCategories = await getCategories('income');

  // Count unassigned transactions across all time
  const unassignedCount = allExpenses.filter(e => e.account_id == null).length;

  return (
    <AppShell currentMonth={selectedMonth}>
      <AccountWorkspace
        accounts={accounts}
        archivedAccounts={archivedAccounts}
        transfers={transfers}
        unassignedCount={unassignedCount}
        currentMonth={selectedMonth}
        expenseCategories={expenseCategories}
        incomeCategories={incomeCategories}
      />
    </AppShell>
  );
}
