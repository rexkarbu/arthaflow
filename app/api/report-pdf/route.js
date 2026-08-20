import { getAuthSession } from '@/app/actions';
import db from '@/lib/db';
import { generateMonthlyPdfReport } from '@/lib/pdfReportGenerator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const userId = await getAuthSession();
    if (!userId) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');

    // Strict validation for YYYY-MM
    if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return new Response('Format bulan tidak valid. Gunakan format YYYY-MM.', { status: 400 });
    }

    // 1. Query all transactions for the authenticated user and specified month
    const expensesRes = await db.execute({
      sql: `SELECT id, amount, description, date, category, notes, is_recurring, type
            FROM expenses
            WHERE user_id = ? AND date LIKE ?
            ORDER BY date DESC, id DESC`,
      args: [userId, `${month}%`]
    });

    const transactions = expensesRes.rows.map(r => ({
      id: Number(r.id),
      amount: Math.round(Number(r.amount)),
      description: String(r.description || ''),
      date: String(r.date || ''),
      category: String(r.category || 'Lainnya'),
      notes: String(r.notes || ''),
      is_recurring: Number(r.is_recurring) || 0,
      type: String(r.type || 'expense')
    }));

    // 2. Query overall monthly budget
    const budgetRes = await db.execute({
      sql: `SELECT amount FROM budgets WHERE user_id = ? AND month = ?`,
      args: [userId, month]
    });
    const budget = budgetRes.rows.length > 0 ? Math.round(Number(budgetRes.rows[0].amount)) : null;

    // 3. Query category budgets for the specified month
    const catBudgetsRes = await db.execute({
      sql: `SELECT category, amount FROM category_budgets WHERE user_id = ? AND month = ? ORDER BY amount DESC`,
      args: [userId, month]
    });
    const categoryBudgets = catBudgetsRes.rows.map(r => ({
      category: String(r.category),
      limit: Math.round(Number(r.amount))
    }));

    // 4. Generate PDF
    const pdfBytes = generateMonthlyPdfReport({
      month,
      transactions,
      budget,
      categoryBudgets,
      generatedAt: new Date()
    });

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="arthaflow-laporan-${month}.pdf"`,
        'Cache-Control': 'private, no-store'
      }
    });
  } catch (error) {
    console.error('PDF Report generation error:', error);
    return new Response('Laporan belum berhasil dibuat. Coba lagi.', { status: 500 });
  }
}
