async function runUnitTests() {
  const {
    getEffectiveMonthlyDate,
    getNextWeeklyDateOnOrAfter,
    computeDueCandidateDates,
    computeNextDueDate,
    daysInMonth
  } = await import('../lib/recurrence.js');

  console.log('=== TESTING RECURRENCE ENGINE UNIT LOGIC ===\n');

  // Test 1: Day 31 Month End Adjustment
  console.log('[TEST 1] Day 31 Month End Sequence:');
  const dJan = getEffectiveMonthlyDate(2027, 1, 31);
  const dFeb27 = getEffectiveMonthlyDate(2027, 2, 31);
  const dFeb28 = getEffectiveMonthlyDate(2028, 2, 31);
  const dMar = getEffectiveMonthlyDate(2027, 3, 31);
  const dApr = getEffectiveMonthlyDate(2027, 4, 31);

  console.log(`Jan 2027: ${dJan} (Expected: 2027-01-31)`);
  console.log(`Feb 2027: ${dFeb27} (Expected: 2027-02-28)`);
  console.log(`Feb 2028 (Leap): ${dFeb28} (Expected: 2028-02-29)`);
  console.log(`Mar 2027: ${dMar} (Expected: 2027-03-31)`);
  console.log(`Apr 2027: ${dApr} (Expected: 2027-04-30)`);

  if (dJan === '2027-01-31' && dFeb27 === '2027-02-28' && dFeb28 === '2028-02-29' && dMar === '2027-03-31' && dApr === '2027-04-30') {
    console.log('✓ TEST 1 PASS: Month-end clipping accurate.\n');
  } else {
    throw new Error('TEST 1 FAIL');
  }

  // Test 2: Start Date Hard Lower Bound (e.g. start Aug 15, day 10)
  console.log('[TEST 2] Start Date Hard Lower Bound:');
  const ruleStart15 = {
    start_date: '2026-08-15',
    frequency: 'monthly',
    day_of_month: 10,
    status: 'ACTIVE'
  };
  const candStart15 = computeDueCandidateDates(ruleStart15, '2026-10-15');
  console.log('Candidates generated:', candStart15);
  // Must NOT include 2026-08-10. Must include 2026-09-10 and 2026-10-10.
  if (!candStart15.includes('2026-08-10') && candStart15.includes('2026-09-10') && candStart15.includes('2026-10-10')) {
    console.log('✓ TEST 2 PASS: Hard lower bound respected.\n');
  } else {
    throw new Error('TEST 2 FAIL');
  }

  // Test 3: End Date Inclusive Upper Bound (e.g. end Sep 10, day 10)
  console.log('[TEST 3] End Date Inclusive Upper Bound:');
  const ruleEnd = {
    start_date: '2026-08-01',
    end_date: '2026-09-10',
    frequency: 'monthly',
    day_of_month: 10,
    status: 'ACTIVE'
  };
  const candEnd = computeDueCandidateDates(ruleEnd, '2026-12-31');
  console.log('Candidates generated:', candEnd);
  // Must include 2026-08-10, 2026-09-10. Must NOT include 2026-10-10.
  if (candEnd.includes('2026-08-10') && candEnd.includes('2026-09-10') && !candEnd.includes('2026-10-10')) {
    console.log('✓ TEST 3 PASS: End date inclusive upper bound respected.\n');
  } else {
    throw new Error('TEST 3 FAIL');
  }

  // Test 4: Weekly Monday Generation
  console.log('[TEST 4] Weekly Monday Generation:');
  const ruleWeekly = {
    start_date: '2026-08-24', // Monday
    frequency: 'weekly',
    day_of_week: 1, // Senin
    status: 'ACTIVE'
  };
  const candWeekly = computeDueCandidateDates(ruleWeekly, '2026-09-10');
  console.log('Candidates generated:', candWeekly);
  // Expected: 2026-08-24, 2026-08-31, 2026-09-07
  if (candWeekly.length === 3 && candWeekly[0] === '2026-08-24' && candWeekly[1] === '2026-08-31' && candWeekly[2] === '2026-09-07') {
    console.log('✓ TEST 4 PASS: Weekly schedule accurate.\n');
  } else {
    throw new Error('TEST 4 FAIL');
  }

  // Test 5: Pause / Resume Window (Pause Sep 5, Resume Oct 5)
  console.log('[TEST 5] Pause / Resume Window:');
  const rulePause = {
    start_date: '2026-08-01',
    frequency: 'monthly',
    day_of_month: 10,
    status: 'ACTIVE',
    paused_at: '2026-09-05',
    resumed_date: '2026-10-05'
  };
  const candPause = computeDueCandidateDates(rulePause, '2026-10-15');
  console.log('Candidates generated:', candPause);
  // Expected: 2026-08-10, (Sep 10 is skipped), 2026-10-10
  if (candPause.includes('2026-08-10') && !candPause.includes('2026-09-10') && candPause.includes('2026-10-10')) {
    console.log('✓ TEST 5 PASS: Pause window does NOT backfill.\n');
  } else {
    throw new Error('TEST 5 FAIL');
  }

  console.log('=== ALL RECURRENCE UNIT TESTS PASSED ✓ ===');
}

runUnitTests().catch(err => {
  console.error(err);
  process.exit(1);
});
