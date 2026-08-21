'use server';

import db, { dbReady } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { parseCurrency } from '@/lib/currency';
import { formatFullDate } from '@/lib/format';
import {
  sanitizeText,
  sanitizeDescription,
  sanitizeCategoryName,
  sanitizeGoalName,
  sanitizeUsername
} from '@/lib/formSanitizer';
import {
  computeDueCandidateDates,
  computeNextDueDate,
  getTodayDateStr
} from '@/lib/recurrence';

// --- AUTH & SESSIONS ---

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, key] = storedHash.split(':');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return key === hash;
}

export async function getAuthSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return null;

  const res = await db.execute({
    sql: 'SELECT user_id, expires_at FROM sessions WHERE token = ?',
    args: [token]
  });
  const session = res.rows[0];
  if (!session) return null;

  if (new Date(session.expires_at) < new Date()) {
    await db.execute({
      sql: 'DELETE FROM sessions WHERE token = ?',
      args: [token]
    });
    return null;
  }
  return session.user_id;
}

export async function register(formData) {
  const username = sanitizeUsername(formData.get('username'));
  const password = formData.get('password');

  if (!username || username.length < 3) {
    return { error: 'Username minimal 3 karakter (huruf, angka, titik, strip).' };
  }

  if (!password || password.length < 4) {
    return { error: 'Password minimal 4 karakter.' };
  }

  const existingRes = await db.execute({
    sql: 'SELECT id FROM users WHERE username = ?',
    args: [username]
  });
  if (existingRes.rows.length > 0) {
    return { error: 'Username sudah terpakai.' };
  }

  const countRes = await db.execute('SELECT COUNT(*) as count FROM users');
  const isFirstUser = countRes.rows[0].count === 0;
  const hash = hashPassword(password);

  const tx = await db.transaction('write');
  try {
    const info = await tx.execute({
      sql: 'INSERT INTO users (username, password_hash) VALUES (?, ?)',
      args: [username, hash]
    });
    const newUserId = info.lastInsertRowid;

    if (isFirstUser) {
      await tx.execute({
        sql: 'UPDATE expenses SET user_id = ? WHERE user_id IS NULL',
        args: [newUserId]
      });
      await tx.execute({
        sql: 'UPDATE budgets SET user_id = ? WHERE user_id IS NULL',
        args: [newUserId]
      });
      await tx.execute({
        sql: 'UPDATE category_budgets SET user_id = ? WHERE user_id IS NULL',
        args: [newUserId]
      });
    }
    await tx.commit();
  } catch (error) {
    await tx.rollback();
    return { error: 'Gagal membuat akun.' };
  }

  return { success: true, message: 'Akun berhasil dibuat. Silakan login.' };
}

export async function login(formData) {
  const username = sanitizeUsername(formData.get('username'));
  const password = formData.get('password');

  const res = await db.execute({
    sql: 'SELECT id, password_hash FROM users WHERE username = ?',
    args: [username]
  });
  const user = res.rows[0];
  
  if (!user || !verifyPassword(password, user.password_hash)) {
    return { error: 'Username atau password salah.' };
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
  await db.execute({
    sql: 'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)',
    args: [token, user.id, expiresAt]
  });

  const cookieStore = await cookies();
  cookieStore.set('auth_token', token, { 
    httpOnly: true, 
    secure: process.env.NODE_ENV === 'production', 
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30 
  });

  revalidatePath('/');
  return { success: true };
}

export async function getCurrentUser() {
  await dbReady;
  const userId = await getAuthSession();
  if (!userId) return null;

  const res = await db.execute({
    sql: 'SELECT username FROM users WHERE id = ?',
    args: [userId]
  });
  const user = res.rows[0];
  if (!user) return null;

  return {
    username: String(user.username)
  };
}

export async function logout() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (token) {
    await db.execute({
      sql: 'DELETE FROM sessions WHERE token = ?',
      args: [token]
    });
  }
  cookieStore.set('auth_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0
  });
  revalidatePath('/');
}

// --- CRUD OPERATIONS ---

export async function getAnalyticsData(startMonth, endMonth) {
  await dbReady;
  const userId = await getAuthSession();
  if (!userId) return [];
  // startMonth and endMonth are 'YYYY-MM' strings.
  // We use LIKE pattern: date >= startMonth-01 and date < nextMonthAfterEnd-01
  // Simplification: compare date prefix slice against month strings (SQLite text comparison works correctly for ISO dates)
  const res = await db.execute({
    sql: `SELECT id, amount, description, date, category, type, is_recurring
          FROM expenses
          WHERE user_id = ?
            AND substr(date, 1, 7) >= ?
            AND substr(date, 1, 7) <= ?
          ORDER BY date ASC`,
    args: [userId, startMonth, endMonth]
  });
  return res.rows.map(r => ({
    id: Number(r.id),
    amount: Number(r.amount),
    description: String(r.description ?? ''),
    date: String(r.date ?? ''),
    category: String(r.category ?? 'Lainnya'),
    type: String(r.type ?? 'expense'),
    is_recurring: Number(r.is_recurring ?? 0),
  }));
}

export async function getExpenses() {
  await dbReady;
  const userId = await getAuthSession();
  if (!userId) return [];
  const res = await db.execute({
    sql: `SELECT 
            e.id,
            e.user_id,
            e.amount,
            e.description,
            e.date,
            e.category,
            e.notes,
            e.is_recurring,
            e.type,
            e.account_id,
            a.name AS account_name,
            a.type AS account_type,
            a.archived_at AS account_archived_at
          FROM expenses e
          LEFT JOIN accounts a ON e.account_id = a.id AND a.user_id = e.user_id
          WHERE e.user_id = ? 
          ORDER BY e.date DESC, e.id DESC`,
    args: [userId]
  });
  return res.rows.map(r => ({
    id: Number(r.id),
    user_id: r.user_id != null ? Number(r.user_id) : null,
    amount: Number(r.amount),
    description: String(r.description ?? ''),
    date: String(r.date ?? ''),
    category: String(r.category ?? 'Lainnya'),
    notes: r.notes ? String(r.notes) : '',
    is_recurring: Number(r.is_recurring ?? 0),
    type: String(r.type ?? 'expense'),
    account_id: r.account_id != null ? Number(r.account_id) : null,
    account_name: r.account_name ? String(r.account_name) : null,
    account_type: r.account_type ? String(r.account_type) : null,
    account_archived: r.account_archived_at != null
  }));
}

export async function addExpense(formData) {
  const userId = await getAuthSession();
  if (!userId) throw new Error('Unauthorized');

  const amount = parseCurrency(formData.get('amount'));
  const description = sanitizeDescription(formData.get('description'));
  const type = formData.get('type') === 'income' ? 'income' : 'expense';
  const category = sanitizeCategoryName(formData.get('category'));
  const notes = sanitizeText(formData.get('notes'), 255);
  const isRecurring = formData.get('is_recurring') === 'on' ? 1 : 0;
  const date = String(formData.get('date') || new Date().toISOString());

  if (amount <= 0) {
    return { success: false, error: 'Jumlah harus lebih besar dari 0.' };
  }
  if (!description) {
    return { success: false, error: 'Keterangan transaksi wajib diisi.' };
  }

  const accountIdRaw = formData.get('account_id');
  let targetAccountId = null;

  if (accountIdRaw && accountIdRaw !== '__UNASSIGNED__' && accountIdRaw !== '') {
    const parsedId = parseInt(accountIdRaw, 10);
    if (!isNaN(parsedId)) {
      const accRes = await db.execute({
        sql: 'SELECT id, name, opening_date, archived_at FROM accounts WHERE id = ? AND user_id = ?',
        args: [parsedId, userId]
      });
      if (accRes.rows.length === 0) {
        return { success: false, error: 'Akun tidak valid atau tidak ditemukan.' };
      }
      const acc = accRes.rows[0];
      if (acc.archived_at) {
        return { success: false, error: 'Tidak dapat mencatat transaksi pada akun yang diarsipkan.' };
      }
      const txDatePrefix = date.slice(0, 10);
      if (txDatePrefix < String(acc.opening_date).slice(0, 10)) {
        const formattedOpening = formatFullDate(acc.opening_date);
        return {
          success: false,
          error: `Transaksi ini terjadi sebelum tanggal mulai ${acc.name} (${formattedOpening}).`
        };
      }
      targetAccountId = parsedId;
    }
  }

  await db.execute({
    sql: 'INSERT INTO expenses (user_id, amount, description, date, category, notes, is_recurring, type, account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: [userId, amount, description, date, category, notes, isRecurring, type, targetAccountId]
  });
  revalidatePath('/');
  revalidatePath('/transaksi');
  revalidatePath('/akun');
  return { success: true };
}

