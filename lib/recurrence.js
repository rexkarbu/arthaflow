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

export const FINANCIAL_TIMEZONE = 'Asia/Jakarta';

export function getTodayDateStr(timeZone = FINANCIAL_TIMEZONE) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  } catch {
    const d = new Date();
    return formatDateParts(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }
}

/**
 * Evaluates the pause history for a rule with strict fail-closed financial integrity.
 * 
 * Invariants:
 * 1. Valid JSON array of intervals returns { valid: true, intervals, isCorrupted: false }.
 * 2. An empty array [] (never paused) returns { valid: true, intervals: [], isCorrupted: false }.
 * 3. Malformed JSON that can be safely reconstructed from legacy fields returns { valid: true, intervals, isCorrupted: false }.
 * 4. Malformed JSON that CANNOT be safely reconstructed returns { valid: false, intervals: [], isCorrupted: true } (FAIL CLOSED).
 * 
 * @param {Object} rule 
 * @returns {{ valid: boolean, intervals: Array<{start: string, end: string|null}>, isCorrupted: boolean }}
 */
export function getPauseHistoryState(rule) {
  if (!rule) {
    return { valid: true, intervals: [], isCorrupted: false };
  }

  // 1. If pause_history is provided (non-empty string or array)
  if (rule.pause_history !== undefined && rule.pause_history !== null && rule.pause_history !== '') {
    let parsed;
    let parseFailed = false;

    if (typeof rule.pause_history === 'string') {
      try {
        parsed = JSON.parse(rule.pause_history);
      } catch {
        parseFailed = true;
      }
    } else if (Array.isArray(rule.pause_history)) {
      parsed = rule.pause_history;
    } else {
      parseFailed = true;
    }

    if (!parseFailed && Array.isArray(parsed)) {
      const intervals = [];
      let itemCorrupted = false;

      for (const item of parsed) {
        if (item && typeof item === 'object') {
          const start = item.start ? String(item.start).slice(0, 10) : (item.paused_at ? String(item.paused_at).slice(0, 10) : null);
          const end = item.end ? String(item.end).slice(0, 10) : (item.resumed_date ? String(item.resumed_date).slice(0, 10) : null);
          if (start && /^\d{4}-\d{2}-\d{2}$/.test(start) && (!end || /^\d{4}-\d{2}-\d{2}$/.test(end))) {
            intervals.push({ start, end });
          } else {
            itemCorrupted = true;
          }
        } else {
          itemCorrupted = true;
        }
      }

      if (!itemCorrupted) {
        // If pause_history is empty array [] but rule has legacy paused_at / resumed_date from STEP 10
        if (intervals.length === 0 && rule.paused_at && /^\d{4}-\d{2}-\d{2}$/.test(String(rule.paused_at).slice(0, 10))) {
          const start = String(rule.paused_at).slice(0, 10);
          if (rule.resumed_date && /^\d{4}-\d{2}-\d{2}$/.test(String(rule.resumed_date).slice(0, 10))) {
            const end = String(rule.resumed_date).slice(0, 10);
            if (end >= start) {
              return { valid: true, intervals: [{ start, end }], isCorrupted: false };
            }
          } else if (rule.status === 'PAUSED') {
            return { valid: true, intervals: [{ start, end: null }], isCorrupted: false };
          }
        }
        return { valid: true, intervals, isCorrupted: false };
      }
    }

    // JSON parsing failed or item structure corrupted!
    // Try safe legacy reconstruction if possible:
    if (rule.paused_at && /^\d{4}-\d{2}-\d{2}$/.test(String(rule.paused_at).slice(0, 10))) {
      const start = String(rule.paused_at).slice(0, 10);
      if (rule.resumed_date && /^\d{4}-\d{2}-\d{2}$/.test(String(rule.resumed_date).slice(0, 10))) {
        const end = String(rule.resumed_date).slice(0, 10);
        if (end >= start) {
          console.warn(`[RECURRENCE] Rule ${rule.id} has malformed pause_history, but successfully reconstructed from legacy columns [${start}, ${end}]`);
          return { valid: true, intervals: [{ start, end }], isCorrupted: false };
        }
      } else if (rule.status === 'PAUSED') {
        console.warn(`[RECURRENCE] Rule ${rule.id} has malformed pause_history, but successfully reconstructed open pause from legacy paused_at [${start}, null]`);
        return { valid: true, intervals: [{ start, end: null }], isCorrupted: false };
      }
    }

    // Fail closed! Cannot be reconstructed safely.
    console.error(`[RECURRENCE] Rule ${rule.id} has corrupted pause_history and cannot be safely reconstructed. FAILING CLOSED.`);
    return { valid: false, intervals: [], isCorrupted: true };
  }

  // 2. If pause_history is genuinely empty/uninitialized (e.g. legacy STEP 10 rule before STEP 11 migration)
  if (rule.paused_at && /^\d{4}-\d{2}-\d{2}$/.test(String(rule.paused_at).slice(0, 10))) {
    const start = String(rule.paused_at).slice(0, 10);
    if (rule.resumed_date && /^\d{4}-\d{2}-\d{2}$/.test(String(rule.resumed_date).slice(0, 10))) {
      const end = String(rule.resumed_date).slice(0, 10);
      if (end >= start) {
        return { valid: true, intervals: [{ start, end }], isCorrupted: false };
      }
    } else if (rule.status === 'PAUSED') {
      return { valid: true, intervals: [{ start, end: null }], isCorrupted: false };
    }
  }

  // Genuinely never paused
  return { valid: true, intervals: [], isCorrupted: false };
}

