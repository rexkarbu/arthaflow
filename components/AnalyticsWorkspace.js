'use client';

import { useState, useMemo } from 'react';
import CashFlowTrend from './CashFlowTrend';
import IncomeExpenseChart from './IncomeExpenseChart';
import CategoryBreakdown from './CategoryBreakdown';
import CategoryChanges from './CategoryChanges';

const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const LONG_MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

function addMonths(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(ym, long = false) {
  const [, m] = ym.split('-').map(Number);
  return long ? LONG_MONTHS[m - 1] : SHORT_MONTHS[m - 1];
}

function periodLabel(startYM, endYM) {
  const [sy, sm] = startYM.split('-').map(Number);
  const [ey, em] = endYM.split('-').map(Number);
  if (sy === ey) return `${LONG_MONTHS[sm - 1]} \u2013 ${LONG_MONTHS[em - 1]} ${ey}`;
  return `${LONG_MONTHS[sm - 1]} ${sy} \u2013 ${LONG_MONTHS[em - 1]} ${ey}`;
}

function deriveAnalytics(transactions, currentStart, currentEnd, previousStart, previousEnd) {
  const txnInRange = (t, start, end) => {
    const ym = t.date.slice(0, 7);
    return ym >= start && ym <= end;
  };

  const currentTxns = transactions.filter(t => txnInRange(t, currentStart, currentEnd));
  const previousTxns = transactions.filter(t => txnInRange(t, previousStart, previousEnd));

  const sumBy = (txns, type) => txns.filter(t => t.type === type).reduce((s, t) => s + t.amount, 0);

  const periodIncome = sumBy(currentTxns, 'income');
  const periodExpense = sumBy(currentTxns, 'expense');
  const periodNet = periodIncome - periodExpense;
  const prevIncome = sumBy(previousTxns, 'income');
  const prevExpense = sumBy(previousTxns, 'expense');
  const prevNet = prevIncome - prevExpense;

  // Build monthly series for current period
  const monthKeys = [];
  let cur = currentStart;
  while (cur <= currentEnd) { monthKeys.push(cur); cur = addMonths(cur, 1); }

  const monthlySeries = monthKeys.map(ym => {
    const mo = currentTxns.filter(t => t.date.slice(0, 7) === ym);
    const inc = sumBy(mo, 'income');
    const exp = sumBy(mo, 'expense');
    return { month: monthLabel(ym), income: inc, expense: exp, net: inc - exp };
  });

  // Category totals (expense only)
  const catTotals = {};
  currentTxns.filter(t => t.type === 'expense').forEach(t => {
    catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
  });
  const prevCatTotals = {};
  previousTxns.filter(t => t.type === 'expense').forEach(t => {
    prevCatTotals[t.category] = (prevCatTotals[t.category] || 0) + t.amount;
  });

  // Category changes
  const allCats = new Set([...Object.keys(catTotals), ...Object.keys(prevCatTotals)]);
  const categoryChanges = Array.from(allCats).map(cat => {
    const curr = catTotals[cat] || 0;
    const prev = prevCatTotals[cat] || 0;
    const abs = curr - prev;
    return { category: cat, current: curr, previous: prev, absoluteChange: abs };
  }).sort((a, b) => Math.abs(b.absoluteChange) - Math.abs(a.absoluteChange));

  return { periodIncome, periodExpense, periodNet, prevIncome, prevExpense, prevNet, monthlySeries, catTotals, categoryChanges };
}

function pctChange(curr, prev) {
  if (prev === 0 && curr === 0) return null; // "—"
  if (prev === 0 && curr > 0) return 'new'; // "Baru di periode ini"
  return Math.round(((curr - prev) / prev) * 100);
}

function formatRupiah(n) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
}

function PeriodSelector({ period, onChange }) {
  return (
    <div className="period-selector" role="group" aria-label="Pilih rentang periode">
      {[3, 6, 12].map(p => (
        <button
          key={p}
          type="button"
          className={`period-btn${period === p ? ' period-btn--active' : ''}`}
          onClick={() => onChange(p)}
          aria-pressed={period === p}
        >
          {p} bulan
        </button>
      ))}
    </div>
  );
}