export async function updateExpense(formData) {
  const userId = await getAuthSession();
  if (!userId) throw new Error('Unauthorized');

  const id = parseInt(formData.get('id'), 10);
  const amount = parseCurrency(formData.get('amount'));
  const description = sanitizeDescription(formData.get('description'));
  const type = formData.get('type') === 'income' ? 'income' : 'expense';
  const category = sanitizeCategoryName(formData.get('category'));
  const notes = sanitizeText(formData.get('notes'), 255);
  const isRecurring = formData.get('is_recurring') === 'on' ? 1 : 0;

  if (isNaN(id) || amount <= 0 || !description) {
    return { success: false, error: 'Data transaksi tidak valid atau belum lengkap.' };
  }

  // Verify existing expense ownership
  const existingExpRes = await db.execute({
    sql: 'SELECT id, date, account_id FROM expenses WHERE id = ? AND user_id = ?',
    args: [id, userId]
  });
  if (existingExpRes.rows.length === 0) {
    return { success: false, error: 'Transaksi tidak ditemukan.' };
  }
  const existingExp = existingExpRes.rows[0];

  const accountIdRaw = formData.get('account_id');
  let targetAccountId = existingExp.account_id != null ? Number(existingExp.account_id) : null;

  if (accountIdRaw !== undefined && accountIdRaw !== null) {
    if (accountIdRaw === '__UNASSIGNED__' || accountIdRaw === '') {
      targetAccountId = null;
    } else {
      const parsedId = parseInt(accountIdRaw, 10);
      if (!isNaN(parsedId)) {
        const accRes = await db.execute({
          sql: 'SELECT id, name, opening_date, archived_at FROM accounts WHERE id = ? AND user_id = ?',
          args: [parsedId, userId]
        });
        if (accRes.rows.length === 0) {
          return { success: false, error: 'Akun tidak valid.' };
        }
        const acc = accRes.rows[0];
        // Allow keeping existing account relationship even if archived, but block switching TO a different archived account
        if (acc.archived_at && Number(existingExp.account_id) !== parsedId) {
          return { success: false, error: 'Tidak dapat memindahkan transaksi ke akun yang diarsipkan.' };
        }
        const txDatePrefix = String(existingExp.date).slice(0, 10);
        if (txDatePrefix < String(acc.opening_date).slice(0, 10)) {
          const formattedOpening = formatFullDate(acc.opening_date);
          return {
            success: false,
            error: `Transaksi ini terjadi sebelum tanggal mulai ${acc.name} (${formattedOpening}).`
          };
        }
        targetAccountId = parsedId;
      }
    }
  }

  await db.execute({
    sql: 'UPDATE expenses SET amount = ?, description = ?, category = ?, notes = ?, is_recurring = ?, type = ?, account_id = ? WHERE id = ? AND user_id = ?',
    args: [amount, description, category, notes, isRecurring, type, targetAccountId, id, userId]
  });
  revalidatePath('/');
  revalidatePath('/transaksi');
  revalidatePath('/akun');
  return { success: true };
}

export async function deleteExpense(id) {
  await dbReady;
  const userId = await getAuthSession();
  if (!userId) throw new Error('Unauthorized');

  const expId = Number(id);
  if (!expId || isNaN(expId)) {
    return { success: false, error: 'Transaksi tidak valid.' };
  }

  const tx = await db.transaction('write');
  try {
    const expRes = await tx.execute({
      sql: 'SELECT id FROM expenses WHERE id = ? AND user_id = ?',
      args: [expId, userId]
    });
    if (expRes.rows.length === 0) {
      await tx.rollback();
      return { success: false, error: 'Transaksi tidak ditemukan.' };
    }

    // If this transaction is linked to a recurring occurrence, reopen the occurrence as PENDING
    await tx.execute({
      sql: `UPDATE recurring_occurrences 
            SET status = 'PENDING', transaction_id = NULL, resolved_at = NULL, updated_at = ? 
            WHERE transaction_id = ? AND user_id = ?`,
      args: [new Date().toISOString(), expId, userId]
    });

    // Delete expense
    await tx.execute({
      sql: 'DELETE FROM expenses WHERE id = ? AND user_id = ?',
      args: [expId, userId]
    });

    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }

  revalidatePath('/');
  revalidatePath('/transaksi');
  revalidatePath('/akun');
  revalidatePath('/rutin');
  revalidatePath('/analisis');
  revalidatePath('/budget');
  return { success: true };
}

export async function seedRecurringExpenses(targetMonth) {
  // DEPRECATED in STEP 10: Recurring Transactions & Bills Foundation
  // Financial activity is now governed by the confirmation-first Recurring Occurrences system.
  // Real transactions are never automatically posted in the background.
  return;
}

export async function getBudget(month) {
  await dbReady;
  const userId = await getAuthSession();
  if (!userId) return null;

  const res = await db.execute({
    sql: 'SELECT amount FROM budgets WHERE month = ? AND user_id = ?',
    args: [month, userId]
  });
  const row = res.rows[0];
  return row ? row.amount : null;
}

export async function setBudget(formData) {
  const userId = await getAuthSession();
  if (!userId) throw new Error('Unauthorized');

  const amount = parseCurrency(formData.get('budget'));
  const month  = formData.get('month');

  if (isNaN(amount) || amount <= 0 || !month) return;

  try {
    await db.execute({
      sql: `
        INSERT INTO budgets (user_id, month, amount) VALUES (?, ?, ?)
        ON CONFLICT(user_id, month) DO UPDATE SET amount = excluded.amount
      `,
      args: [userId, month, amount]
    });
  } catch (error) {
    console.error('setBudget error:', error);
  }
  revalidatePath('/');
}

// --- CATEGORY BUDGETS ---

export async function getCategoryBudgets(month) {
  await dbReady;
  const userId = await getAuthSession();
  if (!userId) return [];

  const res = await db.execute({
    sql: 'SELECT category, amount FROM category_budgets WHERE user_id = ? AND month = ? ORDER BY category ASC',
    args: [userId, month]
  });
  return res.rows.map(r => ({
    category: String(r.category),
    amount: Number(r.amount)
  }));
}

export async function setCategoryBudget(formData) {
  const userId = await getAuthSession();
  if (!userId) throw new Error('Unauthorized');

  const month = formData.get('month');
  const category = sanitizeCategoryName(formData.get('category'));
  const amount = parseCurrency(formData.get('budget'));

  if (!month || !category || isNaN(amount) || amount <= 0) return;

  try {
    await db.execute({
      sql: `
        INSERT INTO category_budgets (user_id, month, category, amount) VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, month, category) DO UPDATE SET amount = excluded.amount
      `,
      args: [userId, month, category, amount]
    });
  } catch (error) {
    console.error('setCategoryBudget error:', error);
  }
  revalidatePath('/budget');
}

export async function deleteCategoryBudget(formData) {
  const userId = await getAuthSession();
  if (!userId) throw new Error('Unauthorized');

  const month = formData.get('month');
  const category = formData.get('category');

  if (!month || !category) return;

  await db.execute({
    sql: 'DELETE FROM category_budgets WHERE user_id = ? AND month = ? AND category = ?',
    args: [userId, month, category]
  });
  revalidatePath('/budget');
}

// --- GOALS ---

export async function getGoals() {
  await dbReady;
  const userId = await getAuthSession();
  if (!userId) return [];
  const result = await db.execute({
    sql: `SELECT 
            g.id,
            g.name,
            g.target_amount,
            g.created_at,
            COALESCE(SUM(c.amount), 0) as saved_amount
          FROM goals g
          LEFT JOIN goal_contributions c 
            ON c.goal_id = g.id AND c.user_id = g.user_id
          WHERE g.user_id = ?
          GROUP BY g.id, g.name, g.target_amount, g.created_at
          ORDER BY g.id DESC`,
    args: [userId]
  });
  return result.rows.map(row => ({
    id: Number(row.id),
    name: String(row.name),
    target_amount: Number(row.target_amount),
    saved_amount: Number(row.saved_amount),
    created_at: String(row.created_at ?? '')
  }));
}

export async function addGoal(formData) {
  await dbReady;
  const userId = await getAuthSession();
  if (!userId) throw new Error('Unauthorized');

  const name = sanitizeGoalName(formData.get('name'));
  const target_amount = parseCurrency(formData.get('target_amount'));

  if (!name || target_amount <= 0) return;

  await db.execute({
    sql: 'INSERT INTO goals (user_id, name, target_amount) VALUES (?, ?, ?)',
    args: [userId, name, target_amount]
  });

  revalidatePath('/');
  revalidatePath('/tujuan');
}

export async function deleteGoal(id) {
  await dbReady;
  const userId = await getAuthSession();
  if (!userId) throw new Error('Unauthorized');

  const goalId = Number(id);
  if (!goalId) return;

  // First verify goal belongs to current user
  const check = await db.execute({
    sql: 'SELECT id FROM goals WHERE id = ? AND user_id = ?',
    args: [goalId, userId]
  });
  if (check.rows.length === 0) throw new Error('Tujuan tidak ditemukan');

  // Delete contributions first, then the goal
  await db.execute({
    sql: 'DELETE FROM goal_contributions WHERE goal_id = ? AND user_id = ?',
    args: [goalId, userId]
  });

  await db.execute({
    sql: 'DELETE FROM goals WHERE id = ? AND user_id = ?',
    args: [goalId, userId]
  });

  revalidatePath('/');
  revalidatePath('/tujuan');
}

