# ArthaFlow Trust Layer

The internal specification for user trust, session security, data portability, and destructive confirmations in **ArthaFlow**.

---

## 1. Trust Principles

1. **Trust Through Behavior, Not Badges**: ArthaFlow never employs marketing shields, fake "bank-grade security" badges, or unverified encryption claims. Software earns trust by behaving predictably, honoring data boundaries, and explaining consequences factually.
2. **Explicit Consequences**: Destructive actions (deleting a transaction, goal, or budget) must clearly explain what is removed, what is recalculated, and what remains intact before execution.
3. **Transparent Data Portability**: Users have full sovereignty over their financial records. Complete datasets can be exported at any time in structured, versioned JSON (`format: 'arthaflow-backup'`, `version: 1`) or CSV for spreadsheets.
4. **Calm, Factual Microcopy**: System messages, notifications, and dialogs are non-judgmental and concise, avoiding emotional theatricality ("Oops!", "Amazing!").

---

## 2. Session & Cookie Security

### Cookie Configuration
- **Name**: `auth_token`
- **`httpOnly`**: `true` (Inaccessible to client-side scripts)
- **`sameSite`**: `'lax'` (Protects against CSRF attacks)
- **`path`**: `'/'` (Valid throughout the application)
- **`secure`**: `process.env.NODE_ENV === 'production'` (Enforced over HTTPS in production)
- **`maxAge`**: 30 days (`2,592,000` seconds)

### Secrets Exclusion Invariant
The session cookie contains **only** an opaque random token. It **never** contains:
- Passwords or password hashes
- User IDs or profile objects
- Transaction history, budget numbers, or financial metrics

### Logout Flow
1. Server deletes the corresponding session row from the `sessions` table in the database.
2. Server overwrites and expires the `auth_token` cookie (`maxAge: 0`, `path: '/'`).
3. Revalidates root path (`/`) and immediately redirects to unauthenticated state (`<LoginForm />`).

---

## 3. Data Backup Specification (Version 1)

Accessible via authenticated endpoint **`/api/backup`** from `/pengaturan`.

### Response Headers
- `Content-Type: application/json; charset=utf-8`
- `Content-Disposition: attachment; filename="arthaflow-backup-YYYY-MM-DD.json"`
- `Cache-Control: no-store, private`

### JSON Schema (Version 1)
```json
{
  "format": "arthaflow-backup",
  "version": 1,
  "exported_at": "2026-08-21T00:00:00.000Z",
  "data": {
    "categories": [
      { "id": 1, "name": "Makanan", "type": "expense" }
    ],
    "transactions": [
      {
        "id": 101,
        "amount": 25000,
        "description": "Makan Siang",
        "date": "2026-08-20T12:30:00.000Z",
        "category": "Makanan",
        "notes": "Warung Padang",
        "is_recurring": 0,
        "type": "expense"
      }
    ],
    "budgets": [
      { "id": 1, "month": "2026-08", "amount": 5000000 }
    ],
    "category_budgets": [
      { "id": 1, "month": "2026-08", "category": "Makanan", "amount": 1500000 }
    ],
    "goals": [
      { "id": 3, "name": "Dana Darurat", "target_amount": 10000000, "created_at": "2026-08-01 00:00:00" }
    ],
    "goal_contributions": [
      { "id": 12, "goal_id": 3, "amount": 2500000, "note": "Gajian Agustus", "created_at": "2026-08-20 14:00:00" }
    ]
  }
}
```

### Explicitly Excluded from Backup
- `users.password_hash`
- `sessions.token`
- `sessions.expires_at`
- Redundant `user_id` columns (export is already scoped to the authenticated user)

---

## 4. Full CSV Export Standards

Accessible via authenticated endpoint **`/api/export-csv`** from `/pengaturan`.

### Security & Compatibility
1. **UTF-8 BOM (`\uFEFF`)**: Included at the start of the file to ensure Indonesian characters (accents, punctuation) open seamlessly in Microsoft Excel, Apple Numbers, and Google Sheets.
2. **Spreadsheet Formula Injection Defense**: Any user-controlled text field (`description`, `category`, `notes`) starting with `=`, `+`, `-`, or `@` is prefixed with a single quote (`'`).
3. **Numeric Preservation**: The `amount` column remains unescaped numeric values (e.g. `25000`) so arithmetic operations work immediately in spreadsheets.

