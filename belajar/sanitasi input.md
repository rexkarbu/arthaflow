Viewed currency.js:1-93
Ran command: `node -e "
function formatCurrencyInput(value) {
if (value === null || value === undefined || value === '') return '';
const str = String(value);
const cleaned = str.replace(/[^\d,]/g, '');
if (!cleaned) return '';

const [rawInt, ...restDecimals] = cleaned.split(',');
let normalizedInteger = rawInt.replace(/^0+(?=\d)/, '');
if (normalizedInteger === '' && rawInt.length > 0) {
normalizedInteger = '0';
}

const formattedInteger = normalizedInteger.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

if (restDecimals.length > 0) {
const decimalPart = restDecimals.join('').slice(0, 2);
return \`\${formattedInteger},\${decimalPart}\`;
}

return formattedInteger;
}

const tests = ['0', '05', '00050000', '0,5', '00,75', '1.000.000', 'Rp 2.500.000', '1,2,3', '1000', ''];
tests.forEach(t => console.log(JSON.stringify(t), '->', JSON.stringify(formatCurrencyInput(t))));
"`Ran command:`node -e "
function formatCurrencyInput(value) {
if (value === null || value === undefined || value === '') return '';
const str = String(value);
const cleaned = str.replace(/[^\d,]/g, '');
if (!cleaned) return '';

const parts = cleaned.split(',');
const rawInt = parts[0];
const restDecimals = parts.slice(1);
let normalizedInteger = rawInt.replace(/^0+(?=\d)/, '');
if (normalizedInteger === '' && rawInt.length > 0) {
normalizedInteger = '0';
}

const formattedInteger = normalizedInteger.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

if (restDecimals.length > 0) {
const decimalPart = restDecimals.join('').slice(0, 2);
return formattedInteger + ',' + decimalPart;
}

return formattedInteger;
}

const tests = ['0', '05', '00050000', '0,5', '00,75', '1.000.000', 'Rp 2.500.000', '1,2,3', '1000', ''];
tests.forEach(t => console.log(JSON.stringify(t), '->', JSON.stringify(formatCurrencyInput(t))));
"`Ran command:`node -e "
function parseCurrency(value) {
if (value === null || value === undefined || value === '') return 0;
if (typeof value === 'number') {
return isNaN(value) ? 0 : value;
}

const str = String(value).trim();
if (!str) return 0;

let cleaned = str.replace(/[^\d.,-]/g, '');

if (cleaned.includes(',') && cleaned.includes('.')) {
cleaned = cleaned.replace(/\./g, '').replace(',', '.');
} else if (cleaned.includes('.')) {
const parts = cleaned.split('.');
if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
cleaned = cleaned.replace(/\./g, '');
}
} else if (cleaned.includes(',')) {
cleaned = cleaned.replace(',', '.');
}

const parsed = parseFloat(cleaned);
return isNaN(parsed) ? 0 : parsed;
}

const parseTests = ['0', '05', '00050000', '0,5', '00,75', '1.000.000', 'Rp 2.500.000', '1.500.000,50', '50.000,', ' -50000 ', ''];
parseTests.forEach(t => console.log(JSON.stringify(t), '->', parseCurrency(t)));
"`Created currency.js
Created formSanitizer.js
Viewed CurrencyInput.js:1-70
Viewed LoginForm.js:1-100
Viewed actions.js:40-110
Viewed actions.js:320-380
Viewed actions.js:380-423
Edited actions.js
Viewed actions.js:160-220
Viewed actions.js:320-420
Edited actions.js
Edited actions.js
Viewed ExpenseForm.js:1-60
Edited ExpenseForm.js
Viewed FinancialGoals.js:20-50
Edited FinancialGoals.js
Viewed FinancialGoals.js:20-35
Edited FinancialGoals.js
Ran command:`cmd.exe /c npm run lint`Used tool: manage_task
Ran command:`cmd.exe /c npm run build`
Used tool: manage_task
Created walkthrough.md

# Analisis Komprehensif Kesalahan Input Pengguna & Solusi Sanitasi

Temuan Anda mengenai **angka `0` di awal yang tidak hilang saat mengetik angka berikutnya (_leading zeros_)** merupakan temuan krusial dalam rekayasa _fintech_. Jika dibiarkan, input seperti `050000` akan memunculkan format aneh seperti `050.000` atau bahkan `00.050.000`.

Telah dilakukan analisa menyeluruh terhadap **semua potensi kesalahan input pengguna (_human errors & edge cases_)** dan dibuatkan modul fungsi _shareable_ untuk mengamankan seluruh form di ArthaFlow:

---

## I. Matriks Analisis Kesalahan Input Pengguna (User Error Edge Cases)