export async function addGoalFunds(formData) {
  await dbReady;
  const userId = await getAuthSession();
  if (!userId) throw new Error('Unauthorized');

  const goalId = Number(formData.get('goal_id'));
  const amount = parseCurrency(formData.get('amount'));
  const note = String(formData.get('note') ?? '').trim();

  if (!goalId || amount <= 0) {
    throw new Error('Nominal penambahan dana harus lebih dari 0');
  }

  // Verify ownership
  const check = await db.execute({
    sql: 'SELECT id FROM goals WHERE id = ? AND user_id = ?',
    args: [goalId, userId]
  });
  if (check.rows.length === 0) {
    throw new Error('Tujuan tidak ditemukan');
  }

  await db.execute({
    sql: 'INSERT INTO goal_contributions (user_id, goal_id, amount, note) VALUES (?, ?, ?, ?)',
    args: [userId, goalId, amount, note]
  });

  revalidatePath('/');
  revalidatePath('/tujuan');
}

export async function withdrawGoalFunds(formData) {
  await dbReady;
  const userId = await getAuthSession();
  if (!userId) throw new Error('Unauthorized');

  const goalId = Number(formData.get('goal_id'));
  const amount = parseCurrency(formData.get('amount'));
  const note = String(formData.get('note') ?? '').trim();

  if (!goalId || amount <= 0) {
    throw new Error('Nominal pengurangan dana harus lebih dari 0');
  }

  // Verify ownership and calculate current balance server-side
  const check = await db.execute({
    sql: `SELECT g.id, COALESCE(SUM(c.amount), 0) as current_balance
          FROM goals g
          LEFT JOIN goal_contributions c 
            ON c.goal_id = g.id AND c.user_id = g.user_id
          WHERE g.id = ? AND g.user_id = ?
          GROUP BY g.id`,
    args: [goalId, userId]
  });

  if (check.rows.length === 0) {
    throw new Error('Tujuan tidak ditemukan');
  }

  const currentBalance = Number(check.rows[0].current_balance);
  if (amount > currentBalance) {
    throw new Error('Dana yang dikurangi melebihi saldo tujuan');
  }

  await db.execute({
    sql: 'INSERT INTO goal_contributions (user_id, goal_id, amount, note) VALUES (?, ?, ?, ?)',
    args: [userId, goalId, -amount, note]
  });

  revalidatePath('/');
  revalidatePath('/tujuan');
}

// --- CATEGORIES ---

export async function getCategories(type = 'expense') {
  await dbReady;
  const userId = await getAuthSession();
  if (!userId) return [];

  const resCount = await db.execute({
    sql: 'SELECT COUNT(*) as c FROM categories WHERE user_id = ? AND type = ?',
    args: [userId, type]
  });
  const count = resCount.rows[0].c;
  
  if (count === 0) {
    const defaults = type === 'expense' 
      ? ['Makanan', 'Transportasi', 'Hiburan', 'Belanja', 'Lainnya']
      : ['Gaji', 'Bonus', 'Pemberian', 'Lainnya'];
    
    const tx = await db.transaction('write');
    try {
      for (const cat of defaults) {
        try {
          await tx.execute({
            sql: 'INSERT INTO categories (user_id, name, type) VALUES (?, ?, ?)',
            args: [userId, cat, type]
          });
        } catch (e) {
          // ignore unique constraint
        }
      }
      await tx.commit();
    } catch (e) {
      await tx.rollback();
    }
  }

  const res = await db.execute({
    sql: 'SELECT id, name FROM categories WHERE user_id = ? AND type = ? ORDER BY id ASC',
    args: [userId, type]
  });
  return res.rows.map(row => ({
    id: Number(row.id),
    name: String(row.name)
  }));
}

export async function addCategory(formData) {
  const userId = await getAuthSession();
  if (!userId) throw new Error('Unauthorized');

  const name = sanitizeCategoryName(formData.get('name'));
  const type = formData.get('type') === 'income' ? 'income' : 'expense';

  if (!name || name === 'Lainnya') return;

  try {
    await db.execute({
      sql: 'INSERT INTO categories (user_id, name, type) VALUES (?, ?, ?)',
      args: [userId, name, type]
    });
  } catch (e) {
    // Ignore unique constraint error
  }
  revalidatePath('/');
}

export async function deleteCategory(id) {
  const userId = await getAuthSession();
  if (!userId) throw new Error('Unauthorized');

  await db.execute({
    sql: 'DELETE FROM categories WHERE id = ? AND user_id = ?',
    args: [id, userId]
  });
  revalidatePath('/');
}

// ══════════════════════════════════════════
// ACCOUNTS & WALLETS (STEP 9)
// ══════════════════════════════════════════

function formatAccountType(type) {
  switch (type) {
    case 'BANK': return 'Bank';
    case 'E_WALLET': return 'E-wallet';
    case 'CASH': return 'Tunai';
    case 'OTHER': default: return 'Lainnya';
  }
}

function getAsOfDateCutoff(asOfMonth) {
  if (!asOfMonth) {
    return new Date().toISOString();
  }
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  if (asOfMonth < currentMonthStr) {
    // Past month -> end of selected month (e.g. 2026-07-31T23:59:59.999Z)
    const [year, month] = asOfMonth.split('-').map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    return lastDay.toISOString();
  }
  
  // Current month or future month -> current timestamp (no future forecasting)
  return now.toISOString();
}

export async function getAccounts(asOfMonth = null) {
  await dbReady;
  const userId = await getAuthSession();
  if (!userId) return [];

  const cutoff = getAsOfDateCutoff(asOfMonth);

  // Single source-of-truth derived balance query using isolated scalar subqueries (prevents join multiplication)
  const res = await db.execute({
    sql: `SELECT 
            a.id,
            a.user_id,
            a.name,
            a.type,
            a.opening_balance,
            a.opening_date,
            a.archived_at,
            a.created_at,
            a.updated_at,
            COALESCE((
              SELECT SUM(amount) FROM expenses 
              WHERE user_id = a.user_id 
                AND account_id = a.id 
                AND type = 'income' 
                AND date >= a.opening_date 
                AND date <= ?
            ), 0) AS total_income,
            COALESCE((
              SELECT SUM(amount) FROM expenses 
              WHERE user_id = a.user_id 
                AND account_id = a.id 
                AND type = 'expense' 
                AND date >= a.opening_date 
                AND date <= ?
            ), 0) AS total_expense,
            COALESCE((
              SELECT SUM(amount) FROM account_transfers 
              WHERE user_id = a.user_id 
                AND to_account_id = a.id 
                AND transfer_date >= a.opening_date 
                AND transfer_date <= ?
            ), 0) AS total_transfer_in,
            COALESCE((
              SELECT SUM(amount) FROM account_transfers 
              WHERE user_id = a.user_id 
                AND from_account_id = a.id 
                AND transfer_date >= a.opening_date 
                AND transfer_date <= ?
            ), 0) AS total_transfer_out,
            (
              (SELECT COUNT(*) FROM expenses WHERE user_id = a.user_id AND account_id = a.id) +
              (SELECT COUNT(*) FROM account_transfers WHERE user_id = a.user_id AND (from_account_id = a.id OR to_account_id = a.id))
            ) AS activity_count
          FROM accounts a
          WHERE a.user_id = ? AND a.archived_at IS NULL
          ORDER BY a.name ASC`,
    args: [cutoff, cutoff, cutoff, cutoff, userId]
  });

  return res.rows.map(r => {
    const openingBalance = Number(r.opening_balance ?? 0);
    const totalIncome = Number(r.total_income ?? 0);
    const totalExpense = Number(r.total_expense ?? 0);
    const totalTransferIn = Number(r.total_transfer_in ?? 0);
    const totalTransferOut = Number(r.total_transfer_out ?? 0);
    const balance = openingBalance + totalIncome - totalExpense + totalTransferIn - totalTransferOut;

    return {
      id: Number(r.id),
      user_id: Number(r.user_id),
      name: String(r.name ?? ''),
      type: String(r.type ?? 'OTHER'),
      type_label: formatAccountType(r.type),
      opening_balance: openingBalance,
      opening_date: String(r.opening_date ?? ''),
      archived_at: r.archived_at ? String(r.archived_at) : null,
      balance,
      activity_count: Number(r.activity_count ?? 0),
      created_at: String(r.created_at ?? '')
    };
  });
}

