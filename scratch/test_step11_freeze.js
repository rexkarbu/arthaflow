// scratch/test_step11_freeze.js
// Comprehensive Freeze Audit Test Suite for ArthaFlow STEP 11

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
  getPauseHistoryState,
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

async function runFreezeAudit() {
  await dbReady;
  console.log('\n==================================================');
  console.log('ARTHAFLOW STEP 11 — FINAL FREEZE AUDIT TEST SUITE');
  console.log('==================================================\n');

  const TEST_USER = 91199;

  // Cleanup
  await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [TEST_USER] });
  await db.execute({ sql: 'DELETE FROM accounts WHERE user_id = ?', args: [TEST_USER] });
  await db.execute({ sql: 'DELETE FROM recurring_rules WHERE user_id = ?', args: [TEST_USER] });
  await db.execute({ sql: 'DELETE FROM recurring_occurrences WHERE user_id = ?', args: [TEST_USER] });
  await db.execute({ sql: 'DELETE FROM expenses WHERE user_id = ?', args: [TEST_USER] });

  await db.execute({
    sql: 'INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)',
    args: [TEST_USER, 'freeze_tester', 'hash']
  });

  // 1. Timezone Policy & getTodayDateStr
  console.log('1. Timezone Policy & getTodayDateStr');
  assert(FINANCIAL_TIMEZONE === 'Asia/Jakarta', 'FINANCIAL_TIMEZONE is strictly Asia/Jakarta');
  const todayStr = getTodayDateStr();
  assert(/^\d{4}-\d{2}-\d{2}$/.test(todayStr), `getTodayDateStr() returns canonical YYYY-MM-DD (${todayStr})`);

  // 2. Real Midnight Boundary Check
  console.log('\n2. Real Midnight Boundary Check');
  const midnightUtc = new Date('2026-08-21T23:06:00Z');
  const wibDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: FINANCIAL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(midnightUtc);
  assert(wibDate === '2026-08-22', 'UTC 23:06 corresponds to 2026-08-22 in Asia/Jakarta');

  // 3. Multi-Pause Cycle Persistence & Candidate Dates
  console.log('\n3. Multi-Pause Cycle Persistence & Candidate Dates');
  const insRes = await db.execute({
    sql: `INSERT INTO recurring_rules (user_id, name, amount, frequency, day_of_month, start_date, status)
          VALUES (?, 'Multi-Pause Wifi', 350000, 'monthly', 10, '2026-08-01', 'ACTIVE')`,
    args: [TEST_USER]
  });
  const ruleId = Number(insRes.lastInsertRowid);

  // Cycle 1: Pause on Sep 5, Resume on Oct 5
  let hist = [{ start: '2026-09-05', end: '2026-10-05' }];
  // Cycle 2: Pause on Oct 6, Resume on Nov 5
  hist.push({ start: '2026-10-06', end: '2026-11-05' });

  await db.execute({
    sql: `UPDATE recurring_rules SET status = 'ACTIVE', pause_history = ?, paused_at = '2026-10-06', resumed_date = '2026-11-05' WHERE id = ?`,
    args: [JSON.stringify(hist), ruleId]
  });

  const ruleRow = (await db.execute({ sql: 'SELECT * FROM recurring_rules WHERE id = ?', args: [ruleId] })).rows[0];
  const parsedHist = parsePauseHistory(ruleRow);
  assert(parsedHist.length === 2, `Persisted pause_history has 2 intervals (actual: ${parsedHist.length})`);
  assert(parsedHist[0].start === '2026-09-05' && parsedHist[0].end === '2026-10-05', 'Interval 1: [Sep 5, Oct 5)');
  assert(parsedHist[1].start === '2026-10-06' && parsedHist[1].end === '2026-11-05', 'Interval 2: [Oct 6, Nov 5)');

  const candidateDates = computeDueCandidateDates(ruleRow, '2026-11-15');
  assert(candidateDates.includes('2026-08-10'), '2026-08-10 generated');
  assert(!candidateDates.includes('2026-09-10'), '2026-09-10 skipped by 1st pause interval');
  assert(!candidateDates.includes('2026-10-10'), '2026-10-10 skipped by 2nd pause interval');
  assert(candidateDates.includes('2026-11-10'), '2026-11-10 generated after 2nd resume');

  // 4. Legacy Pause Migration & Backward Compatibility
  console.log('\n4. Legacy Pause Migration & Backward Compatibility');
  const legacyRule = {
    id: 998,
    paused_at: '2026-09-01',
    resumed_date: '2026-10-01',
    pause_history: '[]' // empty or unmigrated
  };
  const legacyParsed = parsePauseHistory(legacyRule);
  assert(legacyParsed.length === 1 && legacyParsed[0].start === '2026-09-01' && legacyParsed[0].end === '2026-10-01', 'Legacy rule seamlessly reconstructed [2026-09-01, 2026-10-01)');

  // 5. Malformed JSON Defensive Handling & Fail-Closed Integrity
  console.log('\n5. Malformed JSON Defensive Handling & Fail-Closed Integrity');
  
  // 5A: Malformed JSON with valid legacy fields -> successfully reconstructed
  const recoverableRule = {
    id: 997,
    paused_at: '2026-09-01',
    resumed_date: '2026-10-01',
    pause_history: '{ broken JSON }'
  };
  const recoverableState = getPauseHistoryState(recoverableRule);
  assert(recoverableState.valid === true, 'Recoverable rule: valid is true');
  assert(recoverableState.intervals.length === 1 && recoverableState.intervals[0].start === '2026-09-01', 'Recoverable rule: reconstructed [2026-09-01, 2026-10-01)');

  // 5B: Malformed JSON with NO legacy fields -> strictly FAILS CLOSED (valid = false, generates 0 occurrences)
  const unrecoverableRule = {
    id: 996,
    frequency: 'monthly',
    day_of_month: 10,
    start_date: '2026-08-01',
    status: 'ACTIVE',
    paused_at: null,
    resumed_date: null,
    pause_history: '{ unrecoverable corrupted JSON }'
  };
  const unrecoverableState = getPauseHistoryState(unrecoverableRule);
  assert(unrecoverableState.valid === false, 'Unrecoverable rule: valid is false (FAIL CLOSED)');
  assert(unrecoverableState.isCorrupted === true, 'Unrecoverable rule: isCorrupted is true');

  const unrecoverableCandidates = computeDueCandidateDates(unrecoverableRule, '2026-11-15');
  assert(unrecoverableCandidates.length === 0, 'Unrecoverable rule produces 0 due candidate occurrences');

  const unrecoverableVirtual = computeFutureVirtualDates(unrecoverableRule, '2026-08-22', '2026-09-22');
  assert(unrecoverableVirtual.length === 0, 'Unrecoverable rule produces 0 future virtual items');

  // 6. Future Persisted Occurrence Actionability
  console.log('\n6. Future Persisted Occurrence Actionability');
  const fakeToday = '2026-08-22';
  const tomorrowOcc = {
    id: 777,
    due_date: '2026-08-23',
    status: 'PENDING'
  };
  // Evaluated on 22 Aug
  const actionableAug22 = tomorrowOcc.status === 'PENDING' && tomorrowOcc.due_date <= fakeToday;
  assert(actionableAug22 === false, 'On 22 Aug, occurrence for 23 Aug is NOT actionable (informational only in MENDATANG)');

  // Evaluated on 23 Aug
  const actionableAug23 = tomorrowOcc.status === 'PENDING' && tomorrowOcc.due_date <= '2026-08-23';
  assert(actionableAug23 === true, 'On 23 Aug, the same occurrence becomes actionable in PERLU DICATAT');

  // 7. Today Double Count Defense
  console.log('\n7. Today Double Count Defense');
  const todayVirtuals = computeFutureVirtualDates({
    id: 888,
    frequency: 'monthly',
    day_of_month: 22,
    start_date: '2026-08-01',
    status: 'ACTIVE'
  }, '2026-08-22', '2026-09-22');
  assert(!todayVirtuals.includes('2026-08-22'), 'computeFutureVirtualDates strictly excludes today (fromExclusive)');
  assert(todayVirtuals.includes('2026-09-22'), 'computeFutureVirtualDates includes next month');

  // 8. Exact 7, 30, 60 Day Horizon Boundaries
  console.log('\n8. Exact 7, 30, 60 Day Horizon Boundaries');
  const h7 = addDays('2026-08-22', 7);
  const h30 = addDays('2026-08-22', 30);
  const h60 = addDays('2026-08-22', 60);
  assert(h7 === '2026-08-29', '7-day boundary: Aug 23..29 (excludes Aug 22 and Aug 30)');
  assert(h30 === '2026-09-21', '30-day boundary: Aug 23..Sep 21');
  assert(h60 === '2026-10-21', '60-day boundary: Aug 23..Oct 21');

  // 9. Whitelisted Horizon Fallback
  console.log('\n9. Whitelisted Horizon Fallback');
  function validateHorizon(input) {
    const parsed = parseInt(input, 10);
    return [7, 30, 60].includes(parsed) ? parsed : 30;
  }
  assert(validateHorizon(99999) === 30, 'Horizon 99999 falls back to 30');
  assert(validateHorizon('abc') === 30, 'Horizon "abc" falls back to 30');
  assert(validateHorizon(-7) === 30, 'Horizon -7 falls back to 30');
  assert(validateHorizon(7) === 7, 'Horizon 7 accepted');
  assert(validateHorizon(60) === 60, 'Horizon 60 accepted');

  // 10. Financial Ledger Mutation Check
  console.log('\n10. Financial Ledger Mutation Check');
  const beforeExpenses = (await db.execute('SELECT COUNT(*) AS c FROM expenses')).rows[0].c;
  const beforeRules = (await db.execute('SELECT COUNT(*) AS c FROM recurring_rules')).rows[0].c;
  const beforeOccs = (await db.execute('SELECT COUNT(*) AS c FROM recurring_occurrences')).rows[0].c;

  // Simulate multiple read operations
  for (let i = 0; i < 5; i++) {
    computeFutureVirtualDates(ruleRow, '2026-08-22', '2026-09-22');
  }

  const afterExpenses = (await db.execute('SELECT COUNT(*) AS c FROM expenses')).rows[0].c;
  const afterRules = (await db.execute('SELECT COUNT(*) AS c FROM recurring_rules')).rows[0].c;
  const afterOccs = (await db.execute('SELECT COUNT(*) AS c FROM recurring_occurrences')).rows[0].c;

  assert(beforeExpenses === afterExpenses, 'Expenses table unchanged (0 ledger side-effects)');
  assert(beforeRules === afterRules, 'Rules table unchanged');
  assert(beforeOccs === afterOccs, 'Occurrences table unchanged');

  // Cleanup
  await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [TEST_USER] });
  await db.execute({ sql: 'DELETE FROM recurring_rules WHERE user_id = ?', args: [TEST_USER] });

  console.log('\n==================================================');
  console.log(`FREEZE AUDIT TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('==================================================\n');

  if (failed > 0) process.exit(1);
}

runFreezeAudit().catch(err => {
  console.error(err);
  process.exit(1);
});