/**
 * Backward compatible helper returning intervals array, or empty array if corrupted/invalid.
 * @param {Object} rule 
 * @returns {Array<{start: string, end: string|null}>}
 */
export function parsePauseHistory(rule) {
  const state = getPauseHistoryState(rule);
  return state.intervals;
}

/**
 * Checks whether a candidate date falls within any paused interval [start, end)
 * If rule pause history is corrupted, fails closed and returns true.
 * @param {string} dateStr 
 * @param {Object} rule 
 * @returns {boolean}
 */
export function isDateInPauseWindows(dateStr, rule) {
  if (!rule) return false;
  const pauseState = getPauseHistoryState(rule);
  if (!pauseState.valid) return true; // Fail closed: quarantine candidate date
  
  for (const interval of pauseState.intervals) {
    if (interval.start) {
      if (interval.end) {
        // Closed interval: [start, end)
        if (dateStr >= interval.start && dateStr < interval.end) {
          return true;
        }
      } else {
        // Open interval (currently paused): [start, infinity)
        if (dateStr >= interval.start) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Computes all valid historical and due candidate dates for a rule up to asOfDateStr
 * Fails closed if rule pause history is corrupted.
 * @param {Object} rule 
 * @param {string} asOfDateStr 
 * @param {number} maxLimit 
 * @returns {string[]} Array of YYYY-MM-DD
 */
export function computeDueCandidateDates(rule, asOfDateStr, maxLimit = 100) {
  if (!rule || rule.status === 'ARCHIVED') return [];

  // Fail-closed financial integrity check
  const pauseState = getPauseHistoryState(rule);
  if (!pauseState.valid) {
    return [];
  }

  const startDateStr = String(rule.start_date || '').slice(0, 10);
  if (!startDateStr) return [];

  const startParts = parseDateParts(startDateStr);
  const asOfParts = parseDateParts(asOfDateStr);
  if (!startParts || !asOfParts) return [];

  const endDateStr = rule.end_date ? String(rule.end_date).slice(0, 10) : null;
  const pausedAtStr = rule.paused_at ? String(rule.paused_at).slice(0, 10) : null;

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
          if (!isDateInPauseWindows(candidateDate, rule)) {
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
          if (!isDateInPauseWindows(currDate, rule)) {
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
 * Computes future virtual candidate dates strictly after fromDateExclusive up to toDateInclusive
 * Fails closed if rule pause history is corrupted.
 * @param {Object} rule 
 * @param {string} fromDateExclusive 
 * @param {string} toDateInclusive 
 * @param {number} maxLimit 
 * @returns {string[]} Array of YYYY-MM-DD
 */
export function computeFutureVirtualDates(rule, fromDateExclusive, toDateInclusive, maxLimit = 60) {
  if (!rule || rule.status !== 'ACTIVE') return [];

  // Fail-closed financial integrity check
  const pauseState = getPauseHistoryState(rule);
  if (!pauseState.valid) {
    return [];
  }

  const startDateStr = String(rule.start_date || '').slice(0, 10);
  if (!startDateStr) return [];

  const fromParts = parseDateParts(fromDateExclusive);
  const toParts = parseDateParts(toDateInclusive);
  if (!fromParts || !toParts) return [];

  if (toDateInclusive <= fromDateExclusive) return [];

  const endDateStr = rule.end_date ? String(rule.end_date).slice(0, 10) : null;
  const effectiveUpper = endDateStr && endDateStr < toDateInclusive ? endDateStr : toDateInclusive;
  if (effectiveUpper <= fromDateExclusive) return [];

  const candidates = [];
  const freq = (rule.frequency || 'monthly').toLowerCase();

  if (freq === 'monthly') {
    const targetDay = Number(rule.day_of_month) || 1;
    let currYear = fromParts.year;
    let currMonth = fromParts.month;

    while (candidates.length < maxLimit) {
      const candidateDate = getEffectiveMonthlyDate(currYear, currMonth, targetDay);

      if (candidateDate > effectiveUpper) break;

      if (candidateDate > fromDateExclusive && candidateDate >= startDateStr) {
        if (!endDateStr || candidateDate <= endDateStr) {
          if (!isDateInPauseWindows(candidateDate, rule)) {
            candidates.push(candidateDate);
          }
        }
      }

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
    let currDate = getNextWeeklyDateOnOrAfter(fromDateExclusive, targetDay);

    while (currDate <= effectiveUpper && candidates.length < maxLimit) {
      if (currDate > fromDateExclusive && currDate >= startDateStr) {
        if (!endDateStr || currDate <= endDateStr) {
          if (!isDateInPauseWindows(currDate, rule)) {
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