export async function getArchivedAccounts() {
  await dbReady;
  const userId = await getAuthSession();
  if (!userId) return [];

  const nowIso = new Date().toISOString();

  const res = await db.execute({
    sql: `SELECT 
            a.id,
            a.user_id,
            a.name,
            a.type,
            a.opening_balance,
            a.opening_date,
            a.archived_at,
            a.created_at,
            a.updated_at,
            COALESCE((
              SELECT SUM(amount) FROM expenses 
              WHERE user_id = a.user_id 
                AND account_id = a.id 
                AND type = 'income' 
                AND date >= a.opening_date 
                AND date <= ?
            ), 0) AS total_income,
            COALESCE((
              SELECT SUM(amount) FROM expenses 
              WHERE user_id = a.user_id 
                AND account_id = a.id 
                AND type = 'expense' 
                AND date >= a.opening_date 
                AND date <= ?
            ), 0) AS total_expense,
            COALESCE((
              SELECT SUM(amount) FROM account_transfers 
              WHERE user_id = a.user_id 
                AND to_account_id = a.id 
                AND transfer_date >= a.opening_date 
                AND transfer_date <= ?
            ), 0) AS total_transfer_in,
            COALESCE((
              SELECT SUM(amount) FROM account_transfers 
              WHERE user_id = a.user_id 
                AND from_account_id = a.id 
                AND transfer_date >= a.opening_date 
                AND transfer_date <= ?
            ), 0) AS total_transfer_out,
            (
              (SELECT COUNT(*) FROM expenses WHERE user_id = a.user_id AND account_id = a.id) +
              (SELECT COUNT(*) FROM account_transfers WHERE user_id = a.user_id AND (from_account_id = a.id OR to_account_id = a.id))
            ) AS activity_count
          FROM accounts a
          WHERE a.user_id = ? AND a.archived_at IS NOT NULL
          ORDER BY a.name ASC`,
    args: [nowIso, nowIso, nowIso, nowIso, userId]
  });

  return res.rows.map(r => {
    const openingBalance = Number(r.opening_balance ?? 0);
    const totalIncome = Number(r.total_income ?? 0);
    const totalExpense = Number(r.total_expense ?? 0);
    const totalTransferIn = Number(r.total_transfer_in ?? 0);
    const totalTransferOut = Number(r.total_transfer_out ?? 0);
    const balance = openingBalance + totalIncome - totalExpense + totalTransferIn - totalTransferOut;

    return {
      id: Number(r.id),
      user_id: Number(r.user_id),
      name: String(r.name ?? ''),
      type: String(r.type ?? 'OTHER'),
      type_label: formatAccountType(r.type),
      opening_balance: openingBalance,
      opening_date: String(r.opening_date ?? ''),
      archived_at: r.archived_at ? String(r.archived_at) : null,
      balance,
      activity_count: Number(r.activity_count ?? 0),
      created_at: String(r.created_at ?? '')
    };
  });
}

export async function getAccount(id) {
  await dbReady;
  const userId = await getAuthSession();
  if (!userId) return null;

  const accountId = Number(id);
  const nowIso = new Date().toISOString();

  const res = await db.execute({
    sql: `SELECT 
            a.id,
            a.user_id,
            a.name,
            a.type,
            a.opening_balance,
            a.opening_date,
            a.archived_at,
            a.created_at,
            a.updated_at,
            COALESCE((
              SELECT SUM(amount) FROM expenses 
              WHERE user_id = a.user_id 
                AND account_id = a.id 
                AND type = 'income' 
                AND date >= a.opening_date 
                AND date <= ?
            ), 0) AS total_income,
            COALESCE((
              SELECT SUM(amount) FROM expenses 
              WHERE user_id = a.user_id 
                AND account_id = a.id 
                AND type = 'expense' 
                AND date >= a.opening_date 
                AND date <= ?
            ), 0) AS total_expense,
            COALESCE((
              SELECT SUM(amount) FROM account_transfers 
              WHERE user_id = a.user_id 
                AND to_account_id = a.id 
                AND transfer_date >= a.opening_date 
                AND transfer_date <= ?
            ), 0) AS total_transfer_in,
            COALESCE((
              SELECT SUM(amount) FROM account_transfers 
              WHERE user_id = a.user_id 
                AND from_account_id = a.id 
                AND transfer_date >= a.opening_date 
                AND transfer_date <= ?
            ), 0) AS total_transfer_out,
            (
              (SELECT COUNT(*) FROM expenses WHERE user_id = a.user_id AND account_id = a.id) +
              (SELECT COUNT(*) FROM account_transfers WHERE user_id = a.user_id AND (from_account_id = a.id OR to_account_id = a.id))
            ) AS activity_count
          FROM accounts a
          WHERE a.id = ? AND a.user_id = ?`,
    args: [nowIso, nowIso, nowIso, nowIso, accountId, userId]
  });

  const r = res.rows[0];
  if (!r) return null;

  const openingBalance = Number(r.opening_balance ?? 0);
  const totalIncome = Number(r.total_income ?? 0);
  const totalExpense = Number(r.total_expense ?? 0);
  const totalTransferIn = Number(r.total_transfer_in ?? 0);
  const totalTransferOut = Number(r.total_transfer_out ?? 0);
  const balance = openingBalance + totalIncome - totalExpense + totalTransferIn - totalTransferOut;

  return {
    id: Number(r.id),
    user_id: Number(r.user_id),
    name: String(r.name ?? ''),
    type: String(r.type ?? 'OTHER'),
    type_label: formatAccountType(r.type),
    opening_balance: openingBalance,
    opening_date: String(r.opening_date ?? ''),
    archived_at: r.archived_at ? String(r.archived_at) : null,
    balance,
    activity_count: Number(r.activity_count ?? 0),
    created_at: String(r.created_at ?? '')
  };
}

export async function createAccount(formData) {
  await dbReady;
  const userId = await getAuthSession();
  if (!userId) throw new Error('Unauthorized');

  const name = sanitizeText(formData.get('name'), 100);
  const rawType = String(formData.get('type') ?? '').trim().toUpperCase();
  const validTypes = ['BANK', 'E_WALLET', 'CASH', 'OTHER'];
  const type = validTypes.includes(rawType) ? rawType : 'OTHER';
  
  const openingBalance = parseCurrency(formData.get('opening_balance') || '0');
  const openingDate = String(formData.get('opening_date') || new Date().toISOString().slice(0, 10)).trim();

  if (!name) {
    return { success: false, error: 'Nama akun wajib diisi.' };
  }
  if (!openingDate) {
    return { success: false, error: 'Tanggal mulai pelacakan wajib diisi.' };
  }

  await db.execute({
    sql: `INSERT INTO accounts (user_id, name, type, opening_balance, opening_date)
          VALUES (?, ?, ?, ?, ?)`,
    args: [userId, name, type, openingBalance, openingDate]
  });

  revalidatePath('/');
  revalidatePath('/akun');
  revalidatePath('/transaksi');
  return { success: true };
}

export async function updateAccount(formData) {
  await dbReady;
  const userId = await getAuthSession();
  if (!userId) throw new Error('Unauthorized');

  const id = Number(formData.get('id'));
  const name = sanitizeText(formData.get('name'), 100);
  const rawType = String(formData.get('type') ?? '').trim().toUpperCase();
  const validTypes = ['BANK', 'E_WALLET', 'CASH', 'OTHER'];
  const type = validTypes.includes(rawType) ? rawType : 'OTHER';

  if (!id || !name) {
    return { success: false, error: 'Nama akun wajib diisi.' };
  }

  // Check activity count to enforce opening balance/date locking rule
  const checkRes = await db.execute({
    sql: `SELECT 
            a.id,
            a.opening_balance,
            a.opening_date,
            (
              (SELECT COUNT(*) FROM expenses WHERE user_id = a.user_id AND account_id = a.id) +
              (SELECT COUNT(*) FROM account_transfers WHERE user_id = a.user_id AND (from_account_id = a.id OR to_account_id = a.id))
            ) AS activity_count
          FROM accounts a
          WHERE a.id = ? AND a.user_id = ?`,
    args: [id, userId]
  });

  if (checkRes.rows.length === 0) {
    return { success: false, error: 'Akun tidak ditemukan.' };
  }

  const currentAcc = checkRes.rows[0];
  const hasActivity = Number(currentAcc.activity_count) > 0;

  if (hasActivity) {
    // If account has activity, reject any manipulated attempt to change opening_balance or opening_date
    const rawOpeningBal = formData.get('opening_balance');
    const rawOpeningDate = formData.get('opening_date');

    if (rawOpeningBal !== null && rawOpeningBal !== '' && parseCurrency(rawOpeningBal) !== Number(currentAcc.opening_balance)) {
      return {
        success: false,
        error: 'Saldo awal dan tanggal mulai tidak dapat diubah setelah akun memiliki aktivitas.'
      };
    }

    if (rawOpeningDate !== null && rawOpeningDate !== '' && String(rawOpeningDate).trim().slice(0, 10) !== String(currentAcc.opening_date).slice(0, 10)) {
      return {
        success: false,
        error: 'Saldo awal dan tanggal mulai tidak dapat diubah setelah akun memiliki aktivitas.'
      };
    }

    // Safely update name and type only
    await db.execute({
      sql: `UPDATE accounts 
            SET name = ?, type = ?, updated_at = ? 
            WHERE id = ? AND user_id = ?`,
      args: [name, type, new Date().toISOString(), id, userId]
    });
  } else {
    // Allow updating opening balance and date if zero activity
    const openingBalance = parseCurrency(formData.get('opening_balance') || '0');
    const openingDate = String(formData.get('opening_date') || currentAcc.opening_date).trim();

    if (!openingDate) {
      return { success: false, error: 'Tanggal mulai pelacakan wajib diisi.' };
    }

    await db.execute({
      sql: `UPDATE accounts 
            SET name = ?, type = ?, opening_balance = ?, opening_date = ?, updated_at = ? 
            WHERE id = ? AND user_id = ?`,
      args: [name, type, openingBalance, openingDate, new Date().toISOString(), id, userId]
    });
  }

  revalidatePath('/');
  revalidatePath('/akun');
  revalidatePath('/transaksi');
  return { success: true };
}

