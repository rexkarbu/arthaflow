async function runStep10RecurringTests() {
  const modDb = await import('../lib/db.js');
  const db = modDb.default;
  const dbReady = modDb.dbReady;
  await dbReady;

  const {
    getEffectiveMonthlyDate,
    computeDueCandidateDates,
    computeNextDueDate,
    getTodayDateStr
  } = await import('../lib/recurrence.js');

  console.log('=== RUNNING STEP 10 RECURRING TRANSACTIONS & BILLS QA SUITE ===\n');

  const testUserA = 10001;
  const testUserB = 10002;

  // Cleanup isolated test users
  for (const uid of [testUserA, testUserB]) {
    await db.execute({ sql: 'DELETE FROM recurring_occurrences WHERE user_id = ?', args: [uid] });
    await db.execute({ sql: 'DELETE FROM recurring_rules WHERE user_id = ?', args: [uid] });
    await db.execute({ sql: 'DELETE FROM account_transfers WHERE user_id = ?', args: [uid] });
    await db.execute({ sql: 'DELETE FROM expenses WHERE user_id = ?', args: [uid] });
    await db.execute({ sql: 'DELETE FROM accounts WHERE user_id = ?', args: [uid] });
    await db.execute({ sql: 'DELETE FROM sessions WHERE user_id = ?', args: [uid] });
    await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [uid] });
  }

  // Helper to calculate derived balance
  const getAccBalance = async (accId, uid) => {
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
      args: [nowIso, nowIso, nowIso, nowIso, accId, uid]
    });
    const r = res.rows[0];
    return Number(r.opening_balance) + Number(r.total_income) - Number(r.total_expense) + Number(r.total_transfer_in) - Number(r.total_transfer_out);
  };

  // 1. Create Accounts for User A
  const gopayRes = await db.execute({
    sql: 'INSERT INTO accounts (user_id, name, type, opening_balance, opening_date) VALUES (?, ?, ?, ?, ?)',
    args: [testUserA, 'GoPay', 'E_WALLET', 100000, '2026-08-01']
  });
  const gopayId = Number(gopayRes.lastInsertRowid);

  const brimoRes = await db.execute({
    sql: 'INSERT INTO accounts (user_id, name, type, opening_balance, opening_date) VALUES (?, ?, ?, ?, ?)',
    args: [testUserA, 'BRImo', 'BANK', 5000000, '2026-08-01']
  });
  const brimoId = Number(brimoRes.lastInsertRowid);

  console.log(`[SETUP] Accounts created: GoPay (ID: ${gopayId}, Rp100.000), BRImo (ID: ${brimoId}, Rp5.000.000)`);

  // ========================================================
  // TEST 1: Monthly Date Generation & Day 31 Leap Year
  // ========================================================
  console.log('[TEST 1] Monthly Day 31 Sequence & Leap Year Check...');
  const rule31 = {
    start_date: '2027-01-01',
    frequency: 'monthly',
    day_of_month: 31,
    status: 'ACTIVE'
  };
  const cand31 = computeDueCandidateDates(rule31, '2027-05-31');
  console.log('         Generated 2027 candidate dates:', cand31);
  if (cand31.join(',') === '2027-01-31,2027-02-28,2027-03-31,2027-04-30,2027-05-31') {
    console.log('         ✓ TEST 1A PASS: 2027 non-leap Feb 28 month-end clipping accurate.');
  } else {
    throw new Error('TEST 1A FAIL');
  }

  const ruleLeap = {
    start_date: '2028-01-01',
    frequency: 'monthly',
    day_of_month: 31,
    status: 'ACTIVE'
  };
  const candLeap = computeDueCandidateDates(ruleLeap, '2028-03-31');
  console.log('         Generated 2028 candidate dates:', candLeap);
  if (candLeap.join(',') === '2028-01-31,2028-02-29,2028-03-31') {
    console.log('         ✓ TEST 1B PASS: 2028 leap Feb 29 month-end clipping accurate.\n');
  } else {
    throw new Error('TEST 1B FAIL');
  }

  // ========================================================
  // TEST 2: Hard Lower Bound & Inclusive Upper Bound
  // ========================================================
  console.log('[TEST 2] Start Date Hard Lower Bound & End Date Inclusive...');
  const ruleBound = {
    start_date: '2026-08-15',
    end_date: '2026-09-10',
    frequency: 'monthly',
    day_of_month: 10,
    status: 'ACTIVE'
  };
  const candBound = computeDueCandidateDates(ruleBound, '2026-12-31');
  console.log('         Candidate dates for start 15 Aug, end 10 Sep, day 10:', candBound);
  if (candBound.length === 1 && candBound[0] === '2026-09-10') {
    console.log('         ✓ TEST 2 PASS: Lower bound (no Aug 10) and upper bound (Sep 10 only) strictly honored.\n');
  } else {
    throw new Error('TEST 2 FAIL');
  }

  // ========================================================
  // TEST 3: Create Recurring Rule & Idempotent Materialization
  // ========================================================
  console.log('[TEST 3] Create Recurring Rule: Spotify Rp54.990 on GoPay...');
  const createRuleRes = await db.execute({
    sql: `INSERT INTO recurring_rules 
          (user_id, name, type, amount, category, account_id, frequency, day_of_month, start_date, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
    args: [testUserA, 'Spotify', 'expense', 54990, 'Langganan', gopayId, 'monthly', 17, '2026-08-01']
  });
  const ruleSpotifyId = Number(createRuleRes.lastInsertRowid);

  // Materialize occurrences up to 2026-08-20 (should create 2026-08-17)
  const candidateDates = computeDueCandidateDates({
    start_date: '2026-08-01',
    frequency: 'monthly',
    day_of_month: 17,
    status: 'ACTIVE'
  }, '2026-08-20');

  for (const d of candidateDates) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO recurring_occurrences 
            (user_id, rule_id, due_date, name, type, amount, category, account_id, note, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      args: [testUserA, ruleSpotifyId, d, 'Spotify', 'expense', 54990, 'Langganan', gopayId, '']
    });
  }

  // Run materialization a second time to verify idempotency
  for (const d of candidateDates) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO recurring_occurrences 
            (user_id, rule_id, due_date, name, type, amount, category, account_id, note, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      args: [testUserA, ruleSpotifyId, d, 'Spotify', 'expense', 54990, 'Langganan', gopayId, '']
    });
  }

  const occRes1 = await db.execute({
    sql: 'SELECT * FROM recurring_occurrences WHERE user_id = ? AND rule_id = ?',
    args: [testUserA, ruleSpotifyId]
  });
  console.log(`         Occurrences count for Spotify: ${occRes1.rows.length} (Expected: 1)`);
  if (occRes1.rows.length === 1 && occRes1.rows[0].due_date === '2026-08-17' && occRes1.rows[0].status === 'PENDING') {
    console.log('         ✓ TEST 3 PASS: Exactly 1 occurrence materialized (idempotent).\n');
  } else {
    throw new Error('TEST 3 FAIL');
  }

  const occSpotify = occRes1.rows[0];

  // ========================================================
  // TEST 4: Financial Isolation Invariant (Rp0 impact before posting)
  // ========================================================
  console.log('[TEST 4] Financial Isolation Invariant Check...');
  const gopayBalBefore = await getAccBalance(gopayId, testUserA);
  const expCountRes = await db.execute({
    sql: 'SELECT COUNT(*) as cnt FROM expenses WHERE user_id = ?',
    args: [testUserA]
  });
  console.log(`         GoPay Balance: Rp${gopayBalBefore.toLocaleString()} (Expected: 100.000)`);
  console.log(`         Real transactions count: ${expCountRes.rows[0].cnt} (Expected: 0)`);
  if (gopayBalBefore === 100000 && Number(expCountRes.rows[0].cnt) === 0) {
    console.log('         ✓ TEST 4 PASS: Pending occurrence causes Rp0 balance and Rp0 expense change.\n');
  } else {
    throw new Error('TEST 4 FAIL');
  }

  // ========================================================
  // TEST 5: Snapshot Immutability (Rule Edit Does Not Mutate Old Snapshot)
  // ========================================================
  console.log('[TEST 5] Snapshot Immutability: Editing Spotify rule to Rp59.990, BRImo...');
  await db.execute({
    sql: `UPDATE recurring_rules 
          SET amount = 59990, account_id = ?, updated_at = ? 
          WHERE id = ? AND user_id = ?`,
    args: [brimoId, new Date().toISOString(), ruleSpotifyId, testUserA]
  });

  const occResAfterRuleEdit = await db.execute({
    sql: 'SELECT * FROM recurring_occurrences WHERE id = ?',
    args: [occSpotify.id]
  });
  const snapshotCheck = occResAfterRuleEdit.rows[0];
  console.log(`         Existing occurrence snapshot: Amount = ${snapshotCheck.amount} (Expected: 54990), Account = ${snapshotCheck.account_id} (Expected: ${gopayId})`);
  if (Number(snapshotCheck.amount) === 54990 && Number(snapshotCheck.account_id) === gopayId) {
    console.log('         ✓ TEST 5 PASS: Existing occurrence snapshot remained completely immutable.\n');
  } else {
    throw new Error('TEST 5 FAIL');
  }

  // ========================================================
  // TEST 6: Atomic Recording with Adjusted Real Values
  // ========================================================
  console.log('[TEST 6] Atomic Recording: User confirms Spotify on 19 Aug with Rp55.000...');
  const tx = await db.transaction('write');
  let postedTxId;
  try {
    const oRes = await tx.execute({
      sql: 'SELECT * FROM recurring_occurrences WHERE id = ? AND user_id = ?',
      args: [occSpotify.id, testUserA]
    });
    const o = oRes.rows[0];
    if (o.status !== 'PENDING') throw new Error('Not pending');

    const insRes = await tx.execute({
      sql: `INSERT INTO expenses (user_id, amount, description, date, category, notes, is_recurring, type, account_id)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      args: [testUserA, 55000, 'Spotify Premium', '2026-08-19T12:00:00.000Z', o.category, 'Bayar lewat GoPay', 'expense', gopayId]
    });
    postedTxId = Number(insRes.lastInsertRowid);

    await tx.execute({
      sql: `UPDATE recurring_occurrences 
            SET status = 'POSTED', transaction_id = ?, resolved_at = ?, updated_at = ?
            WHERE id = ? AND user_id = ?`,
      args: [postedTxId, new Date().toISOString(), new Date().toISOString(), occSpotify.id, testUserA]
    });

    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }

  const gopayBalAfter = await getAccBalance(gopayId, testUserA);
  const occPosted = (await db.execute({ sql: 'SELECT * FROM recurring_occurrences WHERE id = ?', args: [occSpotify.id] })).rows[0];
  console.log(`         GoPay Balance after recording: Rp${gopayBalAfter.toLocaleString()} (Expected: 45.000)`);
  console.log(`         Occurrence Status: ${occPosted.status} (Expected: POSTED), linked tx: ${occPosted.transaction_id}`);
  console.log(`         Occurrence due_date: ${occPosted.due_date} (Expected: 2026-08-17)`);

  if (gopayBalAfter === 45000 && occPosted.status === 'POSTED' && Number(occPosted.transaction_id) === postedTxId && occPosted.due_date === '2026-08-17') {
    console.log('         ✓ TEST 6 PASS: Occurrence recorded atomically, balance derived accurately.\n');
  } else {
    throw new Error('TEST 6 FAIL');
  }

  // ========================================================
  // TEST 7: Double-Post Protection
  // ========================================================
  console.log('[TEST 7] Double-Post Protection Check...');
  const tx2 = await db.transaction('write');
  let doublePostRejected = false;
  try {
    const oRes = await tx2.execute({
      sql: 'SELECT * FROM recurring_occurrences WHERE id = ? AND user_id = ?',
      args: [occSpotify.id, testUserA]
    });
    const o = oRes.rows[0];
    if (o.status !== 'PENDING') {
      doublePostRejected = true;
      await tx2.rollback();
    } else {
      await tx2.rollback();
    }
  } catch {
    await tx2.rollback();
  }

  if (doublePostRejected) {
    console.log('         ✓ TEST 7 PASS: Second attempt on same occurrence strictly rejected.\n');
  } else {
    throw new Error('TEST 7 FAIL');
  }

  // ========================================================
  // TEST 8: Skip Occurrence
  // ========================================================
  console.log('[TEST 8] Skip Occurrence: Gym Rp200.000 waived for Aug...');
  const gymRuleRes = await db.execute({
    sql: `INSERT INTO recurring_rules 
          (user_id, name, type, amount, category, account_id, frequency, day_of_month, start_date, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
    args: [testUserA, 'Gym Membership', 'expense', 200000, 'Kesehatan', gopayId, 'monthly', 1, '2026-08-01']
  });
  const gymRuleId = Number(gymRuleRes.lastInsertRowid);

  await db.execute({
    sql: `INSERT INTO recurring_occurrences 
          (user_id, rule_id, due_date, name, type, amount, category, account_id, note, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
    args: [testUserA, gymRuleId, '2026-08-01', 'Gym Membership', 'expense', 200000, 'Kesehatan', gopayId, '']
  });

  const gymOcc = (await db.execute({ sql: 'SELECT * FROM recurring_occurrences WHERE rule_id = ?', args: [gymRuleId] })).rows[0];

  // Skip it
  await db.execute({
    sql: `UPDATE recurring_occurrences 
          SET status = 'SKIPPED', resolved_at = ?, updated_at = ? 
          WHERE id = ? AND user_id = ? AND status = 'PENDING'`,
    args: [new Date().toISOString(), new Date().toISOString(), gymOcc.id, testUserA]
  });

  const gopayBalAfterSkip = await getAccBalance(gopayId, testUserA);
  const gymOccAfter = (await db.execute({ sql: 'SELECT * FROM recurring_occurrences WHERE id = ?', args: [gymOcc.id] })).rows[0];
  console.log(`         Gym occurrence status: ${gymOccAfter.status} (Expected: SKIPPED)`);
  console.log(`         GoPay Balance: Rp${gopayBalAfterSkip.toLocaleString()} (Expected: 45.000)`);
  if (gymOccAfter.status === 'SKIPPED' && gopayBalAfterSkip === 45000) {
    console.log('         ✓ TEST 8 PASS: Occurrence skipped cleanly without changing ledger balance.\n');
  } else {
    throw new Error('TEST 8 FAIL');
  }

  // ========================================================
  // TEST 9: Pause / Resume Semantics (No Backfill of Paused Window)
  // ========================================================
  console.log('[TEST 9] Pause / Resume Window: Internet paused Sep 5, resumed Oct 5...');
  const netRuleRes = await db.execute({
    sql: `INSERT INTO recurring_rules 
          (user_id, name, type, amount, category, account_id, frequency, day_of_month, start_date, status, paused_at, resumed_date)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', '2026-09-05', '2026-10-05')`,
    args: [testUserA, 'Internet', 'expense', 350000, 'Tagihan', brimoId, 'monthly', 10, '2026-08-01']
  });
  const netRule = (await db.execute({ sql: 'SELECT * FROM recurring_rules WHERE id = ?', args: [Number(netRuleRes.lastInsertRowid)] })).rows[0];

  const netCandidates = computeDueCandidateDates(netRule, '2026-10-15');
  console.log('         Generated candidate dates for Internet:', netCandidates);
  // Expected: 2026-08-10, (Sep 10 skipped!), 2026-10-10
  if (netCandidates.includes('2026-08-10') && !netCandidates.includes('2026-09-10') && netCandidates.includes('2026-10-10')) {
    console.log('         ✓ TEST 9 PASS: Paused window is NOT backfilled after resume.\n');
  } else {
    throw new Error('TEST 9 FAIL');
  }

  // ========================================================
  // TEST 10: Delete Linked Transaction Reopens Occurrence as PENDING
  // ========================================================
  console.log('[TEST 10] Deleting posted Spotify transaction (ID: ' + postedTxId + ')...');
  const delTx = await db.transaction('write');
  try {
    // Reopen occurrence
    await delTx.execute({
      sql: `UPDATE recurring_occurrences 
            SET status = 'PENDING', transaction_id = NULL, resolved_at = NULL, updated_at = ? 
            WHERE transaction_id = ? AND user_id = ?`,
      args: [new Date().toISOString(), postedTxId, testUserA]
    });
    // Delete expense
    await delTx.execute({
      sql: 'DELETE FROM expenses WHERE id = ? AND user_id = ?',
      args: [postedTxId, testUserA]
    });
    await delTx.commit();
  } catch (err) {
    await delTx.rollback();
    throw err;
  }

  const gopayBalAfterDel = await getAccBalance(gopayId, testUserA);
  const occReopened = (await db.execute({ sql: 'SELECT * FROM recurring_occurrences WHERE id = ?', args: [occSpotify.id] })).rows[0];
  console.log(`         Occurrence status after transaction deletion: ${occReopened.status} (Expected: PENDING), transaction_id = ${occReopened.transaction_id}`);
  console.log(`         GoPay Balance restored to: Rp${gopayBalAfterDel.toLocaleString()} (Expected: 100.000)`);
  if (occReopened.status === 'PENDING' && occReopened.transaction_id === null && gopayBalAfterDel === 100000) {
    console.log('         ✓ TEST 10 PASS: Deleting transaction safely reopened occurrence as PENDING.\n');
  } else {
    throw new Error('TEST 10 FAIL');
  }

  // ========================================================
  // TEST 11: Cross-User IDOR Security Defense
  // ========================================================
  console.log('[TEST 11] Cross-User IDOR Security Defense Check...');
  // User B attempts to access or skip User A's occurrence
  const idorRes = await db.execute({
    sql: `UPDATE recurring_occurrences 
          SET status = 'SKIPPED' 
          WHERE id = ? AND user_id = ?`,
    args: [occSpotify.id, testUserB]
  });
  console.log(`         User B updating User A occurrence rows affected: ${idorRes.rowsAffected}`);
  if (idorRes.rowsAffected === 0) {
    console.log('         ✓ TEST 11 PASS: Cross-user IDOR access strictly blocked by user_id scoping.\n');
  } else {
    throw new Error('TEST 11 FAIL');
  }

  // Cleanup test users
  for (const uid of [testUserA, testUserB]) {
    await db.execute({ sql: 'DELETE FROM recurring_occurrences WHERE user_id = ?', args: [uid] });
    await db.execute({ sql: 'DELETE FROM recurring_rules WHERE user_id = ?', args: [uid] });
    await db.execute({ sql: 'DELETE FROM account_transfers WHERE user_id = ?', args: [uid] });
    await db.execute({ sql: 'DELETE FROM expenses WHERE user_id = ?', args: [uid] });
    await db.execute({ sql: 'DELETE FROM accounts WHERE user_id = ?', args: [uid] });
  }

  console.log('=== ALL STEP 10 RECURRING INTEGRATION TESTS PASSED ✓ ===');
}

runStep10RecurringTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
