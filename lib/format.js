// lib/format.js - Centralized Indonesian Date & Calendar Formatting

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const LONG_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

/**
 * Safely parse a date-only string (YYYY-MM-DD) or ISO datetime string without timezone day-shifting.
 */
function parseDateParts(dateInput) {
  if (!dateInput) return null;

  if (typeof dateInput === 'string') {
    // If it's a date-only YYYY-MM-DD string
    const match = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = parseInt(match[1], 10);
      const monthIndex = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);

      // Check if it also has time part (e.g. YYYY-MM-DDTHH:mm:ss)
      if (dateInput.includes('T') || dateInput.includes(' ')) {
        const d = new Date(dateInput);
        if (!isNaN(d.getTime())) {
          return {
            year: d.getFullYear(),
            monthIndex: d.getMonth(),
            day: d.getDate(),
            hours: String(d.getHours()).padStart(2, '0'),
            minutes: String(d.getMinutes()).padStart(2, '0')
          };
        }
      }

      return {
        year,
        monthIndex,
        day,
        hours: '00',
        minutes: '00'
      };
    }
  }

  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return null;

  return {
    year: d.getFullYear(),
    monthIndex: d.getMonth(),
    day: d.getDate(),
    hours: String(d.getHours()).padStart(2, '0'),
    minutes: String(d.getMinutes()).padStart(2, '0')
  };
}

/**
 * Compact date format: "20 Agu"
 */
export function formatCompactDate(dateInput) {
  const parts = parseDateParts(dateInput);
  if (!parts) return '';
  return `${parts.day} ${SHORT_MONTHS[parts.monthIndex]}`;
}

/**
 * Full date format: "20 Agu 2026"
 */
export function formatFullDate(dateInput) {
  const parts = parseDateParts(dateInput);
  if (!parts) return '';
  return `${parts.day} ${SHORT_MONTHS[parts.monthIndex]} ${parts.year}`;
}

/**
 * Detailed date + time format: "20 Agu 2026, 21:51"
 */
export function formatDateTime(dateInput) {
  const parts = parseDateParts(dateInput);
  if (!parts) return '';
  return `${parts.day} ${SHORT_MONTHS[parts.monthIndex]} ${parts.year}, ${parts.hours}:${parts.minutes}`;
}

/**
 * Month label format: "Agustus 2026"
 * Accepts "YYYY-MM", Date object, or date string.
 */
export function formatMonthLabel(input) {
  if (!input) return '';
  if (typeof input === 'string' && /^\d{4}-\d{2}$/.test(input)) {
    const [y, m] = input.split('-');
    const monthIndex = parseInt(m, 10) - 1;
    return `${LONG_MONTHS[monthIndex]} ${y}`;
  }
  const parts = parseDateParts(input);
  if (!parts) return '';
  return `${LONG_MONTHS[parts.monthIndex]} ${parts.year}`;
}

/**
 * Format account type to Indonesian human label
 */
export function formatAccountType(type) {
  switch (type) {
    case 'BANK': return 'Bank';
    case 'E_WALLET': return 'E-wallet';
    case 'CASH': return 'Tunai';
    case 'OTHER': default: return 'Lainnya';
  }
}