export async function extendAccountHistory(formData) {
  await dbReady;
  const userId = await getAuthSession();
  if (!userId) throw new Error('Unauthorized');

  const accountId = Number(formData.get('account_id') || formData.get('id'));
  const newOpeningDate = String(formData.get('opening_date') || '').trim();
  const newOpeningBalance = parseCurrency(formData.get('opening_balance') || '0');

  if (!accountId || isNaN(accountId)) {
    return { success: false, error: 'Akun tidak valid.' };
  }

  if (!newOpeningDate) {
    return { success: false, error: 'Tanggal mulai baru wajib diisi.' };
  }

  if (newOpeningBalance < 0 || newOpeningBalance > 999_999_999_999) {
    return { success: false, error: 'Saldo awal tidak valid.' };
  }

  // Fetch current account, verify ownership, and calculate activity count
  const accRes = await db.execute({
    sql: `SELECT 
            a.id, 
            a.name, 
            a.opening_date, 
            a.opening_balance, 
            a.archived_at,
            (
              (SELECT COUNT(*) FROM expenses WHERE user_id = a.user_id AND account_id = a.id) +
              (SELECT COUNT(*) FROM account_transfers WHERE user_id = a.user_id AND (from_account_id = a.id OR to_account_id = a.id))
            ) AS activity_count
          FROM accounts a 
          WHERE a.id = ? AND a.user_id = ?`,
    args: [accountId, userId]
  });

  if (accRes.rows.length === 0) {
    return { success: false, error: 'Akun tidak ditemukan.' };
  }

  const currentAcc = accRes.rows[0];
  if (currentAcc.archived_at) {
    return { success: false, error: 'Tidak dapat memperluas riwayat akun yang diarsipkan.' };
  }

  const currentOpeningDatePrefix = String(currentAcc.opening_date).slice(0, 10);
  const newOpeningDatePrefix = newOpeningDate.slice(0, 10);

  // Strict rule: new opening date must be strictly earlier than current opening date
  if (newOpeningDatePrefix >= currentOpeningDatePrefix) {
    return {
      success: false,
      error: 'Tanggal mulai baru harus lebih awal dari tanggal mulai saat ini.'
    };
  }

  await db.execute({
    sql: `UPDATE accounts 
          SET opening_date = ?, opening_balance = ?, updated_at = ? 
          WHERE id = ? AND user_id = ?`,
    args: [newOpeningDatePrefix, newOpeningBalance, new Date().toISOString(), accountId, userId]
  });

  revalidatePath('/');
  revalidatePath('/akun');
  revalidatePath('/transaksi');
  return { success: true };
}

export async function archiveAccount(id) {
  await dbReady;
  const userId = await getAuthSession();
  if (!userId) throw new Error('Unauthorized');

  const accountId = Number(id);
  const nowIso = new Date().toISOString();

  // Calculate current balance as of today
  const res = await db.execute({
    sql: `SELECT 
            a.id,
            a.name,
            a.opening_balance,
            a.opening_date,
            COALESCE((
              SELECT SUM(amount) FROM expenses 
              WHERE user_id = a.user_id AND account_id = a.id AND type = 'income' AND date >= a.opening_date AND date <= ?
            ), 0) AS total_income,
            COALESCE((
              SELECT SUM(amount) FROM expenses 
              WHERE user_id = a.user_id AND account_id = a.id AND type = 'expense' AND date >= a.opening_date AND date <= ?
            ), 0) AS total_expense,
            COALESCE((
              SELECT SUM(amount) FROM account_transfers 
              WHERE user_id = a.user_id AND to_account_id = a.id AND transfer_date >= a.opening_date AND transfer_date <= ?
            ), 0) AS total_transfer_in,
            COALESCE((
              SELECT SUM(amount) FROM account_transfers 
              WHERE user_id = a.user_id AND from_account_id = a.id AND transfer_date >= a.opening_date AND transfer_date <= ?
            ), 0) AS total_transfer_out
          FROM accounts a
          WHERE a.id = ? AND a.user_id = ?`,
    args: [nowIso, nowIso, nowIso, nowIso, accountId, userId]
  });

  if (res.rows.length === 0) {
    return { success: false, error: 'Akun tidak ditemukan.' };
  }

  const r = res.rows[0];
  const balance = Number(r.opening_balance ?? 0) + Number(r.total_income ?? 0) - Number(r.total_expense ?? 0) + Number(r.total_transfer_in ?? 0) - Number(r.total_transfer_out ?? 0);

  if (balance !== 0) {
    return { success: false, error: 'Kosongkan saldo akun sebelum mengarsipkan.' };
  }

  await db.execute({
    sql: 'UPDATE accounts SET archived_at = ?, updated_at = ? WHERE id = ? AND user_id = ?',
    args: [new Date().toISOString(), new Date().toISOString(), accountId, userId]
  });

  revalidatePath('/');
  revalidatePath('/akun');
  revalidatePath('/transaksi');
  return { success: true };
}

export async function unarchiveAccount(id) {
  await dbReady;
  const userId = await getAuthSession();
  if (!userId) throw new Error('Unauthorized');

  const accountId = Number(id);

  await db.execute({
    sql: 'UPDATE accounts SET archived_at = NULL, updated_at = ? WHERE id = ? AND user_id = ?',
    args: [new Date().toISOString(), accountId, userId]
  });

  revalidatePath('/');
  revalidatePath('/akun');
  revalidatePath('/transaksi');
  return { success: true };
}

// --- ACCOUNT TRANSFERS ---

export async function getAccountTransfers(month = null) {
  await dbReady;
  const userId = await getAuthSession();
  if (!userId) return [];

  let sql = `
    SELECT 
      t.id,
      t.user_id,
      t.from_account_id,
      t.to_account_id,
      t.amount,
      t.transfer_date,
      t.note,
      t.created_at,
      from_a.name AS from_account_name,
      from_a.type AS from_account_type,
      to_a.name AS to_account_name,
      to_a.type AS to_account_type
    FROM account_transfers t
    JOIN accounts from_a ON t.from_account_id = from_a.id
    JOIN accounts to_a ON t.to_account_id = to_a.id
    WHERE t.user_id = ?
  `;
  const args = [userId];

  if (month) {
    sql += ` AND t.transfer_date LIKE ?`;
    args.push(`${month}%`);
  }

  sql += ` ORDER BY t.transfer_date DESC, t.id DESC`;

  const res = await db.execute({ sql, args });

  return res.rows.map(r => ({
    id: Number(r.id),
    user_id: Number(r.user_id),
    from_account_id: Number(r.from_account_id),
    to_account_id: Number(r.to_account_id),
    amount: Number(r.amount),
    transfer_date: String(r.transfer_date ?? ''),
    note: String(r.note ?? ''),
    from_account_name: String(r.from_account_name ?? 'Akun'),
    from_account_type: String(r.from_account_type ?? 'OTHER'),
    from_account_type_label: formatAccountType(r.from_account_type),
    to_account_name: String(r.to_account_name ?? 'Akun'),
    to_account_type: String(r.to_account_type ?? 'OTHER'),
    to_account_type_label: formatAccountType(r.to_account_type),
    created_at: String(r.created_at ?? '')
  }));
}

