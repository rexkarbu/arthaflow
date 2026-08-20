/**
 * ArthaFlow — Comprehensive Form Input Sanitization Suite
 * 
 * Menangani ragam kesalahan input pengguna:
 * 1. Spasi berlebih di awal/akhir (leading/trailing whitespace)
 * 2. Spasi ganda di tengah ("Makan    Siang" -> "Makan Siang")
 * 3. Karakter kontrol tak terlihat / unsafe XSS
 * 4. Normalisasi username (lowercase, no spaces)
 * 5. Validasi panjang batas wajar
 */

/**
 * Membersihkan input teks umum dari spasi ganda dan spasi di ujung
 * @param {string} str 
 * @param {number} maxLength 
 * @returns {string}
 */
export function sanitizeText(str, maxLength = 255) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Hapus karakter kontrol tak terlihat
    .replace(/\s+/g, ' ')                          // Satukan spasi beruntun menjadi spasi tunggal
    .trim()
    .slice(0, maxLength);
}

/**
 * Sanitasi khusus untuk keterangan transaksi (Description)
 * @param {string} desc 
 * @returns {string}
 */
export function sanitizeDescription(desc) {
  return sanitizeText(desc, 100);
}

/**
 * Sanitasi khusus untuk nama kategori
 * @param {string} category 
 * @returns {string}
 */
export function sanitizeCategoryName(category) {
  const cleaned = sanitizeText(category, 50);
  if (!cleaned) return 'Lainnya';
  // Kapitalisasi huruf pertama
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Sanitasi khusus untuk nama target tabungan (Goal Name)
 * @param {string} name 
 * @returns {string}
 */
export function sanitizeGoalName(name) {
  return sanitizeText(name, 80);
}

/**
 * Sanitasi khusus untuk username autentikasi
 * @param {string} username 
 * @returns {string}
 */
export function sanitizeUsername(username) {
  if (!username) return '';
  return String(username)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '') // Hanya huruf kecil, angka, underscore, titik, strip
    .slice(0, 30);
}

/**
 * Validasi apakah teks terisi dan bukan sekadar spasi kosong
 * @param {string} str 
 * @param {string} fieldName 
 * @returns {{ isValid: boolean, error?: string, value: string }}
 */
export function validateRequiredText(str, fieldName = 'Bidang ini') {
  const cleaned = sanitizeText(str);
  if (!cleaned) {
    return {
      isValid: false,
      error: `${fieldName} tidak boleh kosong`,
      value: ''
    };
  }
  return {
    isValid: true,
    value: cleaned
  };
}
