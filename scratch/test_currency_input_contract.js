async function runCurrencyInputAuditTests() {
  const { formatCurrencyInput, parseCurrency } = await import('../lib/currency.js');
  const modDb = await import('../lib/db.js');
  const db = modDb.default;
  const dbReady = modDb.dbReady;
  await dbReady;

  console.log('=== RUNNING CURRENCYINPUT CONTRACT & TRANSFER AUDIT SUITE ===\n');

  // ========================================================
  // 1. UNIT TEST: CurrencyInput handleChange Emulation
  // ========================================================
  console.log('[TEST 1] Auditing CurrencyInput Callback Signatures & Typing Progression...');
  
  function simulateCurrencyInputChange(inputValue, onChangeHandler) {
    const cleanNum = parseCurrency(inputValue);
    const formatted = formatCurrencyInput(inputValue);
    const syntheticEvent = { target: { value: inputValue } };
    
    let handlerResult = null;
    if (onChangeHandler) {
      handlerResult = onChangeHandler(cleanNum, formatted, syntheticEvent);
    }
    return { cleanNum, formatted, handlerResult };
  }

  // A. Broken Handler Test (Reproduce exact bug)
  const brokenHandler = (e) => {
    try {
      return e.target.value;
    } catch (err) {
      return `CRASH: ${err.message}`;
    }
  };

  const brokenResult = simulateCurrencyInputChange('50000', brokenHandler);
  console.log(`         Broken handler result with '50000': ${brokenResult.handlerResult}`);
  if (String(brokenResult.handlerResult).includes('Cannot read properties of undefined')) {
    console.log('         ✓ TEST 1A PASS: Exact crash reproduced on incorrect event assumption.');
  } else {
    throw new Error('TEST 1A FAIL: Expected crash not reproduced');
  }

  // B. Fixed Handler Test (Contract verification)
  let transferAmountState = '';
  const fixedTransferHandler = (raw, formatted) => {
    transferAmountState = formatted;
  };

  const typingSequence = ['', '1', '10', '100', '1000', '10000', '500000'];
  const expectedFormatted = ['', '1', '10', '100', '1.000', '10.000', '500.000'];
  const expectedNumeric = [0, 1, 10, 100, 1000, 10000, 500000];

  for (let i = 0; i < typingSequence.length; i++) {
    const input = typingSequence[i];
    const res = simulateCurrencyInputChange(input, fixedTransferHandler);
    if (res.cleanNum !== expectedNumeric[i] || res.formatted !== expectedFormatted[i] || transferAmountState !== expectedFormatted[i]) {
      throw new Error(`Typing progression mismatch at "${input}": got cleanNum=${res.cleanNum}, formatted=${res.formatted}`);
    }
  }
  console.log('         ✓ TEST 1B PASS: Typing progression [empty, 1, 10, 100, 1.000, 10.000, 500.000] verified with 0 errors.');

  // C. Deletion / Backspace Progression (Zero Stuck Prevention)
  const deletionSequence = ['500000', '50000', '5000', '500', '50', '5', ''];
  const expectedDeletion = ['500.000', '50.000', '5.000', '500', '50', '5', ''];
  for (let i = 0; i < deletionSequence.length; i++) {
    const input = deletionSequence[i];
    const res = simulateCurrencyInputChange(input, fixedTransferHandler);
    if (res.formatted !== expectedDeletion[i] || transferAmountState !== expectedDeletion[i]) {
      throw new Error(`Deletion progression mismatch at "${input}"`);
    }
  }
  console.log('         ✓ TEST 1C PASS: Deletion sequence back to empty string verified without getting stuck at Rp 0.\n');

  // ========================================================
  // 2. INTEGRATION TEST: Transfer Execution & Balance Invariants
  // ========================================================
  console.log('[TEST 2] Transfer Dana Integration & Isolation Invariants...');
  const testUserId = 99001;

  // Cleanup isolated test user
  await db.execute({ sql: 'DELETE FROM account_transfers WHERE user_id = ?', args: [testUserId] });
  await db.execute({ sql: 'DELETE FROM expenses WHERE user_id = ?', args: [testUserId] });
  await db.execute({ sql: 'DELETE FROM accounts WHERE user_id = ?', args: [testUserId] });
  await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [testUserId] });

  // Create test user
  await db.execute({
    sql: 'INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)',
    args: [testUserId, 'user_transfer_audit', 'dummy_hash']
  });

  // Create GoPay (Rp1.980.000) & SeaBank (Rp500.000)
  const gopayRes = await db.execute({
    sql: 'INSERT INTO accounts (user_id, name, type, opening_balance, opening_date) VALUES (?, ?, ?, ?, ?)',
    args: [testUserId, 'GoPay', 'E_WALLET', 1980000, '2026-08-01']
  });
  const gopayId = Number(gopayRes.lastInsertRowid);

  const seaBankRes = await db.execute({
    sql: 'INSERT INTO accounts (user_id, name, type, opening_balance, opening_date) VALUES (?, ?, ?, ?, ?)',
    args: [testUserId, 'SeaBank', 'BANK', 500000, '2026-08-01']
  });
  const seaBankId = Number(seaBankRes.lastInsertRowid);

  // Helper to query balances
  const getAccBalance = async (accId) => {
    const nowIso = new Date().toISOString();
    const res = await db.execute({
      sql: `SELECT 
              a.id,
              a.opening_balance,
              COALESCE((SELECT SUM(amount) FROM expenses WHERE user_id = a.user_id AND account_id = a.id AND type = 'income' AND date >= a.opening_date AND date <= ?), 0) AS total_income,
              COALESCE((SELECT SUM(amount) FROM expenses WHERE user_id = a.user_id AND account_id = a.id AND type = 'expense' AND date >= a.opening_date AND date <= ?), 0) AS total_expense,
              COALESCE((SELECT SUM(amount) FROM account_transfers WHERE user_id = a.user_id AND to_account_id = a.id AND transfer_date >= a.opening_date AND transfer_date <= ?), 0) AS total_transfer_in,
              COALESCE((SELECT SUM(amount) FROM account_transfers WHERE user_id = a.user_id AND from_account_id = a.id AND transfer_date >= a.opening_date AND transfer_date <= ?), 0) AS total_transfer_out
            FROM accounts a WHERE a.id = ? AND a.user_id = ?`,
      args: [nowIso, nowIso, nowIso, nowIso, accId, testUserId]
    });
    const r = res.rows[0];
    return Number(r.opening_balance) + Number(r.total_income) - Number(r.total_expense) + Number(r.total_transfer_in) - Number(r.total_transfer_out);
  };

  const getCashflow = async () => {
    const res = await db.execute({
      sql: `SELECT 
              COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
              COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense
            FROM expenses WHERE user_id = ?`,
      args: [testUserId]
    });
    return {
      income: Number(res.rows[0].total_income),
      expense: Number(res.rows[0].total_expense)
    };
  };

  const gopayBalBefore = await getAccBalance(gopayId);
  const seaBankBalBefore = await getAccBalance(seaBankId);
  const totalDanaBefore = gopayBalBefore + seaBankBalBefore;
  const cashflowBefore = await getCashflow();

  console.log(`         [BEFORE] GoPay: Rp${gopayBalBefore.toLocaleString()}, SeaBank: Rp${seaBankBalBefore.toLocaleString()}, Total: Rp${totalDanaBefore.toLocaleString()}`);

  // Perform Transfer Rp500.000
  const transferAmount = parseCurrency('Rp 500.000');
  await db.execute({
    sql: `INSERT INTO account_transfers (user_id, from_account_id, to_account_id, amount, transfer_date, note)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [testUserId, gopayId, seaBankId, transferAmount, '2026-08-20T12:00:00.000Z', 'Transfer ke SeaBank']
  });

  const gopayBalAfter = await getAccBalance(gopayId);
  const seaBankBalAfter = await getAccBalance(seaBankId);
  const totalDanaAfter = gopayBalAfter + seaBankBalAfter;
  const cashflowAfter = await getCashflow();

  console.log(`         [AFTER]  GoPay: Rp${gopayBalAfter.toLocaleString()} (Expected: 1.480.000)`);
  console.log(`                  SeaBank: Rp${seaBankBalAfter.toLocaleString()} (Expected: 1.000.000)`);
  console.log(`                  Total Dana: Rp${totalDanaAfter.toLocaleString()} (Expected: 2.480.000, Unchanged)`);
  console.log(`                  Cashflow Income: Rp${cashflowAfter.income} (Unchanged: ${cashflowBefore.income === cashflowAfter.income})`);
  console.log(`                  Cashflow Expense: Rp${cashflowAfter.expense} (Unchanged: ${cashflowBefore.expense === cashflowAfter.expense})`);

  if (
    gopayBalAfter === 1480000 &&
    seaBankBalAfter === 1000000 &&
    totalDanaAfter === totalDanaBefore &&
    cashflowAfter.income === 0 &&
    cashflowAfter.expense === 0
  ) {
    console.log('         ✓ TEST 2 PASS: Transfer Rp500.000 executed with 100% financial isolation.\n');
  } else {
    throw new Error('TEST 2 FAIL');
  }

  // Cleanup test user
  await db.execute({ sql: 'DELETE FROM account_transfers WHERE user_id = ?', args: [testUserId] });
  await db.execute({ sql: 'DELETE FROM expenses WHERE user_id = ?', args: [testUserId] });
  await db.execute({ sql: 'DELETE FROM accounts WHERE user_id = ?', args: [testUserId] });
  await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [testUserId] });

  console.log('=== ALL CURRENCYINPUT AUDIT & CONTRACT TESTS PASSED ✓ ===');
}

runCurrencyInputAuditTests().catch(err => {
  console.error('Audit suite error:', err);
  process.exit(1);
});