export async function createAccountTransfer(formData) {
  await dbReady;
  const userId = await getAuthSession();
  if (!userId) throw new Error('Unauthorized');

  const fromAccountId = Number(formData.get('from_account_id'));
  const toAccountId = Number(formData.get('to_account_id'));
  const amount = parseCurrency(formData.get('amount'));
  const transferDate = String(formData.get('transfer_date') || new Date().toISOString().slice(0, 10)).trim();
  const note = sanitizeText(formData.get('note'), 255);

  if (!fromAccountId || !toAccountId) {
    return { success: false, error: 'Pilih akun asal dan akun tujuan.' };
  }
  if (fromAccountId === toAccountId) {
    return { success: false, error: 'Akun asal dan akun tujuan harus berbeda.' };
  }
  if (amount <= 0 || amount > 999_999_999_999) {
    return { success: false, error: 'Jumlah transfer harus lebih besar dari Rp0.' };
  }
  if (!transferDate) {
    return { success: false, error: 'Tanggal transfer wajib diisi.' };
  }

  // Verify ownership and active status for both accounts
  const accountsRes = await db.execute({
    sql: `SELECT id, name, opening_date, archived_at FROM accounts WHERE id IN (?, ?) AND user_id = ?`,
    args: [fromAccountId, toAccountId, userId]
  });

  if (accountsRes.rows.length !== 2) {
    return { success: false, error: 'Salah satu akun tidak ditemukan atau tidak valid.' };
  }

  const fromAcc = accountsRes.rows.find(a => Number(a.id) === fromAccountId);
  const toAcc = accountsRes.rows.find(a => Number(a.id) === toAccountId);

  if (fromAcc.archived_at || toAcc.archived_at) {
    return { success: false, error: 'Tidak dapat melakukan transfer dari atau ke akun yang diarsipkan.' };
  }

  const transferDatePrefix = transferDate.slice(0, 10);
  if (transferDatePrefix < String(fromAcc.opening_date).slice(0, 10)) {
    const formattedOpening = formatFullDate(fromAcc.opening_date);
    return {
      success: false,
      error: `Transfer terjadi sebelum tanggal mulai ${fromAcc.name} (${formattedOpening}).`
    };
  }
  if (transferDatePrefix < String(toAcc.opening_date).slice(0, 10)) {
    const formattedOpening = formatFullDate(toAcc.opening_date);
    return {
      success: false,
      error: `Transfer terjadi sebelum tanggal mulai ${toAcc.name} (${formattedOpening}).`
    };
  }

  await db.execute({
    sql: `INSERT INTO account_transfers (user_id, from_account_id, to_account_id, amount, transfer_date, note)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [userId, fromAccountId, toAccountId, amount, transferDate, note]
  });

  revalidatePath('/');
  revalidatePath('/akun');
  return { success: true };
}

export async function updateAccountTransfer(formData) {
  await dbReady;
  const userId = await getAuthSession();
  if (!userId) throw new Error('Unauthorized');

  const id = Number(formData.get('id'));
  const fromAccountId = Number(formData.get('from_account_id'));
  const toAccountId = Number(formData.get('to_account_id'));
  const amount = parseCurrency(formData.get('amount'));
  const transferDate = String(formData.get('transfer_date') || new Date().toISOString().slice(0, 10)).trim();
  const note = sanitizeText(formData.get('note'), 255);

  if (!id || !fromAccountId || !toAccountId) {
    return { success: false, error: 'Data transfer tidak lengkap.' };
  }
  if (fromAccountId === toAccountId) {
    return { success: false, error: 'Akun asal dan akun tujuan harus berbeda.' };
  }
  if (amount <= 0 || amount > 999_999_999_999) {
    return { success: false, error: 'Jumlah transfer harus lebih besar dari Rp0.' };
  }

  const transferRes = await db.execute({
    sql: 'SELECT id FROM account_transfers WHERE id = ? AND user_id = ?',
    args: [id, userId]
  });
  if (transferRes.rows.length === 0) {
    return { success: false, error: 'Data transfer tidak ditemukan.' };
  }

  // Verify ownership and opening dates of accounts
  const accountsRes = await db.execute({
    sql: `SELECT id, name, opening_date, archived_at FROM accounts WHERE id IN (?, ?) AND user_id = ?`,
    args: [fromAccountId, toAccountId, userId]
  });
  if (accountsRes.rows.length !== 2) {
    return { success: false, error: 'Akun tidak ditemukan.' };
  }

  const fromAcc = accountsRes.rows.find(a => Number(a.id) === fromAccountId);
  const toAcc = accountsRes.rows.find(a => Number(a.id) === toAccountId);

  const transferDatePrefix = transferDate.slice(0, 10);
  if (transferDatePrefix < String(fromAcc.opening_date).slice(0, 10)) {
    const formattedOpening = formatFullDate(fromAcc.opening_date);
    return {
      success: false,
      error: `Transfer terjadi sebelum tanggal mulai ${fromAcc.name} (${formattedOpening}).`
    };
  }
  if (transferDatePrefix < String(toAcc.opening_date).slice(0, 10)) {
    const formattedOpening = formatFullDate(toAcc.opening_date);
    return {
      success: false,
      error: `Transfer terjadi sebelum tanggal mulai ${toAcc.name} (${formattedOpening}).`
    };
  }

  await db.execute({
    sql: `UPDATE account_transfers 
          SET from_account_id = ?, to_account_id = ?, amount = ?, transfer_date = ?, note = ?, updated_at = ?
          WHERE id = ? AND user_id = ?`,
    args: [fromAccountId, toAccountId, amount, transferDate, note, new Date().toISOString(), id, userId]
  });

  revalidatePath('/');
  revalidatePath('/akun');
  return { success: true };
}

export async function deleteAccountTransfer(id) {
  await dbReady;
  const userId = await getAuthSession();
  if (!userId) throw new Error('Unauthorized');

  const transferId = Number(id);

  await db.execute({
    sql: 'DELETE FROM account_transfers WHERE id = ? AND user_id = ?',
    args: [transferId, userId]
  });

  revalidatePath('/');
  revalidatePath('/akun');
  return { success: true };
}

// --- RECURRING TRANSACTIONS & OCCURRENCES ENGINE (STEP 10) ---

export async function materializeDueOccurrences(userId, asOfDateStr = getTodayDateStr()) {
  await dbReady;
  if (!userId) return;

  // 1. Fetch active and paused rules for user
  const rulesRes = await db.execute({
    sql: `SELECT 
            id, user_id, name, type, amount, category, account_id, 
            frequency, day_of_month, day_of_week, start_date, end_date, 
            status, paused_at, resumed_date, note 
          FROM recurring_rules 
          WHERE user_id = ? AND status IN ('ACTIVE', 'PAUSED')`,
    args: [userId]
  });

  const rules = rulesRes.rows;
  if (rules.length === 0) return;

  // 2. For each rule, compute candidate due dates up to asOfDateStr
  for (const rule of rules) {
    const candidates = computeDueCandidateDates(rule, asOfDateStr, 100);
    if (candidates.length >= 100) {
      console.warn(`[RECURRING ENGINE] Bounded materialization limit (100) reached for rule ${rule.id} (${rule.name}).`);
    }

    if (candidates.length === 0) continue;

    // Fetch existing occurrences for this rule
    const existingRes = await db.execute({
      sql: 'SELECT due_date FROM recurring_occurrences WHERE user_id = ? AND rule_id = ?',
      args: [userId, rule.id]
    });
    const existingDates = new Set(existingRes.rows.map(r => String(r.due_date).slice(0, 10)));

    for (const dueDate of candidates) {
      if (!existingDates.has(dueDate)) {
        // Materialize new occurrence with immutable financial snapshot
        await db.execute({
          sql: `INSERT OR IGNORE INTO recurring_occurrences 
                (user_id, rule_id, due_date, name, type, amount, category, account_id, note, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
          args: [
            userId,
            rule.id,
            dueDate,
            rule.name,
            rule.type || 'expense',
            Number(rule.amount),
            rule.category || 'Lainnya',
            rule.account_id != null ? Number(rule.account_id) : null,
            rule.note || ''
          ]
        });
        existingDates.add(dueDate);
      }
    }
  }
}

export async function getRecurringRules() {
  await dbReady;
  const userId = await getAuthSession();
  if (!userId) return [];

  const res = await db.execute({
    sql: `SELECT 
            r.id,
            r.user_id,
            r.name,
            r.type,
            r.amount,
            r.category,
            r.account_id,
            r.frequency,
            r.day_of_month,
            r.day_of_week,
            r.start_date,
            r.end_date,
            r.status,
            r.paused_at,
            r.resumed_date,
            r.note,
            r.created_at,
            r.updated_at,
            a.name AS account_name,
            a.type AS account_type,
            a.archived_at AS account_archived_at
          FROM recurring_rules r
          LEFT JOIN accounts a ON a.id = r.account_id AND a.user_id = r.user_id
          WHERE r.user_id = ?
          ORDER BY 
            CASE r.status 
              WHEN 'ACTIVE' THEN 1 
              WHEN 'PAUSED' THEN 2 
              WHEN 'ARCHIVED' THEN 3 
              ELSE 4 
            END ASC,
            r.id DESC`,
    args: [userId]
  });

  const todayStr = getTodayDateStr();

  return res.rows.map(r => {
    const plainRule = {
      id: Number(r.id),
      user_id: Number(r.user_id),
      name: String(r.name ?? ''),
      type: String(r.type ?? 'expense'),
      amount: Number(r.amount ?? 0),
      category: String(r.category ?? 'Lainnya'),
      account_id: r.account_id != null ? Number(r.account_id) : null,
      account_name: r.account_name ? String(r.account_name) : null,
      account_type: r.account_type ? String(r.account_type) : null,
      account_archived: !!r.account_archived_at,
      frequency: String(r.frequency ?? 'monthly'),
      day_of_month: r.day_of_month != null ? Number(r.day_of_month) : null,
      day_of_week: r.day_of_week != null ? Number(r.day_of_week) : null,
      start_date: String(r.start_date ?? ''),
      end_date: r.end_date ? String(r.end_date) : null,
      status: String(r.status ?? 'ACTIVE'),
      paused_at: r.paused_at ? String(r.paused_at) : null,
      resumed_date: r.resumed_date ? String(r.resumed_date) : null,
      note: String(r.note ?? ''),
      created_at: String(r.created_at ?? ''),
      updated_at: String(r.updated_at ?? '')
    };

    plainRule.next_due_date = r.status === 'ACTIVE'
      ? computeNextDueDate(plainRule, todayStr)
      : null;

    return plainRule;
  });
}