---

## 5. Monthly Financial PDF Report (`/api/report-pdf`)

Accessible via authenticated endpoint **`/api/report-pdf?month=YYYY-MM`** from `/pengaturan`.

### Document Standards
1. **Format**: Standard A4 Portrait, pure white background (`#ffffff`), near-black typography (`#141916`), and restrained Graphite Sage accents.
2. **Scope**: One user-selected month containing:
   - **Ringkasan Keuangan**: Pemasukan, Pengeluaran, Net Cash Flow.
   - **Budget Bulanan**: Batas budget, pengeluaran digunakan, dan sisa / kelebihan.
   - **Pengeluaran Berdasarkan Kategori**: Expense categories ranked by spending amount with percentage shares.
   - **Budget Kategori**: Limit, used, and remaining amounts for configured category budgets.
   - **Daftar Transaksi**: Complete monthly ledger with text-wrapped descriptions and multi-page pagination.
3. **Multi-Page & Footers**: Automatic page continuation with running headers and `ArthaFlow · Halaman X dari Y` on all pages.
4. **Exclusions**: Independent multi-month Goals and AI commentary are excluded from monthly snapshot reports to maintain factual integrity.
5. **Security**: Server-side authenticated generation with `Cache-Control: private, no-store`.

---

## 6. Date Formatting Standards (`lib/format.js`)

| Format Level | Function | Example Output | Usage Context |
| :--- | :--- | :--- | :--- |
| **Compact Date** | `formatCompactDate()` | `20 Agu` | Overview previews, mobile transaction metadata |
| **Full Date** | `formatFullDate()` | `20 Agu 2026` | Reports, date badges where year is required |
| **Date + Time** | `formatDateTime()` | `20 Agu 2026, 21:51` | Transaction register, audit history |
| **Month Label** | `formatMonthLabel()` | `Agustus 2026` | Header MonthPicker, month-scoped page subtitles |
| **Machine Timestamp** | `toISOString()` | `2026-08-21T00:00:00.000Z` | Backup metadata (`exported_at`) |

### Calendar Date Parsing Invariant
Database date-only strings (`YYYY-MM-DD`) are parsed strictly by their year, month, and day components without UTC conversions, preventing accidental 1-day shifts across timezones.

---

## 6. Destructive Actions & ConfirmDialog

Every destructive action uses the standardized `ConfirmDialog` component with explicit consequence microcopy:

1. **Transaction Deletion**:
   - *Title*: `Hapus transaksi "[Deskripsi]"?`
   - *Consequence*: "Transaksi Rp X ini akan dihapus dari riwayat dan tidak lagi dihitung dalam budget atau analisis. Tindakan ini tidak dapat dibatalkan."
2. **Goal Deletion**:
   - *Title*: `Hapus tujuan "[Nama Tujuan]"?`
   - *Consequence*: "Riwayat dana yang dialokasikan ke tujuan ini juga akan dihapus. Transaksi, budget, dan analisis tidak berubah. Tindakan ini tidak dapat dibatalkan."
3. **Category Budget Deletion**:
   - *Title*: `Hapus budget kategori "[Kategori]"?`
   - *Consequence*: "Hanya batas budget kategori ini yang akan dihapus. Transaksi pada kategori ini tetap tersimpan dan tidak terhapus."

---

## 7. Prohibited Claims & Anti-Patterns

| Prohibited Statement / Pattern | Why Prohibited | Approved Alternative |
| :--- | :--- | :--- |
| "Bank-grade 256-bit encryption" | Unverifiable marketing jargon | State factual backup format and exclusions |
| Security badges / shields / lock icons | Artificial trust theater | Restrained, functional UI with transparent settings |
| `window.confirm()` browser dialogs | Poor accessibility & lacks consequence explanation | Standardized `ConfirmDialog` |
| "Oops! Sesuatu rusak!" | Theatrical error tone | "Gagal memuat data. Coba lagi." |
