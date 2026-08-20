/**
 * ArthaFlow — Indonesian Currency Input Sanitization & Formatting Utility
 * 
 * Standar Keuangan Indonesia:
 * - Pemisah ribuan menggunakan titik ('.')
 * - Pemisah desimal menggunakan koma (',')
 * - Bebas dari karakter non-numerik (Rp, spasi, simbol)
 * - Mencegah bug leading zero ("05" -> "5", "00050000" -> "50.000")
 */

export const MAX_FINANCIAL_AMOUNT = 999_999_999_999; // Rp 999.999.999.999 (1 Triliun - 1)

/**
 * Membersihkan input string/number menjadi float/integer murni yang aman untuk database
 * Contoh: "Rp 1.500.000" -> 1500000
 * Contoh: "1.500.000,50" -> 1500000.5
 * Contoh: "05000" -> 5000
 * @param {string|number} value 
 * @returns {number} Nilai numerik murni (0 jika tidak valid)
 */
export function parseCurrency(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') {
    return isNaN(value) ? 0 : Math.abs(value);
  }

  const str = String(value).trim();
  if (!str) return 0;

  // Hapus semua karakter non-angka dan non-pemisah
  let cleaned = str.replace(/[^\d.,]/g, '');
  if (!cleaned) return 0;

  if (cleaned.includes(',') && cleaned.includes('.')) {
    // Format IDR standar: titik adalah ribuan, koma adalah desimal
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes('.')) {
    // Cek apakah titik merupakan ribuan ("1.500.000" atau "50.000")
    const parts = cleaned.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      cleaned = cleaned.replace(/\./g, '');
    }
  } else if (cleaned.includes(',')) {
    cleaned = cleaned.replace(',', '.');
  }

  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return 0;

  return Math.abs(parsed);
}

/**
 * Memformat string atau number secara live saat pengguna mengetik di form (Ribuan dengan titik)
 * Menangani bug leading zeros:
 * - "0" -> "0"
 * - "05" -> "5"
 * - "00050000" -> "50.000"
 * - "0,5" -> "0,5"
 * - "00,75" -> "0,75"
 * @param {string|number} value 
 * @returns {string} String terformat dengan titik ribuan standar Indonesia
 */
export function formatCurrencyInput(value) {
  if (value === null || value === undefined || value === '') return '';
  
  const str = String(value);
  // Ambil hanya angka dan koma untuk desimal
  const cleaned = str.replace(/[^\d,]/g, '');
  
  if (!cleaned) return '';

  const parts = cleaned.split(',');
  const rawInt = parts[0];
  const restDecimals = parts.slice(1);

  // Normalisasi leading zero: "05" -> "5", "007" -> "7", "00" -> "0"
  let normalizedInteger = rawInt.replace(/^0+(?=\d)/, '');
  if (normalizedInteger === '' && rawInt.length > 0) {
    normalizedInteger = '0';
  }
  
  // Format bagian integer dengan titik ribuan
  const formattedInteger = normalizedInteger.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  if (restDecimals.length > 0) {
    const decimalPart = restDecimals.join('').slice(0, 2);
    return `${formattedInteger},${decimalPart}`;
  }

  return formattedInteger;
}

/**
 * Memvalidasi apakah nominal berada dalam rentang valid keuangan
 * @param {number|string} value 
 * @param {number} max 
 * @returns {{ isValid: boolean, error?: string, amount: number }}
 */
export function validateFinancialAmount(value, max = MAX_FINANCIAL_AMOUNT) {
  const amount = parseCurrency(value);
  if (amount <= 0) {
    return {
      isValid: false,
      error: 'Nominal harus lebih besar dari 0',
      amount: 0
    };
  }
  if (amount > max) {
    return {
      isValid: false,
      error: `Nominal melebihi batas maksimal (${formatRupiah(max)})`,
      amount
    };
  }
  return {
    isValid: true,
    amount
  };
}

/**
 * Format tampilan lengkap Rupiah untuk UI
 * Contoh: 1500000 -> "Rp 1.500.000"
 * @param {number} n 
 * @returns {string}
 */
export function formatRupiah(n) {
  const num = typeof n === 'number' ? n : parseCurrency(n);
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}