export async function getRecurringOccurrences() {
  await dbReady;
  const userId = await getAuthSession();
  if (!userId) return { pending: [], resolved: [] };

  // Materialize any newly due occurrences up to today
  await materializeDueOccurrences(userId);

  const res = await db.execute({
    sql: `SELECT 
            o.id,
            o.user_id,
            o.rule_id,
            o.due_date,
            o.name,
            o.type,
            o.amount,
            o.category,
            o.account_id,
            o.note,
            o.status,
            o.transaction_id,
            o.resolved_at,
            o.created_at,
            o.updated_at,
            a.name AS account_name,
            a.type AS account_type,
            a.archived_at AS account_archived_at,
            a.opening_date AS account_opening_date,
            r.name AS current_rule_name,
            r.status AS current_rule_status
          FROM recurring_occurrences o
          LEFT JOIN accounts a ON a.id = o.account_id AND a.user_id = o.user_id
          LEFT JOIN recurring_rules r ON r.id = o.rule_id AND r.user_id = o.user_id
          WHERE o.user_id = ?
          ORDER BY o.due_date ASC, o.id ASC`,
    args: [userId]
  });

  const todayStr = getTodayDateStr();
  const pending = [];
  const resolved = [];

  for (const r of res.rows) {
    const dueDateStr = String(r.due_date ?? '').slice(0, 10);
    const isOverdue = r.status === 'PENDING' && dueDateStr < todayStr;
    const isDueToday = r.status === 'PENDING' && dueDateStr === todayStr;

    // Calculate days overdue
    let daysOverdue = 0;
    if (isOverdue) {
      const dueTime = new Date(dueDateStr).getTime();
      const todayTime = new Date(todayStr).getTime();
      daysOverdue = Math.max(1, Math.round((todayTime - dueTime) / (1000 * 60 * 60 * 24)));
    }

    const plainOcc = {
      id: Number(r.id),
      user_id: Number(r.user_id),
      rule_id: Number(r.rule_id),
      due_date: dueDateStr,
      name: String(r.name ?? ''),
      type: String(r.type ?? 'expense'),
      amount: Number(r.amount ?? 0),
      category: String(r.category ?? 'Lainnya'),
      account_id: r.account_id != null ? Number(r.account_id) : null,
      account_name: r.account_name ? String(r.account_name) : null,
      account_type: r.account_type ? String(r.account_type) : null,
      account_archived: !!r.account_archived_at,
      account_opening_date: r.account_opening_date ? String(r.account_opening_date).slice(0, 10) : null,
      note: String(r.note ?? ''),
      status: String(r.status ?? 'PENDING'),
      is_overdue: isOverdue,
      is_due_today: isDueToday,
      days_overdue: daysOverdue,
      transaction_id: r.transaction_id != null ? Number(r.transaction_id) : null,
      resolved_at: r.resolved_at ? String(r.resolved_at) : null,
      created_at: String(r.created_at ?? ''),
      updated_at: String(r.updated_at ?? ''),
      current_rule_name: r.current_rule_name ? String(r.current_rule_name) : null,
      current_rule_status: r.current_rule_status ? String(r.current_rule_status) : null
    };

    if (plainOcc.status === 'PENDING') {
      pending.push(plainOcc);
    } else {
      resolved.push(plainOcc);
    }
  }

  // Pending sorted oldest first (due_date ASC)
  // Resolved sorted newest first (due_date DESC)
  resolved.sort((a, b) => b.due_date.localeCompare(a.due_date) || b.id - a.id);

  return {
    pending,
    resolved: resolved.slice(0, 50)
  };
}