| Tipe Input            | Kesalahan Input Pengguna                                      | Dampak Masalah                                                     | Solusi & Sanitasi ArthaFlow                                                                           |
| :-------------------- | :------------------------------------------------------------ | :----------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------- |
| **Nominal Keuangan**  | **Leading Zeros** (`05`, `00050000`)                          | Menghasilkan angka janggal `05.000` atau `00.050.000`.             | Normalisasi otomatis regex `^0+(?=\d)`. `05` $\rightarrow$ `5`, `00050000` $\rightarrow$ `50.000`.    |
| **Nominal Keuangan**  | **Desimal Murni Nol** (`0,5`, `00,75`)                        | Nilai desimal berisiko rusak jika nol di awal dihapus sembarangan. | Tetap menjaga desimal yang sah (`0,5` tetap `0,5`, `00,75` dinormalisasi ke `0,75`).                  |
| **Nominal Keuangan**  | **Pemisah Koma Ganda** (`1,5,2`, `1,,5`)                      | Error `NaN` atau data korup saat diproses database.                | Hanya koma pertama yang diakui sebagai desimal; koma kedua dan seterusnya diabaikan.                  |
| **Nominal Keuangan**  | **Karakter Simbol / Copy-Paste** (`Rp 1.500.000,-`, `~50000`) | Input ditolak mentah-mentah atau merusak parser.                   | Regex pembersih instan mengekstrak hanya angka dan tanda desimal yang valid.                          |
| **Nominal Keuangan**  | **Tanda Minus Tak Disengaja** (`-50000`)                      | Nilai minus merusak formula budget & sisa saldo.                   | Disanitasi dengan `Math.abs()`; jenis transaksi dikendalikan oleh _type tab_ (Pemasukan/Pengeluaran). |
| **Nominal Keuangan**  | **Nominal Melebihi Batas** ($> \text{Rp } 999.999.999.999$)   | Potensi integer overflow pada sistem.                              | Validasi batas aman `MAX_FINANCIAL_AMOUNT` (Rp 999 Miliar) dengan pesan ramah.                        |
| **Teks & Keterangan** | **Hanya Berisi Spasi** (`"   "`)                              | Terbuat transaksi / target kosong tanpa judul.                     | Validasi string non-kosong setelah dipangkas (`.trim()`).                                             |
| **Teks & Keterangan** | **Spasi Beruntun / Ganda** (`"Makan    Siang"`)               | Database kotor dan tampilan UI berantakan.                         | Regex `.replace(/\s+/g, ' ')` memadatkan spasi ganda menjadi spasi tunggal.                           |
| **Kategori & Tujuan** | **Karakter Kontrol Tak Terlihat**                             | Kerusakan rendering browser / encoding.                            | Pembersihan karakter ASCII kontrol `[\u0000-\u001F\u007F-\u009F]`.                                    |
| **Autentikasi**       | **Spasi & Huruf Besar Username** (`"  User Name  "`)          | Gagal login atau duplikasi akun.                                   | Normalisasi otomatis huruf kecil (`.toLowerCase()`) dan pembuangan spasi (`sanitizeUsername`).        |

---

## II. Modul Shareable yang Diterapkan

### 1. [lib/currency.js](file:///d:/learn%20coding/itulah/lib/currency.js)

```javascript
// Menghilangkan leading zeros secara real-time saat mengetik
export function formatCurrencyInput(value) { ... }

// Parsing aman standar Indonesia (titik ribuan -> float/int murni)
export function parseCurrency(value) { ... }

// Validasi nominal dalam batas wajar
export function validateFinancialAmount(value, max) { ... }
```

### 2. [lib/formSanitizer.js](file:///d:/learn%20coding/itulah/lib/formSanitizer.js)

```javascript
// Sanitasi teks umum (trim + satukan spasi ganda + hapus karakter kontrol)
export function sanitizeText(str, maxLength) { ... }

// Sanitasi spesifik
export function sanitizeDescription(desc) { ... }
export function sanitizeCategoryName(category) { ... }
export function sanitizeGoalName(name) { ... }
export function sanitizeUsername(username) { ... }
```

### 3. [components/CurrencyInput.js](file:///d:/learn%20coding/itulah/components/CurrencyInput.js)

Komponen input reaktif yang langsung mengganti karakter `0` menjadi angka berikutnya saat diketik oleh pengguna, siap dipakai di form mana pun.

---

## III. Form yang Sudah Dilindungi

1. **Form Transaksi & Modal Tambah Transaksi** ([components/ExpenseForm.js](file:///d:/learn%20coding/itulah/components/ExpenseForm.js))
2. **Form Ubah / Set Budget Bulanan** ([components/BudgetBar.js](file:///d:/learn%20coding/itulah/components/BudgetBar.js))
3. **Form Target Tabungan Finansial** ([components/FinancialGoals.js](file:///d:/learn%20coding/itulah/components/FinancialGoals.js))
4. **Form Inline Edit Transaksi pada Tabel** ([components/ExpenseList.js](file:///d:/learn%20coding/itulah/components/ExpenseList.js))
5. **Form Autentikasi Login & Register** ([components/LoginForm.js](file:///d:/learn%20coding/itulah/components/LoginForm.js))
6. **Server Actions Backend** ([app/actions.js](file:///d:/learn%20coding/itulah/app/actions.js))

---

### Hasil Uji & Kompilasi

- **`npm run lint`**: Lolos dengan **0 error / 0 warning**.
- **`npm run build`**: Berhasil mengompilasi seluruh 7 rute produksi dalam 2.3 detik.
