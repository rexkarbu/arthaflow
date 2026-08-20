import { NextResponse } from 'next/server';
import db, { dbReady } from '@/lib/db';
import { getAuthSession } from '@/app/actions';

export const dynamic = 'force-dynamic';

export async function GET() {
  await dbReady;
  const userId = await getAuthSession();
  if (!userId) {
    return NextResponse.json({ error: 'Tidak terotentikasi' }, { status: 401 });
  }

  try {
    // 1. Categories
    const categoriesRes = await db.execute({
      sql: 'SELECT id, name, type FROM categories WHERE user_id = ? ORDER BY id ASC',
      args: [userId]
    });

    // 2. Transactions (expenses table)
    const transactionsRes = await db.execute({
      sql: `SELECT id, amount, description, date, category, notes, is_recurring, type 
            FROM expenses 
            WHERE user_id = ? 
            ORDER BY date ASC, id ASC`,
      args: [userId]
    });

    // 3. Monthly Budgets
    const budgetsRes = await db.execute({
      sql: 'SELECT id, month, amount FROM budgets WHERE user_id = ? ORDER BY month ASC',
      args: [userId]
    });

    // 4. Category Budgets
    const catBudgetsRes = await db.execute({
      sql: 'SELECT id, month, category, amount FROM category_budgets WHERE user_id = ? ORDER BY month ASC, category ASC',
      args: [userId]
    });

    // 5. Goals
    const goalsRes = await db.execute({
      sql: 'SELECT id, name, target_amount, created_at FROM goals WHERE user_id = ? ORDER BY id ASC',
      args: [userId]
    });

    // 6. Goal Contributions (Step 6 ledger)
    const contributionsRes = await db.execute({
      sql: `SELECT id, goal_id, amount, note, created_at 
            FROM goal_contributions 
            WHERE user_id = ? 
            ORDER BY created_at ASC, id ASC`,
      args: [userId]
    });

    const backupPayload = {
      format: 'arthaflow-backup',
      version: 1,
      exported_at: new Date().toISOString(),
      data: {
        categories: categoriesRes.rows.map(r => ({
          id: Number(r.id),
          name: String(r.name ?? ''),
          type: String(r.type ?? '')
        })),
        transactions: transactionsRes.rows.map(r => ({
          id: Number(r.id),
          amount: Number(r.amount),
          description: String(r.description ?? ''),
          date: String(r.date ?? ''),
          category: String(r.category ?? 'Lainnya'),
          notes: String(r.notes ?? ''),
          is_recurring: Number(r.is_recurring ?? 0),
          type: String(r.type ?? 'expense')
        })),
        budgets: budgetsRes.rows.map(r => ({
          id: Number(r.id),
          month: String(r.month),
          amount: Number(r.amount)
        })),
        category_budgets: catBudgetsRes.rows.map(r => ({
          id: Number(r.id),
          month: String(r.month),
          category: String(r.category),
          amount: Number(r.amount)
        })),
        goals: goalsRes.rows.map(r => ({
          id: Number(r.id),
          name: String(r.name ?? ''),
          target_amount: Number(r.target_amount),
          created_at: String(r.created_at ?? '')
        })),
        goal_contributions: contributionsRes.rows.map(r => ({
          id: Number(r.id),
          goal_id: Number(r.goal_id),
          amount: Number(r.amount),
          note: String(r.note ?? ''),
          created_at: String(r.created_at ?? '')
        }))
      }
    };

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `arthaflow-backup-${dateStr}.json`;

    return new NextResponse(JSON.stringify(backupPayload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, private'
      }
    });
  } catch (error) {
    console.error('Backup error:', error);
    return NextResponse.json({ error: 'Gagal membuat backup data' }, { status: 500 });
  }
}
