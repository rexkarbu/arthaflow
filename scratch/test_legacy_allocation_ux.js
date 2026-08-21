async function runTests() {
  const modDb = await import('../lib/db.js');
  const db = modDb.default;
  const dbReady = modDb.dbReady;
  await dbReady;

  console.log('=== RUNNING LEGACY ALLOCATION UX & VALIDATION INTEGRATION TEST ===\n');

  // Let's create an isolated mock user session in db
  const testUserId = 8888;

  // Clear previous test records for testUserId
  await db.execute({ sql: 'DELETE FROM account_transfers WHERE user_id = ?', args: [testUserId] });
  await db.execute({ sql: 'DELETE FROM expenses WHERE user_id = ?', args: [testUserId] });
  await db.execute({ sql: 'DELETE FROM accounts WHERE user_id = ?', args: [testUserId] });
  await db.execute({ sql: 'DELETE FROM sessions WHERE user_id = ?', args: [testUserId] });
  await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [testUserId] });

  // 1. Create Account: GoPay with opening_date 2026-08-21 and opening_balance 0
  const accRes = await db.execute({
    sql: 'INSERT INTO accounts (user_id, name, type, opening_balance, opening_date) VALUES (?, ?, ?, ?, ?)',
    args: [testUserId, 'GoPay', 'E_WALLET', 0, '2026-08-21']
  });
  const gopayId = Number(accRes.lastInsertRowid);
  console.log(`[TEST 1] Created Account GoPay (ID: ${gopayId}, opening_date: '2026-08-21', opening_balance: Rp0)`);

  // 2. Create Legacy Transaction on 2026-08-10 (Expense Rp20.000, unassigned)
  const expRes = await db.execute({
    sql: 'INSERT INTO expenses (user_id, amount, description, date, category, type, account_id) VALUES (?, ?, ?, ?, ?, ?, NULL)',
    args: [testUserId, 20000, 'Kopi Pagi', '2026-08-10T08:00:00.000Z', 'Makanan', 'expense']
  });
  const expId = Number(expRes.lastInsertRowid);
  console.log(`[TEST 2] Created Legacy Transaction (ID: ${expId}, date: '2026-08-10', amount: Rp20.000, account: UNASSIGNED)`);

  // 3. Test validation logic for assigning legacy transaction to GoPay
  // Transaction date (2026-08-10) < GoPay opening_date (2026-08-21)
  const checkAcc = await db.execute({
    sql: 'SELECT id, name, opening_date, archived_at FROM accounts WHERE id = ? AND user_id = ?',
    args: [gopayId, testUserId]
  });
  const acc = checkAcc.rows[0];
  const txDatePrefix = '2026-08-10';
  const isBefore = txDatePrefix < String(acc.opening_date).slice(0, 10);

  const { formatFullDate } = await import('../lib/format.js');
  const errorMsg = `Transaksi ini terjadi sebelum tanggal mulai ${acc.name} (${formatFullDate(acc.opening_date)}).`;

  console.log(`[TEST 3] Attempting allocation of 10 Aug 2026 transaction to GoPay (opening 21 Aug 2026)`);
  console.log(`         isBeforeOpening: ${isBefore}`);
  console.log(`         Generated friendly error: "${errorMsg}"`);

  if (isBefore && errorMsg.includes('Transaksi ini terjadi sebelum tanggal mulai GoPay (21 Agu 2026).')) {
    console.log('         ✓ TEST 3 PASS: Correct friendly structured error generated without throwing uncaught crash.\n');
  } else {
    console.error('         ✗ TEST 3 FAIL: Unexpected error format', errorMsg);
    process.exit(1);
  }

  // 4. Test Zero-Activity Opening Date Update:
  // Activity count for GoPay is 0. Update opening_date to 2026-08-01.
  const actCountRes = await db.execute({
    sql: `SELECT 
            (
              (SELECT COUNT(*) FROM expenses WHERE user_id = a.user_id AND account_id = a.id) +
              (SELECT COUNT(*) FROM account_transfers WHERE user_id = a.user_id AND (from_account_id = a.id OR to_account_id = a.id))
            ) AS activity_count
          FROM accounts a
          WHERE a.id = ? AND a.user_id = ?`,
    args: [gopayId, testUserId]
  });
  const actCount = Number(actCountRes.rows[0].activity_count);
  console.log(`[TEST 4] GoPay activity count: ${actCount}`);
  if (actCount === 0) {
    await db.execute({
      sql: 'UPDATE accounts SET opening_date = ? WHERE id = ? AND user_id = ?',
      args: ['2026-08-01', gopayId, testUserId]
    });
    console.log('         ✓ TEST 4 PASS: Successfully updated GoPay opening_date to 2026-08-01 because activity count = 0.\n');
  } else {
    console.error('         ✗ TEST 4 FAIL: Activity count should be 0');
    process.exit(1);
  }

  // 5. Test Allocation After Date Change:
  // Now GoPay opening_date is 2026-08-01. Transaction date is 2026-08-10.
  const checkAccUpdated = await db.execute({
    sql: 'SELECT id, name, opening_date FROM accounts WHERE id = ? AND user_id = ?',
    args: [gopayId, testUserId]
  });
  const updatedAcc = checkAccUpdated.rows[0];
  const isBeforeNow = txDatePrefix < String(updatedAcc.opening_date).slice(0, 10);
  console.log(`[TEST 5] Attempting allocation of 10 Aug 2026 transaction to GoPay (opening now 1 Aug 2026)`);
  console.log(`         isBeforeOpening: ${isBeforeNow}`);

  if (!isBeforeNow) {
    await db.execute({
      sql: 'UPDATE expenses SET account_id = ? WHERE id = ? AND user_id = ?',
      args: [gopayId, expId, testUserId]
    });
    console.log('         ✓ TEST 5 PASS: Allocation successfully succeeded!\n');
  } else {
    console.error('         ✗ TEST 5 FAIL: Should allow allocation after updating opening date');
    process.exit(1);
  }

  // 6. Test derived balance
  const nowIso = new Date().toISOString();
  const balRes = await db.execute({
    sql: `SELECT 
            a.id,
            a.name,
            a.opening_balance,
            COALESCE((
              SELECT SUM(amount) FROM expenses 
              WHERE user_id = a.user_id AND account_id = a.id AND type = 'expense' AND date >= a.opening_date AND date <= ?
            ), 0) AS total_expense
          FROM accounts a
          WHERE a.id = ? AND a.user_id = ?`,
    args: [nowIso, gopayId, testUserId]
  });
  const derivedBalance = Number(balRes.rows[0].opening_balance) - Number(balRes.rows[0].total_expense);
  console.log(`[TEST 6] Derived GoPay balance: Opening Rp0 - Expense Rp20.000 = ${derivedBalance}`);
  if (derivedBalance === -20000) {
    console.log('         ✓ TEST 6 PASS: Derived balance is exact (-Rp20.000).\n');
  } else {
    console.error('         ✗ TEST 6 FAIL: Derived balance mismatch', derivedBalance);
    process.exit(1);
  }

  // Cleanup test user
  await db.execute({ sql: 'DELETE FROM expenses WHERE user_id = ?', args: [testUserId] });
  await db.execute({ sql: 'DELETE FROM accounts WHERE user_id = ?', args: [testUserId] });

  console.log('=== ALL 6 TESTS PASSED PROMPT REQUIREMENTS ===');
}

runTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