export async function createRecurringRule(formData) {
  await dbReady;
  const userId = await getAuthSession();
  if (!userId) throw new Error('Unauthorized');

  const name = sanitizeDescription(formData.get('name') || '');
  const type = String(formData.get('type') || 'expense').toLowerCase();
  const amount = parseCurrency(formData.get('amount') || '0');
  const category = sanitizeCategoryName(formData.get('category') || 'Lainnya');
  const frequency = String(formData.get('frequency') || 'monthly').toLowerCase();
  const startDate = String(formData.get('start_date') || '').trim().slice(0, 10);
  const endDate = String(formData.get('end_date') || '').trim().slice(0, 10) || null;
  const note = sanitizeText(formData.get('note') || '');

  let dayOfMonth = null;
  let dayOfWeek = null;

  if (!name) {
    return { success: false, error: 'Nama jadwal rutin wajib diisi.' };
  }

  if (type !== 'expense' && type !== 'income') {
    return { success: false, error: 'Jenis transaksi tidak valid.' };
  }

  if (amount <= 0) {
    return { success: false, error: 'Jumlah harus lebih besar dari Rp0.' };
  }

  if (amount > 999_999_999_999) {
    return { success: false, error: 'Jumlah melebihi batas maksimum.' };
  }

  if (!startDate) {
    return { success: false, error: 'Tanggal mulai wajib diisi.' };
  }

  if (endDate && endDate < startDate) {
    return { success: false, error: 'Tanggal selesai tidak boleh lebih awal dari tanggal mulai.' };
  }

  if (frequency === 'monthly') {
    dayOfMonth = parseInt(formData.get('day_of_month'), 10);
    if (isNaN(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
      return { success: false, error: 'Pilih tanggal antara 1 sampai 31 untuk jadwal bulanan.' };
    }
  } else if (frequency === 'weekly') {
    dayOfWeek = parseInt(formData.get('day_of_week'), 10);
    if (isNaN(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) {
      return { success: false, error: 'Pilih hari dalam seminggu untuk jadwal mingguan.' };
    }
  } else {
    return { success: false, error: 'Frekuensi jadwal tidak valid.' };
  }

  // Account ownership and active validation
  let targetAccountId = null;
  const accountIdRaw = formData.get('account_id');
  if (accountIdRaw && accountIdRaw !== '__UNASSIGNED__' && accountIdRaw !== '') {
    const parsedAccId = parseInt(accountIdRaw, 10);
    if (!isNaN(parsedAccId)) {
      const accRes = await db.execute({
        sql: 'SELECT id, name, archived_at FROM accounts WHERE id = ? AND user_id = ?',
        args: [parsedAccId, userId]
      });
      if (accRes.rows.length === 0) {
        return { success: false, error: 'Akun tidak ditemukan.' };
      }
      if (accRes.rows[0].archived_at) {
        return { success: false, error: 'Tidak dapat menggunakan akun yang diarsipkan untuk jadwal baru.' };
      }
      targetAccountId = parsedAccId;
    }
  }

  const res = await db.execute({
    sql: `INSERT INTO recurring_rules 
          (user_id, name, type, amount, category, account_id, frequency, day_of_month, day_of_week, start_date, end_date, status, note)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
    args: [userId, name, type, amount, category, targetAccountId, frequency, dayOfMonth, dayOfWeek, startDate, endDate, note]
  });

  const ruleId = Number(res.lastInsertRowid);

  // Materialize any immediately due occurrences
  await materializeDueOccurrences(userId);

  revalidatePath('/rutin');
  revalidatePath('/transaksi');
  return { success: true, id: ruleId };
}

export async function updateRecurringRule(formData) {
  await dbReady;
  const userId = await getAuthSession();
  if (!userId) throw new Error('Unauthorized');

  const ruleId = Number(formData.get('id') || formData.get('rule_id'));
  if (!ruleId || isNaN(ruleId)) {
    return { success: false, error: 'Jadwal rutin tidak valid.' };
  }

  const existingRes = await db.execute({
    sql: 'SELECT id, user_id, status FROM recurring_rules WHERE id = ? AND user_id = ?',
    args: [ruleId, userId]
  });
  if (existingRes.rows.length === 0) {
    return { success: false, error: 'Jadwal rutin tidak ditemukan.' };
  }

  const name = sanitizeDescription(formData.get('name') || '');
  const type = String(formData.get('type') || 'expense').toLowerCase();
  const amount = parseCurrency(formData.get('amount') || '0');
  const category = sanitizeCategoryName(formData.get('category') || 'Lainnya');
  const frequency = String(formData.get('frequency') || 'monthly').toLowerCase();
  const startDate = String(formData.get('start_date') || '').trim().slice(0, 10);
  const endDate = String(formData.get('end_date') || '').trim().slice(0, 10) || null;
  const note = sanitizeText(formData.get('note') || '');

  let dayOfMonth = null;
  let dayOfWeek = null;

  if (!name) {
    return { success: false, error: 'Nama jadwal rutin wajib diisi.' };
  }
  if (type !== 'expense' && type !== 'income') {
    return { success: false, error: 'Jenis transaksi tidak valid.' };
  }
  if (amount <= 0) {
    return { success: false, error: 'Jumlah harus lebih besar dari Rp0.' };
  }
  if (amount > 999_999_999_999) {
    return { success: false, error: 'Jumlah melebihi batas maksimum.' };
  }
  if (!startDate) {
    return { success: false, error: 'Tanggal mulai wajib diisi.' };
  }
  if (endDate && endDate < startDate) {
    return { success: false, error: 'Tanggal selesai tidak boleh lebih awal dari tanggal mulai.' };
  }

  if (frequency === 'monthly') {
    dayOfMonth = parseInt(formData.get('day_of_month'), 10);
    if (isNaN(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
      return { success: false, error: 'Pilih tanggal antara 1 sampai 31 untuk jadwal bulanan.' };
    }
  } else if (frequency === 'weekly') {
    dayOfWeek = parseInt(formData.get('day_of_week'), 10);
    if (isNaN(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) {
      return { success: false, error: 'Pilih hari dalam seminggu untuk jadwal mingguan.' };
    }
  } else {
    return { success: false, error: 'Frekuensi jadwal tidak valid.' };
  }

  let targetAccountId = null;
  const accountIdRaw = formData.get('account_id');
  if (accountIdRaw && accountIdRaw !== '__UNASSIGNED__' && accountIdRaw !== '') {
    const parsedAccId = parseInt(accountIdRaw, 10);
    if (!isNaN(parsedAccId)) {
      const accRes = await db.execute({
        sql: 'SELECT id, name, archived_at FROM accounts WHERE id = ? AND user_id = ?',
        args: [parsedAccId, userId]
      });
      if (accRes.rows.length === 0) {
        return { success: false, error: 'Akun tidak ditemukan.' };
      }
      targetAccountId = parsedAccId;
    }
  }

  // Update rule metadata without touching already-materialized occurrence snapshots!
  await db.execute({
    sql: `UPDATE recurring_rules 
          SET name = ?, type = ?, amount = ?, category = ?, account_id = ?, 
              frequency = ?, day_of_month = ?, day_of_week = ?, start_date = ?, end_date = ?, 
              note = ?, updated_at = ?
          WHERE id = ? AND user_id = ?`,
    args: [name, type, amount, category, targetAccountId, frequency, dayOfMonth, dayOfWeek, startDate, endDate, note, new Date().toISOString(), ruleId, userId]
  });

  // Materialize any new dates if schedule expanded
  await materializeDueOccurrences(userId);

  revalidatePath('/rutin');
  revalidatePath('/transaksi');
  return { success: true };
}

export async function pauseRecurringRule(id) {
  await dbReady;
  const userId = await getAuthSession();
  if (!userId) throw new Error('Unauthorized');

  const ruleId = Number(id);
  const todayStr = getTodayDateStr();

  const res = await db.execute({
    sql: `UPDATE recurring_rules 
          SET status = 'PAUSED', paused_at = ?, updated_at = ? 
          WHERE id = ? AND user_id = ? AND status = 'ACTIVE'`,
    args: [todayStr, new Date().toISOString(), ruleId, userId]
  });

  if (res.rowsAffected === 0) {
    return { success: false, error: 'Jadwal rutin tidak ditemukan atau sudah tidak aktif.' };
  }

  revalidatePath('/rutin');
  return { success: true };
}

export async function resumeRecurringRule(id) {
  await dbReady;
  const userId = await getAuthSession();
  if (!userId) throw new Error('Unauthorized');

  const ruleId = Number(id);
  const todayStr = getTodayDateStr();

  const res = await db.execute({
    sql: `UPDATE recurring_rules 
          SET status = 'ACTIVE', resumed_date = ?, updated_at = ? 
          WHERE id = ? AND user_id = ? AND status = 'PAUSED'`,
    args: [todayStr, new Date().toISOString(), ruleId, userId]
  });

  if (res.rowsAffected === 0) {
    return { success: false, error: 'Jadwal rutin tidak ditemukan atau tidak sedang dijeda.' };
  }

  await materializeDueOccurrences(userId);

  revalidatePath('/rutin');
  return { success: true };
}

export async function archiveRecurringRule(id) {
  await dbReady;
  const userId = await getAuthSession();
  if (!userId) throw new Error('Unauthorized');

  const ruleId = Number(id);

  const res = await db.execute({
    sql: `UPDATE recurring_rules 
          SET status = 'ARCHIVED', updated_at = ? 
          WHERE id = ? AND user_id = ?`,
    args: [new Date().toISOString(), ruleId, userId]
  });

  if (res.rowsAffected === 0) {
    return { success: false, error: 'Jadwal rutin tidak ditemukan.' };
  }

  revalidatePath('/rutin');
  return { success: true };
}

export async function skipRecurringOccurrence(id) {
  await dbReady;
  const userId = await getAuthSession();
  if (!userId) throw new Error('Unauthorized');

  const occId = Number(id);
  if (!occId || isNaN(occId)) {
    return { success: false, error: 'Jadwal tidak valid.' };
  }

  const res = await db.execute({
    sql: `UPDATE recurring_occurrences 
          SET status = 'SKIPPED', resolved_at = ?, updated_at = ? 
          WHERE id = ? AND user_id = ? AND status = 'PENDING'`,
    args: [new Date().toISOString(), new Date().toISOString(), occId, userId]
  });

  if (res.rowsAffected === 0) {
    return { success: false, error: 'Transaksi rutin tidak ditemukan atau sudah diselesaikan.' };
  }

  revalidatePath('/rutin');
  return { success: true };
}

export async function recordRecurringOccurrence(formData) {
  await dbReady;
  const userId = await getAuthSession();
  if (!userId) throw new Error('Unauthorized');

  const occurrenceId = Number(formData.get('occurrence_id'));
  if (!occurrenceId || isNaN(occurrenceId)) {
    return { success: false, error: 'Jadwal tidak valid.' };
  }

  const description = sanitizeDescription(formData.get('description') || '');
  const amount = parseCurrency(formData.get('amount') || '0');
  const category = sanitizeCategoryName(formData.get('category') || 'Lainnya');
  const type = String(formData.get('type') || 'expense').toLowerCase();
  const txDateRaw = String(formData.get('date') || '').trim();
  const notes = sanitizeText(formData.get('notes') || '');

  if (!description) {
    return { success: false, error: 'Deskripsi transaksi wajib diisi.' };
  }
  if (amount <= 0) {
    return { success: false, error: 'Jumlah harus lebih besar dari Rp0.' };
  }
  if (amount > 999_999_999_999) {
    return { success: false, error: 'Jumlah melebihi batas maksimum.' };
  }
  if (!txDateRaw) {
    return { success: false, error: 'Tanggal transaksi wajib diisi.' };
  }

  const txDatePrefix = txDateRaw.slice(0, 10);
  let txDateIso;
  if (txDateRaw.length === 10) {
    txDateIso = new Date(`${txDateRaw}T12:00:00.000Z`).toISOString();
  } else {
    try {
      txDateIso = new Date(txDateRaw).toISOString();
    } catch {
      txDateIso = new Date().toISOString();
    }
  }

  // Account validation
  let targetAccountId = null;
  const accountIdRaw = formData.get('account_id');
  if (accountIdRaw && accountIdRaw !== '__UNASSIGNED__' && accountIdRaw !== '') {
    const parsedId = parseInt(accountIdRaw, 10);
    if (!isNaN(parsedId)) {
      targetAccountId = parsedId;
    }
  }

  // ATOMIC RECORDING WORKFLOW
  const tx = await db.transaction('write');
  try {
    // 1. Fetch occurrence and verify ownership + PENDING state
    const occRes = await tx.execute({
      sql: 'SELECT id, user_id, rule_id, due_date, status FROM recurring_occurrences WHERE id = ? AND user_id = ?',
      args: [occurrenceId, userId]
    });

    if (occRes.rows.length === 0) {
      await tx.rollback();
      return { success: false, error: 'Jadwal rutin tidak ditemukan.' };
    }

    const occ = occRes.rows[0];
    if (occ.status !== 'PENDING') {
      await tx.rollback();
      return { success: false, error: 'Transaksi rutin ini sudah dicatat atau dilewati.' };
    }

    // 2. Validate account if selected
    if (targetAccountId) {
      const accRes = await tx.execute({
        sql: 'SELECT id, name, opening_date, archived_at FROM accounts WHERE id = ? AND user_id = ?',
        args: [targetAccountId, userId]
      });
      if (accRes.rows.length === 0) {
        await tx.rollback();
        return { success: false, error: 'Akun tidak ditemukan.' };
      }
      const acc = accRes.rows[0];
      if (acc.archived_at) {
        await tx.rollback();
        return { success: false, error: `Akun "${acc.name}" telah diarsipkan. Pilih akun aktif untuk mencatat transaksi.` };
      }
      if (txDatePrefix < String(acc.opening_date).slice(0, 10)) {
        const formattedOpening = formatFullDate(acc.opening_date);
        await tx.rollback();
        return {
          success: false,
          error: `Transaksi terjadi sebelum tanggal mulai ${acc.name} (${formattedOpening}).`
        };
      }
    }

    // 3. Create real transaction in expenses table
    const insRes = await tx.execute({
      sql: `INSERT INTO expenses (user_id, amount, description, date, category, notes, is_recurring, type, account_id)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      args: [userId, amount, description, txDateIso, category, notes, type, targetAccountId]
    });
    const createdTxId = Number(insRes.lastInsertRowid);

    // 4. Mark occurrence as POSTED with transaction_id link
    await tx.execute({
      sql: `UPDATE recurring_occurrences 
            SET status = 'POSTED', transaction_id = ?, resolved_at = ?, updated_at = ?
            WHERE id = ? AND user_id = ?`,
      args: [createdTxId, new Date().toISOString(), new Date().toISOString(), occurrenceId, userId]
    });

    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }

  revalidatePath('/');
  revalidatePath('/transaksi');
  revalidatePath('/akun');
  revalidatePath('/rutin');
  revalidatePath('/analisis');
  revalidatePath('/budget');
  return { success: true };
}

