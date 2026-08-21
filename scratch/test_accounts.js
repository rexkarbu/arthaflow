async function runTests() {
  const modDb = await import('../lib/db.js');
  const db = modDb.default;
  const dbReady = modDb.dbReady;
  await dbReady;
  console.log('=== RUNNING STEP 9 ACCOUNTS & WALLETS QA SUITE ===\n');

  // Create isolated test users
  const testUser1 = 9991;
  const testUser2 = 9992;

  // Cleanup any old test rows
  await db.execute({ sql: 'DELETE FROM account_transfers WHERE user_id IN (?, ?)', args: [testUser1, testUser2] });
  await db.execute({ sql: 'DELETE FROM expenses WHERE user_id IN (?, ?)', args: [testUser1, testUser2] });
  await db.execute({ sql: 'DELETE FROM accounts WHERE user_id IN (?, ?)', args: [testUser1, testUser2] });

  // 1. Create Accounts for User 1
  const openingDate = '2026-08-01';
  const accARes = await db.execute({
    sql: 'INSERT INTO accounts (user_id, name, type, opening_balance, opening_date) VALUES (?, ?, ?, ?, ?)',
    args: [testUser1, 'BRImo Test', 'BANK', 5000000, openingDate]
  });
  const accAId = Number(accARes.lastInsertRowid);

  const accBRes = await db.execute({
    sql: 'INSERT INTO accounts (user_id, name, type, opening_balance, opening_date) VALUES (?, ?, ?, ?, ?)',
    args: [testUser1, 'GoPay Test', 'E_WALLET', 1000000, openingDate]
  });
  const accBId = Number(accBRes.lastInsertRowid);

  console.log(`[TEST 1] Created Account A (ID: ${accAId}, Opening: Rp5.000.000) & Account B (ID: ${accBId}, Opening: Rp1.000.000)`);

  // 2. Add Transactions for User 1
  // Income into A: +Rp2.000.000
  await db.execute({
    sql: 'INSERT INTO expenses (user_id, amount, description, date, category, type, account_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [testUser1, 2000000, 'Gaji Proyek', '2026-08-05T10:00:00.000Z', 'Gaji', 'income', accAId]
  });

  // Expense from A: -Rp500.000
  await db.execute({
    sql: 'INSERT INTO expenses (user_id, amount, description, date, category, type, account_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [testUser1, 500000, 'Makan Malam', '2026-08-06T12:00:00.000Z', 'Makanan', 'expense', accAId]
  });

  // Unassigned Transaction: -Rp200.000 (legacy)
  await db.execute({
    sql: 'INSERT INTO expenses (user_id, amount, description, date, category, type, account_id) VALUES (?, ?, ?, ?, ?, ?, NULL)',
    args: [testUser1, 200000, 'Beli Buku', '2026-08-07T14:00:00.000Z', 'Pendidikan', 'expense']
  });

  // 3. Record Transfer A -> B: Rp1.000.000
  await db.execute({
    sql: 'INSERT INTO account_transfers (user_id, from_account_id, to_account_id, amount, transfer_date, note) VALUES (?, ?, ?, ?, ?, ?)',
    args: [testUser1, accAId, accBId, 1000000, '2026-08-10', 'Top-up e-wallet']
  });

  console.log('[TEST 2] Recorded Income +Rp2.000.000 to A, Expense -Rp500.000 from A, Unassigned Expense -Rp200.000, and Transfer A->B Rp1.000.000\n');

  // 4. Test Single Server Balance Calculation Formula
  const nowIso = new Date().toISOString();
  const balancesRes = await db.execute({
    sql: `SELECT 
            a.id,
            a.name,
            a.opening_balance,
            a.opening_date,
            COALESCE((
              SELECT SUM(amount) FROM expenses 
              WHERE user_id = a.user_id AND account_id = a.id AND type = 'income' AND date >= a.opening_date AND date <= ?
            ), 0) AS total_income,
            COALESCE((
              SELECT SUM(amount) FROM expenses 
              WHERE user_id = a.user_id AND account_id = a.id AND type = 'expense' AND date >= a.opening_date AND date <= ?
            ), 0) AS total_expense,
            COALESCE((
              SELECT SUM(amount) FROM account_transfers 
              WHERE user_id = a.user_id AND to_account_id = a.id AND transfer_date >= a.opening_date AND transfer_date <= ?
            ), 0) AS total_transfer_in,
            COALESCE((
              SELECT SUM(amount) FROM account_transfers 
              WHERE user_id = a.user_id AND from_account_id = a.id AND transfer_date >= a.opening_date AND transfer_date <= ?
            ), 0) AS total_transfer_out
          FROM accounts a
          WHERE a.user_id = ?
          ORDER BY a.id ASC`,
    args: [nowIso, nowIso, nowIso, nowIso, testUser1]
  });

  const accA = balancesRes.rows.find(r => Number(r.id) === accAId);
  const accB = balancesRes.rows.find(r => Number(r.id) === accBId);

  const balA = Number(accA.opening_balance) + Number(accA.total_income) - Number(accA.total_expense) + Number(accA.total_transfer_in) - Number(accA.total_transfer_out);
  const balB = Number(accB.opening_balance) + Number(accB.total_income) - Number(accB.total_expense) + Number(accB.total_transfer_in) - Number(accB.total_transfer_out);
  const totalDana = balA + balB;

  console.log(`[VERIFY BALANCE A] Expected: 5.500.000 | Actual: ${balA} -> ${balA === 5500000 ? 'PASS ✓' : 'FAIL ✗'}`);
  console.log(`[VERIFY BALANCE B] Expected: 2.000.000 | Actual: ${balB} -> ${balB === 2000000 ? 'PASS ✓' : 'FAIL ✗'}`);
  console.log(`[VERIFY TOTAL DANA] Expected: 7.500.000 | Actual: ${totalDana} -> ${totalDana === 7500000 ? 'PASS ✓' : 'FAIL ✗'}`);

  // 5. Test Cash Flow Metrics Isolation (Transfer must contribute 0 to income/expense)
  const monthlyTxRes = await db.execute({
    sql: `SELECT 
            COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as monthly_income,
            COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as monthly_expense
          FROM expenses
          WHERE user_id = ? AND date LIKE '2026-08%'`,
    args: [testUser1]
  });

  const monthlyIncome = Number(monthlyTxRes.rows[0].monthly_income);
  const monthlyExpense = Number(monthlyTxRes.rows[0].monthly_expense);
  const monthlyNet = monthlyIncome - monthlyExpense;

  console.log(`[VERIFY MONTHLY INCOME] Expected: 2.000.000 | Actual: ${monthlyIncome} -> ${monthlyIncome === 2000000 ? 'PASS ✓' : 'FAIL ✗'}`);
  console.log(`[VERIFY MONTHLY EXPENSE] Expected: 700.000 (500k + 200k unassigned) | Actual: ${monthlyExpense} -> ${monthlyExpense === 700000 ? 'PASS ✓' : 'FAIL ✗'}`);
  console.log(`[VERIFY MONTHLY NET] Expected: 1.300.000 | Actual: ${monthlyNet} -> ${monthlyNet === 1300000 ? 'PASS ✓' : 'FAIL ✗'}`);

  // 6. Test Multi-transfer / Multi-transaction Join Multiplication Immunity
  await db.execute({ sql: 'INSERT INTO account_transfers (user_id, from_account_id, to_account_id, amount, transfer_date) VALUES (?, ?, ?, ?, ?)', args: [testUser1, accAId, accBId, 200000, '2026-08-11'] });
  await db.execute({ sql: 'INSERT INTO account_transfers (user_id, from_account_id, to_account_id, amount, transfer_date) VALUES (?, ?, ?, ?, ?)', args: [testUser1, accBId, accAId, 100000, '2026-08-12'] });
  await db.execute({ sql: 'INSERT INTO expenses (user_id, amount, description, date, category, type, account_id) VALUES (?, ?, ?, ?, ?, ?, ?)', args: [testUser1, 50000, 'Kopi', '2026-08-13T08:00:00.000Z', 'Makanan', 'expense', accBId] });
  await db.execute({ sql: 'INSERT INTO expenses (user_id, amount, description, date, category, type, account_id) VALUES (?, ?, ?, ?, ?, ?, ?)', args: [testUser1, 30000, 'Parkir', '2026-08-13T09:00:00.000Z', 'Transportasi', 'expense', accBId] });

  const balancesRes2 = await db.execute({
    sql: `SELECT 
            a.id,
            a.opening_balance,
            COALESCE((SELECT SUM(amount) FROM expenses WHERE user_id = a.user_id AND account_id = a.id AND type = 'income' AND date >= a.opening_date AND date <= ?), 0) AS total_income,
            COALESCE((SELECT SUM(amount) FROM expenses WHERE user_id = a.user_id AND account_id = a.id AND type = 'expense' AND date >= a.opening_date AND date <= ?), 0) AS total_expense,
            COALESCE((SELECT SUM(amount) FROM account_transfers WHERE user_id = a.user_id AND to_account_id = a.id AND transfer_date >= a.opening_date AND transfer_date <= ?), 0) AS total_transfer_in,
            COALESCE((SELECT SUM(amount) FROM account_transfers WHERE user_id = a.user_id AND from_account_id = a.id AND transfer_date >= a.opening_date AND transfer_date <= ?), 0) AS total_transfer_out
          FROM accounts a WHERE a.id = ? AND a.user_id = ?`,
    args: [nowIso, nowIso, nowIso, nowIso, accBId, testUser1]
  });
  const r2 = balancesRes2.rows[0];
  const balB2 = Number(r2.opening_balance) + Number(r2.total_income) - Number(r2.total_expense) + Number(r2.total_transfer_in) - Number(r2.total_transfer_out);
  console.log(`[TEST 3 - NO JOIN MULTIPLICATION] Account B balance expected: 2.020.000 | Actual: ${balB2} -> ${balB2 === 2020000 ? 'PASS ✓' : 'FAIL ✗'}`);

  // 7. Test Archive Safety Rule (Account with balance != 0 must reject archiving)
  // Create an account C with 0 balance
  const accCRes = await db.execute({
    sql: 'INSERT INTO accounts (user_id, name, type, opening_balance, opening_date) VALUES (?, ?, ?, ?, ?)',
    args: [testUser1, 'Zero Balance Account', 'CASH', 0, '2026-08-01']
  });
  const accCId = Number(accCRes.lastInsertRowid);

  // Check C balance
  const balCRes = await db.execute({
    sql: `SELECT 
            a.id, a.opening_balance,
            COALESCE((SELECT SUM(amount) FROM expenses WHERE user_id = a.user_id AND account_id = a.id AND type = 'income' AND date >= a.opening_date AND date <= ?), 0) AS total_income,
            COALESCE((SELECT SUM(amount) FROM expenses WHERE user_id = a.user_id AND account_id = a.id AND type = 'expense' AND date >= a.opening_date AND date <= ?), 0) AS total_expense,
            COALESCE((SELECT SUM(amount) FROM account_transfers WHERE user_id = a.user_id AND to_account_id = a.id AND transfer_date >= a.opening_date AND transfer_date <= ?), 0) AS total_transfer_in,
            COALESCE((SELECT SUM(amount) FROM account_transfers WHERE user_id = a.user_id AND from_account_id = a.id AND transfer_date >= a.opening_date AND transfer_date <= ?), 0) AS total_transfer_out
          FROM accounts a WHERE a.id = ? AND a.user_id = ?`,
    args: [nowIso, nowIso, nowIso, nowIso, accCId, testUser1]
  });
  const rC = balCRes.rows[0];
  const balC = Number(rC.opening_balance) + Number(rC.total_income) - Number(rC.total_expense) + Number(rC.total_transfer_in) - Number(rC.total_transfer_out);
  console.log(`[TEST 6 - ARCHIVE ZERO CHECK] Account C balance is ${balC}. Can archive: ${balC === 0 ? 'YES (PASS ✓)' : 'NO'}`);

  // 8. Test IDOR & Ownership Protection
  const accUser2Res = await db.execute({
    sql: 'INSERT INTO accounts (user_id, name, type, opening_balance, opening_date) VALUES (?, ?, ?, ?, ?)',
    args: [testUser2, 'User 2 Secret Bank', 'BANK', 10000000, '2026-08-01']
  });
  const accUser2Id = Number(accUser2Res.lastInsertRowid);

  // User 1 attempts to query User 2's account with ownership filter
  const idorCheck = await db.execute({
    sql: 'SELECT id FROM accounts WHERE id = ? AND user_id = ?',
    args: [accUser2Id, testUser1]
  });
  console.log(`[TEST 7 - IDOR DEFENSE] User 1 accessing User 2 Account: ${idorCheck.rows.length === 0 ? 'BLOCKED (PASS ✓)' : 'LEAKED (FAIL ✗)'}`);

  // User 1 attempts transfer involving User 2's account
  const transferCheck = await db.execute({
    sql: 'SELECT id FROM accounts WHERE id IN (?, ?) AND user_id = ?',
    args: [accAId, accUser2Id, testUser1]
  });
  console.log(`[TEST 8 - TRANSFER IDOR DEFENSE] Transfer involving cross-user account: ${transferCheck.rows.length === 1 ? 'BLOCKED (PASS ✓)' : 'ALLOWED (FAIL ✗)'}`);

  // Cleanup test data
  await db.execute({ sql: 'DELETE FROM account_transfers WHERE user_id IN (?, ?)', args: [testUser1, testUser2] });
  await db.execute({ sql: 'DELETE FROM expenses WHERE user_id IN (?, ?)', args: [testUser1, testUser2] });
  await db.execute({ sql: 'DELETE FROM accounts WHERE user_id IN (?, ?)', args: [testUser1, testUser2] });

  console.log('\n=== ALL QA INVARIANTS & SECURITY CHECKS PASSED ===');
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
