import { getAuthSession, getAnalyticsData } from "@/app/actions";
import AppShell from "@/components/AppShell";
import LoginForm from "@/components/LoginForm";
import AnalyticsWorkspace from "@/components/AnalyticsWorkspace";
import "@/app/globals.css";

export const metadata = {
  title: "Analisis \u2014 ArthaFlow",
  description: "Pahami perubahan pemasukan dan pengeluaran dari waktu ke waktu.",
};

function addMonths(ym, n) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function AnalisisPage(props) {
  const userId = await getAuthSession();
  if (!userId) return <LoginForm />;

  const searchParams = await props.searchParams;
  const monthParam = searchParams?.month;

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const selectedMonth = monthParam || currentMonth;

  // Fetch a 24-month window (enough for 12-month period + 12-month previous)
  const windowStart = addMonths(selectedMonth, -23);
  const windowEnd = selectedMonth;

  const transactions = await getAnalyticsData(windowStart, windowEnd);

  return (
    <AppShell currentMonth={selectedMonth}>
      <div className="analisis-page-header">
        <div>
          <h1 className="section-title" style={{ fontSize: "1.15rem", marginBottom: "0.2rem" }}>
            Analisis
          </h1>
          <p className="analisis-page-subtitle">
            Pahami perubahan pemasukan dan pengeluaran dari waktu ke waktu.
          </p>
        </div>
      </div>

      <AnalyticsWorkspace selectedMonth={selectedMonth} transactions={transactions} />
    </AppShell>
  );
}
