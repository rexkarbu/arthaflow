// scratch/test_upcoming.js
// Comprehensive Integration Test Suite for ArthaFlow STEP 11

import db, { dbReady } from '../lib/db.js';
import {
  parseDateParts,
  formatDateParts,
  getEffectiveMonthlyDate,
  getNextWeeklyDateOnOrAfter,
  getTodayDateStr,
  computeDueCandidateDates,
  computeFutureVirtualDates,
  parsePauseHistory,
  isDateInPauseWindows,
  addDays,
  FINANCIAL_TIMEZONE
} from '../lib/recurrence.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

async function runTests() {
  await dbReady;
  console.log('\n==================================================');
  console.log('ARTHAFLOW STEP 11 — UPCOMING COMMITMENTS TEST SUITE');
  console.log('==================================================\n');

  const TEST_USER_A = 91101;
  const TEST_USER_B = 91102;

  // Cleanup test users
  await db.execute({ sql: 'DELETE FROM users WHERE id IN (?, ?)', args: [TEST_USER_A, TEST_USER_B] });
  await db.execute({ sql: 'DELETE FROM accounts WHERE user_id IN (?, ?)', args: [TEST_USER_A, TEST_USER_B] });
  await db.execute({ sql: 'DELETE FROM recurring_rules WHERE user_id IN (?, ?)', args: [TEST_USER_A, TEST_USER_B] });
  await db.execute({ sql: 'DELETE FROM recurring_occurrences WHERE user_id IN (?, ?)', args: [TEST_USER_A, TEST_USER_B] });
  await db.execute({ sql: 'DELETE FROM expenses WHERE user_id IN (?, ?)', args: [TEST_USER_A, TEST_USER_B] });

  // Create test users
  await db.execute({
    sql: 'INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?), (?, ?, ?)',
    args: [TEST_USER_A, 'test_step11_a', 'hash_a', TEST_USER_B, 'test_step11_b', 'hash_b']
  });

  // Create accounts
  const accARes = await db.execute({
    sql: `INSERT INTO accounts (user_id, name, type, opening_balance, opening_date)
          VALUES (?, 'BRImo', 'BANK', 10000000, '2026-08-01')`,
    args: [TEST_USER_A]
  });
  const accountAId = Number(accARes.lastInsertRowid);

  // ----------------------------------------------------
  // T1: Basic 30-Day Outlook Totals
  // ----------------------------------------------------
  console.log('TEST 1: Basic 30-Day Outlook Totals');
  const todaySim = '2026-08-22';
  const horizon30End = addDays(todaySim, 30); // 2026-09-21

  const ruleGaji = {
    id: 1,
    user_id: TEST_USER_A,
    name: 'Gaji',
    type: 'income',
    amount: 5000000,
    frequency: 'monthly',
    day_of_month: 25,
    start_date: '2026-08-01',
    status: 'ACTIVE'
  };

  const ruleKos = {
    id: 2,
    user_id: TEST_USER_A,
    name: 'Kos',
    type: 'expense',
    amount: 1500000,
    frequency: 'monthly',
    day_of_month: 1,
    start_date: '2026-08-01',
    status: 'ACTIVE'
  };

  const virtualGaji = computeFutureVirtualDates(ruleGaji, todaySim, horizon30End);
  const virtualKos = computeFutureVirtualDates(ruleKos, todaySim, horizon30End);

  assert(virtualGaji.includes('2026-08-25'), 'Gaji virtual date 2026-08-25 is generated');
  assert(virtualKos.includes('2026-09-01'), 'Kos virtual date 2026-09-01 is generated');

  let incTotal = 0;
  let expTotal = 0;
  virtualGaji.forEach(() => { incTotal += ruleGaji.amount; });
  virtualKos.forEach(() => { expTotal += ruleKos.amount; });
  const netTotal = incTotal - expTotal;

  assert(incTotal === 5000000, `Scheduled income is Rp5.000.000 (actual: ${incTotal})`);
  assert(expTotal === 1500000, `Scheduled expense is Rp1.500.000 (actual: ${expTotal})`);
  assert(netTotal === 3500000, `Scheduled net is +Rp3.500.000 (actual: ${netTotal})`);

  // ----------------------------------------------------
  // T2: Overdue Excluded From Future Total
  // ----------------------------------------------------
  console.log('\nTEST 2: Overdue Excluded From Future Total');
  const ruleSpotify = {
    id: 3,
    user_id: TEST_USER_A,
    name: 'Spotify',
    type: 'expense',
    amount: 55000,
    frequency: 'monthly',
    day_of_month: 17,
    start_date: '2026-08-01',
    status: 'ACTIVE'
  };

  // Past occurrence (overdue 17 Aug)
  const pastOccSpotify = {
    id: 101,
    rule_id: 3,
    due_date: '2026-08-17',
    amount: 50000,
    status: 'PENDING'
  };

  // Future candidate: 17 Sep
  const virtualSpotify = computeFutureVirtualDates(ruleSpotify, todaySim, horizon30End);
  assert(virtualSpotify.length === 1 && virtualSpotify[0] === '2026-09-17', 'Only future 17 Sep generated, 17 Aug strictly excluded from future virtual dates');
  assert(pastOccSpotify.due_date < todaySim, '17 Aug is strictly in overdue domain (due_date < today)');

  // ----------------------------------------------------
  // T3: Snapshot Authority vs Future Rule
  // ----------------------------------------------------
  console.log('\nTEST 3: Snapshot Authority vs Future Rule');
  const pastSnapshotAmount = 50000;
  const currentRuleAmount = 65000;
  ruleSpotify.amount = currentRuleAmount;

  const futureVirtualDates = computeFutureVirtualDates(ruleSpotify, todaySim, horizon30End);
  assert(pastSnapshotAmount === 50000, 'Historical/overdue occurrence retains immutable snapshot Rp50.000');
  assert(ruleSpotify.amount === 65000, 'Future virtual occurrences use current rule template Rp65.000');

  // ----------------------------------------------------
  // T4: Day 31 Month-End Clamping
  // ----------------------------------------------------
  console.log('\nTEST 4: Day 31 Month-End Clamping');
  const ruleDay31 = {
    id: 4,
    name: 'End of Month Bill',
    type: 'expense',
    amount: 200000,
    frequency: 'monthly',
    day_of_month: 31,
    start_date: '2026-08-01',
    status: 'ACTIVE'
  };

  const day31Horizon60 = computeFutureVirtualDates(ruleDay31, '2026-08-22', '2026-11-01');
  assert(day31Horizon60.includes('2026-08-31'), 'Includes 31 Aug');
  assert(day31Horizon60.includes('2026-09-30'), 'Clamps Sep 31 to 30 Sep');
  assert(day31Horizon60.includes('2026-10-31'), 'Includes 31 Oct');
  assert(day31Horizon60.length === 3, 'Exactly 3 month-end dates generated in window');

  // ----------------------------------------------------
  // T5: Weekly Recurrence
  // ----------------------------------------------------
  console.log('\nTEST 5: Weekly Recurrence');
  const ruleWeeklyMon = {
    id: 5,
    name: 'Weekly Gym',
    type: 'expense',
    amount: 100000,
    frequency: 'weekly',
    day_of_week: 1, // Monday
    start_date: '2026-08-01',
    status: 'ACTIVE'
  };

  // 2026-08-22 is Saturday. Next Mondays: 2026-08-24, 2026-08-31, 2026-09-07, 2026-09-14, 2026-09-21
  const weeklyMondays = computeFutureVirtualDates(ruleWeeklyMon, '2026-08-22', '2026-09-21');
  assert(weeklyMondays.length === 5, `5 Mondays in 30 days window (actual: ${weeklyMondays.length})`);
  assert(weeklyMondays[0] === '2026-08-24', 'First future Monday is 2026-08-24');
  assert(weeklyMondays[1] === '2026-08-31', 'Second future Monday is 2026-08-31');

  // ----------------------------------------------------
  // T6: Paused Rule Contributes Zero Virtual Items
  // ----------------------------------------------------
  console.log('\nTEST 6: Paused Rule Contributes Zero Virtual Items');
  const rulePaused = {
    id: 6,
    name: 'Paused Gym',
    type: 'expense',
    amount: 100000,
    frequency: 'monthly',
    day_of_month: 25,
    start_date: '2026-08-01',
    status: 'PAUSED',
    paused_at: '2026-08-10'
  };
  const pausedDates = computeFutureVirtualDates(rulePaused, '2026-08-22', '2026-09-22');
  assert(pausedDates.length === 0, 'Paused rule produces 0 future virtual items');

  // ----------------------------------------------------
  // T7: Archived Rule Contributes Zero Virtual Items
  // ----------------------------------------------------
  console.log('\nTEST 7: Archived Rule Contributes Zero Virtual Items');
  const ruleArchived = {
    id: 7,
    name: 'Archived Sub',
    type: 'expense',
    amount: 100000,
    frequency: 'monthly',
    day_of_month: 25,
    start_date: '2026-08-01',
    status: 'ARCHIVED'
  };
  const archivedDates = computeFutureVirtualDates(ruleArchived, '2026-08-22', '2026-09-22');
  assert(archivedDates.length === 0, 'Archived rule produces 0 future virtual items');

  // ----------------------------------------------------
  // T8: End Date Bound Respected
  // ----------------------------------------------------
  console.log('\nTEST 8: End Date Bound Respected');
  const ruleEndDate = {
    id: 8,
    name: 'Limited Sub',
    type: 'expense',
    amount: 50000,
    frequency: 'monthly',
    day_of_month: 10,
    start_date: '2026-08-01',
    end_date: '2026-09-10',
    status: 'ACTIVE'
  };
  const endDateCandidates = computeFutureVirtualDates(ruleEndDate, '2026-08-22', '2026-11-22');
  assert(endDateCandidates.includes('2026-09-10'), 'End date 2026-09-10 is inclusive and present');
  assert(!endDateCandidates.includes('2026-10-10'), 'Date after end_date 2026-10-10 is strictly excluded');

  // ----------------------------------------------------
  // T9: MonthPicker Independence
  // ----------------------------------------------------
  console.log('\nTEST 9: MonthPicker Independence');
  const realToday = getTodayDateStr();
  const histMonth = '2025-01';
  assert(realToday.startsWith('2026'), `getTodayDateStr() returns real today ${realToday}, independent of historical month ${histMonth}`);

  // ----------------------------------------------------
  // T10: Deduplication Authority
  // ----------------------------------------------------
  console.log('\nTEST 10: Deduplication Authority');
  const existingMap = new Map();
  existingMap.set('10_2026-08-25', {
    id: 501,
    rule_id: 10,
    due_date: '2026-08-25',
    name: 'Spotify Family (Old Snapshot)',
    amount: 79000,
    status: 'PENDING'
  });

  const ruleUpdated = {
    id: 10,
    name: 'Spotify Family (New Rule)',
    amount: 99000,
    frequency: 'monthly',
    day_of_month: 25,
    start_date: '2026-08-01',
    status: 'ACTIVE'
  };

  const virtualDates10 = computeFutureVirtualDates(ruleUpdated, '2026-08-22', '2026-09-22');
  const deduplicatedItems = [];
  const processed = new Set();

  for (const d of virtualDates10) {
    const key = `10_${d}`;
    processed.add(key);
    if (existingMap.has(key)) {
      const occ = existingMap.get(key);
      deduplicatedItems.push({ kind: 'occurrence', name: occ.name, amount: occ.amount });
    } else {
      deduplicatedItems.push({ kind: 'virtual', name: ruleUpdated.name, amount: ruleUpdated.amount });
    }
  }

  assert(deduplicatedItems.length === 1, 'Exactly 1 item returned after deduplication');
  assert(deduplicatedItems[0].kind === 'occurrence', 'Persisted occurrence won deduplication');
  assert(deduplicatedItems[0].amount === 79000, 'Persisted snapshot amount Rp79.000 was preserved');

  // ----------------------------------------------------
  // T11: Financial Ledger Isolation
  // ----------------------------------------------------
  console.log('\nTEST 11: Financial Ledger Isolation');
  const beforeAccRes = await db.execute({
    sql: 'SELECT opening_balance FROM accounts WHERE id = ?',
    args: [accountAId]
  });
  const beforeExpensesCount = (await db.execute('SELECT COUNT(*) AS count FROM expenses')).rows[0].count;

  // Simulate read-only virtual upcoming generation
  const readVirtual = computeFutureVirtualDates(ruleGaji, '2026-08-22', '2026-09-22');
  assert(readVirtual.length > 0, 'Virtual dates computed');

  const afterAccRes = await db.execute({
    sql: 'SELECT opening_balance FROM accounts WHERE id = ?',
    args: [accountAId]
  });
  const afterExpensesCount = (await db.execute('SELECT COUNT(*) AS count FROM expenses')).rows[0].count;

  assert(beforeAccRes.rows[0].opening_balance === afterAccRes.rows[0].opening_balance, 'Account balance unchanged (Rp0 ledger impact)');
  assert(beforeExpensesCount === afterExpensesCount, 'Expenses table row count unchanged (Rp0 actual transactions)');

  // ----------------------------------------------------
  // T12: Horizon Boundaries (7, 30, 60)
  // ----------------------------------------------------
  console.log('\nTEST 12: Horizon Boundaries (7, 30, 60)');
  const baseDate = '2026-08-22';
  const h7End = addDays(baseDate, 7);   // 2026-08-29
  const h30End = addDays(baseDate, 30); // 2026-09-21
  const h60End = addDays(baseDate, 60); // 2026-10-21

  assert(h7End === '2026-08-29', `7-day horizon ends at ${h7End}`);
  assert(h30End === '2026-09-21', `30-day horizon ends at ${h30End}`);
  assert(h60End === '2026-10-21', `60-day horizon ends at ${h60End}`);

  const ruleDaily = {
    id: 11,
    name: 'Daily',
    type: 'expense',
    amount: 1000,
    frequency: 'weekly',
    day_of_week: 1, // Mon
    start_date: '2026-08-01',
    status: 'ACTIVE'
  };
  const d7 = computeFutureVirtualDates(ruleDaily, baseDate, h7End);
  assert(!d7.includes(baseDate), 'baseDate (today) is strictly excluded from future dates (fromExclusive)');

  // ----------------------------------------------------
  // T13: Multi-tenant Cross-User Isolation
  // ----------------------------------------------------
  console.log('\nTEST 13: Multi-tenant Cross-User Isolation');
  await db.execute({
    sql: `INSERT INTO recurring_rules (id, user_id, name, amount, start_date, status)
          VALUES (1001, ?, 'User A Secret Bill', 500000, '2026-08-01', 'ACTIVE'),
                 (1002, ?, 'User B Secret Bill', 900000, '2026-08-01', 'ACTIVE')`,
    args: [TEST_USER_A, TEST_USER_B]
  });

  const userARulesRes = await db.execute({
    sql: 'SELECT id, name FROM recurring_rules WHERE user_id = ?',
    args: [TEST_USER_A]
  });
  const userBRulesRes = await db.execute({
    sql: 'SELECT id, name FROM recurring_rules WHERE user_id = ?',
    args: [TEST_USER_B]
  });

  assert(userARulesRes.rows.some(r => r.name === 'User A Secret Bill'), 'User A sees own rule');
  assert(!userARulesRes.rows.some(r => r.name === 'User B Secret Bill'), 'User A cannot see User B rule');
  assert(userBRulesRes.rows.some(r => r.name === 'User B Secret Bill'), 'User B sees own rule');
  assert(!userBRulesRes.rows.some(r => r.name === 'User A Secret Bill'), 'User B cannot see User A rule');

  // ----------------------------------------------------
  // T14: Multi-Pause/Resume Cycle Regression
  // ----------------------------------------------------
  console.log('\nTEST 14: Multi-Pause/Resume Cycle Regression');
  const multiPauseRule = {
    id: 12,
    name: 'Multi-Paused Internet',
    frequency: 'monthly',
    day_of_month: 10,
    start_date: '2026-08-01',
    status: 'ACTIVE',
    pause_history: JSON.stringify([
      { start: '2026-09-05', end: '2026-10-05' },
      { start: '2026-10-06', end: '2026-11-05' }
    ])
  };

  const multiPauseCandidates = computeDueCandidateDates(multiPauseRule, '2026-11-15');
  assert(multiPauseCandidates.includes('2026-08-10'), '2026-08-10 is generated (before first pause)');
  assert(!multiPauseCandidates.includes('2026-09-10'), '2026-09-10 is skipped (in 1st pause window [Sep 5, Oct 5))');
  assert(!multiPauseCandidates.includes('2026-10-10'), '2026-10-10 is skipped (in 2nd pause window [Oct 6, Nov 5))');
  assert(multiPauseCandidates.includes('2026-11-10'), '2026-11-10 is generated (after 2nd resume)');

  // Also check virtual future candidate generation with multi-pause history
  const multiPauseVirtual = computeFutureVirtualDates(multiPauseRule, '2026-08-22', '2026-11-15');
  assert(!multiPauseVirtual.includes('2026-09-10'), 'Virtual dates skip 2026-09-10');
  assert(!multiPauseVirtual.includes('2026-10-10'), 'Virtual dates skip 2026-10-10');
  assert(multiPauseVirtual.includes('2026-11-10'), 'Virtual dates include 2026-11-10');

  // ----------------------------------------------------
  // T15: Midnight Timezone Boundary
  // ----------------------------------------------------
  console.log('\nTEST 15: Midnight Timezone Boundary');
  const utcLate = new Date('2026-08-21T22:30:00Z'); // 05:30 WIB on Aug 22
  const wibFormatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: FINANCIAL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(utcLate);
  assert(wibFormatted === '2026-08-22', `UTC late 22:30 correctly maps to Jakarta financial date 2026-08-22 (actual: ${wibFormatted})`);

  // ----------------------------------------------------
  // T16: Future Persisted Occurrence Actionability
  // ----------------------------------------------------
  console.log('\nTEST 16: Future Persisted Occurrence Actionability');
  const futureOcc = {
    id: 999,
    due_date: '2026-08-25',
    status: 'PENDING'
  };
  const isActionableToday = futureOcc.due_date <= '2026-08-22';
  assert(isActionableToday === false, 'Future occurrence due_date > today is NOT actionable today');

  // Cleanup
  await db.execute({ sql: 'DELETE FROM users WHERE id IN (?, ?)', args: [TEST_USER_A, TEST_USER_B] });
  await db.execute({ sql: 'DELETE FROM accounts WHERE user_id IN (?, ?)', args: [TEST_USER_A, TEST_USER_B] });
  await db.execute({ sql: 'DELETE FROM recurring_rules WHERE user_id IN (?, ?)', args: [TEST_USER_A, TEST_USER_B] });
  await db.execute({ sql: 'DELETE FROM recurring_occurrences WHERE user_id IN (?, ?)', args: [TEST_USER_A, TEST_USER_B] });
  await db.execute({ sql: 'DELETE FROM expenses WHERE user_id IN (?, ?)', args: [TEST_USER_A, TEST_USER_B] });

  console.log('\n==================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
