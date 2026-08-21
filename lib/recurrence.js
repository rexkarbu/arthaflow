/**
 * ArthaFlow — STEP 10: Recurrence Engine & Pure Calendar Date Arithmetic
 * 
 * Invariants:
 * 1. Pure canonical YYYY-MM-DD date strings.
 * 2. Zero timezone conversions.
 * 3. Day 31 month-end clipping (e.g. Feb 28/29, Apr 30).
 * 4. Hard start_date lower bound (due_date >= start_date).
 * 5. Inclusive end_date upper bound (due_date <= end_date).
 * 6. Paused window skipped after resume (no backfill).
 */

export function parseDateParts(dateStr) {
  if (!dateStr) return null;
  const str = String(dateStr).slice(0, 10);
  const parts = str.split('-').map(Number);
  if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return null;
  }
  return { year: parts[0], month: parts[1], day: parts[2] };
}

export function formatDateParts(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function daysInMonth(year, month) {
  // month is 1-indexed (1 = Jan, 12 = Dec)
  return new Date(year, month, 0).getDate();
}

export function getEffectiveMonthlyDate(year, month, targetDay) {
  const maxDay = daysInMonth(year, month);
  const day = Math.min(Math.max(1, targetDay), maxDay);
  return formatDateParts(year, month, day);
}

export function addDays(dateStr, numDays) {
  const p = parseDateParts(dateStr);
  if (!p) return dateStr;
  const d = new Date(p.year, p.month - 1, p.day + numDays);
  return formatDateParts(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function getIsoDayOfWeek(dateStr) {
  // Returns 1 (Monday) .. 7 (Sunday)
  const p = parseDateParts(dateStr);
  if (!p) return 1;
  const jsDay = new Date(p.year, p.month - 1, p.day).getDay();
  return jsDay === 0 ? 7 : jsDay;
}

export function getNextWeeklyDateOnOrAfter(fromDateStr, targetDayOfWeek) {
  // targetDayOfWeek: 1=Senin, 7=Minggu
  const currentIso = getIsoDayOfWeek(fromDateStr);
  const diff = (targetDayOfWeek - currentIso + 7) % 7;
  return addDays(fromDateStr, diff);
}

export function getTodayDateStr() {
  const d = new Date();
  return formatDateParts(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/**
 * Computes all valid historical and due candidate dates for a rule up to asOfDateStr
 * @param {Object} rule 
 * @param {string} asOfDateStr 
 * @param {number} maxLimit 
 * @returns {string[]} Array of YYYY-MM-DD
 */
export function computeDueCandidateDates(rule, asOfDateStr, maxLimit = 100) {
  if (!rule || rule.status === 'ARCHIVED') return [];

  const startDateStr = String(rule.start_date || '').slice(0, 10);
  if (!startDateStr) return [];

  const startParts = parseDateParts(startDateStr);
  const asOfParts = parseDateParts(asOfDateStr);
  if (!startParts || !asOfParts) return [];

  const endDateStr = rule.end_date ? String(rule.end_date).slice(0, 10) : null;
  const pausedAtStr = rule.paused_at ? String(rule.paused_at).slice(0, 10) : null;
  const resumedDateStr = rule.resumed_date ? String(rule.resumed_date).slice(0, 10) : null;

  // If rule is currently PAUSED, effective upper boundary is the date before paused_at
  let effectiveUpper = asOfDateStr;
  if (rule.status === 'PAUSED' && pausedAtStr) {
    const prevDay = addDays(pausedAtStr, -1);
    if (prevDay < effectiveUpper) {
      effectiveUpper = prevDay;
    }
  }

  if (effectiveUpper < startDateStr) return [];

  const candidates = [];
  const freq = (rule.frequency || 'monthly').toLowerCase();

  if (freq === 'monthly') {
    const targetDay = Number(rule.day_of_month) || 1;
    let currYear = startParts.year;
    let currMonth = startParts.month;

    while (candidates.length < maxLimit) {
      const candidateDate = getEffectiveMonthlyDate(currYear, currMonth, targetDay);

      if (candidateDate > effectiveUpper) break;

      // Rule start_date hard lower bound
      if (candidateDate >= startDateStr) {
        // Rule end_date inclusive upper bound
        if (!endDateStr || candidateDate <= endDateStr) {
          // Pause window filter: if was paused between paused_at and resumed_date
          let inPauseWindow = false;
          if (pausedAtStr && resumedDateStr) {
            if (candidateDate >= pausedAtStr && candidateDate < resumedDateStr) {
              inPauseWindow = true;
            }
          }

          if (!inPauseWindow) {
            candidates.push(candidateDate);
          }
        }
      }

      // Move to next month
      currMonth++;
      if (currMonth > 12) {
        currMonth = 1;
        currYear++;
      }

      const nextMonthStart = formatDateParts(currYear, currMonth, 1);
      if (nextMonthStart > effectiveUpper) break;
    }
  } else if (freq === 'weekly') {
    const targetDay = Number(rule.day_of_week) || 1;
    let currDate = getNextWeeklyDateOnOrAfter(startDateStr, targetDay);

    while (currDate <= effectiveUpper && candidates.length < maxLimit) {
      if (currDate >= startDateStr) {
        if (!endDateStr || currDate <= endDateStr) {
          let inPauseWindow = false;
          if (pausedAtStr && resumedDateStr) {
            if (currDate >= pausedAtStr && currDate < resumedDateStr) {
              inPauseWindow = true;
            }
          }

          if (!inPauseWindow) {
            candidates.push(currDate);
          }
        }
      }

      currDate = addDays(currDate, 7);
    }
  }

  return candidates;
}

/**
 * Computes the next scheduled due date strictly after fromDateStr
 * @param {Object} rule 
 * @param {string} fromDateStr 
 * @returns {string|null}
 */
export function computeNextDueDate(rule, fromDateStr = getTodayDateStr()) {
  if (!rule || rule.status !== 'ACTIVE') return null;

  const startDateStr = String(rule.start_date || '').slice(0, 10);
  const endDateStr = rule.end_date ? String(rule.end_date).slice(0, 10) : null;
  const startParts = parseDateParts(startDateStr);
  const fromParts = parseDateParts(fromDateStr);
  if (!startParts || !fromParts) return null;

  const freq = (rule.frequency || 'monthly').toLowerCase();

  if (freq === 'monthly') {
    const targetDay = Number(rule.day_of_month) || 1;
    let currYear = fromParts.year;
    let currMonth = fromParts.month;

    // Check up to 24 months forward
    for (let i = 0; i < 24; i++) {
      const candidateDate = getEffectiveMonthlyDate(currYear, currMonth, targetDay);
      if (candidateDate > fromDateStr && candidateDate >= startDateStr) {
        if (endDateStr && candidateDate > endDateStr) return null;
        return candidateDate;
      }
      currMonth++;
      if (currMonth > 12) {
        currMonth = 1;
        currYear++;
      }
    }
  } else if (freq === 'weekly') {
    const targetDay = Number(rule.day_of_week) || 1;
    let currDate = getNextWeeklyDateOnOrAfter(fromDateStr, targetDay);
    if (currDate <= fromDateStr) {
      currDate = addDays(currDate, 7);
    }
    if (currDate < startDateStr) {
      currDate = getNextWeeklyDateOnOrAfter(startDateStr, targetDay);
    }
    if (endDateStr && currDate > endDateStr) return null;
    return currDate;
  }

  return null;
}
