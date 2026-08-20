import Link from 'next/link';
import LoginForm from '@/components/LoginForm';
import ExpenseList from '@/components/ExpenseList';
import { getAuthSession, getCategories, getExpenses } from '@/app/actions';

function formatRupiah(n) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(n);
}

function formatWIB(isoString) {
  const d = new Date(isoString);
  d.setUTCHours(d.getUTCHours() + 7); // UTC+7 WIB
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const day = d.getUTCDate();
  const month = months[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  
  return `${day} ${month} ${year}, ${hours}:${minutes}`;
}

function formatShortDate(isoString) {
  const d = new Date(isoString);
  d.setUTCHours(d.getUTCHours() + 7);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.getFullYear(), d.getMonth(), diff);
  return monday;
}

export default async function CategoryDetailPage({ params }) {
  const userId = await getAuthSession();
  if (!userId) {
    return <LoginForm />;
  }

  const { slug } = await params;
  const categoryName = decodeURIComponent(slug);

  const rawExpenses = await getExpenses();
  const expenseCategories = await getCategories('expense');
  const incomeCategories = await getCategories('income');

  const categoryExpenses = rawExpenses
    .filter(e => e.type !== 'income' && e.category === categoryName)
    .map(e => ({
      ...e,
      dateStr: formatWIB(e.date)
    }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const totalExpense = categoryExpenses.reduce((sum, e) => sum + e.amount, 0);
  const avgExpense = categoryExpenses.length > 0 ? totalExpense / categoryExpenses.length : 0;

  const weeklyTrendMap = {};
  categoryExpenses.forEach(exp => {
    const weekStart = getWeekStart(exp.date);
    const weekKey = weekStart.toISOString().slice(0, 10);
    if (!weeklyTrendMap[weekKey]) {
      weeklyTrendMap[weekKey] = { total: 0, label: formatShortDate(weekStart.toISOString()) };
    }
    weeklyTrendMap[weekKey].total += exp.amount;
  });

  const weeklyTrend = Object.entries(weeklyTrendMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekKey, entry]) => ({
      weekKey,
      label: entry.label,
      total: entry.total
    }));

  const largestWeek = weeklyTrend.reduce((max, item) => item.total > max.total ? item : max, { total: 0, label: '-' });

  return (
    <div className="wrap detail-page">
      <header className="site-header">
        <div>
          <h1 className="site-title">ArthaFlow<span>.</span></h1>
        </div>
        <div className="site-header-right">
          <Link href="/" className="back-link">← Kembali</Link>
        </div>
      </header>

      <div className="detail-hero">
        <div className="detail-hero-title">Kategori: {categoryName}</div>
        <div className="detail-hero-body">
          <div className="detail-stat">
            <div className="detail-label">Total pengeluaran</div>
            <div className="detail-amount">{formatRupiah(totalExpense)}</div>
          </div>
          <div className="detail-stat">
            <div className="detail-label">Rata-rata per transaksi</div>
            <div className="detail-amount">{formatRupiah(avgExpense)}</div>
          </div>
          <div className="detail-stat">
            <div className="detail-label">Jumlah transaksi</div>
            <div className="detail-amount">{categoryExpenses.length} entri</div>
          </div>
        </div>
      </div>

      <div className="detail-grid">
        <div>
          <div className="section-title">Tren per minggu</div>
          <div>
            {weeklyTrend.length === 0 ? (
              <div className="empty">Belum ada data untuk kategori ini.</div>
            ) : (
              <div className="trend-list">
                {weeklyTrend.map(item => {
                  const pct = largestWeek.total > 0 ? Math.round((item.total / largestWeek.total) * 100) : 0;
                  return (
                    <div key={item.weekKey} className="trend-row">
                      <div className="trend-meta">
                        <span>{item.label}</span>
                        <strong>{formatRupiah(item.total)}</strong>
                      </div>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${Math.max(pct, 2)}%`, background: 'var(--cat-1)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div> 
          <div className="section-title">Riwayat pengeluaran</div>
          <div>
            <ExpenseList expenses={categoryExpenses} expenseCategories={expenseCategories} incomeCategories={incomeCategories} />
          </div>
        </div>
      </div>
    </div>
  );
}
