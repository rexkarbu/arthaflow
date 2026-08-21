import { getExpenses, getBudget, getCategoryBudgets, getCategories, getAuthSession, seedRecurringExpenses } from "@/app/actions";
import AppShell from "@/components/AppShell";
import BudgetBar from "@/components/BudgetBar";
import CategoryBudgetManager from "@/components/CategoryBudgetManager";
import LoginForm from "@/components/LoginForm";
import "@/app/globals.css";

export const metadata = {
  title: "Budget — ArthaFlow",
  description: "Pantau dan kelola anggaran pengeluaran bulanan dan per kategori.",
};

function formatMonthLabel(dateObj) {
  const longMonths = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  return `${longMonths[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
}

export default async function BudgetPage(props) {
  const userId = await getAuthSession();
  if (!userId) return <LoginForm />;

  const searchParams = await props.searchParams;
  const monthParam = searchParams?.month;

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const selectedMonth = monthParam || currentMonth;

  await seedRecurringExpenses(selectedMonth);

  const [year, month] = selectedMonth.split("-");
  const dateObj = new Date(parseInt(year), parseInt(month) - 1);
  const monthLabel = formatMonthLabel(dateObj);

  const [rawExpenses, budget, categoryBudgets] = await Promise.all([
    getExpenses(),
    getBudget(selectedMonth),
    getCategoryBudgets(selectedMonth),
  ]);

  const monthExpenses = rawExpenses.filter(
    (e) => e.date.startsWith(selectedMonth) && e.type !== "income"
  );

  const monthSpent = monthExpenses.reduce((sum, e) => sum + e.amount, 0);

  const spendingMap = {};
  for (const e of monthExpenses) {
    const cat = e.category || "Lainnya";
    spendingMap[cat] = (spendingMap[cat] || 0) + e.amount;
  }

  const budgetMap = {};
  for (const cb of categoryBudgets) {
    budgetMap[cb.category] = cb.amount;
  }

  const allCategoryNames = new Set([
    ...Object.keys(spendingMap),
    ...Object.keys(budgetMap),
  ]);

  const categoryRows = Array.from(allCategoryNames)
    .map((cat) => ({
      category: cat,
      budget: budgetMap[cat] ?? null,
      spent: spendingMap[cat] ?? 0,
    }))
    .filter((r) => r.budget != null || r.spent > 0)
    .sort((a, b) => {
      if ((a.budget != null) !== (b.budget != null))
        return a.budget != null ? -1 : 1;
      return b.spent - a.spent;
    });

  return (
    <AppShell currentMonth={selectedMonth}>
      <div className="budget-page-header">
        <div>
          <h1 className="page-heading">
            Budget
          </h1>
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

        <CategoryBudgetManager
          month={selectedMonth}
          monthLabel={monthLabel}
          categoryRows={categoryRows}
          overallBudget={budget}
        />
      </div>
    </AppShell>
  );
}