export default function AnalyticsWorkspace({ selectedMonth, transactions }) {
  const [period, setPeriod] = useState(6);

  const currentEnd = selectedMonth;
  const currentStart = useMemo(() => addMonths(currentEnd, -(period - 1)), [currentEnd, period]);
  const previousEnd = useMemo(() => addMonths(currentStart, -1), [currentStart]);
  const previousStart = useMemo(() => addMonths(previousEnd, -(period - 1)), [previousEnd, period]);

  const analytics = useMemo(() =>
    deriveAnalytics(transactions, currentStart, currentEnd, previousStart, previousEnd),
    [transactions, currentStart, currentEnd, previousStart, previousEnd]
  );

  const { periodIncome, periodExpense, periodNet, prevIncome, prevExpense, prevNet, monthlySeries, catTotals, categoryChanges } = analytics;

  const incomePct = pctChange(periodIncome, prevIncome);
  const expensePct = pctChange(periodExpense, prevExpense);
  const netAbsChange = periodNet - prevNet;

  const hasAnyData = transactions.length > 0;
  const currentLabel = periodLabel(currentStart, currentEnd);
  const previousLabel = periodLabel(previousStart, previousEnd);

  return (
    <div className="analisis-workspace">
      {/* Period selector + context */}
      <div className="analisis-period-row">
        <PeriodSelector period={period} onChange={setPeriod} />
        <div className="analisis-period-context">
          <span className="analisis-period-current">{currentLabel}</span>
          <span className="analisis-period-vs">vs {previousLabel}</span>
        </div>
      </div>

      {!hasAnyData ? (
        <div className="analisis-empty">
          <p>Belum ada data untuk dianalisis.</p>
          <p className="analisis-empty-sub">Catat transaksi untuk mulai melihat pola keuangan.</p>
        </div>
      ) : (
        <>
          {/* Period Summary */}
          <div className="analisis-summary">
            <div className="analisis-summary-inner">
              {/* Pemasukan */}
              <div className="summary-metric">
                <div className="summary-metric-label">Pemasukan</div>
                <div className="summary-metric-value">{formatRupiah(periodIncome)}</div>
                <div className="summary-metric-change">
                  {incomePct === null ? <span className="change-neutral">&mdash;</span>
                  : incomePct === 'new' ? <span className="change-neutral">Baru di periode ini</span>
                  : <span className={incomePct >= 0 ? 'change-income' : 'change-muted'}>{incomePct >= 0 ? `+${incomePct}%` : `${incomePct}%`}</span>}
                </div>
              </div>

              <div className="summary-divider" aria-hidden="true" />

              {/* Pengeluaran */}
              <div className="summary-metric">
                <div className="summary-metric-label">Pengeluaran</div>
                <div className="summary-metric-value">{formatRupiah(periodExpense)}</div>
                <div className="summary-metric-change">
                  {expensePct === null ? <span className="change-neutral">&mdash;</span>
                  : expensePct === 'new' ? <span className="change-neutral">Baru di periode ini</span>
                  : <span className="change-muted">{expensePct >= 0 ? `+${expensePct}%` : `${expensePct}%`}</span>}
                </div>
              </div>

              <div className="summary-divider" aria-hidden="true" />

              {/* Net */}
              <div className="summary-metric">
                <div className="summary-metric-label">Net</div>
                <div className="summary-metric-value">{formatRupiah(periodNet)}</div>
                <div className="summary-metric-change">
                  {prevIncome === 0 && prevExpense === 0
                    ? <span className="change-neutral">&mdash;</span>
                    : <span className="change-muted">{netAbsChange >= 0 ? `+${formatRupiah(netAbsChange)}` : `-${formatRupiah(Math.abs(netAbsChange))}`}</span>}
                </div>
              </div>
            </div>
            <div className="summary-caption">dibanding {period} bulan sebelumnya</div>
          </div>

          {/* Cash Flow Trend */}
          <CashFlowTrend monthlySeries={monthlySeries} />

          {/* Income vs Expense */}
          <IncomeExpenseChart monthlySeries={monthlySeries} />

          {/* Category Breakdown */}
          <CategoryBreakdown catTotals={catTotals} totalExpense={periodExpense} endMonth={selectedMonth} currentLabel={currentLabel} />

          {/* Category Changes */}
          {categoryChanges.length > 0 && (
            <CategoryChanges categoryChanges={categoryChanges} period={period} />
          )}
        </>
      )}
    </div>
  );
}
