import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL || `file:${process.cwd()}/data.db`;
const authToken = process.env.TURSO_AUTH_TOKEN || '';

const db = createClient({
  url,
  authToken,
});

async function initDb() {
  try {
    await db.execute(`PRAGMA journal_mode = WAL;`);
    await db.execute(`PRAGMA busy_timeout = 5000;`);
  } catch (e) {
    // Ignore on remote cloud drivers where pragma is unsupported
  }

  // Tabel users
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL
    )
  `);

  // Tabel sessions
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL
    )
  `);

  // Tabel expenses
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        amount REAL NOT NULL,
        description TEXT NOT NULL,
        date TEXT NOT NULL,
        category TEXT DEFAULT 'Lainnya',
        notes TEXT DEFAULT '',
        is_recurring INTEGER DEFAULT 0,
        type TEXT DEFAULT 'expense',
        account_id INTEGER DEFAULT NULL
      )
    `);
  } catch (e) {
    // try migrating old columns if it was created already without them
    try { await db.execute(`ALTER TABLE expenses ADD COLUMN category TEXT DEFAULT 'Lainnya'`); } catch(e){}
    try { await db.execute(`ALTER TABLE expenses ADD COLUMN user_id INTEGER`); } catch(e){}
    try { await db.execute(`ALTER TABLE expenses ADD COLUMN notes TEXT DEFAULT ''`); } catch(e){}
    try { await db.execute(`ALTER TABLE expenses ADD COLUMN is_recurring INTEGER DEFAULT 0`); } catch(e){}
    try { await db.execute(`ALTER TABLE expenses ADD COLUMN type TEXT DEFAULT 'expense'`); } catch(e){}
  }

  // Idempotent migration for account_id on existing expenses table
  try {
    await db.execute(`ALTER TABLE expenses ADD COLUMN account_id INTEGER DEFAULT NULL`);
  } catch (e) {
    // Column already exists
  }

  // Tabel categories
  await db.execute(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      UNIQUE(user_id, name, type)
    )
  `);

  // Tabel budgets
  await db.execute(`
    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      month TEXT NOT NULL,
      amount REAL NOT NULL,
      UNIQUE(user_id, month)
    )
  `);

  // Tabel goals
  await db.execute(`
    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      target_amount REAL NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabel category_budgets
  await db.execute(`
    CREATE TABLE IF NOT EXISTS category_budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      month TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      UNIQUE(user_id, month, category)
    )
  `);

  // Tabel goal_contributions (STEP 6: Independent Goals System)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS goal_contributions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      goal_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      note TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabel accounts (STEP 9: Accounts & Wallets Foundation)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      opening_balance INTEGER NOT NULL DEFAULT 0,
      opening_date TEXT NOT NULL,
      archived_at TEXT DEFAULT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id, archived_at)`);

  // Tabel account_transfers (STEP 9: Separate Transfer Ledger)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS account_transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      from_account_id INTEGER NOT NULL,
      to_account_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      transfer_date TEXT NOT NULL,
      note TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_transfers_user_date ON account_transfers(user_id, transfer_date)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_transfers_from ON account_transfers(user_id, from_account_id)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_transfers_to ON account_transfers(user_id, to_account_id)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_expenses_user_account ON expenses(user_id, account_id)`);
}

export const dbReady = initDb().catch(console.error);

export default db;

