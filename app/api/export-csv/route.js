import { NextResponse } from 'next/server';
import db, { dbReady } from '@/lib/db';
import { getAuthSession } from '@/app/actions';

export const dynamic = 'force-dynamic';

/**
 * Escapes text fields for CSV to prevent formula injection (=, +, -, @)
 * and properly quotes fields containing commas, quotes, or newlines.
 */
function escapeCsvText(val) {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  
  // Formula injection defense: if leading character is dangerous, prepend a single quote
  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }
  
  // Escape inner double quotes
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

export async function GET() {
  await dbReady;
  const userId = await getAuthSession();
  if (!userId) {
    return NextResponse.json({ error: 'Tidak terotentikasi' }, { status: 401 });
  }

  try {
    const res = await db.execute({
      sql: `SELECT id, amount, description, date, category, notes, is_recurring, type 
            FROM expenses 
            WHERE user_id = ? 
            ORDER BY date DESC, id DESC`,
      args: [userId]
    });

    const headers = ['ID', 'Tanggal', 'Tipe', 'Kategori', 'Deskripsi', 'Catatan', 'Jumlah', 'Rutin'];
    const rows = res.rows.map(r => {
      const typeLabel = r.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
      const recurringLabel = r.is_recurring === 1 ? 'Ya' : 'Tidak';
      const amountVal = Number(r.amount);

      return [
        r.id,
        escapeCsvText(r.date),
        escapeCsvText(typeLabel),
        escapeCsvText(r.category || 'Lainnya'),
        escapeCsvText(r.description || ''),
        escapeCsvText(r.notes || ''),
        amountVal, // Pure numeric value (formula safe, keeps calculations valid)
        escapeCsvText(recurringLabel)
      ].join(',');
    });

    // UTF-8 BOM (\uFEFF) ensures Indonesian text opens flawlessly in Excel & spreadsheet tools
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `arthaflow-transaksi-${dateStr}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, private'
      }
    });
  } catch (error) {
    console.error('CSV Export error:', error);
    return NextResponse.json({ error: 'Gagal mengekspor CSV' }, { status: 500 });
  }
}
