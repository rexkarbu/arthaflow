'use server';

import db, { dbReady } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { parseCurrency } from '@/lib/currency';
import {
  sanitizeText,
  sanitizeDescription,
  sanitizeCategoryName,
  sanitizeGoalName,
  sanitizeUsername
} from '@/lib/formSanitizer';

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
    maxAge: 60 * 60 * 24 * 30 
  });

  revalidatePath('/');
  return { success: true };
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
  cookieStore.delete('auth_token');
  revalidatePath('/');
}

// --- CRUD OPERATIONS ---

export async function getExpenses() {
  await dbReady;
  const userId = await getAuthSession();
  if (!userId) return [];
  const res = await db.execute({
    sql: 'SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC, id DESC',
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
    type: String(r.type ?? 'expense')
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
  const date = new Date().toISOString();

  if (amount <= 0 || !description) throw new Error('Invalid input');

  await db.execute({
    sql: 'INSERT INTO expenses (user_id, amount, description, date, category, notes, is_recurring, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    args: [userId, amount, description, date, category, notes, isRecurring, type]
  });
  revalidatePath('/');
}

export async function deleteExpense(id) {
  const userId = await getAuthSession();
  if (!userId) throw new Error('Unauthorized');

  await db.execute({
    sql: 'DELETE FROM expenses WHERE id = ? AND user_id = ?',
    args: [id, userId]
  });
  revalidatePath('/');
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

  if (isNaN(id) || amount <= 0 || !description) throw new Error('Invalid input');

  await db.execute({
    sql: 'UPDATE expenses SET amount = ?, description = ?, category = ?, notes = ?, is_recurring = ?, type = ? WHERE id = ? AND user_id = ?',
    args: [amount, description, category, notes, isRecurring, type, id, userId]
  });
  revalidatePath('/');
}

export async function seedRecurringExpenses(targetMonth) {
  const userId = await getAuthSession();
  if (!userId) return;

  const [year, month] = targetMonth.split('-').map(Number);
  const prevDate = new Date(year, month - 2, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  const resRecurring = await db.execute({
    sql: `SELECT * FROM expenses WHERE user_id = ? AND is_recurring = 1 AND date LIKE ?`,
    args: [userId, `${prevMonth}%`]
  });
  const recurring = resRecurring.rows;

  if (recurring.length === 0) return;

  const resExisting = await db.execute({
    sql: `SELECT description, amount, category, notes, type FROM expenses WHERE user_id = ? AND is_recurring = 1 AND date LIKE ?`,
    args: [userId, `${targetMonth}%`]
  });
  const existingThisMonth = new Set(resExisting.rows.map(r => {
    const type = (r.type || 'expense').toLowerCase();
    const category = (r.category || 'Lainnya').toLowerCase();
    const description = String(r.description).toLowerCase();
    const amount = Number(r.amount);
    const notes = String(r.notes || '').toLowerCase();
    return `${type}::${category}::${description}::${amount}::${notes}`;
  }));

  const targetDate = new Date(year, month - 1, 1).toISOString();

  const tx = await db.transaction('write');
  try {
    for (const exp of recurring) {
      const signature = `${String(exp.type || 'expense').toLowerCase()}::${String(exp.category || 'Lainnya').toLowerCase()}::${String(exp.description).toLowerCase()}::${Number(exp.amount)}::${String(exp.notes || '').toLowerCase()}`;
      if (!existingThisMonth.has(signature)) {
        await tx.execute({
          sql: `INSERT INTO expenses (user_id, amount, description, date, category, notes, is_recurring, type) VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
          args: [userId, exp.amount, exp.description, targetDate, exp.category, exp.notes || '', exp.type || 'expense']
        });
        existingThisMonth.add(signature);
      }
    }
    await tx.commit();
  } catch (error) {
    await tx.rollback();
  }

  revalidatePath('/');
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
    sql: 'SELECT * FROM goals WHERE user_id = ? ORDER BY id DESC',
    args: [userId]
  });
  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    target_amount: row.target_amount,
    created_at: row.created_at
  }));
}

export async function addGoal(formData) {
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
}

export async function deleteGoal(id) {
  const userId = await getAuthSession();
  if (!userId) throw new Error('Unauthorized');

  await db.execute({
    sql: 'DELETE FROM goals WHERE id = ? AND user_id = ?',
    args: [id, userId]
  });

  revalidatePath('/');
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
