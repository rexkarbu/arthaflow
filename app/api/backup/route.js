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
      sql: `SELECT id, amount, description, date, category, notes, is_recurring, type, account_id 
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

    // 7. Accounts (Step 9)
    const accountsRes = await db.execute({
      sql: `SELECT id, name, type, opening_balance, opening_date, archived_at, created_at
            FROM accounts
            WHERE user_id = ?
            ORDER BY id ASC`,
      args: [userId]
    });

    // 8. Account Transfers (Step 9)
    const transfersRes = await db.execute({
      sql: `SELECT id, from_account_id, to_account_id, amount, transfer_date, note, created_at
            FROM account_transfers
            WHERE user_id = ?
            ORDER BY transfer_date ASC, id ASC`,
      args: [userId]
    });

    // 9. Recurring Rules (Step 10 & 11)
    const recurringRulesRes = await db.execute({
      sql: `SELECT id, name, type, amount, category, account_id, frequency, day_of_month, day_of_week, start_date, end_date, status, paused_at, resumed_date, pause_history, note, created_at
            FROM recurring_rules
            WHERE user_id = ?
            ORDER BY id ASC`,
      args: [userId]
    });

    // 10. Recurring Occurrences (Step 10)
    const recurringOccurrencesRes = await db.execute({
      sql: `SELECT id, rule_id, due_date, name, type, amount, category, account_id, note, status, transaction_id, resolved_at, created_at
            FROM recurring_occurrences
            WHERE user_id = ?
            ORDER BY due_date ASC, id ASC`,
      args: [userId]
    });

    const backupPayload = {
      format: 'arthaflow-backup',
      version: 3,
      exported_at: new Date().toISOString(),
      data: {
        categories: categoriesRes.rows.map(r => ({
          id: Number(r.id),
          name: String(r.name ?? ''),
          type: String(r.type ?? '')
        })),
        accounts: accountsRes.rows.map(r => ({
          id: Number(r.id),
          name: String(r.name ?? ''),
          type: String(r.type ?? 'OTHER'),
          opening_balance: Number(r.opening_balance ?? 0),
          opening_date: String(r.opening_date ?? ''),
          archived_at: r.archived_at ? String(r.archived_at) : null,
          created_at: String(r.created_at ?? '')
        })),
        account_transfers: transfersRes.rows.map(r => ({
          id: Number(r.id),
          from_account_id: Number(r.from_account_id),
          to_account_id: Number(r.to_account_id),
          amount: Number(r.amount),
          transfer_date: String(r.transfer_date ?? ''),
          note: String(r.note ?? ''),
          created_at: String(r.created_at ?? '')
        })),
        recurring_rules: recurringRulesRes.rows.map(r => ({
          id: Number(r.id),
          name: String(r.name ?? ''),
          type: String(r.type ?? 'expense'),
          amount: Number(r.amount),
          category: String(r.category ?? 'Lainnya'),
          account_id: r.account_id != null ? Number(r.account_id) : null,
          frequency: String(r.frequency ?? 'monthly'),
          day_of_month: r.day_of_month != null ? Number(r.day_of_month) : null,
          day_of_week: r.day_of_week != null ? Number(r.day_of_week) : null,
          start_date: String(r.start_date ?? ''),
          end_date: r.end_date ? String(r.end_date) : null,
          status: String(r.status ?? 'ACTIVE'),
          paused_at: r.paused_at ? String(r.paused_at) : null,
          resumed_date: r.resumed_date ? String(r.resumed_date) : null,
          pause_history: r.pause_history ? String(r.pause_history) : '[]',
          note: String(r.note ?? ''),
          created_at: String(r.created_at ?? '')
        })),
        recurring_occurrences: recurringOccurrencesRes.rows.map(r => ({
          id: Number(r.id),
          rule_id: Number(r.rule_id),
          due_date: String(r.due_date ?? ''),
          name: String(r.name ?? ''),
          type: String(r.type ?? 'expense'),
          amount: Number(r.amount),
          category: String(r.category ?? 'Lainnya'),
          account_id: r.account_id != null ? Number(r.account_id) : null,
          note: String(r.note ?? ''),
          status: String(r.status ?? 'PENDING'),
          transaction_id: r.transaction_id != null ? Number(r.transaction_id) : null,
          resolved_at: r.resolved_at ? String(r.resolved_at) : null,
          created_at: String(r.created_at ?? '')
        })),
        transactions: transactionsRes.rows.map(r => ({
          id: Number(r.id),
          amount: Number(r.amount),
          description: String(r.description ?? ''),
          date: String(r.date ?? ''),
          category: String(r.category ?? 'Lainnya'),
          notes: String(r.notes ?? ''),
          is_recurring: Number(r.is_recurring ?? 0),
          type: String(r.type ?? 'expense'),
          account_id: r.account_id != null ? Number(r.account_id) : null
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
